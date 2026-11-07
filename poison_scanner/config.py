"""Settings persisted as JSON in the user's app-data folder."""
from __future__ import annotations

import json
import os
import sys
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path

APP_NAME = "PoisonScanner"

WSOL_MINT = "So11111111111111111111111111111111111111112"
USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
QUOTE_MINTS = {WSOL_MINT, USDC_MINT, USDT_MINT}
STABLE_MINTS = {USDC_MINT, USDT_MINT}


def app_dir() -> Path:
    if sys.platform.startswith("win"):
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    d = base / APP_NAME
    d.mkdir(parents=True, exist_ok=True)
    return d


@dataclass
class Settings:
    # --- data sources -------------------------------------------------
    rpc_url: str = "https://api.mainnet-beta.solana.com"
    birdeye_api_key: str = ""
    solscan_api_key: str = ""
    jupiter_base_url: str = "https://lite-api.jup.ag/swap/v1"
    jupiter_api_key: str = ""

    # --- safe-token filters --------------------------------------------
    min_liquidity_usd: float = 15_000
    max_liquidity_usd: float = 5_000_000
    min_mcap_usd: float = 30_000
    max_mcap_usd: float = 20_000_000
    min_age_minutes: float = 15
    max_age_hours: float = 72
    min_volume_h1_usd: float = 10_000
    max_top10_pct: float = 30.0          # top 10 holders (pools excluded)
    max_single_holder_pct: float = 10.0
    max_creator_pct: float = 5.0
    min_lp_locked_pct: float = 90.0
    max_sniper_hold_pct: float = 8.0
    min_safety_score: int = 70
    require_socials: bool = True

    # --- insider finder ------------------------------------------------
    early_buyer_count: int = 60           # first N buyers per token
    max_signature_pages: int = 25         # 1000 sigs per page
    profile_wallet_tx_limit: int = 150

    # --- copy trading --------------------------------------------------
    copy_poll_seconds: int = 6
    copy_buy_sol: float = 0.05
    copy_max_open_positions: int = 5
    copy_slippage_bps: int = 1500
    copy_priority_fee_lamports: int = 200_000
    copy_min_safety_score: int = 65
    copy_take_profit_pct: float = 100.0
    copy_stop_loss_pct: float = 35.0
    copy_mirror_sells: bool = True
    copy_live_trading: bool = False       # paper mode by default
    watchlist: list = field(default_factory=list)  # [{"address":..., "label":...}]

    @classmethod
    def path(cls) -> Path:
        return app_dir() / "settings.json"

    @classmethod
    def load(cls) -> "Settings":
        s = cls()
        p = cls.path()
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                known = {f.name for f in fields(cls)}
                for k, v in data.items():
                    if k in known:
                        setattr(s, k, v)
            except (OSError, ValueError):
                pass
        return s

    def save(self) -> None:
        self.path().write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
