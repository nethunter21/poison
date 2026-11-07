"""RugCheck public API (no key needed for reports). https://api.rugcheck.xyz/swagger"""
from __future__ import annotations

from ..http import HttpClient

BASE = "https://api.rugcheck.xyz/v1"


class RugCheck:
    def __init__(self, http: HttpClient):
        self.http = http

    def report(self, mint: str) -> dict | None:
        return self.http.get(f"{BASE}/tokens/{mint}/report", cache_ttl=60)

    def summary(self, mint: str) -> dict | None:
        return self.http.get(f"{BASE}/tokens/{mint}/report/summary", cache_ttl=60)

    def recent_verified(self) -> list[dict]:
        return self.http.get(f"{BASE}/stats/verified", cache_ttl=60) or []

    def new_tokens(self) -> list[dict]:
        return self.http.get(f"{BASE}/stats/new_tokens", cache_ttl=30) or []
