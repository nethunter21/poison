/* Poison Terminal — market data
 *  LIVE: DexScreener (pairs, SOL price, search, socials) + GeckoTerminal (trending/new pools, OHLCV, trades)
 *  SIM : constant-product AMM market simulator (used when offline or chosen in settings)
 */
(function (P) {
  const U = P.U;
  const DS = 'https://api.dexscreener.com';
  const GT = 'https://api.geckoterminal.com/api/v2';
  const GT_H = { Accept: 'application/json;version=20230302' };
  const SOL_MINT = 'So11111111111111111111111111111111111111112';

  const ev = U.emitter();
  const D = (P.Data = {
    mode: 'live',
    solUsd: 0,
    tokens: new Map(), // address -> token
    lists: { trending: [], new: [] },
    selected: null,
    on: ev.on,
    emit: ev.emit,
    get: (addr) => D.tokens.get(addr)
  });

  // ---------------------------------------------------------------- network
  async function getJson(url, headers) {
    const t0 = performance.now();
    let j;
    if (window.native && window.native.json) j = await window.native.json(url, headers);
    else {
      const r = await fetch(url, { headers: headers || {} });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      j = await r.json();
    }
    D.latency = Math.round(performance.now() - t0);
    return j;
  }
  // Rate-limited, de-duplicated queue (GeckoTerminal free tier ≈ 30 req/min)
  function makeQueue(gapMs) {
    let last = 0, chain = Promise.resolve();
    const pending = new Map();
    return (key, url, headers) => {
      if (pending.has(key)) return pending.get(key);
      const p = chain.then(async () => {
        const wait = last + gapMs - Date.now();
        if (wait > 0) await U.sleep(wait);
        last = Date.now();
        return getJson(url, headers);
      });
      pending.set(key, p);
      const done = () => pending.delete(key);
      p.then(done, done);
      chain = p.catch(() => {});
      return p;
    };
  }
  const gtq = makeQueue(2150);
  const dsq = makeQueue(220);
  const gt = (key, path) => gtq(key, GT + path, GT_H);
  const ds = (key, path) => dsq(key, DS + path);

  // ---------------------------------------------------------------- normalizers
  function emptyTx() { return { buys: 0, sells: 0 }; }
  function fromDexPair(p) {
    const info = p.info || {};
    return {
      address: p.baseToken.address,
      pair: p.pairAddress,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      image: info.imageUrl || null,
      dex: p.dexId,
      quote: p.quoteToken && p.quoteToken.symbol,
      price: +p.priceUsd || 0,
      priceNative: +p.priceNative || 0,
      mc: +p.marketCap || +p.fdv || 0,
      fdv: +p.fdv || 0,
      liq: (p.liquidity && +p.liquidity.usd) || 0,
      vol: { m5: +(p.volume?.m5 || 0), h1: +(p.volume?.h1 || 0), h6: +(p.volume?.h6 || 0), h24: +(p.volume?.h24 || 0) },
      chg: { m5: +(p.priceChange?.m5 || 0), h1: +(p.priceChange?.h1 || 0), h6: +(p.priceChange?.h6 || 0), h24: +(p.priceChange?.h24 || 0) },
      txns: { m5: p.txns?.m5 || emptyTx(), h1: p.txns?.h1 || emptyTx(), h6: p.txns?.h6 || emptyTx(), h24: p.txns?.h24 || emptyTx() },
      createdAt: p.pairCreatedAt || 0,
      socials: info.socials || [],
      websites: info.websites || [],
      url: p.url,
      enriched: true
    };
  }
  function fromGeckoPool(pool, incl) {
    const a = pool.attributes || {};
    const bid = pool.relationships?.base_token?.data?.id || '';
    const bt = (incl[bid] && incl[bid].attributes) || {};
    const pc = a.price_change_percentage || {}, vol = a.volume_usd || {}, tx = a.transactions || {};
    const tx2 = (o) => ({ buys: (o && o.buys) || 0, sells: (o && o.sells) || 0 });
    const img = bt.image_url && !/missing/.test(bt.image_url) ? bt.image_url : null;
    return {
      address: bt.address || bid.replace(/^solana_/, ''),
      pair: a.address,
      symbol: bt.symbol || String(a.name || '?').split(' / ')[0],
      name: bt.name || String(a.name || '?').split(' / ')[0],
      image: img,
      dex: (pool.relationships?.dex?.data?.id || '').replace(/-/g, ' '),
      quote: String(a.name || '').split(' / ')[1] || 'SOL',
      price: +a.base_token_price_usd || 0,
      priceNative: +a.base_token_price_native_currency || 0,
      mc: +a.market_cap_usd || +a.fdv_usd || 0,
      fdv: +a.fdv_usd || 0,
      liq: +a.reserve_in_usd || 0,
      vol: { m5: +vol.m5 || 0, h1: +vol.h1 || 0, h6: +vol.h6 || 0, h24: +vol.h24 || 0 },
      chg: { m5: +pc.m5 || 0, h1: +pc.h1 || 0, h6: +pc.h6 || 0, h24: +pc.h24 || 0 },
      txns: { m5: tx2(tx.m5), h1: tx2(tx.h1), h6: tx2(tx.h6), h24: tx2(tx.h24) },
      createdAt: Date.parse(a.pool_created_at) || 0,
      socials: [], websites: [],
      url: 'https://dexscreener.com/solana/' + a.address
    };
  }
  function includedMap(j) { const m = {}; (j.included || []).forEach((x) => (m[x.id] = x)); return m; }

  // merge into cache keeping richer fields
  function upsert(t) {
    if (!t || !t.address) return null;
    const old = D.tokens.get(t.address);
    if (!old) { t.updatedAt = Date.now(); t.ticks = [t.price]; D.tokens.set(t.address, t); return t; }
    const prevPrice = old.price;
    for (const k of Object.keys(t)) {
      const v = t[k];
      if (v == null || v === '' || (Array.isArray(v) && !v.length && old[k] && old[k].length)) continue;
      if ((k === 'liq' || k === 'mc' || k === 'createdAt') && !v && old[k]) continue;
      // don't let a lower-liquidity pair replace a better one unless it's the same pair
      if (k === 'pair' && old.pair && v !== old.pair && t.liq < old.liq * 0.8) return old;
      old[k] = v;
    }
    old.prevPrice = prevPrice;
    old.updatedAt = Date.now();
    if (old.price !== prevPrice) { old.ticks = (old.ticks || []).concat(old.price).slice(-40); }
    return old;
  }
  D.upsert = upsert;

  // pool reserves model used by the trading engine (USD quote reserve)
  D.reserves = (t) => {
    if (t.sim) return { Q: t.Q, B: t.B };
    let Q = t.liq > 0 ? t.liq / 2 : t.mc * 0.9; // bonding-curve tokens: virtual quote reserve ≈ mcap
    Q = Math.max(Q, 500);
    return { Q, B: Q / (t.price || 1e-12) };
  };

  // ---------------------------------------------------------------- status
  function status(ok, text) { D.ok = ok; ev.emit('status', { ok, text, latency: D.latency, mode: D.mode }); }

  // ================================================================ LIVE
  const Live = {
    timers: [],
    async start() {
      status(null, 'connecting to Solana feeds…');
      await Promise.all([this.sol(), this.lists()]);
      if (!D.lists.trending.length && !D.lists.new.length) throw new Error('no data');
      this.timers.push(setInterval(() => this.sol(), 20000));
      this.timers.push(setInterval(() => this.lists(), 16000));
      this.timers.push(setInterval(() => this.detail(), 2000));
      this.timers.push(setInterval(() => this.trades(), 6500));
      this.timers.push(setInterval(() => this.holdings(), 7000));
      status(true, 'live · DexScreener + GeckoTerminal');
    },
    stop() { this.timers.forEach(clearInterval); this.timers = []; },
    async sol() {
      try {
        const j = await ds('sol', '/latest/dex/tokens/' + SOL_MINT);
        const pairs = (j.pairs || []).filter((p) => p.chainId === 'solana' && p.baseToken.address === SOL_MINT && /^(USDC|USDT)$/.test(p.quoteToken.symbol));
        pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        if (pairs[0]) { D.solUsd = +pairs[0].priceUsd; ev.emit('sol', D.solUsd); }
      } catch (e) { console.warn('sol', e); }
    },
    async lists() {
      const run = async (key, path) => {
        try {
          const j = await gt(key, path);
          const inc = includedMap(j);
          return (j.data || []).map((p) => upsert(fromGeckoPool(p, inc))).filter((t) => t && t.price > 0);
        } catch (e) { console.warn(key, e); status(false, 'feed error: ' + e.message); return null; }
      };
      const [tr, nw] = await Promise.all([
        run('trending', '/networks/solana/trending_pools?include=base_token&page=1'),
        run('new', '/networks/solana/new_pools?include=base_token&page=1')
      ]);
      if (tr) D.lists.trending = dedupe(tr);
      if (nw) D.lists.new = dedupe(nw);
      if (tr || nw) { status(true, 'live · DexScreener + GeckoTerminal'); ev.emit('lists'); this.enrich(); }
    },
    async enrich() {
      // socials + better pair data from DexScreener (30 tokens per call)
      const need = [...D.lists.trending, ...D.lists.new].filter((t) => !t.enriched).map((t) => t.address).slice(0, 30);
      if (!need.length) return;
      try {
        const arr = await ds('enrich:' + need[0], '/tokens/v1/solana/' + need.join(','));
        applyPairs(arr);
        need.forEach((a) => { const t = D.tokens.get(a); if (t) t.enriched = true; });
        ev.emit('lists');
      } catch (e) { console.warn('enrich', e); }
    },
    async detail() {
      const t = D.selected; if (!t || t.sim) return;
      try {
        const j = await ds('pair', '/latest/dex/pairs/solana/' + t.pair);
        const p = (j.pairs && j.pairs[0]) || j.pair;
        if (!p) return;
        const u = upsert(fromDexPair(p));
        if (u && D.selected === u) {
          ev.emit('token', u);
          ev.emit('tick', { price: u.price, t: Date.now(), v: 0 });
          ev.emit('tokens');
        }
        status(true, 'live · DexScreener + GeckoTerminal');
      } catch (e) { status(false, 'pair update failed'); }
    },
    seen: new Set(),
    async trades(first) {
      const t = D.selected; if (!t || t.sim) return;
      const pair = t.pair;
      try {
        const j = await gt('trades', `/networks/solana/pools/${pair}/trades`);
        if (!D.selected || D.selected.pair !== pair) return;
        const out = [];
        for (const x of j.data || []) {
          const a = x.attributes;
          if (this.seen.has(a.tx_hash + a.kind)) continue;
          this.seen.add(a.tx_hash + a.kind);
          const buy = a.kind === 'buy';
          out.push({
            id: a.tx_hash, t: Date.parse(a.block_timestamp), side: buy ? 'buy' : 'sell',
            usd: +a.volume_in_usd || 0,
            amount: buy ? +a.to_token_amount : +a.from_token_amount,
            price: buy ? +a.price_to_in_usd : +a.price_from_in_usd,
            maker: a.tx_from_address
          });
        }
        if (this.seen.size > 5000) this.seen = new Set([...this.seen].slice(-2000));
        out.sort((a, b) => a.t - b.t);
        if (out.length) ev.emit('trades', out, !!first);
      } catch (e) { console.warn('trades', e); }
    },
    async holdings() {
      const want = new Set([...(P.Trade ? P.Trade.heldAddresses() : []), ...(P.UI && P.UI.watchAddresses ? P.UI.watchAddresses() : [])]);
      const held = [...want].filter((a) => !D.selected || a !== D.selected.address);
      if (!held.length) return;
      for (let i = 0; i < held.length; i += 30) {
        const chunk = held.slice(i, i + 30);
        try { applyPairs(await ds('hold:' + i, '/tokens/v1/solana/' + chunk.join(','))); } catch (e) { console.warn('holdings', e); }
      }
      ev.emit('tokens');
    },
    async candles(t, tf) {
      const map = { 1: ['second', 1], 60: ['minute', 1], 300: ['minute', 5], 900: ['minute', 15], 3600: ['hour', 1] };
      const [unit, agg] = map[tf] || map[60];
      try {
        const j = await gt('ohlcv:' + t.pair + tf, `/networks/solana/pools/${t.pair}/ohlcv/${unit}?aggregate=${agg}&limit=400&currency=usd&token=base`);
        const list = (j.data && j.data.attributes && j.data.attributes.ohlcv_list) || [];
        return list.map((r) => ({ t: r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] })).reverse();
      } catch (e) { console.warn('ohlcv', e); return []; }
    },
    async search(q) {
      q = q.trim(); if (!q) return [];
      try {
        let pairs;
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
          const arr = await ds('s:' + q, '/tokens/v1/solana/' + q);
          pairs = Array.isArray(arr) ? arr : [];
          if (!pairs.length) { const j = await ds('sp:' + q, '/latest/dex/pairs/solana/' + q); pairs = j.pairs || (j.pair ? [j.pair] : []); }
        } else {
          const j = await ds('s:' + q, '/latest/dex/search?q=' + encodeURIComponent(q));
          pairs = (j.pairs || []).filter((p) => p.chainId === 'solana');
        }
        return applyPairs(pairs);
      } catch (e) { console.warn('search', e); return []; }
    },
    onSelect(t) { this.seen = new Set(); this.trades(true); }
  };

  function applyPairs(arr) {
    if (!Array.isArray(arr)) return [];
    const best = new Map();
    for (const p of arr) {
      if (p.chainId && p.chainId !== 'solana') continue;
      if (p.baseToken?.address === SOL_MINT) continue;
      const cur = best.get(p.baseToken.address);
      if (!cur || (p.liquidity?.usd || 0) > (cur.liquidity?.usd || 0)) best.set(p.baseToken.address, p);
    }
    return [...best.values()].map((p) => upsert(fromDexPair(p))).filter(Boolean);
  }
  function dedupe(arr) { const s = new Set(); return arr.filter((t) => (s.has(t.address) ? false : (s.add(t.address), true))); }

  // ================================================================ SIM
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const addr = (n = 44) => Array.from({ length: n }, () => B58[Math.floor(Math.random() * 58)]).join('');
  const WORDS = ['PEPE', 'FROG', 'CAT', 'DOG', 'MOON', 'CHAD', 'GIGA', 'BASED', 'TURBO', 'SIGMA', 'RIZZ', 'DEGEN', 'JEET', 'HODL', 'PUMP', 'SEND', 'WAGMI', 'COPE', 'SNEK', 'BIRD', 'DUCK', 'PENGU', 'OTTER', 'FISH', 'BEAR', 'BULL', 'APE', 'MONK', 'GOBLIN', 'WIZARD', 'NINJA', 'ROBOT', 'ALIEN', 'GHOST', 'TOAD', 'SLOTH', 'HAMSTER', 'CAPY', 'BANANA', 'PICKLE', 'TACO', 'NUGGET', 'LASER', 'ROCKET', 'COMET', 'VOID', 'NEON', 'TOXIC', 'GOO', 'SLIME'];
  const PREFIX = ['', '', '', 'Baby ', 'Mini ', 'Super ', 'Mega ', 'Lil ', 'King ', 'Dark ', 'Based ', 'Sad ', 'Angry ', 'Fat ', 'Sir '];
  const SUFFIX = ['', '', '', ' Coin', ' AI', ' Inu', ' 2.0', ' on SOL', ' Cult', ' Army', ' Wif Hat', ' Classic'];
  const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

  const Sim = {
    timers: [],
    sel: null,
    tradeBuf: [],
    start() {
      D.solUsd = 180 + U.rand(-15, 25);
      for (let i = 0; i < 34; i++) this.spawn(U.rand(5, 600));
      for (let i = 0; i < 10; i++) this.spawn(U.rand(0.2, 6));
      this.lists();
      this.timers.push(setInterval(() => this.step(0.25), 250));
      this.timers.push(setInterval(() => this.summary(), 1000));
      this.timers.push(setInterval(() => { if (Math.random() < 0.7) this.spawn(0); }, 6000));
      this.timers.push(setInterval(() => { this.lists(); this.cleanup(); }, 3000));
      this.timers.push(setInterval(() => { D.solUsd *= 1 + U.gauss() * 0.0008; ev.emit('sol', D.solUsd); }, 3000));
      this.timers.push(setInterval(() => { if (this.tradeBuf.length) { ev.emit('trades', this.tradeBuf); this.tradeBuf = []; } }, 400));
      ev.emit('sol', D.solUsd);
      status(true, 'simulated market · AMM engine');
    },
    stop() { this.timers.forEach(clearInterval); this.timers = []; },
    spawn(ageMin) {
      const w = U.pick(WORDS);
      const pre = U.pick(PREFIX), suf = U.pick(SUFFIX);
      const name = pre + cap(w) + suf;
      const symbol = ((pre ? pre[0] : '') + w + (suf.includes('AI') ? 'AI' : '')).toUpperCase().slice(0, 10);
      const sol = D.solUsd || 180;
      const t = {
        sim: true, address: addr(44), pair: addr(44), symbol, name, image: null, dex: 'pumpswap', quote: 'SOL',
        supply: 1e9, Q: 30 * sol, B: 1.073e9, createdAt: Date.now() - ageMin * 60000,
        hype: U.rand(0.4, 2.6), regime: 'chop', target: Math.exp(U.rand(Math.log(9000), Math.log(Math.random() < 0.1 ? 30e6 : 2.5e6))), regimeUntil: 0, m1: [], s1: [], socials: [], websites: [],
        vol: { m5: 0, h1: 0, h6: 0, h24: 0 }, chg: { m5: 0, h1: 0, h6: 0, h24: 0 },
        txns: { m5: emptyTx(), h1: emptyTx(), h6: emptyTx(), h24: emptyTx() }
      };
      if (Math.random() < 0.6) t.socials.push({ type: 'twitter', url: 'https://x.com/search?q=%24' + symbol });
      if (Math.random() < 0.4) t.socials.push({ type: 'telegram', url: 'https://t.me/' });
      // fast-forward history minute by minute
      const minutes = Math.floor(ageMin);
      const start = Math.floor(t.createdAt / 60000) * 60;
      for (let m = 0; m < minutes; m++) {
        const ts = start + m * 60;
        this.regime(t, ts * 1000);
        for (let k = 0; k < 6; k++) this.trade(t, ts * 1000 + k * 9000, 1.6, false);
        t.hype *= 0.995;
      }
      t.s1 = [];
      this.price(t);
      D.tokens.set(t.address, t);
      this.summary1(t);
      return t;
    },
    price(t) { t.price = t.Q / t.B; t.mc = t.price * t.supply; t.fdv = t.mc; t.liq = t.Q * 2; t.priceNative = t.price / (D.solUsd || 180); return t.price; },
    regime(t, now) {
      if (now < t.regimeUntil) return;
      const r = Math.random();
      const mcp = t.Q / t.B * t.supply;
      // fair value drifts randomly and decays as the token ages (most memecoins bleed out)
      const ageH = (now - t.createdAt) / 3600000;
      t.target = U.clamp(t.target * Math.exp(U.gauss() * 0.45) * (ageH > 1 ? 0.93 : 1.04), 2500, 80e6);
      if (r < 0.012 && mcp > 40000) { t.regime = 'rug'; t.target *= 0.08; }
      else if (r < 0.26 * t.hype / 1.5) t.regime = 'pump';
      else if (r < 0.55) t.regime = 'dump';
      else t.regime = 'chop';
      t.regimeUntil = now + U.rand(15, 120) * 1000;
    },
    // one (possibly aggregated) market trade on the AMM
    trade(t, ts, mult = 1, live = true) {
      let side, usd;
      if (t.regime === 'rug') { side = 'sell'; usd = t.Q * U.rand(0.5, 0.85); t.regime = 'dump'; t.hype *= 0.2; t.regimeUntil = ts + 300000; }
      else {
        const mcNow = (t.Q / t.B) * t.supply;
        const pull = Math.tanh(Math.log(t.target / mcNow) * 0.8) * 0.16; // mean reversion toward fair value
        const pBuy = 0.5 + pull + (t.regime === 'pump' ? 0.07 : t.regime === 'dump' ? -0.07 : 0);
        side = Math.random() < pBuy ? 'buy' : 'sell';
        usd = Math.exp(U.gauss() * 1.05) * Math.max(8, t.Q * 0.003) * mult;
        if (side === 'sell') usd = Math.min(usd, t.Q * 0.3);
      }
      const k = t.Q * t.B;
      let amount;
      if (side === 'buy') { const B2 = k / (t.Q + usd); amount = t.B - B2; t.Q += usd; t.B = B2; }
      else { const Q2 = Math.max(t.Q - usd, 50); amount = k / Q2 - t.B; usd = t.Q - Q2; t.Q = Q2; t.B = k / Q2; }
      const price = this.price(t);
      this.record(t, ts, price, usd, side);
      if (live && t === this.sel) {
        this.tradeBuf.push({ id: U.uid(), t: ts, side, usd, amount, price, maker: addr(44) });
        ev.emit('tick', { price, t: ts, v: usd });
      }
      if (side === 'buy' && t.hype < 6) t.hype *= 1 + Math.min(0.05, usd / t.Q * 0.3);
    },
    record(t, ts, price, usd, side) {
      const m = Math.floor(ts / 60000) * 60;
      let b = t.m1[t.m1.length - 1];
      if (!b || b.t !== m) {
        const o = b ? b.c : price;
        b = { t: m, o, h: Math.max(o, price), l: Math.min(o, price), c: price, v: 0, buys: 0, sells: 0 };
        t.m1.push(b); if (t.m1.length > 1500) t.m1.shift();
      }
      b.h = Math.max(b.h, price); b.l = Math.min(b.l, price); b.c = price; b.v += usd; side === 'buy' ? b.buys++ : b.sells++;
      const s = Math.floor(ts / 1000);
      let c = t.s1[t.s1.length - 1];
      if (!c || c.t !== s) { const o = c ? c.c : price; c = { t: s, o, h: Math.max(o, price), l: Math.min(o, price), c: price, v: 0 }; t.s1.push(c); if (t.s1.length > 1200) t.s1.shift(); }
      c.h = Math.max(c.h, price); c.l = Math.min(c.l, price); c.c = price; c.v += usd;
    },
    step(dt) {
      const now = Date.now();
      for (const t of D.tokens.values()) {
        if (!t.sim) continue;
        this.regime(t, now);
        const ageMin = (now - t.createdAt) / 60000;
        const activity = t.hype * (ageMin < 3 ? 3.2 : ageMin < 30 ? 1.6 : 0.8) * (t.Q < 1500 ? 0.1 : 1);
        let n = 0; const lam = activity * dt; let L = Math.exp(-lam), p = 1;
        do { n++; p *= Math.random(); } while (p > L && n < 12);
        n -= 1;
        for (let i = 0; i < n; i++) this.trade(t, now);
        t.hype = U.clamp(t.hype * (1 - 0.0009) + (Math.random() < 0.002 ? U.rand(0.5, 2) : 0), 0.05, 8);
      }
    },
    summary1(t) {
      const now = Date.now() / 1000, m1 = t.m1;
      const win = (sec) => {
        let v = 0, buys = 0, sells = 0, open = null;
        for (let i = m1.length - 1; i >= 0; i--) { const b = m1[i]; if (b.t < now - sec) break; v += b.v; buys += b.buys; sells += b.sells; open = b.o; }
        return { v, buys, sells, chg: open ? (t.price / open - 1) * 100 : 0 };
      };
      const w5 = win(300), w1 = win(3600), w6 = win(21600), w24 = win(86400);
      t.vol = { m5: w5.v, h1: w1.v, h6: w6.v, h24: w24.v };
      t.chg = { m5: w5.chg, h1: w1.chg, h6: w6.chg, h24: w24.chg };
      t.txns = { m5: { buys: w5.buys, sells: w5.sells }, h1: { buys: w1.buys, sells: w1.sells }, h6: { buys: w6.buys, sells: w6.sells }, h24: { buys: w24.buys, sells: w24.sells } };
      t.ticks = m1.slice(-30).map((b) => b.c);
      t.updatedAt = Date.now();
    },
    summary() {
      for (const t of D.tokens.values()) if (t.sim) this.summary1(t);
      if (this.sel) ev.emit('token', this.sel);
      ev.emit('tokens');
    },
    lists() {
      const all = [...D.tokens.values()].filter((t) => t.sim);
      D.lists.trending = all.filter((t) => Date.now() - t.createdAt > 8 * 60000 && t.mc > 7000).sort((a, b) => b.vol.h1 - a.vol.h1).slice(0, 30);
      D.lists.new = all.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);
      ev.emit('lists');
    },
    cleanup() {
      const held = new Set(P.Trade ? P.Trade.heldAddresses() : []);
      const all = [...D.tokens.values()].filter((t) => t.sim);
      if (all.length < 60) return;
      for (const t of all) {
        if (held.has(t.address) || t === this.sel || P.UI?.isWatched?.(t.address)) continue;
        if (t.mc < 4500 && Date.now() - t.createdAt > 15 * 60000) D.tokens.delete(t.address);
      }
    },
    async candles(t, tf) {
      if (tf === 1) return t.s1.map((c) => ({ ...c }));
      const per = tf / 60, out = [];
      for (const b of t.m1) {
        const bt = Math.floor(b.t / tf) * tf;
        const last = out[out.length - 1];
        if (per > 1 && last && last.t === bt) { last.h = Math.max(last.h, b.h); last.l = Math.min(last.l, b.l); last.c = b.c; last.v += b.v; }
        else out.push({ t: bt, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
      }
      return out;
    },
    async search(q) {
      q = q.trim().toLowerCase(); if (!q) return [];
      return [...D.tokens.values()].filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase() === q).slice(0, 25);
    },
    onSelect(t) { this.sel = t; this.tradeBuf = []; },
    // apply a user's fill to the simulated pool so your own trades move the chart
    impact(t, side, Q2, B2, usd, amount) {
      t.Q = Q2; t.B = B2;
      const price = this.price(t);
      this.record(t, Date.now(), price, usd, side);
      if (t === this.sel) { this.tradeBuf.push({ id: U.uid(), t: Date.now(), side, usd, amount, price, maker: 'YOU', mine: true }); ev.emit('tick', { price, t: Date.now(), v: usd }); }
      t.hype *= side === 'buy' ? 1.15 : 0.95;
    }
  };

  // ================================================================ public API
  let engine = null;
  D.start = async (mode) => {
    if (engine) engine.stop();
    D.tokens.clear(); D.lists = { trending: [], new: [] }; D.selected = null;
    const want = mode || (P.S && P.S.get('dataMode')) || 'auto';
    if (want === 'sim') { D.mode = 'sim'; engine = Sim; Sim.start(); ev.emit('mode', 'sim'); return; }
    try {
      D.mode = 'live'; engine = Live;
      ev.emit('mode', 'live');
      await Promise.race([Live.start(), U.sleep(15000).then(() => { throw new Error('timeout'); })]);
    } catch (e) {
      console.warn('live start failed', e);
      Live.stop();
      if (want === 'live') { status(false, 'live feed unreachable — retrying'); setTimeout(() => D.start('live'), 10000); return; }
      D.mode = 'sim'; engine = Sim; Sim.start();
      ev.emit('mode', 'sim');
      P.FX && P.FX.toast('Live feed unreachable', 'Switched to simulated market. Change in Settings → Data.', 'info', 6000);
    }
  };
  D.select = (t) => {
    if (!t) return;
    D.selected = t;
    engine && engine.onSelect(t);
    ev.emit('select', t);
  };
  D.candles = (t, tf) => (engine ? engine.candles(t, tf) : Promise.resolve([]));
  D.search = (q) => (engine ? engine.search(q) : Promise.resolve([]));
  D.simImpact = (...a) => { if (D.mode === 'sim') Sim.impact(...a); };
  D.refreshSelected = () => engine === Live && Live.detail();
})(window.P);
