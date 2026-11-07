"""Jupiter swap API + local signing (solders). Only used when live copy-trading is ON."""
from __future__ import annotations

import base64

from ..http import ApiError, HttpClient
from .solana_rpc import SolanaRPC


class Wallet:
    """Holds a keypair in memory only."""

    def __init__(self, secret: str):
        from solders.keypair import Keypair  # optional dependency
        secret = secret.strip()
        if secret.startswith("["):
            import json
            self.kp = Keypair.from_bytes(bytes(json.loads(secret)))
        else:
            self.kp = Keypair.from_base58_string(secret)

    @property
    def address(self) -> str:
        return str(self.kp.pubkey())

    def sign_b64(self, tx_b64: str) -> str:
        from solders.transaction import VersionedTransaction
        tx = VersionedTransaction.from_bytes(base64.b64decode(tx_b64))
        signed = VersionedTransaction(tx.message, [self.kp])
        return base64.b64encode(bytes(signed)).decode()


class Jupiter:
    def __init__(self, http: HttpClient, base_url: str, api_key: str = ""):
        self.http = http
        self.base = base_url.rstrip("/")
        self.headers = {"x-api-key": api_key} if api_key else None

    def quote(self, input_mint: str, output_mint: str, amount_raw: int, slippage_bps: int) -> dict:
        q = self.http.get(f"{self.base}/quote", headers=self.headers, params={
            "inputMint": input_mint, "outputMint": output_mint,
            "amount": str(amount_raw), "slippageBps": slippage_bps,
        }, retries=2)
        if not q or "outAmount" not in q:
            raise ApiError(f"No Jupiter route: {q}")
        return q

    def swap(self, wallet: Wallet, rpc: SolanaRPC, quote: dict, priority_lamports: int) -> str:
        body = {
            "quoteResponse": quote,
            "userPublicKey": wallet.address,
            "wrapAndUnwrapSol": True,
            "dynamicComputeUnitLimit": True,
            "dynamicSlippage": True,
            "prioritizationFeeLamports": {"priorityLevelWithMaxLamports": {
                "maxLamports": int(priority_lamports), "priorityLevel": "veryHigh"}},
        }
        res = self.http.post(f"{self.base}/swap", json=body, headers=self.headers, retries=2)
        if not res or "swapTransaction" not in res:
            raise ApiError(f"Jupiter swap build failed: {res}")
        return rpc.send_transaction(wallet.sign_b64(res["swapTransaction"]))
