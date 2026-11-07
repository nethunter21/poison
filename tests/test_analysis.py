import time

from poison_scanner.analysis import early_buyers, safety, wallets
from poison_scanner.analysis.swaps import Swap, parse_swaps
from poison_scanner.config import WSOL_MINT, Settings

MINT = "Mint1111111111111111111111111111111111111111"
POOL = "Pool1111111111111111111111111111111111111111"


def make_tx(signer, sol_change, token_change, mint=MINT, slot=100, wsol_change=0.0, err=None, decimals=6):
    pre_l, post_l = 10 * 10**9, 10 * 10**9 + int(sol_change * 1e9) - 5000
    pre_tb, post_tb = [], []
    if token_change:
        start = 1_000_000 * 10**decimals if token_change < 0 else 0
        pre_tb.append({"accountIndex": 1, "mint": mint, "owner": signer,
                       "uiTokenAmount": {"amount": str(start), "decimals": decimals}})
        post_tb.append({"accountIndex": 1, "mint": mint, "owner": signer,
                        "uiTokenAmount": {"amount": str(start + int(token_change * 10**decimals)), "decimals": decimals}})
    if wsol_change:
        pre_tb.append({"accountIndex": 2, "mint": WSOL_MINT, "owner": signer,
                       "uiTokenAmount": {"amount": "0", "decimals": 9}})
        post_tb.append({"accountIndex": 2, "mint": WSOL_MINT, "owner": signer,
                        "uiTokenAmount": {"amount": str(int(wsol_change * 1e9)), "decimals": 9}})
    return {
        "slot": slot, "blockTime": 1_700_000_000 + slot,
        "transaction": {"signatures": [f"sig{slot}{signer[:3]}"],
                        "message": {"accountKeys": [{"pubkey": signer, "signer": True},
                                                    {"pubkey": "ata", "signer": False}]}},
        "meta": {"err": err, "fee": 5000, "preBalances": [pre_l, 0], "postBalances": [post_l, 0],
                 "preTokenBalances": pre_tb, "postTokenBalances": post_tb},
    }


def test_parse_buy_and_sell():
    buy = parse_swaps(make_tx("Alice", -1.5, 50_000))
    assert len(buy) == 1 and buy[0].side == "buy"
    assert abs(buy[0].sol_amount - 1.5) < 1e-6 and buy[0].token_amount == 50_000
    sell = parse_swaps(make_tx("Alice", 3.0, -50_000))
    assert sell[0].side == "sell" and abs(sell[0].sol_amount - 3.0) < 1e-6


def test_parse_wsol_quote_and_failed_tx():
    sw = parse_swaps(make_tx("Bob", 0, -1000, wsol_change=0.8))
    assert sw[0].side == "sell" and abs(sw[0].sol_amount - 0.8) < 1e-6
    assert parse_swaps(make_tx("Bob", -1, 10, err={"x": 1})) == []
    assert parse_swaps(make_tx("Bob", 0, 0)) == []  # no token change


def S(w, side, t_slot, sol=1.0, tok=1000.0):
    return Swap(f"s{w}{t_slot}", w, MINT, side, tok, sol, t_slot, 0)


def test_launch_detects_snipers_and_bundles():
    swaps = [S("dev", "buy", 1000), S("snipe1", "buy", 1001), S("snipe2", "buy", 1002),
             S("b1", "buy", 1010), S("b2", "buy", 1010), S("b3", "buy", 1010),
             S("late", "buy", 1200), S("late", "buy", 1300), S("x", "sell", 1301)]
    la = early_buyers.analyze_launch(MINT, swaps, max_buyers=50, creator="dev")
    assert [b.wallet for b in la.buyers][:3] == ["dev", "snipe1", "snipe2"]
    assert set(la.snipers) == {"snipe1", "snipe2"}
    assert la.bundles == [["b1", "b2", "b3"]]
    late = next(b for b in la.buyers if b.wallet == "late")
    assert late.sol_spent == 2.0 and not late.sniper
    assert la.buyers[0].creator


def test_sniper_holdings_from_rugcheck():
    la = early_buyers.analyze_launch(MINT, [S("a", "buy", 1), S("b", "buy", 2)], 10)
    rug = {"topHolders": [{"owner": "a", "pct": 4.0}, {"owner": "zzz", "pct": 9.0}]}
    assert early_buyers.sniper_holdings_pct(la, rug) == 4.0


def pair(**kw):
    p = {"baseToken": {"address": MINT, "symbol": "GOOD", "name": "Good"}, "pairAddress": POOL,
         "dexId": "raydium", "priceUsd": "0.001", "marketCap": 500_000, "liquidity": {"usd": 80_000},
         "volume": {"h1": 60_000, "h24": 400_000}, "priceChange": {"m5": 3, "h1": 25, "h24": 120},
         "txns": {"h1": {"buys": 300, "sells": 200}},
         "pairCreatedAt": (time.time() - 3 * 3600) * 1000,
         "info": {"socials": [{"type": "twitter", "url": "x"}]}}
    p.update(kw)
    return p


def rug(**kw):
    r = {"mintAuthority": None, "freezeAuthority": None, "rugged": False, "totalHolders": 900,
         "creator": "dev", "tokenMeta": {"mutable": False},
         "markets": [{"pubkey": POOL, "lp": {"lpLockedPct": 100}}],
         "knownAccounts": {"poolAuth": {"type": "AMM", "name": "Raydium"}},
         "topHolders": [{"address": "h0", "owner": "poolAuth", "pct": 20}] +
                       [{"address": f"h{i}", "owner": f"w{i}", "pct": 2.0} for i in range(1, 12)],
         "risks": []}
    r.update(kw)
    return r


def test_safe_token_is_good_entry():
    rep = safety.evaluate(MINT, pair(), rug(), Settings(), socials=True)
    assert rep.verdict == "GOOD ENTRY", rep.summary_lines()
    assert abs(rep.top10_pct - 20.0) < 1e-9  # pool excluded
    assert not rep.hard_fails


def test_mint_authority_is_avoid():
    rep = safety.evaluate(MINT, pair(), rug(mintAuthority="DevKey123456"), Settings(), socials=True)
    assert rep.verdict == "AVOID"


def test_unlocked_lp_and_concentration_fail():
    r = rug(markets=[{"pubkey": POOL, "lp": {"lpLockedPct": 10}}],
            topHolders=[{"address": "a", "owner": "whale", "pct": 55}])
    rep = safety.evaluate(MINT, pair(), r, Settings(), socials=True)
    names = {c.name for c in rep.hard_fails}
    assert {"LP locked", "Top 10 holders", "Largest holder"} <= names


def test_honeypot_no_sells():
    rep = safety.evaluate(MINT, pair(txns={"h1": {"buys": 200, "sells": 0}}), rug(), Settings(), socials=True)
    assert rep.verdict == "AVOID"


def test_missing_rugcheck_is_unverified():
    rep = safety.evaluate(MINT, pair(), None, Settings(), socials=True)
    assert rep.verdict == "UNVERIFIED"


def test_sniper_supply_fail():
    la = early_buyers.LaunchAnalysis(MINT, snipers=["a"], sniper_hold_pct=30.0)
    rep = safety.evaluate(MINT, pair(), rug(), Settings(), launch=la, socials=True)
    assert any(c.name == "Sniper/bundle supply" for c in rep.hard_fails)


def test_wallet_profile_and_ranking():
    m2 = "Mint2"
    swaps = [Swap("1", "W", MINT, "buy", 1000, 1.0, 0, 100), Swap("2", "W", MINT, "sell", 1000, 5.0, 0, 4000),
             Swap("3", "W", m2, "buy", 10, 2.0, 0, 200), Swap("4", "W", m2, "sell", 10, 1.0, 0, 9000)]
    p = wallets.build_profile("W", swaps, [100, 4000, 9000, 200])
    assert p.closed == 2 and p.wins == 1 and abs(p.realized_pnl - 3.0) < 1e-9
    assert p.best_trade_x == 5.0 and not p.is_bot

    la1 = early_buyers.analyze_launch(MINT, [S("W", "buy", 1), S("Z", "buy", 50)], 10)
    la2 = early_buyers.LaunchAnalysis(m2, buyers=[early_buyers.EarlyBuyer("W", 2, 0, 1, 1)])
    cands = wallets.collect_candidates([("A", la1), ("B", la2)])
    cands["W"].profile = p
    ranked = wallets.rank_candidates(cands, 2, 10)
    assert ranked[0].address == "W" and "INSIDER?" in ranked[0].tags


def test_bot_detection():
    swaps = []
    for i in range(10):
        swaps += [Swap(f"b{i}", "B", f"m{i}", "buy", 1, 1, 0, 1000 + i * 30),
                  Swap(f"s{i}", "B", f"m{i}", "sell", 1, 1.01, 0, 1005 + i * 30)]
    p = wallets.build_profile("B", swaps, [1000 + i for i in range(500)])
    assert p.is_bot
