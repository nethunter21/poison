"""Tkinter desktop UI."""
from __future__ import annotations

import queue
import threading
import time
import tkinter as tk
import traceback
import webbrowser
from dataclasses import fields
from tkinter import messagebox, ttk

from ..analysis.safety import FAIL, PASS, WARN, TokenReport
from ..config import Settings
from ..copytrade import CopyTrader
from ..engine import Engine

BG, PANEL, FG, MUTED = "#0d0905", "#1a120a", "#fff7ec", "#9a8c7a"
ACCENT, GOOD, BAD, WARNC = "#ff8a00", "#3ddc84", "#ff4d4d", "#ffcf40"

VERDICT_COLORS = {"GOOD ENTRY": GOOD, "WATCH": WARNC, "RISKY": "#ff9f43", "AVOID": BAD, "UNVERIFIED": MUTED}


def usd(v: float) -> str:
    if v >= 1e6:
        return f"${v / 1e6:.2f}M"
    if v >= 1e3:
        return f"${v / 1e3:.1f}K"
    return f"${v:.0f}"


def age(m: float) -> str:
    return f"{m:.0f}m" if m < 120 else f"{m / 60:.1f}h"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Poison Scanner – Solana insider & safe-entry finder")
        self.geometry("1360x860")
        self.minsize(1100, 700)
        self.configure(bg=BG)
        self.settings = Settings.load()
        self.engine = Engine(self.settings)
        self._q: queue.Queue = queue.Queue()
        self.reports: dict[str, TokenReport] = {}
        self.insiders: dict[str, object] = {}
        self.trader = CopyTrader(self.engine, lambda m: self.ui(self._copy_log, m),
                                 lambda p: self.ui(self._refresh_positions))
        self._style()
        self._build()
        self.after(100, self._pump)
        self._auto_job = None

    # ------------------------------------------------------------- plumbing
    def ui(self, fn, *a):
        self._q.put((fn, a))

    def _pump(self):
        try:
            while True:
                fn, a = self._q.get_nowait()
                fn(*a)
        except queue.Empty:
            pass
        self.after(100, self._pump)

    def bg(self, work, done=None, status=None):
        def run():
            try:
                res = work()
                if done:
                    self.ui(done, res)
            except Exception as e:
                traceback.print_exc()
                self.ui(self.set_status, f"Error: {e}")
                if status:
                    self.ui(status, f"Error: {e}")
        threading.Thread(target=run, daemon=True).start()

    def set_status(self, msg: str):
        self.status.set(f"{time.strftime('%H:%M:%S')}  {msg}")

    def progress(self, msg: str):
        self.ui(self.set_status, msg)

    # ---------------------------------------------------------------- style
    def _style(self):
        st = ttk.Style(self)
        st.theme_use("clam")
        st.configure(".", background=BG, foreground=FG, fieldbackground=PANEL, bordercolor="#3a2a1a",
                     font=("Segoe UI", 10))
        st.configure("TNotebook", background=BG, borderwidth=0)
        st.configure("TNotebook.Tab", background=PANEL, foreground=MUTED, padding=(16, 8),
                     font=("Segoe UI Semibold", 10))
        st.map("TNotebook.Tab", background=[("selected", "#2a1a0a")], foreground=[("selected", ACCENT)])
        st.configure("TButton", background="#2a1a0a", foreground=FG, padding=(10, 5), borderwidth=1)
        st.map("TButton", background=[("active", "#3d260f")])
        st.configure("Accent.TButton", background=ACCENT, foreground="#1a0b00",
                     font=("Segoe UI Semibold", 10))
        st.map("Accent.TButton", background=[("active", "#ffb347")])
        st.configure("Treeview", background=PANEL, fieldbackground=PANEL, foreground=FG, rowheight=24,
                     borderwidth=0)
        st.configure("Treeview.Heading", background="#2a1a0a", foreground=ACCENT,
                     font=("Segoe UI Semibold", 9))
        st.map("Treeview", background=[("selected", "#4a2a08")])
        st.configure("TLabel", background=BG, foreground=FG)
        st.configure("Muted.TLabel", foreground=MUTED)
        st.configure("Head.TLabel", foreground=ACCENT, font=("Segoe UI Semibold", 13))
        st.configure("TCheckbutton", background=BG, foreground=FG)
        st.configure("TEntry", foreground=FG, insertcolor=FG)
        st.configure("TLabelframe", background=BG, foreground=ACCENT)
        st.configure("TLabelframe.Label", background=BG, foreground=ACCENT)

    def _text(self, parent, height=10):
        t = tk.Text(parent, height=height, bg=PANEL, fg=FG, insertbackground=FG, relief="flat",
                    font=("Consolas", 10), wrap="word", padx=8, pady=6)
        t.tag_configure(PASS, foreground=GOOD)
        t.tag_configure(WARN, foreground=WARNC)
        t.tag_configure(FAIL, foreground=BAD)
        t.tag_configure("INFO", foreground=MUTED)
        t.tag_configure("head", foreground=ACCENT, font=("Consolas", 11, "bold"))
        return t

    def _tree(self, parent, cols, widths):
        frame = ttk.Frame(parent)
        tv = ttk.Treeview(frame, columns=cols, show="headings", selectmode="browse")
        for c, w in zip(cols, widths):
            tv.heading(c, text=c, command=lambda c=c: self._sort(tv, c))
            tv.column(c, width=w, anchor="w" if w > 120 else "center", stretch=w > 120)
        sb = ttk.Scrollbar(frame, orient="vertical", command=tv.yview)
        tv.configure(yscrollcommand=sb.set)
        tv.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        for v, col in VERDICT_COLORS.items():
            tv.tag_configure(v, foreground=col)
        tv.tag_configure("good", foreground=GOOD)
        tv.tag_configure("bad", foreground=BAD)
        return frame, tv

    @staticmethod
    def _sort(tv, col):
        rows = [(tv.set(k, col), k) for k in tv.get_children("")]

        def key(v):
            s = v[0].replace("$", "").replace("%", "").replace(",", "").replace("+", "")
            mult = 1
            if s.endswith("K"):
                s, mult = s[:-1], 1e3
            elif s.endswith("M"):
                s, mult = s[:-1], 1e6
            elif s.endswith("h"):
                s, mult = s[:-1], 60
            elif s.endswith("m"):
                s = s[:-1]
            try:
                return (0, float(s) * mult)
            except ValueError:
                return (1, v[0])
        rev = getattr(tv, "_rev", False)
        rows.sort(key=key, reverse=not rev)
        tv._rev = not rev
        for i, (_, k) in enumerate(rows):
            tv.move(k, "", i)

    def _copy(self, text: str):
        self.clipboard_clear()
        self.clipboard_append(text)
        self.set_status(f"Copied {text}")

    # ---------------------------------------------------------------- layout
    def _build(self):
        top = ttk.Frame(self)
        top.pack(fill="x", padx=14, pady=(10, 0))
        ttk.Label(top, text="☠ POISON SCANNER", style="Head.TLabel").pack(side="left")
        ttk.Label(top, text="  DexScreener · RugCheck · Birdeye · Solscan · Solana RPC · Jupiter",
                  style="Muted.TLabel").pack(side="left")
        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=10, pady=8)
        self.nb = nb
        for title, builder in [("🛡  Safe Entries", self._tab_safe), ("🔎  Token Check", self._tab_check),
                               ("🕵  Insider Finder", self._tab_insiders), ("🤖  Copy Trade", self._tab_copy),
                               ("⚙  Settings", self._tab_settings)]:
            f = ttk.Frame(nb)
            nb.add(f, text=title)
            builder(f)
        self.status = tk.StringVar(value="Ready. Tip: add a free Birdeye key and a Helius RPC in Settings for speed.")
        ttk.Label(self, textvariable=self.status, style="Muted.TLabel").pack(fill="x", padx=14, pady=(0, 8))

    # ------------------------------------------------------- tab: safe entries
    def _tab_safe(self, f):
        bar = ttk.Frame(f)
        bar.pack(fill="x", pady=8)
        self.scan_btn = ttk.Button(bar, text="Scan fresh tokens", style="Accent.TButton", command=self.scan)
        self.scan_btn.pack(side="left")
        self.only_good = tk.BooleanVar(value=True)
        ttk.Checkbutton(bar, text="Only GOOD ENTRY / WATCH", variable=self.only_good,
                        command=self._refill_safe).pack(side="left", padx=12)
        self.auto = tk.BooleanVar(value=False)
        ttk.Checkbutton(bar, text="Auto-rescan every 3 min", variable=self.auto,
                        command=self._toggle_auto).pack(side="left")
        for txt, cmd in [("Deep check (snipers/bundles)", self._safe_deep), ("DexScreener", lambda: self._open_tok("dex")),
                         ("RugCheck", lambda: self._open_tok("rug")), ("Birdeye", lambda: self._open_tok("bird")),
                         ("Copy mint", lambda: self._sel_mint() and self._copy(self._sel_mint())),
                         ("→ Insider Finder", self._send_to_insiders)]:
            ttk.Button(bar, text=txt, command=cmd).pack(side="right", padx=2)
        cols = ("Verdict", "Score", "Safety", "Entry", "Symbol", "Age", "MCap", "Liq", "Vol 1h",
                "5m %", "1h %", "B/S 1h", "Top10 %", "Holders", "Mint")
        widths = (100, 55, 55, 55, 90, 55, 75, 75, 75, 60, 60, 70, 65, 65, 330)
        tf, self.safe_tv = self._tree(f, cols, widths)
        pw = ttk.PanedWindow(f, orient="vertical")
        pw.pack(fill="both", expand=True)
        pw.add(tf, weight=3)
        self.safe_detail = self._text(pw, 10)
        pw.add(self.safe_detail, weight=2)
        self.safe_tv.bind("<<TreeviewSelect>>", lambda e: self._show_report(self.safe_detail, self.reports.get(self._sel_mint())))
        self.safe_tv.bind("<Double-1>", lambda e: self._open_tok("dex"))

    def _sel_mint(self):
        sel = self.safe_tv.selection()
        return self.safe_tv.set(sel[0], "Mint") if sel else ""

    def _row_for(self, r: TokenReport):
        bs = f"{r.buys_h1}/{r.sells_h1}"
        return (r.verdict, r.score, r.safety_score, r.entry_score, r.symbol, age(r.age_minutes), usd(r.mcap),
                usd(r.liquidity), usd(r.volume_h1), f"{r.change_m5:+.0f}%", f"{r.change_h1:+.0f}%", bs,
                "-" if r.top10_pct is None else f"{r.top10_pct:.1f}", r.holders or "-", r.mint)

    def _add_report(self, r: TokenReport):
        self.reports[r.mint] = r
        if self.only_good.get() and r.verdict not in ("GOOD ENTRY", "WATCH"):
            return
        if self.safe_tv.exists(r.mint):
            self.safe_tv.item(r.mint, values=self._row_for(r), tags=(r.verdict,))
        else:
            self.safe_tv.insert("", "end", iid=r.mint, values=self._row_for(r), tags=(r.verdict,))

    def _refill_safe(self):
        self.safe_tv.delete(*self.safe_tv.get_children())
        for r in sorted(self.reports.values(), key=lambda r: r.score, reverse=True):
            self._add_report(r)

    def scan(self):
        self.scan_btn.state(["disabled"])
        self.reports.clear()
        self.safe_tv.delete(*self.safe_tv.get_children())

        def done(reports):
            self.scan_btn.state(["!disabled"])
            good = sum(r.verdict == "GOOD ENTRY" for r in reports)
            self._refill_safe()
            self.set_status(f"Scan finished: {len(reports)} checked, {good} GOOD ENTRY.")
        self.bg(lambda: self.engine.scan_fresh(self.progress, on_report=lambda r: self.ui(self._add_report, r)),
                done, lambda m: self.scan_btn.state(["!disabled"]))

    def _toggle_auto(self):
        if self._auto_job:
            self.after_cancel(self._auto_job)
            self._auto_job = None
        if self.auto.get():
            def tick():
                if "disabled" not in self.scan_btn.state():
                    self.scan()
                self._auto_job = self.after(180_000, tick)
            tick()

    def _safe_deep(self):
        mint = self._sel_mint()
        if not mint:
            return
        self.nb.select(1)
        self.check_entry.delete(0, "end")
        self.check_entry.insert(0, mint)
        self.check_token()

    def _open_tok(self, site, mint=None):
        mint = mint or self._sel_mint()
        if not mint:
            return
        url = {"dex": f"https://dexscreener.com/solana/{mint}", "rug": f"https://rugcheck.xyz/tokens/{mint}",
               "bird": f"https://birdeye.so/token/{mint}?chain=solana",
               "solscan": f"https://solscan.io/token/{mint}"}[site]
        webbrowser.open(url)

    def _send_to_insiders(self):
        mint = self._sel_mint()
        if mint:
            self.ins_text.insert("end", mint + "\n")
            self.nb.select(2)

    def _show_report(self, t: tk.Text, r: TokenReport | None, launch=None):
        t.delete("1.0", "end")
        if not r:
            return
        t.insert("end", f"{r.symbol}  {r.name}   →  {r.verdict}   score {r.score} "
                        f"(safety {r.safety_score} / entry {r.entry_score})\n", "head")
        t.insert("end", f"{r.mint}   dex: {r.dex}   price ${r.price_usd:.10g}   mcap {usd(r.mcap)}   "
                        f"liq {usd(r.liquidity)}   age {age(r.age_minutes)}\n\n")
        for c in sorted(r.checks, key=lambda c: {FAIL: 0, WARN: 1, PASS: 3}.get(c.status, 2)):
            t.insert("end", f"  [{c.status:4}] ", c.status)
            t.insert("end", f"{c.name}: {c.detail}\n")
        if launch is not None:
            t.insert("end", f"\nLaunch analysis ({launch.source}, {launch.trades_seen} early swaps)\n", "head")
            for n in launch.notes:
                t.insert("end", f"  {n}\n", "INFO")
            for i, g in enumerate(launch.bundles, 1):
                t.insert("end", f"  Bundle #{i}: {len(g)} wallets same slot: {', '.join(w[:6] for w in g)}\n", WARN)
            t.insert("end", "\n  #   wallet                                         SOL in   flags\n", "INFO")
            for b in launch.buyers[:40]:
                flags = " ".join(x for x, on in (("SNIPER", b.sniper), ("BUNDLE", b.bundle), ("DEV", b.creator)) if on)
                t.insert("end", f"  {b.rank:<3} {b.wallet:<46} {b.sol_spent:7.3f}   ")
                t.insert("end", flags + "\n", FAIL if flags else PASS)

    # ------------------------------------------------------- tab: token check
    def _tab_check(self, f):
        bar = ttk.Frame(f)
        bar.pack(fill="x", pady=8)
        ttk.Label(bar, text="Token mint:").pack(side="left")
        self.check_entry = ttk.Entry(bar, width=60)
        self.check_entry.pack(side="left", padx=6)
        self.deep = tk.BooleanVar(value=True)
        ttk.Checkbutton(bar, text="Deep launch analysis (snipers, bundles, early buyers)",
                        variable=self.deep).pack(side="left", padx=6)
        self.check_btn = ttk.Button(bar, text="Analyze", style="Accent.TButton", command=self.check_token)
        self.check_btn.pack(side="left")
        ttk.Button(bar, text="Early buyers → Insider Finder", command=self._check_to_insiders).pack(side="right")
        self.check_out = self._text(f, 30)
        self.check_out.pack(fill="both", expand=True)
        self.check_entry.bind("<Return>", lambda e: self.check_token())
        self._last_launch = None

    def check_token(self):
        mint = self.check_entry.get().strip()
        if len(mint) < 32:
            messagebox.showwarning("Token", "Paste a Solana token mint address.")
            return
        self.check_btn.state(["disabled"])
        self.check_out.delete("1.0", "end")
        self.check_out.insert("end", "Analyzing… (deep analysis with the public RPC can take 1–3 min)\n")

        def done(res):
            rep, launch = res
            self._last_launch = launch
            self.check_btn.state(["!disabled"])
            self._show_report(self.check_out, rep, launch)
            self.reports[rep.mint] = rep
            self.set_status(f"{rep.symbol}: {rep.verdict} ({rep.score})")
        self.bg(lambda: self.engine.check_token(mint, self.deep.get(), self.progress), done,
                lambda m: self.check_btn.state(["!disabled"]))

    def _check_to_insiders(self):
        mint = self.check_entry.get().strip()
        if mint:
            self.ins_text.insert("end", mint + "\n")
            self.nb.select(2)

    # ---------------------------------------------------- tab: insider finder
    def _tab_insiders(self, f):
        top = ttk.Frame(f)
        top.pack(fill="x", pady=8)
        left = ttk.Frame(top)
        left.pack(side="left", fill="x", expand=True)
        ttk.Label(left, text="Winning tokens (one mint per line). Wallets that bought EARLY in several of them "
                             "and are profitable overall are likely insiders / smart money:",
                  style="Muted.TLabel").pack(anchor="w")
        self.ins_text = tk.Text(left, height=5, bg=PANEL, fg=FG, insertbackground=FG, relief="flat",
                                font=("Consolas", 10))
        self.ins_text.pack(fill="x", pady=4)
        right = ttk.Frame(top)
        right.pack(side="left", padx=10)
        ttk.Button(right, text="Add top runners from scan", command=self._winners_from_scan).pack(fill="x", pady=2)
        row = ttk.Frame(right)
        row.pack(fill="x", pady=2)
        ttk.Label(row, text="Profile top").pack(side="left")
        self.profile_n = tk.IntVar(value=25)
        ttk.Spinbox(row, from_=5, to=100, textvariable=self.profile_n, width=5).pack(side="left", padx=4)
        ttk.Label(row, text="wallets").pack(side="left")
        self.ins_btn = ttk.Button(right, text="Find insiders", style="Accent.TButton", command=self.find_insiders)
        self.ins_btn.pack(fill="x", pady=2)
        row2 = ttk.Frame(right)
        row2.pack(fill="x", pady=2)
        self.single_wallet = ttk.Entry(row2, width=22)
        self.single_wallet.pack(side="left")
        ttk.Button(row2, text="Profile wallet", command=self._profile_single).pack(side="left", padx=2)

        bar = ttk.Frame(f)
        bar.pack(fill="x")
        for txt, cmd in [("+ Copy-trade this wallet", self._watch_selected),
                         ("Solscan", lambda: self._open_wallet("solscan")),
                         ("Birdeye", lambda: self._open_wallet("bird")), ("GMGN", lambda: self._open_wallet("gmgn")),
                         ("Copy address", lambda: self._sel_wallet() and self._copy(self._sel_wallet()))]:
            ttk.Button(bar, text=txt, command=cmd).pack(side="left", padx=2, pady=4)
        cols = ("Score", "Tags", "Tokens hit", "Avg rank", "Win rate", "Closed", "Realized SOL",
                "Total PnL SOL", "Best x", "Tx/h", "SOL bal", "Wallet")
        widths = (55, 170, 150, 65, 70, 60, 90, 95, 60, 60, 70, 330)
        tf, self.ins_tv = self._tree(f, cols, widths)
        tf.pack(fill="both", expand=True)

    def _winners_from_scan(self):
        winners = sorted((r for r in self.reports.values() if r.change_h24 > 80 and not r.hard_fails),
                         key=lambda r: r.change_h24, reverse=True)[:6]
        if not winners:
            messagebox.showinfo("Insider Finder", "Run a scan on the Safe Entries tab first (needs tokens up >80% 24h).")
        for r in winners:
            self.ins_text.insert("end", r.mint + "\n")

    def _ins_row(self, c):
        p = c.profile
        tags = " ".join(c.tags)
        if p is None:
            return (c.score, tags, ", ".join(c.hits), f"{c.avg_rank:.0f}", "-", "-", "-", "-", "-", "-", "-", c.address)
        return (c.score, tags, ", ".join(c.hits), f"{c.avg_rank:.0f}", f"{p.win_rate:.0%}", p.closed,
                f"{p.realized_pnl:+.2f}", f"{p.total_pnl:+.2f}", f"{p.best_trade_x:.1f}", f"{p.tx_per_hour:.0f}",
                "-" if p.sol_balance is None else f"{p.sol_balance:.2f}", c.address)

    def find_insiders(self):
        mints = [m.strip() for m in self.ins_text.get("1.0", "end").split() if len(m.strip()) >= 32]
        mints = list(dict.fromkeys(mints))
        if not mints:
            messagebox.showwarning("Insider Finder", "Add at least one token mint (2–6 winners works best).")
            return
        self.ins_btn.state(["disabled"])
        self.ins_tv.delete(*self.ins_tv.get_children())

        def done(cands):
            self.ins_btn.state(["!disabled"])
            for c in cands:
                self.insiders[c.address] = c
                tag = "bad" if any(t in c.tags for t in ("BOT", "DEV", "BUNDLER")) else ("good" if c.score >= 60 else "")
                self.ins_tv.insert("", "end", iid=c.address, values=self._ins_row(c), tags=(tag,))
            self.set_status(f"Insider finder done: {len(cands)} wallets ranked.")
        self.bg(lambda: self.engine.find_insiders(mints, self.profile_n.get(), self.progress), done,
                lambda m: self.ins_btn.state(["!disabled"]))

    def _profile_single(self):
        w = self.single_wallet.get().strip()
        if len(w) < 32:
            return
        from ..analysis.wallets import WalletCandidate, score_candidate

        def done(p):
            c = WalletCandidate(w, profile=p)
            score_candidate(c, 1, self.settings.early_buyer_count)
            if self.ins_tv.exists(w):
                self.ins_tv.delete(w)
            self.ins_tv.insert("", 0, iid=w, values=self._ins_row(c))
            self.set_status(f"Profiled {w[:6]}…: {p.closed} closed, win {p.win_rate:.0%}, PnL {p.total_pnl:+.2f} SOL"
                            + (f" (partial: {p.error})" if p.error else ""))
        self.set_status(f"Profiling {w[:6]}…")
        self.bg(lambda: self.engine.profile(w), done)

    def _sel_wallet(self):
        sel = self.ins_tv.selection()
        return sel[0] if sel else ""

    def _open_wallet(self, site, w=None):
        w = w or self._sel_wallet()
        if not w:
            return
        webbrowser.open({"solscan": f"https://solscan.io/account/{w}",
                         "bird": f"https://birdeye.so/profile/{w}?chain=solana",
                         "gmgn": f"https://gmgn.ai/sol/address/{w}"}[site])

    def _watch_selected(self):
        w = self._sel_wallet()
        if not w:
            return
        if any(x["address"] == w for x in self.settings.watchlist):
            self.set_status("Already watching.")
            return
        c = self.insiders.get(w)
        label = f"{w[:4]}…{w[-4:]}" + (f" ({c.score})" if c else "")
        self.settings.watchlist.append({"address": w, "label": label})
        self.settings.save()
        self._refresh_watch()
        self.set_status(f"Added {label} to copy-trade watchlist.")

    # ------------------------------------------------------- tab: copy trade
    def _tab_copy(self, f):
        top = ttk.Frame(f)
        top.pack(fill="x", pady=6)

        wl = ttk.Labelframe(top, text="Watched wallets")
        wl.pack(side="left", fill="both", expand=True, padx=(0, 8))
        tf, self.watch_tv = self._tree(wl, ("Label", "Wallet"), (130, 330))
        tf.pack(fill="both", expand=True)
        r = ttk.Frame(wl)
        r.pack(fill="x", pady=4)
        self.watch_entry = ttk.Entry(r, width=46)
        self.watch_entry.pack(side="left")
        ttk.Button(r, text="Add", command=self._add_watch).pack(side="left", padx=2)
        ttk.Button(r, text="Remove", command=self._remove_watch).pack(side="left", padx=2)
        ttk.Button(r, text="Solscan", command=lambda: self.watch_tv.selection() and
                   self._open_wallet("solscan", self.watch_tv.selection()[0])).pack(side="left", padx=2)

        cfg = ttk.Labelframe(top, text="Copy settings")
        cfg.pack(side="left", fill="y")
        self.copy_vars = {}
        for i, (key, label) in enumerate([("copy_buy_sol", "Buy size (SOL)"), ("copy_take_profit_pct", "Take profit %"),
                                          ("copy_stop_loss_pct", "Stop loss %"), ("copy_min_safety_score", "Min safety score"),
                                          ("copy_max_open_positions", "Max open positions"),
                                          ("copy_slippage_bps", "Slippage (bps)")]):
            ttk.Label(cfg, text=label).grid(row=i, column=0, sticky="w", padx=6, pady=2)
            v = tk.StringVar(value=str(getattr(self.settings, key)))
            ttk.Entry(cfg, textvariable=v, width=10).grid(row=i, column=1, padx=6, pady=2)
            self.copy_vars[key] = v
        self.mirror = tk.BooleanVar(value=self.settings.copy_mirror_sells)
        ttk.Checkbutton(cfg, text="Mirror leader sells", variable=self.mirror).grid(row=6, column=0, columnspan=2, sticky="w", padx=6)
        self.live = tk.BooleanVar(value=self.settings.copy_live_trading)
        ttk.Checkbutton(cfg, text="LIVE trading (real money!)", variable=self.live).grid(row=7, column=0, columnspan=2, sticky="w", padx=6)
        ttk.Label(cfg, text="Burner wallet private key (kept in memory only):", style="Muted.TLabel").grid(
            row=8, column=0, columnspan=2, sticky="w", padx=6, pady=(8, 0))
        self.key_entry = ttk.Entry(cfg, show="•", width=34)
        self.key_entry.grid(row=9, column=0, columnspan=2, padx=6)
        ttk.Button(cfg, text="Load key", command=self._load_key).grid(row=10, column=0, sticky="w", padx=6, pady=4)
        self.wallet_lbl = ttk.Label(cfg, text="no wallet", style="Muted.TLabel")
        self.wallet_lbl.grid(row=10, column=1, sticky="w")
        self.copy_btn = ttk.Button(cfg, text="▶ Start copy-trading", style="Accent.TButton", command=self._toggle_copy)
        self.copy_btn.grid(row=11, column=0, columnspan=2, sticky="we", padx=6, pady=6)

        pw = ttk.PanedWindow(f, orient="vertical")
        pw.pack(fill="both", expand=True)
        pf = ttk.Labelframe(pw, text="Positions")
        tf2, self.pos_tv = self._tree(pf, ("Status", "Mode", "Symbol", "SOL in", "Entry $", "Exit $", "PnL %",
                                           "Reason", "Leader", "Mint"), (70, 60, 80, 60, 100, 100, 70, 160, 100, 300))
        tf2.pack(fill="both", expand=True)
        b = ttk.Frame(pf)
        b.pack(fill="x")
        ttk.Button(b, text="Close selected now", command=self._close_selected).pack(side="left", padx=2, pady=2)
        ttk.Button(b, text="DexScreener", command=lambda: self.pos_tv.selection() and
                   self._open_tok("dex", self.pos_tv.set(self.pos_tv.selection()[0], "Mint"))).pack(side="left")
        pw.add(pf, weight=2)
        self.copy_logt = self._text(pw, 10)
        pw.add(self.copy_logt, weight=2)
        self._refresh_watch()
        self._refresh_positions()

    def _refresh_watch(self):
        if not hasattr(self, "watch_tv"):
            return
        self.watch_tv.delete(*self.watch_tv.get_children())
        for w in self.settings.watchlist:
            self.watch_tv.insert("", "end", iid=w["address"], values=(w.get("label", ""), w["address"]))

    def _add_watch(self):
        w = self.watch_entry.get().strip()
        if len(w) < 32 or any(x["address"] == w for x in self.settings.watchlist):
            return
        self.settings.watchlist.append({"address": w, "label": f"{w[:4]}…{w[-4:]}"})
        self.settings.save()
        self.watch_entry.delete(0, "end")
        self._refresh_watch()

    def _remove_watch(self):
        sel = self.watch_tv.selection()
        if sel:
            self.settings.watchlist = [x for x in self.settings.watchlist if x["address"] != sel[0]]
            self.settings.save()
            self._refresh_watch()

    def _load_key(self):
        try:
            addr = self.trader.set_wallet(self.key_entry.get())
            self.key_entry.delete(0, "end")
            self.wallet_lbl.configure(text=f"{addr[:6]}…{addr[-4:]}")
            self.bg(lambda: self.engine.rpc.balance_sol(addr),
                    lambda b: self.wallet_lbl.configure(text=f"{addr[:6]}…{addr[-4:]}  {b:.3f} SOL"))
        except ImportError:
            messagebox.showerror("Wallet", "Live trading needs the 'solders' package (bundled in the .exe).")
        except Exception as e:
            messagebox.showerror("Wallet", f"Invalid private key: {e}")

    def _apply_copy_settings(self) -> bool:
        try:
            for k, v in self.copy_vars.items():
                cur = getattr(self.settings, k)
                setattr(self.settings, k, type(cur)(float(v.get())) if isinstance(cur, int) else float(v.get()))
        except ValueError:
            messagebox.showerror("Copy settings", "Numbers only please.")
            return False
        self.settings.copy_mirror_sells = self.mirror.get()
        self.settings.copy_live_trading = self.live.get()
        self.settings.save()
        return True

    def _toggle_copy(self):
        if self.trader.running:
            self.trader.stop()
            self.copy_btn.configure(text="▶ Start copy-trading")
            return
        if not self._apply_copy_settings():
            return
        if not self.settings.watchlist:
            messagebox.showwarning("Copy trade", "Add at least one wallet to watch.")
            return
        if self.settings.copy_live_trading and not messagebox.askyesno(
                "LIVE trading", f"Real swaps of {self.settings.copy_buy_sol} SOL will be sent from your wallet.\n"
                                "Use a burner wallet with only what you can afford to lose.\n\nContinue?"):
            return
        try:
            self.trader.start()
            self.copy_btn.configure(text="■ Stop copy-trading")
        except Exception as e:
            messagebox.showerror("Copy trade", str(e))

    def _copy_log(self, msg: str):
        tag = FAIL if ("⛔" in msg or "❌" in msg) else (PASS if ("✅" in msg or "💰" in msg) else None)
        self.copy_logt.insert("end", f"{time.strftime('%H:%M:%S')} {msg}\n", tag or ())
        self.copy_logt.see("end")

    def _refresh_positions(self):
        if not hasattr(self, "pos_tv"):
            return
        self.pos_tv.delete(*self.pos_tv.get_children())
        for i, p in enumerate(reversed(self.trader.positions)):
            tag = "" if not p.closed else ("good" if p.pnl_pct > 0 else "bad")
            self.pos_tv.insert("", "end", iid=f"{i}", tags=(tag,), values=(
                "closed" if p.closed else "OPEN", p.mode, p.symbol, p.sol_in, f"{p.entry_price_usd:.8g}",
                f"{p.exit_price_usd:.8g}" if p.closed else "-", f"{p.pnl_pct:+.1f}" if p.closed else "-",
                p.exit_reason, p.leader[:6] + "…", p.mint))

    def _close_selected(self):
        sel = self.pos_tv.selection()
        if sel:
            mint = self.pos_tv.set(sel[0], "Mint")
            self.bg(lambda: self.trader.close_manual(mint))

    # --------------------------------------------------------- tab: settings
    def _tab_settings(self, f):
        canvas = tk.Canvas(f, bg=BG, highlightthickness=0)
        sb = ttk.Scrollbar(f, orient="vertical", command=canvas.yview)
        inner = ttk.Frame(canvas)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.configure(yscrollcommand=sb.set)
        canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        help_text = {
            "rpc_url": "Free Helius key → https://mainnet.helius-rpc.com/?api-key=KEY (much faster than public)",
            "birdeye_api_key": "Free at bds.birdeye.so – faster early-buyer lookup + honeypot data",
            "solscan_api_key": "Optional Solscan Pro key – faster wallet history",
            "jupiter_api_key": "Optional (only for api.jup.ag)",
        }
        self.set_vars = {}
        row = 0
        for fld in fields(Settings):
            if fld.name == "watchlist":
                continue
            ttk.Label(inner, text=fld.name.replace("_", " ")).grid(row=row, column=0, sticky="w", padx=10, pady=3)
            val = getattr(self.settings, fld.name)
            if isinstance(val, bool):
                v = tk.BooleanVar(value=val)
                ttk.Checkbutton(inner, variable=v).grid(row=row, column=1, sticky="w", padx=6)
            else:
                v = tk.StringVar(value=str(val))
                ttk.Entry(inner, textvariable=v, width=60 if isinstance(val, str) else 14,
                          show="•" if "key" in fld.name else "").grid(row=row, column=1, sticky="w", padx=6)
            if fld.name in help_text:
                ttk.Label(inner, text=help_text[fld.name], style="Muted.TLabel").grid(row=row, column=2, sticky="w")
            self.set_vars[fld.name] = v
            row += 1
        ttk.Button(inner, text="Save settings", style="Accent.TButton", command=self._save_settings).grid(
            row=row, column=0, pady=12, padx=10, sticky="w")

    def _save_settings(self):
        try:
            for k, v in self.set_vars.items():
                cur = getattr(self.settings, k)
                if isinstance(cur, bool):
                    setattr(self.settings, k, bool(v.get()))
                elif isinstance(cur, int):
                    setattr(self.settings, k, int(float(v.get())))
                elif isinstance(cur, float):
                    setattr(self.settings, k, float(v.get()))
                else:
                    setattr(self.settings, k, v.get().strip())
        except ValueError as e:
            messagebox.showerror("Settings", f"Invalid number: {e}")
            return
        self.settings.save()
        self.engine.reload(self.settings)
        for k, v in self.copy_vars.items():
            v.set(str(getattr(self.settings, k)))
        self.live.set(self.settings.copy_live_trading)
        self.mirror.set(self.settings.copy_mirror_sells)
        self.set_status("Settings saved.")


def main():
    App().mainloop()
