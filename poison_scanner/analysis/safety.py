"""Token safety + entry-quality scoring.

Combines DexScreener market data, RugCheck on-chain report, optional Birdeye security
data and optional launch (sniper/bundle) analysis into one verdict.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from ..config import Settings

PASS, WARN, FAIL, INFO = "PASS", "WARN", "FAIL", "INFO"

AMM_TYPES = {"AMM", "LOCKER", "BURN"}


@dataclass
class Check:
    name: str
    status: str
    detail: str
    penalty: float = 0.0


@dataclass
class TokenReport:
    mint: str
    symbol: str = "?"
    name: str = ""
    pair_address: str = ""
    dex: str = ""
    url: str = ""
    price_usd: float = 0.0
    mcap: float = 0.0
    liquidity: float = 0.0
    volume_h1: float = 0.0
    volume_h24: float = 0.0
    change_m5: float = 0.0
    change_h1: float = 0.0
    change_h24: float = 0.0
    buys_h1: int = 0
    sells_h1: int = 0
    age_minutes: float = 0.0
    holders: int = 0
    top10_pct: float | None = None
    safety_score: int = 0
    entry_score: int = 0
    score: int = 0
    verdict: str = "?"
    checks: list[Check] = field(default_factory=list)
    has_rugcheck: bool = False

    @property
    def hard_fails(self) -> list[Check]:
        return [c for c in self.checks if c.status == FAIL]

    def summary_lines(self) -> list[str]:
        return [f"[{c.status}] {c.name}: {c.detail}" for c in self.checks]


def _f(x, default=0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _fmt_usd(v: float) -> str:
    if v >= 1e6:
        return f"${v / 1e6:.2f}M"
    if v >= 1e3:
        return f"${v / 1e3:.1f}K"
    return f"${v:.0f}"


def fill_market(r: TokenReport, pair: dict) -> None:
    base = pair.get("baseToken") or {}
    r.symbol = base.get("symbol") or r.symbol
    r.name = base.get("name") or r.name
    r.pair_address = pair.get("pairAddress") or ""
    r.dex = pair.get("dexId") or ""
    r.url = pair.get("url") or f"https://dexscreener.com/solana/{r.mint}"
    r.price_usd = _f(pair.get("priceUsd"))
    r.mcap = _f(pair.get("marketCap") or pair.get("fdv"))
    r.liquidity = _f((pair.get("liquidity") or {}).get("usd"))
    vol, chg = pair.get("volume") or {}, pair.get("priceChange") or {}
    r.volume_h1, r.volume_h24 = _f(vol.get("h1")), _f(vol.get("h24"))
    r.change_m5, r.change_h1, r.change_h24 = _f(chg.get("m5")), _f(chg.get("h1")), _f(chg.get("h24"))
    h1 = (pair.get("txns") or {}).get("h1") or {}
    r.buys_h1, r.sells_h1 = int(h1.get("buys") or 0), int(h1.get("sells") or 0)
    created = pair.get("pairCreatedAt")
    r.age_minutes = (time.time() * 1000 - created) / 60000 if created else 0.0


def _authority(report: dict, key: str):
    v = report.get(key)
    if v is None:
        v = (report.get("token") or {}).get(key)
    return v


def holder_stats(report: dict, pair_address: str = "") -> tuple[float, float, list[dict]]:
    """(top10 %, largest single %, real holders) excluding pools/lockers/burn."""
    known = report.get("knownAccounts") or {}
    pool_like = {a for a, info in known.items() if (info or {}).get("type") in AMM_TYPES}
    markets = report.get("markets") or []
    pool_like |= {m.get("pubkey") for m in markets} | {pair_address}
    for m in markets:
        pool_like |= {m.get("liquidityA"), m.get("liquidityB"), m.get("liquidityAAccount"),
                      m.get("liquidityBAccount")}
    real = [h for h in report.get("topHolders") or []
            if h.get("owner") not in pool_like and h.get("address") not in pool_like]
    pcts = sorted((_f(h.get("pct")) for h in real), reverse=True)
    return sum(pcts[:10]), (pcts[0] if pcts else 0.0), real


def lp_locked_pct(report: dict) -> float | None:
    vals = [_f((m.get("lp") or {}).get("lpLockedPct"), -1) for m in report.get("markets") or []]
    vals = [v for v in vals if v >= 0]
    if not vals:
        return report.get("lpLockedPct")
    return max(vals)


def evaluate(mint: str, pair: dict | None, rug: dict | None, settings: Settings,
             bird_sec: dict | None = None, launch=None, socials: bool | None = None) -> TokenReport:
    r = TokenReport(mint=mint)
    C = r.checks.append

    # ------------------------------------------------------------- market
    if pair:
        fill_market(r, pair)
    else:
        C(Check("Market", FAIL, "No DEX pair found", 100))

    if pair:
        on_curve = r.dex in ("pumpfun", "moonshot", "launchlab", "boop")
        if r.liquidity < settings.min_liquidity_usd and not on_curve:
            C(Check("Liquidity", FAIL, f"{_fmt_usd(r.liquidity)} < {_fmt_usd(settings.min_liquidity_usd)}", 30))
        else:
            C(Check("Liquidity", PASS, _fmt_usd(r.liquidity)))
        if r.mcap:
            ratio = r.liquidity / r.mcap
            if ratio < 0.03 and not on_curve:
                C(Check("Liq / MCap", WARN, f"{ratio:.1%} – thin, easy to dump", 10))
            else:
                C(Check("Liq / MCap", PASS, f"{ratio:.1%}"))
        if r.age_minutes and r.age_minutes < settings.min_age_minutes:
            C(Check("Age", WARN, f"{r.age_minutes:.0f}m – too fresh, wait for snipers to exit", 10))
        elif r.age_minutes > settings.max_age_hours * 60:
            C(Check("Age", INFO, f"{r.age_minutes / 60:.0f}h – not a fresh entry"))
        else:
            C(Check("Age", PASS, f"{r.age_minutes:.0f}m"))
        if socials is not None:
            if socials:
                C(Check("Socials", PASS, "website/twitter/telegram listed"))
            elif settings.require_socials:
                C(Check("Socials", WARN, "no socials listed", 8))

    # ------------------------------------------------------------ rugcheck
    if rug:
        r.has_rugcheck = True
        if rug.get("rugged"):
            C(Check("Rugged", FAIL, "RugCheck marks this token as RUGGED", 100))
        mint_auth = _authority(rug, "mintAuthority")
        C(Check("Mint authority", FAIL if mint_auth else PASS,
                f"ACTIVE ({mint_auth[:6]}…) – dev can print tokens" if mint_auth else "revoked", 60 if mint_auth else 0))
        freeze = _authority(rug, "freezeAuthority")
        C(Check("Freeze authority", FAIL if freeze else PASS,
                "ACTIVE – dev can freeze your tokens (honeypot)" if freeze else "revoked", 60 if freeze else 0))
        fee = _f((rug.get("transferFee") or {}).get("pct"))
        if fee > 0:
            C(Check("Transfer tax", FAIL if fee >= 5 else WARN, f"{fee:.1f}% Token-2022 transfer fee", 40 if fee >= 5 else 10))
        if (rug.get("tokenMeta") or {}).get("mutable"):
            C(Check("Metadata", WARN, "mutable – name/image can be changed", 4))

        on_curve = r.dex in ("pumpfun", "moonshot", "launchlab", "boop")
        lp = lp_locked_pct(rug)
        if on_curve:
            C(Check("LP", INFO, "still on bonding curve (no LP to pull)"))
        elif lp is None:
            C(Check("LP locked", WARN, "unknown", 10))
        elif lp < settings.min_lp_locked_pct:
            C(Check("LP locked", FAIL, f"only {lp:.0f}% locked/burned – rug pull risk", 50))
        else:
            C(Check("LP locked", PASS, f"{lp:.0f}% locked/burned"))

        top10, single, real = holder_stats(rug, r.pair_address)
        r.top10_pct = top10
        r.holders = int(rug.get("totalHolders") or 0)
        if real:
            if top10 > settings.max_top10_pct * 1.6:
                C(Check("Top 10 holders", FAIL, f"{top10:.1f}% – heavily concentrated", 35))
            elif top10 > settings.max_top10_pct:
                C(Check("Top 10 holders", WARN, f"{top10:.1f}%", 15))
            else:
                C(Check("Top 10 holders", PASS, f"{top10:.1f}%"))
            if single > settings.max_single_holder_pct:
                C(Check("Largest holder", WARN if single < 20 else FAIL, f"{single:.1f}% in one wallet", 15 if single < 20 else 35))
            insider_pct = sum(_f(h.get("pct")) for h in real if h.get("insider"))
            if insider_pct > 5:
                C(Check("Insider holders", WARN if insider_pct < 15 else FAIL,
                        f"{insider_pct:.1f}% held by linked/insider wallets", 15 if insider_pct < 15 else 35))
        if r.holders and r.holders < 100 and not on_curve:
            C(Check("Holder count", WARN, f"only {r.holders} holders", 8))

        creator = rug.get("creator")
        if creator:
            creator_pct = sum(_f(h.get("pct")) for h in rug.get("topHolders") or [] if h.get("owner") == creator)
            if creator_pct > settings.max_creator_pct:
                C(Check("Dev holdings", WARN if creator_pct < 15 else FAIL, f"dev holds {creator_pct:.1f}%",
                        12 if creator_pct < 15 else 35))
            else:
                C(Check("Dev holdings", PASS, f"{creator_pct:.1f}%"))
        insiders = int(rug.get("graphInsidersDetected") or 0)
        if insiders >= 3:
            C(Check("Insider network", WARN if insiders < 10 else FAIL,
                    f"{insiders} wallets linked by funding graph", 12 if insiders < 10 else 30))

        for risk in rug.get("risks") or []:
            name = risk.get("name") or ""
            lvl = (risk.get("level") or "").lower()
            if any(k in name.lower() for k in ("mint authority", "freeze authority", "top 10", "lp unlocked",
                                                "large amount of lp", "single holder", "mutable", "low liquidity",
                                                "creator", "insider")):
                continue  # already covered above with our own thresholds
            if lvl == "danger":
                C(Check(f"RugCheck: {name}", FAIL, risk.get("description") or risk.get("value") or "", 25))
            elif lvl == "warn":
                C(Check(f"RugCheck: {name}", WARN, risk.get("description") or risk.get("value") or "", 5))
    else:
        C(Check("RugCheck", WARN, "report unavailable – on-chain checks incomplete", 25))

    # ------------------------------------------------------------- birdeye
    if bird_sec:
        if bird_sec.get("isHoneypot") or bird_sec.get("honeypot"):
            C(Check("Birdeye honeypot", FAIL, "flagged as honeypot", 100))
        if bird_sec.get("nonTransferable"):
            C(Check("Transferable", FAIL, "token is non-transferable", 100))
        if bird_sec.get("transferFeeEnable") and not any(c.name == "Transfer tax" for c in r.checks):
            C(Check("Transfer tax", WARN, "Birdeye: transfer fee enabled", 15))
        if not rug and bird_sec.get("top10HolderPercent") is not None:
            top10 = _f(bird_sec.get("top10HolderPercent")) * 100
            r.top10_pct = top10
            C(Check("Top 10 holders (Birdeye)", WARN if top10 > settings.max_top10_pct else PASS,
                    f"{top10:.1f}% (may include pools)", 10 if top10 > settings.max_top10_pct else 0))

    # -------------------------------------------------------- launch / snipers
    if launch is not None:
        if launch.snipers or launch.bundles:
            bundled = len(launch.bundled_wallets)
            C(Check("Launch snipers", WARN, f"{len(launch.snipers)} snipers, {bundled} bundled wallets "
                                           f"in {len(launch.bundles)} bundle(s)", min(15, 2 * len(launch.bundles))))
        else:
            C(Check("Launch snipers", PASS, "no snipers/bundles detected in first slots"))
        if launch.sniper_hold_pct is not None:
            hp = launch.sniper_hold_pct
            if hp > settings.max_sniper_hold_pct * 2:
                C(Check("Sniper/bundle supply", FAIL, f"{hp:.1f}% still held by snipers/bundlers – dump risk", 40))
            elif hp > settings.max_sniper_hold_pct:
                C(Check("Sniper/bundle supply", WARN, f"{hp:.1f}% still held by snipers/bundlers", 15))
            else:
                C(Check("Sniper/bundle supply", PASS, f"{hp:.1f}% still held"))
        if not launch.complete_history:
            C(Check("Launch data", INFO, "history too long – launch analysis partial"))

    # --------------------------------------------------------- entry quality
    entry_pen = 0.0
    if pair:
        tot = r.buys_h1 + r.sells_h1
        if r.buys_h1 > 25 and r.sells_h1 == 0:
            C(Check("Sell activity", FAIL, f"{r.buys_h1} buys / 0 sells in 1h – cannot sell? (honeypot)", 100))
        elif tot >= 20:
            ratio = r.buys_h1 / max(r.sells_h1, 1)
            if ratio < 0.8:
                C(Check("Buy pressure", WARN, f"{r.buys_h1}B/{r.sells_h1}S – sellers in control"))
                entry_pen += 25
            elif ratio > 4:
                C(Check("Buy pressure", WARN, f"{r.buys_h1}B/{r.sells_h1}S – one-sided, possible bot volume"))
                entry_pen += 15
            else:
                C(Check("Buy pressure", PASS, f"{r.buys_h1}B/{r.sells_h1}S"))
        else:
            C(Check("Activity", WARN, f"only {tot} trades in last hour"))
            entry_pen += 25
        if r.volume_h1 < settings.min_volume_h1_usd:
            C(Check("Volume 1h", WARN, f"{_fmt_usd(r.volume_h1)} – low"))
            entry_pen += 15
        else:
            C(Check("Volume 1h", PASS, _fmt_usd(r.volume_h1)))
        if r.liquidity:
            turnover = r.volume_h1 / r.liquidity
            if turnover > 15:
                C(Check("Volume / Liq", WARN, f"{turnover:.1f}x per hour – wash-trading suspicion"))
                entry_pen += 15
        if r.change_h1 > 400:
            C(Check("Momentum", WARN, f"+{r.change_h1:.0f}% 1h – overextended, chasing top"))
            entry_pen += 30
        elif r.change_m5 < -20 or r.change_h1 < -40:
            C(Check("Momentum", WARN, f"m5 {r.change_m5:+.0f}% / h1 {r.change_h1:+.0f}% – dumping"))
            entry_pen += 35
        elif r.change_h1 > 0:
            C(Check("Momentum", PASS, f"h1 {r.change_h1:+.0f}%, m5 {r.change_m5:+.0f}%"))
        else:
            C(Check("Momentum", INFO, f"h1 {r.change_h1:+.0f}%, m5 {r.change_m5:+.0f}%"))
            entry_pen += 10
        if settings.min_mcap_usd and r.mcap and not (settings.min_mcap_usd <= r.mcap <= settings.max_mcap_usd):
            C(Check("Market cap", INFO, f"{_fmt_usd(r.mcap)} outside your range"))
            entry_pen += 15

    # --------------------------------------------------------------- scores
    safety_pen = sum(c.penalty for c in r.checks)
    r.safety_score = max(0, int(round(100 - safety_pen)))
    r.entry_score = max(0, int(round(100 - entry_pen)))
    r.score = int(round(0.7 * r.safety_score + 0.3 * r.entry_score))

    if r.hard_fails:
        r.verdict = "AVOID"
    elif not r.has_rugcheck:
        r.verdict = "UNVERIFIED"
    elif r.score >= settings.min_safety_score and r.entry_score >= 60:
        r.verdict = "GOOD ENTRY"
    elif r.safety_score >= settings.min_safety_score:
        r.verdict = "WATCH"
    else:
        r.verdict = "RISKY"
    return r


def has_socials(pair: dict | None, profile: dict | None = None) -> bool:
    info = (pair or {}).get("info") or {}
    links = (info.get("websites") or []) + (info.get("socials") or []) + ((profile or {}).get("links") or [])
    return bool(links)
