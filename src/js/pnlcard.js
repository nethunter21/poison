/* Poison Terminal — shareable PnL card generator */
(function (P) {
  const U = P.U, S = P.S, FX = P.FX;
  const W = 1200, H = 675;

  const FONTS = {
    modern: { label: 'Modern', f: '"Segoe UI Variable Display", "Segoe UI", Inter, system-ui, sans-serif', w: 900 },
    mono: { label: 'Terminal', f: '"Cascadia Code", "JetBrains Mono", Consolas, monospace', w: 800 },
    impact: { label: 'Impact', f: 'Impact, "Arial Black", "Haettenschweiler", sans-serif', w: 400 },
    serif: { label: 'Luxury', f: 'Georgia, "Times New Roman", serif', w: 700 }
  };

  const BGS = {
    auto: { label: 'Auto', c: ['#04130c', '#140409'] },
    toxic: { label: 'Toxic', c: ['#031109', '#0c2a10'] },
    nebula: { label: 'Nebula', c: ['#0b0420', '#260a3a'] },
    inferno: { label: 'Inferno', c: ['#1a0500', '#3a0d00'] },
    ice: { label: 'Ice', c: ['#020c1a', '#06223a'] },
    gold: { label: 'Gold', c: ['#0d0900', '#2a1d02'] },
    matrix: { label: 'Matrix', c: ['#000500', '#001a08'] },
    void: { label: 'Void', c: ['#000000', '#0a0a0f'] },
    sunset: { label: 'Sunset', c: ['#1a0420', '#3a1205'] },
    ocean: { label: 'Ocean', c: ['#001014', '#003a3a'] },
    blood: { label: 'Blood', c: ['#120002', '#380008'] },
    custom: { label: 'Image', c: ['#111', '#222'] }
  };

  const DEF = {
    bg: 'auto', customBg: null, accent: null, font: 'modern', unit: 'sol', layout: 'left',
    show: { invested: true, sold: true, holding: true, entry: true, spark: true, handle: true, date: true, brand: true, usdSub: true },
    handle: null, avatar: null, tagline: 'poison terminal', glow: 70, grain: true, bgDim: 55
  };
  let opt = Object.assign({}, DEF, U.store.get('pnlcard', {}));
  opt.show = Object.assign({}, DEF.show, opt.show || {});
  const saveOpt = () => U.store.set('pnlcard', opt);

  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = (async () => {
      let url = src;
      if (/^https?:/.test(src) && window.native && window.native.fetchImage) url = (await window.native.fetchImage(src)) || null;
      if (!url) return null;
      return await new Promise((res) => {
        const im = new Image();
        if (/^https?:/.test(url)) im.crossOrigin = 'anonymous';
        im.onload = () => res(im); im.onerror = () => res(null);
        im.src = url;
      });
    })();
    imgCache.set(src, p);
    return p;
  }

  // seeded rng for stable decorations
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function blob(ctx, x, y, r, color, a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'transparent'); ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

  function drawBg(ctx, d, o, t, bgImg) {
    const win = d.pnl >= 0;
    let key = o.bg;
    const up = S.get('upColor'), down = S.get('downColor');
    const acc = o.accent || S.accent().accent;
    const cols = key === 'auto' ? (win ? ['#03140c', '#062a18'] : ['#160307', '#2e0610']) : BGS[key].c;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = rng(U.hash(key + d.symbol));
    const s = Math.sin(t * 0.6), c = Math.cos(t * 0.45);
    const main = key === 'auto' ? (win ? up : down) : acc;

    if (key === 'custom' && bgImg) {
      const sc = Math.max(W / bgImg.width, H / bgImg.height);
      const iw = bgImg.width * sc, ih = bgImg.height * sc;
      ctx.drawImage(bgImg, (W - iw) / 2, (H - ih) / 2, iw, ih);
      ctx.fillStyle = `rgba(0,0,0,${o.bgDim / 100})`; ctx.fillRect(0, 0, W, H);
    } else if (key === 'nebula') {
      blob(ctx, 300 + s * 60, 200, 420, '#7b2cff', 0.55); blob(ctx, 950 + c * 50, 480, 460, '#ff2fa0', 0.45); blob(ctx, 700, 100 + s * 30, 300, '#2f7bff', 0.4);
      for (let i = 0; i < 140; i++) { const x = r() * W, y = r() * H, z = r(); ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i)); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, z * 2.2, z * 2.2); }
      ctx.globalAlpha = 1;
    } else if (key === 'inferno' || key === 'sunset') {
      const a = key === 'inferno' ? ['#ff5a00', '#ff1e00', '#ffb300'] : ['#ff4fa0', '#ff8a3d', '#7b2cff'];
      blob(ctx, 1000, 600, 600, a[0], 0.55); blob(ctx, 200 + s * 40, 650, 450, a[1], 0.45); blob(ctx, 900 + c * 60, 100, 300, a[2], 0.3);
      ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (let i = -10; i < 30; i++) { const x = i * 70 + ((t * 40) % 70); ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 300, 0); ctx.stroke(); }
      ctx.restore();
    } else if (key === 'gold') {
      ctx.save(); ctx.translate(980, 120); ctx.rotate(t * 0.05);
      for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); ctx.fillStyle = i % 2 ? 'rgba(255,201,61,0.06)' : 'rgba(255,201,61,0.02)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -90); ctx.lineTo(1400, 90); ctx.fill(); }
      ctx.restore(); blob(ctx, 980, 120, 380, '#ffc93d', 0.4);
    } else if (key === 'matrix') {
      ctx.font = '16px Consolas, monospace'; ctx.fillStyle = '#00ff66';
      const glyphs = '01ｱｲｳｴｵｶｷｸｹｺｻｼｽ$◎▲▼';
      for (let col = 0; col < 60; col++) {
        const speed = 40 + r() * 120, off = r() * H;
        for (let k = 0; k < 14; k++) {
          const y = ((off + t * speed + k * 22) % (H + 300)) - 150;
          ctx.globalAlpha = (k / 14) * 0.35; ctx.fillText(glyphs[(col * 7 + k + Math.floor(t * 3)) % glyphs.length], col * 20 + 4, y);
        }
      }
      ctx.globalAlpha = 1; blob(ctx, 300, 340, 420, '#00ff66', 0.18);
    } else if (key === 'ice' || key === 'ocean') {
      const a = key === 'ice' ? ['#3dd8ff', '#7a7bff'] : ['#00e5c0', '#0077ff'];
      blob(ctx, 250 + s * 50, 150, 420, a[0], 0.4); blob(ctx, 1000, 560 + c * 30, 480, a[1], 0.4);
      ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#fff';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); for (let x = 0; x <= W; x += 20) { const y = 380 + i * 26 + Math.sin(x / 120 + t + i) * 18; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.restore();
    } else if (key === 'blood') {
      blob(ctx, 950, 200 + s * 40, 500, '#ff0030', 0.45); blob(ctx, 200, 600, 400, '#ff3d00', 0.25);
    } else if (key === 'void') {
      blob(ctx, 950 + s * 60, 330, 420, acc, 0.16);
    } else {
      // toxic / auto: neon grid floor + blobs
      blob(ctx, 950 + s * 60, 160 + c * 30, 480, main, 0.42); blob(ctx, 120, 640, 420, key === 'toxic' ? '#00ffc3' : main, 0.25);
      ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = main; ctx.lineWidth = 1;
      const hz = 430;
      for (let i = 0; i < 16; i++) { const y = hz + Math.pow(i / 16, 2) * (H - hz) + ((t * 20) % 16) * (i / 16); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, hz); ctx.lineTo(W / 2 + i * 160, H); ctx.stroke(); }
      ctx.restore();
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (o.grain) {
      const r2 = rng(99 + Math.floor(t * 8));
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 2600; i++) { ctx.fillStyle = r2() > 0.5 ? '#fff' : '#000'; ctx.fillRect(r2() * W, r2() * H, 1.5, 1.5); }
      ctx.globalAlpha = 1;
    }
  }

  function render(ctx, d, o, t, imgs) {
    const F = FONTS[o.font] || FONTS.modern;
    const win = d.pnl >= 0;
    const up = S.get('upColor'), down = S.get('downColor');
    const pc = win ? up : down;
    const acc = o.accent || S.accent().accent;
    const glow = o.glow / 100;
    const center = o.layout === 'center';
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    drawBg(ctx, d, o, t, imgs.bg);

    // sparkline
    if (o.show.spark && d.ticks && d.ticks.length > 2) {
      const pts = d.ticks; let mn = Math.min(...pts), mx = Math.max(...pts); if (mx === mn) mx = mn * 1.01 + 1e-12;
      const x0 = center ? 0 : 560, x1 = W, y0 = center ? 160 : 150, y1 = center ? 560 : 500;
      const prog = Math.min(1, (t % 6) / 2.2 + (o._static ? 1 : 0));
      const n = Math.max(2, Math.floor(pts.length * prog));
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const x = x0 + (i / (pts.length - 1)) * (x1 - x0); const y = y1 - ((pts[i] - mn) / (mx - mn)) * (y1 - y0); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.save();
      ctx.strokeStyle = pc; ctx.lineWidth = 4; ctx.globalAlpha = center ? 0.25 : 0.6; ctx.shadowColor = pc; ctx.shadowBlur = 24 * glow; ctx.stroke();
      const lx = x0 + ((n - 1) / (pts.length - 1)) * (x1 - x0);
      ctx.lineTo(lx, y1 + 120); ctx.lineTo(x0, y1 + 120); ctx.closePath();
      const gf = ctx.createLinearGradient(0, y0, 0, y1 + 120); gf.addColorStop(0, pc + '55'); gf.addColorStop(1, pc + '00');
      ctx.fillStyle = gf; ctx.shadowBlur = 0; ctx.globalAlpha = center ? 0.25 : 0.5; ctx.fill();
      ctx.restore();
    }

    const X = center ? W / 2 : 70;
    ctx.textAlign = center ? 'center' : 'left';
    ctx.textBaseline = 'alphabetic';

    // brand
    if (o.show.brand) {
      ctx.save();
      const bx = center ? W / 2 - 80 : 70, by = 62;
      [[10, 0, 11, acc], [0, 14, 7, S.accent().accent2], [16, 17, 5, acc]].forEach(([dx, dy, rad, c]) => { ctx.beginPath(); ctx.arc(bx + dx + 6, by - 22 + dy + 6, rad, 0, Math.PI * 2); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14 * glow; ctx.fill(); });
      ctx.shadowBlur = 0; ctx.font = `900 24px ${FONTS.modern.f}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
      ctx.letterSpacing = '6px'; ctx.fillText('POISON', bx + 42, by); ctx.letterSpacing = '0px';
      ctx.restore();
    }
    if (o.show.date) {
      ctx.font = `600 18px ${FONTS.mono.f}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'right';
      ctx.fillText(new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + (d.duration ? '  ·  held ' + d.duration : ''), W - 60, 60);
      ctx.textAlign = center ? 'center' : 'left';
    }

    // token
    const ty = 150;
    const avR = 34;
    if (center) {
      ctx.font = `${F.w} 46px ${F.f}`;
      const tw = ctx.measureText('$' + d.symbol).width;
      const startX = W / 2 - (tw + avR * 2 + 18) / 2;
      drawAvatar(ctx, imgs.token, d, startX + avR, ty - 14, avR);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('$' + d.symbol, startX + avR * 2 + 18, ty);
      ctx.textAlign = 'center';
    } else {
      drawAvatar(ctx, imgs.token, d, X + avR, ty - 14, avR);
      ctx.font = `${F.w} 46px ${F.f}`; ctx.fillStyle = '#fff'; ctx.fillText('$' + d.symbol, X + avR * 2 + 20, ty);
      ctx.font = `500 18px ${FONTS.modern.f}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(d.label || d.name || '', X + avR * 2 + 22, ty + 26);
    }

    // big pnl %
    const pctTxt = U.fmtPct(d.pnlPct, Math.abs(d.pnlPct) >= 100 ? 0 : 1);
    let size = 158;
    ctx.font = `${F.w} ${size}px ${F.f}`;
    while (ctx.measureText(pctTxt).width > (center ? 1000 : 640) && size > 60) { size -= 6; ctx.font = `${F.w} ${size}px ${F.f}`; }
    const py = center ? 360 : 345;
    const pulse = 1 + Math.sin(t * 3) * 0.08;
    ctx.save();
    ctx.shadowColor = pc; ctx.shadowBlur = 50 * glow * pulse;
    const tg = ctx.createLinearGradient(0, py - size, 0, py);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.55, pc); tg.addColorStop(1, pc);
    ctx.fillStyle = tg; ctx.fillText(pctTxt, X, py);
    ctx.restore();

    // pnl amount
    const amt = o.unit === 'usd' ? U.fmtSigned(d.pnlUsd, (v) => '$' + U.fmtNum(v, v >= 1000 ? 0 : 2)) : U.fmtSigned(d.pnl, (v) => v.toFixed(v >= 100 ? 2 : 3)) + ' SOL';
    ctx.font = `${F.w} 46px ${F.f}`; ctx.fillStyle = pc;
    ctx.fillText(amt, X, py + 64);
    if (o.show.usdSub) {
      ctx.font = `600 20px ${FONTS.mono.f}`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      const sub = o.unit === 'usd' ? U.fmtSigned(d.pnl, (v) => v.toFixed(3)) + ' SOL' : '≈ ' + U.fmtSigned(d.pnlUsd, (v) => '$' + U.fmtNum(v, v >= 1000 ? 0 : 2));
      ctx.fillText(sub, X, py + 96);
    }

    // stats boxes
    const val = (sol) => (o.unit === 'usd' ? U.fmtCompact(sol * d.solUsd, '$') : (sol >= 100 ? sol.toFixed(1) : sol.toFixed(3)) + ' ◎');
    const items = [];
    if (o.show.invested) items.push(['INVESTED', val(d.invested)]);
    if (o.show.sold) items.push(['SOLD', val(d.sold)]);
    if (o.show.holding) items.push(['HOLDING', val(d.holding)]);
    if (o.show.entry && d.entryMc) items.push(['ENTRY → NOW', U.fmtCompact(d.entryMc, '$') + ' → ' + U.fmtCompact(d.mc, '$')]);
    if (items.length) {
      const bw = items.map(([, v]) => Math.max(150, v.length * 13 + 40));
      const total = bw.reduce((a, b) => a + b, 0) + (items.length - 1) * 12;
      let bx = center ? (W - total) / 2 : X;
      const by = 505;
      ctx.textAlign = 'left';
      items.forEach(([k, v], i) => {
        ctx.save();
        rr(ctx, bx, by, bw[i], 70, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = `700 13px ${FONTS.modern.f}`; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.letterSpacing = '2px';
        ctx.fillText(k, bx + 16, by + 26); ctx.letterSpacing = '0px';
        ctx.font = `700 22px ${FONTS.mono.f}`; ctx.fillStyle = '#fff'; ctx.fillText(v, bx + 16, by + 55);
        ctx.restore();
        bx += bw[i] + 12;
      });
      ctx.textAlign = center ? 'center' : 'left';
    }

    // footer
    const fy = H - 36;
    if (o.show.handle) {
      const handle = o.handle || S.get('handle') || '@anon';
      ctx.font = `700 20px ${FONTS.modern.f}`;
      const hw = ctx.measureText(handle).width;
      const fx0 = center ? W / 2 - (hw + 40) / 2 : 70;
      if (imgs.avatar) { ctx.save(); ctx.beginPath(); ctx.arc(fx0 + 14, fy - 7, 15, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(imgs.avatar, fx0 - 1, fy - 22, 30, 30); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(fx0 + 14, fy - 7, 15, 0, Math.PI * 2); ctx.fillStyle = acc; ctx.fill(); ctx.fillStyle = '#000'; ctx.font = `900 14px ${FONTS.modern.f}`; ctx.textAlign = 'center'; ctx.fillText(handle.replace('@', '').slice(0, 1).toUpperCase() || '?', fx0 + 14, fy - 2); }
      ctx.textAlign = 'left'; ctx.font = `700 20px ${FONTS.modern.f}`; ctx.fillStyle = '#fff'; ctx.fillText(handle, fx0 + 40, fy);
    }
    if (o.tagline) {
      ctx.textAlign = 'right'; ctx.font = `600 16px ${FONTS.mono.f}`; ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(o.tagline, W - 60, fy);
    }
    // frame border glow
    ctx.save(); rr(ctx, 1.5, 1.5, W - 3, H - 3, 26); ctx.strokeStyle = pc + '66'; ctx.lineWidth = 3; ctx.shadowColor = pc; ctx.shadowBlur = 30 * glow; ctx.stroke(); ctx.restore();
    ctx.restore();
  }

  function drawAvatar(ctx, img, d, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 20;
    const [c1, c2] = U.tokenColors(d.address || d.symbol);
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.clip();
    if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    else { ctx.fillStyle = '#fff'; ctx.font = `900 ${r * 0.8}px ${FONTS.modern.f}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((d.symbol || '?').slice(0, 2).toUpperCase(), cx, cy + 2); ctx.textBaseline = 'alphabetic'; }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // ---------------------------------------------------------------- data
  function cardData(sel) {
    const solUsd = P.Data.solUsd || 0;
    if (sel === '__portfolio__') {
      const s = P.Trade.stats(), st = P.Trade.state();
      const durMs = Date.now() - st.createdAt;
      return { symbol: 'PORTFOLIO', name: 'All trades', label: `${s.wins}W / ${s.losses}L · ${s.winRate.toFixed(0)}% win rate`, address: 'portfolio', pnl: s.pnl, pnlPct: s.pnlPct, pnlUsd: s.pnl * solUsd, invested: st.start, sold: s.sol, holding: s.holding, entryMc: 0, mc: 0, solUsd, date: Date.now(), duration: fmtDur(durMs), ticks: null, image: null };
    }
    const p = P.Trade.pos(sel); if (!p) return null;
    const m = P.Trade.metrics(p);
    const t = P.Data.get(p.address);
    let ticks = null;
    if (t && t.sim && t.m1) ticks = t.m1.filter((b) => b.t * 1000 >= p.firstAt - 120000).map((b) => b.c);
    if ((!ticks || ticks.length < 3) && P.UI && P.UI.chartCloses) ticks = P.UI.chartCloses(p.address);
    if (!ticks || ticks.length < 3) ticks = t && t.ticks && t.ticks.length > 2 ? t.ticks : null;
    return {
      symbol: p.symbol, name: p.name, address: p.address, image: p.image,
      pnl: m.total, pnlPct: m.totalPct, pnlUsd: m.totalUsd, invested: p.invested, sold: p.sold, holding: p.tokens > 0 ? m.value : 0,
      entryMc: m.avgEntryMc, mc: m.mc, solUsd, date: p.closedAt || Date.now(), duration: fmtDur((p.closedAt || Date.now()) - p.firstAt), ticks
    };
  }
  function fmtDur(ms) { const s = ms / 1000; if (s < 60) return Math.floor(s) + 's'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm'; return Math.floor(s / 86400) + 'd'; }

  // ---------------------------------------------------------------- modal
  const PnL = (P.PnL = { render, cardData, FONTS, BGS });
  let open = null;

  PnL.open = (sel) => {
    if (open) return;
    const positions = P.Trade.positions().filter((p) => p.buys > 0).sort((a, b) => b.lastAt - a.lastAt);
    sel = sel || (P.Data.selected && P.Trade.pos(P.Data.selected.address) ? P.Data.selected.address : positions[0] ? positions[0].address : '__portfolio__');
    const back = document.createElement('div');
    back.className = 'modal-back center';
    back.innerHTML = `
      <div class="modal pnlm">
        <div class="modal-head"><h2>🎴 PnL Card</h2><span class="muted" style="font-size:.85em">customize & share your bags</span><button class="modal-x" data-x>✕</button></div>
        <div class="pnlm-body">
          <div class="pnlm-preview">
            <canvas width="${W}" height="${H}"></canvas>
            <div class="pnlm-actions">
              <button class="btn primary" data-act="save">⬇ Save PNG <kbd>Ctrl S</kbd></button>
              <button class="btn" data-act="copy">⧉ Copy image <kbd>Ctrl C</kbd></button>
              <button class="btn" data-act="tweet">𝕏 Share text</button>
            </div>
          </div>
          <div class="pnlm-side"></div>
        </div>
      </div>`;
    document.getElementById('modalRoot').appendChild(back);
    FX.sound('open');
    const cv = back.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const side = back.querySelector('.pnlm-side');
    const imgs = { token: null, avatar: null, bg: null };
    let data = null, raf = 0, t0 = performance.now();

    function refreshImgs() {
      data = cardData(sel);
      loadImg(data && data.image).then((i) => (imgs.token = i));
      loadImg(opt.avatar).then((i) => (imgs.avatar = i));
      loadImg(opt.customBg).then((i) => (imgs.bg = i));
    }
    function sideHtml() {
      const bgs = Object.entries(BGS).map(([k, b]) => `<div class="bg-preset ${opt.bg === k ? 'active' : ''}" data-bg="${k}" title="${b.label}" style="background:${k === 'custom' && opt.customBg ? `url(${opt.customBg}) center/cover` : k === 'auto' ? `linear-gradient(135deg,${S.get('upColor')}55,${S.get('downColor')}55)` : `linear-gradient(135deg,${b.c[0]},${b.c[1]}),#000`}">${k === 'custom' && !opt.customBg ? '<div style="display:grid;place-items:center;height:100%;font-size:18px">＋</div>' : ''}</div>`).join('');
      const tog = (k, l) => `<label class="tog" data-tog="${k}"><span>${l}</span><div class="switch ${opt.show[k] ? 'on' : ''}"></div></label>`;
      const posList = [`<div class="pp-item ${sel === '__portfolio__' ? 'active' : ''}" data-sel="__portfolio__"><div class="avatar sm" style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#000">◎</div><span class="grow">Whole portfolio</span><span class="${U.cls(P.Trade.stats().pnl)}">${U.fmtPct(P.Trade.stats().pnlPct)}</span></div>`]
        .concat(positions.map((p) => { const m = P.Trade.metrics(p); return `<div class="pp-item ${sel === p.address ? 'active' : ''}" data-sel="${p.address}">${U.avatar(p, 'sm')}<span class="grow">$${U.esc(p.symbol)} ${p.tokens > 0 ? '<span class="badge-held">OPEN</span>' : ''}</span><span class="mono ${U.cls(m.total)}">${U.fmtPct(m.totalPct)}</span></div>`; })).join('');
      side.innerHTML = `
        <div><h4>Trade</h4><div class="pos-pick">${posList}</div></div>
        <div><h4>Background</h4><div class="bg-presets">${bgs}</div>
          ${opt.bg === 'custom' ? `<div class="field" style="margin-top:8px"><span class="muted">Dim ${opt.bgDim}%</span><input type="range" min="0" max="90" value="${opt.bgDim}" data-range="bgDim"></div>` : ''}
        </div>
        <div><h4>Style</h4>
          <div class="field"><select data-sel-opt="font">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${opt.font === k ? 'selected' : ''}>Font: ${f.label}</option>`).join('')}</select></div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <div class="seg big" data-seg="layout" style="flex:1"><button data-v="left" class="${opt.layout === 'left' ? 'active' : ''}">Left</button><button data-v="center" class="${opt.layout === 'center' ? 'active' : ''}">Center</button></div>
            <div class="seg big" data-seg="unit"><button data-v="sol" class="${opt.unit === 'sol' ? 'active' : ''}">SOL</button><button data-v="usd" class="${opt.unit === 'usd' ? 'active' : ''}">USD</button></div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="color" value="${opt.accent || S.accent().accent}" data-color="accent"><span class="muted" style="flex:1">Accent</span><button class="mini-btn" data-act="accentReset">theme</button></div>
          <div class="field" style="margin-top:6px"><span class="muted">Glow ${opt.glow}%</span><input type="range" min="0" max="100" value="${opt.glow}" data-range="glow"></div>
        </div>
        <div><h4>Show</h4><div class="toggles">${tog('invested', 'Invested')}${tog('sold', 'Sold')}${tog('holding', 'Holding')}${tog('entry', 'Entry MC')}${tog('spark', 'Chart')}${tog('usdSub', 'Sub value')}${tog('handle', 'Handle')}${tog('date', 'Date')}${tog('brand', 'Logo')}<label class="tog" data-grain><span>Grain</span><div class="switch ${opt.grain ? 'on' : ''}"></div></label></div></div>
        <div><h4>Identity</h4>
          <div class="field"><input type="text" placeholder="@handle" value="${U.esc(opt.handle || S.get('handle') || '')}" data-text="handle"></div>
          <div class="field" style="margin-top:6px"><input type="text" placeholder="Tagline / referral" value="${U.esc(opt.tagline || '')}" data-text="tagline"></div>
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" style="flex:1" data-act="avatar">🖼 Avatar</button>${opt.avatar ? '<button class="btn danger" data-act="avatarClear">✕</button>' : ''}</div>
        </div>
        <button class="btn danger" data-act="resetCard">Reset card style</button>`;
    }
    function pickFile(cb) {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result); r.readAsDataURL(f); };
      inp.click();
    }
    function update() { saveOpt(); sideHtml(); refreshImgs(); }

    side.addEventListener('click', (e) => {
      const el = e.target.closest('[data-bg],[data-tog],[data-grain],[data-sel],[data-seg] button,[data-act]');
      if (!el) return;
      FX.sound('click');
      if (el.dataset.bg) {
        if (el.dataset.bg === 'custom' && (!opt.customBg || opt.bg === 'custom')) { pickFile((url) => { opt.customBg = url; opt.bg = 'custom'; imgCache.delete(url); update(); }); return; }
        opt.bg = el.dataset.bg;
      } else if (el.dataset.tog) opt.show[el.dataset.tog] = !opt.show[el.dataset.tog];
      else if (el.hasAttribute('data-grain')) opt.grain = !opt.grain;
      else if (el.dataset.sel) sel = el.dataset.sel;
      else if (el.parentElement.dataset.seg) opt[el.parentElement.dataset.seg] = el.dataset.v;
      else if (el.dataset.act === 'avatar') { pickFile((url) => { opt.avatar = url; update(); }); return; }
      else if (el.dataset.act === 'avatarClear') opt.avatar = null;
      else if (el.dataset.act === 'accentReset') opt.accent = null;
      else if (el.dataset.act === 'resetCard') { opt = JSON.parse(JSON.stringify(DEF)); }
      update();
    });
    side.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.range) { opt[el.dataset.range] = +el.value; el.previousElementSibling.textContent = (el.dataset.range === 'glow' ? 'Glow ' : 'Dim ') + el.value + '%'; saveOpt(); }
      else if (el.dataset.color) { opt.accent = el.value; saveOpt(); }
      else if (el.dataset.text) { opt[el.dataset.text] = el.value; saveOpt(); }
    });
    side.addEventListener('change', (e) => { const el = e.target; if (el.dataset.selOpt) { opt[el.dataset.selOpt] = el.value; update(); } });

    function exportPng() {
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
      const x = c.getContext('2d'); x.scale(2, 2);
      const o = Object.assign({}, opt, { _static: true });
      render(x, data, o, 1.2, imgs);
      try { return c.toDataURL('image/png'); }
      catch { render(x, data, o, 1.2, { token: null, avatar: imgs.avatar, bg: imgs.bg }); return c.toDataURL('image/png'); }
    }
    async function act(a) {
      if (!data) return;
      if (a === 'save') {
        const url = exportPng(); const name = `${data.symbol}-pnl-${Date.now()}.png`;
        if (window.native) { const p = await window.native.saveImage(url, name); if (p) FX.toast('Card saved', p, 'ok'); }
        else { const l = document.createElement('a'); l.href = url; l.download = name; l.click(); FX.toast('Card downloaded', name, 'ok'); }
        FX.confetti(80);
      } else if (a === 'copy') {
        const url = exportPng();
        try {
          if (window.native) await window.native.copyImage(url);
          else { const blob = await (await fetch(url)).blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); }
          FX.toast('Copied to clipboard', 'Paste it straight into X / Discord / Telegram', 'ok');
        } catch (e) { FX.toast('Copy failed', e.message, 'err'); }
      } else if (a === 'tweet') {
        const txt = `${data.pnl >= 0 ? '🟢' : '🔴'} $${data.symbol} ${U.fmtPct(data.pnlPct)} (${U.fmtSigned(data.pnl, (v) => v.toFixed(3))} SOL)\nentry ${U.fmtCompact(data.entryMc)} → ${U.fmtCompact(data.mc)}\n— ${opt.tagline || 'poison terminal'}`;
        U.copy(txt); FX.toast('Share text copied', 'Attach the PNG and post', 'ok');
      }
    }
    back.querySelector('.pnlm-actions').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });

    function frame() {
      if (!data) { data = cardData(sel); }
      if (data) {
        const fresh = cardData(sel); if (fresh) data = fresh;
        const animate = S.get('effects') !== 'off';
        render(ctx, data, opt, animate ? (performance.now() - t0) / 1000 : 4, imgs);
      }
      raf = requestAnimationFrame(frame);
    }
    function close() {
      cancelAnimationFrame(raf);
      back.classList.add('out'); setTimeout(() => back.remove(), 200);
      open = null;
    }
    back.addEventListener('mousedown', (e) => { if (e.target === back || e.target.closest('[data-x]')) close(); });
    open = { close, act };
    sideHtml(); refreshImgs(); frame();
  };
  PnL.isOpen = () => !!open;
  PnL.close = () => open && open.close();
  PnL.action = (a) => open && open.act(a);
})(window.P);
