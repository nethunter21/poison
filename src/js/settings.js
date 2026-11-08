/* Poison Terminal — settings + theming */
(function (P) {
  const U = P.U;

  const THEMES = {
    toxic:  { name: 'Toxic',   accent: '#9dff3a', accent2: '#00ffc3' },
    venom:  { name: 'Venom',   accent: '#b46bff', accent2: '#ff4fd8' },
    blood:  { name: 'Blood',   accent: '#ff3355', accent2: '#ff9a3d' },
    ice:    { name: 'Ice',     accent: '#3dd8ff', accent2: '#7a7bff' },
    gold:   { name: 'Gold',    accent: '#ffc93d', accent2: '#ff7a3d' },
    matrix: { name: 'Matrix',  accent: '#00ff66', accent2: '#b6ff00' },
    sakura: { name: 'Sakura',  accent: '#ff7ac6', accent2: '#ffc1e3' },
    mono:   { name: 'Mono',    accent: '#e8ecff', accent2: '#8a93b8' }
  };

  const DEFAULTS = {
    theme: 'toxic',
    customAccent: null,
    upColor: '#1dffa3',
    downColor: '#ff3d71',
    effects: 'low',
    bgStyle: 'aurora',
    compact: false,
    scale: 1,
    sound: true,
    volume: 60,
    buyPresets: [0.1, 0.25, 0.5, 1],
    sellPresets: [10, 25, 50, 100],
    quickBuy: 0.25,
    slippage: 20,
    priorityFee: 0.001,
    platformFee: 1,
    latencyMin: 350,
    latencyMax: 900,
    autoTpSl: false,
    tp: 100, tpSell: 50,
    sl: -35, slSell: 100, slTrail: false,
    coach: true,
    marketPace: 'normal',
    startBalance: 10,
    confirmLarge: true,
    handle: '@anon',
    chartUnit: 'mc',
    tf: 60
  };

  let state = Object.assign({}, DEFAULTS, U.store.get('settings', {}));
  if (state.ver !== 2) { state.ver = 2; state.effects = 'low'; delete state.dataMode; delete state.dexFee; U.store.set('settings', state); } // v2: lightweight by default
  const ev = U.emitter();

  const S = (P.S = {
    THEMES, DEFAULTS,
    get: (k) => state[k],
    all: () => state,
    set(k, v) {
      state[k] = v;
      U.store.set('settings', state);
      S.apply();
      ev.emit('change', k, v);
    },
    setMany(obj) { Object.assign(state, obj); U.store.set('settings', state); S.apply(); ev.emit('change', '*'); },
    reset() { state = Object.assign({}, DEFAULTS); U.store.set('settings', state); S.apply(); ev.emit('change', '*'); },
    on: (f) => ev.on('change', f),
    accent() {
      const t = THEMES[state.theme] || THEMES.toxic;
      return state.customAccent ? { accent: state.customAccent, accent2: t.accent2 } : t;
    },
    apply() {
      const r = document.documentElement.style;
      const t = S.accent();
      r.setProperty('--accent', t.accent);
      r.setProperty('--accent2', t.accent2);
      r.setProperty('--accent-rgb', U.hexToRgb(t.accent).join(', '));
      r.setProperty('--up', state.upColor);
      r.setProperty('--up-rgb', U.hexToRgb(state.upColor).join(', '));
      r.setProperty('--down', state.downColor);
      r.setProperty('--down-rgb', U.hexToRgb(state.downColor).join(', '));
      r.setProperty('--scale', state.scale);
      const b = document.body;
      b.classList.remove('fx-high', 'fx-low', 'fx-off', 'bg-aurora', 'bg-nogrid', 'bg-minimal');
      b.classList.add('fx-' + state.effects, 'bg-' + state.bgStyle);
      b.classList.toggle('compact', !!state.compact);
    }
  });
  S.apply();
})(window.P);
