/* Case labs: realistic (fictional) investigations. Click nodes to answer. */
window.LABS = [
  {
    id: 'lab1', title: 'Operation Glass Wallet', chain: 'Bitcoin', level: 'Analyst', color: '#ffd84d',
    brief: `A logistics company paid a <b>2.4 BTC</b> ransom. Their incident team gives you the payment tx. Your mission: link the ransom wallet to other addresses, follow the money through change, and find the strongest attribution lead.`,
    scene: {
      title: 'Case 0x01 — Ransom payment trace',
      nodes: [
        { id: 'vic', type: 'victim', label: 'Victim payment', sub: '2.40 BTC', x: 60, y: 260, info: { Tx: 'a4c1…77e0', Time: '2026-02-11 03:14 UTC' } },
        { id: 'r', type: 'suspect', label: 'Ransom addr', sub: 'bc1qr8…x2v', x: 260, y: 260, info: { Received: '2.40 BTC', Script: 'P2WPKH' } },
        { id: 'q', type: 'unknown', label: 'Addr Q', sub: 'bc1q9d…kk3', x: 260, y: 470, info: { Value: '0.80 BTC', Script: 'P2WPKH', History: 'Received from 3 other ransom payments' } },
        { id: 't1', type: 'tx', label: 'Tx 1', x: 470, y: 360, info: { Inputs: 'Ransom addr + Addr Q', Outputs: '2', 'CoinJoin?': 'No (2 outputs, unequal)' } },
        { id: 'o1', type: 'unknown', label: 'Output A', sub: '3Fq7…Lp · 1.50000000', x: 720, y: 200, info: { Value: '1.50000000 BTC', Script: 'P2SH', History: 'Receives from ~4,000 addresses, swept daily to Exchange K hot wallet' }, note: 'Huge number of unrelated senders + daily sweep to a known exchange = exchange deposit address.' },
        { id: 'o2', type: 'unknown', label: 'Output B', sub: 'bc1qh4…0az · 1.69968200', x: 720, y: 470, info: { Value: '1.69968200 BTC', Script: 'P2WPKH', History: 'Fresh — first seen in Tx 1' } },
        { id: 't2', type: 'tx', label: 'Tx 2', x: 930, y: 470 },
        { id: 'o3', type: 'service', label: 'Gambling svc', sub: '0.30 BTC', x: 1140, y: 360, info: { Label: 'Online casino (non-KYC)' } },
        { id: 'o4', type: 'unknown', label: 'Output D', sub: 'bc1qa1…77t · 1.39951', x: 1140, y: 580, info: { Script: 'P2WPKH', History: 'Fresh' } },
      ],
      edges: [
        { from: 'vic', to: 'r', label: '2.40' },
        { from: 'r', to: 't1' }, { from: 'q', to: 't1' },
        { from: 't1', to: 'o1', label: '1.5' }, { from: 't1', to: 'o2', label: '1.699682' },
        { from: 'o2', to: 't2' }, { from: 't2', to: 'o3', label: '0.3' }, { from: 't2', to: 'o4', label: '1.39951' },
      ],
    },
    tasks: [
      { type: 'node', q: 'Which address can be clustered with the ransom address using the common-input-ownership heuristic?', answer: ['q'], x: 'Addr Q is co-spent with the ransom address in Tx 1 (not a CoinJoin), so the same entity likely controls both. Bonus: Q also received other ransoms — linking victims.' },
      { type: 'node', q: 'Click the CHANGE output of Tx 1.', answer: ['o2'], x: 'Output B is non-round, matches the inputs\' P2WPKH script type, is a fresh address, and is spent onward by the same actor.' },
      { type: 'node', q: 'Which node is the strongest attribution lead?', answer: ['o1'], x: 'Output A is an exchange deposit address (thousands of senders, swept to Exchange K). Exchange K can identify the account holder via legal process.' },
      { type: 'choice', q: 'What do you send to Exchange K?', a: ['A tweet tagging the exchange', 'A law-enforcement request citing deposit address 3Fq7…Lp, Tx 1 hash, amount & UTC time, requesting KYC, IPs and withdrawal history', 'A request to reverse the transaction', 'Nothing — exchanges never help'], c: 1, x: 'Precise identifiers + specific record requests via proper legal channels get results.' },
    ],
  },
  {
    id: 'lab2', title: 'Drained at Midnight', chain: 'Ethereum', level: 'Analyst', color: '#5b8cff',
    brief: `An NFT collector lost <b>42,000 USDC</b> and three NFTs after "claiming an airdrop". They insist they never sent the funds. Identify how the theft worked and who profited.`,
    scene: {
      title: 'Case 0x02 — Approval phishing',
      nodes: [
        { id: 'v', type: 'victim', label: 'Victim', sub: '0x9b1…4e2', x: 80, y: 300 },
        { id: 'usdc', type: 'contract', label: 'USDC contract', x: 320, y: 140, info: { Event: 'Approval(victim → 0xDr41…, MAX)', Time: '23:58 UTC' } },
        { id: 'nft', type: 'contract', label: 'NFT collection', x: 320, y: 480, info: { Event: 'ApprovalForAll(victim → 0xDr41…, true)' } },
        { id: 'dc', type: 'contract', label: '0xDr41…', sub: 'unverified contract', x: 590, y: 300, info: { Deployer: '0xOp99…', 'Calls': 'transferFrom on 210 victims' } },
        { id: 'aff', type: 'unknown', label: '0xAf7e…', x: 860, y: 160, info: { Receives: '80% of every drain', Victims: '12 (this affiliate)' } },
        { id: 'op', type: 'unknown', label: '0xOp99…', x: 860, y: 450, info: { Receives: '20% of every drain', Victims: '210 (all affiliates)', Deployed: '0xDr41…' } },
        { id: 'v2', type: 'victim', label: 'Other victims', sub: '209', x: 590, y: 600 },
        { id: 'br', type: 'bridge', label: 'Bridge', x: 1100, y: 300 },
      ],
      edges: [
        { from: 'v', to: 'usdc', label: 'approve(MAX)', dashed: true }, { from: 'v', to: 'nft', label: 'setApprovalForAll', dashed: true },
        { from: 'usdc', to: 'dc', label: '42,000 USDC' }, { from: 'nft', to: 'dc', label: '3 NFTs' },
        { from: 'v2', to: 'dc', label: 'drained' },
        { from: 'dc', to: 'aff', label: '80%' }, { from: 'dc', to: 'op', label: '20%' },
        { from: 'aff', to: 'br' }, { from: 'op', to: 'br' },
      ],
    },
    tasks: [
      { type: 'node', q: 'Which address was granted spending rights and executed the theft?', answer: ['dc'], x: '0xDr41… is the approved spender. It called transferFrom — the theft tx was sent by the attacker side, not the victim.' },
      { type: 'node', q: 'Which address is most likely the drainer-kit OPERATOR (not the affiliate)?', answer: ['op'], x: '0xOp99… deployed the drainer contract and takes a consistent 20% cut from all 210 victims across affiliates — the kit operator.' },
      { type: 'choice', q: 'First advice to the victim?', a: ['Send more funds to test', 'Revoke all approvals to 0xDr41… and move remaining assets to a new wallet', 'Contact the airdrop site support', 'Do nothing until the report is ready'], c: 1, x: 'Stop the bleeding first: revoke approvals and migrate to a fresh wallet.' },
    ],
  },
  {
    id: 'lab3', title: 'Operation Golden Lotus', chain: 'TRON / Ethereum', level: 'Investigator', color: '#ff3d71',
    brief: `A retiree lost <b>$310,000</b> to a fake trading app over 4 months. Funds left their exchange account as USDT. Find the network, other victims, and a chance to freeze funds — fast.`,
    scene: {
      title: 'Case 0x03 — Pig-butchering network',
      nodes: [
        { id: 'v', type: 'victim', label: 'Victim exch. acct', x: 60, y: 300 },
        { id: 'dep', type: 'suspect', label: '"LotusFX" deposit', sub: 'TQx8…f1', x: 300, y: 300, info: { 'Unique senders': '61', 'Forwarding delay': '< 10 min' } },
        { id: 'ov', type: 'victim', label: '60 other senders', sub: 'retail-sized', x: 300, y: 540 },
        { id: 'c', type: 'unknown', label: 'TCon…a9', x: 560, y: 300, info: { 'Receives from': '7 platform deposit addresses', Volume: '$14.2M USDT' } },
        { id: 'h1', type: 'unknown', label: 'TH1…02', x: 800, y: 140, info: { Balance: '0', Activity: 'forwarded within 2 min' } },
        { id: 'h2', type: 'unknown', label: 'TH2…7c', x: 800, y: 460, info: { Balance: '412,000 USDT (unmoved 3 days)', Asset: 'USDT-TRC20' } },
        { id: 'otc', type: 'otc', label: 'OTC broker', x: 1060, y: 140, info: { Label: 'Suspected OTC — high-volume, many illicit sources' } },
      ],
      edges: [
        { from: 'v', to: 'dep', label: '$310k USDT' }, { from: 'ov', to: 'dep' },
        { from: 'dep', to: 'c' },
        { from: 'c', to: 'h1', label: '$9.1M' }, { from: 'c', to: 'h2', label: '$412k' },
        { from: 'h1', to: 'otc' },
      ],
    },
    tasks: [
      { type: 'node', q: 'Click the network\'s CONSOLIDATION wallet.', answer: ['c'], x: 'TCon…a9 receives from 7 different "platform" deposit addresses — it aggregates the whole operation.' },
      { type: 'node', q: 'Where is the best chance of a near-term FREEZE?', answer: ['h2'], x: '412,000 USDT has sat unmoved in TH2…7c for 3 days. USDT is issuer-freezable — escalate to law enforcement for an issuer freeze request immediately.' },
      { type: 'choice', q: 'How do you scale this from one victim to a network case?', a: ['Ignore the other senders', 'Analyse all 60 other senders to the deposit address and the 7 platform addresses feeding the consolidation — they are likely victims', 'Message the scammers', 'Wait for more complaints'], c: 1, x: 'Shared infrastructure reveals more victims and strengthens the case.' },
    ],
  },
  {
    id: 'lab4', title: 'The Bridge Hopper', chain: 'Multi-chain', level: 'Investigator', color: '#00e5c7',
    brief: `A hacker sent <b>3.000 BTC</b> to an instant swap service at <b>14:02 UTC</b>, receiving ETH, then bridged to Arbitrum. At the time, <b>1 BTC = 21.0 ETH</b>. Match each leg using value and time.`,
    scene: {
      title: 'Case 0x04 — Cross-chain matching',
      nodes: [
        { id: 'b', type: 'suspect', label: 'Hacker BTC', sub: '3.000 BTC · 14:02', x: 60, y: 300 },
        { id: 'sw', type: 'service', label: 'Swap service', x: 280, y: 300 },
        { id: 'e1', type: 'unknown', label: '0xE1…', sub: '63.0 ETH · 09:15', x: 520, y: 100, info: { Value: '63.0 ETH', Time: '09:15 UTC (5 h before)' } },
        { id: 'e2', type: 'unknown', label: '0xE2…', sub: '62.1 ETH · 14:19', x: 520, y: 300, info: { Value: '62.1 ETH', Time: '14:19 UTC' } },
        { id: 'e3', type: 'unknown', label: '0xE3…', sub: '21.0 ETH · 14:05', x: 520, y: 500, info: { Value: '21.0 ETH', Time: '14:05 UTC' } },
        { id: 'br', type: 'bridge', label: 'Bridge', sub: 'ETH → Arbitrum', x: 760, y: 300, info: { 'Deposit from 0xE2…': '62.0 ETH at 14:31' } },
        { id: 'a1', type: 'unknown', label: 'arb 0xA1…', sub: '61.94 ETH · 14:33', x: 1000, y: 160, info: { Value: '61.94 ETH', Time: '14:33 UTC' } },
        { id: 'a2', type: 'unknown', label: 'arb 0xA2…', sub: '12.4 ETH · 14:32', x: 1000, y: 440, info: { Value: '12.4 ETH', Time: '14:32 UTC' } },
      ],
      edges: [
        { from: 'b', to: 'sw', label: '3 BTC' },
        { from: 'sw', to: 'e1', dashed: true, flow: 0 }, { from: 'sw', to: 'e2', dashed: true, flow: 0 }, { from: 'sw', to: 'e3', dashed: true, flow: 0 },
        { from: 'e2', to: 'br', label: '62.0 ETH' },
        { from: 'br', to: 'a1', dashed: true, flow: 0 }, { from: 'br', to: 'a2', dashed: true, flow: 0 },
      ],
    },
    tasks: [
      { type: 'node', q: 'Which ETH payout matches the 3 BTC swap?', answer: ['e2'], x: '3 × 21 = 63 ETH expected. 62.1 ETH (−1.4% fees/spread) 17 minutes later fits. 0xE1 is before the deposit; 0xE3 is far too small.' },
      { type: 'node', q: 'Which Arbitrum address received the bridged funds?', answer: ['a1'], x: '62.0 ETH deposited at 14:31 → 61.94 ETH released at 14:33 (small bridge fee). Confirm with the bridge\'s message ID.' },
      { type: 'choice', q: 'What can the swap service provide under legal process?', a: ['Nothing — it is non-custodial', 'The order record linking deposit and payout, plus IP/user data it logged', 'The suspect\'s private keys', 'A refund automatically'], c: 1, x: 'Swap services keep order databases linking both legs, often with IP and contact data.' },
    ],
  },
  {
    id: 'lab5', title: 'Poisoned History', chain: 'Ethereum', level: 'Rookie', color: '#ffb547',
    brief: `A fund manager sent <b>250,000 USDT</b> to "their custody provider" — and it never arrived. They copied the address from their wallet history. Find out what happened.`,
    scene: {
      title: 'Case 0x05 — Where did it go?',
      nodes: [
        { id: 'v', type: 'victim', label: 'Fund wallet', x: 80, y: 300 },
        { id: 'r', type: 'exchange', label: '0x7Fa2c…09bD1', sub: 'custody provider', x: 500, y: 100, info: { Address: '0x7Fa2c3e1…d4a09bD1', History: '22 previous transfers from fund' } },
        { id: 'f', type: 'unknown', label: '0x7Fa2e…09bD1', x: 500, y: 500, info: { Address: '0x7Fa2e8b0…11f09bD1', 'First seen': '0-value USDT transfer to fund wallet, 4 min after last real payment' } },
        { id: 'g', type: 'unknown', label: '0xGas…', sub: 'funded 1,800 lookalikes', x: 860, y: 500, info: { Pattern: 'Funds gas for thousands of vanity addresses' } },
      ],
      edges: [
        { from: 'v', to: 'r', label: '22 prior transfers', bend: -0.1 },
        { from: 'f', to: 'v', label: '0 USDT', dashed: true },
        { from: 'v', to: 'f', label: '250,000 USDT', bend: 0.25, color: '#ff3d71' },
        { from: 'g', to: 'f', label: 'gas', dashed: true },
      ],
    },
    tasks: [
      { type: 'node', q: 'Click the lookalike (poisoning) address.', answer: ['f'], x: 'Same prefix "0x7Fa2" and suffix "09bD1" but different middle — and it first appeared with a 0-value transfer.' },
      { type: 'node', q: 'Which node lets you link this to a wider campaign?', answer: ['g'], x: 'The gas funder bankrolls thousands of lookalike addresses — the campaign\'s infrastructure.' },
    ],
  },
  {
    id: 'lab6', title: 'Rug Hunter', chain: 'Base (EVM)', level: 'Elite', color: '#b06bff',
    brief: `Token <b>$NOVA</b> went to zero after the deployer pulled <b>520 ETH</b> of liquidity. Investors want to know who did it and whether they've done it before.`,
    scene: {
      title: 'Case 0x06 — Serial rugger',
      nodes: [
        { id: 'cex', type: 'exchange', label: 'Exchange withdrawal', sub: 'hot wallet', x: 60, y: 120, info: { Tx: 'withdrawal 0.8 ETH', Time: '40 min before deploy' } },
        { id: 'dep', type: 'suspect', label: 'Deployer', sub: '0xD3v…', x: 300, y: 260, info: { Nonce: '3', Created: '$NOVA, $LUNARX, $ORBIT' } },
        { id: 'nova', type: 'contract', label: '$NOVA', sub: 'owner can blacklist', x: 300, y: 500 },
        { id: 'lp', type: 'defi', label: 'NOVA/WETH LP', sub: 'LP NOT locked', x: 560, y: 500 },
        { id: 'buy', type: 'victim', label: '1,900 buyers', x: 820, y: 600 },
        { id: 'exit', type: 'unknown', label: '0xEx1…', x: 560, y: 260, info: { Received: '520 ETH removeLiquidity' } },
        { id: 'old', type: 'contract', label: '$LUNARX (2025)', sub: 'also rugged', x: 820, y: 120, info: { Deployer: 'funded by 0xEx1… (!)' } },
        { id: 'mx', type: 'mixer', label: 'Privacy pool', x: 1060, y: 260 },
      ],
      edges: [
        { from: 'cex', to: 'dep', label: '0.8 ETH' },
        { from: 'dep', to: 'nova', dashed: true, label: 'deploy' },
        { from: 'dep', to: 'lp', label: '+20 ETH' }, { from: 'buy', to: 'lp', label: 'buys' },
        { from: 'lp', to: 'exit', label: '520 ETH', color: '#ff3d71' },
        { from: 'exit', to: 'old', dashed: true, label: 'funded deployer' },
        { from: 'exit', to: 'mx', label: '300 ETH' },
      ],
    },
    tasks: [
      { type: 'node', q: 'Strongest identity lead for the deployer?', answer: ['cex'], x: 'The deployer\'s gas came from an exchange withdrawal 40 minutes before deploy — the exchange knows which customer requested it.' },
      { type: 'node', q: 'Which node proves this is a SERIAL rugger?', answer: ['old'], x: 'The exit wallet funded the deployer of $LUNARX, a previous rug — linking both operations.' },
      { type: 'choice', q: 'Which pre-launch red flag would have warned investors?', a: ['High trading volume', 'Liquidity (LP tokens) not locked or burned + owner blacklist power', 'A nice website', 'Verified contract'], c: 1, x: 'Unlocked LP lets the owner withdraw liquidity; blacklist powers can block sells.' },
    ],
  },
];

/* ---------- Pattern Dojo: procedural pattern generators ---------- */
(function () {
  const R = (a, b) => a + Math.random() * (b - a);
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const amt = (a, b, d = 2) => R(a, b).toFixed(d);
  const jitter = (v, j = 18) => v + R(-j, j);

  const G = {
    'Peel chain': () => {
      const n = [], e = []; let big = R(30, 90); const hops = RI(4, 6);
      n.push({ id: 's', type: 'unknown', label: big.toFixed(2), x: 60, y: 120 });
      let prev = 's';
      for (let i = 0; i < hops; i++) {
        const t = 'p' + i, x = 200 + i * 170, y = 160 + i * 50;
        n.push({ id: t, type: 'unknown', label: 'addr', x: jitter(x), y: jitter(y) });
        const peel = R(0.3, 1.8); big -= peel;
        n.push({ id: 'k' + i, type: 'unknown', label: 'addr', x: jitter(x), y: jitter(y + 220) });
        e.push({ from: prev, to: t, label: big.toFixed(2) }, { from: prev, to: 'k' + i, label: peel.toFixed(2) });
        prev = t;
      }
      return { nodes: n, edges: e };
    },
    'CoinJoin': () => {
      const n = [], e = [], k = RI(5, 8), d = [0.01, 0.05, 0.1, 0.5][RI(0, 3)];
      n.push({ id: 'cj', type: 'tx', label: 'tx', x: 460, y: 300 });
      for (let i = 0; i < k; i++) {
        n.push({ id: 'i' + i, type: 'unknown', label: amt(d * 1.05, d * 3, 3), x: 80, y: 40 + i * (520 / k) });
        n.push({ id: 'o' + i, type: 'unknown', label: String(d), x: 840, y: 40 + i * (520 / k) });
        e.push({ from: 'i' + i, to: 'cj', flow: 1 }, { from: 'cj', to: 'o' + i, label: String(d), flow: 1 });
      }
      return { nodes: n, edges: e };
    },
    'Fan-out / fan-in': () => {
      const n = [{ id: 's', type: 'unknown', label: 'addr', x: 60, y: 300 }, { id: 'c', type: 'unknown', label: 'addr', x: 760, y: 300 }], e = [];
      const k = RI(6, 9), v = RI(50, 200);
      for (let i = 0; i < k; i++) {
        n.push({ id: 'm' + i, type: 'unknown', label: 'addr', x: jitter(410, 30), y: 30 + i * (540 / k) });
        e.push({ from: 's', to: 'm' + i, label: String(v), flow: 1 }, { from: 'm' + i, to: 'c', flow: 1 });
      }
      return { nodes: n, edges: e };
    },
    'Exchange deposit sweep': () => {
      const n = [{ id: 'hot', type: 'unknown', label: 'addr (huge volume)', x: 760, y: 300 }], e = [];
      const k = RI(5, 7);
      for (let i = 0; i < k; i++) {
        n.push({ id: 'u' + i, type: 'unknown', label: 'addr', x: 60, y: 40 + i * (520 / k) });
        n.push({ id: 'd' + i, type: 'unknown', label: 'addr', x: 400, y: 40 + i * (520 / k) });
        e.push({ from: 'u' + i, to: 'd' + i, label: amt(0.1, 5) }, { from: 'd' + i, to: 'hot', label: 'all', flow: 1 });
      }
      return { nodes: n, edges: e };
    },
    'Wash-trading cycle': () => {
      const k = RI(3, 4), n = [{ id: 'f', type: 'unknown', label: 'addr', x: 80, y: 300 }], e = [];
      const cx = 560, cy = 300, r = 200; let p = RI(10, 30);
      for (let i = 0; i < k; i++) {
        const a = i / k * Math.PI * 2;
        n.push({ id: 'w' + i, type: 'unknown', label: 'addr', x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        e.push({ from: 'f', to: 'w' + i, dashed: true, label: 'fund', flow: 1 });
      }
      for (let i = 0; i < k; i++) { p += RI(5, 15); e.push({ from: 'w' + i, to: 'w' + ((i + 1) % k), label: 'NFT #7 · ' + p + ' ETH' }); }
      return { nodes: n, edges: e };
    },
    'Address poisoning': () => {
      const hex = '0123456789abcdef', r4 = () => Array.from({ length: 4 }, () => hex[RI(0, 15)]).join('');
      const pre = r4(), suf = r4();
      return {
        nodes: [
          { id: 'v', type: 'unknown', label: 'addr', x: 100, y: 300 },
          { id: 'r', type: 'unknown', label: `0x${pre}${r4()}…${suf}`, x: 520, y: 110 },
          { id: 'f', type: 'unknown', label: `0x${pre}${r4()}…${suf}`, x: 520, y: 490 },
        ],
        edges: [
          { from: 'v', to: 'r', label: amt(10000, 90000, 0) + ' USDT', bend: -0.1 },
          { from: 'f', to: 'v', label: '0 USDT', dashed: true },
          { from: 'v', to: 'f', label: amt(10000, 90000, 0) + ' USDT', bend: 0.25 },
        ],
      };
    },
    'Mixing pool': () => {
      const d = [1, 10, 100][RI(0, 2)], n = [{ id: 'p', type: 'contract', label: 'contract', x: 460, y: 300 }], e = [];
      const a = RI(4, 6), b = RI(3, 5);
      for (let i = 0; i < a; i++) { n.push({ id: 'd' + i, type: 'unknown', label: 'addr', x: 80, y: 40 + i * (520 / a) }); e.push({ from: 'd' + i, to: 'p', label: d + ' ETH', flow: 1 }); }
      for (let i = 0; i < b; i++) { n.push({ id: 'w' + i, type: 'unknown', label: 'fresh', x: 840, y: 60 + i * (480 / b) }); e.push({ from: 'p', to: 'w' + i, label: (d * 0.997).toFixed(3) + ' ETH', flow: 1 }); }
      return { nodes: n, edges: e };
    },
    'Rug pull': () => ({
      nodes: [
        { id: 'f', type: 'unknown', label: 'addr', x: 60, y: 120 },
        { id: 'd', type: 'unknown', label: 'addr', x: 300, y: 120 },
        { id: 't', type: 'contract', label: 'new token', x: 300, y: 400 },
        { id: 'lp', type: 'contract', label: 'pool', x: 600, y: 400 },
        { id: 'b', type: 'unknown', label: RI(300, 3000) + ' addrs', x: 600, y: 600 },
        { id: 'x', type: 'unknown', label: 'addr', x: 880, y: 220 },
      ],
      edges: [
        { from: 'f', to: 'd', label: amt(0.2, 1) + ' ETH' },
        { from: 'd', to: 't', label: 'create', dashed: true },
        { from: 'd', to: 'lp', label: '+' + RI(5, 30) + ' ETH' },
        { from: 'b', to: 'lp', label: 'buy' },
        { from: 'lp', to: 'x', label: 'remove ' + RI(200, 900) + ' ETH' },
      ],
    }),
    'Drainer split': () => {
      const n = [{ id: 'c', type: 'contract', label: 'contract', x: 460, y: 300 }, { id: 'a', type: 'unknown', label: 'addr', x: 820, y: 160 }, { id: 'o', type: 'unknown', label: 'addr', x: 820, y: 440 }], e = [];
      const k = RI(4, 6);
      for (let i = 0; i < k; i++) {
        n.push({ id: 'v' + i, type: 'unknown', label: 'addr', x: 80, y: 40 + i * (520 / k) });
        e.push({ from: 'v' + i, to: 'c', label: 'transferFrom', flow: 1 });
      }
      e.push({ from: 'c', to: 'a', label: '80%' }, { from: 'c', to: 'o', label: '20%' });
      return { nodes: n, edges: e };
    },
    'Consolidation (co-spend)': () => {
      const n = [{ id: 't', type: 'tx', label: 'tx', x: 460, y: 300 }, { id: 'o', type: 'unknown', label: 'addr', x: 820, y: 300 }], e = [];
      const k = RI(6, 10); let s = 0;
      for (let i = 0; i < k; i++) {
        const v = R(0.01, 0.4); s += v;
        n.push({ id: 'i' + i, type: 'unknown', label: v.toFixed(4), x: 80, y: 30 + i * (540 / k) });
        e.push({ from: 'i' + i, to: 't', flow: 1 });
      }
      e.push({ from: 't', to: 'o', label: (s - 0.0004).toFixed(4) });
      return { nodes: n, edges: e };
    },
  };

  window.DOJO = {
    patterns: Object.keys(G),
    hints: {
      'Peel chain': 'Each hop: one small output + one large remainder.',
      'CoinJoin': 'Many inputs of varied value → many outputs of IDENTICAL value.',
      'Fan-out / fan-in': 'One splits into many equal pieces that re-converge.',
      'Exchange deposit sweep': 'One deposit address per user, all swept into one huge wallet.',
      'Wash-trading cycle': 'Common funder + the same asset trading in a loop at rising prices.',
      'Address poisoning': 'Lookalike prefix/suffix + a 0-value transfer.',
      'Mixing pool': 'Fixed denomination deposits → slightly smaller withdrawals to fresh addresses.',
      'Rug pull': 'Fresh deployer → token + pool → buyers in → liquidity removed.',
      'Drainer split': 'Many victims via transferFrom → automatic 80/20 split.',
      'Consolidation (co-spend)': 'Many small inputs merged into one output: one wallet tidying UTXOs.',
    },
    generate(name) { return Object.assign({ title: 'Unknown pattern — identify it' }, G[name]()); },
  };
})();
