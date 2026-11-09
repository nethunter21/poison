/* POISON CLIENT — Java runtime manager.
 * Downloads Mojang's official Java runtime (the same ones the vanilla launcher uses)
 * for the component a game version asks for, verifies every file's SHA-1, and caches it.
 * Users never have to install Java themselves.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fetchJson, fetchBuffer, pool } = require('./net');

const RUNTIME_INDEX = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

function platformKey() {
  const { platform, arch } = process;
  if (platform === 'win32') return arch === 'ia32' ? 'windows-x86' : arch === 'arm64' ? 'windows-arm64' : 'windows-x64';
  if (platform === 'darwin') return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os';
  return arch === 'ia32' ? 'linux-i386' : 'linux';
}

function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }

function javaBinary(dir) {
  if (process.platform === 'win32') return path.join(dir, 'bin', 'javaw.exe');
  if (process.platform === 'darwin') return path.join(dir, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
  return path.join(dir, 'bin', 'java');
}

/**
 * Ensure the runtime `component` (e.g. "jre-legacy", "java-runtime-delta") exists under `root`.
 * @returns absolute path to the java executable
 */
async function ensureRuntime(component, root, onProgress = () => {}) {
  const dir = path.join(root, component, platformKey());
  const marker = path.join(dir, '.poison-complete');
  const bin = javaBinary(dir);
  if (fs.existsSync(marker) && fs.existsSync(bin)) return bin;

  onProgress({ stage: 'java', text: `Resolving Java runtime (${component})`, done: 0, total: 1 });
  const index = await fetchJson(RUNTIME_INDEX);
  const plat = index[platformKey()];
  let entry = plat && plat[component] && plat[component][0];
  // emulation fallbacks: Rosetta on Apple Silicon, x64 emulation on Windows on ARM
  const fallback = { 'mac-os-arm64': 'mac-os', 'windows-arm64': 'windows-x64' }[platformKey()];
  if (!entry && fallback && index[fallback][component]) entry = index[fallback][component][0];
  if (!entry) throw new Error(`Mojang has no ${component} Java runtime for ${platformKey()}`);
  const manifest = await fetchJson(entry.manifest.url);

  const files = Object.entries(manifest.files);
  const dirs = files.filter(([, f]) => f.type === 'directory');
  const regular = files.filter(([, f]) => f.type === 'file');
  const links = files.filter(([, f]) => f.type === 'link');
  for (const [p] of dirs) fs.mkdirSync(path.join(dir, p), { recursive: true });

  let done = 0;
  const total = regular.length;
  await pool(regular, 12, async ([rel, f]) => {
    const dest = path.join(dir, rel);
    const want = f.downloads.raw;
    let ok = false;
    if (fs.existsSync(dest)) {
      try { ok = fs.statSync(dest).size === want.size && sha1(fs.readFileSync(dest)) === want.sha1; } catch { ok = false; }
    }
    if (!ok) {
      const buf = await fetchBuffer(want.url);
      if (sha1(buf) !== want.sha1) throw new Error(`Checksum mismatch for ${rel}`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    }
    if (f.executable && process.platform !== 'win32') fs.chmodSync(dest, 0o755);
    done++;
    if (done % 10 === 0 || done === total) onProgress({ stage: 'java', text: `Downloading Java ${component}`, done, total });
  });
  if (process.platform !== 'win32') {
    for (const [rel, f] of links) {
      const dest = path.join(dir, rel);
      try { fs.rmSync(dest, { force: true }); fs.symlinkSync(f.target, dest); } catch { /* best effort */ }
    }
  }
  if (!fs.existsSync(bin)) throw new Error('Java runtime downloaded but the executable is missing: ' + bin);
  fs.writeFileSync(marker, new Date().toISOString());
  return bin;
}

module.exports = { ensureRuntime, platformKey };
