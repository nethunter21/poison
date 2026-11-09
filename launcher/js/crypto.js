/* POISON CLIENT — crypto flavour layer.
 * IMPORTANT: everything here is SIMULATED for aesthetics. Prices are a local random walk,
 * $PSN is play-money stored in localStorage, and the "blockchain" is a local hash log.
 * No wallets are connected, nothing is bought or sold, no network calls are made.
 */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;

  const coins = [
    { sym: 'BTC', name: 'Bitcoin', price: 97000, vol: 0.0016, icon: '₿', color: '#f7931a' },
    { sym: 'ETH', name: 'Ether', price: 3400, vol: 0.002, icon: 'Ξ', color: '#8c8cff' },
    { sym: 'SOL', name: 'Solana', price: 190, vol: 0.003, icon: '◎', color: '#14f195' },
    { sym: 'DOGE', name: 'Doge', price: 0.38, vol: 0.004, icon: 'Ð', color: '#c2a633' },
    { sym: 'XMR', name: 'Monero', price: 180, vol: 0.0022, icon: 'ɱ', color: '#ff6600' },
    { sym: 'PSN', name: 'POISON (play-money)', price: 4.2, vol: 0.006, icon: '☠', color: '#ff2e88' },
    { sym: 'BLOCK', name: 'Blockcoin (fictional)', price: 0.69, vol: 0.005, icon: '▣', color: '#7cff00' },
    { sym: 'XP', name: 'XP Token (fictional)', price: 13.37, vol: 0.004, icon: '✦', color: '#16c8ff' },
  ];
  coins.forEach((c) => { c.open = c.price; c.hist = Array.from({ length: 90 }, () => c.price); for (let i = 0; i < 90; i++) step(c); c.open = c.hist[0]; });
  function step(c) {
    const drift = c.sym === 'PSN' ? 0.0004 : 0.00005;
    c.price = Math.max(c.price * 0.0001, c.price * (1 + drift + (Math.random() - 0.5) * 2 * c.vol));
    c.hist.push(c.price);
    if (c.hist.length > 90) c.hist.shift();
  }
  P.coins = coins;
  const fmtP = (p) => (p >= 1000 ? U.fmt(p, 0) : p >= 1 ? U.fmt(p, 2) : p.toFixed(4));
  const chg = (c) => ((c.price - c.open) / c.open) * 100;

  /* ---------------- ticker bar ---------------- */
  function tickerHTML() {
    return coins.map((c) => {
      const d = chg(c);
      return `<span class="tk"><i style="color:${c.color}">${c.icon}</i><b>${c.sym}</b>$${fmtP(c.price)}<em class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(2)}%</em></span>`;
    }).join('') + '<span class="tk sim">SIMULATED PRICES · NOT FINANCIAL ADVICE · HODL RESPONSIBLY</span>';
  }
  function renderTicker() {
    const t = U.$('#tickerTrack');
    if (!t) return;
    const h = tickerHTML();
    t.innerHTML = h + h;
    P.hud && P.hud.setTicker(h);
    const sp = P.mod('ticker');
    U.$('#ticker').classList.toggle('off', !sp.on);
    t.style.animationDuration = 60 / (sp.s.speed || 1) + 's';
  }

  /* ---------------- local "blockchain" ---------------- */
  const blocks = [];
  let height = 840000 + Math.floor(Math.random() * 1000);
  P.chain = function (action) {
    const prev = blocks[0] ? blocks[0].hash : '0x' + '0'.repeat(64);
    const b = { height: ++height, action, time: new Date(), hash: U.hash(prev + action + Date.now()), nonce: Math.floor(Math.random() * 1e9) };
    blocks.unshift(b);
    if (blocks.length > 40) blocks.pop();
    renderExplorer();
  };
  function renderExplorer() {
    const host = U.$('#explorer');
    if (!host || !P.isOn('explorer')) return;
    host.innerHTML = blocks.slice(0, 14).map((b, i) => `
      <div class="blk ${i === 0 ? 'new' : ''}">
        <div class="blk-h">#${b.height}</div>
        <div class="blk-a">${b.action.replace(/</g, '&lt;')}</div>
        <code>${b.hash.slice(0, 18)}…${b.hash.slice(-6)}</code>
        <span>${b.time.toLocaleTimeString()}</span>
      </div>`).join('');
  }

  /* ---------------- wallet ---------------- */
  function renderWallet() {
    const w = P.state.wallet;
    U.$$('[data-wallet]').forEach((el) => {
      const from = parseFloat(el.dataset.shown || w.psn);
      animateNum(el, from, w.psn);
      el.dataset.shown = w.psn;
    });
    const usd = U.$('#walletUsd');
    if (usd) usd.textContent = '≈ $' + U.fmt(w.psn * coins.find((c) => c.sym === 'PSN').price) + ' (play-money, worthless IRL)';
    const hist = U.$('#walletHist');
    if (hist) hist.innerHTML = w.history.slice(0, 8).map((h) => `<div class="wh ${h.amt >= 0 ? 'in' : 'out'}"><span>${h.what}</span><b>${h.amt >= 0 ? '+' : ''}${h.amt} $PSN</b></div>`).join('') || '<div class="wh muted">no transactions yet</div>';
  }
  function animateNum(el, from, to) {
    const t0 = performance.now(), dur = 700;
    const tick = (t) => {
      const u = Math.min(1, (t - t0) / dur);
      el.textContent = U.fmt(from + (to - from) * U.ease.out(u), 0);
      if (u < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  P.spend = function (amt, what) {
    if (P.state.wallet.psn < amt) { P.toast('Insufficient $PSN', 'Mine, claim the airdrop, or earn badges', 'error', '✕'); P.sfx('error'); return false; }
    P.state.wallet.psn -= amt;
    P.state.wallet.history.unshift({ what, amt: -amt, t: Date.now() });
    P.save(); P.emit('wallet'); P.chain('TX -' + amt + ' PSN · ' + what);
    return true;
  };
  P.earn = function (amt, what) {
    P.state.wallet.psn += amt;
    P.state.wallet.history.unshift({ what, amt, t: Date.now() });
    if (P.state.wallet.history.length > 40) P.state.wallet.history.pop();
    P.save(); P.emit('wallet');
  };

  /* ---------------- sparkline charts ---------------- */
  function drawSpark(cv, c) {
    const g = cv.getContext('2d');
    const W = (cv.width = cv.clientWidth * 2), H = (cv.height = cv.clientHeight * 2);
    const h = c.hist, mn = Math.min(...h), mx = Math.max(...h);
    const up = h[h.length - 1] >= h[0];
    const col = up ? '#00ff9d' : '#ff2e55';
    g.clearRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, up ? 'rgba(0,255,157,0.35)' : 'rgba(255,46,85,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.beginPath();
    h.forEach((v, i) => { const x = (i / (h.length - 1)) * W, y = H - ((v - mn) / (mx - mn || 1)) * (H - 8) - 4; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = col; g.lineWidth = 3; g.shadowColor = col; g.shadowBlur = 12; g.stroke();
    g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = gr; g.shadowBlur = 0; g.fill();
  }
  function renderMarket() {
    const host = U.$('#marketGrid');
    if (!host) return;
    if (!host.childElementCount) {
      coins.forEach((c) => {
        host.append(U.el('div', { class: 'coin-card tilt', 'data-sym': c.sym, html: `
          <div class="cc-top"><i style="--c:${c.color}">${c.icon}</i><div><b>${c.sym}</b><span>${c.name}</span></div><em></em></div>
          <div class="cc-price"></div><canvas></canvas>` }));
      });
      P.fx && P.fx.bindTilt(host);
    }
    U.$$('.coin-card', host).forEach((card) => {
      const c = coins.find((x) => x.sym === card.dataset.sym);
      const d = chg(c);
      U.$('.cc-price', card).textContent = '$' + fmtP(c.price);
      const em = U.$('em', card);
      em.textContent = (d >= 0 ? '+' : '') + d.toFixed(2) + '%';
      em.className = d >= 0 ? 'up' : 'down';
      drawSpark(U.$('canvas', card), c);
    });
  }

  /* ---------------- fear & greed (driven by fake K/D) ---------------- */
  let kd = 2.4;
  function renderFG() {
    const el = U.$('#fgGauge');
    if (!el || !P.isOn('feargreed')) return;
    kd = U.clamp(kd + (Math.random() - 0.48) * 0.08, 0.3, 5);
    const v = Math.round(U.clamp((kd / 4) * 100, 0, 100));
    const label = v < 25 ? 'Extreme Fear' : v < 45 ? 'Fear' : v < 55 ? 'Neutral' : v < 75 ? 'Greed' : 'Extreme Greed';
    el.style.setProperty('--v', v);
    U.$('#fgVal').textContent = v;
    U.$('#fgLabel').textContent = `${label} · K/D ${kd.toFixed(2)}`;
  }

  /* ---------------- miner mini-game ---------------- */
  let mined = 0, diff = 4, hashing = false;
  function setupMiner() {
    const btn = U.$('#mineBtn');
    if (!btn) return;
    const out = U.$('#mineOut'), bar = U.$('#mineBar');
    btn.addEventListener('click', (e) => {
      if (hashing) return;
      hashing = true;
      btn.classList.add('busy');
      let n = 0;
      const target = '0'.repeat(Math.min(diff, 3));
      const iv = setInterval(() => {
        n++;
        const h = U.hash('blk' + mined + ':' + n + Math.random());
        out.textContent = h.slice(0, 34) + '…';
        bar.style.width = Math.min(100, n * 7) + '%';
        if (n > 14 && (h.slice(2, 2 + target.length) === target || n > 16)) {
          clearInterval(iv);
          hashing = false;
          btn.classList.remove('busy');
          mined++;
          const reward = 3 + Math.floor(Math.random() * 6);
          P.earn(reward, 'Block mined');
          out.innerHTML = `<b>BLOCK FOUND</b> nonce ${n} · +${reward} $PSN`;
          P.sfx('coin');
          P.fx && P.fx.burst(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, 26, '#ffd23f');
          U.$('#mineCount').textContent = mined;
          P.chain('MINED block · reward ' + reward);
          if (mined >= 25) P.unlock('miner');
          bar.style.width = '0%';
        }
      }, 45);
    });
  }

  /* ---------------- daily airdrop ---------------- */
  function setupAirdrop() {
    const btn = U.$('#airdropBtn');
    if (!btn) return;
    const key = 'airdrop';
    const last = P.state.stats[key] || 0;
    const ready = () => Date.now() - (P.state.stats[key] || 0) > 20 * 3600 * 1000;
    const sync = () => { btn.disabled = !ready(); btn.textContent = ready() ? 'Claim airdrop · 150 $PSN' : 'Claimed · come back tomorrow'; };
    sync();
    btn.addEventListener('click', (e) => {
      if (!ready()) return;
      P.state.stats[key] = Date.now();
      P.earn(150, 'Daily airdrop');
      P.toast('Airdrop claimed', '+150 $PSN', 'gold', '🪂');
      P.sfx('coin');
      P.fx && P.fx.confetti(e.clientX, e.clientY);
      sync();
    });
    void last;
  }

  /* ---------------- boot ---------------- */
  P.initCrypto = function () {
    renderTicker();
    renderWallet();
    setupMiner();
    setupAirdrop();
    renderMarket();
    renderFG();
    P.chain('GENESIS · POISON client boot');
    P.on('wallet', renderWallet);
    P.on('module', (e) => { if (e.id === 'ticker') renderTicker(); if (e.id === 'explorer') renderExplorer(); });
    let n = 0;
    setInterval(() => {
      coins.forEach(step);
      n++;
      if (n % 2 === 0) renderTicker();
      if (U.$('#page-market').classList.contains('active')) { renderMarket(); renderFG(); }
      // price alert flavour
      const psn = coins.find((c) => c.sym === 'PSN');
      if (n % 40 === 0 && P.isOn('notifs')) P.toast(`$PSN ${chg(psn) >= 0 ? 'pumping' : 'dipping'}`, `${chg(psn).toFixed(2)}% today (simulated)`, chg(psn) >= 0 ? 'on' : 'off', chg(psn) >= 0 ? '📈' : '📉');
    }, 1500);
    // playtime "staking" reward while the launcher is open
    setInterval(() => { P.state.stats.playtime++; if (P.state.stats.playtime % 5 === 0) P.earn(1, 'Uptime reward'); }, 60000);
  };
})();
