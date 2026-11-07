# poison

## Wallet Radar (`tracker/`)

A lightweight, real-time Solana wallet tracker. Add the wallets of traders or insiders you follow, watch their trades live, and get an alert when one of them buys **and it's still a good time for you to get in too**.

**Open it:** `tracker/index.html` — needs no build and no dependencies. Serve it over http(s) (GitHub Pages, or `python3 -m http.server` then visit `http://localhost:8000/tracker/`) so phone notifications work. Add `?demo` to the URL, or click **Demo**, to preview it with simulated trades.

### What it does
- **Live feed** — one WebSocket (`logsSubscribe`) per tracked wallet, so swaps show up seconds after they confirm. An HTTP poller runs in the background as a safety net, and the header shows the average detection latency.
- **Wallet analytics** — realized PnL, win rate, unrealized PnL, average buy size, open bags, a PnL curve and per-token positions. These are built from the trade history the app has loaded (the last 25 transactions by default, plus everything seen live).
- **Entry signals** — each buy is scored 0–100 from live DexScreener data:
  - price compared with the insider's entry (35 points)
  - liquidity (15)
  - buy pressure over the last 5 minutes (15)
  - how many tracked wallets bought the same token (15)
  - whether the insider is still holding (10)
  - how fresh the buy is (5)
  - the wallet's win rate (5)

  Each signal shows one of these states:
  - `ENTER NOW` — near their entry, enough liquidity, they're holding, and the score is above your threshold.
  - `LATE · WAIT DIP` — price has run up. If it pulls back into the entry zone, you get a fresh ENTER alert.
  - `DUMPING`, `AVOID`, `INSIDER EXITED` — don't follow.
- **Alerts** — browser/phone notifications, sound, an on-screen toast and a flashing tab title. Clicking an alert opens the token in DexScreener, GMGN, Jupiter, Birdeye, Photon or BullX (you choose in Settings). Separate alerts fire when a tracked wallet sells.

### Tips
- The free public Solana RPC is rate-limited. For real speed, paste a free Helius or QuickNode RPC URL in **Settings**.
- All settings and the zone rules are configurable: max % above entry, minimum liquidity, market-cap range, score threshold and signal lifetime.
- Everything is stored in your browser (localStorage). Use **Import / Export** to back up your wallet list.
- Alerts only fire while the page is open (it can be in a background tab).

> Signals are heuristics, not financial advice. Copy-trading memecoins is very high risk.
