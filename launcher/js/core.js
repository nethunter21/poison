/* POISON CLIENT — core runtime: state, events, storage, toasts, sfx, utils */
(function () {
  'use strict';

  const P = (window.Poison = window.Poison || {});
  const STORE_KEY = 'poison.client.v1';

  /* ---------------- utils ---------------- */
  const U = (P.util = {
    $: (s, r = document) => r.querySelector(s),
    $$: (s, r = document) => Array.from(r.querySelectorAll(s)),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    ease: {
      inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      out: (t) => 1 - Math.pow(1 - t, 3),
      in: (t) => t * t * t,
      back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
      elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    },
    el(tag, attrs = {}, children = []) {
      const n = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') n.className = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') {
          // custom properties (--x) must go through setProperty; Object.assign ignores them
          for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? n.style.setProperty(sk, sv) : (n.style[sk] = sv);
        }
        else n.setAttribute(k, v);
      }
      for (const c of [].concat(children)) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
      return n;
    },
    /* tiny deterministic hash -> hex, used for the fun "block explorer" */
    hash(str) {
      let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      const a = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
      return '0x' + a + U.hashTail(a);
    },
    hashTail(seed) {
      let s = '';
      let x = parseInt(seed.slice(0, 8), 16) || 1;
      for (let i = 0; i < 48; i++) { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s += ((x >>> 0) % 16).toString(16); }
      return s;
    },
    fmt: (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }),
    hexToRgb(hex) {
      const h = hex.replace('#', '');
      const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    },
  });

  /* ---------------- event bus ---------------- */
  const listeners = {};
  P.on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), fn);
  P.off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); };
  P.emit = (ev, data) => (listeners[ev] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

  /* ---------------- persistent state ---------------- */
  const defaults = {
    profile: { name: 'Satoshi_PvP', version: '1.21.4', loader: 'Fabric' },
    launcher: {
      accent: '#ff8a00', accent2: '#ff2e88', theme: 'poison', rgb: false,
      bg: 'network', quality: 'ultra', cursor: true, sparks: true, sfx: true, splash: true,
      scanlines: false, grain: true, reducedMotion: false, beatSync: true, tilt: true,
      ram: 4096, jvm: '-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20',
      width: 1920, height: 1080, fullscreen: false, closeOnLaunch: false, javaPath: 'auto',
      guiKey: 'ShiftRight',
    },
    modules: {},            // id -> { on, settings{} }
    wallet: { psn: 250, owned: ['knife_genesis', 'cape_none'], history: [] },
    equipped: { knife: 'knife_genesis', cape: 'cape_satoshi', wings: 'none', halo: 'none', aura: 'none', pet: 'none' },
    achievements: {},
    music: { volume: 0.7, track: 0, shuffle: false, repeat: 'all', eq: [0, 0, 0], viz: 'bars' },
    stats: { launches: 0, playtime: 0, clicks: 0 },
  };

  function deepMerge(base, over) {
    if (typeof base !== 'object' || base === null || Array.isArray(base)) return over === undefined ? base : over;
    const out = { ...base };
    if (over && typeof over === 'object') for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
    return out;
  }

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
  P.state = deepMerge(defaults, saved || {});
  P.defaults = defaults;

  let saveTimer = null;
  P.save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(P.state)); } catch (e) { /* storage blocked: run in-memory */ }
    }, 150);
  };
  P.resetAll = () => {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    location.reload();
  };

  /* ---------------- toasts ---------------- */
  P.toast = function (title, body = '', kind = 'info', icon = '◆') {
    const host = U.$('#toasts');
    if (!host) return;
    const t = U.el('div', { class: `toast toast-${kind}` }, [
      U.el('div', { class: 'toast-icon', text: icon }),
      U.el('div', { class: 'toast-text' }, [U.el('b', { text: title }), body ? U.el('span', { text: body }) : null]),
      U.el('div', { class: 'toast-bar' }),
    ]);
    host.append(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3600);
    P.sfx && P.sfx('toast');
  };

  /* ---------------- synthesized UI sound fx (no audio files) ---------------- */
  let actx = null;
  P.audioCtx = () => {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  };
  const userActivated = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  P.sfx = function (kind) {
    if (!P.state.launcher.sfx || !userActivated()) return; // browsers block audio before a gesture
    const ctx = P.audioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const presets = {
      click: ['triangle', 880, 1320, 0.05, 0.06],
      hover: ['sine', 1600, 1800, 0.012, 0.03],
      on: ['square', 520, 1040, 0.035, 0.09],
      off: ['square', 700, 300, 0.03, 0.09],
      toast: ['sine', 660, 990, 0.05, 0.18],
      coin: ['square', 988, 1319, 0.04, 0.22],
      launch: ['sawtooth', 110, 880, 0.07, 1.2],
      error: ['sawtooth', 220, 110, 0.05, 0.3],
    };
    const [type, f1, f2, vol, dur] = presets[kind] || presets.click;
    o.type = type;
    o.frequency.setValueAtTime(f1, now);
    o.frequency.exponentialRampToValueAtTime(f2, now + dur * 0.8);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + 0.02);
  };

  /* ---------------- achievements ("on-chain badges") ---------------- */
  P.achievementsList = [
    { id: 'genesis', name: 'Genesis Block', desc: 'Open POISON for the first time', reward: 50, icon: '⛓' },
    { id: 'first_launch', name: 'Mainnet Launch', desc: 'Launch the game once', reward: 100, icon: '🚀' },
    { id: 'gui', name: 'Root Access', desc: 'Open the ClickGUI', reward: 25, icon: '⌘' },
    { id: 'flip', name: 'Balisong Bro', desc: 'Flip the butterfly knife', reward: 25, icon: '🦋' },
    { id: 'dj', name: 'On-Chain DJ', desc: 'Play a track in the music player', reward: 25, icon: '♫' },
    { id: 'blur', name: 'Render Farm', desc: 'Crank motion blur to 16+ samples', reward: 40, icon: '◐' },
    { id: 'shopper', name: 'Whale Alert', desc: 'Buy a cosmetic from the market', reward: 30, icon: '🐋' },
    { id: 'miner', name: 'Proof of Click', desc: 'Mine 25 blocks in the miner', reward: 60, icon: '⛏' },
    { id: 'moon', name: 'To The Moon', desc: 'Find the secret code', reward: 420, icon: '🌕' },
    { id: 'modder', name: 'Full Node', desc: 'Enable 100 modules at once', reward: 80, icon: '◎' },
    { id: 'f5', name: 'Main Character', desc: 'Switch to third person to admire your drip', reward: 20, icon: '👁' },
    { id: 'theme', name: 'Fork the Chain', desc: 'Change the accent theme', reward: 15, icon: '🎨' },
  ];
  P.unlock = function (id) {
    if (P.state.achievements[id]) return;
    const a = P.achievementsList.find((x) => x.id === id);
    if (!a) return;
    P.state.achievements[id] = Date.now();
    P.state.wallet.psn += a.reward;
    P.save();
    P.toast(`Badge minted: ${a.name}`, `+${a.reward} $PSN airdropped to your wallet`, 'gold', a.icon);
    P.emit('wallet');
    P.emit('achievement', a);
    P.chain && P.chain(`MINT badge:${a.id}`);
  };
})();
