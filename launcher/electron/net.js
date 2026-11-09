/* POISON CLIENT — small HTTP helpers.
 * Inside Electron we use net.fetch (Chromium's network stack: honours the system proxy
 * and certificate store). Outside Electron (tests) we fall back to Node's fetch.
 */
let doFetch = globalThis.fetch;
try {
  const { net } = require('electron');
  if (net && typeof net.fetch === 'function') doFetch = (url, opts) => net.fetch(url, opts);
} catch { /* plain node */ }

async function fetchWithRetry(url, opts = {}, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await doFetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr;
}
const fetchJson = async (url, opts) => (await fetchWithRetry(url, opts)).json();
const fetchBuffer = async (url, opts) => Buffer.from(await (await fetchWithRetry(url, opts)).arrayBuffer());

/* run `worker` over `items` with at most `n` in flight */
async function pool(items, n, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await worker(item); }
  });
  await Promise.all(runners);
}

module.exports = { fetchJson, fetchBuffer, pool };
