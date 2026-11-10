/* POISON CLIENT — app shell: navigation, home, launch flow, client page, settings */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;
  const native = window.poisonNative || null; // provided by electron/preload.js when packaged

  /* Launcher-level features (on top of the module registry) — shown in the feature count */
  P.launcherFeatures = [
    'Boot splash with hash scramble', 'Animated blockchain-network background', 'Matrix hex-rain background', 'Floating crypto glyphs',
    'Aurora gradient layer', 'Film grain overlay', 'CRT scanline overlay', 'Glowing cursor follower', 'Cursor particle trail',
    'Click sparks + ripples', 'Confetti + coin bursts', '3D tilt cards with glare', 'Magnetic launch button', 'Glitch text logos',
    'Conic neon launch ring', 'Animated sidebar glider', 'Page transitions', 'Beat-reactive UI glow', 'Synthesized UI sound effects',
    'Toast notifications', '6 theme presets', 'Custom accent colors', 'RGB hue-cycle mode', 'Reduced-motion mode', 'FX quality levels',
    'Live market ticker (simulated)', 'Play-money $PSN wallet', 'Wallet transaction history', 'Daily airdrop', 'Proof-of-click miner',
    'Fear & Greed gauge', 'Local block explorer', 'Sparkline coin charts', 'Cosmetics shop', 'On-chain badge achievements',
    '3D butterfly-knife showcase', '9 knife skins', '8 knife animations', '7 cape designs', 'Wings / halos / auras / pets',
    'Music player with 6 procedural tracks', 'Load your own audio files', '3-band EQ + presets', '4 visualizer modes', 'Sidebar mini player',
    'Real-time 3D client preview', 'Shutter-accurate motion blur', 'HDR bloom pipeline', 'Render presets', 'Draggable panel ClickGUI',
    'Module search', 'Config export / import / clipboard', 'Rebindable menu key', 'Version + loader selector', 'RAM / JVM / resolution settings',
    'Quick Play queue', 'Patch notes feed', 'Konami easter egg', 'Electron desktop shell',
  ];

  /* ---------------- theme ---------------- */
  const THEMES = {
    poison: ['#ff8a00', '#ff2e88'], toxic: ['#7cff00', '#00ffc8'], vapor: ['#a855f7', '#16c8ff'],
    gold: ['#ffd23f', '#ff8a00'], blood: ['#ff1744', '#ff6a3d'], ice: ['#7dd3fc', '#a5b4fc'],
  };
  function applyTheme() {
    const L = P.state.launcher;
    const r = document.documentElement.style;
    r.setProperty('--accent', L.accent);
    r.setProperty('--accent2', L.accent2);
    r.setProperty('--accent-rgb', U.hexToRgb(L.accent).join(','));
    r.setProperty('--accent2-rgb', U.hexToRgb(L.accent2).join(','));
    document.body.classList.toggle('rgb', !!L.rgb);
    document.body.classList.toggle('grain-on', !!L.grain);
    document.body.classList.toggle('scan-on', !!L.scanlines);
    document.body.classList.toggle('reduced', !!L.reducedMotion);
    document.body.dataset.quality = L.quality;
  }

  /* ---------------- navigation ---------------- */
  function go(page) {
    U.$$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
    U.$$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + page));
    moveGlider();
    P.world.setActive(page === 'client');
    P.showcase.setActive(page === 'locker');
    if (page === 'client') P.world.init(U.$('#preview')), P.hud.build(U.$('#preview')), P.world.setActive(true);
    if (page === 'locker') P.showcase.init(U.$('#showcase')), P.showcase.setActive(true);
    P.emit('page', page);
    P.sfx('click');
  }
  function moveGlider() {
    const a = U.$('.nav-item.active'), gl = U.$('.nav-glider');
    if (!a || !gl) return;
    gl.style.transform = `translateY(${a.offsetTop}px)`;
    gl.style.height = a.offsetHeight + 'px';
  }

  /* ---------------- home ---------------- */
  const NEWS = [
    ['NEW', 'POISON in-game client for 1.8.9 (Legacy Fabric) and 1.21.4 (Fabric)'],
    ['FX', 'Glow themes, jump circles, china hat, trails, aura, hit sparks, kill effects, neon block outline'],
    ['NEW', '1.8.9: 1.7 animations with 6 block-hit styles, custom crosshair, screen glow'],
    ['NEW', 'Sign in with Microsoft; Java + game files download automatically'],
    ['NEW', 'Butterfly knife replaces swords, with 8 animations and 9 skins'],
    ['NEW', 'Shutter-accurate motion blur, up to 32 sub-frames'],
    ['NEW', 'In-game music player with live-synthesized tracks'],
    ['FX', 'HDR bloom, chromatic aberration, filmic tonemap, letterbox'],
    ['FX', 'Self, hand and item chams. Your own model only, 100% legit'],
    ['CRYPTO', 'Daily $PSN airdrop and proof-of-click miner (play-money)'],
  ];
  function renderHome() {
    U.$('#news').innerHTML = NEWS.map(([t, s]) => `<li><em class="tag-${t.toLowerCase()}">${t}</em>${s}</li>`).join('');
    const name = U.$('#profileName');
    name.value = P.state.profile.name;
    name.addEventListener('input', () => { P.state.profile.name = name.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'Player'; P.save(); P.emit('module', { id: 'nametag' }); });
    const vs = U.$('#versionSelect'), ls = U.$('#loaderSelect');
    vs.value = P.state.profile.version; ls.value = P.state.profile.loader;
    vs.addEventListener('change', () => { P.state.profile.version = vs.value; P.save(); updateLaunchSub(); P.emit('module', { id: 'watermark' }); });
    ls.addEventListener('change', () => { P.state.profile.loader = ls.value; P.save(); });
    U.$('#launchBtn').addEventListener('click', launch);
    U.$('#loClose').addEventListener('click', () => U.$('#launchOverlay').classList.remove('open'));
    if (!['Fabric', 'Vanilla'].includes(P.state.profile.loader)) { P.state.profile.loader = 'Fabric'; P.save(); }
    ls.value = P.state.profile.loader;
    if (native && native.accounts) setupAccounts();
    else U.$$('.native-only').forEach((el) => (el.hidden = true));
    U.$$('.qp').forEach((b) => b.addEventListener('click', () => { P.toast(`Queued: ${b.dataset.qp}`, 'Joins on launch · play.poison.gg', 'on', '⚡'); P.chain('QUEUE ' + b.dataset.qp); }));
    renderBadges();
    P.on('achievement', renderBadges);
    updateStats();
    P.on('module', updateStats);
    updateLaunchSub();
  }
  function updateLaunchSub() {
    const fx = P.moduleDefs.filter((m) => P.isOn(m.id)).length;
    const needsLogin = U.$('#launchBtn').classList.contains('needs-login');
    U.$('#launchSub').textContent = needsLogin ? 'sign in with Microsoft first' : `${P.state.profile.version} · ${(P.state.launcher.ram / 1024).toFixed(1)} GB · ${fx} modules`;
  }
  function updateStats() {
    const on = P.moduleDefs.filter((m) => P.isOn(m.id)).length;
    U.$('#statMods').textContent = on;
    U.$('#navModCount').textContent = P.moduleDefs.length;
    U.$('#statBadges').textContent = Object.keys(P.state.achievements).length;
    U.$('#statLaunches').textContent = P.state.stats.launches;
    updateLaunchSub();
  }
  function renderBadges() {
    const host = U.$('#badges');
    host.innerHTML = P.achievementsList.map((a) => {
      const got = P.state.achievements[a.id];
      return `<div class="badge ${got ? 'got' : ''}" title="${a.desc} · +${a.reward} $PSN"><i>${got ? a.icon : '🔒'}</i><span>${a.name}</span></div>`;
    }).join('');
    U.$('#badgeProgress').textContent = `${Object.keys(P.state.achievements).length}/${P.achievementsList.length}`;
    updateStats();
  }

  /* ---------------- accounts (desktop app) ---------------- */
  let acct = { active: null, accounts: [] };
  let pausedForGame = false;
  function drawSkinFace(url) {
    const cv = U.$('#skinFace'), g = cv.getContext('2d');
    U.$('#avatar').classList.toggle('has-skin', !!url);
    g.clearRect(0, 0, 8, 8);
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { g.imageSmoothingEnabled = false; g.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8); g.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8); };
    img.src = url.replace(/^http:/, 'https:');
  }
  function renderAccount(view) {
    acct = view || acct;
    const cur = acct.accounts.find((a) => a.uuid === acct.active);
    U.$('#accountName').textContent = cur ? cur.name : 'Not signed in';
    U.$('#accountLabel').textContent = cur ? 'Microsoft account' : 'Sign in to play';
    U.$('#msLogin').hidden = !!cur;
    U.$('#msAdd').hidden = !cur;
    U.$('#msLogout').hidden = !cur;
    const sel = U.$('#accountSelect');
    sel.hidden = acct.accounts.length < 2;
    sel.innerHTML = acct.accounts.map((a) => `<option value="${a.uuid}" ${a.uuid === acct.active ? 'selected' : ''}>${a.name}</option>`).join('');
    drawSkinFace(cur && cur.skin);
    if (cur) { P.state.profile.name = cur.name; P.save(); P.emit('module', { id: 'nametag' }); }
    U.$('#launchBtn').classList.toggle('needs-login', !cur);
    updateLaunchSub();
  }
  async function doLogin() {
    const btns = [U.$('#msLogin'), U.$('#msAdd')];
    btns.forEach((b) => (b.disabled = true));
    const res = await native.login();
    btns.forEach((b) => (b.disabled = false));
    renderAccount(res);
    if (res.ok) {
      const cur = res.accounts.find((a) => a.uuid === res.active);
      P.toast('Signed in', `Welcome, ${cur.name}`, 'on', '✔');
      P.chain('LOGIN ' + cur.name);
    } else if (!/closed/i.test(res.message)) P.toast('Sign-in failed', res.message, 'error', '!');
  }
  async function setupAccounts() {
    U.$('#profileName').hidden = true;
    U.$('#accountRow').hidden = false;
    U.$('#msLogin').addEventListener('click', doLogin);
    U.$('#msAdd').addEventListener('click', doLogin);
    U.$('#msLogout').addEventListener('click', async () => { renderAccount(await native.logout(acct.active)); P.toast('Signed out', '', 'off', '○'); });
    U.$('#accountSelect').addEventListener('change', async (e) => renderAccount(await native.selectAccount(e.target.value)));
    renderAccount(await native.accounts());
    // real version list from Mojang
    const vr = await native.versions();
    const vs = U.$('#versionSelect');
    if (vr.ok) {
      const want = P.state.profile.version;
      vs.innerHTML = vr.versions.map((v) => `<option>${v}</option>`).join('');
      vs.value = vr.versions.includes(want) ? want : vr.latest.release;
      P.state.profile.version = vs.value;
      P.save();
      updateLaunchSub();
    } else P.toast('Offline', 'Could not load the version list from Mojang. Check your connection.', 'error', '!');
    const info = await native.info();
    U.$('#gameDirLine').textContent = 'Game folder: ' + info.gameDir + ' (each version + loader gets its own instance folder for mods, config and saves)';
    // POISON in-game badge: the bundled mod targets one game version with Fabric
    const badge = U.$('#poisonBadge');
    const supported = Array.isArray(info.poisonFor) ? info.poisonFor : info.poisonFor ? [info.poisonFor] : [];
    const syncBadge = () => {
      if (!supported.length) { badge.hidden = true; return; }
      const on = supported.includes(P.state.profile.version) && U.$('#loaderSelect').value === 'Fabric';
      badge.hidden = false;
      badge.classList.toggle('on', on);
      badge.innerHTML = on
        ? `<i>☠</i> POISON in-game client <b>ON</b> (${P.state.profile.version}): menu, glow HUD, effects, knife, chams, music`
        : `<i>○</i> POISON in-game needs <b>${supported.join(' or ')} + Fabric</b>: ` +
          supported.map((v) => `<button type="button" class="link-btn" data-switch="${v}">switch to ${v}</button>`).join(' ');
      U.$$('[data-switch]', badge).forEach((sw) => sw.addEventListener('click', () => {
        const v = sw.dataset.switch;
        if (![...vs.options].some((o) => o.value === v)) vs.insertAdjacentHTML('afterbegin', `<option>${v}</option>`);
        vs.value = v; U.$('#loaderSelect').value = 'Fabric';
        P.state.profile.version = v; P.state.profile.loader = 'Fabric'; P.save(); updateLaunchSub(); syncBadge(); P.sfx('on');
      }));
    };
    vs.addEventListener('change', syncBadge);
    U.$('#loaderSelect').addEventListener('change', syncBadge);
    syncBadge();
    U.$$('[data-folder]').forEach((b) => b.addEventListener('click', () => native.openFolder(b.dataset.folder, P.state.profile.version, U.$('#loaderSelect').value)));
    native.onExit(({ code }) => {
      P.toast('Minecraft closed', code ? `Exit code ${code}. Open the game folder, then logs, for details.` : 'See you next session', code ? 'error' : 'off', code ? '!' : '☠');
      if (pausedForGame && P.music) { P.music.resume(); pausedForGame = false; }
    });
  }

  /* ---------------- launch sequence ---------------- */
  function setPct(pct) {
    U.$('#loPct').textContent = Math.round(pct) + '%';
    U.$('.lo-ring').style.setProperty('--p', pct);
  }
  function overlayReset() {
    U.$('#loLog').innerHTML = '';
    U.$('#loError').hidden = true;
    U.$('#loClose').hidden = true;
    U.$('#loStep').textContent = 'initializing';
    setPct(0);
  }
  function logLine(text, mark = '✔') {
    const log = U.$('#loLog');
    log.insertAdjacentHTML('afterbegin', `<div><span>${mark}</span>${String(text).replace(/</g, '&lt;').slice(0, 160)}</div>`);
    while (log.childElementCount > 40) log.removeChild(log.lastChild);
  }
  function launchFx() {
    P.sfx('launch');
    const r = U.$('#launchBtn').getBoundingClientRect();
    P.fx.confetti(r.left + r.width / 2, r.top + r.height / 2, 60);
    P.state.stats.launches++;
    P.save();
    updateStats();
    P.unlock('first_launch');
    P.chain('LAUNCH ' + P.state.profile.version);
  }
  // overall progress: each stage maps into a slice of one bar
  const STAGE_RANGE = { auth: [0, 3], meta: [3, 5], java: [5, 30], assets: [30, 70], fabric: [70, 72], 'classes-custom': [72, 76], classes: [76, 88], natives: [88, 92], 'assets-copy': [92, 96], running: [100, 100] };
  async function launch() {
    const ov = U.$('#launchOverlay');
    if (ov.classList.contains('open')) return;
    if (native && native.launch) {
      if (!acct.active) { P.toast('Sign in first', 'Click "Sign in with Microsoft" next to the Launch button.', 'error', '!'); P.sfx('error'); return; }
      overlayReset();
      ov.classList.add('open');
      launchFx();
      let lastText = '';
      const offProgress = native.onProgress((p) => {
        const [a, b] = STAGE_RANGE[p.stage] || [90, 99];
        const frac = p.total ? Math.min(1, p.done / p.total) : 0;
        setPct(a + (b - a) * frac);
        if (p.text !== lastText) { logLine(p.text); lastText = p.text; }
        const label = p.total > 1 ? `${p.text} (${p.done}/${p.total})` : p.text;
        U.$('#loStep').textContent = label;
        U.$('#loHash').textContent = U.hash(label);
      });
      const offLog = native.onLog((line) => { if (/\b(error|exception)\b/i.test(line)) logLine(line, '!'); });
      let res;
      try { res = await native.launch(exportConfig()); } catch (e) { res = { ok: false, message: String(e && e.message || e) }; }
      offProgress();
      offLog();
      if (res && res.ok) {
        setPct(100);
        U.$('#loStep').textContent = 'Minecraft is running. Have fun!';
        if (P.music && P.music.playing && P.isOn('autopause')) { P.music.pause(); pausedForGame = true; }
        setTimeout(() => ov.classList.remove('open'), 1400);
      } else {
        U.$('#loStep').textContent = 'Launch failed';
        const err = U.$('#loError');
        err.textContent = (res && res.message) || 'Unknown error';
        err.hidden = false;
        U.$('#loClose').hidden = false;
        P.sfx('error');
      }
      return;
    }
    // ---- browser demo mode (no desktop app): animated sequence only ----
    overlayReset();
    ov.classList.add('open');
    launchFx();
    const steps = ['resolving version manifest', `downloading ${P.state.profile.version} client jar`, 'verifying asset hashes (sha1)', 'extracting natives', 'starting JVM'];
    let i = 0;
    const iv = setInterval(() => {
      setPct(((i + 1) / steps.length) * 100);
      U.$('#loStep').textContent = steps[i];
      U.$('#loHash').textContent = U.hash(steps[i] + Date.now());
      logLine(steps[i]);
      if (++i >= steps.length) {
        clearInterval(iv);
        P.toast('Demo mode', 'Run the POISON desktop app to sign in and launch the real game.', 'gold', '🚀');
        setTimeout(() => ov.classList.remove('open'), 900);
      }
    }, 300);
  }

  /* ---------------- client page ---------------- */
  const PRESETS = {
    cinematic: { motionblur: { on: true, s: { mode: 'cinematic', samples: 16, shutter: 300 } }, bloom: { on: true, s: { strength: 0.9, threshold: 0.8 } }, letterbox: { on: true }, grain: { on: true, s: { amount: 0.06 } }, chroma: { on: true, s: { amount: 0.5 } }, vignette: { on: true, s: { amount: 0.7 } }, grade: { on: true, s: { sat: 1.1, contrast: 1.12, warmth: 0.2 } }, autopilot: { on: true } },
    neon: { motionblur: { on: true, s: { mode: 'hybrid', samples: 10, shutter: 270, trail: 0.6 } }, bloom: { on: true, s: { strength: 1.6, threshold: 0.6, radius: 2 } }, chroma: { on: true, s: { amount: 1.6 } }, letterbox: { on: false }, grade: { on: true, s: { sat: 1.5, contrast: 1.15 } }, sky: { on: true, s: { preset: 'synthwave' } }, scanlines: { on: true, s: { amount: 0.12 } } },
    comp: { motionblur: { on: false }, bloom: { on: true, s: { strength: 0.5 } }, chroma: { on: false }, letterbox: { on: false }, grain: { on: false }, vignette: { on: false }, scanlines: { on: false }, weather: { on: false }, grade: { on: true, s: { sat: 1.05, contrast: 1.0, warmth: 0 } } },
    vapor: { sky: { on: true, s: { preset: 'void' } }, motionblur: { on: true, s: { mode: 'frameblend', trail: 0.75 } }, bloom: { on: true, s: { strength: 1.2, threshold: 0.65 } }, grade: { on: true, s: { sat: 1.3, warmth: -0.4 } }, weather: { on: true, s: { type: 'snow' } }, letterbox: { on: false } },
  };
  function applyPreset(name) {
    const p = PRESETS[name];
    for (const [id, v] of Object.entries(p)) {
      if (v.s) for (const [k, val] of Object.entries(v.s)) P.setModSetting(id, k, val);
      if (v.on !== undefined) P.setMod(id, v.on, true);
    }
    U.$$('[data-preset]').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
    P.toast('Render preset: ' + U.$(`[data-preset="${name}"]`).textContent.trim(), '', 'on', '🎬');
    renderLabPanels();
  }
  function renderLabPanels() {
    const mb = U.$('#mbSettings'), fx = U.$('#fxSettings');
    mb.innerHTML = ''; fx.innerHTML = '';
    const toggleRow = (id) => {
      const d = P.defsById[id];
      const row = U.el('div', { class: 'set-row inline lab-toggle' }, [U.el('label', { text: d.name })]);
      const sw = U.el('button', { type: 'button', class: 'switch' + (P.isOn(id) ? ' on' : '') });
      sw.addEventListener('click', () => { const on = !P.isOn(id); P.setMod(id, on); sw.classList.toggle('on', on); });
      row.append(sw);
      return row;
    };
    mb.append(toggleRow('motionblur'));
    P.defsById.motionblur.settings.forEach((s) => mb.append(P.settingWidget(P.defsById.motionblur, s)));
    ['bloom', 'chroma', 'letterbox', 'grain', 'vignette', 'tonemap', 'grade', 'sharpen', 'scanlines', 'weather', 'sky', 'handchams', 'itemchams'].forEach((id) => {
      const d = P.defsById[id];
      const box = U.el('div', { class: 'lab-mod' });
      box.append(toggleRow(id));
      d.settings.slice(0, 2).forEach((s) => box.append(P.settingWidget(d, s)));
      fx.append(box);
    });
  }
  function renderClient() {
    U.$$('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
    U.$('#btnFlip').addEventListener('click', () => P.world.flip());
    U.$('#btnInspect').addEventListener('click', () => P.world.inspect());
    U.$('#btnF5').addEventListener('click', () => P.world.toggleF5());
    const pilot = U.$('#btnPilot');
    const syncPilot = () => pilot.classList.toggle('active', P.isOn('autopilot'));
    pilot.addEventListener('click', () => { P.setMod('autopilot', !P.isOn('autopilot')); syncPilot(); });
    P.on('module', (e) => e.id === 'autopilot' && syncPilot());
    syncPilot();
    U.$('#btnGui').addEventListener('click', () => P.clickgui.toggle());
    renderLabPanels();
  }

  /* ---------------- settings ---------------- */
  function exportConfig() {
    return { client: 'POISON', build: 'b1.4.2', exported: new Date().toISOString(), profile: P.state.profile, launcher: P.state.launcher, modules: Object.fromEntries(P.moduleDefs.map((m) => [m.id, P.mod(m.id)])), equipped: P.state.equipped };
  }
  function renderSettings() {
    const L = P.state.launcher;
    const th = U.$('#themes');
    Object.entries(THEMES).forEach(([name, [a, b]]) => {
      const btn = U.el('button', { type: 'button', class: 'theme' + (L.theme === name ? ' active' : ''), style: { '--a': a, '--b': b }, html: `<i></i><span>${name}</span>` });
      btn.addEventListener('click', () => {
        L.theme = name; L.accent = a; L.accent2 = b; P.save(); applyTheme();
        U.$$('.theme', th).forEach((x) => x.classList.toggle('active', x === btn));
        U.$('#accent1').value = a; U.$('#accent2').value = b;
        P.unlock('theme'); P.sfx('on');
      });
      th.append(btn);
    });
    const a1 = U.$('#accent1'), a2 = U.$('#accent2');
    a1.value = L.accent; a2.value = L.accent2;
    a1.addEventListener('input', () => { L.accent = a1.value; P.save(); applyTheme(); });
    a2.addEventListener('input', () => { L.accent2 = a2.value; P.save(); applyTheme(); });
    const seg = (host, key, opts) => {
      opts.forEach((o) => {
        const b = U.el('button', { type: 'button', class: L[key] === o ? 'active' : '', text: o });
        b.addEventListener('click', () => { L[key] = o; P.save(); applyTheme(); U.$$('button', host).forEach((x) => x.classList.toggle('active', x === b)); P.sfx('click'); });
        host.append(b);
      });
    };
    seg(U.$('#bgMode'), 'bg', ['network', 'matrix', 'glyphs', 'off']);
    seg(U.$('#qualityMode'), 'quality', ['low', 'medium', 'ultra']);
    const toggles = (host, list) => list.forEach(([key, label]) => {
      const row = U.el('div', { class: 'set-row inline' }, [U.el('label', { text: label })]);
      const sw = U.el('button', { type: 'button', class: 'switch' + (L[key] ? ' on' : '') });
      sw.addEventListener('click', () => { L[key] = !L[key]; sw.classList.toggle('on', L[key]); P.save(); applyTheme(); P.sfx(L[key] ? 'on' : 'off'); });
      row.append(sw); host.append(row);
    });
    toggles(U.$('#launcherToggles'), [['rgb', 'RGB hue-cycle mode'], ['cursor', 'Cursor glow + trail'], ['sparks', 'Click sparks'], ['sfx', 'UI sound effects'], ['splash', 'Boot splash'], ['grain', 'Film grain'], ['scanlines', 'Scanlines'], ['tilt', '3D tilt cards'], ['beatSync', 'Beat-reactive glow'], ['reducedMotion', 'Reduced motion']]);
    toggles(U.$('#gameToggles'), [['fullscreen', 'Fullscreen'], ['closeOnLaunch', 'Close launcher on game start']]);

    const ram = U.$('#ram'), rv = U.$('#ramVal');
    const paintRam = () => { rv.textContent = (ram.value / 1024).toFixed(1) + ' GB'; ram.style.setProperty('--p', ((ram.value - 1024) / (16384 - 1024)) * 100 + '%'); };
    ram.value = L.ram; paintRam();
    ram.addEventListener('input', () => { L.ram = parseInt(ram.value, 10); P.save(); paintRam(); updateLaunchSub(); });
    const bindText = (id, key, num) => { const el = U.$(id); el.value = L[key]; el.addEventListener('change', () => { L[key] = num ? parseInt(el.value, 10) || L[key] : el.value; P.save(); }); };
    bindText('#javaPath', 'javaPath'); bindText('#jvmArgs', 'jvm'); bindText('#resW', 'width', true); bindText('#resH', 'height', true);

    const gk = U.$('#guiKey');
    gk.textContent = L.guiKey;
    gk.addEventListener('click', () => {
      gk.textContent = 'press a key…'; gk.classList.add('listening');
      const h = (e) => { e.preventDefault(); L.guiKey = e.code; P.save(); gk.textContent = e.code; gk.classList.remove('listening'); removeEventListener('keydown', h, true); };
      addEventListener('keydown', h, true);
    });

    U.$('#cfgExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(exportConfig(), null, 2)], { type: 'application/json' });
      const a = U.el('a', { href: URL.createObjectURL(blob), download: 'poison-config.json' });
      document.body.append(a); a.click(); a.remove();
      P.toast('Config exported', 'poison-config.json', 'on', '⇩');
    });
    U.$('#cfgCopy').addEventListener('click', () => {
      navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(exportConfig())).then(() => P.toast('Config copied', 'Paste it to a friend', 'on', '⧉'), () => P.toast('Clipboard blocked', '', 'error', '!'));
    });
    U.$('#cfgImport').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const cfg = JSON.parse(await f.text());
        if (cfg.modules) for (const [id, v] of Object.entries(cfg.modules)) { if (!P.defsById[id]) continue; P.state.modules[id] = { on: !!v.on, settings: v.s || {} }; }
        if (cfg.launcher) Object.assign(P.state.launcher, cfg.launcher);
        if (cfg.equipped) for (const [k, v] of Object.entries(cfg.equipped)) if (P.state.wallet.owned.includes(v) || v === 'none') P.state.equipped[k] = v;
        P.save();
        P.toast('Config imported', 'Reloading…', 'on', '⇧');
        setTimeout(() => location.reload(), 900);
      } catch (err) { P.toast('Invalid config file', String(err.message || err), 'error', '!'); }
    });
    U.$('#cfgReset').addEventListener('click', () => { if (confirm('Reset all POISON settings, wallet and badges?')) P.resetAll(); });
    const total = P.moduleDefs.length + P.launcherFeatures.length;
    U.$('#aboutLine').innerHTML = `POISON b1.4.2 · <b>${P.moduleDefs.length}</b> modules + <b>${P.launcherFeatures.length}</b> launcher features = <b>${total}</b> total. Not affiliated with Mojang or Microsoft. Crypto elements are simulated and play-money only.`;
    U.$('#featureCount').textContent = total;
  }

  /* ---------------- window controls (electron) ---------------- */
  function windowControls() {
    U.$$('[data-win]').forEach((b) => b.addEventListener('click', () => {
      if (native && native.window) native.window(b.dataset.win);
      else if (b.dataset.win === 'max') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      else P.toast('Window controls', 'Available in the desktop (Electron) build', 'info', '▢');
    }));
    if (!native) document.body.classList.add('web');
  }

  /* ---------------- global keys ---------------- */
  function keys() {
    addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.code === P.state.launcher.guiKey && !(typing && !P.clickgui.isOpen())) { e.preventDefault(); P.clickgui.toggle(); }
      else if (e.code === 'Escape' && P.clickgui.isOpen()) P.clickgui.hide();
    });
  }

  /* ---------------- RGB mode ---------------- */
  function rgbLoop() {
    let h = 0;
    setInterval(() => {
      if (!P.state.launcher.rgb) return;
      h = (h + 2) % 360;
      const r = document.documentElement.style;
      r.setProperty('--accent', `hsl(${h},100%,60%)`);
      r.setProperty('--accent2', `hsl(${(h + 70) % 360},100%,60%)`);
    }, 50);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    applyTheme();
    P.fx.init();
    renderHome();
    renderClient();
    P.renderModsGrid();
    P.renderLocker();
    P.renderMusic();
    P.initCrypto();
    renderSettings();
    windowControls();
    keys();
    rgbLoop();
    U.$$('.nav-item').forEach((n) => n.addEventListener('click', () => go(n.dataset.page)));
    addEventListener('resize', moveGlider);
    moveGlider();
    P.fx.splash(() => {
      P.unlock('genesis');
      P.fx.scramble(U.$('.hero-sub b'), 'legit');
      const hash = (location.hash || '').slice(1);
      if (hash && U.$('#page-' + hash)) go(hash);
    });
    // stash a debug handle
    window.__poison = P;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
