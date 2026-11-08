/* Poison Terminal — utilities */
window.P = window.P || {};
(function (P) {
  const U = (P.U = {});

  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.now = () => Date.now();
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  U.hash = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---------- number formatting ----------
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const subNum = (n) => String(n).split('').map((d) => SUB[+d]).join('');

  U.fmtPrice = (n, prefix = '$') => {
    if (!isFinite(n) || n == null) return '—';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n === 0) s = '0';
    else if (n >= 1000) s = n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    else if (n >= 1) s = n.toFixed(n >= 100 ? 2 : 3);
    else if (n >= 0.001) s = n.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
    else {
      const e = Math.floor(Math.log10(n));
      const zeros = -e - 1;
      const sig = Math.round(n / Math.pow(10, e - 3)); // 4 significant digits
      s = '0.0' + subNum(zeros) + String(sig).replace(/0+$/, '');
    }
    return (neg ? '-' : '') + prefix + s;
  };

  U.fmtCompact = (n, prefix = '$', dp) => {
    if (!isFinite(n) || n == null) return '—';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n >= 1e12) s = (n / 1e12).toFixed(dp ?? 2) + 'T';
    else if (n >= 1e9) s = (n / 1e9).toFixed(dp ?? 2) + 'B';
    else if (n >= 1e6) s = (n / 1e6).toFixed(dp ?? 2) + 'M';
    else if (n >= 1e3) s = (n / 1e3).toFixed(dp ?? (n >= 1e5 ? 0 : 1)) + 'K';
    else if (n >= 1) s = n.toFixed(dp ?? (n >= 100 ? 0 : 2));
    else if (n === 0) s = '0';
    else s = n.toFixed(dp ?? 3);
    return (neg ? '-' : '') + prefix + s;
  };

  U.fmtNum = (n, dp = 2) => (isFinite(n) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 }) : '—');

  U.fmtSol = (n, dp) => {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    const d = dp ?? (a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : 4);
    return n.toFixed(d) + ' SOL';
  };

  U.fmtSigned = (n, fmt) => (n > 0 ? '+' : n < 0 ? '-' : '') + fmt(Math.abs(n));
  U.fmtPct = (n, dp = 1) => {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    const d = a >= 1000 ? 0 : dp;
    return (n > 0 ? '+' : n < 0 ? '-' : '') + (a >= 10000 ? (a / 1000).toFixed(1) + 'K' : a.toFixed(d)) + '%';
  };
  U.cls = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

  U.ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return Math.floor(s) + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd';
    return Math.floor(s / 86400 / 30) + 'mo';
  };
  U.time = (ts, sec = true) => {
    const d = new Date(ts);
    const p = (x) => String(x).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes()) + (sec ? ':' + p(d.getSeconds()) : '');
  };
  U.short = (a, n = 4) => (a && a.length > n * 2 + 3 ? a.slice(0, n) + '…' + a.slice(-n) : a || '');

  // ---------- avatars ----------
  U.tokenColors = (seed) => {
    const h = U.hash(seed || 'x');
    const h1 = h % 360, h2 = (h1 + 60 + (h >> 9) % 120) % 360;
    return [`hsl(${h1} 85% 55%)`, `hsl(${h2} 85% 45%)`];
  };
  U.avatar = (t, size = '') => {
    const [c1, c2] = U.tokenColors(t.address || t.symbol);
    const inner = t.emoji ? `<span class="emo">${t.emoji}</span>` : U.esc((t.symbol || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?');
    return `<div class="avatar ${size}" style="background:linear-gradient(135deg,${c1},${c2})">${inner}</div>`;
  };

  // trailing throttle: run at most once per `ms`
  U.throttle = (f, ms) => {
    let last = 0, t = null;
    return (...a) => {
      const now = Date.now(), wait = last + ms - now;
      if (wait <= 0) { last = now; f(...a); }
      else if (!t) t = setTimeout(() => { t = null; last = Date.now(); f(...a); }, wait);
    };
  };

  // ---------- sparkline svg ----------
  U.spark = (pts, w = 64, h = 20) => {
    if (!pts || pts.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
    let mn = Infinity, mx = -Infinity;
    for (const p of pts) { if (p < mn) mn = p; if (p > mx) mx = p; }
    const rng = mx - mn || mx || 1;
    const step = w / (pts.length - 1);
    let d = '';
    pts.forEach((p, i) => { d += (i ? 'L' : 'M') + (i * step).toFixed(1) + ',' + (h - 2 - ((p - mn) / rng) * (h - 4)).toFixed(1); });
    const up = pts[pts.length - 1] >= pts[0];
    const col = up ? 'var(--up)' : 'var(--down)';
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" style="stroke:${col};stroke-width:1.5;filter:drop-shadow(0 0 3px ${col})"><path d="${d}"/></svg>`;
  };

  // ---------- storage ----------
  U.store = {
    get(k, def) {
      try { const v = localStorage.getItem('poison:' + k); return v == null ? def : JSON.parse(v); } catch { return def; }
    },
    set(k, v) { try { localStorage.setItem('poison:' + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem('poison:' + k); } catch {} }
  };

  // ---------- events ----------
  U.emitter = () => {
    const m = {};
    return {
      on(e, f) { (m[e] = m[e] || []).push(f); return () => (m[e] = m[e].filter((x) => x !== f)); },
      emit(e, ...a) { (m[e] || []).forEach((f) => { try { f(...a); } catch (err) { console.error(err); } }); }
    };
  };
  P.bus = U.emitter();

  U.debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  U.rafThrottle = (f) => { let q = false, args; return (...a) => { args = a; if (q) return; q = true; requestAnimationFrame(() => { q = false; f(...args); }); }; };

  U.copy = (text) => {
    if (window.native) window.native.copyText(text);
    else navigator.clipboard && navigator.clipboard.writeText(text).catch(() => {});
  };
  U.open = (url) => {
    if (!/^https?:\/\//i.test(url)) return;
    if (window.native) window.native.openExternal(url); else window.open(url, '_blank', 'noopener');
  };

  U.hexToRgb = (hex) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [157, 255, 58];
  };

  // Gaussian random (Box-Muller)
  U.gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
})(window.P);
