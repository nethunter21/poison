"""Wallet profiling (PnL, win-rate, bot detection) and insider/smart-money ranking."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from ..config import QUOTE_MINTS, STABLE_MINTS, WSOL_MINT
from .early_buyers import LaunchAnalysis
from .swaps import Swap, parse_swaps


@dataclass
class TokenPosition:
    mint: str
    sol_in: float = 0.0
    sol_out: float = 0.0
    bought: float = 0.0
    sold: float = 0.0
    first_buy_t: float = 0.0
    first_sell_t: float = 0.0
    unrealized_sol: float = 0.0

    @property
    def closed(self) -> bool:
        return self.bought > 0 and self.sold >= 0.9 * self.bought

    @property
    def realized_pnl(self) -> float:
        if self.bought <= 0 or self.sold <= 0:
            return 0.0
        cost = self.sol_in * min(1.0, self.sold / self.bought)
        return self.sol_out - cost


@dataclass
class WalletProfile:
    address: str
    swaps: int = 0
    tokens: int = 0
    closed: int = 0
    wins: int = 0
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    volume_sol: float = 0.0
    tx_per_hour: float = 0.0
    median_hold_s: float | None = None
    sol_balance: float | None = None
    is_bot: bool = False
    best_trade_x: float = 0.0
    positions: dict[str, TokenPosition] = field(default_factory=dict)
    error: str = ""

    @property
    def win_rate(self) -> float:
        return self.wins / self.closed if self.closed else 0.0

    @property
    def total_pnl(self) -> float:
        return self.realized_pnl + self.unrealized_pnl


def build_profile(address: str, swaps: list[Swap], sig_times: list[int]) -> WalletProfile:
    p = WalletProfile(address)
    pos: dict[str, TokenPosition] = {}
    for s in sorted(swaps, key=lambda s: s.t):
        tp = pos.setdefault(s.mint, TokenPosition(s.mint))
        p.volume_sol += s.sol_amount
        if s.side == "buy":
            tp.sol_in += s.sol_amount
            tp.bought += s.token_amount
            tp.first_buy_t = tp.first_buy_t or s.block_time
        else:
            tp.sol_out += s.sol_amount
            tp.sold += s.token_amount
            tp.first_sell_t = tp.first_sell_t or s.block_time
    p.positions = pos
    p.swaps, p.tokens = len(swaps), len(pos)
    holds = []
    for tp in pos.values():
        if tp.bought <= 0 or tp.sold <= 0:
            continue
        p.realized_pnl += tp.realized_pnl
        if tp.closed:
            p.closed += 1
            if tp.realized_pnl > 0:
                p.wins += 1
        if tp.sol_in > 0:
            p.best_trade_x = max(p.best_trade_x, tp.sol_out / tp.sol_in)
        if tp.first_buy_t and tp.first_sell_t >= tp.first_buy_t:
            holds.append(tp.first_sell_t - tp.first_buy_t)
    if holds:
        holds.sort()
        p.median_hold_s = holds[len(holds) // 2]
    ts = [t for t in sig_times if t]
    if len(ts) >= 2:
        span_h = max((max(ts) - min(ts)) / 3600, 1 / 60)
        p.tx_per_hour = len(ts) / span_h
    p.is_bot = p.tx_per_hour > 120 or (p.median_hold_s is not None and p.median_hold_s < 20 and p.closed >= 5)
    return p


def profile_wallet(address: str, rpc, solscan=None, dex=None, tx_limit: int = 150,
                   sol_usd: float = 0.0) -> WalletProfile:
    swaps: list[Swap] = []
    sig_times: list[int] = []
    try:
        sigs = rpc.signatures(address, limit=min(1000, max(tx_limit, 100)))
        sig_times = [s.get("blockTime") or 0 for s in sigs]
        if solscan is not None and solscan.enabled:
            for it in solscan.wallet_swaps(address, pages=max(1, tx_limit // 100)):
                swaps.extend(_swap_from_solscan(address, it, sol_usd))
        else:
            for s in sigs[:tx_limit]:
                if s.get("err") is not None:
                    continue
                swaps.extend(parse_swaps(rpc.transaction(s["signature"]), address, sol_usd, s["signature"]))
    except Exception as e:  # keep partial results
        prof = build_profile(address, swaps, sig_times)
        prof.error = str(e)
        return prof

    prof = build_profile(address, swaps, sig_times)
    try:
        prof.sol_balance = rpc.balance_sol(address)
    except Exception:
        pass
    if dex is not None and sol_usd > 0:
        open_pos = {m: tp for m, tp in prof.positions.items() if tp.bought > tp.sold * 1.01}
        try:
            from ..apis.dexscreener import best_pairs_by_token
            prices = best_pairs_by_token(dex.pairs_for_tokens(list(open_pos)[:60]))
            for m, tp in open_pos.items():
                pr = prices.get(m)
                if pr:
                    held = tp.bought - tp.sold
                    value_sol = held * float(pr.get("priceUsd") or 0) / sol_usd
                    cost = tp.sol_in * (held / tp.bought)
                    tp.unrealized_sol = value_sol - cost
                    prof.unrealized_pnl += tp.unrealized_sol
        except Exception:
            pass
    return prof


def _swap_from_solscan(wallet: str, it: dict, sol_usd: float) -> list[Swap]:
    tin, tout = it["token_in"], it["token_out"]

    def quote_val(mint, amt):
        if mint == WSOL_MINT:
            return amt
        if mint in STABLE_MINTS and sol_usd:
            return amt / sol_usd
        return None

    sig, bt = it.get("signature") or "", int(it.get("block_time") or 0)
    if tout not in QUOTE_MINTS and (q := quote_val(tin, it["amount_in"])) is not None:
        return [Swap(sig, wallet, tout, "buy", it["amount_out"], q, 0, bt)]
    if tin not in QUOTE_MINTS and (q := quote_val(tout, it["amount_out"])) is not None:
        return [Swap(sig, wallet, tin, "sell", it["amount_in"], q, 0, bt)]
    return []


# --------------------------------------------------------------------------- ranking
@dataclass
class WalletCandidate:
    address: str
    hits: list[str] = field(default_factory=list)       # token symbols bought early
    ranks: list[int] = field(default_factory=list)
    sol_spent: float = 0.0
    sniper_hits: int = 0
    bundle_hits: int = 0
    creator_hits: int = 0
    profile: WalletProfile | None = None
    score: int = 0
    tags: list[str] = field(default_factory=list)

    @property
    def avg_rank(self) -> float:
        return sum(self.ranks) / len(self.ranks) if self.ranks else 0.0


def collect_candidates(launches: list[tuple[str, LaunchAnalysis]]) -> dict[str, WalletCandidate]:
    cands: dict[str, WalletCandidate] = {}
    for symbol, la in launches:
        for b in la.buyers:
            c = cands.setdefault(b.wallet, WalletCandidate(b.wallet))
            c.hits.append(symbol)
            c.ranks.append(b.rank)
            c.sol_spent += b.sol_spent
            c.sniper_hits += b.sniper
            c.bundle_hits += b.bundle
            c.creator_hits += b.creator
    return cands


def score_candidate(c: WalletCandidate, n_tokens: int, max_rank: int) -> None:
    s = 0.0
    k = len(c.hits)
    s += min(k, 5) / 5 * 35 if n_tokens > 1 else 15
    s += sum(1 - (r - 1) / max_rank for r in c.ranks) / max(k, 1) * 15
    p = c.profile
    tags = []
    if p:
        if p.closed >= 3:
            s += p.win_rate * 25
        s += max(-15.0, min(15.0, p.total_pnl / 50 * 15))
        if p.closed >= 10:
            s += 10
        if p.is_bot:
            s -= 40
            tags.append("BOT")
        if p.closed >= 5 and p.win_rate >= 0.55 and p.total_pnl > 0:
            tags.append("SMART")
        if p.best_trade_x >= 10:
            tags.append(f"{p.best_trade_x:.0f}x HIT")
    if c.creator_hits:
        tags.append("DEV")
        s -= 20
    if c.bundle_hits:
        tags.append("BUNDLER")
        s -= 15
    if c.sniper_hits and (p is None or p.is_bot):
        tags.append("SNIPER")
    if k >= 2 and not c.creator_hits and (p is None or not p.is_bot):
        tags.append("INSIDER?")
    c.tags = tags
    c.score = max(0, min(100, int(round(s))))


def rank_candidates(cands: dict[str, WalletCandidate], n_tokens: int, max_rank: int) -> list[WalletCandidate]:
    for c in cands.values():
        score_candidate(c, n_tokens, max_rank)
    return sorted(cands.values(), key=lambda c: (c.score, len(c.hits)), reverse=True)


def shortlist(cands: dict[str, WalletCandidate], limit: int) -> list[WalletCandidate]:
    """Pick wallets worth the cost of a full profile: multi-token hitters first, then earliest."""
    ordered = sorted(cands.values(), key=lambda c: (-len(c.hits), c.creator_hits, c.avg_rank))
    return ordered[:limit]


def appearances(cands: dict[str, WalletCandidate]) -> dict[int, int]:
    d: dict[int, int] = defaultdict(int)
    for c in cands.values():
        d[len(c.hits)] += 1
    return dict(d)
