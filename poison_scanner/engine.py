"""High level operations used by the GUI (all blocking – run them in worker threads)."""
from __future__ import annotations

from typing import Callable

from .analysis import early_buyers, safety, wallets
from .apis.birdeye import Birdeye
from .apis.dexscreener import DexScreener, best_pairs_by_token
from .apis.jupiter import Jupiter
from .apis.rugcheck import RugCheck
from .apis.solana_rpc import SolanaRPC
from .apis.solscan import Solscan
from .config import Settings
from .http import HttpClient

Progress = Callable[[str], None]


def _noop(_: str) -> None:
    pass


class Engine:
    def __init__(self, settings: Settings):
        self.http = HttpClient()
        self.reload(settings)

    def reload(self, settings: Settings) -> None:
        self.settings = settings
        self.dex = DexScreener(self.http)
        self.rug = RugCheck(self.http)
        self.bird = Birdeye(self.http, settings.birdeye_api_key)
        self.solscan = Solscan(self.http, settings.solscan_api_key)
        self.rpc = SolanaRPC(self.http, settings.rpc_url)
        self.jup = Jupiter(self.http, settings.jupiter_base_url, settings.jupiter_api_key)
        self._sol_usd = 0.0

    def sol_usd(self) -> float:
        if not self._sol_usd:
            try:
                self._sol_usd = self.dex.sol_price_usd()
            except Exception:
                self._sol_usd = 0.0
        return self._sol_usd

    # ------------------------------------------------------------ discovery
    def discover_mints(self, progress: Progress = _noop) -> tuple[list[str], dict[str, dict]]:
        mints: list[str] = []
        profiles: dict[str, dict] = {}
        sources = [("DexScreener profiles", self.dex.latest_profiles),
                   ("DexScreener boosts", self.dex.latest_boosts),
                   ("DexScreener top boosts", self.dex.top_boosts),
                   ("DexScreener CTOs", self.dex.community_takeovers)]
        for name, fn in sources:
            try:
                for item in fn():
                    m = item.get("tokenAddress")
                    if m and m not in profiles:
                        profiles[m] = item
                        mints.append(m)
                progress(f"{name}: {len(mints)} tokens so far")
            except Exception as e:
                progress(f"{name} failed: {e}")
        try:  # most-viewed tokens on RugCheck right now (trending attention)
            for it in self.rug.recent_viewed():
                m = it.get("mint")
                if m and m not in profiles:
                    profiles[m] = {}
                    mints.append(m)
            progress(f"RugCheck trending: {len(mints)} tokens so far")
        except Exception as e:
            progress(f"RugCheck trending failed: {e}")
        if self.bird.enabled:
            try:
                for it in self.bird.new_listings(limit=20):
                    m = it.get("address")
                    if m and m not in profiles:
                        profiles[m] = {}
                        mints.append(m)
                progress(f"Birdeye new listings: {len(mints)} tokens so far")
            except Exception as e:
                progress(f"Birdeye failed: {e}")
        return mints, profiles

    def _market_prefilter(self, pair: dict) -> bool:
        s = self.settings
        liq = float((pair.get("liquidity") or {}).get("usd") or 0)
        mcap = float(pair.get("marketCap") or pair.get("fdv") or 0)
        created = pair.get("pairCreatedAt") or 0
        import time
        age_h = (time.time() * 1000 - created) / 3.6e6 if created else 1e9
        vol_h1 = float((pair.get("volume") or {}).get("h1") or 0)
        return (liq >= s.min_liquidity_usd * 0.8 and liq <= s.max_liquidity_usd
                and mcap <= s.max_mcap_usd * 1.5 and age_h <= s.max_age_hours
                and vol_h1 >= s.min_volume_h1_usd * 0.3)

    def scan_fresh(self, progress: Progress = _noop, extra_mints: list[str] | None = None,
                   on_report: Callable[[safety.TokenReport], None] | None = None) -> list[safety.TokenReport]:
        mints, profiles = self.discover_mints(progress)
        for m in extra_mints or []:
            if m not in profiles:
                profiles[m] = {}
                mints.append(m)
        progress(f"Fetching market data for {len(mints)} tokens…")
        best = best_pairs_by_token(self.dex.pairs_for_tokens(mints))
        candidates = [(m, p) for m, p in best.items() if self._market_prefilter(p)]
        progress(f"{len(candidates)}/{len(best)} pass market pre-filter; running rug checks…")
        reports = []
        for i, (m, p) in enumerate(candidates, 1):
            try:
                rug = self.rug.report(m)
            except Exception:
                rug = None
            rep = safety.evaluate(m, p, rug, self.settings,
                                  socials=safety.has_socials(p, profiles.get(m)))
            reports.append(rep)
            if on_report:
                on_report(rep)
            progress(f"Checked {i}/{len(candidates)}: {rep.symbol} → {rep.verdict} ({rep.score})")
        reports.sort(key=lambda r: r.score, reverse=True)
        return reports

    # ---------------------------------------------------------- single token
    def check_token(self, mint: str, deep: bool = True, progress: Progress = _noop):
        mint = mint.strip()
        progress("DexScreener…")
        pair = self.dex.best_pair(mint)
        progress("RugCheck…")
        try:
            rug = self.rug.report(mint)
        except Exception as e:
            progress(f"RugCheck failed: {e}")
            rug = None
        bird = None
        if self.bird.enabled:
            try:
                bird = self.bird.token_security(mint)
            except Exception:
                pass
        launch = None
        if deep:
            launch = self.launch_analysis(mint, pair, rug, progress)
        rep = safety.evaluate(mint, pair, rug, self.settings, bird, launch, safety.has_socials(pair))
        return rep, launch

    def launch_analysis(self, mint: str, pair: dict | None, rug: dict | None,
                        progress: Progress = _noop) -> early_buyers.LaunchAnalysis:
        s = self.settings
        swaps, complete, src = early_buyers.fetch_early_swaps(
            mint, (pair or {}).get("pairAddress"), self.rpc, self.bird, s.early_buyer_count,
            s.max_signature_pages, self.sol_usd(), progress)
        la = early_buyers.analyze_launch(mint, swaps, s.early_buyer_count, (rug or {}).get("creator") or "")
        la.complete_history, la.source = complete, src
        try:
            supply = self.rpc.token_supply(mint)
        except Exception:
            supply = 0.0
        progress("Checking what snipers/bundlers still hold…")
        la.sniper_hold_pct = early_buyers.sniper_holdings_pct(la, rug, self.rpc if supply else None, supply)
        return la

    # -------------------------------------------------------- insider finder
    def find_insiders(self, mints: list[str], profile_top: int = 25, progress: Progress = _noop):
        launches = []
        for i, m in enumerate(mints, 1):
            m = m.strip()
            if not m:
                continue
            pair = self.dex.best_pair(m)
            sym = ((pair or {}).get("baseToken") or {}).get("symbol") or m[:6]
            progress(f"[{i}/{len(mints)}] {sym}: finding earliest buyers…")
            try:
                rug = self.rug.report(m)
            except Exception:
                rug = None
            swaps, complete, src = early_buyers.fetch_early_swaps(
                m, (pair or {}).get("pairAddress"), self.rpc, self.bird, self.settings.early_buyer_count,
                self.settings.max_signature_pages, self.sol_usd(), progress)
            la = early_buyers.analyze_launch(m, swaps, self.settings.early_buyer_count,
                                             (rug or {}).get("creator") or "")
            la.complete_history = complete
            progress(f"{sym}: {len(la.buyers)} early buyers, {len(la.snipers)} snipers, {len(la.bundles)} bundles")
            launches.append((sym, la))
        cands = wallets.collect_candidates(launches)
        tx_limit = self.settings.profile_wallet_tx_limit
        if self.rpc.public and not self.solscan.enabled:
            # Free public RPC allows ~1 getTransaction/s: keep the run to a few minutes.
            profile_top, tx_limit = min(profile_top, 12), min(tx_limit, 40)
            progress("Public RPC detected – profiling top 12 wallets × 40 tx. Add a free Helius RPC "
                     "in Settings for full-depth profiling.")
        to_profile = wallets.shortlist(cands, profile_top)
        for i, c in enumerate(to_profile, 1):
            progress(f"Profiling wallet {i}/{len(to_profile)}: {c.address[:6]}… (PnL / win-rate / bot check)")
            c.profile = wallets.profile_wallet(c.address, self.rpc, self.solscan, self.dex,
                                               tx_limit, self.sol_usd())
        ranked = wallets.rank_candidates(cands, len(launches), self.settings.early_buyer_count)
        # Only return wallets we actually profiled or that hit multiple tokens
        profiled = {c.address for c in to_profile}
        return [c for c in ranked if c.address in profiled or len(c.hits) > 1]

    def profile(self, wallet: str) -> wallets.WalletProfile:
        return wallets.profile_wallet(wallet.strip(), self.rpc, self.solscan, self.dex,
                                      self.settings.profile_wallet_tx_limit, self.sol_usd())
