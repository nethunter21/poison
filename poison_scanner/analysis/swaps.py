"""Turn raw Solana transactions into buy/sell swaps using balance deltas.

Works for any DEX/aggregator (Raydium, Pump.fun, PumpSwap, Meteora, Orca, Jupiter...)
because it only looks at how the wallet's SOL / token balances changed.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from ..config import QUOTE_MINTS, STABLE_MINTS, WSOL_MINT

MIN_QUOTE_SOL = 0.0005  # ignore dust / fee-only moves


@dataclass
class Swap:
    signature: str
    wallet: str
    mint: str
    side: str            # "buy" | "sell"
    token_amount: float  # UI units (always positive)
    sol_amount: float    # SOL value of the quote side (always positive)
    slot: int
    block_time: int

    @property
    def t(self) -> float:
        """Comparable time in seconds (slot based when available)."""
        return self.slot * 0.4 if self.slot else float(self.block_time or 0)


def _account_keys(tx: dict) -> list[str]:
    keys = ((tx.get("transaction") or {}).get("message") or {}).get("accountKeys") or []
    out = [k["pubkey"] if isinstance(k, dict) else k for k in keys]
    loaded = (tx.get("meta") or {}).get("loadedAddresses") or {}
    if keys and not isinstance(keys[0], dict):  # non-parsed encoding
        out += loaded.get("writable", []) + loaded.get("readonly", [])
    return out


def signers(tx: dict) -> list[str]:
    keys = ((tx.get("transaction") or {}).get("message") or {}).get("accountKeys") or []
    s = [k["pubkey"] for k in keys if isinstance(k, dict) and k.get("signer")]
    if not s and keys:
        s = [keys[0] if isinstance(keys[0], str) else keys[0].get("pubkey")]
    return s


def token_deltas(tx: dict) -> dict[tuple[str, str], float]:
    """(owner, mint) -> UI amount change."""
    meta = tx.get("meta") or {}
    acc: dict[tuple[str, str], float] = defaultdict(float)
    for sign, entries in ((-1, meta.get("preTokenBalances") or []), (1, meta.get("postTokenBalances") or [])):
        for b in entries:
            owner, mint = b.get("owner"), b.get("mint")
            if not owner or not mint:
                continue
            ui = b.get("uiTokenAmount") or {}
            try:
                amt = int(ui.get("amount", 0)) / (10 ** int(ui.get("decimals", 0)))
            except (TypeError, ValueError):
                amt = float(ui.get("uiAmount") or 0)
            acc[(owner, mint)] += sign * amt
    return dict(acc)


def sol_delta(tx: dict, wallet: str) -> float:
    meta = tx.get("meta") or {}
    keys = _account_keys(tx)
    pre, post = meta.get("preBalances") or [], meta.get("postBalances") or []
    total = 0.0
    for i, k in enumerate(keys):
        if k == wallet and i < len(pre) and i < len(post):
            total += (post[i] - pre[i]) / 1e9
    if keys and keys[0] == wallet:
        total += (meta.get("fee") or 0) / 1e9  # don't count tx fee as trade cost
    return total


def parse_swaps(tx: dict | None, wallet: str | None = None, sol_usd: float = 0.0,
                signature: str = "") -> list[Swap]:
    """Swaps made by `wallet` (or by every signer if wallet is None)."""
    if not tx or (tx.get("meta") or {}).get("err") is not None:
        return []
    sig = signature or ((tx.get("transaction") or {}).get("signatures") or [""])[0]
    slot, bt = int(tx.get("slot") or 0), int(tx.get("blockTime") or 0)
    deltas = token_deltas(tx)
    wallets = [wallet] if wallet else signers(tx)
    out: list[Swap] = []
    for w in wallets:
        quote = sol_delta(tx, w) + deltas.get((w, WSOL_MINT), 0.0)
        if sol_usd > 0:
            for st in STABLE_MINTS:
                quote += deltas.get((w, st), 0.0) / sol_usd
        tokens = {m: d for (o, m), d in deltas.items()
                  if o == w and m not in QUOTE_MINTS and abs(d) > 0}
        if len(tokens) != 1 or abs(quote) < MIN_QUOTE_SOL:
            continue
        mint, d = next(iter(tokens.items()))
        if d > 0 and quote < 0:
            out.append(Swap(sig, w, mint, "buy", d, -quote, slot, bt))
        elif d < 0 and quote > 0:
            out.append(Swap(sig, w, mint, "sell", -d, quote, slot, bt))
    return out


def swaps_from_birdeye(items: list[dict], mint: str, sol_usd: float = 0.0) -> list[Swap]:
    """Normalize Birdeye /defi/txs/token items."""
    out = []
    for it in items:
        try:
            frm, to = it.get("from") or {}, it.get("to") or {}
            if to.get("address") == mint:
                side, tok, quote_side = "buy", to, frm
            elif frm.get("address") == mint:
                side, tok, quote_side = "sell", frm, to
            else:
                continue
            q_amt = float(quote_side.get("uiAmount") or 0)
            if quote_side.get("address") in STABLE_MINTS:
                q_amt = q_amt / sol_usd if sol_usd else 0.0
            out.append(Swap(it.get("txHash", ""), it.get("owner", ""), mint, side,
                            float(tok.get("uiAmount") or 0), q_amt, 0, int(it.get("blockUnixTime") or 0)))
        except (TypeError, ValueError):
            continue
    return out
