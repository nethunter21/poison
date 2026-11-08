/* Poison Terminal — paper trading engine (offline training)
 * Orders execute inside the simulated pool (bonding curve or PumpSwap AMM), so your size moves the price.
 *   - platform fee (% of trade) + pool fee (pump.fun curve 1%, PumpSwap 0.25%) + base fee + priority fee
 *   - simulated landing latency; tx fails (fees still paid) if price moved beyond slippage tolerance
 *   - honeypots (freeze authority) reject your sells, exactly like the real thing
 */
(function (P) {
  const U = P.U, S = P.S;
  const BASE_FEE = 0.000005;
  const ev = U.emitter();

  const fresh = (bal) => ({ v: 2, sol: bal, start: bal, positions: {}, history: [], createdAt: Date.now(), rugsEaten: 0 });
  let st = U.store.get('portfolio', null);
  if (!st || st.v !== 2) st = fresh(S.get('startBalance')); // v1 portfolios referenced live coins
  const save = U.debounce(() => U.store.set('portfolio', st), 400);

  const T = (P.Trade = {
    on: ev.on,
    state: () => st,
    balance: () => st.sol,
    pos: (addr) => st.positions[addr],
    positions: () => Object.values(st.positions),
    held: () => Object.values(st.positions).filter((p) => p.tokens > 0),
    heldAddresses: () => Object.values(st.positions).filter((p) => p.tokens > 0).map((p) => p.address),
    history: () => st.history,
    busy: new Set()
  });

  function changed() { save(); ev.emit('change'); }
  T.reset = (bal) => { st = fresh(+bal || S.get('startBalance')); changed(); };
  T.deposit = (amt) => { st.sol += amt; st.start += amt; changed(); };
  const sol = () => P.Data.solUsd || 0;

  T.quote = (t, side, amount) => {
    if (!t || !(t.priceSol > 0) || !(amount > 0)) return null;
    const { Q, B, fee } = P.Data.reserves(t);
    const pf = S.get('platformFee') / 100, prio = +S.get('priorityFee') || 0;
    const spot = Q / B, su = sol();
    if (side === 'buy') {
      const platform = amount * pf;
      const toPool = amount - platform;
      const inn = toPool * (1 - fee);
      const out = (B * inn) / (Q + inn);
      const avg = toPool / out;
      return { side, amount, toPool, out, platform, poolFee: toPool * fee, network: prio + BASE_FEE, total: amount + prio + BASE_FEE, impact: (avg / spot - 1) * 100, avg, avgUsd: avg * su, spot };
    }
    const gross = (Q * amount) / (B + amount);
    const afterPool = gross * (1 - fee);
    const platform = afterPool * pf;
    const net = afterPool - platform - prio - BASE_FEE;
    const avg = afterPool / amount;
    return { side, amount, gross, afterPool, platform, poolFee: gross * fee, network: prio + BASE_FEE, out: net, usdOut: net * su, impact: (1 - avg / spot) * 100, avg, avgUsd: avg * su, spot };
  };

  T.metrics = (p, t) => {
    t = t || P.Data.get(p.address);
    const ps = t && t.priceSol > 0 ? t.priceSol : p.lastPriceSol || 0;
    const su = sol() || 1;
    const value = p.tokens * ps;
    const unreal = value - p.costSol;
    const total = p.sold + value - p.invested;
    const avgEntry = p.boughtTokens > 0 ? p.investedPool / p.boughtTokens : 0; // SOL per token
    return {
      priceSol: ps, price: ps * su, value, valueUsd: value * su, unreal, unrealPct: p.costSol > 0 ? (unreal / p.costSol) * 100 : 0,
      total, totalUsd: total * su, totalPct: p.invested > 0 ? (total / p.invested) * 100 : 0,
      avgEntry: avgEntry * su, avgEntryMc: avgEntry * su * 1e9, mc: ps * su * 1e9, supply: 1e9, peakPct: p.peakPct || 0
    };
  };

  T.stats = () => {
    let holding = 0, wins = 0, losses = 0, vol = 0, trades = 0;
    for (const p of Object.values(st.positions)) {
      const m = T.metrics(p);
      if (p.tokens > 0) holding += m.value;
      if (p.tokens <= 0 && p.sells > 0) (m.total >= 0 ? wins++ : losses++);
    }
    for (const h of st.history) if (h.status === 'ok') { vol += h.sol; trades++; }
    const portfolio = st.sol + holding;
    return { sol: st.sol, holding, portfolio, pnl: portfolio - st.start, pnlPct: st.start ? ((portfolio - st.start) / st.start) * 100 : 0, wins, losses, winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0, volume: vol, trades, rugsEaten: st.rugsEaten || 0, coins: Object.keys(st.positions).length };
  };

  function ensurePos(t) {
    let p = st.positions[t.address];
    if (!p) {
      p = st.positions[t.address] = {
        address: t.address, symbol: t.symbol, name: t.name, emoji: t.emoji, image: null,
        tokens: 0, costSol: 0, invested: 0, investedPool: 0, boughtTokens: 0, sold: 0, buys: 0, sells: 0,
        firstAt: Date.now(), lastAt: Date.now(), rules: null, supply: 1e9, entryMc: t.mc
      };
    }
    return p;
  }
  function log(entry) { st.history.unshift(entry); if (st.history.length > 500) st.history.length = 500; }

  // amount: SOL for buys, % of holdings (0-100) for sells
  T.execute = async (t, side, amount) => {
    if (!t) throw new Error('No token selected');
    const key = t.address + side;
    if (T.busy.has(key)) throw new Error('Order already in flight');
    if (!(t.priceSol > 0)) throw new Error('No price for token');
    let qty;
    const prio = (+S.get('priorityFee') || 0) + BASE_FEE;
    if (side === 'buy') {
      qty = +amount;
      if (!(qty > 0)) throw new Error('Enter an amount');
      if (qty + prio > st.sol + 1e-12) throw new Error(`Insufficient balance (${U.fmtSol(st.sol)})`);
    } else {
      const p = st.positions[t.address];
      if (!p || p.tokens <= 0) throw new Error('No $' + t.symbol + ' to sell');
      const pct = U.clamp(+amount, 0, 100);
      if (!(pct > 0)) throw new Error('Enter a sell %');
      qty = pct >= 99.999 ? p.tokens : p.tokens * (pct / 100);
    }
    const q0 = T.quote(t, side, qty);
    if (!q0 || !(q0.out > 0)) throw new Error('Pool too thin for this size');
    T.busy.add(key); ev.emit('pending', { address: t.address, side });
    try {
      const lat = U.rand(S.get('latencyMin'), S.get('latencyMax'));
      await U.sleep(lat);
      const live = P.Data.get(t.address) || t;
      const q1 = T.quote(live, side, qty);
      const slip = S.get('slippage') / 100;
      const p = ensurePos(live);
      const base = { id: U.uid(), t: Date.now(), side, address: live.address, symbol: live.symbol, emoji: live.emoji, latency: Math.round(lat) };
      const fail = (reason, msg) => {
        st.sol -= prio;
        log({ ...base, status: 'failed', reason, sol: 0, fee: prio, tokens: 0, price: live.price, mc: live.mc });
        changed();
        const err = new Error(msg + ` — fee ${prio.toFixed(6)} SOL paid`); err.failed = true; throw err;
      };
      if (side === 'sell' && !P.Data.canSell(live)) fail('Account frozen', 'Sell failed: token account is frozen (freeze authority enabled)');
      if (!q1 || (side === 'buy' ? q1.out < q0.out * (1 - slip) : q1.afterPool < q0.afterPool * (1 - slip))) fail('Slippage exceeded', `Slippage exceeded (${S.get('slippage')}%)`);
      let res;
      if (side === 'buy') {
        const fill = P.Data.userFill(live, 'buy', q1.toPool);
        st.sol -= q1.total;
        p.tokens += fill.tok; p.costSol += q1.total; p.invested += q1.total; p.investedPool += q1.toPool; p.boughtTokens += fill.tok;
        p.buys++; p.lastAt = Date.now(); p.lastPriceSol = live.priceSol;
        if (p.buys === 1) { p.fate = live.fate; p.entryMc = live.mc; }
        if (!p.rules && S.get('autoTpSl')) p.rules = defaultRules(true, true);
        res = { ...base, status: 'ok', sol: q1.total, tokens: fill.tok, price: (q1.toPool / fill.tok) * sol(), mc: (q1.toPool / fill.tok) * sol() * 1e9, fee: q1.platform + q1.poolFee + q1.network, impact: q1.impact };
      } else {
        const frac = qty / p.tokens;
        const basis = p.costSol * frac;
        const fill = P.Data.userFill(live, 'sell', qty);
        const net = fill.sol * (1 - S.get('platformFee') / 100) - prio;
        st.sol += net;
        p.tokens = Math.max(0, p.tokens - fill.tok); if (p.tokens < 1e-6) p.tokens = 0;
        p.costSol = Math.max(0, p.costSol - basis); p.sold += net; p.sells++; p.lastAt = Date.now(); p.lastPriceSol = live.priceSol;
        if (p.tokens === 0) { p.costSol = 0; p.closedAt = Date.now(); }
        res = { ...base, status: 'ok', sol: net, tokens: fill.tok, price: (fill.sol / fill.tok) * sol(), mc: (fill.sol / fill.tok) * sol() * 1e9, fee: q1.platform + q1.poolFee + q1.network, impact: q1.impact, pnl: net - basis, pnlPct: basis ? ((net - basis) / basis) * 100 : 0 };
      }
      log(res);
      changed();
      ev.emit('fill', res);
      return res;
    } finally {
      T.busy.delete(key); ev.emit('pending', null);
    }
  };

  // ---------------------------------------------------------- TP / SL
  function defaultRules(tpOn, slOn) {
    return {
      tp: { on: !!tpOn, pct: S.get('tp'), sell: S.get('tpSell'), done: false },
      sl: { on: !!slOn, pct: -Math.abs(S.get('sl')), sell: S.get('slSell'), done: false, trail: !!S.get('slTrail') }
    };
  }
  T.defaultRules = defaultRules;
  T.setRules = (addr, rules) => { const p = st.positions[addr]; if (p) { p.rules = rules; changed(); } };
  T.toggleRule = (addr, which, force) => {
    const p = st.positions[addr]; if (!p || p.tokens <= 0) return null;
    if (!p.rules) p.rules = defaultRules(false, false);
    const r = p.rules[which];
    r.on = force != null ? force : !r.on; r.done = false;
    if (which === 'sl') { p.peakPct = T.metrics(p).unrealPct; }
    changed();
    return r;
  };
  T.breakeven = (addr) => {
    const p = st.positions[addr]; if (!p || p.tokens <= 0) return null;
    if (!p.rules) p.rules = defaultRules(false, false);
    Object.assign(p.rules.sl, { on: true, pct: 0, sell: 100, done: false, trail: false });
    changed();
    return p.rules.sl;
  };
  T.removePosition = (addr) => { delete st.positions[addr]; changed(); };
  T.markRug = (addr) => { const p = st.positions[addr]; if (p && p.tokens > 0 && !p.rugged) { p.rugged = true; st.rugsEaten = (st.rugsEaten || 0) + 1; changed(); } };

  T.checkRules = () => {
    for (const p of T.held()) {
      if (!p.rules) continue;
      const t = P.Data.get(p.address); if (!t) continue;
      const m = T.metrics(p, t);
      const r = p.rules;
      if (r.sl && r.sl.trail) p.peakPct = Math.max(p.peakPct ?? m.unrealPct, m.unrealPct);
      const fire = (rule, label) => {
        rule.done = true; changed();
        T.execute(t, 'sell', rule.sell).then((res) => ev.emit('auto', { label, res, p })).catch((e) => { if (!e.failed || !/frozen/.test(e.message)) rule.done = false; ev.emit('autoErr', { label, e, p }); });
      };
      if (r.tp && r.tp.on && !r.tp.done && m.unrealPct >= r.tp.pct) fire(r.tp, 'Take profit');
      else if (r.sl && r.sl.on && !r.sl.done) {
        const trigger = r.sl.trail ? (p.peakPct ?? 0) + r.sl.pct : r.sl.pct;
        if (m.unrealPct <= trigger) fire(r.sl, r.sl.trail ? 'Trailing stop' : 'Stop loss');
      }
    }
  };
})(window.P);
