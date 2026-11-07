"""Solscan Pro API v2 (needs a key). Used for fast wallet swap history when available."""
from __future__ import annotations

from ..http import HttpClient

BASE = "https://pro-api.solscan.io/v2.0"


class Solscan:
    def __init__(self, http: HttpClient, api_key: str):
        self.http = http
        self.api_key = api_key.strip()

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _get(self, path: str, params: dict):
        if not self.enabled:
            return None
        data = self.http.get(f"{BASE}{path}", params=params, headers={"token": self.api_key}, cache_ttl=30)
        if not data or not data.get("success", True):
            return None
        return data.get("data")

    def wallet_swaps(self, wallet: str, pages: int = 2, page_size: int = 100) -> list[dict]:
        """Returns normalized swaps: {signature, block_time, token_in, amount_in, token_out, amount_out}."""
        out: list[dict] = []
        for page in range(1, pages + 1):
            items = self._get("/account/defi/activities", {
                "address": wallet,
                "activity_type[]": "ACTIVITY_TOKEN_SWAP",
                "page": page, "page_size": page_size,
                "sort_by": "block_time", "sort_order": "desc",
            }) or []
            for it in items:
                r = it.get("routers") or {}
                try:
                    out.append({
                        "signature": it.get("trans_id"),
                        "block_time": it.get("block_time"),
                        "token_in": r["token1"],
                        "amount_in": int(r["amount1"]) / 10 ** int(r.get("token1_decimals") or 0),
                        "token_out": r["token2"],
                        "amount_out": int(r["amount2"]) / 10 ** int(r.get("token2_decimals") or 0),
                    })
                except (KeyError, TypeError, ValueError):
                    continue
            if len(items) < page_size:
                break
        return out
