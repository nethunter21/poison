/* Builds the POISON Fabric mod and fetches the matching Fabric API, into build/mods/,
 * so electron-builder can bundle them into the exe (see package.json "extraResources"). */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MOD_DIR = path.resolve(__dirname, '..', '..', 'mod');
const LEGACY_DIR = path.resolve(__dirname, '..', '..', 'mod-1.8.9');
const OUT = path.resolve(__dirname, '..', 'build', 'mods');
const FABRIC_API = '0.119.4+1.21.4';
const API_URL = `https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/${FABRIC_API}/fabric-api-${encodeURIComponent(FABRIC_API)}.jar`;

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const gradlew = path.join(MOD_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  console.log('• building POISON mod');
  execFileSync(gradlew, ['build', '--no-daemon', '-q'], { cwd: MOD_DIR, stdio: 'inherit', shell: process.platform === 'win32' });
  const newest = (dir, re) => fs.readdirSync(dir).filter((f) => re.test(f)).sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)[0];
  const jar = newest(path.join(MOD_DIR, 'build', 'libs'), /^poison-client-[\d.]+\.jar$/);
  if (!jar) throw new Error('mod jar not found');
  fs.copyFileSync(path.join(MOD_DIR, 'build', 'libs', jar), path.join(OUT, 'poison-client.jar'));
  console.log('  ✓', jar);

  const apiPath = path.join(OUT, 'fabric-api.jar');
  const want = (await get(API_URL + '.sha1')).toString('utf8').trim().slice(0, 40);
  const have = fs.existsSync(apiPath) ? crypto.createHash('sha1').update(fs.readFileSync(apiPath)).digest('hex') : '';
  if (have !== want) {
    console.log('• downloading Fabric API', FABRIC_API);
    const buf = await get(API_URL);
    if (crypto.createHash('sha1').update(buf).digest('hex') !== want) throw new Error('Fabric API checksum mismatch');
    fs.writeFileSync(apiPath, buf);
  }
  console.log('  ✓ fabric-api', FABRIC_API);

  // 1.8.9 (Legacy Fabric) — dependency-free, mixins only
  console.log('• building POISON 1.8.9 mod');
  const gradlewLegacy = path.join(LEGACY_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
  execFileSync(gradlewLegacy, ['build', '--no-daemon', '-q'], { cwd: LEGACY_DIR, stdio: 'inherit', shell: process.platform === 'win32' });
  const legacyJar = newest(path.join(LEGACY_DIR, 'build', 'libs'), /^poison-client-1\.8\.9-[\d.]+\.jar$/);
  if (!legacyJar) throw new Error('1.8.9 mod jar not found');
  fs.copyFileSync(path.join(LEGACY_DIR, 'build', 'libs', legacyJar), path.join(OUT, 'poison-client-1.8.9.jar'));
  console.log('  ✓', legacyJar);

  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
    mods: {
      '1.21.4': { jar: 'poison-client.jar', api: 'fabric-api.jar', loader: 'fabric', fabricApi: FABRIC_API },
      '1.8.9': { jar: 'poison-client-1.8.9.jar', loader: 'legacyfabric' },
    },
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
