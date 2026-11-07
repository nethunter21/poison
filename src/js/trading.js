/* Poison Terminal — paper trading engine
 * Fills are computed against the pool's constant-product reserves (x·y=k) at landing time, with:
 *   - platform fee (% of trade), DEX/LP fee, Solana base fee + priority fee
 *   - simulated landing latency; tx fails (fees still paid) if price moved beyond slippage tolerance
 */
(function (P) {
  const U = P.U, S = P.S;
  const BASE_FEE = 0.000005;
  const ev = U.emitter();

  const fresh = (bal) => ({ sol: bal, start: bal, positions: {}, history: [], createdAt: Date.now() });
  let st = U.store.get('portfolio', null) || fresh(S.get('startBalance'));
  const save = U.debounce(() => U.store.set('portfolio', st), 300);

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

  function sol() { return P.Data.solUsd || 0; }

  T.quote = (t, side, amount) => {
    const solUsd = sol();
    if (!t || !(t.price > 0) || !(solUsd > 0) || !(amount > 0)) return null;
    const { Q, B } = P.Data.reserves(t);
    const pf = S.get('platformFee') / 100, f = S.get('dexFee') / 100, prio = +S.get('priorityFee') || 0;
    const spot = Q / B;
    if (side === 'buy') {
      const platform = amount * pf;
      const usdIn = (amount - platform) * solUsd;
      const inEff = usdIn * (1 - f);
      const out = (B * inEff) / (Q + inEff);
      const avg = usdIn / out;
      return { side, amount, out, usdIn, platform, network: prio + BASE_FEE, total: amount + prio + BASE_FEE, impact: (avg / spot - 1) * 100, avg, Q2: Q + inEff + usdIn * f, B2: B - out, spot };
    } else {
      const inEff = amount * (1 - f);
      const usdOut = (Q * inEff) / (B + inEff);
      const gross = usdOut / solUsd;
      const platform = gross * pf;
      const net = gross - platform - prio - BASE_FEE;
      const avg = usdOut / amount;
      return { side, amount, gross, usdOut, platform, network: prio + BASE_FEE, out: net, impact: (1 - avg / spot) * 100, avg, Q2: Q - usdOut, B2: B + amount, spot };
    }
  };

  T.metrics = (p, t) => {
    t = t || P.Data.get(p.address);
    const price = t && t.price > 0 ? t.price : p.lastPrice || 0;
    const solUsd = sol() || p.lastSolUsd || 1;
    const value = (p.tokens * price) / solUsd;
    const unreal = value - p.costSol;
    const total = p.sold + value - p.invested;
    const supply = p.supply || (t && t.mc && t.price ? t.mc / t.price : 1e9);
    const avgEntry = p.boughtTokens > 0 ? p.investedUsd / p.boughtTokens : 0;
    return {
      price, value, valueUsd: value * solUsd, unreal, unrealPct: p.costSol > 0 ? (unreal / p.costSol) * 100 : 0,
      total, totalUsd: total * solUsd, totalPct: p.invested > 0 ? (total / p.invested) * 100 : 0,
      avgEntry, avgEntryMc: avgEntry * supply, mc: price * supply, supply
    };
  };

  T.stats = () => {
    let holding = 0, wins = 0, losses = 0, vol = 0;
    for (const p of Object.values(st.positions)) {
      const m = T.metrics(p);
      holding += p.tokens > 0 ? m.value : 0;
      if (p.tokens <= 0 && p.sells > 0) (m.total >= 0 ? wins++ : losses++);
    }
    for (const h of st.history) if (h.status === 'ok') vol += h.sol;
    const portfolio = st.sol + holding;
    return { sol: st.sol, holding, portfolio, pnl: portfolio - st.start, pnlPct: st.start ? ((portfolio - st.start) / st.start) * 100 : 0, wins, losses, winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0, volume: vol };
  };

  function ensurePos(t) {
    let p = st.positions[t.address];
    if (!p) {
      p = st.positions[t.address] = {
        address: t.address, pair: t.pair, symbol: t.symbol, name: t.name, image: t.image, sim: !!t.sim,
        tokens: 0, costSol: 0, invested: 0, investedUsd: 0, boughtTokens: 0, sold: 0, buys: 0, sells: 0,
        firstAt: Date.now(), lastAt: Date.now(), rules: null, supply: t.mc && t.price ? t.mc / t.price : 1e9
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
    const solUsd = sol();
    if (!(solUsd > 0)) throw new Error('Waiting for SOL price');
    if (!(t.price > 0)) throw new Error('No price for token');
    let qty;
    if (side === 'buy') {
      qty = +amount;
      if (!(qty > 0)) throw new Error('Enter an amount');
      const need = qty + (+S.get('priorityFee') || 0) + BASE_FEE;
      if (need > st.sol + 1e-12) throw new Error(`Insufficient balance (${U.fmtSol(st.sol)})`);
    } else {
      const p = st.positions[t.address];
      if (!p || p.tokens <= 0) throw new Error('No ' + t.symbol + ' to sell');
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
      const prio = (+S.get('priorityFee') || 0) + BASE_FEE;
      const p = ensurePos(live);
      const base = { id: U.uid(), t: Date.now(), side, address: live.address, symbol: live.symbol, latency: Math.round(lat) };
      const moved = side === 'buy' ? q1.out < q0.out * (1 - slip) : q1.usdOut < q0.usdOut * (1 - slip);
      if (!q1 || moved) {
        st.sol -= prio;
        log({ ...base, status: 'failed', reason: 'Slippage exceeded', sol: 0, fee: prio, tokens: 0, price: live.price, mc: live.mc });
        changed();
        const err = new Error(`Slippage exceeded (${S.get('slippage')}%) — fee ${prio.toFixed(6)} SOL paid`);
        err.failed = true; throw err;
      }
      let res;
      if (side === 'buy') {
        st.sol -= q1.total;
        p.tokens += q1.out; p.costSol += q1.total; p.invested += q1.total; p.investedUsd += q1.total * solUsd; p.boughtTokens += q1.out;
        p.buys++; p.lastAt = Date.now(); p.lastPrice = q1.avg; p.lastSolUsd = solUsd;
        if (live.mc && live.price) p.supply = live.mc / live.price;
        if (!p.rules && S.get('autoTpSl')) p.rules = { tp: { pct: S.get('tp'), sell: S.get('tpSell'), done: false }, sl: { pct: S.get('sl'), sell: S.get('slSell'), done: false } };
        res = { ...base, status: 'ok', sol: q1.total, tokens: q1.out, price: q1.avg, mc: q1.avg * p.supply, fee: q1.platform + q1.network, impact: q1.impact };
      } else {
        const frac = qty / p.tokens;
        const basis = p.costSol * frac;
        st.sol += q1.out;
        p.tokens = Math.max(0, p.tokens - qty); if (p.tokens < 1e-9) p.tokens = 0;
        p.costSol = Math.max(0, p.costSol - basis); p.sold += q1.out; p.sells++; p.lastAt = Date.now(); p.lastPrice = q1.avg; p.lastSolUsd = solUsd;
        if (p.tokens === 0) { p.costSol = 0; p.closedAt = Date.now(); }
        res = { ...base, status: 'ok', sol: q1.out, tokens: qty, price: q1.avg, mc: q1.avg * p.supply, fee: q1.platform + q1.network, impact: q1.impact, pnl: q1.out - basis, pnlPct: basis ? ((q1.out - basis) / basis) * 100 : 0 };
      }
      log(res);
      P.Data.simImpact(live, side, q1.Q2, q1.B2, side === 'buy' ? q1.usdIn : q1.usdOut, side === 'buy' ? q1.out : qty);
      changed();
      ev.emit('fill', res);
      return res;
    } finally {
      T.busy.delete(key); ev.emit('pending', null);
    }
  };

  T.setRules = (addr, rules) => { const p = st.positions[addr]; if (p) { p.rules = rules; changed(); } };
  T.removePosition = (addr) => { delete st.positions[addr]; changed(); };

  // TP / SL automation
  T.checkRules = () => {
    for (const p of T.held()) {
      if (!p.rules) continue;
      const t = P.Data.get(p.address); if (!t) continue;
      const m = T.metrics(p, t);
      const r = p.rules;
      const fire = (rule, label) => {
        rule.done = true; changed();
        T.execute(t, 'sell', rule.sell).then((res) => ev.emit('auto', { label, res, p })).catch((e) => { rule.done = false; ev.emit('autoErr', { label, e, p }); });
      };
      if (r.tp && !r.tp.done && m.unrealPct >= r.tp.pct) fire(r.tp, 'Take profit');
      else if (r.sl && !r.sl.done && m.unrealPct <= r.sl.pct) fire(r.sl, 'Stop loss');
    }
  };
})(window.P);
