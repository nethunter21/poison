/* POISON CLIENT — game versions, Fabric profiles and launching (via minecraft-launcher-core). */
const fs = require('fs');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const crypto = require('crypto');
const { fetchJson, fetchBuffer, pool } = require('./net');
const { ensureRuntime } = require('./java');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC = 'https://meta.fabricmc.net/v2';

let manifestCache = null;
async function getManifest() {
  if (!manifestCache) manifestCache = await fetchJson(MANIFEST);
  return manifestCache;
}

/** Release list (+ latest snapshot) for the version picker. */
async function listVersions() {
  const m = await getManifest();
  return { latest: m.latest, versions: m.versions.filter((v) => v.type === 'release').map((v) => v.id), snapshot: m.latest.snapshot };
}

/** Which Mojang Java runtime a version needs (old versions omit it -> jre-legacy). */
async function javaComponentFor(versionId) {
  const m = await getManifest();
  const entry = m.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`Unknown Minecraft version ${versionId}`);
  const json = await fetchJson(entry.url);
  return { component: (json.javaVersion && json.javaVersion.component) || 'jre-legacy', type: entry.type, json };
}

/**
 * Download + SHA-1 verify every asset object ourselves (with retries) before MCLC runs.
 * MCLC's own asset downloader leaves 0-byte files behind when a request fails, which
 * corrupts textures/sounds/fonts in game. Verified files are skipped by MCLC.
 */
async function ensureAssets(versionJson, root, emit) {
  const ai = versionJson.assetIndex;
  if (!ai) return;
  const assetsDir = path.join(root, 'assets');
  const indexPath = path.join(assetsDir, 'indexes', `${ai.id}.json`);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
  let indexBuf = fs.existsSync(indexPath) ? fs.readFileSync(indexPath) : null;
  if (!indexBuf || sha1(indexBuf) !== ai.sha1) {
    indexBuf = await fetchBuffer(ai.url);
    fs.writeFileSync(indexPath, indexBuf);
  }
  const objects = Object.values(JSON.parse(indexBuf.toString('utf8')).objects);
  const unique = [...new Map(objects.map((o) => [o.hash, o])).values()];
  let done = 0;
  const failed = [];
  await pool(unique, 16, async (o) => {
    const dest = path.join(assetsDir, 'objects', o.hash.slice(0, 2), o.hash);
    let ok = false;
    try { ok = fs.statSync(dest).size === o.size && (o.size > 4 * 1024 * 1024 || sha1(fs.readFileSync(dest)) === o.hash); } catch { ok = false; }
    if (!ok) {
      try {
        const buf = await fetchBuffer(`https://resources.download.minecraft.net/${o.hash.slice(0, 2)}/${o.hash}`);
        if (sha1(buf) !== o.hash) throw new Error('checksum');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
      } catch (e) { failed.push(o.hash); }
    }
    done++;
    if (done % 50 === 0 || done === unique.length) emit('progress', { stage: 'assets', text: 'Downloading assets', done, total: unique.length });
  });
  if (failed.length) throw new Error(`${failed.length} game assets failed to download. Check your connection and press Launch again (finished files are kept).`);
}

/** Install the latest stable Fabric loader profile for a game version; returns the custom version id. */
async function ensureFabric(gameVersion, root) {
  const loaders = await fetchJson(`${FABRIC}/versions/loader/${encodeURIComponent(gameVersion)}`);
  if (!Array.isArray(loaders) || !loaders.length) throw new Error(`Fabric does not support ${gameVersion} yet`);
  const loader = (loaders.find((l) => l.loader.stable) || loaders[0]).loader.version;
  const profile = await fetchJson(`${FABRIC}/versions/loader/${encodeURIComponent(gameVersion)}/${loader}/profile/json`);
  const dir = path.join(root, 'versions', profile.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  fs.mkdirSync(path.join(root, 'mods'), { recursive: true });
  return profile.id;
}

/* simple Java-style arg splitting that respects quotes */
function splitArgs(str) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str || ''))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/**
 * Launch the game.
 * @param opts {version, loader, ram, jvm, width, height, fullscreen, javaPath, root, runtimeRoot, auth, config}
 * @param emit (event, payload) progress / log / exit sink
 * @returns Promise resolving when the game process has started; `onExit` fires later
 */
async function launch(opts, emit) {
  const { root, runtimeRoot } = opts;
  fs.mkdirSync(root, { recursive: true });
  // hand the POISON config to anything in-game that wants to read it
  fs.writeFileSync(path.join(root, 'poison-config.json'), JSON.stringify(opts.config || {}, null, 2));

  emit('progress', { stage: 'meta', text: `Resolving ${opts.version}`, done: 0, total: 1 });
  const { component, type, json: versionJson } = await javaComponentFor(opts.version);
  await ensureAssets(versionJson, root, emit);

  let javaPath = opts.javaPath && opts.javaPath !== 'auto' ? opts.javaPath : null;
  if (!javaPath) javaPath = await ensureRuntime(component, runtimeRoot, (p) => emit('progress', p));

  let custom;
  if (opts.loader === 'Fabric') {
    emit('progress', { stage: 'fabric', text: 'Installing Fabric loader', done: 0, total: 1 });
    try {
      custom = await ensureFabric(opts.version, root);
    } catch (e) {
      // Fabric only exists for 1.14+; older versions (e.g. 1.8.9) run vanilla instead of failing
      if (!/does not support/.test(e.message)) throw e;
      emit('progress', { stage: 'fabric', text: `Fabric unavailable for ${opts.version}, launching Vanilla`, done: 1, total: 1 });
    }
  }

  const client = new Client();
  const ram = Math.max(1024, opts.ram | 0);
  const launchOpts = {
    root,
    authorization: opts.auth,
    version: { number: opts.version, type: type || 'release', ...(custom ? { custom } : {}) },
    memory: { max: `${ram}M`, min: `${Math.min(1024, ram)}M` },
    javaPath,
    customArgs: splitArgs(opts.jvm),
    window: opts.fullscreen ? { fullscreen: true } : { width: opts.width || 1280, height: opts.height || 720 },
    overrides: { detached: false, maxSockets: 8 },
  };

  return new Promise((resolve, reject) => {
    let started = false;
    let lastLines = [];
    client.on('progress', (e) => emit('progress', { stage: e.type, text: `Downloading ${e.type}`, done: e.task, total: e.total }));
    client.on('debug', (line) => { emit('log', String(line)); lastLines.push(String(line)); lastLines = lastLines.slice(-20); });
    client.on('data', (line) => {
      emit('log', String(line));
      if (!started) { started = true; emit('progress', { stage: 'running', text: 'Game running', done: 1, total: 1 }); resolve({ ok: true }); }
    });
    client.on('close', (code) => {
      emit('exit', { code });
      if (!started) reject(new Error(`Game exited before starting (code ${code}).\n${lastLines.slice(-6).join('\n')}`));
    });
    client.launch(launchOpts).then((proc) => {
      if (!proc && !started) reject(new Error(`Launch failed.\n${lastLines.slice(-6).join('\n')}`));
    }).catch(reject);
  });
}

module.exports = { listVersions, launch, splitArgs };
