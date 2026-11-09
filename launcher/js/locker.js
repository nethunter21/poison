/* POISON CLIENT — Locker: cosmetics inventory/shop + 3D butterfly-knife showcase */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;
  const THREE = window.THREE;

  const none = (slot) => ({ id: 'none', name: 'None', rarity: 'Common', price: 0, slot });
  P.cosmeticSlots = [
    { id: 'knife', name: 'Knives', icon: '🦋', items: () => P.knifeSkins },
    { id: 'cape', name: 'Capes', icon: '🧣', items: () => P.capeDesigns },
    { id: 'wings', name: 'Wings', icon: '🪽', items: () => [none('wings'),
      { id: 'wings_neon', name: 'Ledger Wings', rarity: 'Epic', price: 600, color: '#c084fc' },
      { id: 'wings_gold', name: 'Golden Bull', rarity: 'Legendary', price: 1200, color: '#ffcc33' },
      { id: 'wings_toxic', name: 'Neurotoxic', rarity: 'Epic', price: 800, color: '#7cff00' },
      { id: 'wings_ice', name: 'Cold Storage', rarity: 'Epic', price: 800, color: '#7dd3fc' }] },
    { id: 'halo', name: 'Halos', icon: '😇', items: () => [none('halo'), { id: 'halo_gold', name: 'Satoshi Halo', rarity: 'Rare', price: 300, color: '#ffd23f' }] },
    { id: 'aura', name: 'Auras', icon: '✺', items: () => [none('aura'),
      { id: 'aura_fire', name: 'Liquidation Flames', rarity: 'Rare', price: 350, color: '#ff6a00' },
      { id: 'aura_ice', name: 'Frozen Assets', rarity: 'Rare', price: 350, color: '#60a5fa' },
      { id: 'aura_toxic', name: 'Gas Leak', rarity: 'Rare', price: 350, color: '#7cff00' },
      { id: 'aura_gold', name: 'Whale Aura', rarity: 'Legendary', price: 900, color: '#ffd23f' }] },
    { id: 'pet', name: 'Pets', icon: '🤖', items: () => [none('pet'), { id: 'pet_bot', name: 'Hash Bot', rarity: 'Epic', price: 450, color: '#00ff9d' }] },
  ];
  const RARITY = { Common: '#9aa0a6', Rare: '#3b82f6', Epic: '#a855f7', Legendary: '#ff8a00', Mythic: '#ff2e88', Exotic: '#ffd23f' };

  const owns = (it) => it.price === 0 || it.id === 'none' || P.state.wallet.owned.includes(it.id);

  P.renderLocker = function () {
    let slot = 'knife';
    const tabs = U.$('#lockerTabs'), grid = U.$('#lockerGrid');
    function drawTabs() {
      tabs.innerHTML = '';
      P.cosmeticSlots.forEach((s) => {
        const b = U.el('button', { type: 'button', class: 'chip' + (s.id === slot ? ' active' : ''), html: `<i>${s.icon}</i>${s.name}<em>${s.items().length}</em>` });
        b.addEventListener('click', () => { slot = s.id; drawTabs(); drawGrid(); P.sfx('click'); showcase.setMode(slot); });
        tabs.append(b);
      });
    }
    function drawGrid() {
      const s = P.cosmeticSlots.find((x) => x.id === slot);
      grid.innerHTML = '';
      s.items().forEach((it, i) => {
        const equipped = P.state.equipped[slot] === it.id;
        const col = RARITY[it.rarity] || '#999';
        const card = U.el('div', { class: 'item tilt' + (equipped ? ' equipped' : '') + (owns(it) ? '' : ' locked'), style: { '--r': col, animationDelay: i * 35 + 'ms' } });
        const art = U.el('div', { class: 'item-art' });
        if (slot === 'knife') art.style.background = knifeSwatch(it);
        else if (slot === 'cape' && it.id !== 'cape_none') {
          const tex = P.capeTexture(it.id);
          const c = tex.image; c.className = 'cape-canvas'; art.append(c);
        } else art.innerHTML = `<span style="color:${it.color || '#666'}">${s.icon}</span>`;
        card.append(art, U.el('div', { class: 'item-meta', html: `<b>${it.name}</b><span style="color:${col}">${it.rarity}</span>` }));
        const btn = U.el('button', { type: 'button', class: 'item-btn' });
        btn.textContent = equipped ? 'Equipped ✓' : owns(it) ? 'Equip' : `Buy · ${it.price} $PSN`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!owns(it)) {
            if (!P.spend(it.price, 'Bought ' + it.name)) return;
            P.state.wallet.owned.push(it.id);
            P.toast('Purchased ' + it.name, `-${it.price} $PSN · it's in your locker`, 'gold', '🛒');
            P.sfx('coin');
            P.fx && P.fx.confetti(e.clientX, e.clientY);
            P.unlock('shopper');
          }
          P.state.equipped[slot] = it.id;
          P.save();
          P.emit('equip', { slot, id: it.id });
          P.chain(`EQUIP ${slot}:${it.id}`);
          drawGrid();
        });
        card.addEventListener('click', () => { if (slot === 'knife') showcase.preview(it.id); describe(it); });
        card.append(btn);
        grid.append(card);
      });
      P.fx && P.fx.bindTilt(grid);
      const cur = s.items().find((x) => x.id === P.state.equipped[slot]) || s.items()[0];
      describe(cur);
    }
    function describe(it) {
      const d = U.$('#lockerDesc');
      d.innerHTML = `<b style="color:${RARITY[it.rarity]}">${it.rarity}</b><h3>${it.name}</h3><p>${it.desc || ({ cape: 'Animated cloth cape with emissive print.', wings: 'Additive neon wings, flap synced to the beat.', halo: 'Emissive halo that blooms in-game.', aura: 'Orbiting particle aura.', pet: 'Follows you around in third person.' }[slot] || 'Nothing equipped.')}</p>`;
    }
    function knifeSwatch(it) {
      const b = it.blade;
      if (b[0] === 'holo') return 'linear-gradient(135deg,#ff2e88,#ffd23f,#7cff00,#16c8ff,#a855f7)';
      if (b[0] === 'steel') return 'linear-gradient(135deg,#6d7078,#e8ebf0,#8a8e96)';
      return `linear-gradient(135deg, ${b[1]}, ${b[2] || '#000'} 70%, ${b[3] || '#000'})`;
    }
    drawTabs();
    drawGrid();
    P.on('equip', () => showcase.preview(P.state.equipped.knife));
  };

  /* ---------------- 3D showcase ---------------- */
  const showcase = (P.showcase = (function () {
    let renderer, scene, camera, knife, anim, ring, active = false, inited = false, host, rotY = 0.4, rotX = 0.15, dragging = false, auto = true, t0 = performance.now();
    function init(el) {
      if (inited) return;
      inited = true;
      host = el;
      const canvas = U.el('canvas', { class: 'showcase-canvas' });
      host.prepend(canvas);
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { host.classList.add('no-webgl'); return; }
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
      camera.position.set(0, 0.1, 6.6);
      const env = P.makeEnvMap(renderer);
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      const l1 = new THREE.PointLight(0xff2e88, 6, 12); l1.position.set(-2.5, 1.5, 2);
      const l2 = new THREE.PointLight(0x16c8ff, 5, 12); l2.position.set(2.5, -1, 2);
      const l3 = new THREE.DirectionalLight(0xffffff, 1.2); l3.position.set(0, 3, 4);
      scene.add(l1, l2, l3);
      knife = P.createKnife(env);
      anim = P.createKnifeAnimator();
      anim.setIdle('still');
      const pivot = new THREE.Group();
      pivot.add(knife.root);
      knife.root.position.y = -0.05;
      scene.add(pivot);
      scene.userData.pivot = pivot;
      ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.012, 8, 120), new THREE.MeshBasicMaterial({ color: 0xff8a00 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.45;
      scene.add(ring);
      knife.setSkin(P.state.equipped.knife);
      canvas.addEventListener('pointerdown', (e) => { dragging = true; auto = false; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => { if (!dragging) return; rotY += e.movementX * 0.01; rotX = U.clamp(rotX + e.movementY * 0.01, -1, 1); });
      canvas.addEventListener('pointerup', () => { dragging = false; });
      canvas.addEventListener('dblclick', () => { auto = true; });
      U.$$('[data-kanim]').forEach((b) => b.addEventListener('click', () => play(b.dataset.kanim)));
      new ResizeObserver(resize).observe(host);
      resize();
      requestAnimationFrame(loop);
    }
    function now() { return (performance.now() - t0) / 1000; }
    function play(name) {
      const t = now();
      P.sfx('click');
      P.unlock('flip');
      if (name.startsWith('idle_')) { anim.setIdle(name.slice(5)); anim.state.shot = null; anim.state.closed = false; return; }
      if (name === 'flip_open' && !anim.state.closed) { anim.play('flip_close', t, 1, () => anim.play('flip_open', now())); return; }
      if (name === 'flip_close' && anim.state.closed) { anim.play('flip_open', t, 1, () => anim.play('flip_close', now())); return; }
      if (anim.state.closed && name !== 'flip_open') { anim.play('flip_open', t, 1.3, () => anim.play(name, now())); return; }
      anim.play(name, t);
    }
    function resize() {
      if (!renderer) return;
      const r = host.getBoundingClientRect();
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }
    function loop() {
      requestAnimationFrame(loop);
      if (!active || !renderer) return;
      const t = now();
      if (auto) rotY += 0.006;
      const pv = scene.userData.pivot;
      pv.rotation.set(rotX, rotY, 0);
      pv.position.y = Math.sin(t * 1.2) * 0.06;
      P.applyKnifePose(knife, anim.sample(t));
      knife.tick(t);
      const beat = P.beat || 0;
      knife.inlayMat.emissiveIntensity = 2.4 + beat * 4;
      ring.scale.setScalar(1 + beat * 0.12);
      ring.material.color.set(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff8a00');
      renderer.render(scene, camera);
    }
    return {
      init,
      setActive(on) { active = on; if (on) resize(); },
      preview(id) { if (knife) knife.setSkin(id); },
      setMode(slot) { if (host) host.classList.toggle('dim', slot !== 'knife'); },
    };
  })());
})();
