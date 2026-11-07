"""Minimal Solana JSON-RPC client. Works with the public RPC; a Helius/QuickNode/Triton
URL in Settings makes everything much faster and avoids rate limits."""
from __future__ import annotations

import itertools

from ..http import ApiError, HttpClient


class SolanaRPC:
    def __init__(self, http: HttpClient, url: str):
        self.http = http
        self.url = url.strip()
        self._ids = itertools.count(1)

    def call(self, method: str, params: list | None = None):
        body = {"jsonrpc": "2.0", "id": next(self._ids), "method": method, "params": params or []}
        data = self.http.post(self.url, json=body)
        if data is None:
            raise ApiError(f"RPC {method}: empty response")
        if "error" in data:
            raise ApiError(f"RPC {method}: {data['error'].get('message')}")
        return data.get("result")

    def signatures(self, address: str, limit: int = 1000, before: str | None = None,
                   until: str | None = None) -> list[dict]:
        cfg: dict = {"limit": limit, "commitment": "confirmed"}
        if before:
            cfg["before"] = before
        if until:
            cfg["until"] = until
        return self.call("getSignaturesForAddress", [address, cfg]) or []

    def oldest_signatures(self, address: str, max_pages: int = 25) -> tuple[list[dict], bool]:
        """Walks back through history. Returns (sigs oldest-first, reached_beginning)."""
        all_sigs: list[dict] = []
        before = None
        for _ in range(max_pages):
            page = self.signatures(address, 1000, before)
            all_sigs.extend(page)
            if len(page) < 1000:
                return list(reversed(all_sigs)), True
            before = page[-1]["signature"]
        return list(reversed(all_sigs)), False

    def transaction(self, signature: str) -> dict | None:
        return self.call("getTransaction", [signature, {
            "encoding": "jsonParsed", "maxSupportedTransactionVersion": 0, "commitment": "confirmed"}])

    def account_info(self, address: str) -> dict | None:
        res = self.call("getAccountInfo", [address, {"encoding": "jsonParsed"}])
        return (res or {}).get("value")

    def largest_token_accounts(self, mint: str) -> list[dict]:
        res = self.call("getTokenLargestAccounts", [mint])
        return (res or {}).get("value") or []

    def token_supply(self, mint: str) -> float:
        res = self.call("getTokenSupply", [mint])
        return float(((res or {}).get("value") or {}).get("uiAmount") or 0)

    def balance_sol(self, address: str) -> float:
        res = self.call("getBalance", [address])
        return ((res or {}).get("value") or 0) / 1e9

    def token_balance(self, owner: str, mint: str) -> tuple[int, int]:
        """(raw_amount, decimals) summed over all of owner's accounts for mint."""
        res = self.call("getTokenAccountsByOwner", [owner, {"mint": mint}, {"encoding": "jsonParsed"}])
        raw, dec = 0, 0
        for acc in (res or {}).get("value") or []:
            info = acc["account"]["data"]["parsed"]["info"]["tokenAmount"]
            raw += int(info["amount"])
            dec = int(info["decimals"])
        return raw, dec

    def send_transaction(self, tx_base64: str) -> str:
        return self.call("sendTransaction", [tx_base64, {
            "encoding": "base64", "skipPreflight": True, "maxRetries": 3}])
