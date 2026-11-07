/* Poison Terminal — visual + audio effects */
(function (P) {
  const U = P.U;
  const FX = (P.FX = {});
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  let parts = [];
  let running = false;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  }
  resize();
  addEventListener('resize', resize);

  FX.level = () => (P.S ? P.S.get('effects') : 'high');

  function loop() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const next = [];
    for (const p of parts) {
      p.life -= 1;
      if (p.life <= 0) continue;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      const a = Math.min(1, p.life / p.fade);
      ctx.globalAlpha = a;
      if (p.kind === 'conf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      } else if (p.kind === 'ring') {
        p.s += p.grow;
        ctx.strokeStyle = p.c; ctx.lineWidth = 2.5 * a; ctx.shadowColor = p.c; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      } else if (p.kind === 'text') {
        ctx.font = `900 ${p.s}px ${getComputedStyle(document.body).getPropertyValue('--mono')}`;
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 16; ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y); ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * a, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      }
      next.push(p);
    }
    ctx.globalAlpha = 1;
    parts = next;
    if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }

  FX.burst = (x, y, color = '#9dff3a', n = 26) => {
    const lvl = FX.level();
    if (lvl === 'off') return;
    if (lvl === 'low') n = Math.round(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(2, 7.5);
      parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, g: 0.12, drag: 0.94, s: U.rand(1.5, 3.8), c: color, life: U.randInt(30, 60), fade: 25, rot: 0, vr: 0 });
    }
    parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, g: 0, drag: 1, s: 6, grow: 3.2, c: color, life: 28, fade: 28, rot: 0, vr: 0 });
    kick();
  };

  FX.floatText = (x, y, text, color) => {
    if (FX.level() === 'off') return;
    parts.push({ kind: 'text', text, x, y, vx: 0, vy: -1.4, g: 0.0, drag: 0.985, s: 20, c: color, life: 70, fade: 30, rot: 0, vr: 0 });
    kick();
  };

  FX.confetti = (n = 160) => {
    const lvl = FX.level();
    if (lvl === 'off') return;
    if (lvl === 'low') n = 50;
    const cs = getComputedStyle(document.body);
    const cols = [cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--accent2').trim(), cs.getPropertyValue('--up').trim(), '#ffd23d', '#ff4fd8', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      parts.push({
        kind: 'conf', x: fromLeft ? -10 : innerWidth + 10, y: innerHeight * U.rand(0.35, 0.8),
        vx: (fromLeft ? 1 : -1) * U.rand(6, 17), vy: -U.rand(6, 16), g: 0.28, drag: 0.985,
        s: U.rand(7, 13), c: U.pick(cols), life: U.randInt(110, 190), fade: 40, rot: Math.random() * 6, vr: U.rand(-0.3, 0.3)
      });
    }
    kick();
  };

  FX.edge = (dir) => {
    if (FX.level() === 'off') return;
    const el = document.getElementById('edgeFlash');
    el.className = dir;
    setTimeout(() => (el.className = ''), 90);
  };

  FX.burstAt = (el, color) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    FX.burst(r.left + r.width / 2, r.top + r.height / 2, color);
  };

  // ---------- count-up numbers ----------
  FX.countTo = (el, value, fmt, ms = 450) => {
    if (!el) return;
    const prev = el._v;
    el._v = value;
    if (prev == null || !isFinite(prev) || FX.level() === 'off' || prev === value) { el.textContent = fmt(value); return; }
    const start = performance.now();
    cancelAnimationFrame(el._raf);
    const step = (t) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(prev + (value - prev) * e);
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  };

  FX.tickClass = (el, dir) => {
    if (!el || !dir) return;
    el.classList.remove('tick-up', 'tick-down');
    void el.offsetWidth;
    el.classList.add(dir > 0 ? 'tick-up' : 'tick-down');
  };

  // ---------- spotlight hover on glass panels ----------
  document.addEventListener('mousemove', U.rafThrottle((e) => {
    const g = e.target.closest && e.target.closest('.glass');
    if (FX._lastGlass && FX._lastGlass !== g) { FX._lastGlass.style.setProperty('--mx', '-500px'); FX._lastGlass.style.setProperty('--my', '-500px'); }
    if (g) {
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', e.clientX - r.left + 'px');
      g.style.setProperty('--my', e.clientY - r.top + 'px');
    }
    FX._lastGlass = g;
  }));

  // ---------- ripple on buttons ----------
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('.exec, .preset, .tb-btn, .btn, .qb');
    if (!b || FX.level() === 'off') return;
    const r = b.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const sp = document.createElement('span');
    sp.className = 'ripple';
    sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(sp);
    setTimeout(() => sp.remove(), 650);
  });

  // ---------- sounds (synthesized, no assets) ----------
  let actx = null;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } return actx; }
  function tone(freq, dur, type = 'sine', vol = 0.06, delay = 0, slide = 0) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  FX.sound = (kind) => {
    if (!P.S || !P.S.get('sound')) return;
    const v = (P.S.get('volume') ?? 60) / 100 * 0.12;
    switch (kind) {
      case 'buy': tone(520, 0.09, 'triangle', v); tone(780, 0.12, 'triangle', v, 0.07); tone(1170, 0.16, 'sine', v * 0.8, 0.14); break;
      case 'sell': tone(700, 0.1, 'triangle', v); tone(520, 0.14, 'triangle', v, 0.08); break;
      case 'profit': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', v, i * 0.07)); break;
      case 'loss': tone(300, 0.25, 'sawtooth', v * 0.5, 0, 0.6); break;
      case 'error': tone(180, 0.18, 'square', v * 0.4); tone(140, 0.2, 'square', v * 0.4, 0.1); break;
      case 'click': tone(1400, 0.03, 'sine', v * 0.35); break;
      case 'open': tone(600, 0.08, 'sine', v * 0.5, 0, 1.6); break;
      case 'alert': tone(880, 0.1, 'sine', v); tone(880, 0.1, 'sine', v, 0.15); break;
    }
  };

  // ---------- toasts ----------
  FX.toast = (title, desc = '', kind = 'info', ms = 3800) => {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    const icon = kind === 'ok' ? '✓' : kind === 'err' ? '!' : 'i';
    el.innerHTML = `<div class="ti">${icon}</div><div><div class="tt">${title}</div>${desc ? `<div class="td">${desc}</div>` : ''}</div><div class="tbar" style="animation-duration:${ms}ms"></div>`;
    el.onclick = () => close();
    wrap.appendChild(el);
    while (wrap.children.length > 5) wrap.firstChild.remove();
    let closed = false;
    function close() { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => el.remove(), 350); }
    setTimeout(close, ms);
    return el;
  };
})(window.P);
