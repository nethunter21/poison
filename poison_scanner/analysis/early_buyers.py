"""Early-buyer extraction plus sniper / bundle detection for one token."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable

from .swaps import Swap, parse_swaps, swaps_from_birdeye

SNIPER_WINDOW_S = 1.2   # ~3 slots after the first trade
BUNDLE_WINDOW_S = 10.0  # bundles are looked for in the first ~25 slots
BUNDLE_MIN_WALLETS = 3


@dataclass
class EarlyBuyer:
    wallet: str
    rank: int              # 1 = first buyer
    first_t: float
    sol_spent: float
    tokens_bought: float
    sniper: bool = False
    bundle: bool = False
    creator: bool = False


@dataclass
class LaunchAnalysis:
    mint: str
    buyers: list[EarlyBuyer] = field(default_factory=list)
    snipers: list[str] = field(default_factory=list)
    bundles: list[list[str]] = field(default_factory=list)  # wallet groups that bought in the same slot
    trades_seen: int = 0
    complete_history: bool = True
    source: str = ""
    sniper_hold_pct: float | None = None   # % of supply snipers+bundlers still hold
    notes: list[str] = field(default_factory=list)

    @property
    def bundled_wallets(self) -> set[str]:
        return {w for g in self.bundles for w in g}


def analyze_launch(mint: str, swaps: list[Swap], max_buyers: int, creator: str = "") -> LaunchAnalysis:
    la = LaunchAnalysis(mint=mint, trades_seen=len(swaps))
    buys = sorted((s for s in swaps if s.side == "buy" and s.mint == mint), key=lambda s: s.t)
    if not buys:
        la.notes.append("no buys found in early history")
        return la
    t0 = buys[0].t

    by_slot: dict[float, set[str]] = defaultdict(set)
    for s in buys:
        if s.t - t0 <= BUNDLE_WINDOW_S and s.wallet != creator:
            by_slot[s.t].add(s.wallet)
    la.bundles = [sorted(ws) for _, ws in sorted(by_slot.items()) if len(ws) >= BUNDLE_MIN_WALLETS]
    bundled = la.bundled_wallets

    first: dict[str, EarlyBuyer] = {}
    for s in buys:
        b = first.get(s.wallet)
        if b is None:
            if len(first) >= max_buyers:
                continue
            b = EarlyBuyer(s.wallet, len(first) + 1, s.t, 0.0, 0.0,
                           sniper=(s.t - t0) <= SNIPER_WINDOW_S and s.wallet != creator,
                           bundle=s.wallet in bundled, creator=s.wallet == creator)
            first[s.wallet] = b
        b.sol_spent += s.sol_amount
        b.tokens_bought += s.token_amount
    la.buyers = list(first.values())
    la.snipers = [b.wallet for b in la.buyers if b.sniper]
    return la


def fetch_early_swaps(mint: str, pair_address: str | None, rpc, birdeye, max_buyers: int,
                      max_pages: int, sol_usd: float = 0.0,
                      progress: Callable[[str], None] = lambda m: None) -> tuple[list[Swap], bool, str]:
    """Get the earliest swaps for a token. Birdeye (fast) when a key is set, else raw RPC."""
    if birdeye is not None and birdeye.enabled:
        try:
            items: list[dict] = []
            for off in range(0, 50 * 20, 50):
                page = birdeye.token_trades(mint, offset=off, limit=50, sort_type="asc")
                items.extend(page)
                buyers = {i.get("owner") for i in items if (i.get("to") or {}).get("address") == mint}
                if len(page) < 50 or len(buyers) >= max_buyers:
                    break
            if items:
                progress(f"Birdeye: {len(items)} early trades")
                return swaps_from_birdeye(items, mint, sol_usd), True, "birdeye"
        except Exception as e:  # fall back to RPC
            progress(f"Birdeye failed ({e}); using RPC")

    sigs: dict[str, dict] = {}
    complete = True
    for addr in filter(None, {mint, pair_address}):
        progress(f"RPC: walking history of {addr[:6]}…")
        page, done = rpc.oldest_signatures(addr, max_pages=max_pages)
        complete = complete and done
        for s in page:
            if s.get("err") is None:
                sigs.setdefault(s["signature"], s)
    ordered = sorted(sigs.values(), key=lambda s: (s.get("slot") or 0, s.get("blockTime") or 0))
    if not complete:
        progress("History too long to reach launch with RPC – results are 'earliest found', not true launch.")

    swaps: list[Swap] = []
    buyers: set[str] = set()
    budget = max_buyers * 5
    for i, s in enumerate(ordered[:budget]):
        if i % 20 == 0:
            progress(f"RPC: parsing tx {i}/{min(budget, len(ordered))} ({len(buyers)} buyers)")
        try:
            tx = rpc.transaction(s["signature"])
        except Exception:
            continue
        for sw in parse_swaps(tx, None, sol_usd, s["signature"]):
            if sw.mint == mint:
                swaps.append(sw)
                if sw.side == "buy":
                    buyers.add(sw.wallet)
        if len(buyers) >= max_buyers:
            break
    return swaps, complete, "rpc"


def sniper_holdings_pct(la: LaunchAnalysis, rugcheck_report: dict | None, rpc=None,
                        supply: float = 0.0, max_rpc_checks: int = 25) -> float | None:
    """% of supply still held by snipers + bundlers."""
    suspects = set(la.snipers) | la.bundled_wallets
    if not suspects:
        return 0.0
    if rpc is not None and supply > 0:
        total = 0.0
        for w in list(suspects)[:max_rpc_checks]:
            try:
                raw, dec = rpc.token_balance(w, la.mint)
                total += raw / (10 ** dec) if dec else raw
            except Exception:
                continue
        return round(100 * total / supply, 2)
    if rugcheck_report:
        pct = sum(float(h.get("pct") or 0) for h in rugcheck_report.get("topHolders") or []
                  if h.get("owner") in suspects or h.get("address") in suspects)
        return round(pct, 2)
    return None
