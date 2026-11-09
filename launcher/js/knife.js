/* POISON CLIENT — Butterfly knife (balisong): geometry, skins, keyframe animator, chams shader.
 * The animator is a pure function of time, so the motion-blur renderer can evaluate it at
 * any sub-frame time and get a correctly smeared flip.
 */
(function () {
  'use strict';
  const P = window.Poison;
  const THREE = window.THREE;

  /* ---------------- skins ---------------- */
  P.knifeSkins = [
    { id: 'knife_genesis', name: 'Genesis', rarity: 'Common', price: 0, blade: ['steel'], handle: '#141418', inlay: '#ff8a00', desc: 'Block #0. Where it all started.' },
    { id: 'knife_fade', name: 'Gas Fee Fade', rarity: 'Legendary', price: 900, blade: ['fade', '#ff2e88', '#a855f7', '#ffd23f'], handle: '#1a0f1f', inlay: '#ff2e88', desc: 'Prices fade. So does this blade.' },
    { id: 'knife_sapphire', name: 'Satoshi Sapphire', rarity: 'Mythic', price: 1600, blade: ['swirl', '#0b2aff', '#16c8ff', '#020414'], handle: '#05070f', inlay: '#16c8ff', desc: 'Whitepaper-blue doppler swirl.' },
    { id: 'knife_bull', name: 'Bull Run', rarity: 'Epic', price: 700, blade: ['metal', '#ffcc33', '#b8860b'], handle: '#0c0c0c', inlay: '#ffcc33', desc: 'Number go up. Solid gold.' },
    { id: 'knife_bear', name: 'Bear Market Ruby', rarity: 'Epic', price: 650, blade: ['swirl', '#ff0033', '#ff6a3d', '#1a0003'], handle: '#120406', inlay: '#ff2244', desc: 'Red candles only.' },
    { id: 'knife_ledger', name: 'Cold Wallet', rarity: 'Rare', price: 400, blade: ['circuit', '#0a0a0c', '#00ff9d'], handle: '#09090b', inlay: '#00ff9d', desc: 'Air-gapped. Unhackable. Matte.' },
    { id: 'knife_poison', name: 'Neurotoxin', rarity: 'Rare', price: 350, blade: ['acid', '#7cff00', '#0f2a00'], handle: '#0b1405', inlay: '#7cff00', desc: 'Acid-etched. Handle with care.' },
    { id: 'knife_hash', name: 'Hash Rate', rarity: 'Epic', price: 800, blade: ['hex', '#00ff66', '#001a08'], handle: '#020a04', inlay: '#00ff66', desc: '0x00000000000000000005f3…' },
    { id: 'knife_moon', name: 'Moon Mission', rarity: 'Exotic', price: 4200, blade: ['holo'], handle: '#0a0a14', inlay: '#ffffff', desc: 'Holographic. Literally to the moon.' },
  ];

  function bladeTexture(def) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    const [kind, a, b, d] = def;
    const W = c.width, H = c.height;
    const noise = (amt) => {
      const img = g.getImageData(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * amt;
        img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
      }
      g.putImageData(img, 0, 0);
    };
    if (kind === 'steel') {
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, '#6d7078'); gr.addColorStop(0.5, '#e8ebf0'); gr.addColorStop(1, '#8a8e96');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.08;
      for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'; g.fillRect(0, Math.random() * H, W, 1); }
      g.globalAlpha = 1;
    } else if (kind === 'fade') {
      const gr = g.createLinearGradient(0, H, 0, 0);
      gr.addColorStop(0, d); gr.addColorStop(0.45, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      noise(10);
    } else if (kind === 'metal') {
      const gr = g.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, b); gr.addColorStop(0.5, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      noise(14);
    } else if (kind === 'swirl') {
      g.fillStyle = d; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = i % 2 ? a : b;
        g.globalAlpha = 0.25 + Math.random() * 0.4;
        g.lineWidth = 4 + Math.random() * 18;
        g.beginPath();
        let x = Math.random() * W, y = Math.random() * H;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 140; y += (Math.random() - 0.5) * 140; g.quadraticCurveTo(x + 40, y - 40, x, y); }
        g.stroke();
      }
      g.globalAlpha = 1;
      g.filter = 'blur(3px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    } else if (kind === 'circuit') {
      g.fillStyle = a; g.fillRect(0, 0, W, H);
      g.strokeStyle = b; g.lineWidth = 2; g.shadowColor = b; g.shadowBlur = 8;
      for (let i = 0; i < 40; i++) {
        let x = Math.round(Math.random() * 16) * 16, y = Math.round(Math.random() * 32) * 16;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { if (Math.random() > 0.5) x += (Math.random() > 0.5 ? 1 : -1) * 32; else y += (Math.random() > 0.5 ? 1 : -1) * 32; g.lineTo(x, y); }
        g.stroke();
        g.fillStyle = b; g.fillRect(x - 3, y - 3, 6, 6);
      }
    } else if (kind === 'acid') {
      g.fillStyle = b; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = a; g.globalAlpha = Math.random() * 0.6;
        g.beginPath(); g.arc(Math.random() * W, Math.random() * H, Math.random() * 18, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    } else if (kind === 'hex') {
      g.fillStyle = b; g.fillRect(0, 0, W, H);
      g.font = 'bold 16px monospace'; g.fillStyle = a; g.shadowColor = a; g.shadowBlur = 6;
      for (let y = 14; y < H; y += 18) {
        let s = '';
        for (let k = 0; k < 18; k++) s += '0123456789abcdef'[(Math.random() * 16) | 0];
        g.globalAlpha = 0.35 + Math.random() * 0.65;
        g.fillText(s, 2, y);
      }
      g.globalAlpha = 1;
    } else if (kind === 'holo') {
      for (let y = 0; y < H; y++) {
        g.fillStyle = `hsl(${(y / H) * 720}, 90%, 62%)`;
        g.fillRect(0, y, W, 1);
      }
      g.globalCompositeOperation = 'overlay';
      for (let i = 0; i < 60; i++) { g.fillStyle = `hsla(${Math.random() * 360},100%,70%,0.4)`; g.fillRect(Math.random() * W, Math.random() * H, 30, 2); }
      g.globalCompositeOperation = 'source-over';
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // ExtrudeGeometry UVs are in shape units; blade spans ~0.25 x 1.7
    t.repeat.set(1 / 0.26, 1 / 1.75);
    t.offset.set(0.5, 0.03);
    if ('colorSpace' in t) t.colorSpace = 'srgb'; else t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* ---------------- shared helpers ---------------- */
  P.makeEnvMap = function (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const scene = new THREE.Scene();
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#ffe2c2'); gr.addColorStop(0.35, '#ff6a00'); gr.addColorStop(0.55, '#3a0f40'); gr.addColorStop(1, '#050208');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
    scene.add(sky);
    const panel = (color, x, y, z, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); scene.add(m);
    };
    panel(0xffffff, 0, 7, 3, 6, 1.5);
    panel(0xff2e88, -8, 1, -2, 2, 6);
    panel(0x16c8ff, 8, 2, 1, 2, 5);
    const env = pmrem.fromScene(scene, 0.02).texture;
    pmrem.dispose();
    return env;
  };

  P.makeChamsMaterial = function (color = '#ff2e88', power = 2.0, thickness = 0.012) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uIntensity: { value: 1.4 }, uThick: { value: thickness }, uTime: { value: 0 } },
      vertexShader: `
        uniform float uThick; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          vec3 p = position + normal * uThick;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          vN = normalize(normalMatrix * normal); vV = -mv.xyz; vP = p;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uPower; uniform float uIntensity; uniform float uTime;
        varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
          float scan = 0.65 + 0.35 * sin(vP.y * 40.0 - uTime * 6.0);
          float a = clamp(f * uIntensity * scan + 0.06, 0.0, 1.0);
          gl_FragColor = vec4(uColor * (0.4 + 2.2 * f) * uIntensity, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
  };

  /* ---------------- geometry ---------------- */
  function bladeGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.085, -0.06);
    s.lineTo(0.085, -0.06);
    s.lineTo(0.09, 0.1);
    s.lineTo(0.075, 0.16);      // choil
    s.lineTo(0.11, 0.26);
    s.lineTo(0.115, 1.05);
    s.quadraticCurveTo(0.112, 1.42, -0.015, 1.68); // belly to tip
    s.lineTo(-0.07, 1.33);      // clip point
    s.quadraticCurveTo(-0.098, 1.25, -0.1, 1.1);
    s.lineTo(-0.1, 0.12);
    s.lineTo(-0.085, -0.06);
    const pin = new THREE.Path(); pin.absarc(-0.055, 0, 0.018, 0, Math.PI * 2, true); s.holes.push(pin);
    const pin2 = new THREE.Path(); pin2.absarc(0.055, 0, 0.018, 0, Math.PI * 2, true); s.holes.push(pin2);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 18 });
    g.translate(0, 0, -0.011);
    return g;
  }
  function handleGeometry() {
    const s = new THREE.Shape();
    const w = 0.068, L = 1.66, r = 0.045;
    // rounded rect from y=+0.09 down to y=-L, x in [-w, w]
    s.moveTo(-w, 0.09 - r);
    s.quadraticCurveTo(-w, 0.09, -w + r, 0.09);
    s.lineTo(w - r, 0.09);
    s.quadraticCurveTo(w, 0.09, w, 0.09 - r);
    s.lineTo(w, -L + r);
    s.quadraticCurveTo(w, -L, w - r, -L);
    s.lineTo(-w + r, -L);
    s.quadraticCurveTo(-w, -L, -w, -L + r);
    s.lineTo(-w, 0.09 - r);
    // skeletonized cut-outs
    for (let i = 0; i < 7; i++) {
      const y0 = -0.2 - i * 0.2;
      const h = new THREE.Path();
      h.moveTo(-0.022, y0); h.lineTo(0.022, y0); h.lineTo(0.022, y0 - 0.13); h.lineTo(-0.022, y0 - 0.13); h.lineTo(-0.022, y0);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -0.035);
    return g;
  }

  /* Build a knife. Returns { root, setSkin, setHandles(a,b), chams(meshes) } */
  P.createKnife = function (envMap) {
    const root = new THREE.Group();
    const body = new THREE.Group(); // animated transform
    root.add(body);

    const bladeGeo = bladeGeometry();
    const handleGeo = handleGeometry();
    const bladeMat = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.18, envMap, envMapIntensity: 1.4 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x141418, metalness: 0.6, roughness: 0.35, envMap, envMapIntensity: 0.9 });
    const inlayMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff8a00, emissiveIntensity: 2.6 });
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15, envMap });

    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    body.add(blade);

    const mkHandle = (x) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, 0);
      const h = new THREE.Mesh(handleGeo, handleMat);
      pivot.add(h);
      // glowing inlay strips on both faces
      for (const z of [0.0475, -0.0475]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 1.42, 0.004), inlayMat);
        strip.position.set(0, -0.86, z);
        pivot.add(strip);
      }
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 16), pinMat);
      pin.rotation.x = Math.PI / 2;
      pivot.add(pin);
      body.add(pivot);
      return { pivot, mesh: h };
    };
    const A = mkHandle(-0.07); // safe handle
    const B = mkHandle(0.07);  // bite handle
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.03), pinMat);
    latch.position.set(0, -1.6, 0.05);
    B.pivot.add(latch);

    // chams shells (self-only overlay)
    const chamsMat = P.makeChamsMaterial('#ffb347', 1.8, 0.012);
    const shells = [];
    for (const [geo, parent] of [[bladeGeo, body], [handleGeo, A.pivot], [handleGeo, B.pivot]]) {
      const sh = new THREE.Mesh(geo, chamsMat);
      sh.renderOrder = 10;
      sh.visible = false;
      parent.add(sh);
      shells.push(sh);
    }

    function setSkin(id) {
      const sk = P.knifeSkins.find((k) => k.id === id) || P.knifeSkins[0];
      if (bladeMat.map) bladeMat.map.dispose();
      bladeMat.map = bladeTexture(sk.blade);
      bladeMat.color.set(0xffffff);
      bladeMat.roughness = sk.blade[0] === 'circuit' ? 0.55 : sk.blade[0] === 'steel' ? 0.14 : 0.22;
      bladeMat.emissive.set(sk.blade[0] === 'circuit' || sk.blade[0] === 'hex' ? sk.blade[1] : '#000000');
      bladeMat.emissiveMap = sk.blade[0] === 'circuit' || sk.blade[0] === 'hex' ? bladeMat.map : null;
      bladeMat.emissiveIntensity = 0.9;
      bladeMat.needsUpdate = true;
      handleMat.color.set(sk.handle);
      inlayMat.emissive.set(sk.inlay);
      root.userData.skin = sk;
      root.userData.holo = sk.blade[0] === 'holo';
    }
    setSkin('knife_genesis');

    // a = safe handle closedness, b = bite handle closedness (0 open .. 1 closed)
    function setHandles(a, b) {
      A.pivot.rotation.z = -Math.PI * a;
      B.pivot.rotation.z = Math.PI * b;
    }

    function tick(t) {
      if (root.userData.holo && bladeMat.map) bladeMat.map.offset.y = (t * 0.15) % 1;
      chamsMat.uniforms.uTime.value = t;
    }

    return {
      root, body, setSkin, setHandles, tick, shells, chamsMat, inlayMat,
      setChams(on, color, power) {
        shells.forEach((s) => (s.visible = on));
        if (color) chamsMat.uniforms.uColor.value.set(color);
        if (power) chamsMat.uniforms.uPower.value = power;
      },
    };
  };

  /* ---------------- keyframe animations ----------------
   * fields: px py pz (offset), rx ry rz (radians), a b (handle closedness)
   * every key may omit fields -> carried from previous key.
   */
  const TAU = Math.PI * 2;
  const A = {
    idle_still: { dur: 2, loop: true, keys: [{ t: 0, a: 0, b: 0 }, { t: 2 }] },
    idle_chatter: {
      dur: 3.2, loop: true, keys: [
        { t: 0, a: 0, b: 0, rz: 0 }, { t: 1.6, b: 0 }, { t: 1.8, b: 0.38, rz: 0.08 }, { t: 1.95, b: 0.05, rz: 0 },
        { t: 2.1, b: 0.32, rz: 0.06 }, { t: 2.28, b: 0, rz: 0 }, { t: 3.2, b: 0 },
      ],
    },
    idle_twirl: { dur: 0.9, loop: true, ease: 'linear', keys: [{ t: 0, rz: 0, a: 0, b: 0 }, { t: 0.45, rz: -Math.PI, b: 0.12 }, { t: 0.9, rz: -TAU, b: 0 }] },
    idle_aerial: {
      dur: 3.4, loop: true, keys: [
        { t: 0, a: 0, b: 0, py: 0, rz: 0, rx: 0 }, { t: 1.5, py: 0 },
        { t: 1.75, py: 0.55, rz: -Math.PI, rx: 0.4, a: 0.7, b: 0.3 },
        { t: 2.05, py: 0.75, rz: -TAU, rx: 0, a: 0.2, b: 0.9 },
        { t: 2.35, py: 0.2, rz: -TAU - Math.PI, a: 0.6, b: 0.4 },
        { t: 2.6, py: 0, rz: -2 * TAU, a: 0, b: 0 }, { t: 3.4 },
      ],
    },
    flip_open: {
      dur: 1.05, keys: [
        { t: 0, a: 1, b: 1, rz: 0, ry: 0, rx: 0, px: 0, py: 0 },
        { t: 0.16, b: 0.55, rz: -0.9, ry: 0.5, py: 0.06 },
        { t: 0.3, b: 0.05, rz: -2.0, ry: 0.2 },
        { t: 0.46, a: 0.55, rz: -3.4, ry: -0.3, py: 0.1 },
        { t: 0.62, a: 0.0, b: 0.25, rz: -4.9, ry: 0 },
        { t: 0.8, b: 0.0, rz: -TAU, py: 0 },
        { t: 1.05, a: 0, b: 0, rz: -TAU },
      ],
    },
    flip_close: {
      dur: 0.9, keys: [
        { t: 0, a: 0, b: 0, rz: 0, ry: 0 }, { t: 0.2, b: 0.6, rz: 1.4, ry: 0.4 }, { t: 0.38, b: 1, rz: 2.8 },
        { t: 0.6, a: 0.6, rz: 4.4, ry: -0.2 }, { t: 0.8, a: 1, rz: TAU, ry: 0 }, { t: 0.9 },
      ],
    },
    inspect: {
      dur: 3.6, keys: [
        { t: 0, rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, a: 0, b: 0 },
        { t: 0.5, ry: 1.25, rz: 0.35, px: -0.1, py: 0.08, pz: 0.12 },
        { t: 1.4, ry: 1.45, rz: 0.25 },
        { t: 1.9, ry: -1.3, rz: -0.3, rx: 0.2 },
        { t: 2.6, ry: -1.45, rz: -0.2, b: 0.3 },
        { t: 2.85, b: 0, rz: -TAU - 0.2, ry: 0 },
        { t: 3.6, rx: 0, ry: 0, rz: -TAU, px: 0, py: 0, pz: 0 },
      ],
    },
    swing_slash: {
      dur: 0.42, keys: [
        { t: 0, rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 },
        { t: 0.08, rx: 0.35, ry: -0.3, rz: 0.6, px: 0.18, py: 0.12 },
        { t: 0.2, rx: -0.9, ry: 0.5, rz: -0.9, px: -0.22, py: -0.12, pz: -0.18 },
        { t: 0.42, rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0 },
      ],
    },
    swing_stab: {
      dur: 0.36, keys: [
        { t: 0, rx: 0, pz: 0, py: 0 }, { t: 0.08, rx: -0.4, pz: 0.12, py: 0.04 }, { t: 0.17, rx: -1.25, pz: -0.45, py: 0.08 }, { t: 0.36, rx: 0, pz: 0, py: 0 },
      ],
    },
    swing_spin: {
      dur: 0.55, keys: [
        { t: 0, rz: 0, rx: 0, pz: 0, b: 0 }, { t: 0.15, rz: -Math.PI, b: 0.4, pz: -0.1 }, { t: 0.3, rz: -TAU, rx: -0.8, pz: -0.35, b: 0 }, { t: 0.55, rz: -TAU, rx: 0, pz: 0 },
      ],
    },
  };
  P.knifeAnims = A;
  const FIELDS = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'a', 'b'];

  // pre-resolve carried fields
  for (const anim of Object.values(A)) {
    let prev = { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, a: 0, b: 0 };
    anim.keys = anim.keys.map((k) => (prev = { ...prev, ...k }));
  }

  function sampleAnim(anim, t) {
    if (anim.loop) t = ((t % anim.dur) + anim.dur) % anim.dur;
    else t = Math.max(0, Math.min(anim.dur, t));
    const ks = anim.keys;
    let i = 0;
    while (i < ks.length - 2 && t > ks[i + 1].t) i++;
    const k0 = ks[i], k1 = ks[i + 1] || k0;
    const span = k1.t - k0.t || 1;
    let u = Math.max(0, Math.min(1, (t - k0.t) / span));
    u = anim.ease === 'linear' ? u : P.util.ease.inOut(u);
    const out = {};
    for (const f of FIELDS) out[f] = k0[f] + (k1[f] - k0[f]) * u;
    return out;
  }

  /* Animator: a one-shot track layered over an idle loop, all evaluated from absolute time. */
  P.createKnifeAnimator = function () {
    const st = { idle: 'idle_chatter', shot: null, shotStart: 0, speed: 1, closed: false, after: null };
    return {
      state: st,
      setIdle(name) { st.idle = 'idle_' + name; },
      play(name, now, speed = 1, after = null) {
        st.shot = name; st.shotStart = now; st.speed = speed; st.after = after;
      },
      isBusy(now) { return !!st.shot && (now - st.shotStart) * st.speed < A[st.shot].dur; },
      sample(now) {
        if (st.shot) {
          const anim = A[st.shot];
          const local = (now - st.shotStart) * st.speed;
          if (local < anim.dur) {
            const s = sampleAnim(anim, local);
            if (st.closed && st.shot.startsWith('swing')) { s.a = 1; s.b = 1; }
            return s;
          }
          // finished: resolve once
          if (st.shot === 'flip_close') st.closed = true;
          if (st.shot === 'flip_open') st.closed = false;
          if (st.after) { const f = st.after; st.after = null; f(); }
          st.shot = null;
        }
        if (st.closed) return { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, a: 1, b: 1 };
        return sampleAnim(A[st.idle] || A.idle_still, now);
      },
    };
  };

  P.applyKnifePose = function (knife, s) {
    knife.body.position.set(s.px, s.py, s.pz);
    knife.body.rotation.set(s.rx, s.ry, s.rz);
    knife.setHandles(s.a, s.b);
  };
})();
