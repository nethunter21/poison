/* POISON CLIENT — launcher visual effects */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;

  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff8a00';
  const accent2 = () => getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#ff2e88';
  const reduced = () => P.state.launcher.reducedMotion;

  P.fx = {};

  /* ---------------- background: blockchain network + hex rain + floating glyphs ---------------- */
  function background() {
    const cv = U.$('#bgCanvas');
    const g = cv.getContext('2d');
    let W, H, nodes = [], glyphs = [], cols = [], mouse = { x: -999, y: -999 };
    function resize() {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      const n = P.state.launcher.quality === 'low' ? 40 : P.state.launcher.quality === 'medium' ? 70 : 110;
      nodes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 1 + Math.random() * 2, p: Math.random() * 6 }));
      glyphs = Array.from({ length: 18 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 14 + Math.random() * 34, v: 0.15 + Math.random() * 0.4, c: U.pick(['₿', 'Ξ', '◎', 'Ð', '☠', '⛓', '◆']), a: Math.random() * 6 }));
      cols = Array.from({ length: Math.ceil(W / 18) }, () => Math.random() * -H);
    }
    resize();
    addEventListener('resize', resize);
    addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    // pulses travelling along edges = "transactions"
    const pulses = [];
    let last = performance.now();
    function frame(t) {
      requestAnimationFrame(frame);
      const dt = Math.min(50, t - last); last = t;
      const mode = P.state.launcher.bg;
      if (mode === 'off' || document.hidden) { g.clearRect(0, 0, W, H); return; }
      const a = accent(), a2 = accent2();
      const beat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--beat')) || 0;
      if (mode === 'matrix') {
        g.fillStyle = 'rgba(5,2,8,0.12)'; g.fillRect(0, 0, W, H);
        g.font = '15px "JetBrains Mono", monospace'; g.fillStyle = a;
        cols.forEach((y, i) => {
          g.globalAlpha = 0.55;
          g.fillText('0123456789abcdef'[(Math.random() * 16) | 0], i * 18, y);
          cols[i] = y > H + Math.random() * 4000 ? 0 : y + 16 * (dt / 33) * (1 + beat);
        });
        g.globalAlpha = 1;
        return;
      }
      g.clearRect(0, 0, W, H);
      const speed = reduced() ? 0.2 : 1 + beat * 2;
      // glyphs
      glyphs.forEach((p) => {
        p.y -= p.v * speed * (dt / 16); p.a += 0.01;
        if (p.y < -60) { p.y = H + 40; p.x = Math.random() * W; }
        g.globalAlpha = 0.06 + 0.04 * Math.sin(p.a);
        g.fillStyle = a; g.font = `900 ${p.s}px system-ui`;
        g.fillText(p.c, p.x + Math.sin(p.a) * 20, p.y);
      });
      g.globalAlpha = 1;
      if (mode !== 'network') return;
      // nodes
      for (const n of nodes) {
        n.x += n.vx * speed * (dt / 16); n.y += n.vy * speed * (dt / 16);
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 140) { n.x += (dx / d) * 0.8; n.y += (dy / d) * 0.8; }
      }
      g.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i], B = nodes[j];
          const d = Math.hypot(A.x - B.x, A.y - B.y);
          if (d < 140) {
            g.strokeStyle = a; g.globalAlpha = (1 - d / 140) * 0.22;
            g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
            if (Math.random() < 0.0006 * speed && pulses.length < 40) pulses.push({ A, B, u: 0 });
          }
        }
      }
      g.globalAlpha = 1;
      for (const n of nodes) {
        n.p += 0.03;
        g.fillStyle = a; g.shadowColor = a; g.shadowBlur = 10;
        g.beginPath(); g.arc(n.x, n.y, n.r * (1 + 0.3 * Math.sin(n.p) + beat), 0, Math.PI * 2); g.fill();
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.u += 0.02 * speed;
        if (p.u >= 1) { pulses.splice(i, 1); continue; }
        const x = U.lerp(p.A.x, p.B.x, p.u), y = U.lerp(p.A.y, p.B.y, p.u);
        g.fillStyle = a2; g.shadowColor = a2; g.shadowBlur = 16;
        g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
      }
      g.shadowBlur = 0;
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- overlay canvas: cursor trail, sparks, confetti ---------------- */
  const parts = [];
  let og, OW, OH;
  function overlay() {
    const cv = U.$('#fxCanvas');
    og = cv.getContext('2d');
    const resize = () => { OW = cv.width = innerWidth; OH = cv.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    const glow = U.$('#cursorGlow');
    let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my, lastX = mx, lastY = my;
    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!P.state.launcher.cursor || reduced()) return;
      const d = Math.hypot(mx - lastX, my - lastY);
      for (let i = 0; i < Math.min(4, d / 8); i++) {
        parts.push({ x: U.lerp(lastX, mx, i / 4), y: U.lerp(lastY, my, i / 4), vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, life: 1, decay: 0.035, r: 2.4, c: Math.random() > 0.5 ? accent() : accent2(), kind: 'trail' });
      }
      lastX = mx; lastY = my;
    });
    addEventListener('pointerdown', (e) => {
      if (!P.state.launcher.sparks || reduced()) return;
      burst(e.clientX, e.clientY, 14);
      const r = U.el('div', { class: 'ripple', style: { left: e.clientX + 'px', top: e.clientY + 'px' } });
      document.body.append(r);
      setTimeout(() => r.remove(), 700);
    });
    function frame() {
      requestAnimationFrame(frame);
      gx = U.lerp(gx, mx, 0.15); gy = U.lerp(gy, my, 0.15);
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      glow.style.display = P.state.launcher.cursor ? '' : 'none';
      og.clearRect(0, 0, OW, OH);
      og.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.kind === 'confetti') { p.vy += 0.18; p.vx *= 0.99; p.rot += p.vr; }
        else if (p.kind === 'spark') { p.vx *= 0.93; p.vy = p.vy * 0.93 + 0.05; }
        p.life -= p.decay;
        if (p.life <= 0 || p.y > OH + 20) { parts.splice(i, 1); continue; }
        og.globalAlpha = Math.max(0, p.life);
        og.fillStyle = p.c;
        if (p.kind === 'confetti') {
          og.save(); og.translate(p.x, p.y); og.rotate(p.rot); og.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); og.restore();
        } else if (p.kind === 'coin') {
          og.font = `900 ${p.r}px system-ui`; og.fillText(p.ch, p.x, p.y);
        } else {
          og.shadowColor = p.c; og.shadowBlur = 12;
          og.beginPath(); og.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); og.fill();
          og.shadowBlur = 0;
        }
      }
      og.globalAlpha = 1;
      og.globalCompositeOperation = 'source-over';
    }
    requestAnimationFrame(frame);
  }
  function burst(x, y, n = 18, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, decay: 0.025 + Math.random() * 0.02, r: 2 + Math.random() * 2.5, c: color || (Math.random() > 0.5 ? accent() : accent2()), kind: 'spark' });
    }
  }
  function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 90) {
    const cols = [accent(), accent2(), '#ffd23f', '#00ff9d', '#16c8ff', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, s = 6 + Math.random() * 9;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.6, decay: 0.008, r: 4 + Math.random() * 4, c: U.pick(cols), kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4 });
    }
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4, s = 5 + Math.random() * 7;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.6, decay: 0.01, r: 22, c: '#ffd23f', kind: 'coin', ch: U.pick(['₿', '☠', 'Ξ']) });
    }
  }
  P.fx.burst = burst;
  P.fx.confetti = confetti;

  /* ---------------- 3D tilt + glare cards ---------------- */
  P.fx.bindTilt = function (scope = document) {
    U.$$('.tilt', scope).forEach((el) => {
      if (el.dataset.tiltBound) return;
      el.dataset.tiltBound = 1;
      el.addEventListener('pointermove', (e) => {
        if (!P.state.launcher.tilt || reduced()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', (0.5 - y) * 10 + 'deg');
        el.style.setProperty('--ry', (x - 0.5) * 12 + 'deg');
        el.style.setProperty('--gx', x * 100 + '%');
        el.style.setProperty('--gy', y * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  };

  /* ---------------- magnetic buttons ---------------- */
  function magnetic() {
    U.$$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        if (reduced()) return;
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
      });
      el.addEventListener('pointerleave', () => (el.style.transform = ''));
    });
  }

  /* ---------------- text scramble ---------------- */
  P.fx.scramble = function (el, text, dur = 700) {
    const chars = '0123456789abcdef₿Ξ#$%&';
    const t0 = performance.now();
    const tick = (t) => {
      const u = Math.min(1, (t - t0) / dur);
      const n = Math.floor(u * text.length);
      el.textContent = text.slice(0, n) + Array.from({ length: text.length - n }, () => chars[(Math.random() * chars.length) | 0]).join('');
      if (u < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---------------- boot splash ---------------- */
  P.fx.splash = function (done) {
    const s = U.$('#splash');
    if (!P.state.launcher.splash) { s.remove(); done(); return; }
    const log = U.$('#splashLog'), bar = U.$('#splashBar'), hash = U.$('#splashHash');
    const steps = ['syncing headers', 'verifying chain integrity', 'loading 100+ modules', 'compiling post-fx shaders', 'sharpening butterfly knife', 'warming up the synths', 'checking wallet (play-money)', 'GM. welcome back.'];
    let i = 0;
    const iv = setInterval(() => {
      if (i < steps.length) {
        log.innerHTML = `<span>[${String(i + 1).padStart(2, '0')}/${steps.length}]</span> ${steps[i]}`;
        bar.style.width = ((i + 1) / steps.length) * 100 + '%';
        hash.textContent = U.hash(steps[i] + Math.random()).slice(0, 42);
        i++;
      } else {
        clearInterval(iv);
        s.classList.add('done');
        setTimeout(() => { s.remove(); }, 900);
        done();
      }
    }, 210);
  };

  /* ---------------- konami -> to the moon ---------------- */
  function konami() {
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
    let k = 0;
    addEventListener('keydown', (e) => {
      k = e.code === code[k] ? k + 1 : e.code === code[0] ? 1 : 0;
      if (k === code.length) { k = 0; moon(); }
    });
  }
  function moon() {
    const r = U.el('div', { class: 'rocket', html: '🚀' });
    const m = U.el('div', { class: 'moon-text', html: 'TO THE MOON' });
    document.body.append(r, m);
    confetti(innerWidth / 2, innerHeight * 0.8, 160);
    P.sfx('launch');
    P.unlock('moon');
    setTimeout(() => { r.remove(); m.remove(); }, 3200);
  }
  P.fx.moon = moon;

  /* ---------------- hover sfx on interactive elements ---------------- */
  function hoverSfx() {
    let lastEl = null;
    document.addEventListener('pointerover', (e) => {
      const b = e.target.closest('button, .nav-item, .chip, .mod-card, .item');
      if (b && b !== lastEl) { lastEl = b; P.sfx('hover'); }
    });
  }

  P.fx.init = function () {
    background();
    overlay();
    magnetic();
    konami();
    hoverSfx();
    P.fx.bindTilt();
  };
})();
