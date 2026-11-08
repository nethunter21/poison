/* Poison Terminal — UI (lightweight: throttled, incremental rendering) */
(function (P) {
  const U = P.U, S = P.S, FX = P.FX, D = P.Data, T = P.Trade;
  const $ = U.$;
  const UI = (P.UI = {});

  const LISTS = ['new', 'stretch', 'migrated', 'trending', 'holdings', 'watch'];
  const st = {
    list: LISTS.includes(U.store.get('ui:list')) ? U.store.get('ui:list') : 'new',
    sort: 'default', side: 'buy',
    buyAmt: U.store.get('ui:buyAmt', S.get('buyPresets')[1]),
    sellPct: 50, bottom: 'trades', cursor: -1,
    trades: [], watch: U.store.get('watch', {}), recent: U.store.get('recent', []),
    confirm: null, back: [], fwd: []
  };
  let chart;
  const el = {};
  const TF_LIST = [1, 60, 300, 900, 3600];
  const sel = () => D.selected;
  UI.isWatched = (a) => !!st.watch[a];
  UI.watchAddresses = () => Object.keys(st.watch);
  UI.state = st;

  function moveInk(tabs) {
    const a = tabs.querySelector('button.active'), ink = tabs.querySelector('.tab-ink');
    if (!a || !ink) return;
    ink.style.left = a.offsetLeft + 'px'; ink.style.width = a.offsetWidth + 'px';
  }

  // ======================================================== flags / audit helpers
  const lvl = (v, g, y) => (v < g ? 'g' : v < y ? 'y' : 'r');
  function flagList(t) {
    const a = t.audit || {};
    const f = [];
    f.push({ k: 'T10', v: a.top10, l: lvl(a.top10, 25, 40), tip: 'Top 10 holders own this % of supply' });
    if (a.devSold) f.push({ k: 'DEV', txt: 'sold', l: 'y', tip: 'Dev sold their bag' });
    else f.push({ k: 'DEV', v: a.dev, l: lvl(a.dev, 5, 12), tip: 'Dev wallet holds this % of supply' });
    f.push({ k: '📦', v: a.bundlers, l: lvl(a.bundlers, 6, 18), tip: 'Bundled wallets (bought in the launch block)' });
    f.push({ k: '🎯', v: a.snipers, l: lvl(a.snipers, 6, 15), tip: 'Snipers (bought in the first seconds)' });
    if (a.insiders > 0.5) f.push({ k: 'INS', v: a.insiders, l: lvl(a.insiders, 8, 18), tip: 'Insider wallets' });
    if (t.freeze) f.push({ k: 'FREEZE', txt: 'ON', l: 'r', tip: 'Freeze authority enabled — your tokens can be frozen' });
    return f;
  }
  const chips = (t) => flagList(t).filter((f) => f.txt || f.k === 'T10' || f.k === 'DEV' || f.v >= 1).map((f) => `<span class="fl ${f.l}" title="${f.tip}">${f.k} ${f.txt || (f.v < 10 ? f.v.toFixed(1) : f.v.toFixed(0)) + '%'}</span>`).join('');
  function risk(t) {
    const fl = flagList(t);
    let r = fl.filter((f) => f.l === 'r').length * 2 + fl.filter((f) => f.l === 'y').length;
    if (t.devInfo && t.devInfo.created > 5 && t.devInfo.migrated === 0) r += 2;
    if (t.devInfo && t.devInfo.fresh) r += 1;
    if (!t.socials.length) r += 1;
    if (t.xReused) r += 1;
    const a = t.audit || {};
    const tx = t.txns.h1.buys + t.txns.h1.sells;
    if (a.holders && tx / a.holders > 15) r += 2;
    return { score: r, label: r >= 6 ? 'HIGH' : r >= 3 ? 'MEDIUM' : 'LOW', cls: r >= 6 ? 'r' : r >= 3 ? 'y' : 'g' };
  }
  UI.redFlags = (t) => {
    const out = flagList(t).filter((f) => f.l === 'r').map((f) => `${f.k} ${f.txt || f.v.toFixed(0) + '%'}`);
    if (t.devInfo && t.devInfo.created > 5 && t.devInfo.migrated === 0) out.push(`dev launched ${t.devInfo.created} coins, 0 migrated`);
    const tx = t.txns.h1.buys + t.txns.h1.sells;
    if (t.audit.holders && tx / t.audit.holders > 15) out.push('txns ≫ holders (fake volume?)');
    return out;
  };

  // ======================================================== titlebar
  function renderTop() {
    const s = T.stats();
    FX.countTo(el.balance, s.sol, (v) => U.fmtSol(v, 3));
    FX.countTo(el.portfolio, s.portfolio, (v) => U.fmtSol(v, 3));
    FX.countTo(el.totalPnl, s.pnl, (v) => U.fmtSigned(v, (x) => x.toFixed(3)) + ' (' + U.fmtPct(s.pnlPct) + ')');
    el.totalPnl.className = U.cls(s.pnl);
  }
  const renderTopT = U.throttle(renderTop, 700);

  // ======================================================== LIST
  function currentList() {
    let arr;
    switch (st.list) {
      case 'holdings': arr = T.held().map((p) => D.get(p.address)).filter(Boolean); break;
      case 'watch': arr = Object.keys(st.watch).map((a) => D.get(a)).filter(Boolean); break;
      default: arr = (D.lists[st.list] || []).slice();
    }
    const k = st.sort;
    if (k === 'mc') arr.sort((a, b) => b.mc - a.mc);
    else if (k === 'vol') arr.sort((a, b) => b.vol.m5 - a.vol.m5);
    else if (k === 'chg') arr.sort((a, b) => b.chg.m5 - a.chg.m5);
    else if (k === 'age') arr.sort((a, b) => b.createdAt - a.createdAt);
    else if (k === 'holders') arr.sort((a, b) => b.audit.holders - a.audit.holders);
    else if (k === 'risk') arr.sort((a, b) => risk(a).score - risk(b).score);
    UI._list = arr;
    return arr;
  }
  function rowMeta(t) {
    const p = T.pos(t.address), held = p && p.tokens > 0;
    const badge = (t.dex === 'pumpswap' ? '<span class="bdg mig" title="Migrated to PumpSwap">🎓</span>' : t.dex === 'raydium' ? '<span class="bdg ray" title="Not a pump.fun token">RAY</span>' : '') + (held ? '<span class="badge-held">HELD</span>' : '') + (st.watch[t.address] ? '<span class="star-s">★</span>' : '');
    const soc = t.socials.length ? t.socials.map((s) => (s.type === 'twitter' ? '𝕏' : '✈')).join('') : '<span class="dim">no socials</span>';
    return `<div class="l1"><span class="sym">${U.esc(t.symbol)}</span><span class="nm">${U.esc(t.name)}</span>${badge}</div>
      <div class="l2"><span class="age">${U.ago(t.createdAt)}</span><span>MC <b>${U.fmtCompact(t.mc)}</b></span><span>V <b>${U.fmtCompact(t.vol.h1)}</b></span><span>👥<b>${t.audit.holders}</b></span><span class="soc">${soc}</span></div>
      <div class="l3">${chips(t)}</div>`;
  }
  function rowRight(t) {
    const ch = st.list === 'new' || st.list === 'stretch' ? t.chg.m5 : t.chg.h1;
    return `<span class="chg ${U.cls(ch)}">${U.fmtPct(ch, 0)}</span><span class="tx">${t.txns.m5.buys + t.txns.m5.sells} tx</span><button class="qb" data-qb>⚡ ${S.get('quickBuy')}</button>`;
  }
  function renderList() {
    const arr = currentList();
    const box = el.list;
    const existing = new Map();
    for (const c of [...box.children]) { if (c.dataset.addr) existing.set(c.dataset.addr, c); else c.remove(); }
    let prev = null;
    const s = sel();
    const flash = S.get('effects') === 'high';
    arr.forEach((t, i) => {
      let row = existing.get(t.address);
      if (!row) {
        row = document.createElement('div');
        row.className = 'trow'; row.dataset.addr = t.address;
        row.innerHTML = U.avatar(t) + '<div class="meta"></div><div class="right"></div><div class="bond"><i></i></div>';
      } else existing.delete(t.address);
      const m = rowMeta(t), r = rowRight(t);
      if (row._m !== m) { row.children[1].innerHTML = m; row._m = m; }
      if (row._r !== r) { row.children[2].innerHTML = r; row._r = r; }
      const bw = t.stage === 'curve' ? t.bonding.toFixed(0) + '%' : '0';
      if (row._b !== bw) { row.children[3].firstChild.style.transform = `scaleX(${t.stage === 'curve' ? t.bonding / 100 : 0})`; row.children[3].style.display = t.stage === 'curve' ? '' : 'none'; row._b = bw; }
      row.classList.toggle('sel', !!s && s.address === t.address);
      row.classList.toggle('cursor', i === st.cursor);
      row.classList.toggle('rugged', !!(t.rugged || (t.revealed && D.FATES[t.fate].rug)));
      if (flash && row._p && t.price !== row._p) {
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
      const msg = { holdings: ['💼', 'No open positions.<br>Press <kbd>1</kbd>–<kbd>4</kbd> to buy the selected coin.'], watch: ['★', 'Watchlist empty.<br>Press <kbd>F</kbd> on a coin to add it.'], stretch: ['⏳', 'No coins near the bond yet…'] }[st.list] || ['⏳', 'Waiting for launches…'];
      box.innerHTML = `<div class="empty"><div class="big">${msg[0]}</div>${msg[1]}</div>`;
    }
  }
  const renderListT = U.throttle(renderList, 1000);

  UI.setList = (name) => {
    if (!LISTS.includes(name)) return;
    st.list = name; st.cursor = -1; U.store.set('ui:list', name);
    el.listTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.list === name));
    moveInk(el.listTabs);
    el.list.innerHTML = '';
    renderList();
    el.list.scrollTop = 0;
  };
  UI.cycleList = (d) => UI.setList(LISTS[(LISTS.indexOf(st.list) + d + LISTS.length) % LISTS.length]);
  UI.moveCursor = (dir) => {
    const arr = UI._list || currentList();
    if (!arr.length) return;
    const s = sel();
    let i = st.cursor >= 0 && arr[st.cursor] === s ? st.cursor : arr.findIndex((t) => s && t.address === s.address);
    i = i < 0 ? 0 : U.clamp(i + dir, 0, arr.length - 1);
    st.cursor = i;
    UI.select(arr[i]);
    const row = el.list.children[i];
    row && row.scrollIntoView({ block: 'nearest' });
  };

  // ======================================================== SELECT + navigation history
  let candleTimer = 0;
  UI.select = (t, opts = {}) => {
    if (!t) return;
    t = D.get(t.address) || t;
    const prev = sel();
    if (prev && prev !== t && !opts.nav) { st.back.push(prev.address); if (st.back.length > 50) st.back.shift(); st.fwd = []; }
    D.select(t);
    U.store.set('ui:sel', t.address);
    st.recent = [t.address].concat(st.recent.filter((a) => a !== t.address)).slice(0, 10);
    U.store.set('recent', st.recent);
    st.trades = [];
    buildHeader(); updateHeader(true); renderTrade(); renderPosition(true); renderInfo(); buildBottom();
    renderList();
    chart.symbol = t.symbol;
    chart.setData([], S.get('tf'));
    chart.setMult(S.get('chartUnit') === 'mc' ? 1e9 : 1);
    updateChartOverlays();
    clearTimeout(candleTimer);
    candleTimer = setTimeout(() => loadCandles(t), 60);
  };
  UI.back = () => { let a; while ((a = st.back.pop())) { const t = D.get(a); if (t) { if (sel()) st.fwd.push(sel().address); UI.select(t, { nav: true }); return; } } FX.toast('No previous coin', '', 'info', 1200); };
  UI.forward = () => { let a; while ((a = st.fwd.pop())) { const t = D.get(a); if (t) { if (sel()) st.back.push(sel().address); UI.select(t, { nav: true }); return; } } };

  async function loadCandles(t) {
    const tf = S.get('tf');
    const c = await D.candles(t, tf);
    if (sel() !== t || S.get('tf') !== tf) return;
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
    chart.setUnit(u); chart.setMult(u === 'mc' ? 1e9 : 1);
  };
  UI.toggleUnit = () => UI.setUnit(S.get('chartUnit') === 'mc' ? 'price' : 'mc');
  UI.chartCloses = (addr) => (sel() && sel().address === addr ? chart.data.slice(-150).map((c) => c.c) : null);

  function updateChartOverlays() {
    const t = sel(); if (!t) return;
    chart.setMarkers(T.history().filter((h) => h.address === t.address && h.status === 'ok').map((h) => ({ t: h.t, side: h.side, price: h.price })));
    const p = T.pos(t.address);
    chart.setEntry(p && p.tokens > 0 ? T.metrics(p, t).avgEntry : null);
  }

  // ======================================================== HEADER
  function buildHeader() {
    const t = sel();
    if (!t) { el.header.innerHTML = '<div class="empty" style="padding:10px">Select a coin</div>'; return; }
    const dex = t.dex === 'pump.fun' ? '<span class="chip pf">pump.fun</span>' : t.dex === 'pumpswap' ? '<span class="chip mig">🎓 PumpSwap</span>' : '<span class="chip ray">Raydium</span>';
    const soc = t.socials.map((s) => `<span class="chip" title="${s.type}${s.type === 'twitter' && t.xReused ? ' — handle reused from older tokens!' : ''}">${s.type === 'twitter' ? '𝕏' : '✈'}${s.type === 'twitter' && t.xReused ? '⚠' : ''}</span>`).join('') + (t.websites.length ? '<span class="chip" title="Website">🌐</span>' : '');
    el.header.innerHTML = `
      <div class="th-id">${U.avatar(t, 'lg')}
        <div class="th-names">
          <div class="th-sym">$${U.esc(t.symbol)} <span class="star ${st.watch[t.address] ? 'on' : ''}" data-star title="Watchlist (F)">★</span></div>
          <div class="th-sub"><span class="nm">${U.esc(t.name)}</span>
            <span class="chip" data-copy title="Copy contract (C)">${U.short(t.address, 4)}</span>${dex}<span id="hAge" class="muted"></span>${soc || '<span class="chip dim" title="No socials — red flag">no socials</span>'}
          </div>
        </div>
      </div>
      <div class="th-stats">
        <div class="th-stat hero"><span>Market cap</span><b id="hMc">—</b></div>
        <div class="th-stat"><span>Price</span><b id="hPrice">—</b></div>
        <div class="th-stat"><span>Liquidity</span><b id="hLiq">—</b></div>
        <div class="th-stat"><span>Vol 1h</span><b id="hVol">—</b></div>
        <div class="th-stat"><span>Risk</span><b id="hRisk">—</b></div>
        <div class="th-stat" id="hBondBox"><span id="hBondL">Bonding</span><b id="hBond">—</b><div class="mini-bond"><i id="hBondBar"></i></div></div>
      </div>`;
  }
  function updateHeader(first) {
    const t = sel(); if (!t) return;
    const g = (id) => document.getElementById(id);
    const mc = g('hMc'); if (!mc) return;
    const dir = first ? 0 : Math.sign(t.price - (mc._lp || t.price));
    mc._lp = t.price;
    FX.countTo(mc, t.mc, (v) => U.fmtCompact(v));
    g('hPrice').textContent = U.fmtPrice(t.price);
    g('hLiq').textContent = U.fmtCompact(t.liq);
    g('hVol').textContent = U.fmtCompact(t.vol.h1);
    g('hAge').textContent = U.ago(t.createdAt);
    const rk = risk(t), hr = g('hRisk'); if (hr._v !== rk.label) { hr._v = rk.label; hr.textContent = rk.label; hr.className = 'risk-t ' + rk.cls; }
    if (t.stage === 'curve') { g('hBondL').textContent = 'Bonding'; g('hBond').textContent = t.bonding.toFixed(1) + '%'; g('hBondBar').style.transform = `scaleX(${t.bonding / 100})`; }
    else { g('hBondL').textContent = '1h'; g('hBond').textContent = U.fmtPct(t.chg.h1); g('hBond').className = U.cls(t.chg.h1); g('hBondBar').style.transform = 'scaleX(0)'; }
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
        <div class="presets">${pr.map((v, i) => `<button class="preset ${+st.buyAmt === +v ? 'sel' : ''}" data-buy="${i}">${v}<small>◎ · ${K('buy' + (i + 1))}</small></button>`).join('')}</div>
        <div class="amt-row"><input id="amtIn" type="number" min="0" step="0.01" value="${st.buyAmt}"><span class="unit">SOL</span><button class="max" data-max>MAX</button></div>
        <div class="quote" id="quote"></div>
        <button class="exec" id="execBtn" ${t ? '' : 'disabled'}><span>Buy ${sym}</span><kbd>${K('execute')}</kbd></button>
        ${tradeSettings()}`;
    } else {
      const pr = S.get('sellPresets');
      el.trade.innerHTML = `
        <div class="presets">${pr.map((v, i) => `<button class="preset sell ${+st.sellPct === +v ? 'sel' : ''}" data-sell="${i}">${v}%<small>${K('sell' + (i + 1))}</small></button>`).join('')}</div>
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
      <div class="autotp"><div class="switch ${S.get('autoTpSl') ? 'on' : ''}" data-autotp></div><span>Auto on buy: TP <b class="up">+${S.get('tp')}%</b> · SL <b class="down">${-Math.abs(S.get('sl'))}%</b>${S.get('slTrail') ? ' trailing' : ''}</span></div>`;
  }
  function renderQuote() {
    const box = document.getElementById('quote'); if (!box) return;
    const t = sel();
    if (!t) { box.innerHTML = '<span>Select a coin</span><b></b>'; return; }
    const poolFee = (t.fee * 100).toFixed(2) + '%';
    if (st.side === 'buy') {
      const q = T.quote(t, 'buy', +st.buyAmt);
      if (!q) { box.innerHTML = '<span>Enter amount</span><b>—</b>'; return; }
      const slip = S.get('slippage') / 100;
      box.innerHTML = `<span>You receive</span><b>${U.fmtCompact(q.out, '')} <span class="muted">(${(q.out / 1e7).toFixed(2)}% supply)</span></b>
        <span>Entry MC</span><b>${U.fmtCompact(q.avgUsd * 1e9)}</b>
        <span>Price impact</span><b class="${q.impact > 5 ? 'warn' : ''}">${q.impact.toFixed(2)}%</b>
        <span>Fees <span class="dim">(pool ${poolFee})</span></span><b>${(q.platform + q.poolFee + q.network).toFixed(4)} ◎</b>
        <span>Min received</span><b>${U.fmtCompact(q.out * (1 - slip), '')}</b>`;
    } else {
      const p = T.pos(t.address);
      if (!p || p.tokens <= 0) { box.innerHTML = '<span>No position</span><b>—</b>'; return; }
      const qty = +st.sellPct >= 100 ? p.tokens : p.tokens * (+st.sellPct / 100);
      const q = T.quote(t, 'sell', qty);
      if (!q) { box.innerHTML = '<span>Enter %</span><b>—</b>'; return; }
      box.innerHTML = `<span>Selling</span><b>${U.fmtCompact(qty, '')} ${U.esc(t.symbol)}</b>
        <span>You receive</span><b>${q.out.toFixed(4)} ◎ <span class="muted">(${U.fmtCompact(q.usdOut)})</span></b>
        <span>Price impact</span><b class="${q.impact > 5 ? 'warn' : ''}">${q.impact.toFixed(2)}%</b>
        <span>Fees <span class="dim">(pool ${poolFee})</span></span><b>${(q.platform + q.poolFee + q.network).toFixed(4)} ◎</b>`;
    }
  }
  UI.setSide = (s) => { st.side = s; renderTrade(); FX.sound('click'); };
  UI.toggleSide = () => UI.setSide(st.side === 'buy' ? 'sell' : 'buy');
  UI.focusAmount = () => { const i = document.getElementById('amtIn'); if (i) { i.focus(); i.select(); } };

  async function doTrade(t, side, amt, src) {
    if (!t) { FX.toast('Select a coin first', '', 'err'); FX.sound('error'); return; }
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
        if (S.get('coach')) {
          const rf = UI.redFlags(t);
          if (rf.length) setTimeout(() => FX.toast('⚠ Coach: red flags on this coin', U.esc(rf.join(' · ')), 'err', 6000), 400);
          else if (t.chg.m5 > 80) setTimeout(() => FX.toast('⚠ Coach: chasing a vertical candle', 'Up ' + U.fmtPct(t.chg.m5) + ' in 5m — that is where insiders sell', 'info', 5000), 400);
        }
      } else {
        const win = r.pnl >= 0;
        FX.sound(win ? 'profit' : 'loss');
        FX.toast(`Sold ${U.fmtCompact(r.tokens, '')} $${U.esc(t.symbol)}`, `+${r.sol.toFixed(4)} ◎ · PnL ${U.fmtSigned(r.pnl, (v) => v.toFixed(4))} ◎ (${U.fmtPct(r.pnlPct)})`, win ? 'ok' : 'err');
        if (target) { const rc = target.getBoundingClientRect(); FX.floatText(rc.left + rc.width / 2, rc.top, U.fmtPct(r.pnlPct), win ? S.get('upColor') : S.get('downColor')); }
        if (win && r.pnlPct >= 50) FX.confetti();
      }
    } catch (e) {
      FX.sound('error');
      FX.toast(e.failed ? 'Transaction failed' : 'Order rejected', U.esc(e.message), 'err', 5000);
    } finally { btn && btn.classList.remove('busy'); }
  }
  UI.buyPreset = (i, src) => { const v = S.get('buyPresets')[i]; if (v == null) return; st.buyAmt = v; st.side = 'buy'; renderTrade(); doTrade(sel(), 'buy', +v, src || el.trade.querySelectorAll('.preset')[i]); };
  UI.sellPreset = (i, src) => { const v = S.get('sellPresets')[i]; if (v == null) return; st.sellPct = v; st.side = 'sell'; renderTrade(); doTrade(sel(), 'sell', +v, src || el.trade.querySelectorAll('.preset')[i]); };
  UI.execute = () => doTrade(sel(), st.side, st.side === 'buy' ? +st.buyAmt : +st.sellPct, document.getElementById('execBtn'));
  UI.quickBuy = (t, src) => doTrade(t, 'buy', +S.get('quickBuy'), src);
  UI.sellToken = (addr, pct, src) => doTrade(D.get(addr), 'sell', pct, src);
  UI.panicSell = async () => {
    const held = T.held();
    if (!held.length) { FX.toast('Nothing to sell', '', 'info'); return; }
    FX.toast('🚨 Panic sell', `Selling ${held.length} position(s) at market`, 'info');
    for (const p of held) { const t = D.get(p.address); if (t) await doTrade(t, 'sell', 100); }
  };

  // ---------- stop loss / take profit shortcuts
  function needPos() {
    const t = sel(); const p = t && T.pos(t.address);
    if (!p || p.tokens <= 0) { FX.toast('No open position', 'Buy first, then arm a stop loss', 'info', 1800); FX.sound('error'); return null; }
    return p;
  }
  UI.toggleSL = () => {
    const p = needPos(); if (!p) return;
    const r = T.toggleRule(p.address, 'sl');
    FX.sound(r.on ? 'alert' : 'click');
    FX.toast(r.on ? `🛑 Stop loss armed${r.trail ? ' (trailing)' : ''}` : 'Stop loss disarmed', r.on ? `Sell ${r.sell}% at ${r.pct}%${r.trail ? ' from peak' : ''}` : '', r.on ? 'ok' : 'info', 2200);
  };
  UI.toggleTP = () => {
    const p = needPos(); if (!p) return;
    const r = T.toggleRule(p.address, 'tp');
    FX.sound(r.on ? 'alert' : 'click');
    FX.toast(r.on ? '🎯 Take profit armed' : 'Take profit disarmed', r.on ? `Sell ${r.sell}% at +${r.pct}%` : '', r.on ? 'ok' : 'info', 2200);
  };
  UI.breakeven = () => {
    const p = needPos(); if (!p) return;
    const up = T.metrics(p).unrealPct;
    if (up < 3) { FX.toast('Not in profit yet', `You're at ${U.fmtPct(up)} after fees — a breakeven stop would sell instantly. Wait until you're up.`, 'info', 3500); FX.sound('error'); return; }
    T.breakeven(p.address); FX.sound('alert');
    FX.toast('🛡 Stop moved to breakeven', 'Sells 100% if PnL drops to 0%', 'ok', 2200);
  };

  // ======================================================== POSITION PANEL
  function renderPosition(full) {
    const t = sel();
    const p = t && T.pos(t.address);
    if (full || !el.position.querySelector('.pp-stats')) el.position.innerHTML = `<div class="pp-stats"></div><div class="pp-rules"></div>`;
    const box = el.position.querySelector('.pp-stats');
    const K = P.Keys ? P.Keys.label : () => '';
    if (!p || p.buys === 0) {
      const s = T.stats();
      box.innerHTML = `<div class="pp-head"><span class="pp-title">Your position</span><button class="share-btn" data-share="__portfolio__">Share</button></div>
        <div class="muted" style="margin:4px 0 10px">No position in ${t ? '$' + U.esc(t.symbol) : 'this coin'} yet.</div>
        <div class="pp-grid"><div class="pp-cell"><span>Balance</span><b>${U.fmtSol(s.sol, 3)}</b></div><div class="pp-cell"><span>Win rate</span><b>${s.winRate.toFixed(0)}% <span class="muted">${s.wins}W/${s.losses}L</span></b></div>
        <div class="pp-cell"><span>Total PnL</span><b class="${U.cls(s.pnl)}">${U.fmtSigned(s.pnl, (v) => v.toFixed(3))} ◎</b></div><div class="pp-cell"><span>Rugs eaten</span><b class="${s.rugsEaten ? 'down' : ''}">${s.rugsEaten} / ${s.coins}</b></div></div>`;
      el.position.querySelector('.pp-rules').innerHTML = '';
      return;
    }
    const m = T.metrics(p, t);
    const prev = box._total; box._total = m.total;
    box.innerHTML = `<div class="pp-head"><span class="pp-title">Your position ${p.tokens > 0 ? '' : '· closed'}</span><button class="share-btn" data-share="${p.address}">Share PnL <kbd>${K('pnl')}</kbd></button></div>
      <div style="display:flex;align-items:baseline;gap:10px"><div class="pp-pnl ${U.cls(m.total)}" id="ppPnl">${U.fmtSigned(m.total, (v) => v.toFixed(4))} ◎</div><span class="pp-pct ${U.cls(m.total)}">${U.fmtPct(m.totalPct)}</span></div>
      <div class="muted mono" style="font-size:.85em">${U.fmtSigned(m.totalUsd, (v) => '$' + U.fmtNum(v, 2))}</div>
      <div class="pp-grid">
        <div class="pp-cell"><span>Holding</span><b>${m.value.toFixed(4)} ◎</b></div>
        <div class="pp-cell"><span>Unrealized</span><b class="${U.cls(m.unreal)}">${U.fmtPct(m.unrealPct)}</b></div>
        <div class="pp-cell"><span>Invested</span><b>${p.invested.toFixed(4)} ◎</b></div>
        <div class="pp-cell"><span>Sold</span><b>${p.sold.toFixed(4)} ◎</b></div>
        <div class="pp-cell"><span>Avg entry MC</span><b>${U.fmtCompact(m.avgEntryMc)}</b></div>
        <div class="pp-cell"><span>% supply</span><b>${(p.tokens / 1e7).toFixed(2)}%</b></div>
      </div>`;
    if (prev != null && Math.sign(m.total - prev)) FX.tickClass(document.getElementById('ppPnl'), Math.sign(m.total - prev));
    const rules = el.position.querySelector('.pp-rules');
    if (full || !rules.innerHTML) {
      if (p.tokens > 0) {
        const r = p.rules || T.defaultRules(false, false);
        rules.innerHTML = `<div class="rules">
          <div class="rule"><div class="switch ${r.tp.on ? 'on' : ''}" data-rule-tog="tp"></div><span class="up rl">TP <kbd>${K('takeProfit')}</kbd></span>
            <label class="ts-chip">at +<input data-rule="tp.pct" type="number" value="${r.tp.pct}">%</label><label class="ts-chip">sell<input data-rule="tp.sell" type="number" value="${r.tp.sell}">%</label>${r.tp.done ? '<span class="dim">hit</span>' : ''}</div>
          <div class="rule"><div class="switch ${r.sl.on ? 'on' : ''}" data-rule-tog="sl"></div><span class="down rl">SL <kbd>${K('stopLoss')}</kbd></span>
            <label class="ts-chip">at<input data-rule="sl.pct" type="number" value="${r.sl.pct}">%</label><label class="ts-chip">sell<input data-rule="sl.sell" type="number" value="${r.sl.sell}">%</label>${r.sl.done ? '<span class="dim">hit</span>' : ''}</div>
          <div class="rule sub"><label class="tog-inline"><div class="switch sm ${r.sl.trail ? 'on' : ''}" data-trail></div>Trailing stop</label><button class="mini-btn" data-be title="Move stop to breakeven (${K('breakeven')})">Breakeven <kbd>${K('breakeven')}</kbd></button></div>
        </div>`;
      } else rules.innerHTML = '';
    }
  }
  const renderPositionT = U.throttle(() => renderPosition(), 1000);
  function readRules(p) {
    const get = (k) => +(el.position.querySelector(`[data-rule="${k}"]`) || {}).value;
    const r = p.rules || T.defaultRules(false, false);
    r.tp.pct = Math.abs(get('tp.pct')); r.tp.sell = U.clamp(get('tp.sell'), 1, 100);
    r.sl.pct = -Math.abs(get('sl.pct')); r.sl.sell = U.clamp(get('sl.sell'), 1, 100);
    return r;
  }

  // ======================================================== INFO / AUDIT PANEL
  function renderInfo() {
    const t = sel();
    if (!t) { el.info.innerHTML = ''; return; }
    const a = t.audit, rk = risk(t);
    const row = (k, v, c, tip) => `<div class="ip-row" title="${tip || ''}"><span>${k}</span><b class="${c || ''}">${v}</b></div>`;
    const pct = (v) => (v < 10 ? v.toFixed(1) : v.toFixed(0)) + '%';
    const tx1 = t.txns.h1.buys + t.txns.h1.sells;
    const ratio = a.holders ? tx1 / a.holders : 0;
    const di = t.devInfo || {};
    const pm = t.revealed ? D.FATES[t.fate] : null;
    const pctB = (o) => (o.buys + o.sells ? (o.buys / (o.buys + o.sells)) * 100 : 50);
    const bs = (label, o) => `<div class="bsrow"><div class="bs-legend"><span class="up">${label} ${U.fmtNum(o.buys, 0)} buys</span><span class="down">${U.fmtNum(o.sells, 0)} sells</span></div><div class="bs-bar"><i style="width:${pctB(o)}%"></i></div></div>`;
    const cell = (k, v) => `<div class="chg-cell"><span>${k}</span><b class="${U.cls(v)}">${U.fmtPct(v, 0)}</b></div>`;
    el.info.innerHTML = `
      ${pm ? `<div class="pm ${pm.rug ? 'rug' : 'ok'}"><div class="pm-h">📋 Post-mortem: <b>${pm.label}</b></div><div class="pm-l">${pm.lesson}</div></div>` : ''}
      <div class="audit-h"><span class="pp-title">Token audit</span><span class="risk ${rk.cls}">Risk ${rk.label}</span></div>
      <div class="audit">
        ${row('Top 10 holders', pct(a.top10), lvl(a.top10, 25, 40), 'Share of supply in the 10 biggest wallets (excl. pool)')}
        ${row('Dev holds', a.devSold ? 'sold all' : pct(a.dev), a.devSold ? 'y' : lvl(a.dev, 5, 12), 'Creator wallet holdings')}
        ${row('Bundlers', pct(a.bundlers), lvl(a.bundlers, 6, 18), 'Wallets that bought in the same block as creation')}
        ${row('Snipers', pct(a.snipers), lvl(a.snipers, 6, 15), 'Bots that bought in the first seconds')}
        ${row('Insiders', pct(a.insiders), lvl(a.insiders, 8, 18), 'Linked wallets accumulating early')}
        ${row('Holders', U.fmtNum(a.holders, 0), a.holders < 30 ? 'y' : 'g')}
        ${row('Txns / holder (1h)', ratio.toFixed(1), ratio > 15 ? 'r' : ratio > 6 ? 'y' : 'g', 'Very high = volume bot / fake volume')}
        ${row('Mint authority', t.mintAuth ? 'ENABLED' : 'disabled', t.mintAuth ? 'r' : 'g', 'Can the dev print more tokens?')}
        ${row('Freeze authority', t.freeze ? 'ENABLED' : 'disabled', t.freeze ? 'r' : 'g', 'Can the dev freeze your tokens (honeypot)?')}
        ${row('Liquidity', t.stage === 'curve' ? 'bonding curve' : t.lpBurned ? 'LP burned 🔥' : 'LP NOT burned', t.lpBurned || t.stage === 'curve' ? 'g' : 'r')}
        ${row('Dev history', `${di.created} launched · ${di.migrated} migrated`, di.created > 5 && di.migrated === 0 ? 'r' : di.created > 2 ? 'y' : 'g', 'Previous coins created by this wallet')}
        ${row('Dev funding', di.fresh ? 'fresh wallet' : 'aged wallet', di.fresh ? 'y' : 'g')}
        ${row('Socials', t.socials.length ? t.socials.map((s) => s.type === 'twitter' ? (t.xReused ? '𝕏 reused⚠' : '𝕏') : 'TG').join(' · ') + (t.websites.length ? ' · web' : '') : 'none', !t.socials.length || t.xReused ? 'y' : 'g')}
      </div>
      <div class="chg-grid">${cell('5m', t.chg.m5)}${cell('1h', t.chg.h1)}${cell('6h', t.chg.h6)}${cell('24h', t.chg.h24)}</div>
      ${bs('5m', t.txns.m5)}${bs('1h', t.txns.h1)}
      <div class="ip-row"><span>Vol 5m / 1h</span><b>${U.fmtCompact(t.vol.m5)} / ${U.fmtCompact(t.vol.h1)}</b></div>
      ${t.events.length ? `<div class="evlog">${t.events.slice(-4).reverse().map((e) => `<div>${U.esc(e.text)}</div>`).join('')}</div>` : ''}`;
  }
  const renderInfoT = U.throttle(renderInfo, 1000);

  // ======================================================== BOTTOM (incremental trade tape)
  const TAGS = { dev: ['DEV', 't-dev'], bundle: ['📦 BUNDLE', 't-bun'], sniper: ['🎯 SNIPER', 't-snp'], insider: ['🕵 INSIDER', 't-ins'], kol: ['📣 KOL', 't-kol'], whale: ['🐋 WHALE', 't-wha'], bot: ['🤖 BOT', 't-bot'], you: ['YOU', 't-you'] };
  function tradeRow(x) {
    const tag = TAGS[x.tag];
    const mcMode = S.get('chartUnit') === 'mc';
    const tr = document.createElement('tr');
    if (x.mine) tr.className = 'mine';
    tr.dataset.t = x.t;
    tr.innerHTML = `<td class="muted">${U.ago(x.t)}</td><td class="${x.side === 'buy' ? 'side-b' : 'side-s'}">${x.side === 'buy' ? 'Buy' : 'Sell'}</td>
      <td>${mcMode ? U.fmtCompact(x.price * 1e9) : U.fmtPrice(x.price)}</td><td class="${x.side === 'buy' ? 'up' : 'down'}">${x.sol.toFixed(3)}</td>
      <td>${U.fmtCompact(x.usd)}</td><td>${U.fmtCompact(x.amount, '')}</td>
      <td class="muted">${tag ? `<span class="tag ${tag[1]}">${tag[0]}</span>` : U.short(x.maker, 4)}</td>`;
    return tr;
  }
  function buildBottom() {
    const b = el.bottomBody;
    if (st.bottom === 'trades') {
      b.innerHTML = `<table class="grid"><thead><tr><th>Age</th><th>Type</th><th>${S.get('chartUnit') === 'mc' ? 'MC' : 'Price'}</th><th>SOL</th><th>USD</th><th>Amount</th><th>Maker</th></tr></thead><tbody></tbody></table>`;
      el.tbody = b.querySelector('tbody');
      const frag = document.createDocumentFragment();
      st.trades.slice(0, 80).forEach((x) => frag.appendChild(tradeRow(x)));
      el.tbody.appendChild(frag);
    } else {
      el.tbody = null;
      renderTables();
    }
  }
  function addTrades(arr) {
    for (let i = 0; i < arr.length; i++) st.trades.unshift(arr[i]);
    if (st.trades.length > 120) st.trades.length = 120;
    if (!el.tbody) return;
    const frag = document.createDocumentFragment();
    const slice = arr.slice(-40);
    const anim = S.get('effects') === 'high';
    for (let i = slice.length - 1; i >= 0; i--) { const tr = tradeRow(slice[i]); if (anim) tr.classList.add('new'); frag.appendChild(tr); }
    el.tbody.insertBefore(frag, el.tbody.firstChild);
    while (el.tbody.children.length > 60) el.tbody.lastChild.remove();
  }
  function refreshAges() {
    if (!el.tbody) return;
    for (const tr of el.tbody.children) tr.firstChild.textContent = U.ago(+tr.dataset.t);
  }
  function outcome(addr) {
    const t = D.get(addr); const p = T.pos(addr);
    if (t && t.revealed) { const f = D.FATES[t.fate]; return `<span class="${f.rug ? 'down' : 'up'}" title="${U.esc(f.lesson)}">${f.label}</span>`; }
    if (p && p.revealedFate) { const f = D.FATES[p.revealedFate]; return `<span class="${f.rug ? 'down' : 'up'}">${f.label}</span>`; }
    return '<span class="dim">unknown</span>';
  }
  function renderTables() {
    const b = el.bottomBody;
    if (st.bottom === 'positions') {
      const ps = T.positions().filter((p) => p.buys > 0).sort((a, c) => (c.tokens > 0) - (a.tokens > 0) || c.lastAt - a.lastAt);
      const rows = ps.map((p) => {
        const m = T.metrics(p);
        const r = p.rules;
        return `<tr><td><span class="link" data-goto="${p.address}">${p.emoji || ''} $${U.esc(p.symbol)}</span> ${p.tokens > 0 ? '' : '<span class="dim">closed</span>'}${p.rugged ? ' <span class="down">rugged</span>' : ''}</td>
          <td>${p.tokens > 0 ? m.value.toFixed(4) + ' ◎' : '—'}</td><td>${p.invested.toFixed(3)}</td><td>${p.sold.toFixed(3)}</td>
          <td class="${U.cls(m.total)}">${U.fmtSigned(m.total, (v) => v.toFixed(4))}</td><td class="${U.cls(m.total)}">${U.fmtPct(m.totalPct)}</td>
          <td>${U.fmtCompact(m.avgEntryMc)} → ${U.fmtCompact(m.mc)}</td>
          <td>${r && r.tp.on ? '<span class="up">TP</span> ' : ''}${r && r.sl.on ? '<span class="down">SL</span>' : ''}</td><td>${outcome(p.address)}</td>
          <td>${p.tokens > 0 ? `<button class="mini-btn sell" data-sellpos="${p.address}" data-pct="50">50%</button><button class="mini-btn sell" data-sellpos="${p.address}" data-pct="100">100%</button>` : `<button class="mini-btn" data-rmpos="${p.address}">clear</button>`}<button class="mini-btn share" data-share="${p.address}">share</button></td></tr>`;
      }).join('');
      b.innerHTML = `<table class="grid"><thead><tr><th>Coin</th><th>Holding</th><th>Invested</th><th>Sold</th><th>PnL ◎</th><th>PnL %</th><th>Entry → now</th><th>Rules</th><th>Outcome</th><th></th></tr></thead><tbody>${rows}</tbody></table>${ps.length ? '' : '<div class="empty">No positions yet</div>'}`;
    } else if (st.bottom === 'history') {
      const rows = T.history().slice(0, 150).map((h) => `<tr><td class="muted">${U.time(h.t)}</td><td class="${h.side === 'buy' ? 'side-b' : 'side-s'}">${h.side.toUpperCase()}</td>
        <td><span class="link" data-goto="${h.address}">${h.emoji || ''} $${U.esc(h.symbol)}</span></td><td>${h.sol ? h.sol.toFixed(4) : '—'}</td>
        <td>${U.fmtCompact(h.mc)}</td><td class="muted">${(h.fee || 0).toFixed(4)}</td>
        <td>${h.status === 'ok' ? (h.pnl != null ? `<span class="${U.cls(h.pnl)}">${U.fmtSigned(h.pnl, (v) => v.toFixed(4))} (${U.fmtPct(h.pnlPct)})</span>` : '<span class="up">filled</span>') : `<span class="down">${U.esc(h.reason || 'failed')}</span>`}</td>
        <td>${outcome(h.address)}</td><td class="muted">${h.latency ? h.latency + 'ms' : ''}</td></tr>`).join('');
      b.innerHTML = `<table class="grid"><thead><tr><th>Time</th><th>Side</th><th>Coin</th><th>SOL</th><th>MC</th><th>Fee</th><th>Result</th><th>Outcome</th><th>Land</th></tr></thead><tbody>${rows}</tbody></table>${T.history().length ? '' : '<div class="empty">No trades yet</div>'}`;
    }
  }
  const renderTablesT = U.throttle(renderTables, 1500);
  UI.setBottom = (tab) => {
    st.bottom = tab;
    el.bottomTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    moveInk(el.bottomTabs); buildBottom();
  };

  // ======================================================== WATCH / COPY / ZEN
  UI.toggleWatch = () => {
    const t = sel(); if (!t) return;
    if (st.watch[t.address]) { delete st.watch[t.address]; FX.toast('Removed from watchlist', '$' + U.esc(t.symbol), 'info', 1500); }
    else { st.watch[t.address] = 1; FX.toast('Added to watchlist ★', '$' + U.esc(t.symbol), 'ok', 1500); }
    U.store.set('watch', st.watch);
    const star = el.header.querySelector('[data-star]'); star && star.classList.toggle('on', !!st.watch[t.address]);
    FX.sound('click'); renderList();
  };
  UI.copyCA = () => { const t = sel(); if (!t) return; U.copy(t.address); FX.toast('Contract copied', U.short(t.address, 8), 'ok', 1500); FX.sound('click'); };
  UI.toggleZen = () => { document.body.classList.toggle('zen'); setTimeout(() => chart.resize(), 30); };

  // ======================================================== MODALS
  const modals = [];
  function openModal(html, cls = '', onClose) {
    const back = document.createElement('div');
    back.className = 'modal-back ' + cls;
    back.innerHTML = html;
    document.getElementById('modalRoot').appendChild(back);
    const m = { back, close() { back.classList.add('out'); setTimeout(() => back.remove(), 180); modals.splice(modals.indexOf(m), 1); onClose && onClose(); } };
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
    const m = openModal(`<div class="modal palette"><div class="palette-input"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="Search ticker, name, contract… or > for commands" spellcheck="false"></div><div class="palette-list"></div><div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> quick-buy ${S.get('quickBuy')} ◎</span><span><kbd>Esc</kbd> close</span></div></div>`);
    m.kind = 'search';
    const input = m.back.querySelector('input'), list = m.back.querySelector('.palette-list');
    let items = [], active = 0;
    input.value = prefill;
    const commands = () => [
      { t: 'Open PnL card', s: 'share your trade', ico: '🎴', run: () => P.PnL.open() },
      { t: 'Settings', s: 'theme, presets, fees, shortcuts', ico: '⚙', run: () => UI.openSettings() },
      { t: 'Keyboard shortcuts', s: 'view all hotkeys', ico: '⌨', run: () => UI.openHelp() },
      { t: 'Rug field guide', s: 'learn every scam pattern in this market', ico: '📚', run: () => UI.openSettings('market') },
      { t: 'Toggle zen mode', s: 'chart only', ico: '🧘', run: UI.toggleZen },
      { t: 'Panic sell everything', s: 'market-sell all open positions', ico: '🚨', run: UI.panicSell },
      { t: 'New market', s: 'regenerate all coins (keeps your bags)', ico: '🌱', run: () => UI.newMarket() },
      { t: 'Toggle sound', s: S.get('sound') ? 'currently on' : 'currently off', ico: '🔊', run: () => S.set('sound', !S.get('sound')) },
      ...[['low', 'Lite (fast)'], ['high', 'Crazy'], ['off', 'Off']].map(([l, n]) => ({ t: 'Effects: ' + n, s: 'animation intensity', ico: '✨', run: () => S.set('effects', l) })),
      ...Object.entries(S.THEMES).map(([k, th]) => ({ t: 'Theme: ' + th.name, s: th.accent, ico: `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:linear-gradient(135deg,${th.accent},${th.accent2})"></span>`, run: () => S.setMany({ theme: k, customAccent: null }) })),
      { t: 'Reset paper account', s: 'back to ' + S.get('startBalance') + ' SOL', ico: '♻', run: () => { T.reset(S.get('startBalance')); FX.toast('Account reset', S.get('startBalance') + ' SOL', 'ok'); } }
    ];
    const tokItem = (t) => ({ tok: t, t: '$' + t.symbol, s: t.name + ' · ' + U.short(t.address, 5), r: `${U.fmtCompact(t.mc)} <span class="${U.cls(t.chg.h1)}">${U.fmtPct(t.chg.h1, 0)}</span>` });
    function draw() {
      let html = '', group = null;
      items.forEach((it, i) => {
        if (it.group !== group) { group = it.group; html += `<div class="pal-group">${group}</div>`; }
        html += `<div class="pal-item ${i === active ? 'active' : ''}" data-i="${i}">${it.tok ? U.avatar(it.tok, 'sm') : `<span class="pal-ico">${it.ico || '›'}</span>`}<div class="pi-main"><div class="pi-t">${U.esc(it.t)}</div><div class="pi-s">${U.esc(it.s || '')}</div></div>${it.r ? `<div class="pi-r">${it.r}</div>` : ''}</div>`;
      });
      list.innerHTML = html || '<div class="empty">No results</div>';
      const a = list.querySelector('.pal-item.active'); a && a.scrollIntoView({ block: 'nearest' });
    }
    function update() {
      const q = input.value.trim(); active = 0;
      if (q.startsWith('>')) {
        const qq = q.slice(1).trim().toLowerCase();
        items = commands().filter((c) => !qq || c.t.toLowerCase().includes(qq)).map((c) => ({ ...c, group: 'Commands' }));
      } else if (!q) {
        items = st.recent.map((a) => D.get(a)).filter(Boolean).map((t) => ({ ...tokItem(t), group: 'Recent' })).concat(commands().slice(0, 4).map((c) => ({ ...c, group: 'Commands' })));
      } else {
        const ql = q.toLowerCase();
        items = [...D.tokens.values()].filter((t) => t.symbol.toLowerCase().includes(ql) || t.name.toLowerCase().includes(ql) || t.address.toLowerCase().startsWith(ql))
          .sort((a, b) => (b.symbol.toLowerCase() === ql) - (a.symbol.toLowerCase() === ql) || b.mc - a.mc).slice(0, 20).map((t) => ({ ...tokItem(t), group: 'Coins' }));
      }
      draw();
    }
    function choose(i, quick) {
      const it = items[i]; if (!it) return;
      m.close();
      if (it.tok) { UI.select(it.tok); if (quick) UI.quickBuy(it.tok); }
      else it.run && it.run();
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(items.length - 1, active + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { choose(active, e.shiftKey); e.preventDefault(); }
    });
    list.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (r) choose(+r.dataset.i, e.shiftKey); });
    update();
    setTimeout(() => input.focus(), 20);
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

  UI.newMarket = () => {
    D.save();
    st.trades = []; buildBottom();
    FX.toast('🌱 Generating a new market…', 'Your open bags are kept', 'info', 2000);
    D.start();
  };

  // ---------- settings
  UI.openSettings = (tab = 'look') => {
    if (modals.find((m) => m.kind === 'settings')) return;
    const m = openModal(`<div class="modal settings"><div class="modal-head"><h2>⚙ Settings</h2><button class="modal-x" data-x>✕</button></div>
      <div class="settings-body"><div class="settings-nav">
        <button data-tab="look">🎨 Appearance</button><button data-tab="trade">⚡ Trading</button><button data-tab="market">📚 Market & training</button><button data-tab="account">💼 Account</button><button data-tab="keys">⌨ Shortcuts</button>
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
        h += `<div class="set-group"><h3>Performance & effects</h3>
          ${row('Effects', 'Lite = smooth on weak laptops (recommended). Crazy = blur, animated background, glows.', seg('effects', [['low', 'Lite'], ['high', 'Crazy'], ['off', 'Off']]))}
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
          ${row('List ⚡ quick-buy', 'SOL per click in coin lists', num('quickBuy'))}</div>`;
        h += `<div class="set-group"><h3>Execution</h3>
          ${row('Slippage tolerance %', 'tx fails if price moves more than this before landing', num('slippage'))}
          ${row('Priority fee (SOL)', 'paid on every tx, even failed ones', num('priorityFee'))}
          ${row('Platform fee %', 'terminal fee per trade (Axiom/Photon ≈ 0.75–1%)', num('platformFee'))}
          ${row('Landing latency (ms)', 'time for your tx to confirm', `<div style="display:flex;gap:6px">${num('latencyMin', 'any', 'style="width:80px"')}${num('latencyMax', 'any', 'style="width:80px"')}</div>`)}
          ${row('Confirm large buys', 'double-press for buys > 50% of balance', sw('confirmLarge'))}</div>`;
        h += `<div class="set-group"><h3>Stop loss / take profit defaults</h3>
          ${row('Arm on every buy', 'auto TP + SL when you open a position', sw('autoTpSl'))}
          ${row('Take profit at +%', 'then sell % of bag', `<div style="display:flex;gap:6px">${num('tp', 'any', 'style="width:80px"')}${num('tpSell', 'any', 'style="width:80px"')}</div>`)}
          ${row('Stop loss at −%', 'then sell % of bag', `<div style="display:flex;gap:6px">${num('sl', 'any', 'style="width:80px"')}${num('slSell', 'any', 'style="width:80px"')}</div>`)}
          ${row('Trailing stop', 'stop follows the highest PnL reached', sw('slTrail'))}</div>`;
      } else if (tab === 'market') {
        h += `<div class="set-group"><h3>Offline market</h3>
          ${row('Launch pace', 'how fast new coins appear', seg('marketPace', [['calm', 'Calm'], ['normal', 'Normal'], ['degen', 'Degen']]))}
          ${row('Coach hints', 'warns you when you buy into red flags', sw('coach'))}
          ${row('New market', 'regenerate every coin (your bags are kept)', `<button class="btn" data-newmarket>Generate</button>`)}</div>
          <div class="set-group"><h3>Rug field guide — every coin here is one of these</h3>
          ${Object.values(D.FATES).map((f) => `<div class="guide ${f.rug ? 'rug' : 'ok'}"><b>${f.label}</b><span>${f.lesson}</span></div>`).join('')}</div>
          <div class="set-group"><h3>How the market works</h3><div class="muted" style="line-height:1.7">Coins launch on the pump.fun bonding curve (30 SOL virtual reserves, ~$5K start MC) and migrate to PumpSwap at ~85 SOL raised (~$70K MC). Every candle is made by simulated wallets — devs, bundlers, snipers, insiders, KOLs, whales, bots and hundreds of retail traders with their own entries and exits. The audit panel shows what those wallets actually hold, so the red flags you learn here are the same ones you'll see on Axiom or Photon.</div></div>`;
      } else if (tab === 'account') {
        const s = T.stats();
        h += `<div class="set-group"><h3>Paper wallet</h3>
          ${row('Balance', '', `<b class="mono">${U.fmtSol(s.sol, 4)}</b>`)}
          ${row('Portfolio value', '', `<b class="mono">${U.fmtSol(s.portfolio, 4)}</b>`)}
          ${row('All-time PnL', '', `<b class="mono ${U.cls(s.pnl)}">${U.fmtSigned(s.pnl, (v) => v.toFixed(4))} ◎ (${U.fmtPct(s.pnlPct)})</b>`)}
          ${row('Win rate', `${s.wins} wins · ${s.losses} losses`, `<b class="mono">${s.winRate.toFixed(0)}%</b>`)}
          ${row('Rugs eaten', 'coins that rugged while you held them', `<b class="mono ${s.rugsEaten ? 'down' : 'up'}">${s.rugsEaten} of ${s.coins} coins</b>`)}
          ${row('Starting balance (SOL)', 'used when you reset', num('startBalance'))}
          ${row('Add funds', 'top up paper SOL', `<div style="display:flex;gap:6px"><button class="btn" data-dep="1">+1</button><button class="btn" data-dep="10">+10</button><button class="btn" data-dep="100">+100</button></div>`)}
          ${row('Reset account', 'wipes positions & history', `<button class="btn danger" data-reset>Reset</button>`)}</div>`;
        h += `<div class="set-group"><h3>Identity</h3>${row('Handle', 'shown on PnL cards', `<input class="set-input wide" type="text" data-k="handle" value="${U.esc(S.get('handle'))}">`)}</div>`;
        h += `<div class="set-group"><h3>Export</h3>${row('Trade history', 'CSV file', `<button class="btn" data-csv>Export CSV</button>`)}</div>`;
      } else if (tab === 'keys') {
        h += `<div class="set-group"><h3>Shortcuts — click to rebind, Backspace to clear</h3>${P.Keys.list().map(([id, label, key]) => row(label, '', `<button class="keybind" data-bind="${id}">${U.esc(key || '—')}</button>`)).join('')}</div>
          <button class="btn danger" data-keyreset>Reset to defaults</button>`;
      }
      pane.innerHTML = h;
    }
    nav.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) draw(b.dataset.tab); });
    pane.addEventListener('change', (e) => {
      const i = e.target;
      if (i.dataset.k) S.set(i.dataset.k, i.type === 'number' || i.type === 'range' ? +i.value : i.value);
      else if (i.dataset.arr) { const arr = S.get(i.dataset.arr).slice(); arr[+i.dataset.i] = +i.value; S.set(i.dataset.arr, arr); }
    });
    pane.addEventListener('input', (e) => { const i = e.target; if (i.dataset.color) S.set(i.dataset.color, i.value); });
    pane.addEventListener('click', (e) => {
      const x = e.target;
      const th = x.closest('[data-theme]'); if (th) { S.setMany({ theme: th.dataset.theme, customAccent: null }); draw('look'); return; }
      const sw = x.closest('[data-sw]'); if (sw) { S.set(sw.dataset.sw, !S.get(sw.dataset.sw)); sw.classList.toggle('on', !!S.get(sw.dataset.sw)); return; }
      const sg = x.closest('[data-segk] button'); if (sg) {
        const k = sg.parentElement.dataset.segk; let v = sg.dataset.v; if (k === 'scale') v = +v;
        S.set(k, v); sg.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === sg));
        if (k === 'marketPace') D.setPace(v);
        return;
      }
      if (x.closest('[data-clear]')) { S.set(x.closest('[data-clear]').dataset.clear, null); draw('look'); return; }
      if (x.closest('[data-dep]')) { T.deposit(+x.closest('[data-dep]').dataset.dep); draw('account'); FX.sound('buy'); return; }
      if (x.closest('[data-reset]')) {
        if (x.dataset.armed) { T.reset(S.get('startBalance')); FX.toast('Account reset', S.get('startBalance') + ' SOL', 'ok'); draw('account'); }
        else { x.dataset.armed = '1'; x.textContent = 'Click again to confirm'; }
        return;
      }
      if (x.closest('[data-newmarket]')) { m.close(); UI.newMarket(); return; }
      if (x.closest('[data-csv]')) { exportCsv(); return; }
      if (x.closest('[data-keyreset]')) { P.Keys.reset(); draw('keys'); renderTrade(); return; }
      const kb = x.closest('[data-bind]');
      if (kb) {
        kb.classList.add('listening'); kb.textContent = 'press keys…';
        P.Keys.listen(kb.dataset.bind, () => { draw('keys'); renderTrade(); renderPosition(true); });
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

  // ======================================================== INIT
  UI.init = () => {
    Object.assign(el, {
      solPrice: $('#solPrice'), balance: $('#balance'), portfolio: $('#portfolio'), totalPnl: $('#totalPnl'),
      list: $('#tokenList'), listTabs: $('#listTabs'), header: $('#tokenHeader'), trade: $('#tradeBody'), sideToggle: $('#sideToggle'),
      position: $('#positionPanel'), info: $('#infoPanel'), bottomBody: $('#bottomBody'), bottomTabs: $('#bottomTabs'),
      tfSeg: $('#tfSeg'), unitSeg: $('#unitSeg'), modeBadge: $('#modeBadge')
    });
    chart = UI.chart = new P.Chart($('#chart'), $('#chartLegend'));
    chart.setUnit(S.get('chartUnit')); chart.setMult(S.get('chartUnit') === 'mc' ? 1e9 : 1);
    el.tfSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', +b.dataset.tf === S.get('tf')));
    el.unitSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.unit === S.get('chartUnit')));

    $('#searchBtn').onclick = () => UI.openSearch();
    $('#pnlBtn').onclick = () => P.PnL.open();
    $('#helpBtn').onclick = () => UI.openHelp();
    $('#settingsBtn').onclick = () => UI.openSettings();
    el.modeBadge.onclick = () => UI.openSettings('market');
    if (window.native) {
      $('#wMin').onclick = () => window.native.minimize();
      $('#wMax').onclick = () => window.native.maximize();
      $('#wClose').onclick = () => { D.save(); window.native.close(); };
      $('#titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) window.native.maximize(); });
    } else document.body.classList.add('web');

    el.listTabs.addEventListener('click', (e) => { const b = e.target.closest('[data-list]'); if (b) UI.setList(b.dataset.list); });
    UI.setList(st.list);
    $('#listSort').onchange = (e) => { st.sort = e.target.value; renderList(); };
    const qb = $('#quickBuyAmt'); qb.value = S.get('quickBuy');
    qb.onchange = () => { S.set('quickBuy', +qb.value || 0.1); renderList(); };
    el.list.addEventListener('click', (e) => {
      const row = e.target.closest('.trow'); if (!row) return;
      const t = D.get(row.dataset.addr); if (!t) return;
      if (e.target.closest('[data-qb]')) { e.stopPropagation(); UI.quickBuy(t, e.target.closest('[data-qb]')); return; }
      st.cursor = (UI._list || []).indexOf(t);
      UI.select(t);
    });
    el.list.addEventListener('mousedown', (e) => { if (e.button === 1) { const row = e.target.closest('.trow'); if (row) { e.preventDefault(); UI.quickBuy(D.get(row.dataset.addr), row); } } });

    el.tfSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (b) UI.setTf(+b.dataset.tf); });
    el.unitSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-unit]'); if (b) UI.setUnit(b.dataset.unit); });
    el.header.addEventListener('click', (e) => {
      if (e.target.closest('[data-star]')) UI.toggleWatch();
      else if (e.target.closest('[data-copy]')) UI.copyCA();
    });

    el.sideToggle.addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (b) UI.setSide(b.dataset.side); });
    el.trade.addEventListener('click', (e) => {
      const b = e.target.closest('button,[data-autotp]'); if (!b) return;
      if (b.dataset.buy != null) UI.buyPreset(+b.dataset.buy, b);
      else if (b.dataset.sell != null) UI.sellPreset(+b.dataset.sell, b);
      else if (b.hasAttribute('data-max')) {
        if (st.side === 'buy') st.buyAmt = Math.max(0, +(T.balance() - (+S.get('priorityFee') || 0) - 0.00001).toFixed(4)); else st.sellPct = 100;
        renderTrade();
      } else if (b.id === 'execBtn') UI.execute();
      else if (b.hasAttribute('data-autotp')) S.set('autoTpSl', !S.get('autoTpSl'));
    });
    el.trade.addEventListener('input', (e) => {
      if (e.target.id !== 'amtIn') return;
      if (st.side === 'buy') { st.buyAmt = +e.target.value; U.store.set('ui:buyAmt', st.buyAmt); } else st.sellPct = U.clamp(+e.target.value, 0, 100);
      el.trade.querySelectorAll('.preset').forEach((p, i) => p.classList.toggle('sel', (st.side === 'buy' ? S.get('buyPresets')[i] : S.get('sellPresets')[i]) === (st.side === 'buy' ? st.buyAmt : st.sellPct)));
      renderQuote();
    });
    el.trade.addEventListener('change', (e) => { if (e.target.dataset.set) S.set(e.target.dataset.set, +e.target.value); });
    el.trade.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'amtIn') { e.preventDefault(); UI.execute(); } });

    el.position.addEventListener('click', (e) => {
      const sh = e.target.closest('[data-share]'); if (sh) { P.PnL.open(sh.dataset.share); return; }
      const t = sel(); const p = t && T.pos(t.address); if (!p) return;
      const tog = e.target.closest('[data-rule-tog]');
      if (tog) { if (!p.rules) p.rules = T.defaultRules(false, false); readRules(p); if (tog.dataset.ruleTog === 'sl') UI.toggleSL(); else UI.toggleTP(); return; }
      if (e.target.closest('[data-trail]')) { const r = readRules(p); r.sl.trail = !r.sl.trail; p.peakPct = T.metrics(p).unrealPct; T.setRules(p.address, r); return; }
      if (e.target.closest('[data-be]')) UI.breakeven();
    });
    el.position.addEventListener('change', (e) => {
      if (!e.target.dataset.rule) return;
      const t = sel(); const p = t && T.pos(t.address);
      if (p) T.setRules(t.address, readRules(p));
    });

    el.bottomTabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) UI.setBottom(b.dataset.tab); });
    el.bottomBody.addEventListener('click', (e) => {
      const g = e.target.closest('[data-goto]'); if (g) { const t = D.get(g.dataset.goto); if (t) UI.select(t); else FX.toast('Coin no longer in market', '', 'info', 1500); return; }
      const s = e.target.closest('[data-sellpos]'); if (s) { UI.sellToken(s.dataset.sellpos, +s.dataset.pct, s); return; }
      const sh = e.target.closest('[data-share]'); if (sh) { P.PnL.open(sh.dataset.share); return; }
      const rm = e.target.closest('[data-rmpos]'); if (rm) { T.removePosition(rm.dataset.rmpos); renderTables(); }
    });
    UI.setBottom('trades');
    requestAnimationFrame(() => { moveInk(el.listTabs); moveInk(el.bottomTabs); });
    addEventListener('resize', U.throttle(() => { moveInk(el.listTabs); moveInk(el.bottomTabs); }, 200));

    // ---------------- market events
    D.on('sol', (v) => { el.solPrice.textContent = '$' + v.toFixed(2); renderTopT(); });
    D.on('lists', () => {
      renderListT();
      if (!sel()) { const t = D.get(U.store.get('ui:sel')) || D.lists.stretch[0] || D.lists.trending[0] || D.lists.new[0]; if (t) UI.select(t); }
    });
    D.on('tokens', () => {
      renderListT(); renderTopT(); T.checkRules();
      if (st.bottom !== 'trades') renderTablesT();
      if (sel()) renderPositionT();
    });
    D.on('token', (t) => { if (t !== sel()) return; updateHeader(); renderInfoT(); renderQuote(); });
    D.on('tick', (x) => chart.tick(x.price, x.v, x.t));
    D.on('trades', (arr) => addTrades(arr));
    D.on('mode', () => { el.modeBadge.textContent = 'OFFLINE'; el.modeBadge.classList.add('sim'); el.list.innerHTML = ''; });
    D.on('status', (s) => {
      $('#netDot').className = 'dot ' + (s.ok === true ? 'ok' : s.ok === false ? 'err' : '');
      $('#netText').textContent = s.text;
      $('#latency').textContent = 'no internet needed';
    });
    D.on('event', (e) => {
      const t = e.t, isSel = sel() === t, held = T.pos(t.address) && T.pos(t.address).tokens > 0, watched = !!st.watch[t.address];
      if (e.rug) {
        if (held) { T.markRug(t.address); const p = T.pos(t.address); p.revealedFate = t.fate; }
        if (held || isSel || watched) {
          FX.toast(held ? '💀 You got rugged' : '🚨 Rug alert', U.esc(e.text), 'err', 7000);
          FX.sound('loss'); if (held || isSel) FX.edge('down');
        }
      } else if (e.kind === 'migrate' && (held || isSel || watched)) { FX.toast('🎓 Migrated', U.esc(e.text), 'info', 3500); FX.sound('alert'); }
      else if (e.kind === 'kol' && (held || isSel)) FX.toast('📣 KOL buy', U.esc(e.text), 'info', 3500);
      if (t.revealed) for (const p of T.positions()) if (p.address === t.address) p.revealedFate = t.fate;
      if (isSel) renderInfo();
    });

    T.on('change', () => { renderTopT(); renderPosition(true); renderQuote(); updateChartOverlays(); if (st.bottom !== 'trades') renderTables(); renderListT(); });
    T.on('auto', ({ label, res, p }) => {
      FX.toast(`🤖 ${label} executed`, `$${U.esc(p.symbol)} · ${res.sol.toFixed(4)} ◎ · PnL ${U.fmtSigned(res.pnl, (v) => v.toFixed(4))} ◎`, res.pnl >= 0 ? 'ok' : 'err', 6000);
      FX.sound(res.pnl >= 0 ? 'profit' : 'loss'); FX.edge(res.pnl >= 0 ? 'up' : 'down');
      if (res.pnl > 0) FX.confetti(90);
    });
    T.on('autoErr', ({ label, e, p }) => FX.toast(`${label} failed`, `$${U.esc(p.symbol)}: ${U.esc(e.message)}`, 'err'));

    S.on((k) => {
      chart.readColors();
      if (['buyPresets', 'sellPresets', 'autoTpSl', 'tp', 'tpSell', 'sl', 'slSell', 'slTrail', 'slippage', 'priorityFee', '*'].includes(k)) renderTrade();
      if (k === 'platformFee') renderQuote();
      if (k === 'quickBuy') { $('#quickBuyAmt').value = S.get('quickBuy'); renderList(); }
      if (k === 'compact' || k === 'scale' || k === '*') setTimeout(() => { chart.resize(); moveInk(el.listTabs); moveInk(el.bottomTabs); }, 50);
    });

    renderTop(); renderTrade(); renderPosition(true); buildHeader();
    setInterval(() => { const c = $('#clock'); if (c) c.textContent = U.time(Date.now(), false); refreshAges(); if (sel()) { const a = document.getElementById('hAge'); if (a) a.textContent = U.ago(sel().createdAt); } }, 3000);
  };
})(window.P);
