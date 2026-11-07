"""Birdeye public API (needs a free key from https://bds.birdeye.so)."""
from __future__ import annotations

from ..http import HttpClient

BASE = "https://public-api.birdeye.so"


class Birdeye:
    def __init__(self, http: HttpClient, api_key: str):
        self.http = http
        self.api_key = api_key.strip()

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _get(self, path: str, params: dict | None = None, ttl: float = 15):
        if not self.enabled:
            return None
        headers = {"X-API-KEY": self.api_key, "x-chain": "solana", "accept": "application/json"}
        data = self.http.get(f"{BASE}{path}", params=params, headers=headers, cache_ttl=ttl)
        if not data or not data.get("success", True):
            return None
        return data.get("data")

    def token_security(self, mint: str) -> dict | None:
        return self._get("/defi/token_security", {"address": mint}, ttl=120)

    def token_overview(self, mint: str) -> dict | None:
        return self._get("/defi/token_overview", {"address": mint}, ttl=30)

    def new_listings(self, limit: int = 20) -> list[dict]:
        d = self._get("/defi/v2/tokens/new_listing",
                      {"limit": limit, "meme_platform_enabled": "true"}, ttl=30)
        return (d or {}).get("items") or []

    def top_traders(self, mint: str, time_frame: str = "24h", limit: int = 10) -> list[dict]:
        d = self._get("/defi/v2/tokens/top_traders",
                      {"address": mint, "time_frame": time_frame, "sort_type": "desc",
                       "sort_by": "volume", "limit": limit}, ttl=60)
        return (d or {}).get("items") or []

    def token_trades(self, mint: str, offset: int = 0, limit: int = 50,
                     sort_type: str = "asc") -> list[dict]:
        d = self._get("/defi/txs/token",
                      {"address": mint, "offset": offset, "limit": limit,
                       "tx_type": "swap", "sort_type": sort_type}, ttl=30)
        return (d or {}).get("items") or []
