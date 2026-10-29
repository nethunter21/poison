/* ChainSight GraphView — interactive, draggable, animated money-flow graphs.
   Every model in the course, every lab and the sandbox board is rendered by this engine. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  const TYPES = {
    wallet:   { color: '#38e1ff', shape: 'circle', name: 'Wallet / EOA',
      icon: 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zM3 7l12-4v4M16 13.5h2' },
    suspect:  { color: '#ff3d71', shape: 'circle', name: 'Suspect',
      icon: 'M12 3a6 6 0 0 0-6 6v3l-2 8h16l-2-8V9a6 6 0 0 0-6-6zM9 12h6' },
    victim:   { color: '#ffb547', shape: 'circle', name: 'Victim',
      icon: 'M12 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 1 1 0-7zM5 20a7 7 0 0 1 14 0' },
    exchange: { color: '#2bff9e', shape: 'square', name: 'Exchange (VASP)',
      icon: 'M3 9l9-5 9 5M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18' },
    mixer:    { color: '#b06bff', shape: 'hex', name: 'Mixer / Privacy pool',
      icon: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M12 11a1 1 0 1 0 1 1' },
    contract: { color: '#5b8cff', shape: 'hex', name: 'Smart contract',
      icon: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12' },
    bridge:   { color: '#00e5c7', shape: 'hex', name: 'Cross-chain bridge',
      icon: 'M2 16h20M4 16c0-5 4-8 8-8s8 3 8 8M8 16v-5.5M16 16v-5.5M12 16V8' },
    defi:     { color: '#ff5fd2', shape: 'hex', name: 'DeFi protocol / DEX',
      icon: 'M12 3l6 8a6 6 0 1 1-12 0z' },
    otc:      { color: '#ff8a3d', shape: 'square', name: 'OTC desk / broker',
      icon: 'M12 3v18M16 7h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8' },
    service:  { color: '#9aa7c7', shape: 'square', name: 'Service',
      icon: 'M12 8a4 4 0 1 1 0 8 4 4 0 1 1 0-8zM12 2v3M12 19v3M2 12h3M19 12h3' },
    change:   { color: '#c6ff3d', shape: 'circle', name: 'Change output',
      icon: 'M4 12a8 8 0 1 0 3-6M4 3v5h5' },
    miner:    { color: '#ffd84d', shape: 'square', name: 'Miner / Validator',
      icon: 'M4 20l9-9M8 6c4-3 9-2 12 2-4-1-7 0-10 3' },
    tx:       { color: '#e6ecff', shape: 'diamond', name: 'Transaction', icon: '' },
    unknown:  { color: '#6b7699', shape: 'circle', name: 'Unknown',
      icon: 'M9 9a3 3 0 1 1 4 2.8c-.7.3-1 1-1 1.7V15M12 18.5v.5' },
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function shapePath(shape, r) {
    if (shape === 'square') {
      const s = r * 0.9, c = 9;
      return `M${-s + c},${-s}H${s - c}Q${s},${-s} ${s},${-s + c}V${s - c}Q${s},${s} ${s - c},${s}H${-s + c}Q${-s},${s} ${-s},${s - c}V${-s + c}Q${-s},${-s} ${-s + c},${-s}Z`;
    }
    if (shape === 'hex') {
      let d = '';
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i + Math.PI / 6;
        d += (i ? 'L' : 'M') + (Math.cos(a) * r * 1.05).toFixed(2) + ',' + (Math.sin(a) * r * 1.05).toFixed(2);
      }
      return d + 'Z';
    }
    if (shape === 'diamond') {
      const s = r * 0.85;
      return `M0,${-s}L${s},0L0,${s}L${-s},0Z`;
    }
    return `M${-r},0a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
  }

  let uid = 0;

  class GraphView {
    constructor(host, scene, opts = {}) {
      this.host = host;
      this.opts = opts;
      this.id = 'gv' + (++uid);
      this.view = { x: 0, y: 0, k: 1 };
      this.step = 0;
      this.playing = false;
      this.physics = false;
      this.particles = [];
      this.listeners = {};
      this.buildDom();
      this.load(scene);
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
      this.resizeObs = new ResizeObserver(() => this.fit(false));
      this.resizeObs.observe(this.stage);
    }

    on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); return this; }
    emit(evt, data) { (this.listeners[evt] || []).forEach(f => f(data)); }

    buildDom() {
      const o = this.opts;
      this.root = h('div', 'gv' + (o.compact ? ' gv-compact' : ''));
      const bar = h('div', 'gv-bar');
      bar.innerHTML = `
        <div class="gv-title"><span class="gv-dot"></span><span class="gv-title-text"></span></div>
        <div class="gv-tools">
          <button data-a="physics" title="Toggle force-directed auto layout">⚛ Physics</button>
          <button data-a="labels" title="Toggle amount labels">◫ Labels</button>
          <button data-a="fit" title="Fit to view">⤢ Fit</button>
          <button data-a="reset" title="Restore original layout">↺ Reset</button>
          <button data-a="full" title="Expand">⛶</button>
        </div>`;
      this.root.appendChild(bar);
      this.titleEl = bar.querySelector('.gv-title-text');
      bar.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'physics') { this.physics = !this.physics; b.classList.toggle('on', this.physics); }
        if (a === 'labels') { this.root.classList.toggle('gv-nolabels'); b.classList.toggle('on'); }
        if (a === 'fit') this.fit(true);
        if (a === 'reset') this.resetLayout();
        if (a === 'full') { this.root.classList.toggle('gv-full'); setTimeout(() => this.fit(true), 60); }
      });

      this.stage = h('div', 'gv-stage');
      this.root.appendChild(this.stage);
      this.svg = el('svg', { class: 'gv-svg' }, this.stage);
      const defs = el('defs', null, this.svg);
      defs.innerHTML = `
        <filter id="${this.id}-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="${this.id}-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4"/>
        </filter>
        <pattern id="${this.id}-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(120,150,255,0.07)" stroke-width="1"/>
        </pattern>`;
      this.bg = el('rect', { x: -5000, y: -5000, width: 10000, height: 10000, fill: `url(#${this.id}-grid)`, class: 'gv-bg' }, this.svg);
      this.world = el('g', { class: 'gv-world' }, this.svg);
      this.gEdges = el('g', null, this.world);
      this.gParticles = el('g', null, this.world);
      this.gNodes = el('g', null, this.world);

      this.hint = h('div', 'gv-hint', 'Drag nodes · scroll to zoom · drag background to pan · click a node to inspect');
      this.stage.appendChild(this.hint);

      this.inspector = h('div', 'gv-inspector');
      this.stage.appendChild(this.inspector);

      this.legend = h('div', 'gv-legend');
      this.stage.appendChild(this.legend);

      this.narr = h('div', 'gv-narr');
      this.narr.innerHTML = `
        <div class="gv-narr-ctrl">
          <button data-n="prev" title="Previous step">◀</button>
          <button data-n="play" class="gv-play" title="Play / pause">▶</button>
          <button data-n="next" title="Next step">▶▶</button>
        </div>
        <div class="gv-narr-body"><div class="gv-narr-step"></div><div class="gv-narr-text"></div></div>
        <div class="gv-narr-dots"></div>`;
      this.root.appendChild(this.narr);
      this.narr.addEventListener('click', e => {
        const b = e.target.closest('button'); if (b) {
          const n = b.dataset.n;
          if (n === 'prev') { this.stop(); this.go(this.step - 1); }
          if (n === 'next') { this.stop(); this.go(this.step + 1); }
          if (n === 'play') this.playing ? this.stop() : this.play();
        }
        const d = e.target.closest('.gv-d'); if (d) { this.stop(); this.go(+d.dataset.i); }
      });

      this.host.appendChild(this.root);
      this.bindPointer();
    }

    load(scene) {
      this.scene = scene;
      this.titleEl.textContent = scene.title || 'Transaction graph';
      this.nodes = new Map();
      this.edges = [];
      this.gNodes.innerHTML = ''; this.gEdges.innerHTML = ''; this.gParticles.innerHTML = '';
      this.particles = [];
      (scene.nodes || []).forEach(n => this.addNode(n, true));
      (scene.edges || []).forEach(e => this.addEdge(e, true));
      this.steps = scene.steps && scene.steps.length ? scene.steps : null;
      this.narr.style.display = this.steps ? '' : 'none';
      if (this.steps) {
        this.narr.querySelector('.gv-narr-dots').innerHTML =
          this.steps.map((_, i) => `<span class="gv-d" data-i="${i}"></span>`).join('');
      }
      this.renderLegend();
      this.go(0, true);
      requestAnimationFrame(() => this.fit(false));
    }

    renderLegend() {
      const used = [...new Set([...this.nodes.values()].map(n => n.type))];
      this.legend.innerHTML = used.map(t => {
        const T = TYPES[t] || TYPES.unknown;
        return `<span><i style="--c:${T.color}"></i>${T.name}</span>`;
      }).join('');
    }

    addNode(n, initial) {
      const T = TYPES[n.type] || TYPES.unknown;
      const node = Object.assign({ r: n.type === 'tx' ? 18 : 26, vx: 0, vy: 0 }, n);
      node.ox = node.x; node.oy = node.y;
      node.color = n.color || T.color;
      const g = el('g', { class: 'gv-node', 'data-id': n.id }, this.gNodes);
      g.style.setProperty('--c', node.color);
      el('path', { d: shapePath(T.shape, node.r + 9), class: 'gv-halo', filter: `url(#${this.id}-glow)` }, g);
      el('path', { d: shapePath(T.shape, node.r + 6), class: 'gv-pulse' }, g);
      el('path', { d: shapePath(T.shape, node.r), class: 'gv-body' }, g);
      if (n.type === 'tx') {
        el('text', { class: 'gv-txt', 'text-anchor': 'middle', dy: '4' }, g).textContent = 'TX';
      } else {
        const ic = el('path', { d: T.icon, class: 'gv-icon', transform: `translate(-12,-12)` }, g);
        if (n.type === 'unknown') ic.setAttribute('stroke-width', '2.2');
      }
      const lab = el('text', { class: 'gv-label', 'text-anchor': 'middle', y: node.r + 20 }, g);
      lab.textContent = n.label || n.id;
      if (n.sub) {
        el('text', { class: 'gv-sub', 'text-anchor': 'middle', y: node.r + 34 }, g).textContent = n.sub;
      }
      if (n.badge) {
        const bg = el('g', { class: 'gv-badge', transform: `translate(${node.r * 0.8},${-node.r * 0.8})` }, g);
        el('circle', { r: 10 }, bg);
        el('text', { 'text-anchor': 'middle', dy: '3.5' }, bg).textContent = n.badge;
      }
      node.g = g;
      this.nodes.set(n.id, node);
      if (!initial) { this.renderLegend(); this.updateVisibility(); }
      return node;
    }

    addEdge(e, initial) {
      const edge = Object.assign({}, e);
      const color = e.color || (this.nodes.get(e.from) || {}).color || '#38e1ff';
      edge.color = color;
      edge.g = el('g', { class: 'gv-edge' + (e.dashed ? ' dashed' : '') }, this.gEdges);
      edge.g.style.setProperty('--c', color);
      edge.glow = el('path', { class: 'gv-edge-glow', filter: `url(#${this.id}-soft)` }, edge.g);
      edge.path = el('path', { class: 'gv-edge-line' }, edge.g);
      edge.arrow = el('path', { class: 'gv-arrow', d: 'M0,0L-11,-5.5L-8,0L-11,5.5Z' }, edge.g);
      if (e.label) {
        edge.lg = el('g', { class: 'gv-elabel' }, edge.g);
        edge.lbg = el('rect', { rx: 6, ry: 6, height: 20 }, edge.lg);
        edge.lt = el('text', { 'text-anchor': 'middle', dy: '4' }, edge.lg);
        edge.lt.textContent = e.label;
      }
      // bend duplicates / reverse pairs so they don't overlap
      const twins = this.edges.filter(x => (x.from === e.from && x.to === e.to) || (x.from === e.to && x.to === e.from)).length;
      edge.bend = e.bend != null ? e.bend : (twins ? (twins % 2 ? 0.28 : -0.28) * Math.ceil(twins / 2) : 0.08);
      const count = e.flow === 0 ? 0 : (e.flow || 2);
      for (let i = 0; i < count; i++) {
        const p = el('circle', { r: 3.2, class: 'gv-particle' }, this.gParticles);
        p.style.setProperty('--c', color);
        this.particles.push({ edge, el: p, t: i / count, speed: 0.0045 + Math.random() * 0.002 });
      }
      this.edges.push(edge);
      if (!initial) this.updateVisibility();
      return edge;
    }

    removeNode(id) {
      const n = this.nodes.get(id); if (!n) return;
      n.g.remove(); this.nodes.delete(id);
      this.edges = this.edges.filter(e => {
        if (e.from === id || e.to === id) { e.g.remove(); return false; }
        return true;
      });
      this.particles = this.particles.filter(p => {
        if (!this.edges.includes(p.edge)) { p.el.remove(); return false; }
        return true;
      });
      this.renderLegend();
    }

    // ---------- steps / narration ----------
    go(i, silent) {
      if (!this.steps) { this.step = 0; this.updateVisibility(); return; }
      i = Math.max(0, Math.min(this.steps.length - 1, i));
      this.step = i;
      const s = this.steps[i];
      this.narr.querySelector('.gv-narr-step').textContent = `STEP ${i + 1} / ${this.steps.length}${s.title ? ' — ' + s.title : ''}`;
      const t = this.narr.querySelector('.gv-narr-text');
      t.classList.remove('in'); void t.offsetWidth; t.innerHTML = s.text; t.classList.add('in');
      this.narr.querySelectorAll('.gv-d').forEach((d, k) => {
        d.classList.toggle('on', k === i); d.classList.toggle('done', k < i);
      });
      this.updateVisibility();
      if (!silent) this.emit('step', i);
    }
    play() {
      if (!this.steps) return;
      this.playing = true;
      this.narr.querySelector('.gv-play').textContent = '❚❚';
      if (this.step >= this.steps.length - 1) this.go(0);
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.step >= this.steps.length - 1) return this.stop();
        this.go(this.step + 1);
      }, 3600);
    }
    stop() {
      this.playing = false; clearInterval(this.timer);
      const b = this.narr.querySelector('.gv-play'); if (b) b.textContent = '▶';
    }

    updateVisibility() {
      const s = this.steps ? this.step : Infinity;
      const focus = this.steps && this.steps[this.step] && this.steps[this.step].focus;
      this.nodes.forEach(n => {
        const vis = n.step == null || n.step <= s;
        n.visible = vis;
        n.g.classList.toggle('hidden', !vis);
        n.g.classList.toggle('focus', !!(focus && focus.includes(n.id)));
        n.g.classList.toggle('dim', !!(focus && focus.length && !focus.includes(n.id)));
        const fresh = this.steps && n.step === s && s > 0;
        n.g.classList.toggle('fresh', !!fresh);
      });
      this.edges.forEach(e => {
        const a = this.nodes.get(e.from), b = this.nodes.get(e.to);
        const vis = (e.step == null || e.step <= s) && a && b && a.visible && b.visible;
        e.visible = vis;
        e.g.classList.toggle('hidden', !vis);
        const hot = focus && focus.includes(e.from) && focus.includes(e.to);
        e.g.classList.toggle('hot', !!hot);
        e.g.classList.toggle('dim', !!(focus && focus.length && !hot));
      });
    }

    // ---------- geometry ----------
    edgeGeom(e) {
      const a = this.nodes.get(e.from), b = this.nodes.get(e.to);
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const cx = (a.x + b.x) / 2 + nx * L * e.bend, cy = (a.y + b.y) / 2 + ny * L * e.bend;
      // trim ends at node radius along the curve tangents
      const t0x = cx - a.x, t0y = cy - a.y, t0 = Math.hypot(t0x, t0y) || 1;
      const t1x = b.x - cx, t1y = b.y - cy, t1 = Math.hypot(t1x, t1y) || 1;
      const sx = a.x + t0x / t0 * (a.r + 6), sy = a.y + t0y / t0 * (a.r + 6);
      const ex = b.x - t1x / t1 * (b.r + 8), ey = b.y - t1y / t1 * (b.r + 8);
      return { sx, sy, cx, cy, ex, ey, ang: Math.atan2(t1y, t1x) };
    }

    render() {
      this.nodes.forEach(n => n.g.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`));
      this.edges.forEach(e => {
        if (!this.nodes.get(e.from) || !this.nodes.get(e.to)) return;
        const G = this.edgeGeom(e); e.G = G;
        const d = `M${G.sx.toFixed(1)},${G.sy.toFixed(1)}Q${G.cx.toFixed(1)},${G.cy.toFixed(1)} ${G.ex.toFixed(1)},${G.ey.toFixed(1)}`;
        e.path.setAttribute('d', d); e.glow.setAttribute('d', d);
        e.arrow.setAttribute('transform', `translate(${(G.ex).toFixed(1)},${(G.ey).toFixed(1)}) rotate(${(G.ang * 180 / Math.PI).toFixed(1)})`);
        if (e.lg) {
          const mx = 0.25 * G.sx + 0.5 * G.cx + 0.25 * G.ex, my = 0.25 * G.sy + 0.5 * G.cy + 0.25 * G.ey;
          const w = e.label.length * 6.6 + 14;
          e.lbg.setAttribute('width', w); e.lbg.setAttribute('x', -w / 2); e.lbg.setAttribute('y', -10);
          e.lg.setAttribute('transform', `translate(${mx.toFixed(1)},${my.toFixed(1)})`);
        }
      });
    }

    loop() {
      if (!this.root.isConnected) { this.destroy(); return; }
      if (this.physics) this.simulate();
      this.render();
      for (const p of this.particles) {
        const e = p.edge;
        if (!e.visible || !e.G) { p.el.style.display = 'none'; continue; }
        p.el.style.display = '';
        p.t += p.speed * (e.speed || 1); if (p.t > 1) p.t -= 1;
        const t = p.t, u = 1 - t, G = e.G;
        const x = u * u * G.sx + 2 * u * t * G.cx + t * t * G.ex;
        const y = u * u * G.sy + 2 * u * t * G.cy + t * t * G.ey;
        p.el.setAttribute('cx', x.toFixed(1)); p.el.setAttribute('cy', y.toFixed(1));
        p.el.setAttribute('opacity', (Math.sin(t * Math.PI) * 0.95 + 0.05).toFixed(2));
      }
      this.raf = requestAnimationFrame(this.loop);
    }

    simulate() {
      const ns = [...this.nodes.values()].filter(n => n.visible);
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i], b = ns[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random(); dy = Math.random(); d2 = 1; }
        const d = Math.sqrt(d2), f = Math.min(2400 / d2, 4);
        a.vx -= dx / d * f; a.vy -= dy / d * f; b.vx += dx / d * f; b.vy += dy / d * f;
      }
      this.edges.forEach(e => {
        if (!e.visible) return;
        const a = this.nodes.get(e.from), b = this.nodes.get(e.to);
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - 170) * 0.004;
        a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
      });
      let cx = 0, cy = 0; ns.forEach(n => { cx += n.x; cy += n.y; }); cx /= ns.length || 1; cy /= ns.length || 1;
      ns.forEach(n => {
        if (n === this.dragNode) { n.vx = n.vy = 0; return; }
        n.vx += (500 - cx) * 0.0008; n.vy += (300 - cy) * 0.0008;
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
      });
    }

    resetLayout() {
      this.physics = false;
      this.root.querySelector('[data-a=physics]').classList.remove('on');
      const start = performance.now();
      const from = [...this.nodes.values()].map(n => [n, n.x, n.y]);
      const anim = (t) => {
        const k = Math.min(1, (t - start) / 600), e = 1 - Math.pow(1 - k, 3);
        from.forEach(([n, x, y]) => { n.x = x + ((n.ox ?? x) - x) * e; n.y = y + ((n.oy ?? y) - y) * e; });
        if (k < 1) requestAnimationFrame(anim); else this.fit(true);
      };
      requestAnimationFrame(anim);
    }

    fit(animate) {
      const ns = [...this.nodes.values()];
      const W = this.stage.clientWidth, H = this.stage.clientHeight;
      if (!ns.length || !W || !H) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      ns.forEach(n => { x0 = Math.min(x0, n.x - 60); y0 = Math.min(y0, n.y - 50); x1 = Math.max(x1, n.x + 60); y1 = Math.max(y1, n.y + 70); });
      const k = Math.min(W / (x1 - x0), H / (y1 - y0), 1.35);
      const target = { k, x: W / 2 - (x0 + x1) / 2 * k, y: H / 2 - (y0 + y1) / 2 * k };
      if (!animate) { this.view = target; this.applyView(); return; }
      const s = Object.assign({}, this.view), t0 = performance.now();
      const anim = (t) => {
        const q = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - q, 3);
        this.view = { k: s.k + (target.k - s.k) * e, x: s.x + (target.x - s.x) * e, y: s.y + (target.y - s.y) * e };
        this.applyView(); if (q < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }
    applyView() {
      this.world.setAttribute('transform', `translate(${this.view.x},${this.view.y}) scale(${this.view.k})`);
      this.bg.setAttribute('transform', `translate(${this.view.x % (40 * this.view.k)},${this.view.y % (40 * this.view.k)}) scale(${this.view.k})`);
    }
    toWorld(cx, cy) {
      const r = this.svg.getBoundingClientRect();
      return { x: (cx - r.left - this.view.x) / this.view.k, y: (cy - r.top - this.view.y) / this.view.k };
    }

    bindPointer() {
      let mode = null, start = null, moved = false;
      this.svg.addEventListener('pointerdown', e => {
        const g = e.target.closest('.gv-node');
        this.svg.setPointerCapture(e.pointerId);
        moved = false;
        this.hint.classList.add('gone');
        if (g) {
          mode = 'node';
          this.dragNode = this.nodes.get(g.dataset.id);
          const w = this.toWorld(e.clientX, e.clientY);
          start = { dx: w.x - this.dragNode.x, dy: w.y - this.dragNode.y, cx: e.clientX, cy: e.clientY };
          g.classList.add('dragging');
        } else {
          mode = 'pan';
          start = { x: e.clientX - this.view.x, y: e.clientY - this.view.y, cx: e.clientX, cy: e.clientY };
          this.svg.classList.add('panning');
        }
      });
      this.svg.addEventListener('pointermove', e => {
        if (!mode) {
          const g = e.target.closest('.gv-node');
          this.svg.style.cursor = g ? 'grab' : '';
          return;
        }
        if (Math.hypot(e.clientX - start.cx, e.clientY - start.cy) > 4) moved = true;
        if (mode === 'node') {
          const w = this.toWorld(e.clientX, e.clientY);
          this.dragNode.x = w.x - start.dx; this.dragNode.y = w.y - start.dy;
        } else {
          this.view.x = e.clientX - start.x; this.view.y = e.clientY - start.y; this.applyView();
        }
      });
      const up = e => {
        if (mode === 'node') {
          this.dragNode.g.classList.remove('dragging');
          if (!moved) this.select(this.dragNode);
          else this.emit('move', this.dragNode);
          this.dragNode = null;
        } else if (mode === 'pan' && !moved) {
          this.select(null);
          this.emit('bgclick', this.toWorld(e.clientX, e.clientY));
        }
        this.svg.classList.remove('panning');
        mode = null;
      };
      this.svg.addEventListener('pointerup', up);
      this.svg.addEventListener('pointercancel', up);
      this.svg.addEventListener('wheel', e => {
        e.preventDefault();
        const r = this.svg.getBoundingClientRect();
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        const k2 = Math.max(0.25, Math.min(3.5, this.view.k * Math.exp(-e.deltaY * 0.0015)));
        this.view.x = mx - (mx - this.view.x) * (k2 / this.view.k);
        this.view.y = my - (my - this.view.y) * (k2 / this.view.k);
        this.view.k = k2; this.applyView();
      }, { passive: false });
    }

    select(n) {
      this.nodes.forEach(x => x.g.classList.remove('selected'));
      if (!n) { this.inspector.classList.remove('open'); this.emit('select', null); return; }
      n.g.classList.add('selected');
      const T = TYPES[n.type] || TYPES.unknown;
      const rows = Object.entries(n.info || {}).map(([k, v]) => `<div class="gv-kv"><span>${k}</span><b>${v}</b></div>`).join('');
      const ins = this.edges.filter(e => e.to === n.id && e.visible);
      const outs = this.edges.filter(e => e.from === n.id && e.visible);
      if (!this.opts.noInspector) {
        this.inspector.innerHTML = `
          <div class="gv-ins-head" style="--c:${n.color}"><i></i><div><b>${n.label || n.id}</b><small>${T.name}</small></div><button class="gv-x">✕</button></div>
          ${n.sub ? `<div class="gv-ins-addr">${n.sub}</div>` : ''}
          ${rows}
          <div class="gv-kv"><span>Inflows</span><b>${ins.length}</b></div>
          <div class="gv-kv"><span>Outflows</span><b>${outs.length}</b></div>
          ${n.note ? `<p class="gv-note">${n.note}</p>` : ''}`;
        this.inspector.classList.add('open');
        this.inspector.querySelector('.gv-x').onclick = () => this.select(null);
      }
      this.emit('select', n);
    }

    flash(id, cls) {
      const n = this.nodes.get(id); if (!n) return;
      n.g.classList.remove(cls); void n.g.getBBox(); n.g.classList.add(cls);
      setTimeout(() => n.g.classList.remove(cls), 1200);
    }

    destroy() {
      cancelAnimationFrame(this.raf); clearInterval(this.timer);
      if (this.resizeObs) this.resizeObs.disconnect();
    }
  }

  GraphView.TYPES = TYPES;
  window.GraphView = GraphView;
})();
