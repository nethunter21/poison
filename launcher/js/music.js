/* POISON CLIENT — music player.
 * Built-in tracks are generated live by a small WebAudio synth/sequencer (no audio files,
 * no licensing issues). You can also load your own audio files. Everything goes through
 * one EQ -> compressor -> analyser chain, and the analyser drives the beat-reactive glow.
 */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;

  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], phryg: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };

  const TRACKS = [
    { title: "Satoshi's Dream", artist: 'POISON FM · synthwave', bpm: 100, root: 57, scale: 'minor', prog: [0, 5, 2, 6], style: 'synthwave', art: 'linear-gradient(135deg,#ff2e88,#7b2ff7 60%,#1a0530)' },
    { title: 'Diamond Hands', artist: 'POISON FM · house', bpm: 124, root: 53, scale: 'minor', prog: [0, 3, 5, 4], style: 'house', art: 'linear-gradient(135deg,#16c8ff,#a5f3fc 50%,#0b2aff)' },
    { title: 'Gas Fees (Night Drive)', artist: 'POISON FM · outrun', bpm: 92, root: 52, scale: 'dorian', prog: [0, 6, 5, 6], style: 'drive', art: 'linear-gradient(135deg,#ff8a00,#ff2e88 55%,#120010)' },
    { title: 'To The Moon', artist: 'POISON FM · hyperpop', bpm: 140, root: 50, scale: 'phryg', prog: [0, 1, 6, 4], style: 'moon', art: 'linear-gradient(135deg,#ffd23f,#ff8a00 45%,#2a1a00)' },
    { title: 'Rug Pull Requiem', artist: 'POISON FM · darkwave', bpm: 76, root: 48, scale: 'minor', prog: [0, 5, 3, 4], style: 'dark', art: 'linear-gradient(135deg,#330000,#ff0033 60%,#000)' },
    { title: 'Cold Wallet', artist: 'POISON FM · lofi', bpm: 84, root: 55, scale: 'major', prog: [0, 5, 3, 4], style: 'lofi', art: 'linear-gradient(135deg,#00ff9d,#0a3d2a 60%,#020a06)' },
  ].map((t) => ({ ...t, type: 'synth', bars: 32 }));

  P.music = (function () {
    let ctx, master, comp, analyser, eq = [], reverb, revGain, delay, delayFb, delayGain, freq, wave;
    let audioEl, mediaSrc;
    let schedTimer = null, step = 0, nextTime = 0, playing = false, idx = 0, noiseBuf;
    const tracks = TRACKS.slice();

    function ensure() {
      if (ctx) return ctx;
      ctx = P.audioCtx();
      if (!ctx) return null;
      master = ctx.createGain();
      master.gain.value = P.state.music.volume;
      const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180;
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1200; mid.Q.value = 0.8;
      const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 5000;
      eq = [low, mid, high];
      P.state.music.eq.forEach((g, i) => (eq[i].gain.value = g));
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.78;
      freq = new Uint8Array(analyser.frequencyBinCount);
      wave = new Uint8Array(analyser.fftSize);
      // bus: instruments -> low -> mid -> high -> comp -> master -> analyser -> out
      low.connect(mid); mid.connect(high); high.connect(comp); comp.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
      // fx sends
      reverb = ctx.createConvolver();
      reverb.buffer = impulse(2.8);
      revGain = ctx.createGain(); revGain.gain.value = 0.28;
      reverb.connect(revGain); revGain.connect(low);
      delay = ctx.createDelay(1.5);
      delayFb = ctx.createGain(); delayFb.gain.value = 0.38;
      delayGain = ctx.createGain(); delayGain.gain.value = 0.3;
      delay.connect(delayFb); delayFb.connect(delay); delay.connect(delayGain); delayGain.connect(low);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      audioEl = new Audio();
      audioEl.crossOrigin = 'anonymous';
      mediaSrc = ctx.createMediaElementSource(audioEl);
      mediaSrc.connect(low);
      audioEl.addEventListener('ended', () => onEnd());
      return ctx;
    }
    function impulse(sec) {
      const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      return b;
    }

    /* ---------- instruments ---------- */
    const dry = () => eq[0];
    function env(g, t, a, peak, dcy, sus = 0.0001) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dcy);
    }
    function kick(t, v = 1) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      env(g, t, 0.002, 0.95 * v, 0.38);
      o.connect(g); g.connect(dry()); o.start(t); o.stop(t + 0.45);
    }
    function snare(t, v = 1, rev = 0.5) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const g = ctx.createGain(); env(g, t, 0.002, 0.42 * v, 0.2);
      n.connect(hp); hp.connect(g); g.connect(dry());
      const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(reverb);
      const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190; o.type = 'triangle';
      env(og, t, 0.002, 0.3 * v, 0.1); o.connect(og); og.connect(dry());
      n.start(t); n.stop(t + 0.3); o.start(t); o.stop(t + 0.15);
    }
    function hat(t, v = 1, open = false) {
      const n = ctx.createBufferSource(); n.buffer = noiseBuf;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
      const g = ctx.createGain(); env(g, t, 0.001, 0.14 * v, open ? 0.22 : 0.045);
      n.connect(hp); hp.connect(g); g.connect(dry());
      n.start(t); n.stop(t + 0.3);
    }
    function bass(t, note, dur, cutoff = 600, type = 'sawtooth', v = 1) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = type; o2.type = 'square'; o.frequency.value = NOTE(note); o2.frequency.value = NOTE(note - 12);
      f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(cutoff * 3, t); f.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + dur);
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      env(g, t, 0.005, 0.32 * v, dur * 0.9, 0.05);
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(dry());
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function pad(t, notes, dur, bright = 1400, v = 1) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * v, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      f.connect(g); g.connect(dry());
      const s = ctx.createGain(); s.gain.value = 0.9; g.connect(s); s.connect(reverb);
      notes.forEach((n) => [-7, 7].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      }));
    }
    function lead(t, note, dur, type = 'square', v = 1, send = 0.6) {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = type; o.frequency.value = NOTE(note);
      f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + dur);
      env(g, t, 0.004, 0.09 * v, dur);
      o.connect(f); f.connect(g); g.connect(dry());
      const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(delay);
      o.start(t); o.stop(t + dur + 0.05);
    }

    /* ---------- sequencer ---------- */
    function chord(tr, bar) {
      const sc = SCALES[tr.scale];
      const deg = tr.prog[bar % tr.prog.length];
      const at = (d) => tr.root + sc[d % 7] + 12 * Math.floor(d / 7);
      return [at(deg), at(deg + 2), at(deg + 4), at(deg + 6)];
    }
    function rng(seed) { let x = Math.sin(seed * 999.13) * 43758.5453; return x - Math.floor(x); }

    function playStep(tr, s, t) {
      const sixteenth = 60 / tr.bpm / 4;
      const bar = Math.floor(s / 16), pos = s % 16;
      const section = Math.floor(bar / 8); // 0 intro, 1 build, 2 drop, 3 outro
      const ch = chord(tr, bar);
      const intro = section === 0, drop = section === 2, outro = section === 3;
      const st = tr.style;
      // drums
      const four = st === 'house' || st === 'moon' || drop;
      if (!intro || bar >= 4) {
        if (four ? pos % 4 === 0 : pos === 0 || pos === 10) kick(t, 1);
        if (st === 'dark' ? pos === 8 : pos === 4 || pos === 12) snare(t, st === 'lofi' ? 0.6 : 1, st === 'synthwave' || st === 'drive' ? 0.8 : 0.4);
        if (st === 'house' && pos % 4 === 2) hat(t, 1.2, true);
        else if (pos % 2 === 0 || (st === 'moon' && !outro)) hat(t, pos % 4 === 2 ? 1 : 0.55);
      } else if (pos === 0) kick(t, 0.6);
      // bass
      const root = ch[0] - 24;
      if (st === 'synthwave' || st === 'drive') { if (pos % 2 === 0) bass(t, root + (pos % 8 === 6 ? 12 : 0), sixteenth * 1.8, st === 'drive' ? 500 : 750); }
      else if (st === 'house') { if (pos % 4 === 2) bass(t, root + 12, sixteenth * 1.5, 900); }
      else if (st === 'moon') { if (pos % 2 === 0 || pos % 3 === 0) bass(t, root + (pos > 11 ? 7 : 0), sixteenth, 1100, 'square'); }
      else if (st === 'dark') { if (pos === 0 || pos === 6 || pos === 12) bass(t, root, sixteenth * 4, 300); }
      else if (st === 'lofi') { if (pos === 0 || pos === 7 || pos === 10) bass(t, root + 12, sixteenth * 3, 450, 'triangle'); }
      // pads every bar
      if (pos === 0) pad(t, ch.map((n) => n), sixteenth * 16, st === 'dark' ? 700 : st === 'lofi' ? 900 : 1600, outro ? 0.6 : 1);
      // lead arp / melody
      if (!intro || bar >= 6) {
        const r = rng(s + tr.bpm * 7 + bar);
        if (st === 'synthwave' || st === 'drive') { if (pos % 2 === 0) lead(t, ch[(pos / 2) % 4] + 12, sixteenth * 1.5, 'sawtooth', drop ? 1.1 : 0.7); }
        else if (st === 'house') { if (pos % 4 === 3 || (drop && pos % 8 === 1)) [0, 1, 2].forEach((k) => lead(t, ch[k] + 12, sixteenth * 1.4, 'square', 0.5, 0.4)); }
        else if (st === 'moon') { if (r > 0.35) lead(t, ch[Math.floor(r * 4)] + 24, sixteenth * 0.9, 'square', 0.9); }
        else if (st === 'dark') { if (pos % 4 === 0 && r > 0.4) lead(t, ch[Math.floor(r * 3)] + 12, sixteenth * 6, 'triangle', 1.4, 0.8); }
        else if (st === 'lofi') { if ((pos === 0 || pos === 3 || pos === 6 || pos === 10) && r > 0.25) lead(t, ch[Math.floor(r * 4)] + 12, sixteenth * 2.5, 'triangle', 1.3, 0.5); }
      }
    }

    function totalSteps(tr) { return tr.bars * 16; }
    function scheduler() {
      const tr = tracks[idx];
      if (!playing || tr.type !== 'synth') return;
      const sixteenth = 60 / tr.bpm / 4;
      while (nextTime < ctx.currentTime + 0.12) {
        if (step >= totalSteps(tr)) { onEnd(); return; }
        playStep(tr, step, nextTime);
        nextTime += sixteenth * (step % 2 === 1 && tr.style === 'lofi' ? 0.88 : step % 2 === 0 && tr.style === 'lofi' ? 1.12 : 1);
        step++;
      }
    }

    function onEnd() {
      const rep = P.state.music.repeat;
      if (rep === 'one') return play(idx);
      if (!P.state.music.shuffle && idx === tracks.length - 1 && rep === 'off') return stop();
      next();
    }

    function stop() {
      playing = false;
      clearInterval(schedTimer);
      if (audioEl) audioEl.pause();
      P.emit('music', { playing });
    }
    function play(i = idx) {
      if (!ensure()) return;
      stop();
      idx = (i + tracks.length) % tracks.length;
      P.state.music.track = idx; P.save();
      const tr = tracks[idx];
      playing = true;
      if (tr.type === 'synth') {
        step = 0;
        nextTime = ctx.currentTime + 0.06;
        schedTimer = setInterval(scheduler, 25);
        scheduler();
      } else {
        audioEl.src = tr.url;
        audioEl.currentTime = 0;
        audioEl.play().catch(() => P.toast('Playback blocked', 'Click play again', 'error', '!'));
      }
      P.emit('track', tr);
      P.emit('music', { playing });
      P.unlock('dj');
      P.chain && P.chain('PLAY ' + tr.title);
    }
    function pause() {
      if (!playing) return;
      playing = false;
      clearInterval(schedTimer);
      if (tracks[idx].type === 'file') audioEl.pause();
      P.emit('music', { playing });
    }
    function resume() {
      if (!ensure()) return;
      const tr = tracks[idx];
      if (tr.type === 'synth') {
        if (step === 0 && !schedTimer) return play(idx);
        playing = true; nextTime = ctx.currentTime + 0.05; schedTimer = setInterval(scheduler, 25);
      } else { playing = true; audioEl.play(); }
      P.emit('track', tr);
      P.emit('music', { playing });
    }
    function toggle() { playing ? pause() : (schedTimer || (audioEl && audioEl.src) ? resume() : play(idx)); }
    function next() {
      if (P.state.music.shuffle) {
        let n = idx; while (tracks.length > 1 && n === idx) n = Math.floor(Math.random() * tracks.length);
        return play(n);
      }
      play(idx + 1);
    }
    function prev() { if (position() > 3) return seek(0); play(idx - 1); }
    function duration(tr = tracks[idx]) { return tr.type === 'synth' ? (tr.bars * 4 * 60) / tr.bpm : (audioEl && isFinite(audioEl.duration) ? audioEl.duration : 0); }
    function position() {
      const tr = tracks[idx];
      if (tr.type === 'synth') return (step / totalSteps(tr)) * duration(tr);
      return audioEl ? audioEl.currentTime : 0;
    }
    function seek(frac) {
      const tr = tracks[idx];
      if (tr.type === 'synth') { step = Math.floor(U.clamp(frac, 0, 0.999) * totalSteps(tr)); step -= step % 16; if (ctx) nextTime = ctx.currentTime + 0.05; }
      else if (audioEl && isFinite(audioEl.duration)) audioEl.currentTime = frac * audioEl.duration;
    }
    function setVolume(v) { P.state.music.volume = v; P.save(); if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.03); }
    function setEq(i, g) { P.state.music.eq[i] = g; P.save(); if (eq[i]) eq[i].gain.setTargetAtTime(g, ctx.currentTime, 0.03); }
    function spectrum() { if (!analyser) return null; analyser.getByteFrequencyData(freq); return freq; }
    function waveform() { if (!analyser) return null; analyser.getByteTimeDomainData(wave); return wave; }
    function addFiles(files) {
      const list = Array.from(files).filter((f) => f.type.startsWith('audio/'));
      list.forEach((f) => tracks.push({ type: 'file', title: f.name.replace(/\.[^.]+$/, ''), artist: 'Local file', url: URL.createObjectURL(f), art: `linear-gradient(135deg, hsl(${Math.random() * 360},90%,55%), #111)` }));
      if (list.length) { P.toast(`Added ${list.length} track${list.length > 1 ? 's' : ''}`, 'From your device', 'on', '♫'); P.emit('playlist'); }
    }

    // beat follower -> CSS var --beat + P.beat for 3D scene glow
    let beatV = 0;
    function beatLoop() {
      requestAnimationFrame(beatLoop);
      let e = 0;
      if (analyser && playing) {
        analyser.getByteFrequencyData(freq);
        for (let i = 1; i < 7; i++) e += freq[i];
        e = Math.max(0, (e / 6 / 255 - 0.45) / 0.55);
      }
      beatV = e > beatV ? U.lerp(beatV, e, 0.6) : beatV * 0.9;
      P.beat = beatV;
      const on = P.state.launcher.beatSync && P.isOn('beatsync');
      document.documentElement.style.setProperty('--beat', on ? beatV.toFixed(3) : 0);
    }
    requestAnimationFrame(beatLoop);

    return {
      tracks, play, pause, resume, toggle, next, prev, seek, setVolume, setEq, spectrum, waveform, addFiles, duration, position,
      get playing() { return playing; },
      get index() { return idx; },
      set index(v) { idx = v; },
    };
  })();

  /* ---------------- Music page UI + mini player ---------------- */
  P.renderMusic = function () {
    const m = P.music;
    m.index = U.clamp(P.state.music.track || 0, 0, m.tracks.length - 1);
    const list = U.$('#playlist');
    const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    function drawList() {
      list.innerHTML = '';
      m.tracks.forEach((t, i) => {
        const row = U.el('div', { class: 'pl-row' + (i === m.index ? ' active' : '') }, [
          U.el('div', { class: 'pl-art', style: { background: t.art } }),
          U.el('div', { class: 'pl-meta' }, [U.el('b', { text: t.title }), U.el('span', { text: t.artist })]),
          U.el('em', { text: t.type === 'synth' ? fmtT(m.duration(t)) : 'file' }),
          U.el('div', { class: 'pl-eq', html: '<i></i><i></i><i></i>' }),
        ]);
        row.addEventListener('click', () => { m.play(i); });
        list.append(row);
      });
    }
    drawList();
    P.on('playlist', drawList);

    const big = U.$('#mpArt'), title = U.$('#mpTitle'), artist = U.$('#mpArtist');
    const playBtns = U.$$('[data-mp="toggle"]');
    const setMeta = (t) => {
      if (!t) return;
      big.style.background = t.art; title.textContent = t.title; artist.textContent = t.artist;
      U.$('#miniTitle').textContent = t.title; U.$('#miniArtist').textContent = t.artist; U.$('#miniArt').style.background = t.art;
      U.$$('.pl-row', list).forEach((r, i) => r.classList.toggle('active', i === m.index));
    };
    setMeta(m.tracks[m.index]);
    P.on('track', setMeta);
    P.on('music', ({ playing }) => {
      playBtns.forEach((b) => (b.innerHTML = playing ? '❚❚' : '▶'));
      document.body.classList.toggle('music-playing', playing);
    });
    U.$$('[data-mp]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.mp;
      P.sfx('click');
      if (a === 'toggle') m.toggle();
      if (a === 'next') m.next();
      if (a === 'prev') m.prev();
      if (a === 'shuffle') { P.state.music.shuffle = !P.state.music.shuffle; P.save(); syncModes(); }
      if (a === 'repeat') { const o = ['all', 'one', 'off']; P.state.music.repeat = o[(o.indexOf(P.state.music.repeat) + 1) % 3]; P.save(); syncModes(); }
    }));
    function syncModes() {
      U.$$('[data-mp="shuffle"]').forEach((b) => b.classList.toggle('active', P.state.music.shuffle));
      U.$$('[data-mp="repeat"]').forEach((b) => { b.classList.toggle('active', P.state.music.repeat !== 'off'); b.textContent = P.state.music.repeat === 'one' ? '↻¹' : '↻'; });
    }
    syncModes();

    const vol = U.$('#mpVol');
    vol.value = P.state.music.volume;
    const paintVol = () => vol.style.setProperty('--p', vol.value * 100 + '%');
    paintVol();
    vol.addEventListener('input', () => { m.setVolume(parseFloat(vol.value)); paintVol(); });
    U.$$('.eq-band input').forEach((inp, i) => {
      inp.value = P.state.music.eq[i];
      inp.addEventListener('input', () => m.setEq(i, parseFloat(inp.value)));
    });
    U.$$('[data-eqp]').forEach((b) => b.addEventListener('click', () => {
      const presets = { flat: [0, 0, 0], bass: [9, 0, -1], vocal: [-2, 5, 2], club: [6, -2, 5], lofi: [3, -1, -8] };
      const p = presets[b.dataset.eqp];
      U.$$('.eq-band input').forEach((inp, i) => { inp.value = p[i]; m.setEq(i, p[i]); });
      P.sfx('click');
    }));
    U.$('#mpFiles').addEventListener('change', (e) => m.addFiles(e.target.files));
    const seekBar = U.$('#mpSeek');
    seekBar.addEventListener('click', (e) => { const r = seekBar.getBoundingClientRect(); m.seek((e.clientX - r.left) / r.width); });

    U.$$('[data-viz]').forEach((b) => {
      b.classList.toggle('active', b.dataset.viz === P.state.music.viz);
      b.addEventListener('click', () => { P.state.music.viz = b.dataset.viz; P.save(); U.$$('[data-viz]').forEach((x) => x.classList.toggle('active', x === b)); P.sfx('click'); });
    });

    // visualizer + progress
    const cv = U.$('#vizCanvas'), g = cv.getContext('2d');
    const mini = U.$('#miniViz'), mg = mini.getContext('2d');
    const parts = Array.from({ length: 90 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), s: 0.2 + Math.random() }));
    function frame() {
      requestAnimationFrame(frame);
      const dur = m.duration(), pos = m.position();
      U.$('#mpFill').style.width = (dur ? (pos / dur) * 100 : 0) + '%';
      U.$('#mpPos').textContent = fmtT(pos);
      U.$('#mpDur').textContent = fmtT(dur);
      U.$('#miniFill').style.width = (dur ? (pos / dur) * 100 : 0) + '%';
      const data = m.spectrum(), wv = m.waveform();
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim();
      // mini viz
      mg.clearRect(0, 0, mini.width, mini.height);
      if (data) { mg.fillStyle = accent; for (let i = 0; i < 24; i++) { const v = data[i * 3 + 1] / 255; mg.fillRect(i * 5, mini.height - v * mini.height, 3, v * mini.height); } }
      if (!U.$('#page-music').classList.contains('active')) return;
      const W = (cv.width = cv.clientWidth * 1.5), H = (cv.height = cv.clientHeight * 1.5);
      g.clearRect(0, 0, W, H);
      if (!data) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.font = '600 22px system-ui'; g.textAlign = 'center'; g.fillText('press play to start the visualizer', W / 2, H / 2); return; }
      const gr = g.createLinearGradient(0, H, W, 0);
      gr.addColorStop(0, accent); gr.addColorStop(1, accent2);
      g.shadowColor = accent; g.shadowBlur = 22;
      const mode = P.state.music.viz;
      if (mode === 'bars') {
        const n = 72, w = W / n;
        g.fillStyle = gr;
        for (let i = 0; i < n; i++) {
          const v = Math.pow(data[Math.floor(Math.pow(i / n, 1.6) * data.length * 0.8) + 1] / 255, 1.4);
          const h = v * H * 0.9;
          g.fillRect(i * w + 2, H - h, w - 4, h);
          g.globalAlpha = 0.25; g.fillRect(i * w + 2, H - h - 6, w - 4, 2); g.globalAlpha = 1;
        }
      } else if (mode === 'wave') {
        g.strokeStyle = gr; g.lineWidth = 4; g.beginPath();
        for (let i = 0; i < wv.length; i++) { const x = (i / wv.length) * W, y = (wv[i] / 255) * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        g.globalAlpha = 0.35; g.lineWidth = 12; g.stroke(); g.globalAlpha = 1;
      } else if (mode === 'circle') {
        const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.22 * (1 + P.beat * 0.25);
        g.strokeStyle = gr; g.lineWidth = 4;
        for (let i = 0; i < 128; i++) {
          const a = (i / 128) * Math.PI * 2 - Math.PI / 2;
          const v = data[(i % 64) * 3 + 1] / 255;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + v * R * 1.1), cy + Math.sin(a) * (R + v * R * 1.1)); g.stroke();
        }
        g.fillStyle = gr; g.font = `900 ${R * 0.9}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₿', cx, cy + 4);
      } else {
        const cx = W / 2, cy = H / 2;
        g.fillStyle = gr;
        parts.forEach((p, i) => {
          const v = data[(i % 40) + 2] / 255;
          p.a += 0.004 * p.s + v * 0.02;
          const r = (0.15 + p.r * 0.35 + v * 0.25) * Math.min(W, H);
          g.beginPath(); g.arc(cx + Math.cos(p.a) * r * 1.6, cy + Math.sin(p.a) * r, 2 + v * 9, 0, Math.PI * 2); g.fill();
        });
      }
    }
    requestAnimationFrame(frame);
  };
})();
