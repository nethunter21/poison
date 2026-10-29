/* ChainSight Academy — application shell */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ================= STATE ================= */
  const KEY = 'chainsight.v1';
  const def = { xp: 0, done: {}, quiz: {}, labs: {}, dojoBest: 0, examBest: 0, examPassed: false, name: '', last: null, board: null };
  let S;
  try { S = Object.assign({}, def, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = Object.assign({}, def); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } };

  const LESSONS = COURSE.flatMap(m => m.lessons.map(l => Object.assign({ mod: m }, l)));
  const lessonById = id => LESSONS.find(l => l.id === id);
  const RANKS = [[0, 'Rookie', 'R'], [600, 'Analyst', 'A'], [1600, 'Investigator', 'I'], [3000, 'Senior Investigator', 'S'], [4500, 'Elite Investigator', 'E'], [6500, 'Legend', 'L']];
  const rankOf = xp => { let r = 0; RANKS.forEach((x, i) => { if (xp >= x[0]) r = i; }); return r; };

  function addXP(n, why, ev) {
    const before = rankOf(S.xp);
    S.xp += n; save();
    toast(`<b>+${n} XP</b> ${why}`);
    if (ev) burst(ev.clientX, ev.clientY);
    renderRank();
    const after = rankOf(S.xp);
    if (after > before) setTimeout(() => levelUp(after), 600);
  }

  /* ================= FX ================= */
  function toast(html) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 2600);
  }
  function burst(x, y, n = 22) {
    const cols = ['#38e1ff', '#8f5bff', '#ff3dbb', '#2bff9e', '#ffd84d'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div'); p.className = 'burst';
      const c = cols[i % cols.length]; p.style.background = c; p.style.boxShadow = `0 0 10px ${c}`;
      p.style.left = x + 'px'; p.style.top = y + 'px';
      document.body.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 110;
      p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }],
        { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => p.remove();
    }
  }
  function confetti() {
    for (let i = 0; i < 6; i++) setTimeout(() => burst(innerWidth * (0.2 + Math.random() * 0.6), innerHeight * (0.2 + Math.random() * 0.4), 30), i * 160);
  }
  function levelUp(r) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><div class="lv">RANK UP</div><h2 class="g">${RANKS[r][1]}</h2>
      <p>Your skills are leveling up. Keep tracing — the next rank unlocks at ${RANKS[r + 1] ? RANKS[r + 1][0].toLocaleString() + ' XP' : 'the top. You made it.'}</p>
      <button class="btn btn-p">Continue</button></div>`;
    document.body.appendChild(bg); confetti();
    bg.querySelector('button').onclick = () => bg.remove();
  }
  function ask(title, fields) {
    return new Promise(res => {
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" style="text-align:left;min-width:420px"><div class="lv">${esc(title)}</div>
        ${fields.map((f, i) => `<label style="display:block;font-size:12px;color:var(--muted);margin:16px 0 6px">${esc(f.label)}</label>
        <input class="inp" data-i="${i}" value="${esc(f.value || '')}" placeholder="${esc(f.ph || '')}">`).join('')}
        <div style="display:flex;gap:10px;margin-top:22px;justify-content:flex-end"><button class="btn btn-g" data-c>Cancel</button><button class="btn btn-p" data-ok>Save</button></div></div>`;
      document.body.appendChild(bg);
      const ins = $$('input', bg); ins[0].focus(); ins[0].select();
      const done = ok => { bg.remove(); res(ok ? ins.map(i => i.value) : null); };
      bg.querySelector('[data-ok]').onclick = () => done(true);
      bg.querySelector('[data-c]').onclick = () => done(false);
      bg.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    });
  }

  // Animated network background
  (function bgfx() {
    const c = $('#fx'), ctx = c.getContext('2d');
    let W, H, pts = [], pulses = [], mouse = { x: -999, y: -999 };
    const resize = () => {
      W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio;
      c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
      const n = Math.round(innerWidth * innerHeight / 22000);
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25 * devicePixelRatio, vy: (Math.random() - .5) * .25 * devicePixelRatio, r: Math.random() * 1.6 + .6 }));
    };
    resize(); addEventListener('resize', resize);
    addEventListener('mousemove', e => { mouse.x = e.clientX * devicePixelRatio; mouse.y = e.clientY * devicePixelRatio; });
    const D = 150 * devicePixelRatio;
    function frame() {
      if (!document.hidden) {
        ctx.clearRect(0, 0, W, H);
        for (const p of pts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
          const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
          if (d < 160) { p.x += dx / d * .8; p.y += dy / d * .8; }
        }
        ctx.lineWidth = devicePixelRatio * .7;
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < D) {
            ctx.strokeStyle = `rgba(110,150,255,${(1 - d / D) * .16})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            if (Math.random() < 0.0004 && pulses.length < 14) pulses.push({ a, b, t: 0 });
          }
        }
        for (const p of pts) { ctx.fillStyle = 'rgba(140,190,255,.55)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * devicePixelRatio, 0, 7); ctx.fill(); }
        pulses = pulses.filter(p => (p.t += 0.012) < 1);
        for (const p of pulses) {
          const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 9 * devicePixelRatio);
          g.addColorStop(0, 'rgba(56,225,255,.95)'); g.addColorStop(1, 'rgba(56,225,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9 * devicePixelRatio, 0, 7); ctx.fill();
        }
      }
      requestAnimationFrame(frame);
    }
    frame();
  })();

  // Cursor glow, card spotlight and 3D tilt
  const glow = $('#cglow');
  addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px';
    const sp = e.target.closest && e.target.closest('.spot');
    if (sp) {
      const r = sp.getBoundingClientRect();
      sp.style.setProperty('--mx', (e.clientX - r.left) + 'px'); sp.style.setProperty('--my', (e.clientY - r.top) + 'px');
      if (sp.classList.contains('tilt')) {
        const rx = ((e.clientY - r.top) / r.height - .5) * -8, ry = ((e.clientX - r.left) / r.width - .5) * 8;
        sp.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
      }
    }
  });
  document.addEventListener('mouseout', e => {
    const t = e.target.closest && e.target.closest('.tilt');
    if (t && !t.contains(e.relatedTarget)) t.style.transform = '';
  });

  /* ================= BOOT ================= */
  (function boot() {
    const lines = ['> init chainsight.core ……… <span class="ok">OK</span>', '> loading ledger heuristics [CIOH, change, peel] ……… <span class="ok">OK</span>',
      '> mounting graph engine (physics: enabled) ……… <span class="ok">OK</span>', `> ${COURSE.length} modules · ${LESSONS.length} lessons · ${LABS.length} case labs · ${Object.keys(MODELS).length} models`,
      '> establishing secure training environment ……… <span class="ok">OK</span>', '> welcome, investigator.'];
    const term = $('#bootTerm'), bar = $('#bootBar'), el = $('#boot');
    let i = 0, finished = false;
    const finish = () => { if (finished) return; finished = true; el.classList.add('out'); setTimeout(() => el.remove(), 800); };
    const tick = () => {
      if (finished) return;
      if (i < lines.length) { term.innerHTML += lines[i] + '<br>'; i++; bar.style.width = (i / lines.length * 100) + '%'; setTimeout(tick, 330); }
      else setTimeout(finish, 450);
    };
    setTimeout(tick, 250);
    el.addEventListener('click', finish); addEventListener('keydown', finish, { once: true });
  })();

  /* ================= WINDOW CONTROLS ================= */
  if (window.desktop) {
    $('#wMin').onclick = () => desktop.minimize();
    $('#wMax').onclick = () => desktop.maximize();
    $('#wClose').onclick = () => desktop.close();
    addEventListener('keydown', e => { if (e.key === 'F11') { e.preventDefault(); desktop.fullscreen(); } });
  } else $('#winCtrl').style.display = 'none';

  /* ================= SIDEBAR ================= */
  const ICON = {
    dash: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
    course: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5A2.5 2.5 0 0 1 4 18.5',
    labs: 'M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-10V3M7 15h10',
    dojo: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z',
    board: 'M5 6a2 2 0 1 0 0-.1zM19 6a2 2 0 1 0 0-.1zM12 18a2 2 0 1 0 0-.1zM7 6h10M6 8l5 8M18 8l-5 8',
    models: 'M12 2l9 5v10l-9 5-9-5V7zM12 22V12M21 7l-9 5-9-5',
    gloss: 'M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM8 9h8M8 13h6',
    exam: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
    cert: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.2 13.9L7 22l5-3 5 3-1.2-8.1',
  };
  const NAV = [
    ['LEARN'], ['dash', 'Dashboard'], ['course', 'Course'], ['models', 'Model Gallery'],
    ['PRACTICE'], ['labs', 'Case Labs'], ['dojo', 'Pattern Dojo'], ['board', 'Investigation Board'],
    ['REFERENCE'], ['gloss', 'Glossary'],
    ['CERTIFY'], ['exam', 'Final Exam'], ['cert', 'Certificate'],
  ];
  function renderSide() {
    const lab = LABS.filter(l => S.labs[l.id] && S.labs[l.id].done).length;
    const les = LESSONS.filter(l => S.done[l.id]).length;
    $('#side').innerHTML = NAV.map(n => n.length === 1 ? `<div class="nav-sec">${n[0]}</div>` :
      `<button class="nav" data-v="${n[0]}"><svg viewBox="0 0 24 24"><path d="${ICON[n[0]]}"/></svg>${n[1]}
        ${n[0] === 'course' ? `<span class="pill">${les}/${LESSONS.length}</span>` : ''}${n[0] === 'labs' ? `<span class="pill">${lab}/${LABS.length}</span>` : ''}</button>`).join('') +
      `<div class="rank-card" id="rankCard"></div>`;
    $$('.nav', $('#side')).forEach(b => b.onclick = () => go(b.dataset.v));
    renderRank(); markNav();
  }
  function renderRank() {
    const r = rankOf(S.xp), cur = RANKS[r], nxt = RANKS[r + 1];
    const pct = nxt ? (S.xp - cur[0]) / (nxt[0] - cur[0]) * 100 : 100;
    const rc = $('#rankCard'); if (!rc) return;
    rc.innerHTML = `<div class="rank-top"><div class="rank-badge">${cur[2]}</div><div><div class="rank-name">${cur[1]}</div>
      <div class="rank-xp">${S.xp.toLocaleString()} XP${nxt ? ' / ' + nxt[0].toLocaleString() : ''}</div></div></div>
      <div class="xpbar"><i style="width:${pct}%"></i></div>`;
  }
  let curView = 'dash';
  function markNav() { $$('.nav').forEach(b => b.classList.toggle('on', b.dataset.v === curView)); }

  /* ================= ROUTER ================= */
  const main = $('#main');
  function go(view, arg) {
    curView = view; markNav();
    main.scrollTop = 0;
    const V = { dash: vDash, course: vCourse, lesson: vLesson, labs: vLabs, lab: vLab, dojo: vDojo, board: vBoard, models: vModels, gloss: vGloss, exam: vExam, cert: vCert };
    if (view === 'lesson') { curView = 'course'; markNav(); }
    if (view === 'lab') { curView = 'labs'; markNav(); }
    clearInterval(dojoTimer);
    (V[view] || vDash)(arg);
  }
  const view = html => { main.innerHTML = `<div class="view">${html}</div>`; return main.firstElementChild; };

  /* ================= DASHBOARD ================= */
  function vDash() {
    const les = LESSONS.filter(l => S.done[l.id]).length;
    const labs = LABS.filter(l => S.labs[l.id] && S.labs[l.id].done).length;
    const pct = Math.round(les / LESSONS.length * 100);
    const next = LESSONS.find(l => !S.done[l.id]) || LESSONS[0];
    const v = view(`
      <section class="hero">
        <div class="hero-l">
          <div class="eyebrow">// Professional crypto investigator training</div>
          <h1 class="h1">Follow the money.<br><span class="g">Across every chain.</span></h1>
          <p class="sub">From your first block explorer to cross-chain laundering networks. Interactive models you can drag and replay, real-world case labs, a pattern-recognition dojo, and a final exam that certifies your skills.</p>
          <div class="typed" id="typed"></div>
          <div class="hero-cta">
            <button class="btn btn-p" id="ctaGo">▶ ${les ? 'Continue training' : 'Start training'}</button>
            <button class="btn btn-g" id="ctaLab">⚗ Open a case lab</button>
          </div>
        </div>
        <div class="hero-r" id="heroGraph"></div>
      </section>
      <div class="stats">
        <div class="glass stat spot"><span>Course progress</span><b data-count="${pct}">0</b><span>% complete</span>
          <svg class="ring" viewBox="0 0 64 64"><circle class="bgc" cx="32" cy="32" r="26"/><circle class="fgc" cx="32" cy="32" r="26" stroke-dasharray="163.4" stroke-dashoffset="163.4" data-off="${163.4 * (1 - pct / 100)}"/></svg></div>
        <div class="glass stat spot"><span>Lessons</span><b data-count="${les}">0</b><span>of ${LESSONS.length} completed</span><i>§</i></div>
        <div class="glass stat spot"><span>Cases solved</span><b data-count="${labs}">0</b><span>of ${LABS.length} labs</span><i>⚗</i></div>
        <div class="glass stat spot"><span>Dojo best</span><b data-count="${S.dojoBest}">0</b><span>points</span><i>★</i></div>
      </div>
      <h2 class="h2">Continue</h2>
      <div class="dash-grid">
        <div class="dash-l">
          <div class="glass continue spot" id="cont" style="cursor:pointer">
            <div class="play">▶</div>
            <div><div class="eyebrow" style="color:${next.mod.color}">MODULE ${next.mod.code} · ${esc(next.mod.title)}</div>
            <div style="font-size:22px;font-weight:800;margin:6px 0">${esc(next.title)}</div>
            <div style="color:var(--muted);font-size:13px">${next.mins} min · interactive lesson + quiz</div></div>
          </div>
          <div class="quick">
            <div class="glass qa spot tilt" style="--qc:#ff3dbb" data-q="dojo"><div class="qi">🥋</div><b>Pattern Dojo</b><span>Timed pattern-recognition drills with combos.</span></div>
            <div class="glass qa spot tilt" style="--qc:#38e1ff" data-q="board"><div class="qi">🕸</div><b>Investigation Board</b><span>Build and save your own trace graphs.</span></div>
            <div class="glass qa spot tilt" style="--qc:#2bff9e" data-q="exam"><div class="qi">🎓</div><b>Final Exam</b><span>Score 80% to earn your certificate.</span></div>
          </div>
        </div>
        <div class="glass radar" id="radar"></div>
      </div>
      <h2 class="h2">Curriculum</h2>
      <div class="mods">${COURSE.map(m => {
        const d = m.lessons.filter(l => S.done[l.id]).length;
        return `<div class="glass mod spot tilt" style="--mc:${m.color}" data-m="${m.id}">
          <div class="mod-code">${m.code}</div><div class="mod-ico">${m.code}</div>
          <h3>${esc(m.title)}</h3><p>${esc(m.tagline)}</p>
          <div class="mod-foot"><div class="mod-prog"><i style="width:${d / m.lessons.length * 100}%"></i></div>${d}/${m.lessons.length}</div></div>`;
      }).join('')}</div>`);
    $('#ctaGo', v).onclick = () => go('lesson', next.id);
    $('#cont', v).onclick = () => go('lesson', next.id);
    $('#ctaLab', v).onclick = () => go('labs');
    $$('.qa', v).forEach(q => q.onclick = () => go(q.dataset.q));
    $$('.mod', v).forEach(m => m.onclick = () => go('lesson', COURSE.find(x => x.id === m.dataset.m).lessons[0].id));
    const g = new GraphView($('#heroGraph', v), MODELS.layering, { compact: true });
    setTimeout(() => g.play(), 1600);
    // count-up + ring
    $$('[data-count]', v).forEach(b => {
      const tgt = +b.dataset.count, t0 = performance.now();
      const f = t => { const k = Math.min(1, (t - t0) / 1200); b.textContent = Math.round(tgt * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    setTimeout(() => $$('.fgc', v).forEach(c => c.style.strokeDashoffset = c.dataset.off), 200);
    typeLoop($('#typed', v), ['> trace peel chains across 400 hops', '> unmask drainer kit operators', '> match bridge legs across chains', '> identify pig-butchering networks', '> write reports that hold up in court']);
    radar($('#radar', v));
  }
  function typeLoop(el, arr) {
    let i = 0, j = 0, del = false;
    const t = () => {
      if (!el.isConnected) return;
      const s = arr[i]; el.textContent = s.slice(0, j);
      if (!del && j++ >= s.length) { del = true; return setTimeout(t, 1600); }
      if (del && j-- <= 0) { del = false; i = (i + 1) % arr.length; j = 0; }
      setTimeout(t, del ? 22 : 45);
    };
    t();
  }
  function radar(host) {
    const N = COURSE.length, cx = 170, cy = 165, R = 120;
    const pt = (i, r) => { const a = -Math.PI / 2 + i / N * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    const vals = COURSE.map(m => {
      const l = m.lessons.filter(x => S.done[x.id]).length / m.lessons.length;
      const qs = m.lessons.flatMap(x => (x.quiz || []).map((_, k) => S.quiz[x.id] && S.quiz[x.id][k] === x.quiz[k].c));
      const q = qs.length ? qs.filter(Boolean).length / qs.length : 0;
      return Math.max(0.04, (l * 0.6 + q * 0.4));
    });
    let grid = '';
    for (let k = 1; k <= 4; k++) grid += `<polygon points="${COURSE.map((_, i) => pt(i, R * k / 4).join(',')).join(' ')}" fill="none" stroke="rgba(120,150,255,.13)"/>`;
    const axes = COURSE.map((m, i) => { const [x, y] = pt(i, R); const [lx, ly] = pt(i, R + 22); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(120,150,255,.1)"/><text x="${lx}" y="${ly}" fill="${m.color}" font-size="11" font-weight="700" text-anchor="middle" dy="4" font-family="monospace">${m.code}</text>`; }).join('');
    const poly = vals.map((v, i) => pt(i, R * v).join(',')).join(' ');
    host.innerHTML = `<div class="wg-title" style="margin-bottom:0">SKILL MATRIX</div><svg viewBox="0 0 340 330">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38e1ff" stop-opacity=".55"/><stop offset="1" stop-color="#ff3dbb" stop-opacity=".35"/></linearGradient></defs>
      ${grid}${axes}<polygon points="${COURSE.map((_, i) => pt(i, 2).join(',')).join(' ')}" fill="url(#rg)" stroke="#38e1ff" stroke-width="2" style="filter:drop-shadow(0 0 8px #38e1ff)">
      <animate attributeName="points" to="${poly}" dur="1.2s" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1"/></polygon>
      ${vals.map((v, i) => { const [x, y] = pt(i, R * v); return `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" opacity="0"><animate attributeName="opacity" to="1" begin="1s" dur=".3s" fill="freeze"/></circle>`; }).join('')}</svg>`;
  }

  /* ================= COURSE ================= */
  function vCourse() { go('lesson', S.last || LESSONS[0].id); }
  function toc(cur) {
    return `<aside class="glass toc">${COURSE.map(m => `<div class="toc-mod ${m.lessons.some(l => l.id === cur) ? 'open' : ''}" style="--mc:${m.color}">
      <button><span>${m.code}</span>${esc(m.title)}</button>
      <div class="toc-les">${m.lessons.map(l => `<button data-l="${l.id}" class="${l.id === cur ? 'on' : ''}"><i class="dot ${S.done[l.id] ? 'done' : ''}"></i>${esc(l.title)}</button>`).join('')}</div></div>`).join('')}</aside>`;
  }
  function vLesson(id) {
    const L = lessonById(id) || LESSONS[0];
    S.last = L.id; save();
    const idx = LESSONS.indexOf(L), prev = LESSONS[idx - 1], next = LESSONS[idx + 1];
    const v = view(`<div class="lesson-wrap">${toc(L.id)}
      <article class="glass lesson">
        <div class="lesson-head"><span class="tag" style="color:${L.mod.color}">MODULE ${L.mod.code}</span><span>${esc(L.mod.title)}</span><span>·</span><span>⏱ ${L.mins} min</span>${S.done[L.id] ? '<span class="tag" style="color:var(--green)">✓ COMPLETED</span>' : ''}</div>
        <h1>${esc(L.title)}</h1>
        <div class="lesson-body">${L.body}</div>
        ${L.quiz ? `<div class="quiz"><h4>◆ KNOWLEDGE CHECK</h4>${L.quiz.map((q, qi) => `<div class="q" data-q="${qi}"><p>${qi + 1}. ${esc(q.q)}</p>
          <div class="opts">${q.a.map((a, ai) => `<button class="opt" data-a="${ai}" data-k="${'ABCD'[ai]}">${esc(a)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
        <div class="lesson-nav">
          ${prev ? `<button class="btn btn-g" data-go="${prev.id}">← ${esc(prev.title)}</button>` : '<span></span>'}
          <button class="btn btn-p" id="complete">${S.done[L.id] ? (next ? 'Next lesson →' : 'Back to dashboard') : (next ? 'Complete & continue →' : 'Complete course ✓')}</button>
        </div>
      </article></div>`);
    $$('.toc-mod > button', v).forEach(b => b.onclick = () => b.parentElement.classList.toggle('open'));
    $$('.toc-les button', v).forEach(b => b.onclick = () => go('lesson', b.dataset.l));
    $$('[data-go]', v).forEach(b => b.onclick = () => go('lesson', b.dataset.go));
    $$('.model', v).forEach(m => { const sc = MODELS[m.dataset.model]; if (sc) new GraphView(m, sc); });
    $$('.widget', v).forEach(w => WIDGETS[w.dataset.widget] && WIDGETS[w.dataset.widget](w));
    // quiz
    const answers = S.quiz[L.id] = S.quiz[L.id] || {};
    $$('.q', v).forEach(qe => {
      const qi = +qe.dataset.q, Q = L.quiz[qi];
      const show = (ai, ev, fresh) => {
        $$('.opt', qe).forEach((o, k) => { o.disabled = true; if (k === Q.c) o.classList.add('right'); if (k === ai && ai !== Q.c) o.classList.add('wrong'); });
        if (!$('.explain', qe)) qe.insertAdjacentHTML('beforeend', `<div class="explain">${ai === Q.c ? '<b style="color:var(--green)">Correct.</b> ' : '<b style="color:var(--red)">Not quite.</b> '}${esc(Q.x)}</div>`);
        if (fresh && ai === Q.c) addXP(20, 'correct answer', ev);
      };
      if (answers[qi] != null) show(answers[qi]);
      $$('.opt', qe).forEach(o => o.onclick = ev => { const ai = +o.dataset.a; answers[qi] = ai; save(); show(ai, ev, true); });
    });
    $('#complete', v).onclick = ev => {
      if (!S.done[L.id]) { S.done[L.id] = true; save(); addXP(100, 'lesson complete', ev); renderSide(); }
      setTimeout(() => next ? go('lesson', next.id) : (confetti(), go('dash')), 350);
    };
  }

  /* ================= LABS ================= */
  function vLabs() {
    const v = view(`<div class="eyebrow">// Hands-on investigations</div><h1 class="h1">Case <span class="g">Labs</span></h1>
      <p class="sub">Realistic (fictional) cases built from real-world typologies. Inspect nodes, drag the graph apart, and answer by clicking the right address.</p>
      <h2 class="h2">Open cases</h2>
      <div class="lab-grid">${LABS.map((l, i) => {
        const st = S.labs[l.id];
        return `<div class="glass labcard spot tilt" style="--lc:${l.color}" data-l="${l.id}">
          ${st && st.done ? '<div class="solved">✓ SOLVED</div>' : ''}
          <div class="case">CASE 0x0${i + 1}</div><h3>${esc(l.title)}</h3><p>${l.brief.replace(/<[^>]+>/g, '')}</p>
          <div class="meta"><span class="tag" style="color:${l.color}">${esc(l.chain)}</span><span class="tag" style="color:var(--muted)">${esc(l.level)}</span><span class="tag" style="color:var(--muted)">${l.tasks.length} tasks</span></div></div>`;
      }).join('')}</div>`);
    $$('.labcard', v).forEach(c => c.onclick = () => go('lab', c.dataset.l));
  }
  function vLab(id) {
    const L = LABS.find(l => l.id === id); if (!L) return vLabs();
    const st = S.labs[id] = S.labs[id] || { i: 0, done: false };
    const v = view(`<button class="btn btn-g" id="back" style="padding:8px 14px;font-size:12px">← All cases</button>
      <div style="display:flex;align-items:end;gap:16px;margin-top:18px"><div><div class="eyebrow" style="color:${L.color}">${esc(L.chain)} · ${esc(L.level)}</div><h1 class="h1" style="margin-bottom:0">${esc(L.title)}</h1></div></div>
      <div class="lab-wrap"><div id="labGraph"></div><div class="glass tasks" id="tasks"></div></div>`);
    $('#back', v).onclick = () => go('labs');
    const g = new GraphView($('#labGraph', v), L.scene);
    let selected = null;
    const renderTasks = () => {
      const T = $('#tasks', v);
      T.innerHTML = `<div class="brief"><b>BRIEFING —</b> ${L.brief}</div>` + L.tasks.map((t, i) => {
        const cls = i < st.i || st.done ? 'done' : i === st.i ? 'active' : '';
        if (i > st.i && !st.done) return `<div class="task" style="opacity:.4"><div class="tn">TASK ${i + 1} · LOCKED</div><div class="tq">🔒 Complete the previous task</div></div>`;
        let body = '';
        if (cls === 'active') {
          body = t.type === 'node'
            ? `<div class="sel">Selected: <b>${selected ? esc(selected.label) : '— click a node in the graph —'}</b></div>
               <button class="btn btn-p" id="submit" style="margin-top:10px;padding:9px 16px;font-size:13px" ${selected ? '' : 'disabled'}>Submit answer</button><div class="fb"></div>`
            : `<div class="opts">${t.a.map((a, k) => `<button class="opt" data-k="${'ABCD'[k]}" data-a="${k}">${esc(a)}</button>`).join('')}</div><div class="fb"></div>`;
        } else if (cls === 'done') body = `<div class="explain">${esc(t.x)}</div>`;
        return `<div class="task ${cls}"><div class="tn">TASK ${i + 1}${cls === 'done' ? ' · ✓ SOLVED' : ''}</div><div class="tq">${esc(t.q)}</div>${body}</div>`;
      }).join('') + (st.done ? `<div class="task done" style="text-align:center"><div style="font-size:30px">🏆</div><b>Case closed.</b><div style="color:var(--muted);font-size:13px;margin-top:6px">Great investigative work.</div>
        <button class="btn btn-g" id="nextCase" style="margin-top:12px;padding:9px 16px;font-size:13px">Next case →</button></div>` : '');
      const act = $('.task.active', T);
      if (act) act.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const sub = $('#submit', T);
      if (sub) sub.onclick = ev => check(L.tasks[st.i].answer.includes(selected.id), ev, selected.id);
      $$('.task.active .opt', T).forEach(o => o.onclick = ev => {
        const ok = +o.dataset.a === L.tasks[st.i].c;
        o.classList.add(ok ? 'right' : 'wrong');
        check(ok, ev);
      });
      const nc = $('#nextCase', T);
      if (nc) nc.onclick = () => { const k = LABS.indexOf(L); go('lab', LABS[(k + 1) % LABS.length].id); };
    };
    const check = (ok, ev, nodeId) => {
      const fb = $('.task.active .fb', v);
      if (ok) {
        if (nodeId) g.flash(nodeId, 'good');
        addXP(50, 'task solved', ev);
        st.i++; if (st.i >= L.tasks.length) { st.done = true; confetti(); renderSide(); }
        save(); selected = null; g.select(null);
        setTimeout(renderTasks, 500);
      } else {
        if (nodeId) g.flash(nodeId, 'bad');
        fb.innerHTML = `<div class="explain" style="border-color:var(--red)">Not this one. Inspect the node details (click it) and reconsider the heuristics from the course.</div>`;
      }
    };
    g.on('select', n => { if (st.done || !L.tasks[st.i] || L.tasks[st.i].type !== 'node') return; selected = n; renderTasks(); });
    renderTasks();
  }

  /* ================= DOJO ================= */
  let dojoTimer;
  function vDojo() {
    const v = view(`<div class="eyebrow">// Pattern recognition training</div><h1 class="h1">Pattern <span class="g">Dojo</span></h1>
      <p class="sub">Elite investigators recognise laundering and fraud patterns at a glance. Each round generates a fresh, randomised transaction graph. Identify the pattern before the clock runs out. Streaks multiply your score.</p>
      <div class="glass dojo-start spot" style="margin-top:28px"><div class="big">🥋</div><h2 style="font-size:30px">10 rounds · 20 seconds each</h2>
      <p style="color:var(--muted);margin:10px 0 24px">${DOJO.patterns.length} patterns in rotation · Personal best: <b style="color:var(--cyan)">${S.dojoBest}</b></p>
      <button class="btn btn-p" id="start">▶ Enter the Dojo</button>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:30px">${DOJO.patterns.map(p => `<span class="tag" style="color:var(--muted)">${p}</span>`).join('')}</div></div>`);
    $('#start', v).onclick = dojoGame;
  }
  function dojoGame() {
    let round = 0, score = 0, streak = 0, correct = 0, g;
    let bag = [];
    const v = view(`<div class="eyebrow">// Pattern Dojo</div>
      <div class="dojo-hud"><div class="glass hud"><span>ROUND</span><b id="dR">1/10</b></div><div class="glass hud"><span>SCORE</span><b id="dS">0</b></div>
      <div class="glass hud"><span>STREAK</span><b id="dK">0×</b></div><div class="glass hud"><span>BEST</span><b>${S.dojoBest}</b></div></div>
      <div class="timer"><i id="dT"></i></div><div id="dG"></div><div class="dojo-opts" id="dO"></div><div id="dX"></div>`);
    const next = () => {
      if (round >= 10) return end();
      if (!bag.length) bag = shuffle(DOJO.patterns);
      const ans = bag.pop();
      const scene = DOJO.generate(ans);
      $('#dG', v).innerHTML = '';
      g = new GraphView($('#dG', v), scene, { noInspector: true });
      const opts = shuffle([ans, ...shuffle(DOJO.patterns.filter(p => p !== ans)).slice(0, 3)]);
      $('#dO', v).innerHTML = opts.map((o, k) => `<button class="opt" data-k="${k + 1}">${o}</button>`).join('');
      $('#dX', v).innerHTML = '';
      $('#dR', v).textContent = `${round + 1}/10`;
      const t0 = Date.now(), T = 20000, bar = $('#dT', v);
      let answered = false;
      const answer = (pick, ev) => {
        if (answered) return; answered = true; clearInterval(dojoTimer);
        const left = Math.max(0, T - (Date.now() - t0)) / 1000;
        $$('#dO .opt', v).forEach(o => { o.disabled = true; if (o.textContent === ans) o.classList.add('right'); else if (o.textContent === pick) o.classList.add('wrong'); });
        if (pick === ans) {
          streak++; correct++;
          const pts = Math.round((100 + left * 10) * (1 + (streak - 1) * 0.25));
          score += pts;
          if (ev) burst(ev.clientX, ev.clientY);
          if (streak >= 2) { const c = document.createElement('div'); c.className = 'combo'; c.textContent = `${streak}× COMBO`; document.body.appendChild(c); setTimeout(() => c.remove(), 1000); }
        } else streak = 0;
        $('#dS', v).textContent = score; $('#dK', v).textContent = streak + '×';
        $('#dX', v).innerHTML = `<div class="explain" style="margin-top:14px">${pick === ans ? '<b style="color:var(--green)">Correct!</b>' : pick ? '<b style="color:var(--red)">Wrong.</b>' : '<b style="color:var(--amber)">Time\'s up.</b>'} <b>${ans}</b> — ${DOJO.hints[ans]}
          <div style="margin-top:10px"><button class="btn btn-p" id="dN" style="padding:8px 16px;font-size:13px">${round + 1 >= 10 ? 'See results' : 'Next round →'}</button></div></div>`;
        $('#dN', v).onclick = () => { round++; next(); };
      };
      $$('#dO .opt', v).forEach(o => o.onclick = ev => answer(o.textContent, ev));
      dojoKeys = e => { const k = +e.key; if (k >= 1 && k <= 4 && !answered) { const o = $$('#dO .opt', v)[k - 1]; if (o) answer(o.textContent); } else if (e.key === 'Enter' && answered) { const n = $('#dN', v); if (n) n.click(); } };
      clearInterval(dojoTimer);
      dojoTimer = setInterval(() => {
        const left = 1 - (Date.now() - t0) / T;
        bar.style.transform = `scaleX(${Math.max(0, left)})`;
        bar.style.background = left < .3 ? 'linear-gradient(90deg,#ff3d71,#ffb547)' : '';
        if (left <= 0) answer(null);
      }, 50);
    };
    const end = () => {
      clearInterval(dojoTimer); dojoKeys = null;
      const best = score > S.dojoBest; if (best) S.dojoBest = score; save();
      const xp = correct * 15;
      const r = view(`<div class="glass result spot" style="margin-top:40px"><div class="eyebrow">DOJO COMPLETE</div>
        <div class="score g">${score}</div><p style="color:var(--muted);margin:12px 0 26px">${correct}/10 patterns identified${best ? ' · <b style="color:var(--green)">NEW PERSONAL BEST</b>' : ''}</p>
        <button class="btn btn-p" id="again">↻ Train again</button> <button class="btn btn-g" id="home">Dashboard</button></div>`);
      if (xp) addXP(xp, 'dojo training');
      if (best) confetti();
      $('#again', r).onclick = dojoGame; $('#home', r).onclick = () => go('dash');
    };
    next();
  }
  let dojoKeys = null;
  addEventListener('keydown', e => { if (dojoKeys && curView === 'dojo' && !$('.cmdk-bg')) dojoKeys(e); });

  /* ================= BOARD (sandbox) ================= */
  function vBoard() {
    const types = Object.entries(GraphView.TYPES);
    const v = view(`<div class="eyebrow">// Free-form graphing</div><h1 class="h1">Investigation <span class="g">Board</span></h1>
      <p class="sub">Build your own money-flow graph like in professional tools. Add entities, link flows with amounts, drag to arrange, annotate. Autosaves locally.</p>
      <div class="board-wrap">
        <div class="glass palette">
          <h4>MODE</h4>
          <button class="pal on" data-mode="move"><i style="--c:#fff"></i>Select / move</button>
          <button class="pal" data-mode="link"><i style="--c:#38e1ff"></i>Link flow (A → B)</button>
          <h4>ADD ENTITY</h4>
          ${types.map(([k, t]) => `<button class="pal" data-type="${k}"><i style="--c:${t.color}"></i>${t.name}</button>`).join('')}
          <h4>ACTIONS</h4>
          <button class="pal" data-act="edit">✎ Edit selected</button>
          <button class="pal" data-act="del">🗑 Delete selected</button>
          <button class="pal" data-act="example">◈ Load example case</button>
          <button class="pal" data-act="export">⇩ Export JSON</button>
          <button class="pal" data-act="import">⇧ Import JSON</button>
          <button class="pal" data-act="clear">✕ Clear board</button>
          <input type="file" id="imp" accept=".json" style="display:none">
        </div>
        <div><div id="bG"></div><div class="board-tip" id="bTip"></div></div>
      </div>`);
    const blank = { title: 'My investigation', nodes: [], edges: [] };
    let data = S.board || blank;
    let g, mode = 'move', addType = null, linkFrom = null, sel = null, n = 0;
    const tip = $('#bTip', v);
    const setTip = () => {
      tip.innerHTML = addType ? `<b>Placing ${GraphView.TYPES[addType].name}:</b> click anywhere on the canvas.`
        : mode === 'link' ? (linkFrom ? `<b>Linking from ${esc(linkFrom.label)}:</b> now click the destination node.` : '<b>Link mode:</b> click the SOURCE node, then the DESTINATION.')
          : '<b>Tip:</b> pick an entity type to add · Link mode to draw flows · click a node then ✎ Edit to rename / add an address & notes · ⚛ Physics auto-arranges.';
    };
    const persist = () => {
      S.board = {
        title: 'My investigation',
        nodes: [...g.nodes.values()].map(x => ({ id: x.id, type: x.type, label: x.label, sub: x.sub, note: x.note, x: Math.round(x.x), y: Math.round(x.y) })),
        edges: g.edges.map(e => ({ from: e.from, to: e.to, label: e.label })),
      };
      save();
    };
    const mount = d => {
      $('#bG', v).innerHTML = '';
      g = new GraphView($('#bG', v), JSON.parse(JSON.stringify(d)));
      n = d.nodes.length;
      g.on('bgclick', async w => {
        if (!addType) return;
        const r = await ask('NEW ' + GraphView.TYPES[addType].name.toUpperCase(), [{ label: 'Label', value: GraphView.TYPES[addType].name }, { label: 'Address / detail (optional)', ph: 'bc1q… / 0x…' }]);
        if (r) {
          let id; do { id = 'n' + (++n); } while (g.nodes.has(id));
          const node = g.addNode({ id, type: addType, label: r[0], sub: r[1] || undefined, x: w.x, y: w.y });
          node.ox = node.x; node.oy = node.y; node.visible = true; node.g.classList.add('fresh');
          persist();
        }
        addType = null; $$('.pal', v).forEach(p => p.classList.toggle('on', p.dataset.mode === mode)); setTip();
      });
      g.on('select', async node => {
        sel = node;
        if (mode !== 'link' || !node) return;
        if (!linkFrom) { linkFrom = node; setTip(); return; }
        if (linkFrom.id !== node.id) {
          const r = await ask('NEW FLOW', [{ label: `Amount / label (${linkFrom.label} → ${node.label})`, ph: 'e.g. 2.5 BTC' }]);
          if (r) { g.addEdge({ from: linkFrom.id, to: node.id, label: r[0] || undefined }); persist(); }
        }
        linkFrom = null; g.select(null); setTip();
      });
      g.on('move', persist);
    };
    mount(data);
    setTip();
    $$('.pal', v).forEach(p => p.onclick = async () => {
      if (p.dataset.mode) { mode = p.dataset.mode; addType = null; linkFrom = null; }
      if (p.dataset.type) { addType = p.dataset.type; }
      $$('.pal', v).forEach(x => x.classList.toggle('on', x === p || (x.dataset.mode === mode && !p.dataset.act && !p.dataset.type)));
      const a = p.dataset.act;
      if (a) $$('.pal', v).forEach(x => x.classList.toggle('on', x.dataset.mode === mode));
      if (a === 'edit') {
        if (!sel) return toast('Select a node first');
        const r = await ask('EDIT NODE', [{ label: 'Label', value: sel.label }, { label: 'Address / detail', value: sel.sub || '' }, { label: 'Notes (shown in inspector)', value: sel.note || '' }]);
        if (r) { [sel.label, sel.sub, sel.note] = r; persist(); mount(S.board); }
      }
      if (a === 'del') { if (!sel) return toast('Select a node first'); g.removeNode(sel.id); g.select(null); sel = null; persist(); }
      if (a === 'clear') { mount(blank); persist(); }
      if (a === 'example') { mount(Object.assign({}, MODELS.pigbutcher, { steps: null, nodes: MODELS.pigbutcher.nodes.map(x => Object.assign({}, x, { step: undefined })), edges: MODELS.pigbutcher.edges.map(x => Object.assign({}, x, { step: undefined })) })); persist(); }
      if (a === 'export') {
        persist();
        const blob = new Blob([JSON.stringify(S.board, null, 2)], { type: 'application/json' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'chainsight-case.json'; link.click();
      }
      if (a === 'import') $('#imp', v).click();
      setTip();
    });
    $('#imp', v).onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        try { const d = JSON.parse(t); if (!Array.isArray(d.nodes) || !Array.isArray(d.edges)) throw 0; mount(d); persist(); toast('Case imported'); }
        catch { toast('Invalid case file'); }
      });
    };
  }

  /* ================= MODELS ================= */
  function vModels(id) {
    const keys = Object.keys(MODELS); id = id || keys[0];
    const v = view(`<div class="eyebrow">// Every model in the course</div><h1 class="h1">Model <span class="g">Gallery</span></h1>
      <p class="sub">Each model is a live, draggable simulation. Press ▶ to replay the narrative, ⚛ to let physics rearrange it, or ⛶ to go full-screen.</p>
      <div class="mg"><div class="glass mg-list">${keys.map(k => `<button data-k="${k}" class="${k === id ? 'on' : ''}">${esc(MODELS[k].title)}</button>`).join('')}</div><div id="mgG"></div></div>`);
    new GraphView($('#mgG', v), MODELS[id]);
    $$('.mg-list button', v).forEach(b => b.onclick = () => go('models', b.dataset.k));
  }

  /* ================= GLOSSARY ================= */
  function vGloss() {
    const v = view(`<div class="eyebrow">// Reference</div><h1 class="h1"><span class="g">Glossary</span></h1>
      <input class="inp" id="gq" placeholder="Filter ${GLOSSARY.length} terms…" style="max-width:520px;margin-top:10px"><div class="gl-grid" id="gl"></div>`);
    const draw = q => {
      const re = q ? new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig') : null;
      const hl = s => re ? esc(s).replace(re, '<mark>$1</mark>') : esc(s);
      $('#gl', v).innerHTML = GLOSSARY.filter(([t, d]) => !q || (t + d).toLowerCase().includes(q.toLowerCase()))
        .map(([t, d]) => `<div class="glass gl spot"><b>${hl(t)}</b><span>${hl(d)}</span></div>`).join('') || '<p style="color:var(--muted)">No matches.</p>';
    };
    $('#gq', v).oninput = e => draw(e.target.value.trim()); draw('');
    $('#gq', v).focus();
  }

  /* ================= EXAM ================= */
  function vExam() {
    const pool = LESSONS.flatMap(l => (l.quiz || []).map(q => Object.assign({ lesson: l.title }, q)));
    const v = view(`<div class="eyebrow">// Certification</div><h1 class="h1">Final <span class="g">Exam</span></h1>
      <p class="sub">20 questions drawn from the entire curriculum, options shuffled. Score <b>80%</b> or higher to earn your ChainSight Certified Crypto Investigator certificate.</p>
      <div class="glass exam spot" style="text-align:center"><div style="font-size:64px">🎓</div>
      <p style="color:var(--muted);margin:10px 0 24px">Question pool: ${pool.length} · Best score: <b style="color:var(--cyan)">${S.examBest}%</b>${S.examPassed ? ' · <b style="color:var(--green)">PASSED</b>' : ''}</p>
      <button class="btn btn-p" id="begin">Begin exam</button></div>`);
    $('#begin', v).onclick = () => runExam(shuffle(pool).slice(0, 20));
  }
  function runExam(qs) {
    let i = 0, right = 0;
    const v = view(`<div class="glass exam"><div class="exam-top"><div class="eyebrow">FINAL EXAM</div><b id="eN"></b></div><div class="exam-prog"><i id="eP"></i></div><div id="eQ"></div></div>`);
    const show = () => {
      if (i >= qs.length) return result();
      const Q = qs[i], order = shuffle(Q.a.map((a, k) => k));
      $('#eN', v).textContent = `${i + 1} / ${qs.length}`;
      $('#eP', v).style.width = (i / qs.length * 100) + '%';
      $('#eQ', v).innerHTML = `<div class="q lesson" style="padding:0"><p style="font-size:19px!important">${esc(Q.q)}</p>
        <div class="opts">${order.map((k, n) => `<button class="opt" data-a="${k}" data-k="${'ABCD'[n]}">${esc(Q.a[k])}</button>`).join('')}</div>
        <div class="eX"></div></div>`;
      $$('#eQ .opt', v).forEach(o => o.onclick = () => {
        const ok = +o.dataset.a === Q.c; if (ok) right++;
        $$('#eQ .opt', v).forEach(x => { x.disabled = true; if (+x.dataset.a === Q.c) x.classList.add('right'); });
        if (!ok) o.classList.add('wrong');
        $('.eX', v).innerHTML = `<div class="explain">${esc(Q.x)} <span style="color:var(--dim)">— from “${esc(Q.lesson)}”</span></div>
          <div style="text-align:right;margin-top:16px"><button class="btn btn-p" id="eNext">${i + 1 >= qs.length ? 'Finish' : 'Next →'}</button></div>`;
        $('#eNext', v).onclick = () => { i++; show(); };
      });
    };
    const result = () => {
      const pct = Math.round(right / qs.length * 100), pass = pct >= 80;
      const first = pass && !S.examPassed;
      S.examBest = Math.max(S.examBest, pct); if (pass) S.examPassed = true; save();
      const r = view(`<div class="glass result spot" style="margin-top:40px"><div class="eyebrow">${pass ? 'CERTIFICATION ACHIEVED' : 'NOT YET'}</div>
        <div class="score ${pass ? 'g' : ''}" style="${pass ? '' : 'color:var(--red)'}">${pct}%</div>
        <p style="color:var(--muted);margin:12px 0 26px">${right}/${qs.length} correct. ${pass ? 'Outstanding work, investigator.' : 'You need 80% to pass. Review the modules and try again.'}</p>
        ${pass ? '<button class="btn btn-p" id="toCert">🎓 View certificate</button>' : '<button class="btn btn-p" id="retry">↻ Retry exam</button>'} <button class="btn btn-g" id="home">Dashboard</button></div>`);
      if (pass) { confetti(); if (first) addXP(500, 'exam passed'); }
      if ($('#toCert', r)) $('#toCert', r).onclick = () => go('cert');
      if ($('#retry', r)) $('#retry', r).onclick = vExam;
      $('#home', r).onclick = () => go('dash');
      renderSide();
    };
    show();
  }

  /* ================= CERTIFICATE ================= */
  function vCert() {
    if (!S.examPassed) {
      const v = view(`<div class="glass result spot" style="margin-top:40px"><div style="font-size:64px">🔒</div><h2 style="margin:10px 0">Certificate locked</h2>
        <p style="color:var(--muted);margin-bottom:24px">Pass the Final Exam with 80% or more to unlock your certificate.</p><button class="btn btn-p" id="x">Go to Final Exam</button></div>`);
      $('#x', v).onclick = () => go('exam'); return;
    }
    const name = S.name || 'Your Name';
    const d = new Date().toISOString().slice(0, 10);
    const id = 'CSA-' + sha256(name + S.examBest + 'chainsight').slice(0, 10).toUpperCase();
    const v = view(`<div class="eyebrow">// Credential</div><h1 class="h1">Your <span class="g">Certificate</span></h1>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input class="inp" id="nm" value="${esc(S.name)}" placeholder="Enter your full name" style="max-width:340px;font-family:var(--font)">
      <button class="btn btn-p" id="pr">⎙ Print / Save as PDF</button></div>
      <div class="cert"><div class="c-eyebrow">CHAINSIGHT ACADEMY</div><h2 class="g">Certified Crypto Investigator</h2>
        <p>This certifies that</p><div class="c-name" id="cn">${esc(name)}</div>
        <p>has completed the ChainSight professional training program in blockchain investigation — covering transaction tracing, clustering heuristics, smart-contract forensics, laundering typologies, fraud pattern recognition, attribution and reporting — and passed the final examination with a score of <b style="color:#fff">${S.examBest}%</b>.</p>
        <div class="c-foot"><div><b>${d}</b>DATE</div><div><b>${id}</b>CREDENTIAL ID</div><div><b>${RANKS[rankOf(S.xp)][1]}</b>RANK</div></div>
        <div class="seal"><span>CERTIFIED</span></div></div>`);
    $('#nm', v).oninput = e => { S.name = e.target.value; save(); $('#cn', v).textContent = S.name || 'Your Name'; };
    $('#pr', v).onclick = () => print();
  }

  /* ================= COMMAND PALETTE ================= */
  function cmdk() {
    if ($('.cmdk-bg')) return;
    const items = [
      ...[['dash', 'Dashboard'], ['course', 'Course'], ['labs', 'Case Labs'], ['dojo', 'Pattern Dojo'], ['board', 'Investigation Board'], ['models', 'Model Gallery'], ['gloss', 'Glossary'], ['exam', 'Final Exam'], ['cert', 'Certificate']].map(([k, t]) => ({ t, k: 'page', f: () => go(k) })),
      ...LESSONS.map(l => ({ t: l.title, k: 'lesson ' + l.mod.code, f: () => go('lesson', l.id) })),
      ...LABS.map(l => ({ t: l.title, k: 'case lab', f: () => go('lab', l.id) })),
      ...Object.entries(MODELS).map(([k, m]) => ({ t: m.title, k: 'model', f: () => go('models', k) })),
      ...GLOSSARY.map(([t, d]) => ({ t: t + ' — ' + d, k: 'term', f: () => { go('gloss'); const i = $('#gq'); i.value = t; i.oninput({ target: i }); } })),
    ];
    const bg = document.createElement('div'); bg.className = 'cmdk-bg';
    bg.innerHTML = `<div class="cmdk"><input placeholder="Jump to a lesson, lab, model or term…"><div class="cmdk-res"></div></div>`;
    document.body.appendChild(bg);
    const inp = $('input', bg), res = $('.cmdk-res', bg);
    let list = [], on = 0;
    const draw = () => {
      const q = inp.value.toLowerCase().trim();
      list = items.filter(x => !q || x.t.toLowerCase().includes(q) || x.k.includes(q)).slice(0, 40);
      on = Math.min(on, list.length - 1); if (on < 0) on = 0;
      res.innerHTML = list.map((x, i) => `<button class="${i === on ? 'on' : ''}" data-i="${i}">${esc(x.t.length > 80 ? x.t.slice(0, 80) + '…' : x.t)}<small>${x.k}</small></button>`).join('') || '<div style="padding:14px;color:var(--muted)">No results</div>';
      const a = $('.on', res); if (a) a.scrollIntoView({ block: 'nearest' });
    };
    const close = () => bg.remove();
    const pick = i => { const x = list[i]; close(); if (x) x.f(); };
    inp.oninput = () => { on = 0; draw(); };
    inp.onkeydown = e => {
      if (e.key === 'ArrowDown') { on = Math.min(list.length - 1, on + 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { on = Math.max(0, on - 1); draw(); e.preventDefault(); }
      if (e.key === 'Enter') pick(on);
      if (e.key === 'Escape') close();
    };
    res.onclick = e => { const b = e.target.closest('[data-i]'); if (b) pick(+b.dataset.i); };
    bg.onclick = e => { if (e.target === bg) close(); };
    draw(); inp.focus();
  }
  $('#openCmd').onclick = cmdk;
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk(); }
    if (e.key === 'Escape') { const f = $('.gv-full'); if (f) f.classList.remove('gv-full'); }
  });

  /* ================= START ================= */
  renderSide();
  go('dash');
})();
