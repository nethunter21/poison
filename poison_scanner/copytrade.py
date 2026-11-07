"""Copy-trading: watch wallets, safety-gate their buys, mirror in paper or live mode."""
from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict, dataclass
from typing import Callable

from .analysis import safety
from .analysis.swaps import parse_swaps
from .apis.jupiter import Wallet
from .config import WSOL_MINT, app_dir
from .engine import Engine


@dataclass
class Position:
    mint: str
    symbol: str
    leader: str
    sol_in: float
    entry_price_usd: float
    tokens: float
    opened_at: float
    mode: str              # "paper" | "live"
    entry_sig: str = ""
    closed: bool = False
    exit_price_usd: float = 0.0
    pnl_pct: float = 0.0
    exit_reason: str = ""


class CopyTrader:
    def __init__(self, engine: Engine, log: Callable[[str], None],
                 on_positions: Callable[[list[Position]], None] = lambda p: None):
        self.engine = engine
        self.log = log
        self.on_positions = on_positions
        self.wallet: Wallet | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_sig: dict[str, str] = {}
        self.positions: list[Position] = self._load()

    # ------------------------------------------------------------ persistence
    @staticmethod
    def _path():
        return app_dir() / "positions.json"

    def _load(self) -> list[Position]:
        try:
            return [Position(**d) for d in json.loads(self._path().read_text(encoding="utf-8"))]
        except (OSError, ValueError, TypeError):
            return []

    def _save(self) -> None:
        self._path().write_text(json.dumps([asdict(p) for p in self.positions], indent=2), encoding="utf-8")
        self.on_positions(list(self.positions))

    @property
    def open_positions(self) -> list[Position]:
        return [p for p in self.positions if not p.closed]

    # ----------------------------------------------------------------- control
    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def set_wallet(self, secret: str) -> str:
        self.wallet = Wallet(secret)
        return self.wallet.address

    def start(self) -> None:
        if self.running:
            return
        s = self.engine.settings
        if s.copy_live_trading and self.wallet is None:
            raise RuntimeError("Live trading is ON but no wallet key is loaded.")
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    # -------------------------------------------------------------------- loop
    def _run(self) -> None:
        s = self.engine.settings
        mode = "LIVE" if s.copy_live_trading else "PAPER"
        self.log(f"Copy-trader started in {mode} mode, watching {len(s.watchlist)} wallet(s).")
        # Mark current history as seen so we only copy NEW trades.
        for w in s.watchlist:
            addr = w["address"]
            try:
                sigs = self.engine.rpc.signatures(addr, limit=1)
                self._last_sig[addr] = sigs[0]["signature"] if sigs else ""
            except Exception as e:
                self.log(f"{w.get('label') or addr[:6]}: init failed {e}")
        while not self._stop.is_set():
            for w in list(s.watchlist):
                if self._stop.is_set():
                    break
                try:
                    self._poll_wallet(w["address"], w.get("label") or w["address"][:6])
                except Exception as e:
                    self.log(f"poll error {w['address'][:6]}: {e}")
            try:
                self._manage_exits()
            except Exception as e:
                self.log(f"TP/SL check error: {e}")
            self._stop.wait(max(2, s.copy_poll_seconds))
        self.log("Copy-trader stopped.")

    def _poll_wallet(self, addr: str, label: str) -> None:
        until = self._last_sig.get(addr) or None
        sigs = self.engine.rpc.signatures(addr, limit=20, until=until)
        if not sigs:
            return
        self._last_sig[addr] = sigs[0]["signature"]
        for sig in reversed(sigs):  # oldest first
            if sig.get("err") is not None:
                continue
            tx = self.engine.rpc.transaction(sig["signature"])
            for sw in parse_swaps(tx, addr, self.engine.sol_usd(), sig["signature"]):
                self.log(f"👀 {label} {sw.side.upper()} {sw.token_amount:,.0f} of {sw.mint[:6]}… "
                         f"for {sw.sol_amount:.3f} SOL")
                if sw.side == "buy":
                    self._on_leader_buy(addr, label, sw.mint)
                elif sw.side == "sell" and self.engine.settings.copy_mirror_sells:
                    self._on_leader_sell(addr, label, sw.mint)

    # ---------------------------------------------------------------- actions
    def _on_leader_buy(self, leader: str, label: str, mint: str) -> None:
        s = self.engine.settings
        if any(p.mint == mint for p in self.open_positions):
            self.log("  ↳ already holding, skip")
            return
        if len(self.open_positions) >= s.copy_max_open_positions:
            self.log("  ↳ max open positions reached, skip")
            return
        pair = self.engine.dex.best_pair(mint)
        try:
            rug = self.engine.rug.report(mint)
        except Exception:
            rug = None
        rep = safety.evaluate(mint, pair, rug, s, socials=safety.has_socials(pair))
        if rep.hard_fails or rep.safety_score < s.copy_min_safety_score:
            reasons = "; ".join(c.name for c in rep.hard_fails) or f"safety {rep.safety_score}"
            self.log(f"  ⛔ {rep.symbol} blocked by safety filter ({reasons})")
            return
        price = rep.price_usd
        if not price:
            self.log("  ⛔ no price yet, skip")
            return
        sol_usd = self.engine.sol_usd() or 1
        tokens = s.copy_buy_sol * sol_usd / price
        sig = ""
        if s.copy_live_trading:
            try:
                q = self.engine.jup.quote(WSOL_MINT, mint, int(s.copy_buy_sol * 1e9), s.copy_slippage_bps)
                sig = self.engine.jup.swap(self.wallet, self.engine.rpc, q, s.copy_priority_fee_lamports)
                self.log(f"  ✅ LIVE BUY {rep.symbol} {s.copy_buy_sol} SOL  tx {sig}")
            except Exception as e:
                self.log(f"  ❌ live buy failed: {e}")
                return
        else:
            self.log(f"  📝 PAPER BUY {rep.symbol} {s.copy_buy_sol} SOL @ ${price:.8f} (safety {rep.safety_score})")
        self.positions.append(Position(mint, rep.symbol, leader, s.copy_buy_sol, price, tokens, time.time(),
                                       "live" if s.copy_live_trading else "paper", sig))
        self._save()

    def _on_leader_sell(self, leader: str, label: str, mint: str) -> None:
        for p in self.open_positions:
            if p.mint == mint and p.leader == leader:
                self._close(p, f"leader {label} sold")

    def _manage_exits(self) -> None:
        s = self.engine.settings
        opens = self.open_positions
        if not opens:
            return
        from .apis.dexscreener import best_pairs_by_token
        prices = best_pairs_by_token(self.engine.dex.pairs_for_tokens([p.mint for p in opens]))
        for p in opens:
            pr = prices.get(p.mint)
            if not pr:
                continue
            price = float(pr.get("priceUsd") or 0)
            if not price:
                continue
            chg = (price / p.entry_price_usd - 1) * 100
            if chg >= s.copy_take_profit_pct:
                self._close(p, f"take-profit {chg:+.0f}%", price)
            elif chg <= -s.copy_stop_loss_pct:
                self._close(p, f"stop-loss {chg:+.0f}%", price)

    def _close(self, p: Position, reason: str, price: float | None = None) -> None:
        if price is None:
            pair = self.engine.dex.best_pair(p.mint)
            price = float((pair or {}).get("priceUsd") or 0)
        if p.mode == "live":
            if self.wallet is None:
                self.log(f"  ❌ cannot sell {p.symbol}: wallet not loaded")
                return
            try:
                raw, _ = self.engine.rpc.token_balance(self.wallet.address, p.mint)
                if raw <= 0:
                    self.log(f"  ⚠ {p.symbol}: zero balance, marking closed")
                else:
                    q = self.engine.jup.quote(p.mint, WSOL_MINT, raw, self.engine.settings.copy_slippage_bps)
                    sig = self.engine.jup.swap(self.wallet, self.engine.rpc, q,
                                               self.engine.settings.copy_priority_fee_lamports)
                    self.log(f"  ✅ LIVE SELL {p.symbol} ({reason}) tx {sig}")
            except Exception as e:
                self.log(f"  ❌ live sell {p.symbol} failed: {e}")
                return
        p.closed = True
        p.exit_price_usd = price
        p.pnl_pct = (price / p.entry_price_usd - 1) * 100 if p.entry_price_usd and price else 0.0
        p.exit_reason = reason
        self.log(f"  {'💰' if p.pnl_pct > 0 else '🔻'} CLOSED {p.symbol} {p.pnl_pct:+.1f}% – {reason}")
        self._save()

    def close_manual(self, mint: str) -> None:
        for p in self.open_positions:
            if p.mint == mint:
                self._close(p, "manual")
