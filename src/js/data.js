/* Poison Terminal — OFFLINE pump.fun-style market engine
 *
 * Every coin is an agent-based simulation on the real pump.fun bonding curve:
 *   virtual reserves 30 SOL / 1,073,000,191 tokens, 1B supply, graduates at ~85 SOL raised (~$70K MC)
 *   then migrates to a PumpSwap constant-product pool (85 SOL / 206.9M tokens, 0.25% fee).
 * Participants: dev, bundlers (same-block buys), snipers, insiders, KOLs, whales, volume bots and
 * retail holders, each with their own entry price, take-profit and panic levels.
 * Each coin gets a hidden "fate" (dead launch, bundle rug, dev dump, honeypot, runner, ...) and its
 * visible red flags (top10 %, dev %, bundlers %, snipers %, freeze authority, dev history...) are
 * produced by the actual simulated wallets — so learning to read them transfers to real trading.
 */
(function (P) {
  const U = P.U;
  const ev = U.emitter();
  const SUPPLY = 1e9, VSOL0 = 30, VTOK0 = 1073000191, GRAD = 85, POOL_TOK = 206900000;

  const D = (P.Data = {
    mode: 'sim', solUsd: 0, tokens: new Map(),
    lists: { new: [], stretch: [], migrated: [], trending: [] },
    selected: null, on: ev.on, emit: ev.emit,
    get: (a) => D.tokens.get(a),
    tps: 0
  });

  // ------------------------------------------------------------ helpers
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const rid = (n) => { let s = ''; for (let i = 0; i < n; i++) s += B58[(Math.random() * 58) | 0]; return s; };
  const ln = (med, sig) => med * Math.exp(U.gauss() * sig);
  const R = U.rand, RI = U.randInt;
  function poisson(l, cap = 30) {
    if (!(l > 0)) return 0;
    if (l > 20) return U.clamp(Math.round(l + Math.sqrt(l) * U.gauss()), 0, cap);
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L && k <= cap);
    return Math.min(cap, k - 1);
  }
  const chance = (p) => Math.random() < p;
  let BF = false; // backfill mode: no UI events, no 1s candles
  let tradeCount = 0;

  // ------------------------------------------------------------ names
  const ANIMALS = [['frog', '🐸'], ['dog', '🐶'], ['cat', '🐱'], ['hamster', '🐹'], ['penguin', '🐧'], ['monkey', '🐒'], ['squirrel', '🐿️'], ['hippo', '🦛'], ['otter', '🦦'], ['capybara', '🦫'], ['duck', '🦆'], ['goat', '🐐'], ['sloth', '🦥'], ['raccoon', '🦝'], ['shiba', '🐕'], ['whale', '🐋'], ['shark', '🦈'], ['bear', '🐻'], ['bull', '🐂'], ['owl', '🦉'], ['bunny', '🐰'], ['fox', '🦊'], ['panda', '🐼'], ['koala', '🐨'], ['seal', '🦭'], ['crab', '🦀'], ['snail', '🐌'], ['toad', '🐸'], ['pig', '🐷'], ['cow', '🐮'], ['chicken', '🐔'], ['lobster', '🦞'], ['axolotl', '🦎'], ['turtle', '🐢'], ['pug', '🐶'], ['corgi', '🐕'], ['bat', '🦇'], ['moose', '🫎'], ['worm', '🪱'], ['bee', '🐝'], ['dolphin', '🐬'], ['gorilla', '🦍'], ['unicorn', '🦄'], ['dragon', '🐉'], ['parrot', '🦜'], ['flamingo', '🦩']];
  const ADJ = ['based', 'sad', 'chill', 'angry', 'tiny', 'fat', 'smol', 'giga', 'sleepy', 'crying', 'dancing', 'buff', 'rich', 'broke', 'sigma', 'cursed', 'wet', 'cozy', 'silly', 'lonely', 'confused', 'unhinged', 'nerdy', 'evil', 'holy', 'lucky', 'spicy', 'frozen', 'golden', 'retired', 'autistic', 'bullish', 'jeeted', 'drunk', 'baby', 'lil', 'big', 'super', 'dark', 'pixel'];
  const THINGS = [['hat', '🎩'], ['pizza', '🍕'], ['banana', '🍌'], ['rocket', '🚀'], ['toilet', '🚽'], ['burger', '🍔'], ['candle', '🕯️'], ['pickle', '🥒'], ['sock', '🧦'], ['moon', '🌕'], ['coin', '🪙'], ['chart', '📈'], ['cheese', '🧀'], ['donut', '🍩'], ['cookie', '🍪'], ['taco', '🌮'], ['egg', '🥚'], ['brain', '🧠'], ['skull', '💀'], ['fire', '🔥'], ['diamond', '💎'], ['bag', '💰'], ['laser', '🔫'], ['crown', '👑'], ['ghost', '👻'], ['alien', '👽'], ['robot', '🤖'], ['clown', '🤡'], ['poop', '💩'], ['cactus', '🌵'], ['mushroom', '🍄'], ['sushi', '🍣'], ['nugget', '🍗'], ['beer', '🍺'], ['coffee', '☕'], ['glasses', '🕶️']];
  const NAMES = ['bob', 'gary', 'kevin', 'steve', 'ted', 'carl', 'doug', 'chad', 'brett', 'andy', 'billy', 'pepito', 'jeff', 'larry', 'barry', 'moo', 'pip', 'zuzu', 'toto', 'mimi', 'lulu', 'boba', 'nub', 'gus', 'rudy', 'momo', 'kiki', 'bubu', 'dodo', 'fred', 'hank', 'joey', 'lenny', 'nana', 'pablo', 'remy', 'sully', 'timmy', 'wally', 'yuki'];
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function genName() {
    const [an, ae] = U.pick(ANIMALS), [th, te] = U.pick(THINGS), adj = U.pick(ADJ), nm = U.pick(NAMES);
    const r = Math.random();
    let name, sym, emoji = ae;
    if (r < 0.14) { name = `${adj} ${an}`; sym = chance(0.5) ? (adj + an) : an; }
    else if (r < 0.24) { name = `${cap1(nm)} the ${cap1(an)}`; sym = nm; }
    else if (r < 0.32) { name = `just a ${adj} ${an}`; sym = adj; }
    else if (r < 0.40) { name = `${an}wif${th}`; sym = (an[0] + 'wif').toUpperCase(); emoji = te; }
    else if (r < 0.47) { name = `${cap1(an)} Coin`; sym = an; }
    else if (r < 0.54) { name = `${adj} ${th}`; sym = th; emoji = te; }
    else if (r < 0.61) { name = `Agent ${cap1(nm)}`; sym = nm + 'ai'; emoji = '🤖'; }
    else if (r < 0.67) { name = `${cap1(th)} Inu`; sym = th + 'inu'; emoji = te; }
    else if (r < 0.73) { name = nm; sym = nm; }
    else if (r < 0.79) { name = `the last ${an}`; sym = 'last'; }
    else if (r < 0.85) { name = `${cap1(an)} on Sol`; sym = an.slice(0, 4) + 'sol'; }
    else if (r < 0.91) { name = `${cap1(adj)} ${cap1(nm)}`; sym = adj.slice(0, 3) + nm; }
    else { name = `${th} ${U.pick(['420', '69', '2.0', 'cult', 'season', 'army', 'world'])}`; sym = th + (chance(0.5) ? '' : U.pick(['420', '69'])); emoji = te; }
    sym = sym.replace(/[^a-z0-9]/gi, '').slice(0, 9);
    sym = chance(0.85) ? sym.toUpperCase() : sym.toLowerCase();
    return { name, sym, emoji };
  }

  // ------------------------------------------------------------ fates
  const FATES = {
    dead: { label: 'Dead launch', rug: false, lesson: 'Most launches never find real buyers. Few holders, no socials and an early dev sell = nothing to hold for. Fees eat you alive on these.' },
    snipefade: { label: 'Sniped & faded', rug: false, lesson: 'Snipers took a big chunk in the first seconds and sold into the first wave of buyers. High sniper % = overhead supply waiting to hit every bid.' },
    bundlerug: { label: 'Bundle rug', rug: true, lesson: 'Wallets bundled in the launch block held a huge % and dumped together. Bundlers > 20% is one of the strongest rug signals.' },
    devdump: { label: 'Dev dump', rug: true, lesson: 'The dev bought a big bag at launch and sold it all in one transaction. Check "Dev holds %" and the dev\'s launch history before buying.' },
    wash: { label: 'Fake volume', rug: true, lesson: 'A volume bot traded with itself: lots of txns, very few holders, flat chart. Compare txns to holders and look at the trade sizes.' },
    migratedump: { label: 'Migration dump', rug: true, lesson: 'Insiders rode it into the bond and sold right after migration. Buying the migration candle with high insider/bundle % is exit liquidity.' },
    runner: { label: 'Organic runner', rug: false, lesson: 'Distributed holders, low bundle/sniper %, socials and steady new buyers. Even runners pull back 30-50% — size so you can hold through it.' },
    kol: { label: 'KOL pump', rug: false, lesson: 'A KOL wallet bought and called it; followers chased the green candles while the KOL sold into them. Don\'t buy the vertical candle — wait for the first pullback or skip.' },
    cabal: { label: 'Cabal bleed', rug: true, lesson: 'Insider wallets held a large share (not bundled, so it looks clean) and sold into every pump. Watch the insiders % and how green candles get instantly sold.' },
    honeypot: { label: 'Honeypot', rug: true, lesson: 'Freeze authority was enabled: buyers could not sell, then liquidity was pulled. Never buy a token with freeze or mint authority enabled.' }
  };
  D.FATES = FATES;
  const FATE_W = [['dead', 50], ['snipefade', 9], ['bundlerug', 10], ['devdump', 8], ['wash', 4], ['migratedump', 6], ['runner', 6.5], ['kol', 3], ['cabal', 3], ['honeypot', 1.5]];
  function pickFate(list = FATE_W) { let s = 0; for (const [, w] of list) s += w; let r = Math.random() * s; for (const [f, w] of list) { if ((r -= w) <= 0) return f; } return 'dead'; }

  // ------------------------------------------------------------ token + wallets
  function wallet(t, k) {
    const w = { id: rid(44), k, tok: 0, cost: 0, sold: 0, ep: 0, hi: -1, tp: 0, sl: 0, t0: 0 };
    if (k === 'retail' || k === 'whale') { w.tp = 1.25 + ln(0.9, 0.8); w.sl = chance(0.35) ? 0 : R(0.3, 0.75); }
    if (k === 'sniper') { w.tp = R(1.3, 2.6); }
    if (k !== 'retail' && k !== 'whale' && k !== 'you') (t.sp[k] || (t.sp[k] = [])).push(w);
    return w;
  }
  function hAdd(t, w) { if (w.hi < 0) { w.hi = t.holders.length; t.holders.push(w); } }
  function hDel(t, w) { if (w.hi >= 0) { const last = t.holders.pop(); if (last !== w) { t.holders[w.hi] = last; last.hi = w.hi; } w.hi = -1; } }

  function price(t) {
    t.priceSol = t.Q / t.B;
    t.price = t.priceSol * D.solUsd;
    t.mc = t.price * SUPPLY; t.fdv = t.mc;
    t.liq = t.Q * 2 * D.solUsd;
    t.priceNative = t.priceSol;
    t.bonding = t.stage === 'curve' ? U.clamp(((t.Q - VSOL0) / GRAD) * 100, 0, 100) : 100;
  }

  function newToken(fate, at) {
    const nm = genName();
    const honey = fate === 'honeypot';
    const t = {
      address: honey ? rid(44) : rid(40) + 'pump', pair: rid(44), symbol: nm.sym, name: nm.name, emoji: nm.emoji,
      dex: honey ? 'raydium' : 'pump.fun', stage: honey ? 'amm' : 'curve', fate, createdAt: at,
      Q: VSOL0, B: VTOK0, fee: 0.01, supply: SUPPLY,
      holders: [], sp: {}, dev: null, you: null, q: [], ring: [], m1: [], s1: [],
      h: 0, tau: 300, hFloor: 0, floorUntil: 0, target: 8000, decayAfter: at + 120000, tgtDecay: 300, lastTrade: at, acc: 0, revealed: false, events: [],
      mintAuth: honey, freeze: honey, lpBurned: !honey,
      vol: { m5: 0, h1: 0, h6: 0, h24: 0 }, chg: { m5: 0, h1: 0, h6: 0, h24: 0 },
      txns: { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 }, h6: { buys: 0, sells: 0 }, h24: { buys: 0, sells: 0 } },
      audit: { top10: 0, dev: 0, snipers: 0, insiders: 0, bundlers: 0, holders: 0 },
      socials: [], websites: [], ticks: []
    };
    if (honey) { t.Q = R(12, 35); t.B = SUPPLY * 0.85; t.fee = 0.0025; }
    t.dev = wallet(t, 'dev');
    // dev reputation & socials (correlated with fate, with noise)
    const shady = FATES[fate].rug ? chance(0.72) : chance(fate === 'dead' ? 0.3 : 0.12);
    const created = shady ? RI(6, 90) : RI(0, 4);
    t.devInfo = { created, migrated: shady ? (chance(0.25) ? 1 : 0) : Math.min(created, RI(0, 2)), fresh: shady ? chance(0.65) : chance(0.15) };
    const good = fate === 'runner' || fate === 'kol' || fate === 'cabal';
    if (chance(good ? 0.92 : 0.5)) { t.socials.push({ type: 'twitter', url: 'x.com/' + nm.sym.toLowerCase() }); t.xReused = !good && chance(0.5); }
    if (chance(good ? 0.7 : 0.2)) t.socials.push({ type: 'telegram', url: 't.me/' + nm.sym.toLowerCase() });
    if (chance(good ? 0.6 : 0.15)) t.websites.push({ url: nm.sym.toLowerCase() + '.xyz' });
    price(t);
    SETUP[fate](t, at);
    return t;
  }

  function sched(t, at, fn) { t.q.push({ at, fn }); t.q.sort((a, b) => a.at - b.at); }

  // ------------------------------------------------------------ trading core
  function trade(t, w, side, amt, ts) {
    if (!(amt > 0)) return null;
    let sol, tok;
    if (side === 'buy') {
      const inn = amt * (1 - t.fee);
      tok = (t.B * inn) / (t.Q + inn);
      if (w.tok + tok > 0) w.ep = (w.ep * w.tok + (inn / tok) * tok) / (w.tok + tok);
      t.Q += inn; t.B -= tok;
      w.tok += tok; w.cost += amt; sol = amt;
      hAdd(t, w);
      t.stepBuy += amt;
    } else {
      tok = Math.min(amt, w.tok);
      if (!(tok > 0)) return null;
      const out = (t.Q * tok) / (t.B + tok);
      t.Q -= out; t.B += tok;
      if (t.stage === 'curve' && t.Q < VSOL0) { t.B = (t.B * t.Q) / VSOL0; t.Q = VSOL0; }
      w.tok -= tok; sol = out * (1 - t.fee); w.sold += sol;
      if (w.tok < 1) { w.tok = 0; hDel(t, w); }
    }
    price(t);
    if (!BF) tradeCount++;
    record(t, ts, t.price, sol * D.solUsd, side);
    t.lastTrade = ts;
    if (!BF && t === D.selected) feed.push({ id: rid(10), t: ts, side, usd: sol * D.solUsd, sol, amount: tok, price: t.price, maker: w.id, tag: w.k, mine: w.k === 'you' });
    return { sol, tok };
  }
  const sellAll = (t, w, ts) => w && w.tok > 0 && trade(t, w, 'sell', w.tok, ts);
  const sellFrac = (t, w, f, ts) => w && w.tok > 0 && trade(t, w, 'sell', f >= 0.98 ? w.tok : w.tok * f, ts);

  function record(t, ts, p, usd, side) {
    const m = Math.floor(ts / 60000) * 60;
    let b = t.m1[t.m1.length - 1];
    if (b && m < b.t) { /* late trade inside step: fold into last bucket */ }
    else if (!b || b.t !== m) {
      const o = b ? b.c : p;
      b = { t: m, o, h: Math.max(o, p), l: Math.min(o, p), c: p, v: 0, buys: 0, sells: 0 };
      t.m1.push(b); if (t.m1.length > 1500) t.m1.shift();
    }
    if (p > b.h) b.h = p; if (p < b.l) b.l = p; b.c = p; b.v += usd; side === 'buy' ? b.buys++ : b.sells++;
    if (BF) return;
    const s = Math.floor(ts / 1000);
    let c = t.s1[t.s1.length - 1];
    if (c && s < c.t) { c.c = p; if (p > c.h) c.h = p; if (p < c.l) c.l = p; c.v += usd; }
    else {
      if (!c || c.t !== s) { const o = c ? c.c : p; c = { t: s, o, h: Math.max(o, p), l: Math.min(o, p), c: p, v: 0 }; t.s1.push(c); if (t.s1.length > 900) t.s1.splice(0, 100); }
      if (p > c.h) c.h = p; if (p < c.l) c.l = p; c.c = p; c.v += usd;
    }
    if (t === D.selected) ev.emit('tick', { price: p, t: ts, v: usd });
  }

  function migrate(t, now) {
    const raised = t.Q - VSOL0;
    t.stage = 'amm'; t.fee = 0.0025; t.dex = 'pumpswap';
    t.Q = Math.max(raised, 1); t.B = POOL_TOK; t.migratedAt = now;
    t.h *= 1.5;
    price(t);
    note(t, 'migrate', `🎓 $${t.symbol} migrated to PumpSwap at ${U.fmtCompact(t.mc)} MC`);
    const f = HOOK_MIGRATE[t.fate]; f && f(t, now);
  }

  function reveal(t, kind, text, now) {
    if (!t.revealed) { t.revealed = true; t.revealedAt = now; }
    note(t, kind, text);
  }
  function note(t, kind, text) {
    t.events.push({ kind, text, at: Date.now() });
    if (!BF) ev.emit('event', { t, kind, text, rug: kind === 'rug' });
  }

  // ------------------------------------------------------------ launches
  function launch(t, at, o) {
    if (o.dev) sched(t, at, (ts) => trade(t, t.dev, 'buy', o.dev, ts));
    for (let i = 0; i < (o.bundleN || 0); i++) {
      const w = wallet(t, 'bundle');
      const amt = (o.bundleSol / o.bundleN) * R(0.6, 1.4);
      sched(t, at + 1, (ts) => trade(t, w, 'buy', amt, ts));
    }
    for (let i = 0; i < (o.snipers || 0); i++) {
      const w = wallet(t, 'sniper');
      const [a, b] = o.sniperSol || [0.3, 2];
      sched(t, at + R(400, 6000), (ts) => trade(t, w, 'buy', R(a, b), ts));
    }
    for (let i = 0; i < (o.insiders || 0); i++) {
      const w = wallet(t, 'insider');
      sched(t, at + R(3000, o.insiderWindow || 40000), (ts) => trade(t, w, 'buy', (o.insiderSol / o.insiders) * R(0.5, 1.5), ts));
    }
  }

  const SETUP = {
    dead(t, at) {
      launch(t, at, { dev: R(0.2, 2), bundleN: chance(0.3) ? RI(1, 3) : 0, bundleSol: R(1, 4), snipers: RI(0, 3) });
      t.h = R(0.12, 0.7); t.tau = R(45, 180);
      t.target = R(6e3, 15e3); t.decayAfter = at + R(30, 150) * 1000; t.tgtDecay = R(120, 400);
      if (chance(0.75)) sched(t, at + R(40, 480) * 1000, (ts) => sellAll(t, t.dev, ts));
    },
    snipefade(t, at) {
      launch(t, at, { dev: R(0.5, 2), snipers: RI(5, 12), sniperSol: [1, 4.5] });
      t.h = R(0.5, 1.1); t.tau = R(90, 200);
      t.target = R(10e3, 25e3); t.decayAfter = at + R(60, 200) * 1000; t.tgtDecay = 200;
      if (chance(0.6)) sched(t, at + R(60, 400) * 1000, (ts) => sellAll(t, t.dev, ts));
    },
    bundlerug(t, at) {
      launch(t, at, { dev: R(1, 3), bundleN: RI(6, 16), bundleSol: R(9, 28), snipers: RI(0, 3) });
      t.h = R(0.9, 1.8); t.tau = R(250, 600); t.hold = true;
      t.trigMc = R(14e3, 55e3); t.minAge = R(90, 420) * 1000; t.trigAt = at + R(300, 1100) * 1000;
      t.target = t.trigMc * R(1.1, 1.6); t.decayAfter = t.trigAt + 600000;
    },
    devdump(t, at) {
      launch(t, at, { dev: R(4, 14), bundleN: chance(0.4) ? RI(1, 3) : 0, bundleSol: R(1, 5), snipers: RI(0, 4) });
      t.h = R(0.8, 1.7); t.tau = R(300, 700);
      t.trigMc = R(13e3, 60e3); t.minAge = R(60, 400) * 1000; t.trigAt = at + R(240, 1200) * 1000;
      t.target = t.trigMc * R(1.1, 1.6); t.decayAfter = t.trigAt + 600000;
    },
    wash(t, at) {
      launch(t, at, { dev: R(0.5, 2), snipers: RI(0, 2) });
      t.bot = wallet(t, 'bot'); t.botRate = R(1.5, 4.5); t.botUntil = at + R(300, 1500) * 1000;
      t.h = R(0.08, 0.3); t.tau = R(300, 700);
      t.target = R(7e3, 18e3); t.decayAfter = t.botUntil; t.tgtDecay = 300;
    },
    migratedump(t, at) {
      launch(t, at, { dev: R(0.5, 2), bundleN: RI(5, 12), bundleSol: R(6, 16), snipers: RI(1, 5), insiders: RI(3, 8), insiderSol: R(5, 12), insiderWindow: 25000 });
      t.h = R(1.1, 1.9); t.tau = R(900, 1600); t.hold = true; t.hFloor = 0.8; t.floorUntil = at + 30 * 60000;
      t.target = R(95e3, 170e3); t.decayAfter = at + 40 * 60000; t.tgtDecay = 900;
    },
    runner(t, at) {
      launch(t, at, { dev: R(0.2, 1.5), bundleN: chance(0.3) ? RI(1, 2) : 0, bundleSol: R(0.5, 3), snipers: RI(0, 4) });
      t.h = R(0.6, 1.3); t.tau = R(400, 900);
      t.catEvery = R(150, 420); t.lifeEnd = at + R(40, 300) * 60000; t.hFloor = R(0.45, 0.9); t.floorUntil = t.lifeEnd;
      t.target = R(22e3, 50e3); t.decayAfter = t.lifeEnd; t.tgtDecay = R(900, 2400);
      if (chance(0.5)) sched(t, at + R(120, 900) * 1000, (ts) => { sellAll(t, t.dev, ts); });
    },
    kol(t, at) {
      launch(t, at, { dev: R(0.5, 1.5), snipers: RI(0, 3), bundleN: chance(0.3) ? RI(1, 3) : 0, bundleSol: R(1, 4) });
      t.h = R(0.4, 0.9); t.tau = 600; t.hFloor = 0.3; t.floorUntil = at + 20 * 60000;
      t.target = R(8e3, 16e3); t.decayAfter = at + 3600000;
      const kAt = at + R(120, 600) * 1000;
      t.kolW = wallet(t, 'kol');
      sched(t, kAt, (ts) => {
        trade(t, t.kolW, 'buy', R(8, 25), ts);
        t.h = Math.min(3.5, Math.max(t.h, 1) * R(3, 5)); t.tau = R(150, 300); t.hFloor = 0; t.target = Math.max(t.target, t.mc) * R(3, 7);
        note(t, 'kol', `📣 A KOL aped $${t.symbol} — followers incoming`);
      });
      sched(t, kAt + R(60, 200) * 1000, (ts) => sellFrac(t, t.kolW, R(0.4, 0.6), ts));
      sched(t, kAt + R(250, 600) * 1000, (ts) => { sellAll(t, t.kolW, ts); t.target *= 0.45; t.decayAfter = ts; t.tgtDecay = 400; reveal(t, 'info', `KOL fully exited $${t.symbol}`, ts); });
    },
    cabal(t, at) {
      launch(t, at, { dev: R(0.5, 1.5), insiders: RI(10, 20), insiderSol: R(22, 45), insiderWindow: 45000, snipers: RI(0, 3) });
      t.h = R(1, 1.8); t.tau = R(900, 1600); t.hFloor = 0.5; t.floorUntil = at + R(20, 60) * 60000; t.hold = true;
      t.target = R(60e3, 200e3); t.decayAfter = t.floorUntil; t.tgtDecay = 900;
    },
    honeypot(t, at) {
      t.dev.tok = SUPPLY * 0.15; hAdd(t, t.dev);
      t.h = R(0.8, 1.6); t.tau = 400; t.hFloor = 0.4; t.floorUntil = at + 60 * 60000;
      t.target = R(25e3, 90e3); t.decayAfter = at + 3600000;
      t.trigAt = at + R(240, 900) * 1000;
    }
  };

  const HOOK_MIGRATE = {
    migratedump(t, now) {
      const sellers = [...(t.sp.bundle || []), ...(t.sp.insider || []), t.dev];
      const start = now + R(5, 80) * 1000;
      sellers.forEach((w) => sched(t, start + R(0, 25000), (ts) => sellAll(t, w, ts)));
      sched(t, start + 26000, (ts) => { t.h *= 0.3; t.tau = 300; t.hFloor = 0; t.target = t.mc * 0.6; t.decayAfter = ts; t.tgtDecay = 600; reveal(t, 'rug', `🚨 Migration dump on $${t.symbol}: insiders & bundlers sold right after migrating`, ts); });
    }
  };

  // continuous per-fate behaviour
  const TICK = {
    bundlerug(t, now) {
      if (t.rugged || now - t.createdAt < t.minAge || !(t.mc >= t.trigMc || now >= t.trigAt)) return;
      t.rugged = true;
      const ws = (t.sp.bundle || []).filter((w) => w.tok > 0);
      const pct = ws.reduce((a, w) => a + w.tok, 0) / SUPPLY * 100;
      ws.forEach((w) => sched(t, now + R(0, 4000), (ts) => sellAll(t, w, ts)));
      sched(t, now + R(500, 3500), (ts) => sellAll(t, t.dev, ts));
      t.h *= 0.15; t.tau = 60; t.hFloor = 0; t.target = 4000; t.decayAfter = now;
      reveal(t, 'rug', `🚨 Bundle rug on $${t.symbol}: ${ws.length} bundled wallets dumped ${pct.toFixed(1)}% of supply`, now);
    },
    devdump(t, now) {
      if (t.rugged || now - t.createdAt < t.minAge || !(t.mc >= t.trigMc || now >= t.trigAt)) return;
      t.rugged = true;
      const pct = t.dev.tok / SUPPLY * 100;
      sellAll(t, t.dev, now);
      t.h *= 0.12; t.tau = 60; t.hFloor = 0; t.target = 4000; t.decayAfter = now;
      reveal(t, 'rug', `🚨 Dev dumped $${t.symbol}: sold ${pct.toFixed(1)}% of supply in one tx`, now);
    },
    wash(t, now, dt) {
      if (now > t.botUntil) { if (!t.botDone) { t.botDone = true; sellAll(t, t.bot, now); reveal(t, 'rug', `🤖 Volume bot stopped on $${t.symbol} — the volume was fake`, now); } return; }
      const n = poisson(t.botRate * dt, 20);
      for (let i = 0; i < n; i++) { if (t.bot.tok > 0) sellAll(t, t.bot, now); else trade(t, t.bot, 'buy', ln(0.18, 0.5), now); }
    },
    runner(t, now, dt) {
      if (now < t.lifeEnd && chance(dt / t.catEvery)) {
        if (chance(0.25)) t.target *= R(0.55, 0.85); // pullback / jeets
        else { t.target = Math.min(3e7, t.target * (t.target > 2e6 ? R(1.1, 1.45) : R(1.25, 2.1))); t.h = Math.min(3.5, t.h * R(1.2, 1.7)); } if (!BF && chance(0.4)) note(t, 'info', `🔥 $${t.symbol} trending on X`); }
      if (now > t.lifeEnd && !t.revealed && t.h < 0.1) reveal(t, 'info', `$${t.symbol} ran its course`, now);
      const whaleBuy = t.mc > 80000 && chance(dt / 200);
      if (whaleBuy) { const w = wallet(t, 'whale'); trade(t, w, 'buy', R(5, 30), now); }
    },
    cabal(t, now) {
      const ins = (t.sp.insider || []).filter((w) => w.tok > 0);
      if (!ins.length) { if (!t.revealed && now - t.createdAt > 180000) reveal(t, 'rug', `🚨 Insiders fully distributed $${t.symbol} into buyers`, now); return; }
      if (t.stepBuy > 0 && now - t.createdAt > 60000) {
        let budget = t.stepBuy * R(0.5, 0.9);
        for (const w of ins) {
          if (budget <= 0) break;
          if (t.priceSol / w.ep < 1.3) continue;
          const tokForBudget = (budget / t.priceSol);
          const r = trade(t, w, 'sell', Math.min(w.tok, tokForBudget), now);
          if (r) budget -= r.sol;
        }
      }
      if (now > t.floorUntil + 600000 && !t.revealed) reveal(t, 'rug', `🚨 Cabal bled $${t.symbol}: insiders sold into every pump`, now);
    },
    honeypot(t, now) {
      if (t.rugged || now < t.trigAt) return;
      t.rugged = true;
      t.Q *= 0.012; price(t); record(t, now, t.price, 0, 'sell');
      sellAll(t, t.dev, now);
      t.h = 0; t.hFloor = 0;
      reveal(t, 'rug', `🚨 Honeypot $${t.symbol}: liquidity pulled. Holders could never sell (freeze authority)`, now);
    }
  };

  // generic special-agent behaviour (snipers take profit, unrugged bundles distribute, KOL/insider handled by fate)
  function specials(t, now, dt) {
    if (t.freeze) return;
    for (const w of t.sp.sniper || []) {
      if (w.tok <= 0 || !chance(dt * 0.35)) continue;
      const mult = t.priceSol / w.ep;
      if (mult >= w.tp) sellFrac(t, w, R(0.5, 1), now);
      else if (mult < 0.7 || now - t.createdAt > R(60, 400) * 1000) sellAll(t, w, now);
    }
    if (!t.hold) for (const w of t.sp.bundle || []) {
      if (w.tok <= 0 || !chance(dt * 0.04)) continue;
      if (t.priceSol / w.ep > 1.4) sellFrac(t, w, R(0.15, 0.4), now);
    }
  }

  // ------------------------------------------------------------ simulation step
  function momentum(t, now) {
    const r = t.ring;
    if (!r.length || now - r[r.length - 1][0] >= 5000) { r.push([now, t.priceSol]); if (r.length > 14) r.shift(); }
    const ref = r[0];
    return ref ? t.priceSol / ref[1] - 1 : 0;
  }
  function buyMedian(t) { return U.clamp(0.19 * Math.pow(Math.max(t.mc, 3000) / 8000, 0.25), 0.05, 2); }

  function step(t, now, dt) {
    t.stepBuy = 0;
    while (t.q.length && t.q[0].at <= now) { const e = t.q.shift(); e.fn(e.at); }
    if (t.stage === 'curve' && t.Q - VSOL0 >= GRAD) migrate(t, now);
    const tick = TICK[t.fate]; tick && tick(t, now, dt);
    specials(t, now, dt);
    const ret = momentum(t, now);
    // narrative fair value: catalysts move it, age decays it; flows are biased toward it
    if (now > t.decayAfter) t.target = Math.max(3500, t.target * Math.exp(-dt / t.tgtDecay));
    t.target *= Math.exp(U.gauss() * 0.02 * Math.sqrt(dt));
    const gap = U.clamp(Math.log(t.target / Math.max(t.mc, 1)), -2.5, 2.5);
    const fb = Math.min(2.4, Math.exp(gap * 0.55)), fs = Math.exp(-gap * 0.55);
    // retail buyers (momentum chasers)
    const n = poisson(Math.min(now - t.createdAt < 300000 ? 2.2 : 4, t.h * (t.freeze ? fb * fb : fb) * U.clamp(0.85 + ret * 0.8, 0.5, 1.6)) * dt, 40);
    if (n) {
      const med = buyMedian(t);
      const H = t.holders.length;
      for (let i = 0; i < n; i++) {
        const whale = chance(t.mc > 100000 ? 0.05 : 0.015);
        let w = null;
        if (!whale && H > 8 && chance(0.2)) { const c = t.holders[(Math.random() * H) | 0]; if (c.k === 'retail') w = c; }
        if (!w) w = wallet(t, whale ? 'whale' : 'retail');
        trade(t, w, 'buy', U.clamp(ln(med * (whale ? 10 : 1), 0.9), 0.01, 250), now - (n - i) * 7);
      }
    }
    // holders deciding to sell
    if (!t.freeze) {
      const H = t.holders.length;
      const fear = ret < -0.3 ? 0.012 : ret < -0.15 ? 0.005 : 0;
      const m = poisson(Math.min(H, 250) * (0.012 + fear) * fs * dt, 40);
      for (let i = 0; i < m; i++) {
        const w = t.holders[(Math.random() * t.holders.length) | 0];
        if (!w || (w.k !== 'retail' && w.k !== 'whale')) continue;
        const mult = t.priceSol / w.ep;
        let f = 0;
        if (mult >= w.tp) { f = R(0.35, 1); w.tp *= R(1.4, 2.2); }
        else if (mult <= w.sl) f = 1;
        else if (chance(0.1 + fear * 3)) f = R(0.3, 1);
        if (f) sellFrac(t, w, f, now);
      }
    }
    // attention dynamics
    t.h *= Math.exp(-dt / t.tau);
    if (now < t.floorUntil && t.h < t.hFloor) t.h = t.hFloor;
    if (t.h > 3.5) t.h = 3.5;
    t.dormant = t.h < 0.03 && !t.q.length && !(t.fate === 'wash' && !t.botDone) && !(TICK[t.fate] && !t.rugged && t.trigAt);
    if (!t.revealed && t.dormant && now - t.createdAt > 15 * 60000 && (t.fate === 'dead' || t.fate === 'snipefade')) reveal(t, 'info', `$${t.symbol} died out`, now);
  }

  function simulate(t, from, to, stepMs) {
    for (let now = from; now < to; now += stepMs) step(t, Math.min(now + stepMs, to), stepMs / 1000);
  }

  // ------------------------------------------------------------ rolling stats + audit
  function summary(t) {
    const now = Date.now() / 1000, m1 = t.m1;
    let v5 = 0, v1 = 0, v6 = 0, v24 = 0, b5 = 0, s5 = 0, b1 = 0, s1 = 0, b6 = 0, s6 = 0, b24 = 0, s24 = 0, o5 = 0, o1 = 0, o6 = 0, o24 = 0;
    for (let i = m1.length - 1; i >= 0; i--) {
      const b = m1[i], age = now - b.t;
      if (age > 86400) break;
      v24 += b.v; b24 += b.buys; s24 += b.sells; o24 = b.o;
      if (age <= 21600) { v6 += b.v; b6 += b.buys; s6 += b.sells; o6 = b.o; }
      if (age <= 3600) { v1 += b.v; b1 += b.buys; s1 += b.sells; o1 = b.o; }
      if (age <= 300) { v5 += b.v; b5 += b.buys; s5 += b.sells; o5 = b.o; }
    }
    const pc = (o) => (o ? (t.price / o - 1) * 100 : 0);
    t.vol = { m5: v5, h1: v1, h6: v6, h24: v24 };
    t.chg = { m5: pc(o5), h1: pc(o1), h6: pc(o6), h24: pc(o24) };
    t.txns = { m5: { buys: b5, sells: s5 }, h1: { buys: b1, sells: s1 }, h6: { buys: b6, sells: s6 }, h24: { buys: b24, sells: s24 } };
    t.ticks = m1.slice(-30).map((b) => b.c);
  }
  function audit(t) {
    const H = t.holders;
    let top = [];
    for (const w of H) { if (top.length < 10) { top.push(w.tok); if (top.length === 10) top.sort((a, b) => a - b); } else if (w.tok > top[0]) { top[0] = w.tok; top.sort((a, b) => a - b); } }
    const sum = (arr) => (arr || []).reduce((a, w) => a + w.tok, 0) / SUPPLY * 100;
    t.audit = {
      top10: top.reduce((a, b) => a + b, 0) / SUPPLY * 100,
      dev: t.dev ? t.dev.tok / SUPPLY * 100 : 0,
      devSold: !!(t.dev && t.dev.sold > 0 && t.dev.tok < 1),
      snipers: sum(t.sp.sniper), insiders: sum(t.sp.insider) + sum(t.sp.kol), bundlers: sum(t.sp.bundle),
      holders: H.length,
      avgTrade: t.txns.h1.buys + t.txns.h1.sells ? t.vol.h1 / (t.txns.h1.buys + t.txns.h1.sells) : 0
    };
  }

  // ------------------------------------------------------------ market loop
  let feed = [];
  let timers = [];
  let lastLoop = Date.now();
  let paceMul = 1;

  function spawn(fate, ageMs) {
    const now = Date.now();
    const at = now - ageMs;
    const t = newToken(fate || pickFate(), at);
    if (ageMs > 0) { BF = true; simulate(t, at, now, 2000); BF = false; }
    summary(t); audit(t);
    D.tokens.set(t.address, t);
    return t;
  }

  function loop() {
    const now = Date.now();
    let dt = (now - lastLoop) / 1000; lastLoop = now;
    if (dt <= 0) return;
    const coarse = dt > 3; // window was throttled/minimized: catch up in big steps
    for (const t of D.tokens.values()) {
      if (coarse) { BF = t !== D.selected; simulate(t, now - dt * 1000, now, 2000); BF = false; continue; }
      if (t.dormant && t !== D.selected) { t.acc += dt; if (t.acc < 4) continue; step(t, now, t.acc); t.acc = 0; continue; }
      step(t, now, dt);
    }
    D.tps = D.tps * 0.9 + (tradeCount / Math.max(dt, 0.05)) * 0.1; tradeCount = 0;
  }

  function relist() {
    const all = [...D.tokens.values()];
    const now = Date.now();
    D.lists.new = all.filter((t) => t.stage === 'curve' && t.dex === 'pump.fun' && now - t.createdAt < 20 * 60000 && t.bonding < 45).sort((a, b) => b.createdAt - a.createdAt).slice(0, 35);
    D.lists.stretch = all.filter((t) => t.stage === 'curve' && t.bonding >= 40).sort((a, b) => b.bonding - a.bonding).slice(0, 30);
    D.lists.migrated = all.filter((t) => t.stage === 'amm').sort((a, b) => (b.migratedAt || b.createdAt) - (a.migratedAt || a.createdAt)).slice(0, 30);
    D.lists.trending = all.filter((t) => t.vol.h1 > 500 && !(t.rugged && now - t.revealedAt > 300000)).sort((a, b) => b.vol.m5 * 3 + b.vol.h1 * 0.3 - (a.vol.m5 * 3 + a.vol.h1 * 0.3)).slice(0, 30);
    ev.emit('lists');
  }

  function prune() {
    const keep = new Set([...(P.Trade ? P.Trade.heldAddresses() : []), ...(P.UI && P.UI.watchAddresses ? P.UI.watchAddresses() : [])]);
    if (D.selected) keep.add(D.selected.address);
    const all = [...D.tokens.values()];
    if (all.length <= 70) return;
    const now = Date.now();
    all.filter((t) => !keep.has(t.address) && t.dormant && now - t.lastTrade > 90000)
      .sort((a, b) => a.lastTrade - b.lastTrade)
      .slice(0, all.length - 70)
      .forEach((t) => D.tokens.delete(t.address));
  }

  // ------------------------------------------------------------ persistence of held/watched coins
  function serialize(t) {
    const ws = new Set(t.holders);
    for (const k in t.sp) t.sp[k].forEach((w) => ws.add(w));
    if (t.dev) ws.add(t.dev); if (t.you) ws.add(t.you);
    const arr = [...ws].slice(0, 3000), idx = new Map(arr.map((w, i) => [w, i]));
    const o = {};
    for (const k of Object.keys(t)) if (!['holders', 'sp', 'dev', 'you', 'q', 's1', 'ring', 'bot', 'kolW'].includes(k)) o[k] = t[k];
    o.m1 = t.m1.slice(-1440);
    o.W = arr.map((w) => [w.id, w.k, w.tok, w.cost, w.sold, w.ep, w.tp, w.sl]);
    o.SP = {}; for (const k in t.sp) o.SP[k] = t.sp[k].map((w) => idx.get(w)).filter((i) => i != null);
    o.DEV = idx.get(t.dev); o.YOU = t.you ? idx.get(t.you) : null; o.BOT = t.bot ? idx.get(t.bot) : null; o.KOL = t.kolW ? idx.get(t.kolW) : null;
    o.savedAt = Date.now();
    return o;
  }
  function deserialize(o) {
    const t = Object.assign({}, o);
    const W = o.W.map(([id, k, tok, cost, sold, ep, tp, sl]) => ({ id, k, tok, cost, sold, ep, tp, sl, hi: -1 }));
    t.holders = []; t.sp = {}; t.q = []; t.s1 = []; t.ring = [];
    for (const w of W) if (w.tok > 0) hAdd(t, w);
    for (const k in o.SP) t.sp[k] = o.SP[k].map((i) => W[i]);
    t.dev = W[o.DEV] || { id: rid(44), k: 'dev', tok: 0, cost: 0, sold: 0, ep: 0, hi: -1 };
    t.you = o.YOU != null ? W[o.YOU] : null; t.bot = o.BOT != null ? W[o.BOT] : null; t.kolW = o.KOL != null ? W[o.KOL] : null;
    delete t.W; delete t.SP; delete t.DEV; delete t.YOU; delete t.BOT; delete t.KOL;
    return t;
  }
  D.save = () => {
    try {
      const keep = new Set([...(P.Trade ? P.Trade.heldAddresses() : []), ...(P.UI && P.UI.watchAddresses ? P.UI.watchAddresses() : [])]);
      if (D.selected) keep.add(D.selected.address);
      const out = [...keep].map((a) => D.tokens.get(a)).filter(Boolean).slice(0, 15).map(serialize);
      U.store.set('market', { solUsd: D.solUsd, tokens: out });
    } catch (e) { console.warn('save market', e); }
  };
  function restore() {
    const m = U.store.get('market', null);
    if (!m || !m.tokens) return 0;
    let n = 0;
    for (const o of m.tokens) {
      try {
        const t = deserialize(o);
        const gap = Math.min(Date.now() - (o.savedAt || Date.now()), 3 * 3600000);
        if (gap > 2000) { BF = true; simulate(t, Date.now() - gap, Date.now(), 4000); BF = false; }
        summary(t); audit(t); D.tokens.set(t.address, t); n++;
      } catch (e) { console.warn('restore', e); }
    }
    return n;
  }

  // ------------------------------------------------------------ public API
  D.start = async () => {
    timers.forEach(clearInterval); timers = [];
    D.tokens.clear(); D.selected = null; feed = [];
    D.solUsd = U.store.get('market', {})?.solUsd || R(165, 215);
    ev.emit('mode', 'sim');
    ev.emit('status', { ok: null, text: 'simulating market history…' });
    await U.sleep(30);
    restore();
    const seeds = [];
    for (let i = 0; i < 26; i++) seeds.push([null, R(0, 12) * 60000]);
    for (let i = 0; i < 8; i++) seeds.push([pickFate([['runner', 4], ['migratedump', 3], ['kol', 2], ['cabal', 2], ['bundlerug', 2]]), R(4, 25) * 60000]);
    for (let i = 0; i < 9; i++) seeds.push([pickFate([['runner', 5], ['migratedump', 3], ['kol', 2], ['cabal', 2]]), R(30, 150) * 60000]);
    for (let i = 0; i < seeds.length; i++) { spawn(seeds[i][0], seeds[i][1]); if (i % 6 === 5) await U.sleep(0); }
    relist();
    lastLoop = Date.now();
    paceMul = { calm: 1.8, normal: 1, degen: 0.55 }[(P.S && P.S.get('marketPace')) || 'normal'] || 1;
    timers.push(setInterval(loop, 250));
    timers.push(setInterval(() => {
      for (const t of D.tokens.values()) if (!t.dormant || t === D.selected) summary(t);
      if (D.selected) { audit(D.selected); ev.emit('token', D.selected); }
      ev.emit('tokens');
    }, 1000));
    timers.push(setInterval(() => { for (const t of D.tokens.values()) { if (t.dormant) summary(t); audit(t); } relist(); prune(); }, 2500));
    let spawnAt = Date.now() + 2000;
    timers.push(setInterval(() => { if (Date.now() >= spawnAt) { spawn(null, 0); spawnAt = Date.now() + R(2500, 7000) * paceMul; } }, 500));
    timers.push(setInterval(() => { if (feed.length) { const f = feed; feed = []; ev.emit('trades', f); } }, 300));
    timers.push(setInterval(() => { D.solUsd *= 1 + U.gauss() * 0.0006; for (const t of D.tokens.values()) price(t); ev.emit('sol', D.solUsd); }, 5000));
    timers.push(setInterval(() => { ev.emit('status', { ok: true, text: `offline market · ${D.tokens.size} coins · ${D.tps.toFixed(0)} trades/s` }); }, 2000));
    timers.push(setInterval(D.save, 20000));
    ev.emit('sol', D.solUsd);
    ev.emit('status', { ok: true, text: 'offline market running' });
  };
  D.setPace = (p) => { paceMul = { calm: 1.8, normal: 1, degen: 0.55 }[p] || 1; };
  D.select = (t) => {
    if (!t) return;
    D.selected = t; feed = [];
    summary(t); audit(t);
    ev.emit('select', t);
  };
  D.candles = async (t, tf) => {
    if (tf === 1) return t.s1.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
    const out = [];
    for (const b of t.m1) {
      const bt = Math.floor(b.t / tf) * tf;
      const last = out[out.length - 1];
      if (last && last.t === bt) { if (b.h > last.h) last.h = b.h; if (b.l < last.l) last.l = b.l; last.c = b.c; last.v += b.v; }
      else out.push({ t: bt, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
    }
    return out;
  };
  D.search = async (q) => {
    q = q.trim().toLowerCase(); if (!q) return [];
    return [...D.tokens.values()].filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address.toLowerCase().startsWith(q)).slice(0, 25);
  };
  // reserves in SOL for the trading engine
  D.reserves = (t) => ({ Q: t.Q, B: t.B, fee: t.fee });
  D.canSell = (t) => !t.freeze;
  // execute the user's order inside the simulated pool
  D.userFill = (t, side, amt) => {
    if (!t.you) t.you = { id: 'YOU', k: 'you', tok: 0, cost: 0, sold: 0, ep: 0, hi: -1 };
    const r = trade(t, t.you, side, amt, Date.now());
    t.h *= side === 'buy' ? 1 + Math.min(0.5, amt / (t.Q * 0.3)) : 0.97;
    return r;
  };
  D.reveal = (t) => t && t.revealed;
  D.refreshSelected = () => {};
})(window.P);
