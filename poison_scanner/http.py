"""Shared HTTP client: per-host rate limiting, retries with backoff, small TTL cache."""
from __future__ import annotations

import threading
import time
from typing import Any
from urllib.parse import urlparse

import requests

USER_AGENT = "PoisonScanner/1.0"


class ApiError(Exception):
    pass


class _RateLimiter:
    def __init__(self, per_second: float):
        self.interval = 1.0 / per_second
        self.lock = threading.Lock()
        self.next_time = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = self.next_time - now
            self.next_time = max(now, self.next_time) + self.interval
        if delay > 0:
            time.sleep(delay)


# Conservative defaults that stay inside each provider's public limits.
HOST_LIMITS = {
    "api.dexscreener.com": 4.0,
    "api.rugcheck.xyz": 2.0,
    "public-api.birdeye.so": 1.0,   # free tier ~1 rps
    "pro-api.solscan.io": 5.0,
    "api.mainnet-beta.solana.com": 3.0,
    "lite-api.jup.ag": 1.0,
    "api.jup.ag": 1.0,
}
DEFAULT_LIMIT = 8.0


class HttpClient:
    def __init__(self, timeout: float = 20.0):
        self.session = requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.timeout = timeout
        self._limiters: dict[str, _RateLimiter] = {}
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, Any]] = {}

    def _limiter(self, url: str) -> _RateLimiter:
        host = urlparse(url).hostname or ""
        with self._lock:
            if host not in self._limiters:
                self._limiters[host] = _RateLimiter(HOST_LIMITS.get(host, DEFAULT_LIMIT))
            return self._limiters[host]

    def request(self, method: str, url: str, *, params=None, json=None, headers=None,
                cache_ttl: float = 0, retries: int = 4) -> Any:
        key = None
        if cache_ttl and method == "GET":
            key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
            hit = self._cache.get(key)
            if hit and hit[0] > time.time():
                return hit[1]

        last_err: Exception | None = None
        for attempt in range(retries):
            self._limiter(url).wait()
            try:
                r = self.session.request(method, url, params=params, json=json,
                                         headers=headers, timeout=self.timeout)
            except requests.RequestException as e:
                last_err = e
                time.sleep(1.5 * (2 ** attempt))
                continue
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = r.headers.get("Retry-After")
                wait = float(retry_after) + 0.5 if retry_after and retry_after.isdigit() else 1.5 * (2 ** attempt)
                last_err = ApiError(f"{r.status_code} from {urlparse(url).hostname}")
                time.sleep(min(wait, 30))
                continue
            if r.status_code == 404:
                return None
            if r.status_code >= 400:
                raise ApiError(f"HTTP {r.status_code} from {urlparse(url).hostname}: {r.text[:200]}")
            try:
                data = r.json()
            except ValueError as e:
                raise ApiError(f"Invalid JSON from {urlparse(url).hostname}") from e
            if key:
                self._cache[key] = (time.time() + cache_ttl, data)
            return data
        raise ApiError(f"Request failed after {retries} tries: {last_err}")

    def get(self, url: str, **kw) -> Any:
        return self.request("GET", url, **kw)

    def post(self, url: str, **kw) -> Any:
        return self.request("POST", url, **kw)
