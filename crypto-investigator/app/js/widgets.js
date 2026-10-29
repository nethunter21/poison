/* Live widgets embedded in lessons via <div class="widget" data-widget="id"> */
(function () {
  // Compact synchronous SHA-256 (UTF-8 input, hex output)
  const K = [];
  (function () {
    const isPrime = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
    let n = 2, c = 0;
    while (c < 64) { if (isPrime(n)) { K[c++] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0; } n++; }
  })();
  function sha256(str) {
    const bytes = new TextEncoder().encode(str);
    const l = bytes.length, words = [];
    const padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    padded.set(bytes); padded[l] = 0x80;
    const bitLen = l * 8, dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen >>> 0); dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) words[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(words[i - 15], 7) ^ rotr(words[i - 15], 18) ^ (words[i - 15] >>> 3);
        const s1 = rotr(words[i - 2], 17) ^ rotr(words[i - 2], 19) ^ (words[i - 2] >>> 10);
        words[i] = (words[i - 16] + s0 + words[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + words[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = H.map((v, i) => (v + [a, b, c, d, e, f, g, h][i]) | 0);
    }
    return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }
  window.sha256 = sha256;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const W = {
    hash(host) {
      host.innerHTML = `
        <div class="wg">
          <div class="wg-title">LIVE LAB · SHA-256 FINGERPRINT & HASH-LINKED BLOCKS</div>
          <input class="inp" id="hin" value="Alice pays Bob 0.8 BTC" spellcheck="false">
          <div class="hashout" id="hout"></div>
          <div class="chainrow" id="hchain"></div>
          <p class="small" style="margin-top:12px">Edit any block's data: its hash changes, and the next block's stored <b>prev</b> no longer matches → the chain turns red. That's tamper-evidence.</p>
          <button class="btn btn-g" id="hfix" style="margin-top:6px;padding:8px 14px;font-size:12px">↻ Re-link chain (attacker re-mines everything)</button>
        </div>`;
      const inp = host.querySelector('#hin'), out = host.querySelector('#hout');
      let prev = '';
      const upd = () => {
        const h = sha256(inp.value);
        out.innerHTML = [...h].map((c, i) => `<span class="${prev && prev[i] !== c ? 'ch' : ''}">${c}</span>`).join('');
        prev = h;
      };
      inp.addEventListener('input', upd); upd();
      const blocks = [{ d: 'A→B 0.8 BTC' }, { d: 'C→D 2.1 BTC' }, { d: 'E→F 0.05 BTC' }];
      const linkAll = () => {
        let p = '0000000000000000';
        blocks.forEach(b => { b.prev = p; p = sha256(b.prev + b.d); });
      };
      const chain = host.querySelector('#hchain');
      const render = () => {
        let ok = true, p = '0000000000000000';
        chain.innerHTML = '';
        blocks.forEach((b, i) => {
          const hh = sha256(b.prev + b.d);
          if (b.prev !== p) ok = false;
          const div = document.createElement('div');
          div.className = 'blk' + (ok ? '' : ' bad');
          div.innerHTML = `<h5>BLOCK #${812440 + i}<em>${ok ? 'VALID' : 'BROKEN'}</em></h5>
            <label>DATA</label><input value="${esc(b.d)}" spellcheck="false">
            <label>PREV</label><div class="hv">${b.prev.slice(0, 16)}…</div>
            <label>HASH</label><div class="hv">${hh.slice(0, 16)}…</div>`;
          div.querySelector('input').addEventListener('input', e => {
            b.d = e.target.value;
            const pos = e.target.selectionStart; render();
            const ni = chain.children[i].querySelector('input'); ni.focus(); ni.setSelectionRange(pos, pos);
          });
          chain.appendChild(div);
          p = hh;
        });
      };
      linkAll(); render();
      host.querySelector('#hfix').onclick = () => { linkAll(); render(); };
    },

    addrid(host) {
      const tests = [
        [/^bc1p[02-9ac-hj-np-z]{58}$/i, 'Bitcoin · Taproot (P2TR)', '#ffd84d', 'Modern wallets; single-sig or complex scripts look identical on-chain.'],
        [/^bc1q[02-9ac-hj-np-z]{38}$/i, 'Bitcoin · Native SegWit P2WPKH', '#ffd84d', 'Single-key SegWit. Most common modern format.'],
        [/^bc1q[02-9ac-hj-np-z]{58}$/i, 'Bitcoin · SegWit P2WSH', '#ffd84d', 'Script hash — often multisig (exchanges, custody).'],
        [/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/, 'Bitcoin · P2SH', '#ffd84d', 'Multisig or wrapped SegWit — very common for exchanges.'],
        [/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/, 'Bitcoin · Legacy P2PKH', '#ffd84d', 'Oldest format — older wallets, early coins, some services.'],
        [/^0x[0-9a-fA-F]{40}$/, 'EVM (Ethereum, BSC, Polygon, Arbitrum, Base…)', '#5b8cff', 'Same address valid on every EVM chain — confirm the chain via tx hash!'],
        [/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'TRON', '#ff3d71', 'Heavily used for USDT-TRC20 — common in scams and OTC cash-out.'],
        [/^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/, 'Monero', '#ff8a3d', 'Privacy coin: stealth addresses, hidden amounts, ring signatures.'],
        [/^(ltc1|[LM])[a-zA-HJ-NP-Z0-9]{25,62}$/, 'Litecoin', '#9aa7c7', 'UTXO chain — Bitcoin heuristics largely apply.'],
        [/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'XRP Ledger', '#38e1ff', 'Account-based; watch destination tags for exchange deposits.'],
        [/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Solana (likely)', '#b06bff', 'Base58 32–44 chars. Token balances live in associated token accounts.'],
      ];
      const samples = ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297'];
      host.innerHTML = `
        <div class="wg">
          <div class="wg-title">LIVE LAB · ADDRESS IDENTIFIER</div>
          <input class="inp" placeholder="Paste any crypto address…" spellcheck="false">
          <div class="samples">${samples.map(s => `<button>${s.slice(0, 14)}…</button>`).join('')}</div>
          <div class="addr-res"><span style="color:var(--dim)">Waiting for input…</span></div>
        </div>`;
      const inp = host.querySelector('input'), res = host.querySelector('.addr-res');
      const run = () => {
        const v = inp.value.trim();
        if (!v) { res.innerHTML = '<span style="color:var(--dim)">Waiting for input…</span>'; return; }
        const t = tests.find(([re]) => re.test(v));
        res.innerHTML = t
          ? `<span class="chip" style="background:${t[2]}22;color:${t[2]};border:1px solid ${t[2]}">${t[1]}</span><span style="font-size:13.5px;color:#c3cbe8;line-height:1.5">${t[3]}</span>`
          : `<span class="chip" style="color:var(--red);border:1px solid var(--red)">UNRECOGNISED</span><span style="font-size:13.5px;color:var(--muted)">Check for typos, whitespace, or a less common chain.</span>`;
      };
      inp.addEventListener('input', run);
      host.querySelectorAll('.samples button').forEach((b, i) => b.onclick = () => { inp.value = samples[i]; run(); });
    },

    confidence(host) {
      const L = [
        ['Confirmed', '#2bff9e', 'Directly observable on-chain or confirmed by authoritative records (e.g. exchange KYC response).', '"Address A sent 4.2 BTC to address B (tx 91ab…)."'],
        ['High', '#38e1ff', 'Multiple independent heuristics agree with no contrary evidence.', '"Output 1 is assessed with high confidence to be change, based on script type, round-amount and address-freshness heuristics."'],
        ['Medium', '#ffd84d', 'Some supporting evidence, but alternatives remain plausible.', '"The withdrawal is likely linked to the suspect\'s deposit based on timing and amount."'],
        ['Low', '#ff8a3d', 'A single weak signal. Treat as a lead only.', '"Activity hours are consistent with, but do not establish, a UTC+8 timezone."'],
        ['Speculative', '#ff3d71', 'Hypothesis to investigate. Never present as a finding.', '"It is possible the addresses share an operator; further investigation required."'],
      ];
      host.innerHTML = `<div class="wg"><div class="wg-title">CONFIDENCE LADDER · CLICK A LEVEL</div>
        <div class="conf">${L.map((l, i) => `<button style="--cc:${l[1]}" data-i="${i}">${l[0]}</button>`).join('')}</div>
        <div class="conf-out"></div></div>`;
      const out = host.querySelector('.conf-out');
      const sel = i => {
        host.querySelectorAll('.conf button').forEach((b, k) => b.classList.toggle('on', k === i));
        out.innerHTML = `<b style="color:${L[i][1]}">${L[i][0]}</b> — ${L[i][2]}<br><span style="color:var(--muted);font-style:italic">Report wording: ${L[i][3]}</span>`;
      };
      host.querySelectorAll('.conf button').forEach(b => b.onclick = () => sel(+b.dataset.i));
      sel(1);
    },

    timezone(host) {
      const presets = {
        'East Asia (UTC+8)': [9, 6, 4, 6, 8, 10, 11, 9, 8, 10, 6, 3, 2, 1, 1, 2, 1, 0, 0, 0, 0, 1, 4, 8],
        'Europe (UTC+1)': [4, 7, 9, 10, 10, 9, 6, 2, 1, 0, 0, 0, 0, 1, 3, 4, 3, 2, 2, 1, 1, 1, 1, 2],
        'US East (UTC−5)': [0, 1, 1, 3, 8, 10, 9, 6, 5, 8, 7, 9, 10, 10, 9, 8, 6, 4, 3, 2, 1, 0, 0, 0],
        'Bot (24/7)': [6, 7, 6, 6, 7, 6, 6, 7, 6, 6, 7, 6, 6, 6, 7, 6, 6, 7, 6, 6, 6, 7, 6, 6],
      };
      host.innerHTML = `<div class="wg"><div class="wg-title">ACTIVITY-HOUR ANALYSER · CLICK BARS TO EDIT</div>
        <div class="samples">${Object.keys(presets).map(k => `<button>${k}</button>`).join('')}</div>
        <div class="tz-bars"></div>
        <div class="tz-axis">${Array.from({ length: 24 }, (_, i) => `<span>${String(i).padStart(2, '0')}</span>`).join('')}</div>
        <div class="conf-out tz-out"></div></div>`;
      const bars = host.querySelector('.tz-bars'), out = host.querySelector('.tz-out');
      let data = presets['East Asia (UTC+8)'].slice();
      const render = () => {
        const max = Math.max(...data, 1);
        let best = 0, bestSum = Infinity;
        for (let s = 0; s < 24; s++) {
          let sum = 0; for (let k = 0; k < 7; k++) sum += data[(s + k) % 24];
          if (sum < bestSum) { bestSum = sum; best = s; }
        }
        const total = data.reduce((a, b) => a + b, 0) || 1;
        const flat = bestSum / total > 0.22;
        bars.innerHTML = data.map((v, i) => {
          const inSleep = !flat && ((i - best + 24) % 24) < 7;
          return `<div data-i="${i}" class="${inSleep ? 'sleep' : ''}" style="height:${Math.max(2, v / max * 100)}%" title="${String(i).padStart(2, '0')}:00 UTC · ${v} txs"></div>`;
        }).join('');
        let off = (1 - best + 24) % 24; if (off > 12) off -= 24;
        out.innerHTML = flat
          ? `<b style="color:var(--amber)">No clear sleep window.</b> Activity is spread across all hours — consistent with automation (bots, exchange hot wallets) or multiple operators. Timezone inference is not appropriate.`
          : `Quietest 7-hour window: <b>${String(best).padStart(2, '0')}:00–${String((best + 7) % 24).padStart(2, '0')}:00 UTC</b>. If that is ~01:00–08:00 local sleep, the operator is plausibly around <b style="color:var(--cyan)">UTC${off >= 0 ? '+' : '−'}${Math.abs(off)}</b>. <span style="color:var(--muted)">Confidence: Low — corroborate with other evidence.</span>`;
      };
      bars.addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        const r = bars.getBoundingClientRect();
        const v = Math.round((1 - (e.clientY - r.top) / r.height) * 12);
        data[+b.dataset.i] = Math.max(0, v); render();
      });
      host.querySelectorAll('.samples button').forEach(b => b.onclick = () => { data = presets[b.textContent].slice(); render(); });
      render();
    },
  };

  window.WIDGETS = W;
})();
