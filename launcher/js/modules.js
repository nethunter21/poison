/* POISON CLIENT — module registry (legit-only), ClickGUI and Mods grid
 *
 * Every module here is cosmetic, visual, HUD, QoL or performance — the same kind
 * of thing mainstream PvP clients ship. There are NO combat/movement advantages:
 * no reach, aim, ESP/through-wall rendering, velocity, autoclick, etc.
 * "Chams" here are SELF chams only (your own model / hand / held item).
 *
 * `live: true` modules drive the real-time preview in this launcher; the rest are
 * saved into the client config that the game-side mod reads on launch.
 */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;

  const sl = (id, label, def, min, max, step = 1, unit = '') => ({ id, label, type: 'slider', def, min, max, step, unit });
  const tg = (id, label, def = false) => ({ id, label, type: 'toggle', def });
  const se = (id, label, def, options) => ({ id, label, type: 'select', def, options });
  const co = (id, label, def) => ({ id, label, type: 'color', def });

  P.categories = [
    { id: 'render', name: 'Render', icon: '◈' },
    { id: 'anim', name: 'Animations', icon: '🦋' },
    { id: 'camera', name: 'Camera', icon: '◉' },
    { id: 'hud', name: 'HUD', icon: '▦' },
    { id: 'cosmetic', name: 'Cosmetics', icon: '✦' },
    { id: 'music', name: 'Music', icon: '♫' },
    { id: 'crypto', name: 'Crypto', icon: '₿' },
    { id: 'perf', name: 'Performance', icon: '⚡' },
    { id: 'util', name: 'Utility', icon: '⚙' },
  ];

  const M = (id, name, cat, desc, on, settings = [], live = false, key = '') => ({ id, name, cat, desc, def: on, settings, live, key });

  P.moduleDefs = [
    /* ===================== RENDER ===================== */
    M('motionblur', 'Motion Blur', 'render', 'Shutter-accurate sub-frame motion blur. Renders N sub-frames per frame and averages them, like an offline render.', true, [
      se('mode', 'Mode', 'cinematic', ['cinematic', 'frameblend', 'hybrid']),
      sl('samples', 'Sub-frame samples', 10, 2, 32, 1),
      sl('shutter', 'Shutter angle', 270, 45, 360, 5, '°'),
      sl('trail', 'Frame-blend trail', 0.55, 0, 0.95, 0.01),
      tg('adaptive', 'Adaptive samples (hold 45+ FPS)', true),
    ], true),
    M('bloom', 'Bloom', 'render', 'HDR glow around bright pixels. Neon everything.', true, [
      sl('strength', 'Strength', 0.75, 0, 3, 0.05), sl('threshold', 'Threshold', 0.82, 0, 1.5, 0.01), sl('radius', 'Radius', 1.4, 0.2, 3, 0.1),
    ], true),
    M('chroma', 'Chromatic Aberration', 'render', 'RGB lens fringing at the screen edges.', true, [sl('amount', 'Amount', 0.6, 0, 3, 0.05)], true),
    M('vignette', 'Vignette', 'render', 'Darkened lens corners for a filmic frame.', true, [sl('amount', 'Amount', 0.55, 0, 1.5, 0.01)], true),
    M('grain', 'Film Grain', 'render', 'Animated 35mm grain.', true, [sl('amount', 'Amount', 0.05, 0, 0.3, 0.005)], true),
    M('letterbox', 'Cinematic Bars', 'render', '2.39:1 letterbox bars. Instant movie mode.', false, [sl('size', 'Bar size', 0.11, 0, 0.25, 0.005)], true),
    M('grade', 'Color Grading', 'render', 'Saturation, contrast and temperature.', true, [
      sl('sat', 'Saturation', 1.18, 0, 2, 0.01), sl('contrast', 'Contrast', 1.08, 0.5, 1.6, 0.01), sl('warmth', 'Warmth', 0.12, -1, 1, 0.01),
    ], true),
    M('tonemap', 'Filmic Tonemap', 'render', 'ACES filmic curve for highlights that roll off like film.', true, [sl('exposure', 'Exposure', 1.05, 0.3, 2.5, 0.01)], true),
    M('scanlines', 'CRT Scanlines', 'render', 'Retro scanline overlay in game.', false, [sl('amount', 'Amount', 0.18, 0, 0.6, 0.01)], true),
    M('sharpen', 'Sharpen', 'render', 'Contrast-adaptive sharpening.', false, [sl('amount', 'Amount', 0.35, 0, 1, 0.01)], true),
    M('fog', 'Custom Fog', 'render', 'Distance fog density and tint.', true, [sl('density', 'Density', 0.013, 0, 0.08, 0.001), co('color', 'Tint', '#2a1030')], true),
    M('sky', 'Custom Sky', 'render', 'Sky gradient presets.', true, [se('preset', 'Preset', 'synthwave', ['synthwave', 'dusk', 'void', 'toxic', 'ice'])], true),
    M('timechanger', 'Time Changer', 'render', 'Client-side time of day (visual only).', false, [sl('time', 'Time', 0.75, 0, 1, 0.01)], true),
    M('weather', 'Weather', 'render', 'Client-side weather particles. "Coin rain" is extremely bullish.', true, [se('type', 'Type', 'coins', ['coins', 'rain', 'snow', 'embers'])], true),
    M('outline', 'Block Outline', 'render', 'Glowing outline on the block you look at.', true, [co('color', 'Color', '#ff8a00'), sl('width', 'Glow', 1, 0.2, 2, 0.1)], true),
    M('handchams', 'Hand Chams', 'render', 'Fresnel glow shell on YOUR first-person hand. Self only.', true, [co('color', 'Color', '#ff2e88'), sl('power', 'Rim power', 2.2, 0.5, 6, 0.1), tg('pulse', 'Pulse to beat', true)], true),
    M('itemchams', 'Item Chams', 'render', 'Glow shell on the item you are holding. Self only.', true, [co('color', 'Color', '#ffb347'), sl('power', 'Rim power', 1.8, 0.5, 6, 0.1), tg('rainbow', 'Rainbow cycle', false)], true),
    M('selfchams', 'Self Chams', 'render', 'Glow shell on your own player model in F5. Self only.', true, [co('color', 'Color', '#a855f7'), sl('opacity', 'Intensity', 0.8, 0, 1, 0.01)], true),
    M('glint', 'Enchant Glint Color', 'render', 'Recolor the enchantment glint.', false, [co('color', 'Color', '#b56cff'), sl('speed', 'Speed', 1, 0.1, 4, 0.1)]),
    M('hitcolor', 'Hit Color', 'render', 'Custom tint when an entity takes damage.', false, [co('color', 'Color', '#ff0044'), sl('alpha', 'Alpha', 0.4, 0, 1, 0.01)]),
    M('particlemult', 'Particle Multiplier', 'render', 'Scale crit/sharpness particles (visual only).', false, [sl('mult', 'Multiplier', 2, 1, 10, 1)]),
    M('nohurtcam', 'No Hurt Cam', 'render', 'Remove the camera shake when you take damage.', false, [sl('amount', 'Shake kept', 0, 0, 1, 0.05)]),
    M('lowfire', 'Low Fire', 'render', 'Lowers the burning overlay.', true, [sl('height', 'Height', 0.3, 0, 1, 0.05)]),
    M('clearwater', 'Clear Water', 'render', 'Less underwater fog.', false),
    M('dynfov', 'Static FOV', 'render', 'Disable FOV changes from speed effects.', true),
    M('dmgtint', 'Damage Tint', 'render', 'Red screen edges at low health.', true, [sl('threshold', 'Below HP', 6, 1, 20, 1)]),
    M('blockoverlay', 'Block Overlay Fill', 'render', 'Fill color on the targeted block face.', false, [co('color', 'Color', '#ff8a00'), sl('alpha', 'Alpha', 0.15, 0, 1, 0.01)]),

    /* ===================== ANIMATIONS ===================== */
    M('butterfly', 'Butterfly Knife', 'anim', 'Replaces every sword with a fully animated balisong. Visual only, same hitbox & damage.', true, [
      se('idle', 'Idle style', 'chatter', ['still', 'chatter', 'twirl', 'aerial']),
      sl('autoflip', 'Auto-flip every', 7, 0, 30, 1, 's'),
      sl('speed', 'Flip speed', 1, 0.3, 2.5, 0.05),
      tg('flipOnSwap', 'Flip open on hotbar swap', true),
    ], true, 'F'),
    M('inspect', 'Knife Inspect', 'anim', 'Press I to inspect your knife — CS-style inspect animation.', true, [sl('speed', 'Speed', 1, 0.3, 2, 0.05)], true, 'I'),
    M('itempos', 'Item Position', 'anim', 'Move/scale the held item.', true, [
      sl('x', 'X', 0, -0.5, 0.5, 0.01), sl('y', 'Y', 0, -0.5, 0.5, 0.01), sl('z', 'Z', 0, -0.5, 0.5, 0.01), sl('scale', 'Scale', 1, 0.4, 1.8, 0.01),
    ], true),
    M('swing', 'Swing Speed', 'anim', 'Visual swing animation speed (does not change CPS or cooldown).', true, [sl('speed', 'Speed', 1, 0.3, 2.5, 0.05), se('style', 'Style', 'slash', ['slash', 'stab', 'spin'])], true),
    M('viewbob', 'View Bobbing', 'anim', 'Walk bob amount.', true, [sl('amount', 'Amount', 0.6, 0, 1.5, 0.01)], true),
    M('itembob', 'Item Sway', 'anim', 'Held item lags behind your camera turns.', true, [sl('amount', 'Amount', 1, 0, 2.5, 0.05)], true),
    M('old17', '1.7 Animations', 'anim', 'Classic 1.7 block-hit, rod and bow animations.', true, [tg('blockhit', 'Block-hit', true), tg('rod', 'Rod', true), tg('bow', 'Bow', true)]),
    M('smoothsneak', 'Smooth Sneak', 'anim', 'Interpolated crouch camera.', true),
    M('equipanim', 'Equip Animation', 'anim', 'Item slides in on hotbar swap.', true, [sl('speed', 'Speed', 1, 0.2, 3, 0.1)]),
    M('emotes', 'Emotes', 'anim', 'Emote wheel (B). Includes "Diamond Hands", "HODL", "Rug Pull".', true, [], false, 'B'),
    M('killfx', 'Kill Effect', 'anim', 'Cosmetic effect on kill (visible to POISON users).', true, [se('fx', 'Effect', 'liquidation', ['liquidation', 'lightning', 'confetti', 'coin-burst', 'rekt'])]),
    M('deathanim', 'Death Animation', 'anim', 'Custom death animation for your own player.', false, [se('style', 'Style', 'shatter', ['shatter', 'dissolve', 'ascend'])]),

    /* ===================== CAMERA ===================== */
    M('zoom', 'Zoom', 'camera', 'Hold C to zoom smoothly.', true, [sl('factor', 'Zoom', 4, 2, 10, 0.5, 'x'), tg('smooth', 'Smooth', true), tg('scroll', 'Scroll to adjust', true)], true, 'C'),
    M('fov', 'FOV Changer', 'camera', 'Field of view.', true, [sl('fov', 'FOV', 92, 50, 120, 1, '°')], true),
    M('perspective', 'Perspective (F5)', 'camera', 'Toggle third person to admire your cosmetics.', true, [sl('dist', 'Distance', 4.2, 2, 8, 0.1)], true, 'V'),
    M('cinecam', 'Cinematic Camera', 'camera', 'Smoothed mouse look for recording.', false, [sl('smooth', 'Smoothing', 0.85, 0.5, 0.98, 0.01)], true),
    M('tilt', 'Strafe Tilt', 'camera', 'Camera rolls slightly when strafing (A/D).', true, [sl('amount', 'Amount', 2.5, 0, 8, 0.1, '°')], true),
    M('autopilot', 'Showcase Flight', 'camera', 'Auto-flying camera path in the launcher preview.', true, [sl('speed', 'Speed', 1, 0.2, 3, 0.05), sl('turn', 'Turn intensity', 1, 0, 2.5, 0.05)], true),
    M('screenshake', 'Screen Shake', 'camera', 'Shake on your own hits (cosmetic).', false, [sl('amount', 'Amount', 0.3, 0, 1, 0.05)]),

    /* ===================== HUD ===================== */
    M('watermark', 'Watermark', 'hud', 'Glowing POISON watermark.', true, [tg('version', 'Show version', true)], true),
    M('arraylist', 'Array List', 'hud', 'Rainbow list of enabled modules.', true, [se('color', 'Color', 'wave', ['wave', 'accent', 'rainbow']), tg('bg', 'Background', true)], true),
    M('fps', 'FPS', 'hud', 'Frames per second.', true, [], true),
    M('cps', 'CPS', 'hud', 'Clicks per second (display only).', true, [], true),
    M('keystrokes', 'Keystrokes', 'hud', 'WASD / Space / LMB / RMB display.', true, [tg('cps', 'Show CPS in mouse keys', true), tg('glow', 'Glow on press', true)], true),
    M('coords', 'Coordinates', 'hud', 'XYZ + biome.', true, [tg('biome', 'Biome', true)], true),
    M('direction', 'Compass', 'hud', 'Direction strip.', true, [], true),
    M('clock', 'Clock', 'hud', 'Real-time clock.', false, [se('format', 'Format', '24h', ['24h', '12h'])], true),
    M('ping', 'Ping', 'hud', 'Server latency.', true, [], true),
    M('serverip', 'Server Address', 'hud', 'Current server.', false, [], true),
    M('armor', 'Armor Status', 'hud', 'Armor durability.', true, [se('mode', 'Durability', 'percent', ['percent', 'value'])], true),
    M('potions', 'Potion Effects', 'hud', 'Active effects with timers.', true, [], true),
    M('combo', 'Combo Counter', 'hud', 'Hits in a row.', true, [], true),
    M('speedo', 'Speedometer', 'hud', 'Blocks per second.', false, [], true),
    M('memory', 'Memory Usage', 'hud', 'JVM heap usage.', false, [], true),
    M('session', 'Session Timer', 'hud', 'Time played this session.', false, [], true),
    M('crosshair', 'Custom Crosshair', 'hud', 'Crosshair styles.', true, [se('style', 'Style', 'cross-dot', ['cross', 'cross-dot', 'circle', 'diamond', 'btc']), co('color', 'Color', '#ffffff'), sl('size', 'Size', 14, 6, 32, 1), tg('glow', 'Glow', true)], true),
    M('nowplaying', 'Now Playing', 'hud', 'Current track + mini visualizer.', true, [], true),
    M('tickerhud', 'Crypto Ticker HUD', 'hud', 'Scrolling (simulated) price ticker in game.', true, [], true),
    M('wallethud', 'Wallet HUD', 'hud', '$PSN balance + session earnings.', false, [], true),
    M('scoreboard', 'Scoreboard Restyle', 'hud', 'Glass scoreboard with accent border.', true, [sl('scale', 'Scale', 1, 0.5, 1.5, 0.05), tg('numbers', 'Hide red numbers', true)]),
    M('bossbar', 'Boss Bar Restyle', 'hud', 'Neon boss bar.', false),
    M('hotbar', 'Hotbar Glow', 'hud', 'Animated selection glow on the hotbar.', true, [], true),
    M('notifs', 'Notifications', 'hud', 'Module toggle notifications.', true, [], true),
    M('packdisplay', 'Pack Display', 'hud', 'Shows active resource pack.', false),
    M('tabrestyle', 'Tab List Restyle', 'hud', 'Glass tab list with ping bars & POISON badges.', true),
    M('chatrestyle', 'Chat Restyle', 'hud', 'Rounded glass chat with fade-in.', true, [sl('opacity', 'Background', 0.4, 0, 1, 0.01)]),

    /* ===================== COSMETICS ===================== */
    M('cape', 'Cape', 'cosmetic', 'Animated cloth cape. Choose your design in the Locker.', true, [tg('physics', 'Cloth physics', true)], true),
    M('wings', 'Wings', 'cosmetic', 'Neon wings. Choose in the Locker.', true, [sl('flap', 'Flap speed', 1, 0, 3, 0.05)], true),
    M('halo', 'Halo', 'cosmetic', 'Floating emissive halo.', true, [], true),
    M('aura', 'Aura', 'cosmetic', 'Orbiting particle aura.', true, [sl('count', 'Particles', 24, 4, 80, 1)], true),
    M('lasereyes', 'Laser Eyes', 'cosmetic', 'The classic bullish meme. Glowing red eye beams.', false, [co('color', 'Color', '#ff1a1a'), sl('length', 'Length', 6, 1, 20, 0.5)], true),
    M('pet', 'Pet', 'cosmetic', 'A floating companion.', true, [], true),
    M('trail', 'Particle Trail', 'cosmetic', 'Particles behind you while moving.', true, [se('type', 'Type', 'sparks', ['sparks', 'coins', 'hearts', 'hex'])], true),
    M('nametag', 'Nametag Glow', 'cosmetic', 'Glowing nametag + POISON icon.', true, [co('color', 'Color', '#ff8a00')], true),
    M('bandana', 'Bandana', 'cosmetic', 'Animated bandana.', false),
    M('cloak', 'Cloak Shimmer', 'cosmetic', 'Holographic shimmer on your skin.', false, [sl('speed', 'Speed', 1, 0.1, 3, 0.1)]),
    M('shoulder', 'Shoulder Buddy', 'cosmetic', 'Tiny Shiba on your shoulder. Much wow.', false),

    /* ===================== MUSIC ===================== */
    M('musicplayer', 'Music Player', 'music', 'In-game music player with procedural synthwave + your own files.', true, [], true),
    M('beatsync', 'Beat-Reactive Glow', 'music', 'UI and HUD glow pulse to the bass.', true, [sl('amount', 'Intensity', 1, 0, 2, 0.05)], true),
    M('visualizer', 'In-Game Visualizer', 'music', 'Spectrum bars at the bottom of the screen.', false, [], true),
    M('autopause', 'Auto Pause in Menus', 'music', 'Pause music when the game is paused.', false),
    M('crossfade', 'Crossfade', 'music', 'Smooth fade between tracks.', true, [sl('time', 'Time', 2, 0, 8, 0.5, 's')]),
    M('ducking', 'Combat Ducking', 'music', 'Lower music volume while in combat.', false, [sl('amount', 'Duck to', 0.4, 0, 1, 0.05)]),

    /* ===================== CRYPTO ===================== */
    M('ticker', 'Market Ticker', 'crypto', 'Simulated market ticker in the launcher (not real prices, not financial advice).', true, [sl('speed', 'Scroll speed', 1, 0.2, 3, 0.1)], true),
    M('wallet', '$PSN Wallet', 'crypto', 'Earn play-money $PSN for playtime and badges. Spend it on cosmetics. No real value.', true, [], true),
    M('gasmeter', 'Gas Meter', 'crypto', 'Shows "gas" = your current ping, in gwei. Pure vibes.', true, [], true),
    M('explorer', 'Block Explorer', 'crypto', 'Every launcher action is hashed into a local "block". Just for fun.', true, [], true),
    M('feargreed', 'Fear & Greed', 'crypto', 'Gauge driven by your K/D. Greed when you are winning.', true, [], true),
    M('airdrop', 'Daily Airdrop', 'crypto', 'Claim free $PSN once a day.', true, [], true),
    M('miner', 'Proof-of-Click Miner', 'crypto', 'Idle mini-game in the launcher.', true, [], true),
    M('hodl', 'HODL Mode', 'crypto', 'Q (drop item) needs a double-press so you never drop your sword by accident.', true),
    M('rugalert', 'Rug-Pull Alert', 'crypto', 'Warns when your armor durability is about to break.', true, [sl('threshold', 'Warn below', 10, 1, 50, 1, '%')]),

    /* ===================== PERFORMANCE ===================== */
    M('fpsboost', 'FPS Boost', 'perf', 'Bundled render optimizations.', true),
    M('entityculling', 'Entity Culling', 'perf', 'Skip rendering entities you cannot see.', true),
    M('fastmath', 'Fast Math', 'perf', 'Lookup-table trig.', true),
    M('chunkbuilder', 'Async Chunk Builder', 'perf', 'Build chunks off the main thread.', true, [sl('threads', 'Threads', 4, 1, 16, 1)]),
    M('memfix', 'Memory Leak Fix', 'perf', 'Fixes known texture/leak issues.', true),
    M('fpscap', 'Unfocused FPS Cap', 'perf', 'Cap FPS when tabbed out.', true, [sl('cap', 'Cap', 30, 5, 120, 5)]),
    M('vsync', 'Adaptive VSync', 'perf', 'Tear-free without the input lag spikes.', false),
    M('lazyload', 'Lazy Resource Loading', 'perf', 'Faster startup with on-demand textures.', true),
    M('particlecap', 'Particle Limit', 'perf', 'Cap total particles.', false, [sl('max', 'Max', 2000, 200, 8000, 100)]),
    M('previewq', 'Preview Quality', 'perf', 'Launcher 3D preview resolution scale.', true, [sl('scale', 'Resolution', 1, 0.4, 2, 0.05, 'x')], true),

    /* ===================== UTILITY (legit QoL) ===================== */
    M('togglesprint', 'Toggle Sprint', 'util', 'Press once to keep sprinting (vanilla-equivalent).', true, [tg('hud', 'Show state', true)]),
    M('togglesneak', 'Toggle Sneak', 'util', 'Press once to stay crouched.', false),
    M('autogg', 'Auto GG', 'util', 'Sends "gg" at the end of a game.', true, [se('msg', 'Message', 'gg', ['gg', 'gg wp', 'gg ez... jk', 'HODL gg'])]),
    M('autotext', 'Text Hotkeys', 'util', 'Bind chat messages to keys.', false),
    M('timestamps', 'Chat Timestamps', 'util', 'Time prefix on chat messages.', false),
    M('chatcopy', 'Chat Copy', 'util', 'Click a message to copy it.', true),
    M('screenshot', 'Screenshot Manager', 'util', 'Gallery + instant copy for F2.', true),
    M('waypoints', 'Waypoints', 'util', 'Manual waypoints you set yourself.', false),
    M('replay', 'Replay Hook', 'util', 'Integrates with replay recording mods.', false),
    M('discordrpc', 'Discord Rich Presence', 'util', 'Shows "Playing POISON".', true),
    M('streamer', 'Streamer Mode', 'util', 'Hide your IP, coords and nick on stream.', false, [tg('coords', 'Hide coords', true), tg('nick', 'Hide nick', true)]),
    M('nickhider', 'Nick Hider', 'util', 'Replace your name locally.', false),
    M('serverpinger', 'Server Pinger', 'util', 'Live pings in the server list.', true),
    M('quickplay', 'Quick Play', 'util', 'One-click queue for your favorite modes.', true),
    M('blockhitfix', 'Mouse Delay Fix', 'util', 'Fixes the vanilla 1.8 mouse delay bug.', true),
    M('rawinput', 'Raw Input', 'util', 'Bypass OS mouse acceleration.', true),
  ];

  /* ---------------- state helpers ---------------- */
  const defsById = Object.fromEntries(P.moduleDefs.map((m) => [m.id, m]));
  P.defsById = defsById;

  P.mod = function (id) {
    const d = defsById[id];
    if (!d) return { on: false, s: {} };
    const st = P.state.modules[id] || {};
    const s = {};
    for (const set of d.settings) s[set.id] = st.settings && st.settings[set.id] !== undefined ? st.settings[set.id] : set.def;
    return { on: st.on !== undefined ? st.on : d.def, s };
  };
  P.isOn = (id) => P.mod(id).on;
  P.setMod = function (id, on, silent) {
    const st = (P.state.modules[id] = P.state.modules[id] || {});
    st.on = on;
    P.save();
    P.emit('module', { id, on });
    if (!silent) {
      P.sfx(on ? 'on' : 'off');
      if (P.isOn('notifs')) P.toast(`${defsById[id].name} ${on ? 'enabled' : 'disabled'}`, '', on ? 'on' : 'off', on ? '●' : '○');
      P.chain && P.chain(`${on ? 'ENABLE' : 'DISABLE'} ${id}`);
    }
    const enabled = P.moduleDefs.filter((m) => P.isOn(m.id)).length;
    if (enabled >= 100) P.unlock('modder');
  };
  P.setModSetting = function (id, key, val) {
    const st = (P.state.modules[id] = P.state.modules[id] || {});
    st.settings = st.settings || {};
    st.settings[key] = val;
    P.save();
    P.emit('module', { id, key, val });
    if (id === 'motionblur' && key === 'samples' && val >= 16) P.unlock('blur');
  };

  /* ---------------- setting widgets ---------------- */
  function settingWidget(mod, set) {
    const val = P.mod(mod.id).s[set.id];
    const row = U.el('div', { class: 'set-row' });
    const label = U.el('label', { text: set.label });
    row.append(label);
    if (set.type === 'slider') {
      const out = U.el('span', { class: 'set-val', text: fmtVal(val, set) });
      const inp = U.el('input', { type: 'range', min: set.min, max: set.max, step: set.step, value: val, class: 'slider' });
      const paint = () => inp.style.setProperty('--p', ((inp.value - set.min) / (set.max - set.min)) * 100 + '%');
      paint();
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        out.textContent = fmtVal(v, set);
        paint();
        P.setModSetting(mod.id, set.id, v);
      });
      label.append(out);
      row.append(inp);
    } else if (set.type === 'toggle') {
      const sw = U.el('button', { class: 'switch' + (val ? ' on' : ''), type: 'button' });
      sw.addEventListener('click', () => {
        const nv = !sw.classList.contains('on');
        sw.classList.toggle('on', nv);
        P.sfx(nv ? 'on' : 'off');
        P.setModSetting(mod.id, set.id, nv);
      });
      row.classList.add('inline');
      row.append(sw);
    } else if (set.type === 'select') {
      const sel = U.el('div', { class: 'seg' });
      for (const o of set.options) {
        const b = U.el('button', { type: 'button', class: o === val ? 'active' : '', text: o });
        b.addEventListener('click', () => {
          U.$$('button', sel).forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          P.sfx('click');
          P.setModSetting(mod.id, set.id, o);
        });
        sel.append(b);
      }
      row.append(sel);
    } else if (set.type === 'color') {
      const c = U.el('input', { type: 'color', value: val, class: 'color' });
      c.addEventListener('input', () => P.setModSetting(mod.id, set.id, c.value));
      row.classList.add('inline');
      row.append(c);
    }
    return row;
  }
  function fmtVal(v, set) {
    const d = set.step < 0.01 ? 3 : set.step < 1 ? 2 : 0;
    return Number(v).toFixed(d) + (set.unit || '');
  }
  P.settingWidget = settingWidget;

  /* ---------------- Mods grid page ---------------- */
  P.renderModsGrid = function () {
    const host = U.$('#modsGrid');
    const catBar = U.$('#modsCats');
    const search = U.$('#modsSearch');
    if (!host) return;
    let cat = 'all';

    catBar.innerHTML = '';
    const mkCat = (id, name, icon) => {
      const count = id === 'all' ? P.moduleDefs.length : P.moduleDefs.filter((m) => m.cat === id).length;
      const b = U.el('button', { class: 'chip' + (id === cat ? ' active' : ''), type: 'button', html: `<i>${icon}</i>${name}<em>${count}</em>` });
      b.addEventListener('click', () => { cat = id; U.$$('.chip', catBar).forEach((x) => x.classList.remove('active')); b.classList.add('active'); draw(); P.sfx('click'); });
      catBar.append(b);
    };
    mkCat('all', 'All', '✺');
    P.categories.forEach((c) => mkCat(c.id, c.name, c.icon));

    function draw() {
      const q = (search.value || '').toLowerCase();
      host.innerHTML = '';
      const list = P.moduleDefs.filter((m) => (cat === 'all' || m.cat === cat) && (!q || (m.name + ' ' + m.desc).toLowerCase().includes(q)));
      list.forEach((m, i) => {
        const st = P.mod(m.id);
        const card = U.el('div', { class: 'mod-card tilt' + (st.on ? ' on' : ''), style: { animationDelay: Math.min(i * 18, 600) + 'ms' } });
        const head = U.el('div', { class: 'mod-head' }, [
          U.el('div', { class: 'mod-icon', text: (P.categories.find((c) => c.id === m.cat) || {}).icon }),
          U.el('div', { class: 'mod-title' }, [
            U.el('b', { text: m.name }),
            U.el('span', { class: 'mod-tags', html: `${m.live ? '<i class="tag live">LIVE</i>' : ''}${m.key ? `<i class="tag key">${m.key}</i>` : ''}<i class="tag">${m.cat}</i>` }),
          ]),
        ]);
        const sw = U.el('button', { class: 'switch' + (st.on ? ' on' : ''), type: 'button', 'aria-label': 'toggle ' + m.name });
        sw.addEventListener('click', (e) => {
          e.stopPropagation();
          const on = !P.isOn(m.id);
          P.setMod(m.id, on);
          sw.classList.toggle('on', on);
          card.classList.toggle('on', on);
        });
        head.append(sw);
        card.append(head, U.el('p', { text: m.desc }));
        if (m.settings.length) {
          const more = U.el('button', { class: 'mod-more', type: 'button', text: `⚙ ${m.settings.length} setting${m.settings.length > 1 ? 's' : ''}` });
          const box = U.el('div', { class: 'mod-settings' });
          more.addEventListener('click', () => {
            if (!box.childElementCount) m.settings.forEach((s) => box.append(settingWidget(m, s)));
            card.classList.toggle('expanded');
            P.sfx('click');
          });
          card.append(more, box);
        }
        host.append(card);
      });
      U.$('#modsCount').textContent = `${list.length} modules · ${P.moduleDefs.filter((m) => P.isOn(m.id)).length} enabled · ${P.moduleDefs.filter((m) => m.live).length} live in preview`;
      P.fx && P.fx.bindTilt(host);
    }
    search.addEventListener('input', draw);
    P.on('module', (e) => { if (e.key === undefined) syncSwitches(); });
    function syncSwitches() {
      // keep the grid in sync with toggles made from the ClickGUI or keybinds
      U.$$('.mod-card', host).forEach((card) => {
        const name = U.$('.mod-title b', card).textContent;
        const m = P.moduleDefs.find((x) => x.name === name);
        if (!m) return;
        const on = P.isOn(m.id);
        card.classList.toggle('on', on);
        U.$('.switch', card).classList.toggle('on', on);
      });
    }
    draw();
  };

  /* ---------------- ClickGUI (panel-style, draggable) ---------------- */
  P.clickgui = (function () {
    let root = null;
    const pos = {};
    function build() {
      root = U.el('div', { id: 'clickgui', class: 'clickgui' });
      const top = U.el('div', { class: 'cg-top' }, [
        U.el('div', { class: 'cg-logo', html: '<span class="glitch" data-text="POISON">POISON</span><small>client menu · RSHIFT</small>' }),
      ]);
      const search = U.el('input', { class: 'cg-search', placeholder: 'search modules…', spellcheck: 'false' });
      const close = U.el('button', { class: 'cg-close', type: 'button', text: '✕' });
      close.addEventListener('click', hide);
      top.append(search, close);
      root.append(top);
      const area = U.el('div', { class: 'cg-area' });
      root.append(area);

      P.categories.forEach((c, i) => {
        const panel = U.el('div', { class: 'cg-panel', style: { animationDelay: i * 45 + 'ms' } });
        const p = pos[c.id] || { x: 16 + (i % 5) * 222, y: 12 + Math.floor(i / 5) * 330 };
        pos[c.id] = p;
        panel.style.left = p.x + 'px';
        panel.style.top = p.y + 'px';
        const header = U.el('div', { class: 'cg-header', html: `<i>${c.icon}</i><b>${c.name}</b><em>${P.moduleDefs.filter((m) => m.cat === c.id).length}</em>` });
        const body = U.el('div', { class: 'cg-body' });
        header.addEventListener('dblclick', () => panel.classList.toggle('collapsed'));
        drag(panel, header, c.id);
        P.moduleDefs.filter((m) => m.cat === c.id).forEach((m) => {
          const item = U.el('div', { class: 'cg-item' + (P.isOn(m.id) ? ' on' : ''), 'data-id': m.id, title: m.desc });
          const row = U.el('div', { class: 'cg-row', html: `<span>${m.name}</span>${m.live ? '<i class="dot"></i>' : ''}${m.settings.length ? '<em>⋯</em>' : ''}` });
          const sets = U.el('div', { class: 'cg-sets' });
          row.addEventListener('click', () => {
            P.setMod(m.id, !P.isOn(m.id));
          });
          row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!m.settings.length) return;
            if (!sets.childElementCount) m.settings.forEach((s) => sets.append(settingWidget(m, s)));
            item.classList.toggle('expanded');
            P.sfx('click');
          });
          item.append(row, sets);
          body.append(item);
        });
        panel.append(header, body);
        area.append(panel);
      });
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        U.$$('.cg-item', root).forEach((it) => {
          const d = defsById[it.dataset.id];
          it.style.display = !q || d.name.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      root.append(U.el('div', { class: 'cg-hint', text: 'Click = toggle · Right-click = settings · Drag headers · Double-click header = collapse · Esc / RShift = close' }));
      document.body.append(root);
      P.on('module', (e) => {
        if (e.key !== undefined) return;
        const it = root.querySelector(`.cg-item[data-id="${e.id}"]`);
        if (it) it.classList.toggle('on', e.on);
      });
    }
    function drag(panel, handle, id) {
      let sx, sy, ox, oy, dragging = false;
      handle.addEventListener('pointerdown', (e) => {
        dragging = true; sx = e.clientX; sy = e.clientY; ox = panel.offsetLeft; oy = panel.offsetTop;
        handle.setPointerCapture(e.pointerId);
        panel.classList.add('dragging');
        panel.parentNode.append(panel);
      });
      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const x = ox + e.clientX - sx, y = oy + e.clientY - sy;
        panel.style.left = x + 'px'; panel.style.top = y + 'px';
        pos[id] = { x, y };
      });
      handle.addEventListener('pointerup', () => { dragging = false; panel.classList.remove('dragging'); });
    }
    function show() {
      if (!root) build();
      root.classList.add('open');
      P.sfx('on');
      P.unlock('gui');
      setTimeout(() => U.$('.cg-search', root).focus(), 50);
    }
    function hide() { if (root) root.classList.remove('open'); P.sfx('off'); }
    function toggle() { if (root && root.classList.contains('open')) hide(); else show(); }
    return { show, hide, toggle, isOpen: () => !!root && root.classList.contains('open') };
  })();
})();
