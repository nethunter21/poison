/* POISON CLIENT — game versions, Fabric profiles and launching (via minecraft-launcher-core). */
const fs = require('fs');
const path = require('path');
const { Client } = require('minecraft-launcher-core');
const crypto = require('crypto');
const { fetchJson, fetchBuffer, pool } = require('./net');
const { ensureRuntime } = require('./java');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC = 'https://meta.fabricmc.net/v2';
// Legacy Fabric covers versions modern Fabric doesn't (1.8.9 and other pre-1.14 releases)
const LEGACY_FABRIC = 'https://meta.legacyfabric.net/v2';

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
  let meta = FABRIC;
  let loaders = await fetchJson(`${FABRIC}/versions/loader/${encodeURIComponent(gameVersion)}`).catch(() => []);
  if (!Array.isArray(loaders) || !loaders.length) {
    meta = LEGACY_FABRIC;
    loaders = await fetchJson(`${LEGACY_FABRIC}/versions/loader/${encodeURIComponent(gameVersion)}`).catch(() => []);
  }
  if (!Array.isArray(loaders) || !loaders.length) throw new Error(`Fabric does not support ${gameVersion} yet`);
  const loader = (loaders.find((l) => l.loader.stable) || loaders[0]).loader.version;
  const profile = await fetchJson(`${meta}/versions/loader/${encodeURIComponent(gameVersion)}/${loader}/profile/json`);
  // natives-only entries (Legacy Fabric's lwjgl-platform) have no plain jar; the game's own natives cover them
  profile.libraries = (profile.libraries || []).filter((l) => !(l.natives && !(l.downloads && l.downloads.artifact)));
  const dir = path.join(root, 'versions', profile.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${profile.id}.json`), JSON.stringify(profile, null, 2));
  return profile.id;
}

/**
 * Install (or remove) the bundled POISON in-game mod + Fabric API in <root>/mods.
 * Only our own managed files are touched; the user's mods are left alone.
 * @returns true when POISON is active for this launch
 */
function readModManifest(bundledDir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(bundledDir, 'manifest.json'), 'utf8'));
    // v1 manifest: { minecraft, fabricApi, mod } -> single 1.21.4 entry
    if (!m.mods && m.minecraft) return { [m.minecraft]: { jar: 'poison-client.jar', api: 'fabric-api.jar' } };
    return m.mods || {};
  } catch { return {}; }
}

function syncPoisonMods(gameVersion, fabricActive, root, bundledDir) {
  const modsDir = path.join(root, 'mods');
  const managed = { mod: path.join(modsDir, 'poison-client.jar'), api: path.join(modsDir, 'poison-fabric-api.jar') };
  const entry = fabricActive ? readModManifest(bundledDir)[gameVersion] : null;
  if (!entry) {
    for (const f of Object.values(managed)) fs.rmSync(f, { force: true });
    return false;
  }
  fs.mkdirSync(modsDir, { recursive: true });
  fs.copyFileSync(path.join(bundledDir, entry.jar), managed.mod);
  // only versions that need Fabric API get it, and never a second copy next to the user's own
  const userApi = fs.readdirSync(modsDir).some((f) => /^fabric-api.*\.jar$/i.test(f));
  if (!entry.api || userApi) fs.rmSync(managed.api, { force: true });
  else fs.copyFileSync(path.join(bundledDir, entry.api), managed.api);
  return true;
}

/** Delete library "jars" that are really HTML error pages (left behind by failed downloads). */
function purgeBrokenLibraries(root) {
  const dir = path.join(root, 'libraries');
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith('.jar')) {
        const st = fs.statSync(f);
        if (st.size < 8192) {
          const head = fs.readFileSync(f).subarray(0, 2).toString('latin1');
          if (head !== 'PK') { fs.rmSync(f, { force: true }); removed++; }
        }
      }
    }
  };
  walk(dir);
  return removed;
}

/**
 * Per-version game directory (mods, config, options, saves, screenshots). Libraries, assets,
 * versions and Java runtimes stay shared in <root>, so switching versions never re-downloads,
 * and a 1.21.4 mod can never crash a 1.8.9 launch (or the other way round).
 */
function instanceDir(root, version, loader) {
  return path.join(root, 'instances', `${version}-${loader === 'Fabric' ? 'fabric' : 'vanilla'}`);
}

/**
 * First launch of an instance: carry over options/servers/POISON config from the old shared
 * folder (launcher <= 1.4.2 used one folder for everything). Never overwrites existing files.
 */
function migrateIntoInstance(root, gameDir, version) {
  const minor = parseInt((/^1\.(\d+)/.exec(version) || [])[1] || '99', 10);
  const copies = [['servers.dat', 'servers.dat'], [path.join('config', 'poison.json'), path.join('config', 'poison.json')]];
  if (minor >= 13) copies.push(['options.txt', 'options.txt']); // key format changed in 1.13
  for (const [from, to] of copies) {
    const src = path.join(root, from), dst = path.join(gameDir, to);
    if (fs.existsSync(src) && !fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
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
      // neither Fabric nor Legacy Fabric has this version: run vanilla instead of failing
      if (!/does not support/.test(e.message)) throw e;
      emit('progress', { stage: 'fabric', text: `Fabric unavailable for ${opts.version}, launching Vanilla`, done: 1, total: 1 });
    }
  }

  const gameDir = instanceDir(root, opts.version, custom ? 'Fabric' : 'Vanilla');
  fs.mkdirSync(gameDir, { recursive: true });
  migrateIntoInstance(root, gameDir, opts.version);
  // hand the POISON config to the in-game client (it imports newer launcher settings on start)
  fs.writeFileSync(path.join(gameDir, 'poison-config.json'), JSON.stringify(opts.config || {}, null, 2));
  let poisonActive = false;
  if (opts.bundledModsDir) {
    poisonActive = syncPoisonMods(opts.version, !!custom, gameDir, opts.bundledModsDir);
    emit('progress', { stage: 'fabric', text: poisonActive ? 'POISON in-game client installed' : 'Launching without the POISON in-game mod', done: 1, total: 1 });
  }

  purgeBrokenLibraries(root);
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
    overrides: { detached: false, maxSockets: 8, gameDirectory: gameDir },
  };
  // optional auto-join: { host, port }. Quick Play exists from 1.20; older versions use --server/--port
  if (opts.server && opts.server.host) {
    const minor = parseInt((/^1\.(\d+)/.exec(opts.version) || [])[1] || '99', 10);
    launchOpts.quickPlay = { type: minor >= 20 ? 'multiplayer' : 'legacy', identifier: `${opts.server.host}:${opts.server.port || 25565}` };
  }

  return new Promise((resolve, reject) => {
    let started = false;
    let lastLines = [];
    client.on('progress', (e) => emit('progress', { stage: e.type, text: `Downloading ${e.type}`, done: e.task, total: e.total }));
    client.on('debug', (line) => { emit('log', String(line)); lastLines.push(String(line)); lastLines = lastLines.slice(-20); });
    client.on('data', (line) => {
      emit('log', String(line));
      if (!started) { started = true; emit('progress', { stage: 'running', text: 'Game running', done: 1, total: 1 }); resolve({ ok: true, poison: poisonActive }); }
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

module.exports = { listVersions, launch, splitArgs, syncPoisonMods, readModManifest, instanceDir, migrateIntoInstance };
