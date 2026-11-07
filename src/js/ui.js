/* Poison Terminal — UI */
(function (P) {
  const U = P.U, S = P.S, FX = P.FX, D = P.Data, T = P.Trade;
  const $ = U.$;
  const UI = (P.UI = {});

  const st = {
    list: U.store.get('ui:list', 'trending'),
    sort: 'default',
    side: 'buy',
    buyAmt: U.store.get('ui:buyAmt', S.get('buyPresets')[1]),
    sellPct: 50,
    bottom: 'trades',
    cursor: -1,
    trades: [],
    newIds: new Set(),
    watch: U.store.get('watch', {}), // address -> snapshot
    recent: U.store.get('recent', []),
    confirm: null
  };
  let chart;
  const el = {};

  // ======================================================== helpers
  const TF_LIST = [1, 60, 300, 900, 3600];
  const sel = () => D.selected;
  const supplyOf = (t) => (t && t.mc && t.price ? t.mc / t.price : 1e9);
  const stub = (p) => ({ address: p.address, pair: p.pair, symbol: p.symbol, name: p.name, image: p.image, price: p.lastPrice || 0, mc: (p.lastPrice || 0) * (p.supply || 1e9), liq: 0, vol: { m5: 0, h1: 0, h6: 0, h24: 0 }, chg: { m5: 0, h1: 0, h6: 0, h24: 0 }, txns: {}, createdAt: p.firstAt, socials: [], websites: [], stub: true });
  UI.isWatched = (a) => !!st.watch[a];
  UI.watchAddresses = () => Object.keys(st.watch);
  UI.state = st;

  function moveInk(tabs) {
    const a = tabs.querySelector('button.active'), ink = tabs.querySelector('.tab-ink');
    if (!a || !ink) return;
    ink.style.left = a.offsetLeft + 'px'; ink.style.width = a.offsetWidth + 'px';
  }

  // ======================================================== titlebar / status
  function renderTop() {
    const s = T.stats();
    FX.countTo(el.balance, s.sol, (v) => U.fmtSol(v, 3));
    FX.countTo(el.portfolio, s.portfolio, (v) => U.fmtSol(v, 3));
    FX.countTo(el.totalPnl, s.pnl, (v) => U.fmtSigned(v, (x) => x.toFixed(3)) + ' (' + U.fmtPct(s.pnlPct) + ')');
    el.totalPnl.className = U.cls(s.pnl);
  }
  function renderSol(v) { FX.countTo(el.solPrice, v, (x) => '$' + x.toFixed(2)); }

  // ======================================================== LIST
  function currentList() {
    let arr;
    switch (st.list) {
      case 'new': arr = D.lists.new.slice(); break;
      case 'surging': arr = [...D.tokens.values()].filter((t) => t.price > 0 && (t.sim || t.liq > 4000) && t.vol.m5 > 0).sort((a, b) => b.chg.m5 - a.chg.m5).slice(0, 30); break;
      case 'holdings': arr = T.held().map((p) => D.get(p.address) || stub(p)); break;
      case 'watch': arr = Object.values(st.watch).map((w) => D.get(w.address) || stub(w)); break;
      default: arr = D.lists.trending.slice();
    }
    const k = st.sort;
    if (k === 'mc') arr.sort((a, b) => b.mc - a.mc);
    else if (k === 'vol') arr.sort((a, b) => b.vol.h1 - a.vol.h1);
    else if (k === 'chg') arr.sort((a, b) => b.chg.m5 - a.chg.m5);
    else if (k === 'age') arr.sort((a, b) => b.createdAt - a.createdAt);
    else if (k === 'liq') arr.sort((a, b) => b.liq - a.liq);
    UI._list = arr;
    return arr;
  }
  function rowMeta(t) {
    const held = T.pos(t.address) && T.pos(t.address).tokens > 0;
    return `<div class="l1"><span class="sym">${U.esc(t.symbol)}</span><span class="nm">${U.esc(t.name)}</span>${held ? '<span class="badge-held">HELD</span>' : ''}${st.watch[t.address] ? '<span style="color:#ffd23d">★</span>' : ''}</div>
      <div class="l2"><span class="age">${t.createdAt ? U.ago(t.createdAt) : '—'}</span><span>MC <b>${U.fmtCompact(t.mc)}</b></span><span>V <b>${U.fmtCompact(t.vol.h1 || t.vol.h24)}</b></span><span>L <b>${U.fmtCompact(t.liq)}</b></span></div>`;
  }
  function sparkPts(t) {
    if (t.sim && t.ticks && t.ticks.length > 2) return t.ticks;
    if (!t.price) return null;
    const c = t.chg, p = t.price;
    const pts = [p / (1 + c.h24 / 100), p / (1 + c.h6 / 100), p / (1 + c.h1 / 100), p / (1 + c.m5 / 100), p];
    const tk = (t.ticks || []).slice(-6);
    return pts.concat(tk.slice(0, -1)).concat([p]).filter((x) => isFinite(x) && x > 0);
  }
  function rowRight(t) {
    const ch = st.list === 'trending' || st.list === 'holdings' ? t.chg.h1 : t.chg.m5;
    return `<div style="display:flex;align-items:center;gap:6px">${U.spark(sparkPts(t))}<span class="chg ${U.cls(ch)}">${U.fmtPct(ch, 0)}</span></div><button class="qb" data-qb>⚡ ${S.get('quickBuy')}</button>`;
  }
  function renderList() {
    const arr = currentList();
    const box = el.list;
    const existing = new Map();
    for (const c of [...box.children]) { if (c.dataset.addr) existing.set(c.dataset.addr, c); else c.remove(); }
    let prev = null;
    const s = sel();
    arr.forEach((t, i) => {
      let row = existing.get(t.address);
      if (!row) {
        row = document.createElement('div');
        row.className = 'trow'; row.dataset.addr = t.address;
        row.style.animationDelay = Math.min(i, 18) * 22 + 'ms';
        row.innerHTML = U.avatar(t) + '<div class="meta"></div><div class="right"></div>';
      } else existing.delete(t.address);
      const m = rowMeta(t), r = rowRight(t);
      if (row._m !== m) { row.children[1].innerHTML = m; row._m = m; }
      if (row._r !== r) { row.children[2].innerHTML = r; row._r = r; }
      row.classList.toggle('sel', !!s && s.address === t.address);
      row.classList.toggle('cursor', i === st.cursor);
      if (row._p && t.price && t.price !== row._p && S.get('effects') !== 'off') {
        row.classList.remove('flash-up', 'flash-down'); void row.offsetWidth;
        row.classList.add(t.price > row._p ? 'flash-up' : 'flash-down');
      }
      row._p = t.price;
      const ref = prev ? prev.nextSibling : box.firstChild;
      if (ref !== row) box.insertBefore(row, ref);
      prev = row;
    });
    existing.forEach((r) => r.remove());
    if (!arr.length) {
      const msg = { holdings: ['💼', 'No open positions yet.<br>Hit <kbd>1</kbd>–<kbd>4</kbd> to quick-buy the selected token.'], watch: ['★', 'Watchlist is empty.<br>Press <kbd>F</kbd> on a token to add it.'] }[st.list] || ['⏳', 'Loading market…'];
      box.innerHTML = `<div class="empty"><div class="big">${msg[0]}</div>${msg[1]}</div>`;
    }
  }
  const renderListThrottled = U.rafThrottle(renderList);

  UI.setList = (name) => {
    st.list = name; st.cursor = -1; U.store.set('ui:list', name);
    el.listTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.list === name));
    moveInk(el.listTabs);
    el.list.innerHTML = '';
    renderList();
    el.list.scrollTop = 0;
  };
  UI.moveCursor = (dir) => {
    const arr = UI._list || currentList();
    if (!arr.length) return;
    const s = sel();
    let i = st.cursor >= 0 ? st.cursor : arr.findIndex((t) => s && t.address === s.address);
    i = U.clamp(i + dir, 0, arr.length - 1);
    st.cursor = i;
    UI.select(arr[i]);
    const row = el.list.children[i];
    row && row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // ======================================================== SELECT
  let candleTimer = 0;
  UI.select = (t) => {
    if (!t) return;
    if (t.stub && D.mode === 'live') {
      D.search(t.address).then((r) => { const f = r.find((x) => x.address === t.address); if (f) UI.select(f); });
    }
    const cached = D.get(t.address) || t;
    D.select(cached);
    U.store.set('ui:sel', { address: cached.address, pair: cached.pair, symbol: cached.symbol, name: cached.name, image: cached.image });
    st.recent = [{ address: cached.address, pair: cached.pair, symbol: cached.symbol, name: cached.name, image: cached.image }].concat(st.recent.filter((r) => r.address !== cached.address)).slice(0, 8);
    U.store.set('recent', st.recent);
    st.trades = []; st.newIds.clear();
    buildHeader(); updateHeader(true); renderTrade(); renderPosition(true); renderInfo(); renderBottom();
    renderList();
    chart.symbol = cached.symbol;
    chart.setData([], S.get('tf'));
    chart.setMult(S.get('chartUnit') === 'mc' ? supplyOf(cached) : 1);
    updateChartOverlays();
    el.chartLoading.classList.add('on');
    clearTimeout(candleTimer);
    candleTimer = setTimeout(() => loadCandles(cached), 180);
  };
  async function loadCandles(t) {
    const tf = S.get('tf');
    el.chartLoading.classList.add('on');
    const c = await D.candles(t, tf);
    if (sel() !== t || S.get('tf') !== tf) return;
    el.chartLoading.classList.remove('on');
    chart.setData(c, tf);
    if (!c.length && t.price) chart.tick(t.price, 0, Date.now());
  }
  UI.setTf = (tf) => {
    S.set('tf', tf);
    el.tfSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.tf === tf));
    if (sel()) { chart.setData([], tf); loadCandles(sel()); }
  };
  UI.cycleTf = (d) => { const i = TF_LIST.indexOf(S.get('tf')); UI.setTf(TF_LIST[U.clamp(i + d, 0, TF_LIST.length - 1)]); };
  UI.setUnit = (u) => {
    S.set('chartUnit', u);
    el.unitSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.unit === u));
    chart.setUnit(u); chart.setMult(u === 'mc' ? supplyOf(sel()) : 1);
  };
  UI.toggleUnit = () => UI.setUnit(S.get('chartUnit') === 'mc' ? 'price' : 'mc');
  UI.chartCloses = (addr) => (sel() && sel().address === addr ? chart.data.slice(-150).map((c) => c.c) : null);

  function updateChartOverlays() {
    const t = sel(); if (!t) return;
    const marks = T.history().filter((h) => h.address === t.address && h.status === 'ok').map((h) => ({ t: h.t, side: h.side, price: h.price }));
    chart.setMarkers(marks);
    const p = T.pos(t.address);
    chart.setEntry(p && p.tokens > 0 ? T.metrics(p, t).avgEntry : null);
  }

  // ======================================================== HEADER
  function buildHeader() {
    const t = sel();
    if (!t) { el.header.innerHTML = '<div class="empty" style="padding:10px">Select a token</div>'; return; }
    const ext = [];
    for (const s of t.socials || []) {
      const icon = { twitter: '𝕏', telegram: '✈', discord: '◆', tiktok: '♪' }[s.type] || '🔗';
      ext.push(`<span class="chip" data-url="${U.esc(s.url)}" title="${U.esc(s.type)}">${icon}</span>`);
    }
    for (const w of (t.websites || []).slice(0, 1)) ext.push(`<span class="chip" data-url="${U.esc(w.url)}" title="Website">🌐</span>`);
    if (!t.sim) {
      ext.push(`<span class="chip" data-url="https://dexscreener.com/solana/${U.esc(t.pair)}" title="DexScreener (D)">DS</span>`);
      ext.push(`<span class="chip" data-url="https://solscan.io/token/${U.esc(t.address)}" title="Solscan">SCAN</span>`);
    }
    el.header.innerHTML = `
      <div class="th-id">${U.avatar(t, 'lg')}
        <div class="th-names">
          <div class="th-sym">$${U.esc(t.symbol)} <span class="star ${st.watch[t.address] ? 'on' : ''}" data-star title="Watchlist (F)">★</span></div>
          <div class="th-sub"><span>${U.esc(t.name)}</span>
            <span class="chip" data-copy title="Copy contract (C)"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>${U.short(t.address, 4)}</span>
            <span class="chip">${U.esc(t.dex || 'dex')}</span><span id="hAge">${t.createdAt ? U.ago(t.createdAt) : ''}</span>${ext.join('')}
          </div>
        </div>
      </div>
      <div class="th-stats">
        <div class="th-stat hero"><span>Market cap</span><b id="hMc">—</b></div>
        <div class="th-stat"><span>Price</span><b id="hPrice">—</b></div>
        <div class="th-stat"><span>Liquidity</span><b id="hLiq">—</b></div>
        <div class="th-stat"><span>Vol 24h</span><b id="hVol">—</b></div>
        <div class="th-stat"><span>1h</span><b id="hH1">—</b></div>
        <div class="th-stat"><span>24h</span><b id="hH24">—</b></div>
      </div>`;
  }
  function updateHeader(first) {
    const t = sel(); if (!t) return;
    const g = (id) => document.getElementById(id);
    const mc = g('hMc'); if (!mc) return;
    const dir = first ? 0 : Math.sign(t.price - (mc._lastPrice || t.price));
    mc._lastPrice = t.price;
    FX.countTo(mc, t.mc, (v) => U.fmtCompact(v));
    g('hPrice').textContent = U.fmtPrice(t.price);
    g('hLiq').textContent = U.fmtCompact(t.liq);
    g('hVol').textContent = U.fmtCompact(t.vol.h24);
    g('hH1').textContent = U.fmtPct(t.chg.h1); g('hH1').className = U.cls(t.chg.h1);
    g('hH24').textContent = U.fmtPct(t.chg.h24); g('hH24').className = U.cls(t.chg.h24);
    g('hAge').textContent = t.createdAt ? U.ago(t.createdAt) : '';
    if (dir) { FX.tickClass(mc, dir); FX.tickClass(g('hPrice'), dir); }
  }

  // ======================================================== TRADE PANEL
  function renderTrade() {
    const t = sel();
    el.sideToggle.dataset.side = st.side;
    el.sideToggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.side === st.side));
    const K = P.Keys ? P.Keys.label : () => '';
    const sym = t ? '$' + U.esc(t.symbol) : '';
    if (st.side === 'buy') {
      const pr = S.get('buyPresets');
      el.trade.innerHTML = `
        <div class="presets">${pr.map((v, i) => `<button class="preset ${+st.buyAmt === +v ? 'sel' : ''}" data-buy="${v}">${v}<small>◎ · ${K('buy' + (i + 1))}</small></button>`).join('')}</div>
        <div class="amt-row"><input id="amtIn" type="number" min="0" step="0.01" value="${st.buyAmt}"><span class="unit">SOL</span><button class="max" data-max>MAX</button></div>
        <div class="quote" id="quote"></div>
        <button class="exec" id="execBtn" ${t ? '' : 'disabled'}><span>Buy ${sym}</span><kbd>${K('execute')}</kbd></button>
        ${tradeSettings()}`;
    } else {
      const pr = S.get('sellPresets');
      el.trade.innerHTML = `
        <div class="presets">${pr.map((v, i) => `<button class="preset sell ${+st.sellPct === +v ? 'sel' : ''}" data-sell="${v}">${v}%<small>${K('sell' + (i + 1))}</small></button>`).join('')}</div>
        <div class="amt-row"><input id="amtIn" type="number" min="0" max="100" step="1" value="${st.sellPct}"><span class="unit">%</span><button class="max" data-max>100%</button></div>
        <div class="quote" id="quote"></div>
        <button class="exec sell" id="execBtn" ${t ? '' : 'disabled'}><span>Sell ${sym}</span><kbd>${K('execute')}</kbd></button>
        ${tradeSettings()}`;
    }
    renderQuote();
  }
  function tradeSettings() {
    return `<div class="trade-settings">
        <label class="ts-chip" title="Slippage tolerance">Slip<input data-set="slippage" type="number" value="${S.get('slippage')}">%</label>
        <label class="ts-chip" title="Priority fee (SOL)">Prio<input data-set="priorityFee" type="number" step="0.0001" value="${S.get('priorityFee')}">◎</label>
      </div>
      <div class="autotp"><div class="switch ${S.get('autoTpSl') ? 'on' : ''}" data-autotp></div><span>Auto TP <b class="up">+${S.get('tp')}%</b> (${S.get('tpSell')}%) · SL <b class="down">${S.get('sl')}%</b> (${S.get('slSell')}%) on new buys</span></div>`;
  }
  function renderQuote() {
    const box = document.getElementById('quote'); if (!box) return;
    const t = sel();
    if (!t) { box.innerHTML = '<span>Select a token</span><b></b>'; return; }
    if (st.side === 'buy') {
      const q = T.quote(t, 'buy', +st.buyAmt);
      if (!q) { box.innerHTML = '<span>Enter amount</span><b>—</b>'; return; }
      const slip = S.get('slippage') / 100;
      box.innerHTML = `<span>You receive</span><b>${U.fmtCompact(q.out, '')} ${U.esc(t.symbol)}</b>
        <span>Entry MC</span><b>${U.fmtCompact(q.avg * supplyOf(t))}</b>
        <span>Price impact</span><b class="${q.impact > 5 ? 'warn' : ''}">${q.impact.toFixed(2)}%</b>
        <span>Fees</span><b>${(q.platform + q.network).toFixed(5)} ◎</b>
        <span>Min received</span><b>${U.fmtCompact(q.out * (1 - slip), '')}</b>`;
    } else {
      const p = T.pos(t.address);
      if (!p || p.tokens <= 0) { box.innerHTML = '<span>No position</span><b>—</b>'; return; }
      const qty = +st.sellPct >= 100 ? p.tokens : p.tokens * (+st.sellPct / 100);
      const q = T.quote(t, 'sell', qty);
      if (!q) { box.innerHTML = '<span>Enter %</span><b>—</b>'; return; }
      box.innerHTML = `<span>Selling</span><b>${U.fmtCompact(qty, '')} ${U.esc(t.symbol)}</b>
        <span>You receive</span><b>${q.out.toFixed(4)} ◎ <span class="muted">(${U.fmtCompact(q.out * D.solUsd)})</span></b>
        <span>Price impact</span><b class="${q.impact > 5 ? 'warn' : ''}">${q.impact.toFixed(2)}%</b>
        <span>Fees</span><b>${(q.platform + q.network).toFixed(5)} ◎</b>`;
    }
  }
  UI.setSide = (s) => { st.side = s; renderTrade(); FX.sound('click'); };
  UI.toggleSide = () => UI.setSide(st.side === 'buy' ? 'sell' : 'buy');
  UI.focusAmount = () => { const i = document.getElementById('amtIn'); if (i) { i.focus(); i.select(); } };

  async function doTrade(t, side, amt, src) {
    if (!t) { FX.toast('Select a token first', '', 'err'); FX.sound('error'); return; }
    if (side === 'buy' && S.get('confirmLarge') && amt > T.balance() * 0.5) {
      const k = t.address + ':' + amt;
      if (!st.confirm || st.confirm.k !== k || Date.now() - st.confirm.t > 3000) {
        st.confirm = { k, t: Date.now() };
        FX.toast('Large order — confirm', `Press again to buy ${amt} SOL (more than 50% of your balance)`, 'info', 3000);
        FX.sound('alert'); return;
      }
      st.confirm = null;
    }
    const btn = document.getElementById('execBtn');
    btn && btn.classList.add('busy');
    FX.sound('click');
    try {
      const r = await T.execute(t, side, amt);
      const target = src && document.body.contains(src) ? src : btn;
      FX.burstAt(target, side === 'buy' ? S.get('upColor') : S.get('downColor'));
      FX.edge(side === 'buy' ? 'up' : 'down');
      if (side === 'buy') {
        FX.sound('buy');
        FX.toast(`Bought ${U.fmtCompact(r.tokens, '')} $${U.esc(t.symbol)}`, `${r.sol.toFixed(4)} ◎ @ ${U.fmtCompact(r.mc)} MC · impact ${r.impact.toFixed(2)}% · landed ${r.latency}ms`, 'ok');
      } else {
        const win = r.pnl >= 0;
        FX.sound(win ? 'profit' : 'loss');
        FX.toast(`Sold ${U.fmtCompact(r.tokens, '')} $${U.esc(t.symbol)}`, `+${r.sol.toFixed(4)} ◎ · PnL ${U.fmtSigned(r.pnl, (v) => v.toFixed(4))} ◎ (${U.fmtPct(r.pnlPct)})`, win ? 'ok' : 'err');
        if (target) { const rc = target.getBoundingClientRect(); FX.floatText(rc.left + rc.width / 2, rc.top, U.fmtPct(r.pnlPct), win ? S.get('upColor') : S.get('downColor')); }
        if (win && r.pnlPct >= 25) FX.confetti();
      }
    } catch (e) {
      FX.sound('error');
      FX.toast(e.failed ? 'Transaction failed' : 'Order rejected', U.esc(e.message), 'err');
    } finally { btn && btn.classList.remove('busy'); }
  }
  UI.buyPreset = (i, src) => { const v = S.get('buyPresets')[i]; if (v == null) return; st.buyAmt = v; if (st.side !== 'buy') { st.side = 'buy'; } renderTrade(); doTrade(sel(), 'buy', +v, src || el.trade.querySelectorAll('.preset')[i]); };
  UI.sellPreset = (i, src) => { const v = S.get('sellPresets')[i]; if (v == null) return; st.sellPct = v; if (st.side !== 'sell') { st.side = 'sell'; } renderTrade(); doTrade(sel(), 'sell', +v, src || el.trade.querySelectorAll('.preset')[i]); };
  UI.execute = () => doTrade(sel(), st.side, st.side === 'buy' ? +st.buyAmt : +st.sellPct, document.getElementById('execBtn'));
  UI.quickBuy = (t, src) => doTrade(t, 'buy', +S.get('quickBuy'), src);
  UI.sellToken = (addr, pct, src) => { const t = D.get(addr) || (T.pos(addr) && stub(T.pos(addr))); doTrade(t, 'sell', pct, src); };
  UI.panicSell = async () => {
    const held = T.held();
    if (!held.length) { FX.toast('Nothing to sell', '', 'info'); return; }
    FX.toast('🚨 Panic sell', `Selling ${held.length} position(s) at market`, 'info');
    for (const p of held) await doTrade(D.get(p.address) || stub(p), 'sell', 100);
  };

  // ======================================================== POSITION PANEL
  function renderPosition(full) {
    const t = sel();
    const p = t && T.pos(t.address);
    if (full || !el.position.querySelector('.pp-stats')) {
      el.position.innerHTML = `<div class="pp-stats"></div><div class="pp-rules"></div>`;
    }
    const statsBox = el.position.querySelector('.pp-stats');
    if (!p || p.buys === 0) {
      const s = T.stats();
      statsBox.innerHTML = `<div class="pp-head"><span class="pp-title">Your position</span><button class="share-btn" data-share="__portfolio__"><svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M12 3v13M7 8l5-5 5 5"/></svg>Share</button></div>
        <div class="muted" style="margin:4px 0 10px">No position in ${t ? '$' + U.esc(t.symbol) : 'this token'} yet.</div>
        <div class="pp-grid"><div class="pp-cell"><span>Balance</span><b>${U.fmtSol(s.sol, 3)}</b></div><div class="pp-cell"><span>Win rate</span><b>${s.winRate.toFixed(0)}% <span class="muted">${s.wins}W/${s.losses}L</span></b></div>
        <div class="pp-cell"><span>Session PnL</span><b class="${U.cls(s.pnl)}">${U.fmtSigned(s.pnl, (v) => v.toFixed(3))} ◎</b></div><div class="pp-cell"><span>Volume</span><b>${s.volume.toFixed(2)} ◎</b></div></div>`;
      el.position.querySelector('.pp-rules').innerHTML = '';
      return;
    }
    const m = T.metrics(p, t);
    const mode = S.get('chartUnit');
    const prevTotal = statsBox._total;
    statsBox._total = m.total;
    statsBox.innerHTML = `<div class="pp-head"><span class="pp-title">Your position ${p.tokens > 0 ? '' : '· closed'}</span><button class="share-btn" data-share="${p.address}"><svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M12 3v13M7 8l5-5 5 5"/></svg>Share PnL <kbd>${P.Keys ? P.Keys.label('pnl') : 'P'}</kbd></button></div>
      <div style="display:flex;align-items:baseline;gap:10px"><div class="pp-pnl ${U.cls(m.total)}" id="ppPnl">${U.fmtSigned(m.total, (v) => v.toFixed(4))} ◎</div><span class="pp-pct ${U.cls(m.total)}">${U.fmtPct(m.totalPct)}</span></div>
      <div class="muted mono" style="font-size:.85em">${U.fmtSigned(m.totalUsd, (v) => '$' + U.fmtNum(v, 2))}</div>
      <div class="pp-grid">
        <div class="pp-cell"><span>Holding</span><b>${m.value.toFixed(4)} ◎</b></div>
        <div class="pp-cell"><span>Unrealized</span><b class="${U.cls(m.unreal)}">${U.fmtSigned(m.unreal, (v) => v.toFixed(4))} ◎</b></div>
        <div class="pp-cell"><span>Invested</span><b>${p.invested.toFixed(4)} ◎</b></div>
        <div class="pp-cell"><span>Sold</span><b>${p.sold.toFixed(4)} ◎</b></div>
        <div class="pp-cell"><span>Avg entry</span><b>${mode === 'mc' ? U.fmtCompact(m.avgEntryMc) : U.fmtPrice(m.avgEntry)}</b></div>
        <div class="pp-cell"><span>Tokens</span><b>${U.fmtCompact(p.tokens, '')}</b></div>
      </div>`;
    if (prevTotal != null && Math.sign(m.total - prevTotal)) FX.tickClass(document.getElementById('ppPnl'), Math.sign(m.total - prevTotal));
    const rules = el.position.querySelector('.pp-rules');
    if (full || !rules.innerHTML) {
      if (p.tokens > 0) {
        const r = p.rules || { tp: { pct: S.get('tp'), sell: S.get('tpSell'), done: false }, sl: { pct: S.get('sl'), sell: S.get('slSell'), done: false } };
        const on = !!p.rules;
        rules.innerHTML = `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
          <div class="autotp"><div class="switch ${on ? 'on' : ''}" data-rules></div><span>TP / SL automation ${on && (r.tp.done || r.sl.done) ? '<span class="muted">(' + (r.tp.done ? 'TP hit' : '') + (r.sl.done ? ' SL hit' : '') + ')</span>' : ''}</span></div>
          <div class="trade-settings">
            <label class="ts-chip" style="color:var(--up)">TP %<input data-rule="tp.pct" type="number" value="${r.tp.pct}"></label>
            <label class="ts-chip">sell<input data-rule="tp.sell" type="number" value="${r.tp.sell}">%</label>
          </div>
          <div class="trade-settings">
            <label class="ts-chip" style="color:var(--down)">SL %<input data-rule="sl.pct" type="number" value="${r.sl.pct}"></label>
            <label class="ts-chip">sell<input data-rule="sl.sell" type="number" value="${r.sl.sell}">%</label>
          </div></div>`;
      } else rules.innerHTML = '';
    }
  }
  function readRules() {
    const t = sel(); if (!t) return null;
    const get = (k) => +(el.position.querySelector(`[data-rule="${k}"]`) || {}).value;
    return { tp: { pct: get('tp.pct'), sell: U.clamp(get('tp.sell'), 1, 100), done: false }, sl: { pct: -Math.abs(get('sl.pct')), sell: U.clamp(get('sl.sell'), 1, 100), done: false } };
  }

  // ======================================================== INFO PANEL
  function renderInfo() {
    const t = sel();
    if (!t) { el.info.innerHTML = ''; return; }
    const tx = t.txns.h1 || { buys: 0, sells: 0 }, tx5 = t.txns.m5 || { buys: 0, sells: 0 }, tx24 = t.txns.h24 || { buys: 0, sells: 0 };
    const pctB = (o) => (o.buys + o.sells ? (o.buys / (o.buys + o.sells)) * 100 : 50);
    const cell = (k, v) => `<div class="chg-cell"><span>${k}</span><b class="${U.cls(v)}">${U.fmtPct(v)}</b></div>`;
    const bs = (label, o) => `<div style="margin-top:8px"><div class="bs-legend"><span class="up">${label} buys ${U.fmtNum(o.buys, 0)}</span><span class="down">sells ${U.fmtNum(o.sells, 0)}</span></div><div class="bs-bar"><i style="width:${pctB(o)}%"></i></div></div>`;
    el.info.innerHTML = `<div class="pp-title" style="margin-bottom:6px">Token stats</div>
      <div class="chg-grid">${cell('5m', t.chg.m5)}${cell('1h', t.chg.h1)}${cell('6h', t.chg.h6)}${cell('24h', t.chg.h24)}</div>
      ${bs('5m', tx5)}${bs('1h', tx)}${bs('24h', tx24)}
      <div style="margin-top:10px">
        <div class="ip-row"><span>Vol 5m / 1h</span><b>${U.fmtCompact(t.vol.m5)} / ${U.fmtCompact(t.vol.h1)}</b></div>
        <div class="ip-row"><span>Liquidity</span><b>${U.fmtCompact(t.liq)}${t.liq && t.mc ? ` <span class="muted">(${((t.liq / t.mc) * 100).toFixed(0)}% of MC)</span>` : ''}</b></div>
        <div class="ip-row"><span>FDV</span><b>${U.fmtCompact(t.fdv || t.mc)}</b></div>
        <div class="ip-row"><span>Price (SOL)</span><b>${U.fmtPrice(t.priceNative || (D.solUsd ? t.price / D.solUsd : 0), '')}</b></div>
        <div class="ip-row"><span>Pair</span><b class="link" data-copy-pair>${U.short(t.pair, 5)}</b></div>
        <div class="ip-row"><span>Created</span><b>${t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}</b></div>
      </div>`;
  }

  // ======================================================== BOTTOM
  function renderBottom() {
    const b = el.bottomBody;
    if (st.bottom === 'trades') {
      const t = sel();
      const mcMode = S.get('chartUnit') === 'mc';
      const sup = supplyOf(t);
      const rows = st.trades.slice(0, 120).map((x) => `<tr class="${st.newIds.has(x.id) ? 'new' : ''} ${x.mine ? 'mine' : ''}">
        <td class="muted">${U.ago(x.t)}</td><td class="${x.side === 'buy' ? 'side-b' : 'side-s'}">${x.side === 'buy' ? 'Buy' : 'Sell'}</td>
        <td>${mcMode ? U.fmtCompact(x.price * sup) : U.fmtPrice(x.price)}</td>
        <td class="${x.side === 'buy' ? 'up' : 'down'}">${U.fmtCompact(x.usd)}</td>
        <td>${U.fmtCompact(x.amount, '')}</td><td>${D.solUsd ? (x.usd / D.solUsd).toFixed(3) : '—'}</td>
        <td class="muted">${x.mine ? '<b style="color:var(--accent)">YOU</b>' : U.short(x.maker, 4)}</td></tr>`).join('');
      b.innerHTML = `<table class="grid"><thead><tr><th>Age</th><th>Type</th><th>${mcMode ? 'MC' : 'Price'}</th><th>USD</th><th>Amount</th><th>SOL</th><th>Maker</th></tr></thead><tbody>${rows}</tbody></table>${st.trades.length ? '' : '<div class="empty">Waiting for trades…</div>'}`;
      st.newIds.clear();
    } else if (st.bottom === 'positions') {
      const ps = T.positions().filter((p) => p.buys > 0).sort((a, c) => (c.tokens > 0) - (a.tokens > 0) || c.lastAt - a.lastAt);
      const rows = ps.map((p) => {
        const m = T.metrics(p);
        return `<tr><td><span class="link" data-goto="${p.address}">$${U.esc(p.symbol)}</span> ${p.tokens > 0 ? '' : '<span class="muted">closed</span>'}</td>
          <td>${p.tokens > 0 ? m.value.toFixed(4) + ' ◎' : '—'}</td><td>${p.invested.toFixed(4)}</td><td>${p.sold.toFixed(4)}</td>
          <td class="${U.cls(m.total)}">${U.fmtSigned(m.total, (v) => v.toFixed(4))}</td><td class="${U.cls(m.total)}">${U.fmtPct(m.totalPct)}</td>
          <td>${U.fmtCompact(m.avgEntryMc)}</td><td>${U.fmtCompact(m.mc)}</td>
          <td>${p.tokens > 0 ? `<button class="mini-btn sell" data-sellpos="${p.address}" data-pct="50">50%</button><button class="mini-btn sell" data-sellpos="${p.address}" data-pct="100">100%</button>` : `<button class="mini-btn" data-rmpos="${p.address}">clear</button>`}<button class="mini-btn share" data-share="${p.address}">share</button></td></tr>`;
      }).join('');
      b.innerHTML = `<table class="grid"><thead><tr><th>Token</th><th>Holding</th><th>Invested</th><th>Sold</th><th>PnL ◎</th><th>PnL %</th><th>Entry MC</th><th>Now MC</th><th></th></tr></thead><tbody>${rows}</tbody></table>${ps.length ? '' : '<div class="empty">No positions yet</div>'}`;
    } else {
      const rows = T.history().slice(0, 200).map((h) => `<tr><td class="muted">${U.time(h.t)}</td><td class="${h.side === 'buy' ? 'side-b' : 'side-s'}">${h.side.toUpperCase()}</td>
        <td><span class="link" data-goto="${h.address}">$${U.esc(h.symbol)}</span></td><td>${h.sol ? h.sol.toFixed(4) : '—'}</td><td>${h.tokens ? U.fmtCompact(h.tokens, '') : '—'}</td>
        <td>${U.fmtCompact(h.mc)}</td><td class="muted">${(h.fee || 0).toFixed(5)}</td>
        <td>${h.status === 'ok' ? (h.pnl != null ? `<span class="${U.cls(h.pnl)}">${U.fmtSigned(h.pnl, (v) => v.toFixed(4))} (${U.fmtPct(h.pnlPct)})</span>` : '<span class="up">filled</span>') : `<span class="down">${U.esc(h.reason || 'failed')}</span>`}</td>
        <td class="muted">${h.latency ? h.latency + 'ms' : ''}</td></tr>`).join('');
      b.innerHTML = `<table class="grid"><thead><tr><th>Time</th><th>Side</th><th>Token</th><th>SOL</th><th>Tokens</th><th>MC</th><th>Fee</th><th>Result</th><th>Land</th></tr></thead><tbody>${rows}</tbody></table>${T.history().length ? '' : '<div class="empty">No trades yet</div>'}`;
    }
  }
  const renderBottomThrottled = U.rafThrottle(renderBottom);
  UI.setBottom = (tab) => {
    st.bottom = tab;
    el.bottomTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    moveInk(el.bottomTabs); renderBottom();
  };

  // ======================================================== WATCH / COPY
  UI.toggleWatch = () => {
    const t = sel(); if (!t) return;
    if (st.watch[t.address]) { delete st.watch[t.address]; FX.toast('Removed from watchlist', '$' + U.esc(t.symbol), 'info', 1800); }
    else { st.watch[t.address] = { address: t.address, pair: t.pair, symbol: t.symbol, name: t.name, image: t.image }; FX.toast('Added to watchlist ★', '$' + U.esc(t.symbol), 'ok', 1800); }
    U.store.set('watch', st.watch);
    const star = el.header.querySelector('[data-star]'); star && star.classList.toggle('on', !!st.watch[t.address]);
    FX.sound('click'); renderList();
  };
  UI.copyCA = () => { const t = sel(); if (!t) return; U.copy(t.address); FX.toast('Contract copied', U.short(t.address, 8), 'ok', 1800); FX.sound('click'); };
  UI.openDex = () => { const t = sel(); if (t && !t.sim) U.open('https://dexscreener.com/solana/' + t.pair); };
  UI.toggleZen = () => { document.body.classList.toggle('zen'); chart && chart.resize(); };

  // ======================================================== MODALS
  const modals = [];
  function openModal(html, cls = '', onClose) {
    const back = document.createElement('div');
    back.className = 'modal-back ' + cls;
    back.innerHTML = html;
    document.getElementById('modalRoot').appendChild(back);
    const m = { back, close() { back.classList.add('out'); setTimeout(() => back.remove(), 200); modals.splice(modals.indexOf(m), 1); onClose && onClose(); } };
    back.addEventListener('mousedown', (e) => { if (e.target === back || e.target.closest('[data-x]')) m.close(); });
    modals.push(m);
    FX.sound('open');
    return m;
  }
  UI.modalOpen = () => modals.length > 0 || P.PnL.isOpen();
  UI.closeTop = () => {
    if (P.PnL.isOpen()) { P.PnL.close(); return true; }
    const m = modals[modals.length - 1]; if (m) { m.close(); return true; }
    return false;
  };

  // ---------- search / command palette
  UI.openSearch = (prefill = '') => {
    if (modals.find((m) => m.kind === 'search')) return;
    const m = openModal(`<div class="modal palette"><div class="palette-input"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="Search symbol, name, contract… or > for commands" spellcheck="false"></div><div class="palette-list"></div><div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> quick-buy ${S.get('quickBuy')} ◎</span><span><kbd>Esc</kbd> close</span></div></div>`);
    m.kind = 'search';
    const input = m.back.querySelector('input'), list = m.back.querySelector('.palette-list');
    let items = [], active = 0, reqId = 0;
    input.value = prefill;
    const commands = () => [
      { t: 'Open PnL card', s: 'share your trade', ico: '🎴', run: () => P.PnL.open() },
      { t: 'Settings', s: 'theme, presets, fees, shortcuts', ico: '⚙', run: () => UI.openSettings() },
      { t: 'Keyboard shortcuts', s: 'view all hotkeys', ico: '⌨', run: () => UI.openHelp() },
      { t: 'Toggle zen mode', s: 'chart only', ico: '🧘', run: UI.toggleZen },
      { t: 'Panic sell everything', s: 'market-sell all open positions', ico: '🚨', run: UI.panicSell },
      { t: 'Data: Live market', s: 'DexScreener + GeckoTerminal', ico: '🟢', run: () => { S.set('dataMode', 'live'); restartData(); } },
      { t: 'Data: Simulated market', s: 'offline AMM simulator', ico: '🟡', run: () => { S.set('dataMode', 'sim'); restartData(); } },
      { t: 'Toggle sound', s: S.get('sound') ? 'currently on' : 'currently off', ico: '🔊', run: () => S.set('sound', !S.get('sound')) },
      ...['high', 'low', 'off'].map((l) => ({ t: 'Effects: ' + l, s: 'animation intensity', ico: '✨', run: () => S.set('effects', l) })),
      ...Object.entries(S.THEMES).map(([k, th]) => ({ t: 'Theme: ' + th.name, s: th.accent, ico: `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,${th.accent},${th.accent2})"></span>`, run: () => S.setMany({ theme: k, customAccent: null }) })),
      { t: 'Reset paper account', s: 'back to ' + S.get('startBalance') + ' SOL', ico: '♻', run: () => { T.reset(S.get('startBalance')); FX.toast('Account reset', S.get('startBalance') + ' SOL', 'ok'); } }
    ];
    const tokItem = (t) => ({ tok: t, t: '$' + t.symbol, s: t.name + ' · ' + U.short(t.address, 5), r: `${U.fmtCompact(t.mc)} <span class="${U.cls(t.chg.h24)}">${U.fmtPct(t.chg.h24, 0)}</span>` });
    function draw() {
      let html = '', group = null;
      items.forEach((it, i) => {
        if (it.group !== group) { group = it.group; html += `<div class="pal-group">${group}</div>`; }
        html += `<div class="pal-item ${i === active ? 'active' : ''}" data-i="${i}">${it.tok ? U.avatar(it.tok, 'sm') : `<span class="pal-ico">${it.ico || '›'}</span>`}<div class="pi-main"><div class="pi-t">${U.esc(it.t)}</div><div class="pi-s">${U.esc(it.s || '')}</div></div>${it.r ? `<div class="pi-r">${it.r}</div>` : ''}</div>`;
      });
      list.innerHTML = html || '<div class="empty">No results</div>';
      const a = list.querySelector('.pal-item.active'); a && a.scrollIntoView({ block: 'nearest' });
    }
    function local(q) {
      q = q.toLowerCase();
      return [...D.tokens.values()].filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.address === q || t.address.toLowerCase().startsWith(q))
        .sort((a, b) => (b.symbol.toLowerCase() === q) - (a.symbol.toLowerCase() === q) || b.liq - a.liq).slice(0, 8);
    }
    const remote = U.debounce(async (q, id) => {
      const res = await D.search(q);
      if (id !== reqId) return;
      const seen = new Set(items.filter((i) => i.tok).map((i) => i.tok.address));
      const add = res.filter((t) => !seen.has(t.address)).sort((a, b) => b.liq - a.liq).slice(0, 15).map((t) => ({ ...tokItem(t), group: 'Search results' }));
      items = items.concat(add); draw();
    }, 260);
    function update() {
      const q = input.value.trim(); reqId++; active = 0;
      if (q.startsWith('>')) {
        const qq = q.slice(1).trim().toLowerCase();
        items = commands().filter((c) => !qq || c.t.toLowerCase().includes(qq)).map((c) => ({ ...c, group: 'Commands' }));
      } else if (!q) {
        items = st.recent.map((r) => ({ ...tokItem(D.get(r.address) || { ...stub(r), chg: { h24: 0 } }), group: 'Recent' })).concat(commands().slice(0, 4).map((c) => ({ ...c, group: 'Commands' })));
      } else {
        items = local(q).map((t) => ({ ...tokItem(t), group: 'Tokens' }));
        remote(q, reqId);
      }
      draw();
    }
    function choose(i, quick) {
      const it = items[i]; if (!it) return;
      m.close();
      if (it.tok) { UI.select(D.get(it.tok.address) || it.tok); if (quick) UI.quickBuy(D.get(it.tok.address) || it.tok); }
      else it.run && it.run();
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { choose(active, e.shiftKey); e.preventDefault(); }
    });
    list.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (r) choose(+r.dataset.i, e.shiftKey); });
    list.addEventListener('mousemove', (e) => { const r = e.target.closest('[data-i]'); if (r && +r.dataset.i !== active) { active = +r.dataset.i; list.querySelectorAll('.pal-item').forEach((x) => x.classList.toggle('active', +x.dataset.i === active)); } });
    update();
    setTimeout(() => input.focus(), 30);
  };

  // ---------- help
  UI.openHelp = () => {
    if (modals.find((m) => m.kind === 'help')) return;
    const rows = P.Keys.list().map(([id, label, key]) => `<div class="help-row"><span>${label}</span><kbd>${U.esc(key || '—')}</kbd></div>`).join('');
    const m = openModal(`<div class="modal help"><div class="modal-head"><h2>⌨ Keyboard shortcuts</h2><button class="btn" data-rebind>Customize</button><button class="modal-x" data-x>✕</button></div><div class="help-grid">${rows}
      <div class="help-row"><span>Close / back</span><kbd>Esc</kbd></div><div class="help-row"><span>Search (alt)</span><kbd>/</kbd></div></div></div>`, 'center');
    m.kind = 'help';
    m.back.querySelector('[data-rebind]').onclick = () => { m.close(); UI.openSettings('keys'); };
  };

  // ---------- settings
  UI.openSettings = (tab = 'look') => {
    if (modals.find((m) => m.kind === 'settings')) return;
    const m = openModal(`<div class="modal settings"><div class="modal-head"><h2>⚙ Settings</h2><button class="modal-x" data-x>✕</button></div>
      <div class="settings-body"><div class="settings-nav">
        <button data-tab="look">🎨 Appearance</button><button data-tab="trade">⚡ Trading</button><button data-tab="account">💼 Account</button><button data-tab="data">📡 Data</button><button data-tab="keys">⌨ Shortcuts</button>
      </div><div class="settings-pane"></div></div></div>`, 'center', () => { P.Keys.stopListening(); });
    m.kind = 'settings';
    const pane = m.back.querySelector('.settings-pane');
    const nav = m.back.querySelector('.settings-nav');
    const row = (title, sub, ctrl) => `<div class="set-row"><div class="sl"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ctrl}</div>`;
    const num = (k, step = 'any', extra = '') => `<input class="set-input" type="number" step="${step}" data-k="${k}" value="${S.get(k)}" ${extra}>`;
    const sw = (k) => `<div class="switch ${S.get(k) ? 'on' : ''}" data-sw="${k}"></div>`;
    const seg = (k, opts) => `<div class="seg big" data-segk="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(S.get(k)) === String(v) ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    function draw(tab) {
      nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      let h = '';
      if (tab === 'look') {
        h += `<div class="set-group"><h3>Theme</h3><div class="swatches">${Object.entries(S.THEMES).map(([k, t]) => `<div class="swatch ${S.get('theme') === k && !S.get('customAccent') ? 'active' : ''}" data-theme="${k}" title="${t.name}" style="--sw:${t.accent};background:linear-gradient(135deg,${t.accent},${t.accent2})"></div>`).join('')}</div></div>`;
        h += `<div class="set-group"><h3>Colors</h3>
          ${row('Custom accent', 'overrides the theme accent', `<div style="display:flex;gap:8px;align-items:center"><input type="color" data-color="customAccent" value="${S.get('customAccent') || S.accent().accent}"><button class="mini-btn" data-clear="customAccent">reset</button></div>`)}
          ${row('Up color', 'buys, gains', `<input type="color" data-color="upColor" value="${S.get('upColor')}">`)}
          ${row('Down color', 'sells, losses', `<input type="color" data-color="downColor" value="${S.get('downColor')}">`)}</div>`;
        h += `<div class="set-group"><h3>Effects</h3>
          ${row('Animation intensity', 'particles, glows, transitions', seg('effects', [['high', 'Crazy'], ['low', 'Subtle'], ['off', 'Off']]))}
          ${row('Background', '', seg('bgStyle', [['aurora', 'Aurora'], ['nogrid', 'No grid'], ['minimal', 'Minimal']]))}
          ${row('UI scale', '', seg('scale', [[0.9, '90%'], [1, '100%'], [1.1, '110%'], [1.2, '120%']]))}
          ${row('Compact layout', 'tighter gaps', sw('compact'))}
          ${row('Sounds', 'synth blips on trades', sw('sound'))}
          ${row('Volume', '', `<input type="range" min="0" max="100" data-k="volume" value="${S.get('volume')}" style="accent-color:var(--accent)">`)}</div>`;
      } else if (tab === 'trade') {
        const bp = S.get('buyPresets'), sp = S.get('sellPresets');
        h += `<div class="set-group"><h3>Presets</h3>
          ${row('Buy presets (SOL)', 'keys ' + [1, 2, 3, 4].map((i) => P.Keys.label('buy' + i)).join(' '), `<div style="display:flex;gap:6px">${bp.map((v, i) => `<input class="set-input" style="width:64px" type="number" step="any" data-arr="buyPresets" data-i="${i}" value="${v}">`).join('')}</div>`)}
          ${row('Sell presets (%)', 'keys ' + [1, 2, 3, 4].map((i) => P.Keys.label('sell' + i)).join(' '), `<div style="display:flex;gap:6px">${sp.map((v, i) => `<input class="set-input" style="width:64px" type="number" step="any" data-arr="sellPresets" data-i="${i}" value="${v}">`).join('')}</div>`)}
          ${row('List ⚡ quick-buy', 'SOL per click in token lists', num('quickBuy'))}</div>`;
        h += `<div class="set-group"><h3>Execution</h3>
          ${row('Slippage tolerance %', 'tx fails if price moves more than this before landing', num('slippage'))}
          ${row('Priority fee (SOL)', 'paid on every tx, even failed ones', num('priorityFee'))}
          ${row('Platform fee %', 'terminal fee per trade (typical 0.75–1%)', num('platformFee'))}
          ${row('DEX / LP fee %', 'pool fee (PumpSwap 0.25%, Raydium 0.25%)', num('dexFee'))}
          ${row('Landing latency (ms)', 'simulated time to confirm', `<div style="display:flex;gap:6px">${num('latencyMin', 'any', 'style="width:80px"')}${num('latencyMax', 'any', 'style="width:80px"')}</div>`)}
          ${row('Confirm large buys', 'double-press for buys > 50% of balance', sw('confirmLarge'))}</div>`;
        h += `<div class="set-group"><h3>Auto TP / SL on new buys</h3>
          ${row('Enabled', '', sw('autoTpSl'))}
          ${row('Take profit at +%', 'then sell % of bag', `<div style="display:flex;gap:6px">${num('tp', 'any', 'style="width:80px"')}${num('tpSell', 'any', 'style="width:80px"')}</div>`)}
          ${row('Stop loss at −%', 'then sell % of bag', `<div style="display:flex;gap:6px">${num('sl', 'any', 'style="width:80px"')}${num('slSell', 'any', 'style="width:80px"')}</div>`)}</div>`;
      } else if (tab === 'account') {
        const s = T.stats();
        h += `<div class="set-group"><h3>Paper wallet</h3>
          ${row('Balance', '', `<b class="mono">${U.fmtSol(s.sol, 4)}</b>`)}
          ${row('Portfolio value', '', `<b class="mono">${U.fmtSol(s.portfolio, 4)}</b>`)}
          ${row('All-time PnL', '', `<b class="mono ${U.cls(s.pnl)}">${U.fmtSigned(s.pnl, (v) => v.toFixed(4))} ◎ (${U.fmtPct(s.pnlPct)})</b>`)}
          ${row('Starting balance (SOL)', 'used when you reset', num('startBalance'))}
          ${row('Add funds', 'top up paper SOL', `<div style="display:flex;gap:6px"><button class="btn" data-dep="1">+1</button><button class="btn" data-dep="10">+10</button><button class="btn" data-dep="100">+100</button></div>`)}
          ${row('Reset account', 'wipes positions & history', `<button class="btn danger" data-reset>Reset</button>`)}</div>`;
        h += `<div class="set-group"><h3>Identity</h3>${row('Handle', 'shown on PnL cards', `<input class="set-input wide" type="text" data-k="handle" value="${U.esc(S.get('handle'))}">`)}</div>`;
        h += `<div class="set-group"><h3>Export</h3>${row('Trade history', 'CSV file', `<button class="btn" data-csv>Export CSV</button>`)}</div>`;
      } else if (tab === 'data') {
        h += `<div class="set-group"><h3>Market data source</h3>
          ${row('Mode', 'Auto = live, falls back to simulator if offline', seg('dataMode', [['auto', 'Auto'], ['live', 'Live'], ['sim', 'Simulated']]))}
          ${row('Current', '', `<b class="mono">${D.mode === 'live' ? '🟢 Live Solana' : '🟡 Simulated AMM'}</b>`)}
          ${row('Reconnect', 'restart data feeds', `<button class="btn" data-restart>Restart feeds</button>`)}</div>
          <div class="set-group"><h3>About</h3><div class="muted" style="line-height:1.7">Live mode streams real Solana pairs from <b>DexScreener</b> (prices, liquidity, socials, search) and <b>GeckoTerminal</b> (trending &amp; new pools, OHLCV candles, trades).<br>
          Orders are <b>paper trades</b>: fills are computed against the pool's constant-product reserves with platform + LP fees, priority fee, simulated landing latency and slippage failure — so PnL tracks what you'd actually get, without risking keys or funds.</div></div>`;
      } else if (tab === 'keys') {
        h += `<div class="set-group"><h3>Shortcuts — click to rebind, Backspace to clear</h3>${P.Keys.list().map(([id, label, key]) => row(label, '', `<button class="keybind" data-bind="${id}">${U.esc(key || '—')}</button>`)).join('')}</div>
          <button class="btn danger" data-keyreset>Reset to defaults</button>`;
      }
      pane.innerHTML = h;
      pane.dataset.tab = tab;
    }
    nav.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) draw(b.dataset.tab); });
    pane.addEventListener('change', (e) => {
      const i = e.target;
      if (i.dataset.k) { const v = i.type === 'number' || i.type === 'range' ? +i.value : i.value; S.set(i.dataset.k, v); }
      else if (i.dataset.arr) { const arr = S.get(i.dataset.arr).slice(); arr[+i.dataset.i] = +i.value; S.set(i.dataset.arr, arr); }
    });
    pane.addEventListener('input', (e) => {
      const i = e.target;
      if (i.dataset.color) S.set(i.dataset.color, i.value);
      else if (i.type === 'range' && i.dataset.k) S.set(i.dataset.k, +i.value);
    });
    pane.addEventListener('click', (e) => {
      const x = e.target;
      const th = x.closest('[data-theme]'); if (th) { S.setMany({ theme: th.dataset.theme, customAccent: null }); draw('look'); return; }
      const sw = x.closest('[data-sw]'); if (sw) { S.set(sw.dataset.sw, !S.get(sw.dataset.sw)); sw.classList.toggle('on', !!S.get(sw.dataset.sw)); return; }
      const sg = x.closest('[data-segk] button'); if (sg) {
        const k = sg.parentElement.dataset.segk; let v = sg.dataset.v; if (k === 'scale') v = +v;
        S.set(k, v); sg.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === sg));
        if (k === 'dataMode') restartData();
        return;
      }
      if (x.closest('[data-clear]')) { S.set(x.closest('[data-clear]').dataset.clear, null); draw('look'); return; }
      if (x.closest('[data-dep]')) { T.deposit(+x.closest('[data-dep]').dataset.dep); draw('account'); FX.sound('buy'); return; }
      if (x.closest('[data-reset]')) {
        if (x.dataset.armed) { T.reset(S.get('startBalance')); FX.toast('Account reset', S.get('startBalance') + ' SOL', 'ok'); draw('account'); }
        else { x.dataset.armed = '1'; x.textContent = 'Click again to confirm'; }
        return;
      }
      if (x.closest('[data-csv]')) { exportCsv(); return; }
      if (x.closest('[data-restart]')) { restartData(); return; }
      if (x.closest('[data-keyreset]')) { P.Keys.reset(); draw('keys'); return; }
      const kb = x.closest('[data-bind]');
      if (kb) {
        kb.classList.add('listening'); kb.textContent = 'press keys…';
        P.Keys.listen(kb.dataset.bind, (combo) => { kb.classList.remove('listening'); kb.textContent = combo || '—'; draw('keys'); renderTrade(); });
      }
    });
    draw(tab);
  };

  function exportCsv() {
    const rows = [['time', 'side', 'symbol', 'address', 'sol', 'tokens', 'price_usd', 'mc_usd', 'fee_sol', 'status', 'pnl_sol', 'pnl_pct', 'latency_ms']];
    for (const h of T.history()) rows.push([new Date(h.t).toISOString(), h.side, h.symbol, h.address, h.sol, h.tokens, h.price, h.mc, h.fee, h.status, h.pnl ?? '', h.pnlPct ?? '', h.latency ?? '']);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'poison-trades.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function restartData() {
    st.trades = []; renderBottom();
    D.start().then(() => {});
    FX.toast('Restarting data feeds', 'mode: ' + S.get('dataMode'), 'info', 2000);
  }
  UI.restartData = restartData;

  // ======================================================== INIT
  UI.init = () => {
    Object.assign(el, {
      solPrice: $('#solPrice'), balance: $('#balance'), portfolio: $('#portfolio'), totalPnl: $('#totalPnl'),
      list: $('#tokenList'), listTabs: $('#listTabs'), header: $('#tokenHeader'), trade: $('#tradeBody'), sideToggle: $('#sideToggle'),
      position: $('#positionPanel'), info: $('#infoPanel'), bottomBody: $('#bottomBody'), bottomTabs: $('#bottomTabs'),
      tfSeg: $('#tfSeg'), unitSeg: $('#unitSeg'), chartLoading: $('#chartLoading'), modeBadge: $('#modeBadge')
    });
    chart = UI.chart = new P.Chart($('#chart'), $('#chartLegend'));
    chart.setUnit(S.get('chartUnit'));
    el.tfSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.tf === S.get('tf')));
    el.unitSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.unit === S.get('chartUnit')));

    // titlebar
    $('#searchBtn').onclick = () => UI.openSearch();
    $('#pnlBtn').onclick = () => P.PnL.open();
    $('#helpBtn').onclick = () => UI.openHelp();
    $('#settingsBtn').onclick = () => UI.openSettings();
    el.modeBadge.onclick = () => UI.openSettings('data');
    if (window.native) {
      $('#wMin').onclick = () => window.native.minimize();
      $('#wMax').onclick = () => window.native.maximize();
      $('#wClose').onclick = () => window.native.close();
      $('#titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) window.native.maximize(); });
    } else document.body.classList.add('web');

    // list
    el.listTabs.addEventListener('click', (e) => { const b = e.target.closest('[data-list]'); if (b) UI.setList(b.dataset.list); });
    UI.setList(st.list);
    $('#listSort').onchange = (e) => { st.sort = e.target.value; renderList(); };
    const qb = $('#quickBuyAmt'); qb.value = S.get('quickBuy');
    qb.onchange = () => { S.set('quickBuy', +qb.value || 0.1); renderList(); };
    el.list.addEventListener('click', (e) => {
      const row = e.target.closest('.trow'); if (!row) return;
      const t = D.get(row.dataset.addr) || (UI._list || []).find((x) => x.address === row.dataset.addr);
      if (e.target.closest('[data-qb]')) { e.stopPropagation(); UI.quickBuy(t, e.target.closest('[data-qb]')); return; }
      st.cursor = (UI._list || []).indexOf(t);
      UI.select(t);
    });

    // chart toolbar
    el.tfSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (b) UI.setTf(+b.dataset.tf); });
    el.unitSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-unit]'); if (b) UI.setUnit(b.dataset.unit); });

    // header
    el.header.addEventListener('click', (e) => {
      if (e.target.closest('[data-star]')) UI.toggleWatch();
      else if (e.target.closest('[data-copy]')) UI.copyCA();
      else if (e.target.closest('[data-url]')) U.open(e.target.closest('[data-url]').dataset.url);
    });

    // trade panel
    el.sideToggle.addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (b) UI.setSide(b.dataset.side); });
    el.trade.addEventListener('click', (e) => {
      const b = e.target.closest('button,[data-autotp]'); if (!b) return;
      if (b.dataset.buy) { UI.buyPreset(S.get('buyPresets').indexOf(+b.dataset.buy), b); }
      else if (b.dataset.sell) { UI.sellPreset(S.get('sellPresets').indexOf(+b.dataset.sell), b); }
      else if (b.hasAttribute('data-max')) {
        if (st.side === 'buy') st.buyAmt = Math.max(0, +(T.balance() - (+S.get('priorityFee') || 0) - 0.00001).toFixed(4)); else st.sellPct = 100;
        renderTrade();
      } else if (b.id === 'execBtn') UI.execute();
      else if (b.hasAttribute('data-autotp')) { S.set('autoTpSl', !S.get('autoTpSl')); }
    });
    el.trade.addEventListener('input', (e) => {
      if (e.target.id === 'amtIn') {
        if (st.side === 'buy') { st.buyAmt = +e.target.value; U.store.set('ui:buyAmt', st.buyAmt); } else st.sellPct = U.clamp(+e.target.value, 0, 100);
        el.trade.querySelectorAll('.preset').forEach((p) => p.classList.toggle('sel', +(p.dataset.buy || p.dataset.sell) === (st.side === 'buy' ? st.buyAmt : st.sellPct)));
        renderQuote();
      }
    });
    el.trade.addEventListener('change', (e) => { if (e.target.dataset.set) S.set(e.target.dataset.set, +e.target.value); });
    el.trade.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'amtIn') { e.preventDefault(); UI.execute(); } });

    // position panel
    el.position.addEventListener('click', (e) => {
      const sh = e.target.closest('[data-share]'); if (sh) { P.PnL.open(sh.dataset.share); return; }
      if (e.target.closest('[data-rules]')) {
        const t = sel(); const p = t && T.pos(t.address); if (!p) return;
        T.setRules(t.address, p.rules ? null : readRules()); renderPosition(true);
        FX.toast(p.rules ? 'TP / SL armed' : 'TP / SL disabled', p.rules ? `TP +${p.rules.tp.pct}% · SL ${p.rules.sl.pct}%` : '', 'info', 2000);
      }
    });
    el.position.addEventListener('change', (e) => {
      if (!e.target.dataset.rule) return;
      const t = sel(); const p = t && T.pos(t.address);
      if (p && p.rules) { T.setRules(t.address, readRules()); }
    });
    el.info.addEventListener('click', (e) => { if (e.target.closest('[data-copy-pair]') && sel()) { U.copy(sel().pair); FX.toast('Pair address copied', '', 'ok', 1500); } });

    // bottom
    el.bottomTabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) UI.setBottom(b.dataset.tab); });
    el.bottomBody.addEventListener('click', (e) => {
      const g = e.target.closest('[data-goto]'); if (g) { const t = D.get(g.dataset.goto) || (T.pos(g.dataset.goto) && stub(T.pos(g.dataset.goto))); t && UI.select(t); return; }
      const s = e.target.closest('[data-sellpos]'); if (s) { UI.sellToken(s.dataset.sellpos, +s.dataset.pct, s); return; }
      const sh = e.target.closest('[data-share]'); if (sh) { P.PnL.open(sh.dataset.share); return; }
      const rm = e.target.closest('[data-rmpos]'); if (rm) { T.removePosition(rm.dataset.rmpos); renderBottom(); }
    });
    UI.setBottom('trades');
    requestAnimationFrame(() => { moveInk(el.listTabs); moveInk(el.bottomTabs); });
    addEventListener('resize', () => { moveInk(el.listTabs); moveInk(el.bottomTabs); });

    // ---------------- data events
    D.on('sol', (v) => { renderSol(v); renderTop(); });
    D.on('lists', () => {
      renderListThrottled();
      if (!sel()) {
        const saved = U.store.get('ui:sel', null);
        const t = (saved && D.get(saved.address)) || D.lists.trending[0] || D.lists.new[0];
        if (saved && !D.get(saved.address) && D.mode === 'live') {
          D.search(saved.address).then((r) => { const f = r.find((x) => x.address === saved.address); if (!sel() || sel() === t) UI.select(f || t); });
          if (t) UI.select(t);
        } else if (t) UI.select(t);
      }
    });
    D.on('tokens', () => { renderListThrottled(); renderTop(); T.checkRules(); if (st.bottom === 'positions') renderBottomThrottled(); if (sel()) renderPosition(); });
    D.on('token', (t) => {
      if (t !== sel()) return;
      updateHeader(); renderInfo(); renderPosition(); renderQuote();
      if (S.get('chartUnit') === 'mc') chart.setMult(supplyOf(t));
    });
    D.on('tick', (x) => { chart.tick(x.price, x.v, x.t); });
    D.on('trades', (arr, first) => {
      for (const x of arr) { st.trades.unshift(x); if (!first) st.newIds.add(x.id); }
      if (st.trades.length > 200) st.trades.length = 200;
      if (D.mode === 'live' && !first) for (const x of arr) chart.tick(x.price, x.usd, x.t);
      if (st.bottom === 'trades') renderBottomThrottled();
    });
    D.on('mode', (m) => {
      el.modeBadge.textContent = m === 'live' ? 'LIVE' : 'SIM';
      el.modeBadge.classList.toggle('sim', m !== 'live');
      el.list.innerHTML = '';
      $('#splashStatus') && ($('#splashStatus').textContent = m === 'live' ? 'streaming live Solana pairs…' : 'spinning up simulated market…');
    });
    D.on('status', (s) => {
      const dot = $('#netDot');
      dot.className = 'dot ' + (s.ok === true ? 'ok' : s.ok === false ? 'err' : '');
      $('#netText').textContent = s.text;
      $('#latency').textContent = s.latency ? s.latency + 'ms' : (D.mode === 'sim' ? 'local' : '—');
    });

    // ---------------- trade events
    T.on('change', () => { renderTop(); renderPosition(true); renderQuote(); updateChartOverlays(); if (st.bottom !== 'trades') renderBottom(); renderListThrottled(); });
    T.on('fill', (r) => {
      if (D.mode === 'live' && sel() && r.address === sel().address) {
        st.trades.unshift({ id: r.id, t: r.t, side: r.side, usd: r.sol * D.solUsd, amount: r.tokens, price: r.price, maker: 'YOU', mine: true });
        st.newIds.add(r.id); renderBottomThrottled();
      }
    });
    T.on('auto', ({ label, res, p }) => {
      FX.toast(`🤖 ${label} executed`, `$${U.esc(p.symbol)} · ${res.sol.toFixed(4)} ◎ · PnL ${U.fmtSigned(res.pnl, (v) => v.toFixed(4))} ◎`, res.pnl >= 0 ? 'ok' : 'err', 6000);
      FX.sound(res.pnl >= 0 ? 'profit' : 'loss'); FX.edge(res.pnl >= 0 ? 'up' : 'down');
      if (res.pnl > 0) FX.confetti(90);
    });
    T.on('autoErr', ({ label, e, p }) => FX.toast(`${label} failed — will retry`, `$${U.esc(p.symbol)}: ${U.esc(e.message)}`, 'err'));

    // ---------------- settings changes
    S.on((k) => {
      chart.readColors();
      if (['buyPresets', 'sellPresets', 'autoTpSl', 'tp', 'tpSell', 'sl', 'slSell', 'slippage', 'priorityFee', '*'].includes(k)) renderTrade();
      if (['platformFee', 'dexFee'].includes(k)) renderQuote();
      if (k === 'quickBuy') { $('#quickBuyAmt').value = S.get('quickBuy'); renderList(); }
      if (k === 'compact' || k === 'scale' || k === '*') setTimeout(() => { chart.resize(); moveInk(el.listTabs); moveInk(el.bottomTabs); }, 50);
    });

    renderTop(); renderTrade(); renderPosition(true); buildHeader();
    setInterval(() => { const c = $('#clock'); if (c) c.textContent = U.time(Date.now()); if (st.bottom === 'trades') renderBottomThrottled(); }, 1000);
  };
})(window.P);
