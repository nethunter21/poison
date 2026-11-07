"""DexScreener public API (no key). https://docs.dexscreener.com/api/reference"""
from __future__ import annotations

from ..http import HttpClient

BASE = "https://api.dexscreener.com"
CHAIN = "solana"


class DexScreener:
    def __init__(self, http: HttpClient):
        self.http = http

    def latest_profiles(self) -> list[dict]:
        data = self.http.get(f"{BASE}/token-profiles/latest/v1", cache_ttl=20) or []
        return [d for d in data if d.get("chainId") == CHAIN]

    def latest_boosts(self) -> list[dict]:
        data = self.http.get(f"{BASE}/token-boosts/latest/v1", cache_ttl=20) or []
        return [d for d in data if d.get("chainId") == CHAIN]

    def top_boosts(self) -> list[dict]:
        data = self.http.get(f"{BASE}/token-boosts/top/v1", cache_ttl=20) or []
        return [d for d in data if d.get("chainId") == CHAIN]

    def community_takeovers(self) -> list[dict]:
        data = self.http.get(f"{BASE}/community-takeovers/latest/v1", cache_ttl=60) or []
        return [d for d in data if d.get("chainId") == CHAIN]

    def pairs_for_tokens(self, mints: list[str]) -> list[dict]:
        """All pairs for up to N mints (batched 30 per request)."""
        out: list[dict] = []
        for i in range(0, len(mints), 30):
            chunk = ",".join(mints[i:i + 30])
            data = self.http.get(f"{BASE}/tokens/v1/{CHAIN}/{chunk}", cache_ttl=10) or []
            out.extend(p for p in data if p.get("chainId") == CHAIN)
        return out

    def token_pairs(self, mint: str) -> list[dict]:
        data = self.http.get(f"{BASE}/token-pairs/v1/{CHAIN}/{mint}", cache_ttl=10) or []
        return [p for p in data if p.get("chainId") == CHAIN]

    def search(self, query: str) -> list[dict]:
        data = self.http.get(f"{BASE}/latest/dex/search", params={"q": query}, cache_ttl=10) or {}
        return [p for p in data.get("pairs") or [] if p.get("chainId") == CHAIN]

    def best_pair(self, mint: str) -> dict | None:
        """Most liquid pair where `mint` is the base token."""
        pairs = [p for p in self.token_pairs(mint)
                 if (p.get("baseToken") or {}).get("address") == mint]
        if not pairs:
            return None
        return max(pairs, key=lambda p: (p.get("liquidity") or {}).get("usd") or 0)

    def sol_price_usd(self) -> float:
        from ..config import WSOL_MINT
        p = self.best_pair(WSOL_MINT)
        try:
            return float(p["priceUsd"]) if p else 0.0
        except (KeyError, TypeError, ValueError):
            return 0.0


def best_pairs_by_token(pairs: list[dict]) -> dict[str, dict]:
    """Group pairs by base mint keeping the most liquid one."""
    best: dict[str, dict] = {}
    for p in pairs:
        mint = (p.get("baseToken") or {}).get("address")
        if not mint:
            continue
        liq = (p.get("liquidity") or {}).get("usd") or 0
        if mint not in best or liq > ((best[mint].get("liquidity") or {}).get("usd") or 0):
            best[mint] = p
    return best
