# Poison Scanner

Windows desktop tool for Solana memecoins. It pulls data from **DexScreener, RugCheck, Birdeye, Solscan, the Solana RPC and Jupiter**.

## Tabs

| Tab | What it does |
|---|---|
| 🛡 **Safe Entries** | Collects fresh tokens (DexScreener profiles, boosts, CTOs, Birdeye new listings) and filters them on liquidity, age, market cap and volume. It then runs a full rug check on each one and shows only tokens rated **GOOD ENTRY** or **WATCH**. Auto-rescan is optional. |
| 🔎 **Token Check** | Full report on one mint. With *deep* on, it also rebuilds the launch from on-chain transactions: the first buyers, **snipers** (who bought in the first ~3 slots), **bundles** (3+ wallets buying in the same slot) and how much of the supply snipers and bundlers **still hold**. |
| 🕵 **Insider Finder** | Paste 2–6 tokens that pumped. It finds the earliest buyers of each one, cross-references them, then profiles the top wallets from their own swap history: realized and unrealized PnL, win rate, best trade and tx/hour. Bots, devs and bundlers are flagged and penalized. Wallets that were early in several winners and are profitable get tagged `INSIDER?` / `SMART`. |
| 🤖 **Copy Trade** | Watches wallets you choose. Each new buy goes through the safety filter, and blocked tokens are never bought. It then buys a fixed SOL size through Jupiter, copies the leader's sells and applies take-profit / stop-loss. **Paper mode by default.** |
| ⚙ **Settings** | API keys and every threshold. Saved to `%APPDATA%\PoisonScanner\settings.json`. |

### What a token must pass for GOOD ENTRY
- Mint authority and freeze authority **revoked**, no Token-2022 transfer tax, not flagged rugged or honeypot
- LP ≥ 90 % locked or burned (bonding-curve tokens are marked as such)
- Top 10 holders ≤ 30 % and no single wallet ≤ 10 %. Pools, lockers and burn addresses are left out of these numbers.
- Dev ≤ 5 %, no large insider/funding-linked holder cluster
- Sells are happening (honeypot check), buy/sell ratio is healthy, no wash-trading volume, not already up >400 % in the last hour, not dumping
- (Deep check) snipers and bundlers still hold ≤ 8 % of supply

## Getting the .exe
- **Prebuilt:** GitHub → *Actions* → *Build Windows EXE* → latest run → download the `PoisonScanner-windows` artifact.
- **Build yourself:** install Python 3.12 from python.org, then double-click `build.bat`. The output is `dist\PoisonScanner.exe`.
- **Run from source:** `pip install -r requirements.txt && python main.py`

## Strongly recommended (free)
- **Helius RPC** (helius.dev). Put `https://mainnet.helius-rpc.com/?api-key=KEY` in *rpc url*. The public RPC is heavily rate-limited, so insider and deep scans on it are slow.
- **Birdeye API key** (bds.birdeye.so). Gives fast earliest-trade lookup and honeypot data.
- Solscan Pro key is optional and speeds up wallet history.

## Honest limits
- No tool can promise a token is safe. These checks remove most common rugs, honeypots and sniper-dumped launches. A dev can still sell a wallet that isn't linked to them, and narratives die.
- "Insider" is a statistical label: a wallet that is repeatedly early and profitable. It is not proof.
- On very busy tokens the public RPC may not reach the launch. The report then says the history is partial.
- **Live copy trading moves real money.** Use a burner wallet. The private key is kept in memory only and is never written to disk. Start in paper mode.
