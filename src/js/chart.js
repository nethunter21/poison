/* Poison Terminal — high-performance canvas candlestick chart */
(function (P) {
  const U = P.U;

  function niceStep(range, n) {
    const raw = range / n;
    if (!(raw > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  class Chart {
    constructor(canvas, legendEl) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.legend = legendEl;
      this.data = []; this.tf = 60; this.mult = 1; this.unit = 'mc';
      this.barW = 9; this.offset = 0; this.rightPad = 8;
      this.mouse = null; this.markers = []; this.entry = null; this.symbol = '';
      this.dirty = true; this.disp = null; this.frameN = 0;
      this.readColors();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
      this.bind();
      this.resize();
      const loop = () => { this.frame(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
    readColors() {
      const cs = getComputedStyle(document.documentElement);
      const g = (k) => cs.getPropertyValue(k).trim();
      this.col = { up: g('--up') || '#1dffa3', down: g('--down') || '#ff3d71', accent: g('--accent') || '#9dff3a', upRgb: g('--up-rgb'), downRgb: g('--down-rgb'), accRgb: g('--accent-rgb'), text: '#8189a6', grid: 'rgba(255,255,255,0.045)', mono: g('--mono') || 'monospace' };
      this.dirty = true;
    }
    resize() {
      const r = this.c.parentElement.getBoundingClientRect();
      this.dpr = window.devicePixelRatio || 1;
      this.w = Math.max(50, r.width); this.h = Math.max(50, r.height);
      this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
      this.dirty = true;
    }
    bind() {
      const c = this.c;
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        this.barW = U.clamp(this.barW * k, 1.5, 48);
        this.dirty = true;
      }, { passive: false });
      let drag = null;
      c.addEventListener('mousedown', (e) => { drag = { x: e.clientX, off: this.offset }; c.style.cursor = 'grabbing'; });
      addEventListener('mouseup', () => { drag = null; c.style.cursor = 'crosshair'; });
      c.addEventListener('mousemove', (e) => {
        const r = c.getBoundingClientRect();
        this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
        if (drag) { this.offset = U.clamp(drag.off + (e.clientX - drag.x) / this.barW, -30, Math.max(0, this.data.length - 5)); }
        this.dirty = true;
      });
      c.addEventListener('mouseleave', () => { this.mouse = null; this.dirty = true; });
      c.addEventListener('dblclick', () => { this.offset = 0; this.barW = 9; this.dirty = true; });
    }
    setData(arr, tf) {
      this.data = arr || []; this.tf = tf || this.tf; this.offset = 0;
      const last = this.data[this.data.length - 1];
      this.disp = last ? last.c : null;
      this.dirty = true;
    }
    setMult(m) { this.mult = m > 0 && isFinite(m) ? m : 1; this.dirty = true; }
    setUnit(u) { this.unit = u; this.dirty = true; }
    setMarkers(m) { this.markers = m || []; this.dirty = true; }
    setEntry(p) { this.entry = p; this.dirty = true; }
    tick(price, vol, tsMs) {
      if (!(price > 0)) return;
      const sec = Math.floor((tsMs || Date.now()) / 1000);
      const b = Math.floor(sec / this.tf) * this.tf;
      const d = this.data;
      let last = d[d.length - 1];
      if (!last) { d.push({ t: b, o: price, h: price, l: price, c: price, v: vol || 0 }); this.dirty = true; return; }
      if (b < last.t) return;
      if (b === last.t) {
        last.h = Math.max(last.h, price); last.l = Math.min(last.l, price); last.c = price; last.v += vol || 0;
      } else {
        let added = 0;
        for (let x = last.t + this.tf; x < b && added < 600; x += this.tf, added++) d.push({ t: x, o: last.c, h: last.c, l: last.c, c: last.c, v: 0 });
        last = d[d.length - 1];
        d.push({ t: b, o: last.c, h: Math.max(last.c, price), l: Math.min(last.c, price), c: price, v: vol || 0 });
        added++;
        if (this.offset > 0.5) this.offset += added;
        if (d.length > 3000) d.splice(0, d.length - 3000);
      }
      this.dirty = true;
    }
    fmt(v) { return this.unit === 'mc' ? U.fmtCompact(v, '$') : U.fmtPrice(v, '$'); }
    findIdx(tsSec) {
      const d = this.data; let lo = 0, hi = d.length - 1;
      if (!d.length || tsSec < d[0].t) return -1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (d[m].t <= tsSec) lo = m; else hi = m - 1; }
      return lo;
    }
    frame() {
      this.frameN++;
      if (document.hidden) return;
      const fx = P.S ? P.S.get('effects') : 'low';
      const hi = fx === 'high';
      const last = this.data[this.data.length - 1];
      let animating = false;
      if (hi && last && this.disp != null && Math.abs(this.disp - last.c) > Math.abs(last.c) * 1e-6) {
        this.disp += (last.c - this.disp) * 0.25; animating = true;
      } else if (last) this.disp = last.c;
      const pulse = hi && this.frameN % 2 === 0;
      if (!this.dirty && !animating && !pulse) return;
      const now = performance.now();
      if (now - (this.lastDraw || 0) < (hi ? 16 : 66)) return; // Lite: max ~15 fps, only when something changed
      this.lastDraw = now;
      this.dirty = false;
      this.draw();
    }
    draw() {
      const ctx = this.ctx, W = this.w, H = this.h, dpr = this.dpr, col = this.col, m = this.mult;
      this.hi = P.S.get('effects') === 'high';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const axisW = 76, axisH = 22;
      const pw = W - axisW, ph = H - axisH;
      const d = this.data;

      // watermark
      if (this.symbol) {
        ctx.save();
        ctx.font = `900 ${Math.min(120, pw / 6)}px ${col.mono}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillText('$' + this.symbol, pw / 2, ph / 2);
        ctx.restore();
      }
      if (!d.length) {
        ctx.fillStyle = col.text; ctx.font = `12px ${col.mono}`; ctx.textAlign = 'center';
        ctx.fillText('waiting for trades…', pw / 2, ph / 2 + 40);
        return;
      }
      const bw = this.barW;
      const lastIdx = d.length - 1 - Math.round(this.offset);
      const xOf = (i) => pw - (lastIdx - i + this.rightPad + 0.5) * bw;
      const nVis = Math.ceil(pw / bw) + 2;
      const i0 = Math.max(0, lastIdx + this.rightPad - nVis), i1 = Math.min(d.length - 1, lastIdx + this.rightPad);

      let mn = Infinity, mx = -Infinity, vmx = 0;
      for (let i = i0; i <= i1; i++) { const k = d[i]; if (k.l < mn) mn = k.l; if (k.h > mx) mx = k.h; if (k.v > vmx) vmx = k.v; }
      if (this.entry && this.entry > mn * 0.5 && this.entry < mx * 2) { mn = Math.min(mn, this.entry); mx = Math.max(mx, this.entry); }
      if (!isFinite(mn)) { mn = d[d.length - 1].c * 0.9; mx = d[d.length - 1].c * 1.1; }
      if (mx === mn) { mx = mn * 1.02 + 1e-12; mn = mn * 0.98; }
      mn *= m; mx *= m;
      const pad = (mx - mn) * 0.1;
      const top = mx + pad, bot = mn - pad * 0.6;
      const pTop = 10, pBot = ph - 14;
      const yOf = (v) => pTop + (top - v * m) / (top - bot) * (pBot - pTop);
      const yRaw = (vScaled) => pTop + (top - vScaled) / (top - bot) * (pBot - pTop);

      // horizontal grid + y labels
      ctx.font = `10.5px ${col.mono}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const step = niceStep(top - bot, 6);
      ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
      for (let v = Math.ceil(bot / step) * step; v <= top; v += step) {
        const y = Math.round(yRaw(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke();
        ctx.fillStyle = col.text; ctx.fillText(this.fmt(v), pw + 8, y);
      }
      // vertical grid + time labels
      const every = Math.max(1, Math.ceil(95 / bw));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let i = i0; i <= i1; i++) {
        if (i % every) continue;
        const x = Math.round(xOf(i)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ph); ctx.stroke();
        const dt = new Date(d[i].t * 1000);
        const lbl = this.tf >= 3600 && dt.getHours() === 0 ? `${dt.getMonth() + 1}/${dt.getDate()}` : U.time(d[i].t * 1000, this.tf < 60);
        ctx.fillStyle = col.text; ctx.fillText(lbl, x, ph + 5);
      }
      // axis borders
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(pw + 0.5, 0); ctx.lineTo(pw + 0.5, ph); ctx.lineTo(0, ph + 0.5); ctx.stroke();

      // volume
      const volH = ph * 0.17;
      if (vmx > 0) {
        for (let i = i0; i <= i1; i++) {
          const k = d[i]; if (!k.v) continue;
          const x = xOf(i), hh = (k.v / vmx) * volH;
          ctx.fillStyle = k.c >= k.o ? `rgba(${col.upRgb},0.22)` : `rgba(${col.downRgb},0.22)`;
          ctx.fillRect(x - bw * 0.36, ph - hh, Math.max(1, bw * 0.72), hh);
        }
      }

      // candles
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.clip();
      const bodyW = Math.max(1, bw * 0.68);
      for (let i = i0; i <= i1; i++) {
        const k = d[i]; const up = k.c >= k.o;
        const x = Math.round(xOf(i));
        const yo = yOf(k.o), yc = yOf(k.c), yh = yOf(k.h), yl = yOf(k.l);
        const c = up ? col.up : col.down;
        ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl); ctx.stroke();
        const yTop = Math.min(yo, yc), hh = Math.max(1, Math.abs(yc - yo));
        if (i === d.length - 1 && P.S.get('effects') === 'high') { ctx.shadowColor = c; ctx.shadowBlur = 12; }
        ctx.fillRect(x + 0.5 - bodyW / 2, yTop, bodyW, hh);
        ctx.shadowBlur = 0;
      }

      // avg entry line
      if (this.entry) {
        const y = Math.round(yOf(this.entry)) + 0.5;
        ctx.setLineDash([6, 4]); ctx.strokeStyle = col.accent; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.font = `700 10px ${col.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = col.accent; ctx.fillText('AVG ENTRY ' + this.fmt(this.entry * m), 8, y - 3);
      }

      // trade markers
      for (const mk of this.markers) {
        const i = this.findIdx(Math.floor(mk.t / 1000));
        if (i < i0 || i > i1) continue;
        const x = xOf(i), y = yOf(mk.price);
        const buy = mk.side === 'buy', c = buy ? col.up : col.down;
        ctx.save();
        if (this.hi) { ctx.shadowColor = c; ctx.shadowBlur = 10; } ctx.fillStyle = c;
        ctx.beginPath();
        if (buy) { ctx.moveTo(x, y + 6); ctx.lineTo(x - 6, y + 16); ctx.lineTo(x + 6, y + 16); }
        else { ctx.moveTo(x, y - 6); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x + 6, y - 16); }
        ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
        ctx.font = `800 9px ${col.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = buy ? 'top' : 'bottom';
        ctx.fillText(buy ? 'B' : 'S', x, buy ? y + 18 : y - 18);
        ctx.restore();
      }
      ctx.restore();

      // last price line
      const lastC = d[d.length - 1];
      const lp = this.disp ?? lastC.c;
      const ly = Math.round(yOf(lp)) + 0.5;
      const lup = lastC.c >= lastC.o, lc = lup ? col.up : col.down;
      ctx.setLineDash([2, 3]); ctx.strokeStyle = lc; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(pw, ly); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      // pulse dot at last candle
      const lx = xOf(d.length - 1);
      if (lx > 0 && lx < pw) {
        const t = (performance.now() % 1600) / 1600;
        if (P.S.get('effects') === 'high') {
          ctx.beginPath(); ctx.arc(lx + 0.5, ly, 3 + t * 12, 0, Math.PI * 2);
          ctx.strokeStyle = lc; ctx.globalAlpha = 1 - t; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(lx + 0.5, ly, 3, 0, Math.PI * 2); ctx.fillStyle = lc; if (this.hi) { ctx.shadowColor = lc; ctx.shadowBlur = 12; } ctx.fill(); ctx.shadowBlur = 0;
      }
      this.axisLabel(ly, this.fmt(lp * m), lc, '#04110a');

      // crosshair
      const mo = this.mouse;
      let hover = lastC;
      if (mo && mo.x < pw && mo.y < ph) {
        const i = Math.round(lastIdx + this.rightPad + 0.5 - (pw - mo.x) / bw - 0.5);
        const ci = U.clamp(i, 0, d.length - 1);
        hover = d[ci];
        const cx = Math.round(xOf(ci)) + 0.5, cy = Math.round(mo.y) + 0.5;
        ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, ph); ctx.moveTo(0, cy); ctx.lineTo(pw, cy); ctx.stroke(); ctx.setLineDash([]);
        const val = top - (mo.y - pTop) / (pBot - pTop) * (top - bot);
        this.axisLabel(cy, this.fmt(val), '#2a2f45', '#fff');
        // time label
        const tl = (this.tf >= 3600 ? new Date(hover.t * 1000).toLocaleDateString() + ' ' : '') + U.time(hover.t * 1000, this.tf < 60);
        ctx.font = `10.5px ${col.mono}`;
        const tw = ctx.measureText(tl).width + 12;
        ctx.fillStyle = '#2a2f45'; this.rr(cx - tw / 2, ph + 2, tw, 18, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tl, cx, ph + 11);
      }
      this.updateLegend(hover);
    }
    axisLabel(y, text, bg, fg) {
      const ctx = this.ctx, x = this.w - 76;
      ctx.font = `700 10.5px ${this.col.mono}`;
      ctx.fillStyle = bg; this.rr(x + 2, y - 9, 72, 18, 4); ctx.fill();
      ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 7, y);
    }
    rr(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    updateLegend(k) {
      if (!this.legend || !k) return;
      const key = k.t + ':' + k.c + ':' + k.v + ':' + this.unit;
      if (this._lk === key) return; this._lk = key;
      const m = this.mult, ch = k.o ? (k.c / k.o - 1) * 100 : 0;
      this.legend.innerHTML = `<span>O <b>${this.fmt(k.o * m)}</b></span><span>H <b>${this.fmt(k.h * m)}</b></span><span>L <b>${this.fmt(k.l * m)}</b></span><span>C <b class="${U.cls(ch)}">${this.fmt(k.c * m)}</b></span><span class="${U.cls(ch)}">${U.fmtPct(ch, 2)}</span><span>Vol <b>${U.fmtCompact(k.v)}</b></span>`;
    }
  }
  P.Chart = Chart;
})(window.P);
