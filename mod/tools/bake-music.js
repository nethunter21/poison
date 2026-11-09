/* Bakes the launcher's procedural POISON FM tracks into OGG files for the in-game player.
 * Usage: node mod/tools/bake-music.js   (needs playwright + ffmpeg; run from repo root)
 * Renders each track with an OfflineAudioContext in headless Chromium, then encodes Vorbis. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..', 'launcher');
const OUT = path.resolve(__dirname, '..', 'src', 'main', 'resources', 'assets', 'poison', 'music');

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' });
    fs.createReadStream(f).pipe(res);
  }).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('poison.client.v1', JSON.stringify({ launcher: { splash: false } })));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__poison && window.__poison.music);
  fs.mkdirSync(OUT, { recursive: true });
  const n = await page.evaluate(() => __poison.music.tracks.filter((t) => t.type === 'synth').length);
  const index = [];
  for (let i = 0; i < n; i++) {
    const r = await page.evaluate(async (k) => {
      const res = await __poison.music.renderTrack(k);
      const bytes = new Uint8Array(res.wav);
      let bin = '';
      for (let j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
      return { title: res.title, b64: btoa(bin) };
    }, i);
    const wav = path.join(OUT, `tmp_${i}.wav`);
    fs.writeFileSync(wav, Buffer.from(r.b64, 'base64'));
    const name = String(i + 1).padStart(2, '0') + '.ogg';
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', path.join(OUT, name)]);
    fs.unlinkSync(wav);
    index.push(`${name}=${r.title}`);
    console.log('baked', name, r.title, (fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0) + ' KB');
  }
  fs.writeFileSync(path.join(OUT, 'index.txt'), index.join('\n') + '\n');
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
