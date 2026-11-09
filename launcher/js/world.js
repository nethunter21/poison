/* POISON CLIENT — real-time 3D client preview + cinematic post-processing.
 *
 * Motion blur ("cinematic" mode) is true shutter accumulation: every displayed frame
 * renders the scene N times at sub-frame times spread across a virtual 1/30s shutter
 * and averages them in an HDR buffer — the same thing an offline renderer does.
 * Everything that moves (camera, knife flips, cape, coins, weather) is a pure function
 * of time, so each sub-frame is exact rather than a smeared screen-space guess.
 */
(function () {
  'use strict';
  const P = window.Poison;
  const U = P.util;
  const THREE = window.THREE;

  const SIZE = 72;              // terrain columns per side
  const HALF = SIZE / 2;
  const WATER = 4.6;
  const SHUTTER_BASE = 1 / 30;  // virtual frame time for the "film" shutter

  function heightRaw(x, z) {
    return 6.5 + 4 * Math.sin(x * 0.13) * Math.cos(z * 0.11) + 3 * Math.sin((x + z) * 0.07) + 1.5 * Math.sin(x * 0.31 + z * 0.27) + 1.2 * Math.cos(z * 0.23 - x * 0.05);
  }
  function heightAt(x, z) { return Math.max(1, Math.floor(heightRaw(x, z))); }
  // smooth "max-ish" ground under a point so the flight camera never pops
  function groundSmooth(x, z) {
    let m = 0;
    for (const [dx, dz] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]]) m = Math.max(m, heightRaw(x + dx, z + dz));
    return Math.max(m, WATER);
  }
  P.heightAt = heightAt;

  /* ---------------- shaders ---------------- */
  const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const shaders = {
    accum: { uniforms: { tDiffuse: { value: null }, uWeight: { value: 1 } }, fs: 'uniform sampler2D tDiffuse; uniform float uWeight; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb * uWeight, 1.0); }' },
    blend: { uniforms: { tCur: { value: null }, tPrev: { value: null }, uTrail: { value: 0.5 } }, fs: 'uniform sampler2D tCur, tPrev; uniform float uTrail; varying vec2 vUv; void main(){ vec3 c = texture2D(tCur, vUv).rgb; vec3 p = texture2D(tPrev, vUv).rgb; gl_FragColor = vec4(mix(c, p, uTrail), 1.0); }' },
    bright: { uniforms: { tDiffuse: { value: null }, uThr: { value: 0.7 } }, fs: 'uniform sampler2D tDiffuse; uniform float uThr; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = max(c.r, max(c.g, c.b)); float k = smoothstep(uThr, uThr + 0.4, l); gl_FragColor = vec4(c * k, 1.0); }' },
    blur: {
      uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 1 } },
      fs: `uniform sampler2D tDiffuse; uniform vec2 uDir, uRes; uniform float uRadius; varying vec2 vUv;
        void main(){
          vec2 o = uDir / uRes * uRadius;
          vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
          c += texture2D(tDiffuse, vUv + o * 1.3846).rgb * 0.3162162; c += texture2D(tDiffuse, vUv - o * 1.3846).rgb * 0.3162162;
          c += texture2D(tDiffuse, vUv + o * 3.2308).rgb * 0.0702703; c += texture2D(tDiffuse, vUv - o * 3.2308).rgb * 0.0702703;
          gl_FragColor = vec4(c, 1.0);
        }`,
    },
    composite: {
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
        uBloom: { value: 1 }, uChroma: { value: 0.5 }, uVignette: { value: 0.5 }, uGrain: { value: 0.05 }, uBars: { value: 0 },
        uSat: { value: 1.1 }, uContrast: { value: 1.05 }, uWarmth: { value: 0.1 }, uExposure: { value: 1 }, uTonemap: { value: 1 },
        uScan: { value: 0 }, uSharpen: { value: 0 }, uDamage: { value: 0 },
      },
      fs: `
        uniform sampler2D tScene, tBloom, tBloom2; uniform vec2 uRes; uniform float uTime, uBloom, uChroma, uVignette, uGrain, uBars, uSat, uContrast, uWarmth, uExposure, uTonemap, uScan, uSharpen, uDamage;
        varying vec2 vUv;
        float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
        void main(){
          vec2 uv = vUv; vec2 dir = uv - 0.5; float d = length(dir);
          vec2 off = dir * uChroma * 0.014 * d;
          vec3 col = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
          if (uSharpen > 0.0) {
            vec2 px = 1.0 / uRes;
            vec3 b = (texture2D(tScene, uv + vec2(px.x, 0.0)).rgb + texture2D(tScene, uv - vec2(px.x, 0.0)).rgb + texture2D(tScene, uv + vec2(0.0, px.y)).rgb + texture2D(tScene, uv - vec2(0.0, px.y)).rgb) * 0.25;
            col += (col - b) * uSharpen * 2.5;
          }
          col += (texture2D(tBloom, uv).rgb + texture2D(tBloom2, uv).rgb * 0.45) * uBloom;
          col *= uExposure;
          col = uTonemap > 0.5 ? aces(col) : clamp(col, 0.0, 1.0);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          col = (col - 0.5) * uContrast + 0.5;
          col += vec3(uWarmth * 0.05, uWarmth * 0.01, -uWarmth * 0.05);
          col *= 1.0 - uVignette * smoothstep(0.3, 0.95, d * 1.3);
          col = mix(col, vec3(0.8, 0.0, 0.1), uDamage * smoothstep(0.35, 0.8, d));
          col *= 1.0 - uScan * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.5708));
          col = pow(max(col, 0.0), vec3(1.0 / 2.2));
          col += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
          if (uv.y < uBars || uv.y > 1.0 - uBars) col *= 0.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    },
  };
  function mkMat(def, extra = {}) {
    const uniforms = {};
    for (const [k, v] of Object.entries(def.uniforms)) uniforms[k] = { value: v.value && v.value.clone ? v.value.clone() : v.value };
    return new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VS, fragmentShader: def.fs, depthTest: false, depthWrite: false, ...extra });
  }

  /* ---------------- procedural textures ---------------- */
  function voxelTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = 200 + Math.floor(Math.random() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(0.5, 0.5, 15, 15);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function coinTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 110, 10, 128, 128, 128);
    gr.addColorStop(0, '#fff3b0'); gr.addColorStop(0.6, '#ffb300'); gr.addColorStop(1, '#a35a00');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#7a3e00'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#5a2a00'; g.font = '900 150px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('P', 132, 140);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function faceTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#c99a72'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 32, 8); // hair
    g.fillStyle = '#ffffff'; g.fillRect(7, 14, 6, 4); g.fillRect(19, 14, 6, 4);
    g.fillStyle = '#ff8a00'; g.fillRect(10, 14, 3, 4); g.fillRect(22, 14, 3, 4);
    g.fillStyle = '#7a4a32'; g.fillRect(12, 23, 8, 2);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.encoding = THREE.sRGBEncoding;
    return t;
  }
  P.capeDesigns = [
    { id: 'cape_none', name: 'No Cape', rarity: 'Common', price: 0 },
    { id: 'cape_satoshi', name: 'Satoshi', rarity: 'Rare', price: 0, colors: ['#ff8a00', '#140800'], glyph: '₿' },
    { id: 'cape_eth', name: 'Ethereal', rarity: 'Epic', price: 500, colors: ['#8b5cf6', '#0b0620'], glyph: 'Ξ' },
    { id: 'cape_candle', name: 'Green Candles', rarity: 'Epic', price: 450, colors: ['#00ff88', '#03140a'], glyph: 'chart' },
    { id: 'cape_matrix', name: 'Mempool', rarity: 'Rare', price: 300, colors: ['#00ff66', '#000a03'], glyph: 'hex' },
    { id: 'cape_doge', name: 'Much Wow', rarity: 'Legendary', price: 690, colors: ['#ffcc33', '#2a1a00'], glyph: 'Ð' },
    { id: 'cape_poison', name: 'POISON Founder', rarity: 'Exotic', price: 2500, colors: ['#ff2e88', '#120010'], glyph: 'skull' },
  ];
  function capeTexture(id) {
    const d = P.capeDesigns.find((x) => x.id === id) || P.capeDesigns[1];
    const c = document.createElement('canvas');
    c.width = 128; c.height = 200;
    const g = c.getContext('2d');
    const [fg, bg] = d.colors || ['#ff8a00', '#000'];
    const gr = g.createLinearGradient(0, 0, 0, 200);
    gr.addColorStop(0, bg); gr.addColorStop(1, '#000');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 200);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(5, 5, 118, 190);
    g.fillStyle = fg; g.shadowColor = fg; g.shadowBlur = 16;
    if (d.glyph === 'chart') {
      let y = 150;
      for (let i = 0; i < 9; i++) {
        const up = Math.random() > 0.25, h = 10 + Math.random() * 30;
        g.fillStyle = up ? '#00ff88' : '#ff2244';
        g.fillRect(14 + i * 12, up ? y - h : y, 8, h);
        y += up ? -h * 0.6 : h * 0.4;
      }
    } else if (d.glyph === 'hex') {
      g.font = 'bold 12px monospace';
      for (let y = 20; y < 196; y += 13) g.fillText(Math.random().toString(16).slice(2, 16), 10, y);
    } else if (d.glyph === 'skull') {
      g.font = '900 34px system-ui'; g.textAlign = 'center';
      g.fillText('POISON', 64, 110);
      g.font = '900 60px system-ui'; g.fillText('☠', 64, 70);
    } else {
      g.font = '900 110px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(d.glyph || '◆', 64, 100);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  P.capeTexture = capeTexture;

  /* ---------------- world ---------------- */
  P.world = (function () {
    let renderer, scene, camera, container, canvas, active = false, inited = false;
    let rt = {}, mats = {}, quad, quadScene, quadCam;
    let knife, knifeAnim, hand, handChamsShell, viewModel;
    let player, playerKnife, playerKnifeAnim, cape, capeGeo, capeBase, wings, halo, aura, laser, pet, nametag, selfShells = [];
    let weather, coinRain, outline, outlineGlow, sun, sky, water, neonMat, coins = [];
    let lastT = 0, fps = 0, fpsAcc = 0, fpsFrames = 0, startTime = performance.now();
    const keys = new Set();
    const camHist = [];
    const manual = { pos: new THREE.Vector3(0, 18, 18), yaw: Math.PI, pitch: -0.2, tyaw: Math.PI, tpitch: -0.2, roll: 0, dist: 0 };
    let zoomCur = 1, fovCur = 92, f5 = false, lastSwap = 0, lastAutoFlip = 0, hitFlash = 0;
    const clicks = { l: [], r: [] };
    const stats = { fps: 0, pos: new THREE.Vector3(), yaw: 0, speed: 0, biome: 'Neon Plains' };

    function now() { return (performance.now() - startTime) / 1000; }

    function init(host) {
      if (inited) return;
      inited = true;
      container = host;
      canvas = U.el('canvas', { class: 'world-canvas' });
      container.prepend(canvas);
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
      } catch (e) {
        container.classList.add('no-webgl');
        P.toast('WebGL unavailable', 'The 3D preview needs WebGL.', 'error', '!');
        return;
      }
      renderer.outputEncoding = THREE.LinearEncoding;
      renderer.autoClear = false;
      const env = P.makeEnvMap(renderer);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x2a1030, 0.022);
      camera = new THREE.PerspectiveCamera(92, 16 / 9, 0.05, 400);
      scene.add(camera);

      buildSky();
      buildTerrain(env);
      buildProps(env);
      buildViewModel(env);
      buildPlayer(env);
      buildWeather();
      buildOutline();
      buildPost();
      bindInput();

      new ResizeObserver(resize).observe(container);
      resize();
      P.on('module', applySettings);
      P.on('equip', applyCosmetics);
      applySettings();
      applyCosmetics();
      requestAnimationFrame(loop);
    }

    /* ---------- scene building ---------- */
    const SKIES = {
      synthwave: ['#0b0221', '#ff2e88', '#1a0530', '#ffb347'],
      dusk: ['#1b2a52', '#ff8a3d', '#2b1a1a', '#ffd27a'],
      void: ['#000000', '#3a0066', '#000000', '#c084fc'],
      toxic: ['#001a0a', '#7cff00', '#021a05', '#e8ff7a'],
      ice: ['#0a1a3a', '#9be7ff', '#0c1830', '#ffffff'],
    };
    function buildSky() {
      sky = new THREE.Mesh(
        new THREE.SphereGeometry(300, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide, depthWrite: false, fog: false,
          uniforms: { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uDark: { value: 1 }, uTime: { value: 0 } },
          vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
          fragmentShader: `uniform vec3 uTop, uMid, uBot; uniform float uDark, uTime; varying vec3 vDir;
            float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
            void main(){
              float y = vDir.y;
              vec3 c = y > 0.0 ? mix(uMid, uTop, pow(clamp(y * 2.2, 0.0, 1.0), 0.6)) : mix(uMid, uBot, clamp(-y * 6.0, 0.0, 1.0));
              c *= 0.8 + 0.35 * exp(-abs(y) * 18.0);
              vec3 sp = floor(vDir * 220.0);
              float star = step(0.9975, h(sp)) * smoothstep(0.05, 0.4, y) * (0.6 + 0.4 * sin(uTime * 3.0 + h(sp) * 50.0));
              gl_FragColor = vec4(c * uDark + vec3(star) * 2.0, 1.0);
            }`,
        })
      );
      sky.renderOrder = -10;
      scene.add(sky);
      // striped synthwave sun (HDR so it blooms)
      sun = new THREE.Mesh(
        new THREE.CircleGeometry(38, 64),
        new THREE.ShaderMaterial({
          fog: false, transparent: true, depthWrite: false,
          uniforms: { uA: { value: new THREE.Color('#ffd23f') }, uB: { value: new THREE.Color('#ff2e88') }, uTime: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: `uniform vec3 uA, uB; uniform float uTime; varying vec2 vUv;
            void main(){
              vec3 c = mix(uB, uA, vUv.y) * 3.2;
              float band = step(0.5, fract(vUv.y * 14.0 - uTime * 0.25));
              float cut = vUv.y < 0.48 ? band : 1.0;
              gl_FragColor = vec4(c, cut);
              if (cut < 0.5) discard;
            }`,
        })
      );
      sun.position.set(0, 40, -250);
      scene.add(sun);
    }

    function buildTerrain(env) {
      const tex = voxelTexture();
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.0 });
      const list = [];
      const col = new THREE.Color();
      for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
        const wx = x - HALF, wz = z - HALF;
        const h = heightAt(wx, wz);
        const nmin = Math.min(heightAt(wx + 1, wz), heightAt(wx - 1, wz), heightAt(wx, wz + 1), heightAt(wx, wz - 1));
        const from = Math.max(0, Math.min(h, nmin) - 1);
        for (let y = from; y <= h; y++) {
          let c;
          if (y === h) c = h <= WATER + 0.5 ? '#d8c27a' : h > 11 ? '#e8eef5' : '#3fae55';
          else if (y < h - 2) c = Math.random() < 0.05 ? 'ore' : '#7a7d86';
          else c = '#7a5232';
          list.push([wx, y, wz, c]);
        }
      }
      // trees
      const trunks = [];
      for (let i = 0; i < 46; i++) {
        const wx = Math.floor(U.rand(-HALF + 3, HALF - 3)), wz = Math.floor(U.rand(-HALF + 3, HALF - 3));
        const h = heightAt(wx, wz);
        if (h <= WATER + 1 || h > 10) continue;
        const th = 3 + Math.floor(Math.random() * 2);
        for (let y = 1; y <= th; y++) list.push([wx, h + y, wz, '#5b3a1e']);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + dy > 4 || (dy === 0 && dx === 0 && dz === 0)) continue;
          if (Math.random() < 0.12) continue;
          list.push([wx + dx, h + th + dy, wz + dz, Math.random() < 0.06 ? 'blossom' : '#2f8f3a']);
        }
        trunks.push([wx, wz]);
      }
      const solid = list.filter((b) => b[3] !== 'ore' && b[3] !== 'blossom');
      const glow = list.filter((b) => b[3] === 'ore' || b[3] === 'blossom');
      const inst = new THREE.InstancedMesh(geo, mat, solid.length);
      const m4 = new THREE.Matrix4();
      solid.forEach((b, i) => {
        m4.makeTranslation(b[0], b[1], b[2]);
        inst.setMatrixAt(i, m4);
        col.set(b[3]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);
        inst.setColorAt(i, col);
      });
      scene.add(inst);
      // emissive "$PSN ore" + neon blossoms (HDR -> bloom)
      neonMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 2.2, 2.2) });
      const ginst = new THREE.InstancedMesh(geo, neonMat, Math.max(1, glow.length));
      glow.forEach((b, i) => {
        m4.makeTranslation(b[0], b[1], b[2]);
        ginst.setMatrixAt(i, m4);
        ginst.setColorAt(i, col.set(b[3] === 'ore' ? '#ffb300' : '#ff2e88'));
      });
      scene.add(ginst);
      water = new THREE.Mesh(
        new THREE.PlaneGeometry(SIZE * 3, SIZE * 3),
        new THREE.MeshStandardMaterial({ color: 0x1a4cff, transparent: true, opacity: 0.62, roughness: 0.05, metalness: 0.6, envMap: env, envMapIntensity: 1.5 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = WATER;
      scene.add(water);
      scene.add(new THREE.HemisphereLight(0xffd0f0, 0x301040, 0.9));
      const dl = new THREE.DirectionalLight(0xffe0c0, 1.3);
      dl.position.set(-30, 50, -40);
      scene.add(dl);
      scene.userData.dl = dl;
    }

    function buildProps(env) {
      // neon obelisks along the flight path
      const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.2, 0.2) });
      const neon2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.5, 4) });
      const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b10, metalness: 0.9, roughness: 0.3, envMap: env });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const x = Math.cos(a) * 26, z = Math.sin(a) * 26;
        const h = heightAt(Math.round(x), Math.round(z));
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 1.2), dark);
        body.position.y = 4.5;
        const s1 = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.18, 1.26), i % 2 ? neon : neon2);
        s1.position.y = 7.5;
        const s2 = s1.clone(); s2.position.y = 3;
        const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), i % 2 ? neon : neon2);
        tip.position.y = 10.2;
        g.add(body, s1, s2, tip);
        g.position.set(x, h + 0.5, z);
        g.userData.tip = tip;
        scene.add(g);
        coins.push({ obj: tip, base: 10.2, phase: i, kind: 'tip' });
      }
      // floating $PSN coins
      const coinMat = new THREE.MeshStandardMaterial({ map: coinTexture(), metalness: 0.85, roughness: 0.25, envMap: env, emissive: 0x332000 });
      const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffb300, metalness: 1, roughness: 0.2, envMap: env, emissive: 0x663300 });
      const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.18, 48);
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(coinGeo, [edgeMat, coinMat, coinMat]);
        c.rotation.x = Math.PI / 2;
        const a = (i / 9) * Math.PI * 2 + 0.3;
        const x = Math.cos(a) * 15, z = Math.sin(a) * 15;
        const holder = new THREE.Group();
        holder.add(c);
        holder.position.set(x, heightAt(Math.round(x), Math.round(z)) + 4.5, z);
        scene.add(holder);
        coins.push({ obj: holder, base: holder.position.y, phase: i * 1.7, kind: 'coin' });
      }
    }

    function buildViewModel(env) {
      viewModel = new THREE.Group();
      camera.add(viewModel);
      // blocky arm
      const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x15121a, roughness: 0.8 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.9 });
      hand = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), sleeveMat);
      arm.position.set(0, 0, 0.38);
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.2), skinMat);
      fist.position.set(0, 0, -0.12);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.235, 0.235, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0) }));
      cuff.position.set(0, 0, 0.0);
      hand.add(arm, fist, cuff);
      const chams = P.makeChamsMaterial('#ff2e88', 2.2, 0.02);
      handChamsShell = new THREE.Group();
      [arm, fist].forEach((m) => { const s = new THREE.Mesh(m.geometry, chams); s.position.copy(m.position); handChamsShell.add(s); });
      handChamsShell.userData.mat = chams;
      hand.add(handChamsShell);
      viewModel.add(hand);
      knife = P.createKnife(env);
      knife.root.scale.setScalar(0.3);
      knifeAnim = P.createKnifeAnimator();
      const holder = new THREE.Group();
      holder.position.set(0, 0.03, -0.14);
      holder.rotation.set(-0.28, -0.55, 0.32); // upright, flat of the blade angled toward the camera
      hand.add(holder);
      holder.add(knife.root);
      knife.root.position.y = 0.2; // grip sits in the fist, pivot pins just ahead of it
    }

    function boxPart(w, h, d, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      return m;
    }
    function buildPlayer(env) {
      player = new THREE.Group();
      const hoodie = new THREE.MeshStandardMaterial({ color: 0x17141c, roughness: 0.75 });
      const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0) });
      const pants = new THREE.MeshStandardMaterial({ color: 0x24242c, roughness: 0.8 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xc99a72 });
      const hair = new THREE.MeshStandardMaterial({ color: 0x1b1b1b });
      const faceMats = [skin, skin, hair, skin, hair, new THREE.MeshStandardMaterial({ map: faceTexture() })];
      // body pivot at feet; facing -Z
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), faceMats);
      head.position.set(0, 1.75, 0);
      const torso = boxPart(0.5, 0.75, 0.26, hoodie, 0, 1.125, 0);
      const stripe = boxPart(0.06, 0.75, 0.27, accent, 0, 1.125, 0);
      const mkLimb = (mat, x, y) => {
        const g = new THREE.Group(); g.position.set(x, y, 0);
        const m = boxPart(0.24, 0.75, 0.24, mat, 0, -0.375, 0); g.add(m); g.userData.mesh = m; return g;
      };
      const armL = mkLimb(hoodie, -0.37, 1.5), armR = mkLimb(hoodie, 0.37, 1.5);
      const legL = mkLimb(pants, -0.125, 0.75), legR = mkLimb(pants, 0.125, 0.75);
      player.add(head, torso, stripe, armL, armR, legL, legR);
      player.userData = { head, armL, armR, legL, legR };
      // knife in the player's right hand
      playerKnife = P.createKnife(env);
      playerKnife.root.scale.setScalar(0.3);
      playerKnife.root.position.set(0, -0.6, -0.08);
      playerKnife.root.rotation.set(-Math.PI / 2, 0, 0);
      armR.add(playerKnife.root);
      playerKnifeAnim = P.createKnifeAnimator();
      playerKnifeAnim.setIdle('twirl');
      // self chams shells
      const sc = P.makeChamsMaterial('#a855f7', 1.6, 0.035);
      [head, torso, armL.userData.mesh, armR.userData.mesh, legL.userData.mesh, legR.userData.mesh].forEach((m) => {
        const s = new THREE.Mesh(m.geometry, sc);
        s.position.copy(m.position); s.rotation.copy(m.rotation);
        m.parent.add(s);
        selfShells.push(s);
      });
      selfShells.mat = sc;
      // cape (segmented plane, animated in update)
      capeGeo = new THREE.PlaneGeometry(0.62, 1.0, 6, 12);
      capeGeo.translate(0, -0.5, 0);
      capeBase = capeGeo.attributes.position.array.slice();
      cape = new THREE.Mesh(capeGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.35 }));
      cape.position.set(0, 1.48, 0.15);
      player.add(cape);
      // wings
      wings = new THREE.Group();
      const ws = new THREE.Shape();
      ws.moveTo(0, 0); ws.bezierCurveTo(0.4, 0.5, 1.2, 0.9, 1.6, 0.7); ws.bezierCurveTo(1.3, 0.4, 1.4, 0.1, 1.1, -0.2);
      ws.bezierCurveTo(0.9, -0.1, 0.8, -0.4, 0.5, -0.5); ws.bezierCurveTo(0.4, -0.3, 0.2, -0.2, 0, 0);
      const wGeo = new THREE.ShapeGeometry(ws, 16);
      const wMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.4, 2.6), transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const wl = new THREE.Mesh(wGeo, wMat), wr = new THREE.Mesh(wGeo, wMat);
      wr.scale.x = -1;
      const pl = new THREE.Group(), pr = new THREE.Group();
      pl.add(wr); pr.add(wl);
      pl.position.set(-0.12, 1.35, 0.16); pr.position.set(0.12, 1.35, 0.16);
      wings.add(pl, pr);
      wings.userData = { pl, pr, mat: wMat };
      player.add(wings);
      // halo
      halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 12, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3, 1) }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 2.25;
      player.add(halo);
      // aura particles
      const ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
      aura = new THREE.Points(ag, new THREE.PointsMaterial({ color: new THREE.Color(3, 1.2, 0.2), size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      player.add(aura);
      // laser eyes
      laser = new THREE.Group();
      const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.2, 0.2), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const x of [-0.11, 0.11]) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 1, 8, 1, true), lm);
        beam.rotation.x = Math.PI / 2;
        beam.position.set(x, 1.79, -0.26 - 0.5);
        laser.add(beam);
      }
      laser.userData.mat = lm;
      player.add(laser);
      // pet: little floating coin-bot
      pet = new THREE.Group();
      const petBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3, envMap: env }));
      const petEye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 3, 1.2) }));
      petEye.position.set(0, 0.03, -0.18);
      const petProp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1, 0) }));
      petProp.position.y = 0.24;
      pet.add(petBody, petEye, petProp);
      pet.userData.prop = petProp;
      scene.add(pet);
      // nametag
      nametag = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      nametag.position.y = 2.6;
      nametag.scale.set(1.6, 0.4, 1);
      player.add(nametag);
      drawNametag();
      scene.add(player);
    }
    function drawNametag() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const g = c.getContext('2d');
      const color = P.mod('nametag').s.color || '#ff8a00';
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.beginPath(); g.roundRect ? g.roundRect(8, 24, 496, 80, 18) : g.rect(8, 24, 496, 80); g.fill();
      g.font = '800 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color;
      g.fillText('☠ ' + P.state.profile.name, 256, 66);
      const t = new THREE.CanvasTexture(c);
      if (nametag.material.map) nametag.material.map.dispose();
      nametag.material.map = t;
      nametag.material.needsUpdate = true;
    }

    function buildWeather() {
      const N = 1400;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const seeds = new Float32Array(N * 4);
      for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
      weather = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaad4ff, size: 0.08, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      weather.userData.seeds = seeds;
      weather.frustumCulled = false;
      scene.add(weather);
      const cg = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20);
      const cm = new THREE.MeshStandardMaterial({ color: 0xffc233, metalness: 1, roughness: 0.25, emissive: 0x6a3a00, envMap: P.makeEnvMap(renderer) });
      coinRain = new THREE.InstancedMesh(cg, cm, 160);
      coinRain.frustumCulled = false;
      coinRain.userData.seeds = Array.from({ length: 160 }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
      scene.add(coinRain);
    }

    function buildOutline() {
      const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
      outline = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: new THREE.Color(4, 1.4, 0), transparent: true }));
      outlineGlow = new THREE.Mesh(new THREE.BoxGeometry(1.04, 1.04, 1.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.2, 0), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(outline, outlineGlow);
    }

    function buildPost() {
      const hf = { type: THREE.HalfFloatType, depthBuffer: false };
      const isGL2 = renderer.capabilities.isWebGL2;
      rt.scene = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: isGL2 ? 2 : 0 });
      rt.accum = new THREE.WebGLRenderTarget(4, 4, hf);
      rt.histA = new THREE.WebGLRenderTarget(4, 4, hf);
      rt.histB = new THREE.WebGLRenderTarget(4, 4, hf);
      rt.b1 = new THREE.WebGLRenderTarget(4, 4, hf);
      rt.b2 = new THREE.WebGLRenderTarget(4, 4, hf);
      rt.q1 = new THREE.WebGLRenderTarget(4, 4, hf);
      rt.q2 = new THREE.WebGLRenderTarget(4, 4, hf);
      mats.accum = mkMat(shaders.accum, { transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation });
      mats.copy = mkMat(shaders.accum);
      mats.blend = mkMat(shaders.blend);
      mats.bright = mkMat(shaders.bright);
      mats.blur = mkMat(shaders.blur);
      mats.comp = mkMat(shaders.composite);
      quadScene = new THREE.Scene();
      quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mats.copy);
      quad.frustumCulled = false;
      quadScene.add(quad);
    }

    let W = 4, H = 4;
    function resize() {
      if (!renderer) return;
      const r = container.getBoundingClientRect();
      const q = P.mod('previewq').s.scale || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * q;
      W = Math.max(4, Math.floor(r.width * dpr));
      H = Math.max(4, Math.floor(r.height * dpr));
      renderer.setPixelRatio(1);
      renderer.setSize(W, H, false);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      for (const k of ['scene', 'accum', 'histA', 'histB']) rt[k].setSize(W, H);
      rt.b1.setSize(W >> 1, H >> 1); rt.b2.setSize(W >> 1, H >> 1);
      rt.q1.setSize(W >> 2, H >> 2); rt.q2.setSize(W >> 2, H >> 2);
    }

    /* ---------- settings / cosmetics ---------- */
    function applySettings(e) {
      if (!scene) return;
      if (e && e.id === 'previewq') resize();
      const fog = P.mod('fog');
      scene.fog.density = fog.on ? fog.s.density : 0.0;
      scene.fog.color.set(fog.s.color);
      const skyM = P.mod('sky');
      const pal = SKIES[skyM.on ? skyM.s.preset : 'dusk'] || SKIES.synthwave;
      sky.material.uniforms.uTop.value.set(pal[0]);
      sky.material.uniforms.uMid.value.set(pal[1]);
      sky.material.uniforms.uBot.value.set(pal[2]);
      sun.material.uniforms.uA.value.set(pal[3]);
      sun.material.uniforms.uB.value.set(pal[1]);
      const tc = P.mod('timechanger');
      const tod = tc.on ? tc.s.time : 0.75;
      const dark = 0.25 + 0.75 * Math.sin(Math.PI * U.clamp(tod, 0.02, 0.98));
      sky.material.uniforms.uDark.value = dark;
      sun.position.y = -20 + 90 * Math.sin(Math.PI * tod);
      scene.userData.dl.intensity = 0.3 + 1.1 * dark;
      const knifeOn = P.isOn('butterfly');
      knife.root.visible = knifeOn;
      knifeAnim.setIdle(P.mod('butterfly').s.idle);
      const oc = P.mod('outline');
      outline.material.color.set(oc.s.color).multiplyScalar(2.5 * oc.s.width);
      outlineGlow.material.color.set(oc.s.color).multiplyScalar(0.3 * oc.s.width);
      if (e && e.id === 'nametag') drawNametag();
      if (e && e.id === 'perspective' && e.key === undefined) setF5(P.isOn('perspective') && f5);
    }
    function applyCosmetics() {
      const eq = P.state.equipped;
      knife.setSkin(eq.knife);
      playerKnife.setSkin(eq.knife);
      const hasCape = eq.cape && eq.cape !== 'cape_none';
      if (hasCape) {
        if (cape.material.map) cape.material.map.dispose();
        cape.material.map = capeTexture(eq.cape);
        cape.material.emissiveMap = cape.material.map;
        cape.material.needsUpdate = true;
      }
      cape.userData.has = hasCape;
      const wingColors = { none: null, wings_neon: [1.6, 0.4, 2.6], wings_gold: [3, 1.8, 0.3], wings_toxic: [0.6, 3, 0.2], wings_ice: [0.6, 1.8, 3.2] };
      const wc = wingColors[eq.wings];
      wings.userData.has = !!wc;
      if (wc) wings.userData.mat.color.setRGB(...wc);
      halo.userData.has = eq.halo !== 'none';
      aura.userData.kind = eq.aura;
      pet.userData.has = eq.pet !== 'none';
    }
    function setF5(on) {
      f5 = on;
      if (on) P.unlock('f5');
    }

    /* ---------- input ---------- */
    function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable); }
    function bindInput() {
      window.addEventListener('keydown', (e) => {
        if (!active || typing() || P.clickgui.isOpen()) return;
        keys.add(e.code);
        P.emit('key', { code: e.code, down: true });
        if (e.repeat) return;
        if (e.code === 'KeyF') flip();
        if (e.code === 'KeyI') inspect();
        if (e.code === 'KeyV' && P.isOn('perspective')) setF5(!f5);
        if (/^Digit[1-9]$/.test(e.code)) hotbarSwap(parseInt(e.code.slice(5), 10));
      });
      window.addEventListener('keyup', (e) => { keys.delete(e.code); P.emit('key', { code: e.code, down: false }); });
      window.addEventListener('blur', () => keys.clear());
      canvas.addEventListener('mousedown', (e) => {
        if (!active) return;
        if (document.pointerLockElement !== canvas && !P.isOn('autopilot')) { canvas.requestPointerLock && canvas.requestPointerLock(); }
        const k = e.button === 2 ? 'r' : 'l';
        clicks[k].push(performance.now());
        P.state.stats.clicks++;
        P.emit('key', { code: k === 'l' ? 'LMB' : 'RMB', down: true });
        if (k === 'l') swing();
      });
      canvas.addEventListener('mouseup', (e) => P.emit('key', { code: e.button === 2 ? 'RMB' : 'LMB', down: false }));
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement !== canvas) return;
        manual.tyaw -= e.movementX * 0.0024;
        manual.tpitch = U.clamp(manual.tpitch - e.movementY * 0.0024, -1.5, 1.5);
      });
      canvas.addEventListener('wheel', (e) => {
        if (!keys.has('KeyC') || !P.mod('zoom').s.scroll) return;
        e.preventDefault();
        const z = P.mod('zoom');
        P.setModSetting('zoom', 'factor', U.clamp(z.s.factor + (e.deltaY < 0 ? 0.5 : -0.5), 2, 10));
      }, { passive: false });
    }
    function flip() {
      const t = now();
      if (!P.isOn('butterfly') || knifeAnim.isBusy(t)) return;
      const sp = P.mod('butterfly').s.speed;
      knifeAnim.play(knifeAnim.state.closed ? 'flip_open' : 'flip_close', t, sp);
      playerKnifeAnim.play('flip_close', t, sp, () => playerKnifeAnim.play('flip_open', now(), sp));
      P.unlock('flip');
    }
    function inspect() {
      const t = now();
      if (!P.isOn('inspect') || !P.isOn('butterfly') || knifeAnim.isBusy(t)) return;
      const sp = P.mod('inspect').s.speed;
      if (knifeAnim.state.closed) knifeAnim.play('flip_open', t, 1.2, () => knifeAnim.play('inspect', now(), sp));
      else knifeAnim.play('inspect', t, sp);
      P.unlock('flip');
    }
    function swing() {
      const t = now();
      const sw = P.mod('swing');
      if (knifeAnim.isBusy(t) && !knifeAnim.state.shot.startsWith('swing')) return;
      knifeAnim.play('swing_' + sw.s.style, t, sw.s.speed);
      playerKnifeAnim.play('swing_' + sw.s.style, t, sw.s.speed);
      hitFlash = 1;
      P.emit('swing');
    }
    function hotbarSwap() {
      const t = now();
      lastSwap = t;
      if (P.isOn('butterfly') && P.mod('butterfly').s.flipOnSwap && !knifeAnim.isBusy(t)) {
        knifeAnim.state.closed = true;
        knifeAnim.play('flip_open', t, P.mod('butterfly').s.speed * 1.2);
      }
    }

    /* ---------- camera state (pure function of time) ---------- */
    function autoPath(t) {
      const ap = P.mod('autopilot').s;
      const s = t * 0.075 * ap.speed;
      const R = 22;
      const x = Math.sin(s) * R * (1 + 0.25 * Math.sin(2 * s));
      const z = Math.sin(s) * Math.cos(s) * R * 1.4;
      const ds = 0.002;
      const x2 = Math.sin(s + ds) * R * (1 + 0.25 * Math.sin(2 * (s + ds)));
      const z2 = Math.sin(s + ds) * Math.cos(s + ds) * R * 1.4;
      const y = groundSmooth(x, z) + 5.2 + Math.sin(t * 0.5) * 0.8;
      let yaw = Math.atan2(-(x2 - x), -(z2 - z));
      // PvP-style flick turns: smooth steps every few seconds (where motion blur shines)
      const turn = ap.turn;
      const flickPeriod = 4.2;
      const k = Math.floor(t / flickPeriod), f = (t / flickPeriod) - k;
      const flickAmt = [1.9, -2.4, 1.2, -1.6, 2.8, -0.9][((k % 6) + 6) % 6];
      const step = U.ease.inOut(U.clamp((f - 0.55) / 0.12, 0, 1)) - U.ease.inOut(U.clamp((f - 0.8) / 0.18, 0, 1));
      yaw += (step * flickAmt + Math.sin(t * 1.3) * 0.25) * turn;
      const pitch = -0.18 + Math.sin(t * 0.7) * 0.08 * turn - step * 0.12 * turn;
      const yawRate = (Math.cos(t * 1.3) * 0.32) * turn;
      return { pos: new THREE.Vector3(x, y, z), yaw, pitch, roll: -yawRate * 0.05 * (P.isOn('tilt') ? 1 : 0), walk: s * 60, moving: 1 };
    }
    function camAt(t) {
      if (P.isOn('autopilot')) return autoPath(t);
      if (!camHist.length) return { pos: manual.pos.clone(), yaw: manual.yaw, pitch: manual.pitch, roll: 0, walk: 0, moving: 0 };
      // interpolate inside recorded history (oldest -> newest)
      let i = camHist.length - 1;
      while (i > 0 && camHist[i - 1].t > t) i--;
      const b = camHist[i], a = camHist[Math.max(0, i - 1)];
      if (t >= b.t || a === b) return b;
      const u = U.clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
      return { pos: a.pos.clone().lerp(b.pos, u), yaw: U.lerp(a.yaw, b.yaw, u), pitch: U.lerp(a.pitch, b.pitch, u), roll: U.lerp(a.roll, b.roll, u), walk: U.lerp(a.walk, b.walk, u), moving: b.moving };
    }
    function stepManual(t, dt) {
      if (P.isOn('autopilot')) { camHist.length = 0; return; }
      const cine = P.mod('cinecam');
      const k = cine.on ? 1 - cine.s.smooth : 1;
      manual.yaw = U.lerp(manual.yaw, manual.tyaw, k);
      manual.pitch = U.lerp(manual.pitch, manual.tpitch, k);
      const fwd = new THREE.Vector3(-Math.sin(manual.yaw), 0, -Math.cos(manual.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const v = new THREE.Vector3();
      if (keys.has('KeyW')) v.add(fwd);
      if (keys.has('KeyS')) v.sub(fwd);
      if (keys.has('KeyD')) v.add(right);
      if (keys.has('KeyA')) v.sub(right);
      if (keys.has('Space')) v.y += 1;
      if (keys.has('ShiftLeft')) v.y -= 1;
      const sp = keys.has('ControlLeft') ? 14 : 7.5;
      if (v.lengthSq()) v.normalize().multiplyScalar(sp * dt);
      manual.pos.add(v);
      manual.pos.x = U.clamp(manual.pos.x, -HALF, HALF);
      manual.pos.z = U.clamp(manual.pos.z, -HALF, HALF);
      manual.pos.y = U.clamp(manual.pos.y, heightAt(Math.round(manual.pos.x), Math.round(manual.pos.z)) + 2.2, 60);
      const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
      manual.roll = U.lerp(manual.roll, P.isOn('tilt') ? -strafe * THREE.MathUtils.degToRad(P.mod('tilt').s.amount) : 0, 0.12);
      manual.dist += v.length();
      camHist.push({ t, pos: manual.pos.clone(), yaw: manual.yaw, pitch: manual.pitch, roll: manual.roll, walk: manual.dist * 6, moving: v.lengthSq() > 0 ? 1 : 0 });
      while (camHist.length > 2 && camHist[0].t < t - 0.25) camHist.shift();
    }

    /* ---------- per-sample scene update (deterministic in t) ---------- */
    const tmpV = new THREE.Vector3();
    const eul = new THREE.Euler(0, 0, 0, 'YXZ');
    function updateScene(t, beat) {
      const c = camAt(t);
      const prev = camAt(t - 0.03);
      const yawRate = (c.yaw - prev.yaw) / 0.03;
      stats.pos.copy(c.pos); stats.yaw = c.yaw;
      stats.speed = c.pos.distanceTo(prev.pos) / 0.03;

      // player body follows camera "head"
      player.visible = f5;
      player.position.set(c.pos.x, c.pos.y - 1.62, c.pos.z);
      player.rotation.y = c.yaw;
      const ud = player.userData;
      ud.head.rotation.x = -c.pitch * 0.6;
      const sw = Math.sin(c.walk * 0.25) * 0.7 * (c.moving ? 1 : 0.1);
      ud.legL.rotation.x = sw; ud.legR.rotation.x = -sw;
      ud.armL.rotation.x = -sw * 0.8;
      ud.armR.rotation.x = -0.5 + sw * 0.3;

      if (f5) {
        const dist = P.mod('perspective').s.dist;
        eul.set(c.pitch - 0.15, c.yaw, 0);
        tmpV.set(0, 0.4, dist).applyEuler(eul);
        camera.position.copy(c.pos).add(tmpV);
        camera.rotation.set(c.pitch - 0.15, c.yaw, 0, 'YXZ');
      } else {
        camera.position.copy(c.pos);
        const vb = P.isOn('viewbob') ? P.mod('viewbob').s.amount : 0;
        camera.position.y += Math.abs(Math.sin(c.walk * 0.25)) * 0.06 * vb * c.moving;
        camera.rotation.set(c.pitch, c.yaw, c.roll, 'YXZ');
      }
      viewModel.visible = !f5;

      // FOV + zoom
      const zoomHeld = keys.has('KeyC') && P.isOn('zoom') && active;
      const zf = zoomHeld ? P.mod('zoom').s.factor : 1;
      zoomCur = P.mod('zoom').s.smooth ? U.lerp(zoomCur, zf, 0.18) : zf;
      fovCur = P.isOn('fov') ? P.mod('fov').s.fov : 80;
      // game FOV is vertical-ish; scale down a bit for wide launcher previews
      camera.fov = U.clamp((fovCur * 0.82) / zoomCur, 5, 120);
      camera.updateProjectionMatrix();

      // view model: item position + sway + bob
      const ip = P.mod('itempos');
      const ipOn = ip.on;
      const sway = P.isOn('itembob') ? P.mod('itembob').s.amount : 0;
      const bob = P.isOn('viewbob') ? P.mod('viewbob').s.amount : 0;
      hand.position.set(
        0.38 + (ipOn ? ip.s.x : 0) + Math.cos(c.walk * 0.125) * 0.02 * bob * c.moving - U.clamp(yawRate, -4, 4) * 0.025 * sway,
        -0.36 + (ipOn ? ip.s.y : 0) - Math.abs(Math.sin(c.walk * 0.25)) * 0.02 * bob * c.moving,
        -0.62 + (ipOn ? ip.s.z : 0)
      );
      hand.rotation.set(0.05, 0.18 + U.clamp(yawRate, -4, 4) * 0.04 * sway, -0.05);
      hand.scale.setScalar(ipOn ? ip.s.scale : 1);

      // knives
      P.applyKnifePose(knife, knifeAnim.sample(t));
      P.applyKnifePose(playerKnife, playerKnifeAnim.sample(t));
      knife.tick(t); playerKnife.tick(t);
      const ic = P.mod('itemchams');
      const icColor = ic.s.rainbow ? new THREE.Color().setHSL((t * 0.15) % 1, 1, 0.6) : ic.s.color;
      knife.setChams(ic.on, icColor, ic.s.power);
      playerKnife.setChams(ic.on && f5, icColor, ic.s.power);
      knife.chamsMat.uniforms.uIntensity.value = 1.2 + beat * 1.2;
      const hc = P.mod('handchams');
      handChamsShell.visible = hc.on;
      handChamsShell.userData.mat.uniforms.uColor.value.set(hc.s.color);
      handChamsShell.userData.mat.uniforms.uPower.value = hc.s.power;
      handChamsShell.userData.mat.uniforms.uIntensity.value = 1.1 + (hc.s.pulse ? beat * 1.6 : 0);
      handChamsShell.userData.mat.uniforms.uTime.value = t;
      const sc = P.mod('selfchams');
      selfShells.forEach((s) => (s.visible = sc.on));
      selfShells.mat.uniforms.uColor.value.set(sc.s.color);
      selfShells.mat.uniforms.uIntensity.value = sc.s.opacity * (1.2 + beat);
      selfShells.mat.uniforms.uTime.value = t;

      // cosmetics
      cape.visible = P.isOn('cape') && cape.userData.has;
      if (cape.visible) {
        const pos = capeGeo.attributes.position.array;
        const phys = P.mod('cape').s.physics;
        const lift = 0.35 + 0.5 * U.clamp(stats.speed / 12, 0, 1);
        for (let i = 0; i < pos.length; i += 3) {
          const y = capeBase[i + 1]; // 0 .. -1
          const depth = -y;
          const wave = phys ? Math.sin(t * 6 + depth * 5 + capeBase[i] * 3) * 0.05 * depth : 0;
          pos[i] = capeBase[i];
          pos[i + 1] = y * Math.cos(lift * depth * 0.9);
          pos[i + 2] = depth * Math.sin(lift * depth * 0.9) * 0.9 + wave;
        }
        capeGeo.attributes.position.needsUpdate = true;
        capeGeo.computeVertexNormals();
      }
      wings.visible = P.isOn('wings') && wings.userData.has;
      if (wings.visible) {
        const fl = P.mod('wings').s.flap;
        const a = 0.35 + Math.sin(t * 3 * fl) * 0.35;
        wings.userData.pl.rotation.y = -a; wings.userData.pr.rotation.y = a;
        wings.userData.mat.opacity = 0.6 + beat * 0.4;
      }
      halo.visible = P.isOn('halo') && halo.userData.has;
      halo.position.y = 2.25 + Math.sin(t * 2) * 0.04;
      halo.rotation.z = t;
      aura.visible = P.isOn('aura') && aura.userData.kind !== 'none';
      if (aura.visible) {
        const n = P.mod('aura').s.count | 0;
        const arr = aura.geometry.attributes.position.array;
        for (let i = 0; i < 80; i++) {
          if (i >= n) { arr[i * 3 + 1] = -999; continue; }
          const a = t * (0.8 + (i % 5) * 0.15) + i * 2.399;
          const r = 0.6 + (i % 3) * 0.12;
          arr[i * 3] = Math.cos(a) * r;
          arr[i * 3 + 1] = 0.2 + ((i * 0.37 + t * 0.4) % 1) * 2;
          arr[i * 3 + 2] = Math.sin(a) * r;
        }
        aura.geometry.attributes.position.needsUpdate = true;
        const ac = { aura_fire: [3, 1, 0.2], aura_ice: [0.4, 1.6, 3], aura_toxic: [0.6, 3, 0.2], aura_gold: [3, 2.2, 0.4] }[aura.userData.kind] || [3, 1, 0.2];
        aura.material.color.setRGB(...ac);
      }
      laser.visible = P.isOn('lasereyes');
      if (laser.visible) {
        const lm = P.mod('lasereyes');
        laser.userData.mat.color.set(lm.s.color).multiplyScalar(5 + beat * 4);
        laser.children.forEach((b) => { b.scale.y = lm.s.length; b.position.z = -0.26 - lm.s.length / 2; b.rotation.x = Math.PI / 2 + c.pitch * 0.6; });
      }
      nametag.visible = P.isOn('nametag');
      pet.visible = f5 && P.isOn('pet') && pet.userData.has;
      if (pet.visible) {
        eul.set(0, c.yaw, 0);
        tmpV.set(0.9, 0, 0.6).applyEuler(eul);
        pet.position.set(player.position.x + tmpV.x, player.position.y + 2.1 + Math.sin(t * 2.4) * 0.15, player.position.z + tmpV.z);
        pet.rotation.y = c.yaw + Math.sin(t) * 0.3;
        pet.userData.prop.rotation.y = t * 30;
      }

      // world animation
      for (const co of coins) {
        if (co.kind === 'coin') { co.obj.rotation.y = t * 1.6 + co.phase; co.obj.position.y = co.base + Math.sin(t * 1.4 + co.phase) * 0.5; }
        else { co.obj.rotation.y = t * 2 + co.phase; co.obj.position.y = co.base + Math.sin(t * 2 + co.phase) * 0.2; }
      }
      neonMat.color.setScalar(1.8 + beat * 2.2);
      sky.material.uniforms.uTime.value = t;
      sun.material.uniforms.uTime.value = t;
      sun.position.x = camera.position.x;
      sun.position.z = camera.position.z - 250;
      sky.position.copy(camera.position);

      updateWeather(t, camera.position);
      updateOutline(c);
    }

    function updateWeather(t, cp) {
      const wm = P.mod('weather');
      const type = wm.on ? wm.s.type : 'none';
      weather.visible = wm.on && type !== 'coins';
      coinRain.visible = wm.on && type === 'coins';
      const box = 26, top = 18;
      if (weather.visible) {
        const arr = weather.geometry.attributes.position.array, s = weather.userData.seeds;
        const speed = { rain: 18, snow: 1.6, embers: -2.2 }[type] || 8;
        weather.material.color.set({ rain: '#9cc8ff', snow: '#ffffff', embers: '#ff8a00' }[type]);
        if (type === 'embers') weather.material.color.multiplyScalar(3);
        weather.material.size = type === 'snow' ? 0.12 : type === 'embers' ? 0.1 : 0.06;
        for (let i = 0; i < arr.length / 3; i++) {
          const sx = s[i * 4], sz = s[i * 4 + 1], sy = s[i * 4 + 2];
          let y = ((sy * top * 2 - t * speed) % (top * 2) + top * 2) % (top * 2) - top;
          const drift = type === 'snow' ? Math.sin(t + sx * 20) * 0.6 : type === 'embers' ? Math.sin(t * 2 + sz * 30) * 0.4 : 0;
          arr[i * 3] = cp.x + (sx - 0.5) * box * 2 + drift;
          arr[i * 3 + 1] = cp.y + y;
          arr[i * 3 + 2] = cp.z + (sz - 0.5) * box * 2;
        }
        weather.geometry.attributes.position.needsUpdate = true;
      }
      if (coinRain.visible) {
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
        coinRain.userData.seeds.forEach((s, i) => {
          const y = ((s[2] * 40 - t * (3 + s[3] * 3)) % 40 + 40) % 40 - 15;
          p.set(cp.x + (s[0] - 0.5) * 40, cp.y + y, cp.z + (s[1] - 0.5) * 40);
          e.set(t * (2 + s[3] * 4) + i, t * 3 + i, 0);
          q.setFromEuler(e);
          m4.compose(p, q, sc);
          coinRain.setMatrixAt(i, m4);
        });
        coinRain.instanceMatrix.needsUpdate = true;
      }
    }

    function updateOutline(c) {
      const on = P.isOn('outline') && !f5;
      outline.visible = outlineGlow.visible = false;
      if (!on) return;
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(c.pitch, c.yaw, 0, 'YXZ'));
      const p = c.pos.clone();
      for (let d = 0; d < 9; d += 0.08) {
        p.copy(c.pos).addScaledVector(dir, d);
        const bx = Math.round(p.x), bz = Math.round(p.z), by = Math.round(p.y);
        if (Math.abs(bx) >= HALF || Math.abs(bz) >= HALF) break;
        if (by <= heightAt(bx, bz)) {
          outline.position.set(bx, Math.min(by, heightAt(bx, bz)), bz);
          outlineGlow.position.copy(outline.position);
          outline.visible = outlineGlow.visible = true;
          break;
        }
      }
    }

    /* ---------- render pipeline ---------- */
    function blit(mat, target) {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(quadScene, quadCam);
    }
    let histFlip = false;
    let govern = 1;
    function render(t, dt) {
      const beat = P.isOn('beatsync') ? (P.beat || 0) * P.mod('beatsync').s.amount : 0;
      const mb = P.mod('motionblur');
      const mode = mb.on ? mb.s.mode : 'off';
      const wanted = mode === 'cinematic' || mode === 'hybrid' ? Math.max(1, mb.s.samples | 0) : 1;
      // adaptive governor: keep the preview smooth on weaker GPUs by trimming sub-frames
      const N = mb.s.adaptive ? Math.max(wanted > 1 ? 2 : 1, Math.min(wanted, Math.round(wanted * govern))) : wanted;
      stats.samples = N;
      const span = SHUTTER_BASE * (mb.s.shutter / 360);

      renderer.setClearColor(0x000000, 1);
      if (N > 1) {
        renderer.setRenderTarget(rt.accum);
        renderer.clear();
        mats.accum.uniforms.uWeight.value = 1 / N;
        for (let i = 0; i < N; i++) {
          const ts = t - span * (1 - i / (N - 1)); // oldest -> newest
          updateScene(ts, beat);
          renderer.setRenderTarget(rt.scene);
          renderer.clear();
          renderer.render(scene, camera);
          mats.accum.uniforms.tDiffuse.value = rt.scene.texture;
          quad.material = mats.accum;
          renderer.setRenderTarget(rt.accum);
          renderer.render(quadScene, quadCam);
        }
      } else {
        updateScene(t, beat);
        renderer.setRenderTarget(rt.scene);
        renderer.clear();
        renderer.render(scene, camera);
        mats.copy.uniforms.tDiffuse.value = rt.scene.texture;
        mats.copy.uniforms.uWeight.value = 1;
        blit(mats.copy, rt.accum);
      }
      let src = rt.accum;
      if (mode === 'frameblend' || mode === 'hybrid') {
        const out = histFlip ? rt.histA : rt.histB, prev = histFlip ? rt.histB : rt.histA;
        // frame-rate independent trail
        const trail = Math.pow(mb.s.trail, dt * 60);
        mats.blend.uniforms.tCur.value = rt.accum.texture;
        mats.blend.uniforms.tPrev.value = prev.texture;
        mats.blend.uniforms.uTrail.value = mode === 'hybrid' ? trail * 0.6 : trail;
        blit(mats.blend, out);
        histFlip = !histFlip;
        src = out;
      }
      // bloom
      const bl = P.mod('bloom');
      if (bl.on) {
        mats.bright.uniforms.tDiffuse.value = src.texture;
        mats.bright.uniforms.uThr.value = bl.s.threshold;
        blit(mats.bright, rt.b1);
        const blurPass = (from, to, w, h, dx, dy, r) => {
          mats.blur.uniforms.tDiffuse.value = from.texture;
          mats.blur.uniforms.uDir.value.set(dx, dy);
          mats.blur.uniforms.uRes.value.set(w, h);
          mats.blur.uniforms.uRadius.value = r;
          blit(mats.blur, to);
        };
        const w2 = W >> 1, h2 = H >> 1, w4 = W >> 2, h4 = H >> 2;
        blurPass(rt.b1, rt.b2, w2, h2, 1, 0, bl.s.radius);
        blurPass(rt.b2, rt.b1, w2, h2, 0, 1, bl.s.radius);
        blurPass(rt.b1, rt.q1, w4, h4, 1, 0, bl.s.radius * 2);
        blurPass(rt.q1, rt.q2, w4, h4, 0, 1, bl.s.radius * 2);
        blurPass(rt.q2, rt.q1, w4, h4, 1, 0, bl.s.radius * 3);
        blurPass(rt.q1, rt.q2, w4, h4, 0, 1, bl.s.radius * 3);
      }
      const u = mats.comp.uniforms;
      u.tScene.value = src.texture;
      u.tBloom.value = rt.b1.texture;
      u.tBloom2.value = rt.q2.texture;
      u.uRes.value.set(W, H);
      u.uTime.value = t;
      u.uBloom.value = bl.on ? bl.s.strength * (1 + beat * 0.5) : 0;
      u.uChroma.value = P.isOn('chroma') ? P.mod('chroma').s.amount * (1 + hitFlash * 2) : hitFlash;
      u.uVignette.value = P.isOn('vignette') ? P.mod('vignette').s.amount : 0;
      u.uGrain.value = P.isOn('grain') ? P.mod('grain').s.amount : 0;
      u.uBars.value = P.isOn('letterbox') ? P.mod('letterbox').s.size : 0;
      const gr = P.mod('grade');
      u.uSat.value = gr.on ? gr.s.sat : 1;
      u.uContrast.value = gr.on ? gr.s.contrast : 1;
      u.uWarmth.value = gr.on ? gr.s.warmth : 0;
      const tm = P.mod('tonemap');
      u.uTonemap.value = tm.on ? 1 : 0;
      u.uExposure.value = tm.on ? tm.s.exposure : 1;
      u.uScan.value = P.isOn('scanlines') ? P.mod('scanlines').s.amount : 0;
      u.uSharpen.value = P.isOn('sharpen') ? P.mod('sharpen').s.amount : 0;
      u.uDamage.value = 0;
      blit(mats.comp, null);
      hitFlash *= Math.pow(0.02, dt);
    }

    function loop() {
      requestAnimationFrame(loop);
      if (!active || !renderer) return;
      const t = now();
      const dt = U.clamp(t - lastT, 0.001, 0.1);
      lastT = t;
      fpsAcc += dt; fpsFrames++;
      if (fpsAcc > 0.5) {
        fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; stats.fps = fps;
        if (fps < 42) govern = Math.max(0.15, govern * 0.8);
        else if (fps > 56) govern = Math.min(1, govern * 1.1);
      }
      stepManual(t, dt);
      // auto flip
      const bf = P.mod('butterfly');
      if (bf.on && bf.s.autoflip > 0 && t - lastAutoFlip > bf.s.autoflip && !knifeAnim.isBusy(t)) {
        lastAutoFlip = t;
        const sp = bf.s.speed;
        knifeAnim.play('flip_close', t, sp, () => knifeAnim.play('flip_open', now(), sp));
        playerKnifeAnim.play('flip_close', t, sp, () => playerKnifeAnim.play('flip_open', now(), sp));
      }
      render(t, dt);
      const nowMs = performance.now();
      for (const k of ['l', 'r']) while (clicks[k].length && clicks[k][0] < nowMs - 1000) clicks[k].shift();
      stats.cps = [clicks.l.length, clicks.r.length];
      stats.f5 = f5;
      stats.closed = knifeAnim.state.closed;
      P.emit('frame', stats);
    }

    return {
      init,
      setActive(on) { active = on; if (on && renderer) resize(); if (!on && document.pointerLockElement === canvas) document.exitPointerLock(); },
      flip, inspect, swing,
      toggleF5() { if (P.isOn('perspective')) setF5(!f5); },
      stats,
      keys,
      isActive: () => active,
    };
  })();
})();
