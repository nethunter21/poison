/* POISON CLIENT — in-game HUD overlay on top of the 3D preview */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;

  P.hud = (function () {
    let root, els = {}, built = false, sessionStart = Date.now(), combo = 0, lastCombo = 0, lastText = 0;

    function build(host) {
      if (built) return;
      built = true;
      root = U.el('div', { class: 'hud' });
      host.append(root);
      const add = (id, cls, html = '') => (els[id] = U.el('div', { class: 'hud-el ' + cls, 'data-mod': id, html }));

      add('watermark', 'hud-watermark', '<b class="wm-logo">POISON</b><span class="wm-ver">b1.4.2 · 1.8.9</span>');
      add('arraylist', 'hud-arraylist');
      const stack = U.el('div', { class: 'hud-stack' });
      ['fps', 'cps', 'ping', 'coords', 'speedo', 'memory', 'clock', 'session', 'serverip'].forEach((k) => stack.append(add(k, 'hud-pill')));
      els.stack = stack;
      add('direction', 'hud-compass', '<div class="compass-strip"></div><i class="compass-needle"></i>');
      add('keystrokes', 'hud-keys', `
        <div class="kr"><span class="k" data-k="KeyW">W</span></div>
        <div class="kr"><span class="k" data-k="KeyA">A</span><span class="k" data-k="KeyS">S</span><span class="k" data-k="KeyD">D</span></div>
        <div class="kr"><span class="k wide" data-k="LMB">LMB<small>0 CPS</small></span><span class="k wide" data-k="RMB">RMB<small>0 CPS</small></span></div>
        <div class="kr"><span class="k space" data-k="Space"><i></i></span></div>`);
      add('armor', 'hud-armor', ['helmet', 'chest', 'legs', 'boots', 'sword'].map((n, i) => `<div class="ar"><i class="ar-ico ar-${n}"></i><span>${[96, 88, 91, 100, 100][i]}%</span></div>`).join(''));
      add('potions', 'hud-potions', `<div class="po"><i style="--c:#ff4d4d">✚</i><span>Regeneration II<small>0:42</small></span></div><div class="po"><i style="--c:#4dd2ff">➤</i><span>Speed II<small>2:58</small></span></div><div class="po"><i style="--c:#ffd23f">₿</i><span>Bull Market<small>∞</small></span></div>`);
      add('combo', 'hud-combo', '<b>0</b><span>COMBO</span>');
      els.combo.classList.add('idle');
      add('crosshair', 'hud-crosshair');
      add('nowplaying', 'hud-np', '<div class="np-art"></div><div class="np-meta"><b>—</b><span>POISON FM</span><div class="np-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>');
      add('tickerhud', 'hud-ticker', '<div class="ticker-track"></div>');
      add('wallethud', 'hud-wallet', '<i>◎</i><b>0</b><span>$PSN</span>');
      add('hotbar', 'hud-hotbar', Array.from({ length: 9 }, (_, i) => `<div class="slot${i === 0 ? ' sel' : ''}">${i === 0 ? '<i class="slot-knife"></i>' : ['', '🍎', '🏹', '🪣', '', '🧱', '', '🧪', '💎'][i]}</div>`).join(''));
      add('visualizer', 'hud-viz', '<canvas width="600" height="60"></canvas>');
      add('hint', 'hud-hint', '');
      els.hint.removeAttribute('data-mod');

      root.append(els.watermark, els.arraylist, stack, els.direction, els.keystrokes, els.armor, els.potions, els.combo, els.crosshair, els.nowplaying, els.tickerhud, els.wallethud, els.hotbar, els.visualizer, els.hint);

      // compass ticks
      const strip = U.$('.compass-strip', els.direction);
      const dirs = ['N', '·', 'NE', '·', 'E', '·', 'SE', '·', 'S', '·', 'SW', '·', 'W', '·', 'NW', '·'];
      let html = '';
      for (let r = 0; r < 3; r++) dirs.forEach((d) => (html += `<span class="${d.length === 1 && d !== '·' ? 'major' : ''}">${d}</span>`));
      strip.innerHTML = html;

      P.on('module', refreshVisibility);
      P.on('frame', onFrame);
      P.on('key', onKey);
      P.on('swing', () => {
        combo = Date.now() - lastCombo < 1200 ? combo + 1 : 1;
        lastCombo = Date.now();
        const b = U.$('b', els.combo);
        b.textContent = combo;
        els.combo.classList.toggle('idle', combo < 2);
        els.combo.classList.remove('pop'); void els.combo.offsetWidth; els.combo.classList.add('pop');
      });
      P.on('wallet', updateWallet);
      P.on('track', (tr) => {
        U.$('.np-meta b', els.nowplaying).textContent = tr ? tr.title : '—';
        U.$('.np-meta span', els.nowplaying).textContent = tr ? tr.artist : 'POISON FM';
        U.$('.np-art', els.nowplaying).style.background = tr ? tr.art : '';
      });
      // hotbar scroll / number keys
      window.addEventListener('keydown', (e) => {
        if (!P.world.isActive() || !/^Digit[1-9]$/.test(e.code)) return;
        U.$$('.slot', els.hotbar).forEach((s, i) => s.classList.toggle('sel', i === parseInt(e.code.slice(5), 10) - 1));
      });
      refreshVisibility();
      updateWallet();
      drawCrosshair();
    }

    function refreshVisibility(e) {
      if (!root) return;
      for (const [id, el] of Object.entries(els)) {
        if (!el.dataset || !el.dataset.mod) continue;
        const d = P.defsById[id];
        if (!d) continue;
        el.classList.toggle('off', !P.isOn(id));
      }
      els.visualizer.classList.toggle('off', !P.isOn('visualizer'));
      if (!e || e.id === 'crosshair') drawCrosshair();
      buildArrayList();
      const wm = P.mod('watermark');
      U.$('.wm-ver', els.watermark).style.display = wm.s.version ? '' : 'none';
      U.$('.wm-ver', els.watermark).textContent = `b1.4.2 · ${P.state.profile.version}`;
    }

    function buildArrayList() {
      const al = P.mod('arraylist');
      const names = P.moduleDefs.filter((m) => P.isOn(m.id) && ['render', 'anim', 'camera', 'cosmetic'].includes(m.cat)).map((m) => m.name);
      names.sort((a, b) => b.length - a.length);
      els.arraylist.innerHTML = names.slice(0, 15).map((n, i) => `<div class="al-row ${al.s.bg ? 'bg' : ''}" style="--i:${i}">${n}</div>`).join('');
      els.arraylist.dataset.color = al.s.color;
    }

    function drawCrosshair() {
      const ch = P.mod('crosshair');
      const s = ch.s.size, c = ch.s.color;
      const glow = ch.s.glow ? `filter: drop-shadow(0 0 4px ${c}) drop-shadow(0 0 10px ${c});` : '';
      const svgs = {
        cross: `<path d="M${s} 0V${s * 2}M0 ${s}H${s * 2}" stroke="${c}" stroke-width="2"/>`,
        'cross-dot': `<path d="M${s} 0V${s * 0.65}M${s} ${s * 1.35}V${s * 2}M0 ${s}H${s * 0.65}M${s * 1.35} ${s}H${s * 2}" stroke="${c}" stroke-width="2"/><circle cx="${s}" cy="${s}" r="1.6" fill="${c}"/>`,
        circle: `<circle cx="${s}" cy="${s}" r="${s * 0.6}" fill="none" stroke="${c}" stroke-width="2"/><circle cx="${s}" cy="${s}" r="1.5" fill="${c}"/>`,
        diamond: `<path d="M${s} ${s * 0.3}L${s * 1.7} ${s}L${s} ${s * 1.7}L${s * 0.3} ${s}Z" fill="none" stroke="${c}" stroke-width="2"/>`,
        btc: `<text x="${s}" y="${s}" fill="${c}" font-size="${s * 1.5}" font-weight="900" text-anchor="middle" dominant-baseline="central" font-family="system-ui">₿</text>`,
      };
      els.crosshair.innerHTML = `<svg width="${s * 2}" height="${s * 2}" style="${glow}">${svgs[ch.s.style] || svgs.cross}</svg>`;
    }

    function onKey(e) {
      if (!root) return;
      const k = root.querySelector(`.k[data-k="${e.code}"]`);
      if (k) k.classList.toggle('down', e.down);
    }

    function updateWallet() {
      if (!els.wallethud) return;
      U.$('b', els.wallethud).textContent = U.fmt(P.state.wallet.psn, 0);
    }

    const biomeNames = ['Neon Plains', 'Mempool Marsh', 'Hash Hills', 'Ledger Peaks', 'Satoshi Shores'];
    function onFrame(st) {
      if (!root) return;
      const nowMs = performance.now();
      // keystroke CPS + hints update each frame cheaply, text at ~8Hz
      if (nowMs - lastText < 120) return;
      lastText = nowMs;
      const ks = P.mod('keystrokes');
      const [l, r] = st.cps || [0, 0];
      const lm = root.querySelector('.k[data-k="LMB"] small'), rm = root.querySelector('.k[data-k="RMB"] small');
      lm.style.display = rm.style.display = ks.s.cps ? '' : 'none';
      lm.textContent = l + ' CPS'; rm.textContent = r + ' CPS';
      els.keystrokes.classList.toggle('glow', ks.s.glow);
      els.fps.innerHTML = `<i>FPS</i>${st.fps}`;
      els.cps.innerHTML = `<i>CPS</i>${l} | ${r}`;
      const ping = 18 + Math.round(Math.sin(nowMs / 3000) * 4 + Math.random() * 3);
      els.ping.innerHTML = `<i>PING</i>${ping}ms ${P.isOn('gasmeter') ? `<em>⛽ ${ping * 3} gwei</em>` : ''}`;
      const p = st.pos;
      const bi = biomeNames[Math.abs(Math.floor((p.x + 100) / 18 + (p.z + 100) / 23)) % biomeNames.length];
      const sm = P.mod('streamer');
      const hide = sm.on && sm.s.coords;
      els.coords.innerHTML = hide ? '<i>XYZ</i>hidden' : `<i>XYZ</i>${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}${P.mod('coords').s.biome ? `<em>${bi}</em>` : ''}`;
      els.speedo.innerHTML = `<i>SPD</i>${st.speed.toFixed(2)} b/s`;
      const heapMax = P.state.launcher.ram;
      els.memory.innerHTML = `<i>MEM</i>${Math.round(heapMax * (0.34 + 0.08 * Math.sin(nowMs / 5000)))}/${heapMax}MB`;
      const d = new Date();
      const h24 = P.mod('clock').s.format === '24h';
      els.clock.innerHTML = `<i>TIME</i>${h24 ? d.toTimeString().slice(0, 5) : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      const ss = Math.floor((Date.now() - sessionStart) / 1000);
      els.session.innerHTML = `<i>SESSION</i>${Math.floor(ss / 60)}m ${String(ss % 60).padStart(2, '0')}s`;
      els.serverip.innerHTML = `<i>IP</i>${sm.on ? 'hidden' : 'play.poison.gg'}`;
      // compass: yaw 0 = north (-Z)
      const deg = ((-st.yaw * 180) / Math.PI + 360 * 4) % 360;
      const strip = U.$('.compass-strip', els.direction);
      // 16 ticks x 22px per revolution, three copies; keep the middle copy centred in a 220px window
      strip.style.transform = `translateX(${110 - 11 - (352 + (deg / 360) * 352)}px)`;
      // hint line
      els.hint.innerHTML = P.isOn('autopilot')
        ? `<b>Showcase flight</b> · <kbd>F</kbd> flip · <kbd>I</kbd> inspect · <kbd>LMB</kbd> swing · <kbd>V</kbd> F5 · <kbd>C</kbd> zoom · <kbd>RShift</kbd> menu`
        : `<b>Free cam</b> · click to look · <kbd>WASD</kbd> move · <kbd>Space</kbd>/<kbd>Shift</kbd> up/down · <kbd>F</kbd> flip · <kbd>I</kbd> inspect · <kbd>Esc</kbd> release`;
      els.hint.classList.toggle('f5', !!st.f5);
      if (P.isOn('visualizer')) drawViz();
    }

    function drawViz() {
      const cv = U.$('canvas', els.visualizer);
      const g = cv.getContext('2d');
      const data = P.music && P.music.spectrum();
      g.clearRect(0, 0, cv.width, cv.height);
      if (!data) return;
      const n = 48, w = cv.width / n;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff8a00';
      g.fillStyle = accent; g.shadowColor = accent; g.shadowBlur = 10;
      for (let i = 0; i < n; i++) {
        const v = data[Math.floor((i / n) * data.length * 0.7)] / 255;
        const h = Math.max(2, v * cv.height);
        g.fillRect(i * w + 1, cv.height - h, w - 2, h);
      }
    }

    // high-rate beat-driven bars in the now-playing widget
    function beatLoop() {
      requestAnimationFrame(beatLoop);
      if (!root || !P.world.isActive()) return;
      const data = P.music && P.music.spectrum();
      const bars = els.nowplaying ? els.nowplaying.querySelectorAll('.np-bars i') : [];
      bars.forEach((b, i) => { b.style.transform = `scaleY(${data ? 0.15 + (data[i * 6 + 2] / 255) : 0.15})`; });
    }
    requestAnimationFrame(beatLoop);

    return { build, setTicker(html) { if (els.tickerhud) U.$('.ticker-track', els.tickerhud).innerHTML = html + html; } };
  })();
})();
