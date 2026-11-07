# ☣ Poison Terminal

A fast Solana memecoin trading terminal for Windows. It has a live market feed, keyboard-first trading, realistic fills, TP/SL automation, and **PnL cards** you can customize and share.

> **Trading is paper trading.** Market data is real when you're online, and every order is filled against the real pool's AMM math (fees, price impact, slippage). No real funds or private keys are ever touched.

## Download the .exe

1. Open the **Actions** tab, then **Build Windows EXE**, then the latest run. Download the `PoisonTerminal-windows` artifact. You can also go to **Releases** and grab the newest build.
2. Pick one:
   - `PoisonTerminal-1.0.0-x64-nsis.exe` is the installer. It adds a Start menu entry and a desktop shortcut.
   - `PoisonTerminal-1.0.0-portable.exe` is a single file. No install, just run it.
3. Windows SmartScreen may warn you because the app isn't code-signed. Click **More info**, then **Run anyway**.

Build it yourself on Windows:

```bash
npm install
npm start        # run in dev
npm run dist     # outputs dist/*.exe
```

## Features

**Market data (live)**
- 🔥 Trending, ✨ New pairs, 🚀 Surging (5m), 💼 Bags, and ★ Watchlist lists, auto-refreshing
- Real-time pair updates every 2s from DexScreener, plus candles and the live trade tape from GeckoTerminal
- Search by symbol or name, or paste a contract address (`Ctrl+K`)
- If the feeds can't be reached, the app switches to a built-in **simulated market**. That's a constant-product AMM with pumps, dumps, rugs and new launches every few seconds.

**Trading (realistic paper fills)**
- Fills are computed from the pool's `x·y=k` reserves, so price impact grows with your size relative to liquidity
- Platform fee, DEX/LP fee, Solana base fee and **priority fee** are all applied
- Simulated landing latency. If the price moves past your slippage tolerance before the order lands, the tx **fails and you still pay the fee**, just like on-chain.
- One-tap buy presets in SOL and sell presets in %, plus ⚡ quick-buy straight from the token list
- Per-position **TP / SL automation**, and optional auto TP/SL on every new buy
- 🚨 Panic sell everything (`Shift+Q`)
- Positions, history, win rate, and CSV export

**Chart**
- Custom GPU-friendly canvas candles: 1s, 1m, 5m, 15m, 1h. MCap or Price view.
- Your buy and sell markers, an avg-entry line, crosshair with OHLC legend, zoom and pan, and a pulsing animated last price

**PnL card 🎴**
- 12 animated backgrounds (Auto win/loss, Toxic, Nebula, Inferno, Matrix, Gold, Ice…), or **upload your own image**
- 4 font styles, left or center layout, SOL or USD, custom accent, glow strength, film grain
- Toggle each stat: invested, sold, holding, entry → now MC, chart, handle, date, logo
- Your own handle, avatar and tagline or referral text
- **Save PNG** (2400×1350), **copy image to clipboard**, or copy ready-to-post share text
- Make a card for any single trade or for your whole portfolio

**Looks**
- Glassmorphism panels with a cursor-tracking glow, animated aurora and neon grid background, glitch logo
- Particle bursts, screen-edge flashes, confetti on big wins, number roll animations, price flash on rows
- 8 themes plus custom accent, up and down colors, UI scale, compact mode, effects intensity (Crazy, Subtle, Off)
- Synthesized trade sounds that you can toggle

## Keyboard shortcuts (all rebindable in Settings → Shortcuts)

| Key | Action | Key | Action |
|---|---|---|---|
| `Ctrl+K` or `/` | Search / commands | `P` | PnL card |
| `1` `2` `3` `4` | Buy presets | `Q` `W` `E` `R` | Sell presets |
| `Enter` | Execute order | `X` / `B` / `S` | Toggle side / buy / sell |
| `↑` `↓` or `J` `K` | Prev/next token | `A` | Focus amount |
| `T` `N` `G` `H` `V` | Hot/New/Surge/Bags/Watch | `F` | Watchlist ★ |
| `[` `]` | Timeframe | `M` | MCap / Price |
| `C` | Copy contract | `D` | Open DexScreener |
| `Alt+1/2/3` | Trades/Positions/History | `Z` | Zen mode |
| `Shift+Q` | Panic sell all | `Ctrl+,` | Settings |
| `?` | Cheat sheet | `Esc` | Close |

In the PnL card: `Ctrl+S` saves the PNG and `Ctrl+C` copies the image.

## Project layout

```
main.js / preload.js   Electron shell (frameless window, secure IPC, image save/copy)
src/index.html         layout
src/styles.css         theme + effects
src/js/data.js         live feeds (DexScreener, GeckoTerminal) + AMM simulator
src/js/trading.js      paper trading engine, TP/SL
src/js/chart.js        canvas candlestick chart
src/js/pnlcard.js      PnL card renderer + editor
src/js/ui.js           panels, palette, settings
src/js/keys.js         rebindable shortcuts
```
