# ☣ Poison Terminal — memecoin trading trainer

A **lightweight, fully offline** Windows trading terminal that simulates a pump.fun / Axiom-style memecoin market so you can practice for real: fast keyboard trading, rugs you must learn to dodge, red flags you must learn to read, and PnL cards to flex your wins.

No internet, no wallet, no keys. Every coin, wallet and candle is simulated on your machine.

## Download the .exe

1. Go to **Releases** (or **Actions → Build Windows EXE → latest run → Artifacts**).
2. Pick one:
   - `PoisonTerminal-Setup-2.0.0.exe` — installer (Start menu + desktop shortcut)
   - `PoisonTerminal-2.0.0-portable.exe` — single file, just run it
3. SmartScreen may warn (app isn't code-signed): **More info → Run anyway**.

## How realistic is the market?

Every coin runs on the **real pump.fun bonding curve**: 30 SOL / 1.073B virtual reserves, ~$5K starting MC, graduating at ~85 SOL raised (~$70K MC) and migrating to a **PumpSwap** constant-product pool (0.25% fee). Contracts end in `…pump` like the real thing.

Each candle is produced by simulated wallets, each with its own entry, take-profit and panic level: **devs, bundlers, snipers, insiders, KOLs, whales, volume bots and hundreds of retail traders**. Every coin has a hidden fate:

| Fate | What happens | What gives it away |
|---|---|---|
| Dead launch (~50%) | never finds buyers, bleeds to the floor | few holders, no socials, dev sells |
| Sniped & faded | snipers dump on the first wave | high sniper % |
| **Bundle rug** | bundled wallets dump together (−90%) | bundlers 20–50%, high top-10 |
| **Dev dump** | dev sells a huge bag in one tx | dev holds 15–35%, serial-rugger dev history |
| **Fake volume** | a bot trades with itself, then stops | txns ≫ holders, tiny trade sizes |
| **Migration dump** | insiders sell right after bonding | bundlers + insiders into migration |
| Organic runner | bonds, runs to $200K–$5M+ with pullbacks | distributed holders, socials, low bundle % |
| KOL pump | KOL buys, followers chase, KOL sells into them | vertical candle after a 📣 KOL buy |
| **Cabal bleed** | insiders sell into every pump | high insiders % (not bundled, looks clean) |
| **Honeypot** | you can't sell, then liquidity is pulled | Raydium (not pump), **freeze authority ON** |

The **Token audit** panel shows Top-10 %, Dev %, Bundlers, Snipers, Insiders, Holders, Txns/holder, Mint & Freeze authority, LP status, Dev history, Dev funding and Socials, computed from the actual simulated wallets. When a coin's fate plays out you get a **post-mortem** that explains what happened and which red flags predicted it. A **coach** warns you when you buy into red flags, and your stats track how many rugs you've eaten.

## Trading engine
- Your orders execute inside the pool, so **your size moves the price**
- Platform fee + pool fee (1% on curve, 0.25% on PumpSwap) + priority fee
- Landing latency; the tx **fails (fee still paid) if price moves past your slippage**
- Honeypot sells fail with "account frozen", just like on-chain
- Per-position **take profit, stop loss, trailing stop, breakeven stop**
- Your bags (and watched coins) are saved and keep simulating while the app is closed

## Built for weak laptops
- **Lite** effects by default: no blur or animated backgrounds, chart capped at ~15 fps and redrawn only on change, off-screen rows skipped, incremental trade tape
- The whole market simulation (≈80 coins) costs ~40 ms of CPU per minute
- **Crazy** mode (Settings → Appearance) brings back blur, aurora background, glows and particle overload

## Keyboard shortcuts (all rebindable in Settings → Shortcuts)

| Key | Action | Key | Action |
|---|---|---|---|
| `1` `2` `3` `4` | Buy presets | `Q` `W` `E` `R` | Sell presets |
| **`L`** | **Arm/disarm stop loss** | `Shift+L` | Arm/disarm take profit |
| `Shift+B` | Stop to breakeven | `Shift+Q` | Panic sell everything |
| `↑` `↓` / `J` `K` | Prev/next coin | `←` `→` | Prev/next list |
| `Alt+←` `Alt+→` | Back / forward through coins | `Enter` | Execute order |
| `N` `G` `U` | New / Final stretch / Migrated | `T` `H` `V` | Trending / Bags / Watchlist |
| `Ctrl+K` or `/` | Search & commands | `P` | PnL card |
| `X` `B` `S` | Toggle / buy / sell side | `A` | Focus amount |
| `F` | Watchlist ★ | `C` | Copy contract |
| `[` `]` | Timeframe | `M` | MCap / Price |
| `Alt+1/2/3` | Trades / Positions / History | `Z` | Zen mode |
| `Ctrl+,` | Settings | `?` | Cheat sheet |

Middle-click a coin in a list to quick-buy it.

## PnL card 🎴
12 animated backgrounds or your own image, 4 fonts, left/center layout, SOL/USD, custom accent and glow, a toggle for each stat, handle/avatar/tagline. Save as PNG (2400×1350) or copy to clipboard. Works for a single trade or your whole portfolio.

## Build it yourself (Windows)
```bash
npm install
npm start        # run
npm run dist     # build dist/*.exe
```
