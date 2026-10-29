/* ChainSight Academy curriculum.
   Lesson bodies are HTML. Embed an interactive model with <div class="model" data-model="id"></div>
   and a live widget with <div class="widget" data-widget="id"></div>. */
window.COURSE = [
  /* ======================================================================= */
  {
    id: 'm1', code: '01', title: 'Blockchain Foundations', color: '#38e1ff',
    tagline: 'What the ledger actually records — and what it doesn\'t.',
    lessons: [
      {
        id: 'm1l1', title: 'The ledger is the evidence', mins: 8,
        body: `
<p class="lead">A public blockchain is a <b>shared, append-only ledger</b> replicated across thousands of computers. For an investigator, it is something remarkable: a permanent, timestamped, tamper-evident record of every transfer that has ever happened on that network.</p>
<h3>Four properties that make tracing possible</h3>
<div class="grid4">
  <div class="card-mini"><b>Public</b><span>Anyone can read every transaction, without permission or subpoena.</span></div>
  <div class="card-mini"><b>Immutable</b><span>Once buried under enough blocks, history cannot practically be rewritten.</span></div>
  <div class="card-mini"><b>Timestamped</b><span>Every block has a time — giving you a timeline of events.</span></div>
  <div class="card-mini"><b>Pseudonymous</b><span>Identities are addresses, not names. Your job is to bridge that gap.</span></div>
</div>
<h3>Blocks, hashes and why tampering shows</h3>
<p>Each block contains a batch of transactions and the <b>hash</b> of the previous block. A hash is a fingerprint: change one character of the input and the output changes completely. Try it:</p>
<div class="widget" data-widget="hash"></div>
<p>Because every block commits to the one before it, altering an old transaction would change its block hash, breaking every following block. That is why a confirmed transaction is <b>strong evidence</b> — courts around the world have accepted blockchain records analysed by qualified experts.</p>
<div class="callout key"><b>Key concept — Pseudonymity ≠ anonymity.</b> Every address is a persistent identifier. One mistake by a criminal — reusing an address, depositing to a KYC exchange, posting an address online — can unmask an entire history.</div>
<h3>What the chain does NOT tell you</h3>
<ul class="check">
  <li><b>Who</b> controls an address (that is attribution — Module 07).</li>
  <li><b>Why</b> money moved — a transfer to an exchange could be a sale, a deposit for later, or a payment to a third party.</li>
  <li><b>Off-chain activity</b> — internal exchange ledger moves, OTC cash handoffs, and Lightning payments often leave no public trace.</li>
</ul>
<div class="callout warn"><b>Pitfall.</b> Beginners treat explorer labels ("Binance 14") as facts. Labels are claims made by someone. Always note the <b>source</b> and <b>confidence</b> of every attribution you rely on.</div>`,
        quiz: [
          { q: 'Why is a confirmed transaction hard to alter?', a: ['It is stored by the exchange', 'Each block commits to the previous block\'s hash, so changes break the chain', 'It is encrypted with the sender\'s private key', 'Miners delete old blocks'], c: 1, x: 'Hash-linking means altering any historical data invalidates all following blocks, which the network would reject.' },
          { q: '"Pseudonymous" means…', a: ['Nobody can ever be identified', 'Identities are persistent addresses that can potentially be linked to real people', 'Names are visible on-chain', 'Only police can read the chain'], c: 1, x: 'Addresses are stable identifiers. Linking them to real-world identity is attribution.' },
        ],
      },
      {
        id: 'm1l2', title: 'UTXO vs account model', mins: 12,
        body: `
<p class="lead">Different chains record value in fundamentally different ways. Your tracing technique must match the model.</p>
<h3>UTXO model (Bitcoin, Litecoin, Bitcoin Cash, Dogecoin, Zcash transparent)</h3>
<p>Value lives in <b>Unspent Transaction Outputs</b>. A transaction consumes whole outputs as inputs and creates new outputs. Leftover value comes back as <b>change</b>. Drag the nodes, then step through the model:</p>
<div class="model" data-model="utxo"></div>
<h3>Account model (Ethereum & EVM chains, TRON, Solana*)</h3>
<p>Each address has a <b>balance</b> that goes up and down, like a bank account. There is no change output. Tokens are entries inside a smart contract's storage, and their movements are announced by <b>event logs</b>.</p>
<div class="model" data-model="account"></div>
<table class="tbl">
  <tr><th></th><th>UTXO</th><th>Account</th></tr>
  <tr><td>Unit of value</td><td>Discrete outputs</td><td>Balances per address</td></tr>
  <tr><td>Key heuristics</td><td>Common-input ownership, change detection</td><td>Funding source, nonce/behaviour, token approvals, deposit-address patterns</td></tr>
  <tr><td>Where tokens live</td><td>Mostly native coin only</td><td>Smart-contract state + Transfer logs</td></tr>
  <tr><td>Hidden movements</td><td>Rare (all in tx)</td><td><b>Internal transactions</b> (traces)</td></tr>
</table>
<p class="small">*Solana uses accounts but with its own program/token-account structure — token balances sit in associated token accounts owned by a wallet.</p>
<div class="callout tip"><b>Elite tip.</b> On EVM chains, if money "disappears", check three tabs: <b>Transactions</b>, <b>Internal Txns</b> and <b>Token Transfers</b>. Most beginner dead-ends are just an unchecked tab.</div>`,
        quiz: [
          { q: 'A Bitcoin tx spends inputs of 1.0 and 0.4 BTC and creates outputs of 1.2 and 0.199 BTC. What is the fee?', a: ['0.001 BTC', '0.2 BTC', '0.199 BTC', 'There is no fee'], c: 0, x: '1.4 − 1.2 − 0.199 = 0.001 BTC. Fees are implicit: inputs minus outputs.' },
          { q: 'You send USDT on Ethereum. What is the "to" field of the transaction?', a: ['The recipient\'s address', 'The USDT token contract', 'The miner', 'A bridge'], c: 1, x: 'Token transfers are calls to the token contract; the recipient is a parameter and appears in the Transfer event.' },
          { q: 'Where do you see ETH sent by a smart contract during execution?', a: ['Token Transfers tab', 'Internal transactions / traces', 'The mempool', 'It is invisible forever'], c: 1, x: 'Contract-initiated value transfers are internal transactions, visible via traces.' },
        ],
      },
      {
        id: 'm1l3', title: 'Addresses, keys & reading an explorer', mins: 10,
        body: `
<p class="lead">An address is derived from a public key (or a script / contract). Its <b>format alone</b> tells you the chain and often the wallet type — that's your first clue.</p>
<div class="widget" data-widget="addrid"></div>
<h3>Format cheat sheet</h3>
<table class="tbl">
  <tr><th>Prefix</th><th>Meaning</th></tr>
  <tr><td><code>1…</code></td><td>Bitcoin legacy P2PKH</td></tr>
  <tr><td><code>3…</code></td><td>Bitcoin P2SH — multisig or wrapped SegWit (exchanges, older wallets)</td></tr>
  <tr><td><code>bc1q…</code></td><td>Bitcoin native SegWit (P2WPKH / P2WSH)</td></tr>
  <tr><td><code>bc1p…</code></td><td>Bitcoin Taproot (P2TR)</td></tr>
  <tr><td><code>0x…</code> (40 hex)</td><td>Any EVM chain — the <b>same address</b> can exist on Ethereum, BSC, Polygon, Arbitrum, Base…</td></tr>
  <tr><td><code>T…</code> (34 chars)</td><td>TRON</td></tr>
  <tr><td>Base58, 32–44 chars</td><td>Solana</td></tr>
  <tr><td><code>4…/8…</code> (95 chars)</td><td>Monero (privacy coin — amounts & links hidden)</td></tr>
</table>
<div class="callout warn"><b>Classic mistake.</b> An EVM <code>0x</code> address is valid on every EVM chain. A victim saying "I sent to 0xabc…" is not enough — always confirm <b>which chain</b> and get the <b>transaction hash</b>.</div>
<h3>Reading an explorer like a pro</h3>
<ol class="steps">
  <li><b>Start from the tx hash</b>, not the address — it pins chain, time, block and exact amounts.</li>
  <li>Record: chain, tx hash, block height, UTC timestamp, from, to, asset, amount, fee.</li>
  <li>Open the counterparties: first-funding transaction, total received, transaction count, labels.</li>
  <li><b>Cross-check</b> on a second explorer. Explorers differ in labels and in how they show internal/token movements.</li>
</ol>
<div class="callout tip"><b>Elite tip.</b> Always record times in <b>UTC</b> and keep explorer screenshots with URL + capture time. Time-zone confusion has wrecked real cases.</div>`,
        quiz: [
          { q: 'An address starts with "bc1p". What is it?', a: ['Ethereum contract', 'Bitcoin Taproot', 'TRON', 'Bitcoin legacy'], c: 1, x: 'bc1p is the Bech32m prefix for Taproot (P2TR) outputs.' },
          { q: 'A victim gives you only "0x4e2a…". What should you ask for first?', a: ['Their seed phrase', 'The transaction hash and which chain', 'The exchange password', 'Nothing — Ethereum is assumed'], c: 1, x: 'The same 0x address exists on every EVM chain. The tx hash and chain remove ambiguity. Never ask for seed phrases.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm2', code: '02', title: 'Investigation Methodology', color: '#2bff9e',
    tagline: 'The repeatable process elite investigators follow every time.',
    lessons: [
      {
        id: 'm2l1', title: 'The investigation lifecycle', mins: 10,
        body: `
<p class="lead">Talent finds leads. <b>Process</b> makes them stand up in court. Every professional crypto investigation follows the same loop.</p>
<div class="flow">
  <div><b>1 · Intake</b><span>Victim facts, tx hashes, chains, timeline, screenshots, communications with suspect.</span></div>
  <div><b>2 · Scope</b><span>What question must be answered? Recovery? Prosecution? Compliance? Define the end state.</span></div>
  <div><b>3 · Trace</b><span>Follow value hop by hop. Apply heuristics. Note confidence for each hop.</span></div>
  <div><b>4 · Attribute</b><span>Where do funds touch identifiable services or people?</span></div>
  <div><b>5 · Act</b><span>Freeze requests, legal process, alerts, reporting to authorities.</span></div>
  <div><b>6 · Report</b><span>Reproducible findings: every claim tied to on-chain data.</span></div>
</div>
<h3>Intake checklist</h3>
<ul class="check">
  <li>Transaction hashes (not just addresses) and the chain for each</li>
  <li>Victim's own wallet addresses and exchange accounts</li>
  <li>Exact amounts, assets and UTC times</li>
  <li>All suspect identifiers: usernames, phone numbers, emails, websites, app names, domains</li>
  <li>Screenshots of chats and fake platforms (with metadata if possible)</li>
</ul>
<div class="callout key"><b>Golden rule — follow the money, not the noise.</b> At each hop pick the flows that carry the <b>value of interest</b>. A wallet with 400 outgoing transactions usually has 2–3 that matter.</div>
<h3>Choosing which path to follow</h3>
<p>Prioritise by: <b>(1)</b> amount of victim funds carried, <b>(2)</b> proximity to an off-ramp/freezable asset, <b>(3)</b> time sensitivity (funds still moving), <b>(4)</b> attribution potential.</p>
<div class="callout tip"><b>Elite tip — FIFO vs proportional vs LIFO.</b> Once victim funds mix with other money in a wallet, which outgoing funds are "the victim's"? Agree on an accounting method (FIFO, LIFO, pro-rata, or "poison"/haircut) and <b>state it in your report</b>. Courts and clients will ask.</div>`,
        quiz: [
          { q: 'What is the most reliable starting artefact at intake?', a: ['A screenshot of a wallet balance', 'Transaction hashes with their chains', 'The suspect\'s nickname', 'An explorer label'], c: 1, x: 'Tx hashes unambiguously pin chain, block, time, amount and parties.' },
          { q: 'Why must you state your tracing accounting method (FIFO, pro-rata…)?', a: ['Explorers require it', 'Mixed wallets make "which coins are the victim\'s" a methodological choice that affects amounts', 'It increases speed', 'It is only needed for Bitcoin'], c: 1, x: 'Commingled funds require an allocation method; different methods yield different traced amounts.' },
        ],
      },
      {
        id: 'm2l2', title: 'Evidence handling & confidence levels', mins: 9,
        body: `
<p class="lead">Your findings are only as good as their documentation. Write every case as if a hostile expert will check each hop — because one might.</p>
<h3>The confidence scale</h3>
<div class="widget" data-widget="confidence"></div>
<h3>Documentation standards</h3>
<ul class="check">
  <li><b>Reproducibility:</b> every hop cites a tx hash; another analyst must reach the same result.</li>
  <li><b>Separate facts from inferences:</b> "Address X sent 5 BTC to Y" (fact) vs "Y is probably change" (inference + heuristic + confidence).</li>
  <li><b>Source every attribution:</b> "Labelled Exchange Z by Tool A (accessed 2026-03-02, UTC)".</li>
  <li><b>Preserve:</b> exports, screenshots with URL + timestamp, hash of exported files (SHA-256), tool versions.</li>
  <li><b>Chain of custody:</b> who collected what, when, and how it was stored.</li>
</ul>
<div class="callout warn"><b>Never</b> overstate. "Funds were sent to Exchange Z" is defensible. "The suspect owns an account at Exchange Z" is a conclusion that requires the exchange's records.</div>
<div class="callout tip"><b>Elite tip.</b> Keep a running <b>investigation log</b> (time-stamped notes of what you checked, including dead ends). It prevents re-work and demonstrates diligence.</div>`,
        quiz: [
          { q: 'Which is a FACT rather than an inference?', a: ['Output 1 is change', 'Address A sent 2 ETH to address B in tx 0x91…', 'The suspect lives in UTC+8', 'Both addresses belong to the same person'], c: 1, x: 'The transfer itself is directly observable on-chain. The others are inferences.' },
          { q: 'A deposit to a known exchange hot-wallet cluster proves…', a: ['The suspect\'s identity', 'That funds reached that exchange; identity requires the exchange\'s records', 'Nothing at all', 'That the exchange is complicit'], c: 1, x: 'It proves the flow, not the account holder. Legal process obtains identity.' },
        ],
      },
      {
        id: 'm2l3', title: 'OPSEC & ethics for investigators', mins: 7,
        body: `
<p class="lead">You are investigating people who steal for a living. Protect yourself, the victim and the case.</p>
<ul class="check">
  <li><b>Never interact</b> with suspect wallets or contracts (no "test" transactions, no approving tokens they sent you).</li>
  <li><b>Don't touch dust or airdropped tokens</b> sent to your own or victims' addresses — they can be phishing lures or tracking.</li>
  <li>Use a <b>dedicated, isolated research environment</b> for visiting scam sites; never connect a wallet.</li>
  <li>Assume suspects monitor explorers and social media — don't tip off by publicly posting live addresses mid-case unless that's the strategy.</li>
  <li><b>Recovery scams:</b> victims are re-targeted by fake "fund recovery" services. Real investigators never guarantee recovery or demand upfront crypto.</li>
</ul>
<div class="callout key"><b>Ethics.</b> Blockchain analytics touches privacy. Work within your legal authority, respect data-protection law, and remember most activity on-chain is lawful — including privacy-seeking behaviour.</div>`,
        quiz: [
          { q: 'Tokens suddenly appear in a victim\'s wallet from the suspect. You should…', a: ['Sell them to recover losses', 'Leave them untouched and document them', 'Approve them on the token site', 'Send them back'], c: 1, x: 'Unsolicited tokens are often lures for approval phishing. Document, do not interact.' },
          { q: 'A company promises a guaranteed recovery for an upfront crypto fee. This is most likely…', a: ['Standard practice', 'A recovery scam', 'Law enforcement', 'A bridge'], c: 1, x: 'Recovery scams re-victimise people. Legitimate professionals don\'t guarantee recovery.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm3', code: '03', title: 'Bitcoin Tracing Heuristics', color: '#ffd84d',
    tagline: 'Clustering, change detection, peel chains and CoinJoin.',
    lessons: [
      {
        id: 'm3l1', title: 'Common-input-ownership & clustering', mins: 11,
        body: `
<p class="lead">The most powerful heuristic in blockchain analysis, described in the original Bitcoin whitepaper itself: <b>inputs spent together are usually controlled by the same entity.</b></p>
<div class="model" data-model="cioh"></div>
<h3>Why it works</h3>
<p>Each input needs its own valid signature. Ordinary wallets merge their own coins when one UTXO is too small for a payment. So co-spending reveals common control — and clustering is <b>transitive</b>.</p>
<h3>When it breaks</h3>
<ul class="check">
  <li><b>CoinJoin</b> (Wasabi, JoinMarket, historical Whirlpool) — multiple users' inputs in one tx by design.</li>
  <li><b>PayJoin</b> — the receiver contributes an input, disguised as a normal payment.</li>
  <li><b>Custodial/service wallets</b> — exchanges batch customers' funds; clustering an exchange is fine, but it is one service, not one person.</li>
</ul>
<div class="callout warn"><b>Cluster collapse.</b> One wrongly merged CoinJoin can fuse thousands of unrelated users into a "super cluster". If a cluster suddenly becomes enormous, suspect a bad merge.</div>`,
        quiz: [
          { q: 'Addresses A and B are inputs in tx1; B and C are inputs in tx2 (neither is a CoinJoin). Conclusion?', a: ['Only A and B are linked', 'A, B and C likely belong to one entity', 'No conclusion', 'C belongs to the miner'], c: 1, x: 'Clustering is transitive across co-spends.' },
          { q: 'Which transaction type deliberately defeats the common-input heuristic?', a: ['Coinbase', 'CoinJoin', 'OP_RETURN', 'RBF'], c: 1, x: 'CoinJoins combine inputs from many independent users.' },
        ],
      },
      {
        id: 'm3l2', title: 'Change detection', mins: 12,
        body: `
<p class="lead">To follow a Bitcoin wallet through time you must know which output came back to it. Change detection stacks several weak signals into a strong conclusion.</p>
<div class="model" data-model="change"></div>
<h3>The signals</h3>
<table class="tbl">
  <tr><th>Signal</th><th>Change likely is…</th></tr>
  <tr><td>Round amount</td><td>the <b>non-round</b> output (in BTC <i>and</i> fiat terms)</td></tr>
  <tr><td>Script type</td><td>the output matching the <b>input script type</b></td></tr>
  <tr><td>Address reuse</td><td>the <b>fresh</b> address (HD wallets generate new change addresses)</td></tr>
  <tr><td>Unnecessary input</td><td>if one input alone could have paid output X, X is likely the <b>payment</b> — so the other is change</td></tr>
  <tr><td>Wallet fingerprint</td><td>the output later spent with the <b>same fee-rate style, nVersion, nLockTime, RBF flag, input ordering</b></td></tr>
  <tr><td>Position</td><td>weak signal — many wallets randomise output order (BIP-69 sorts lexicographically)</td></tr>
</table>
<div class="callout tip"><b>Elite tip.</b> Score each output against every signal. Only call change when <b>multiple independent signals agree</b>, and record which ones you used.</div>`,
        quiz: [
          { q: 'Input: bc1q (P2WPKH). Outputs: 0.25000000 BTC to a 3… address with long history, and 0.41237719 BTC to a never-seen bc1q address. Change?', a: ['The 0.25 output', 'The 0.41237719 output', 'Both', 'Neither can be assessed'], c: 1, x: 'Non-round, same script type as input, and fresh address all point to the second output.' },
          { q: 'The "unnecessary input" heuristic says…', a: ['Wallets add extra inputs randomly', 'If a payment could have been covered by fewer inputs, the larger output is probably not the payment', 'Inputs are always change', 'Coinbase inputs are unnecessary'], c: 1, x: 'Wallets typically don\'t add inputs they don\'t need, which constrains which output is the payment.' },
        ],
      },
      {
        id: 'm3l3', title: 'Peel chains & CoinJoin analysis', mins: 12,
        body: `
<p class="lead">Two of the patterns you will see constantly in Bitcoin cases.</p>
<h3>Peel chains</h3>
<div class="model" data-model="peel"></div>
<p><b>Signature:</b> long sequence of transactions, each with <b>one small output</b> (the peel) and <b>one large output</b> (the remainder) moving to a fresh address. Common for cash-outs, OTC payments, and automated payouts.</p>
<h3>CoinJoin</h3>
<div class="model" data-model="coinjoin"></div>
<p><b>Signature:</b> many inputs, many outputs of <b>identical denominations</b>, often coordinator-specific structures (e.g. Wasabi 2.0 multiple standard denominations; Whirlpool 5-in/5-out). Tools label known CoinJoin patterns automatically.</p>
<div class="callout key"><b>Demixing reality check.</b> You usually can't cryptographically "undo" a CoinJoin. You find <b>post-mix mistakes</b>: merging mixed outputs together, merging mixed with unmixed coins, spending immediately to the same destination, or reusing addresses.</div>`,
        quiz: [
          { q: 'Which structure best describes a peel chain?', a: ['Many equal outputs per tx', 'Repeated txs with one small output and one large remainder to a fresh address', 'One tx with 500 inputs', 'Funds sent back and forth between two addresses'], c: 1, x: 'Small peel + large remainder, repeated hop by hop.' },
          { q: 'Post-CoinJoin, the suspect merges four mixed 0.1 BTC outputs in one tx. Effect?', a: ['No effect', 'It links those outputs together (CIOH on post-mix), reducing their privacy', 'It reverses the CoinJoin', 'It burns the coins'], c: 1, x: 'Consolidating mixed outputs is a classic post-mix mistake that re-links them.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm4', code: '04', title: 'Ethereum & Smart-Contract Forensics', color: '#5b8cff',
    tagline: 'Accounts, logs, approvals, DeFi and the EVM multiverse.',
    lessons: [
      {
        id: 'm4l1', title: 'EVM tracing fundamentals', mins: 11,
        body: `
<p class="lead">No change outputs, no common inputs. EVM tracing relies on <b>behaviour, funding and interaction patterns</b>.</p>
<h3>EVM linkage signals</h3>
<ul class="check">
  <li><b>Gas funding:</b> a fresh wallet must get ETH for gas from somewhere. Who funded it first is often the strongest link.</li>
  <li><b>Deposit-address reuse:</b> two wallets sending to the same exchange deposit address → same exchange account.</li>
  <li><b>Sweeps & consolidations:</b> many wallets sending everything to one address.</li>
  <li><b>Contract deployment:</b> the deployer of a scam contract and every other contract it deployed.</li>
  <li><b>Approvals:</b> who is approved to spend from whom.</li>
  <li><b>Behavioural fingerprints:</b> same gas price settings, same nonce rhythm, same active hours, same DEX/route preferences.</li>
</ul>
<div class="model" data-model="evmtoken"></div>
<div class="callout tip"><b>Elite tip — read the logs.</b> In any complex tx, open the <b>Logs</b> tab and read every <code>Transfer</code> and <code>Swap</code> event in order. The "Token Transfers" summary can hide which address actually received output.</div>`,
        quiz: [
          { q: 'Ten fresh EVM wallets each received their first 0.01 ETH from the same address. Strongest implication?', a: ['They are exchange wallets', 'Likely common controller (gas funder link)', 'They are contracts', 'Nothing'], c: 1, x: 'First gas funding is a strong behavioural link between fresh wallets.' },
          { q: 'Where is the final recipient of a DEX swap most reliably found?', a: ['The tx "to" field', 'The final Transfer event in the logs', 'The block miner', 'The router address'], c: 1, x: 'The "to" field is the router; actual output goes where the Transfer log says.' },
        ],
      },
      {
        id: 'm4l2', title: 'Approvals, permits & drainers', mins: 11,
        body: `
<p class="lead">Most modern wallet thefts don't steal private keys. They trick the victim into <b>granting permission</b>.</p>
<div class="model" data-model="drainer"></div>
<h3>The mechanics</h3>
<table class="tbl">
  <tr><th>Mechanism</th><th>On-chain trace</th></tr>
  <tr><td><code>approve(spender, amount)</code></td><td>Victim-sent tx + <code>Approval</code> event</td></tr>
  <tr><td><code>setApprovalForAll</code> (NFTs)</td><td>Victim-sent tx + <code>ApprovalForAll</code> event</td></tr>
  <tr><td>EIP-2612 <code>permit</code> / Permit2</td><td><b>Off-chain signature</b> — victim sent nothing; attacker submits it later</td></tr>
  <tr><td>Malicious contract call</td><td>Victim calls a "claim" function that transfers their assets</td></tr>
</table>
<div class="callout key"><b>Investigator key.</b> In approval thefts, the theft transaction is sent by the <b>attacker</b>, from the attacker's address. Find the spender in the Approval/permit and pivot from there.</div>
<div class="callout tip"><b>Victim triage.</b> First 5 minutes: revoke approvals (with a reputable revoke tool), move remaining assets to a <b>new</b> wallet, preserve the phishing URL and screenshots.</div>`,
        quiz: [
          { q: 'A victim swears they never sent a transaction, yet 30k USDC left via transferFrom. Most likely?', a: ['A blockchain bug', 'A prior approval or off-chain permit signature', 'Miner theft', 'The exchange reversed it'], c: 1, x: 'transferFrom executes on prior permission — approve or permit signatures.' },
          { q: 'Across 40 victims, stolen funds split 80/20 to the same two addresses. Interpretation?', a: ['Random', 'Same drainer-as-a-service kit: affiliate + operator', 'Exchange fees', 'Gas refunds'], c: 1, x: 'Consistent automated splits fingerprint a drainer kit and its operator.' },
        ],
      },
      {
        id: 'm4l3', title: 'DeFi, bridges & exploit reconstruction', mins: 13,
        body: `
<p class="lead">DeFi turns one transaction into dozens of movements. Bridges move value between chains. Exploits combine both.</p>
<div class="model" data-model="flashloan"></div>
<h3>Reconstructing an exploit</h3>
<ol class="steps">
  <li>Identify the <b>exploit tx(s)</b> and the attacker EOA + attacker contract.</li>
  <li>Use a <b>trace / debugger</b> view to list each internal call in order.</li>
  <li>Find the <b>funding</b> of the attacker EOA (often a privacy pool withdrawal or a bridge).</li>
  <li>Check if the attacker contract was <b>deployed in advance</b> — prep time & other targets.</li>
  <li>Trace profits forward; set alerts on all attacker addresses.</li>
</ol>
<h3>Bridges</h3>
<p>Most bridges: <b>lock/burn on chain A → mint/release on chain B</b>, or <b>liquidity networks</b> that pay out from a pool. Match the source deposit event with the destination fill by <b>amount (minus fees), recipient, time, and any message/nonce ID</b>. Some bridge explorers resolve both legs for you.</p>
<div class="callout warn"><b>Pitfall.</b> The destination address on chain B can be <b>different</b> from the sender on chain A. Never assume "same address, same owner" across chains without evidence.</div>`,
        quiz: [
          { q: 'A flash loan must be…', a: ['Repaid within the same transaction', 'Repaid in 30 days', 'Backed by KYC', 'Approved by a DAO'], c: 0, x: 'Flash loans are atomic: if not repaid in the same tx, everything reverts.' },
          { q: 'To link a bridge deposit on Ethereum to its release on Arbitrum you primarily match…', a: ['Gas price only', 'Amount (minus fees), recipient, timing and bridge message/nonce', 'The token logo', 'Block numbers'], c: 1, x: 'Bridge legs are linked via event data: amounts, recipient, time and message IDs.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm5', code: '05', title: 'Laundering Typologies', color: '#b06bff',
    tagline: 'How illicit funds are hidden — and how each technique leaks.',
    lessons: [
      {
        id: 'm5l1', title: 'Placement, layering, integration', mins: 8,
        body: `
<p class="lead">Crypto laundering follows the same three-stage model as traditional money laundering. Knowing which stage you're looking at tells you what to expect next.</p>
<div class="model" data-model="layering"></div>
<div class="callout key"><b>Choke points.</b> Layering can be infinitely complex, but cash-out cannot. Funds eventually need an <b>off-ramp</b> — an exchange, OTC desk, P2P trader, card program or merchant. Put your energy where identity exists.</div>`,
        quiz: [
          { q: 'Funds bounce through mixers, bridges and 40 hop wallets. Which stage?', a: ['Placement', 'Layering', 'Integration', 'Settlement'], c: 1, x: 'Obscuring the trail through complex transactions is layering.' },
        ],
      },
      {
        id: 'm5l2', title: 'Fan-out, mixers & privacy pools', mins: 13,
        body: `
<div class="model" data-model="fanout"></div>
<p><b>Fan-out/fan-in signature:</b> one-to-many burst, many-to-one convergence, near-identical amounts, sequential timing, shared gas funder.</p>
<div class="model" data-model="mixer"></div>
<h3>Demixing heuristics (probabilistic)</h3>
<ul class="check">
  <li><b>Unique amounts:</b> deposit 3 × 100 ETH + 1 × 10 ETH, then withdraw the exact same mix soon after.</li>
  <li><b>Timing:</b> deposit and withdrawal within a short window when few others used the pool.</li>
  <li><b>Address linkage:</b> withdrawal address later interacts with the depositor's known addresses.</li>
  <li><b>Gas/relayer fingerprint:</b> same gas price, same relayer, same tooling.</li>
  <li><b>Multi-denomination patterns</b> repeated by the same actor.</li>
</ul>
<div class="callout warn"><b>Law & sanctions.</b> Mixer legal status varies by jurisdiction and over time (e.g. the US Treasury sanctioned Tornado Cash in 2022 and delisted it in March 2025 after court rulings). Always check current sanctions lists — and remember mixer use alone is not proof of crime.</div>`,
        quiz: [
          { q: 'Why is a re-consolidation (fan-in) after a fan-out useful to investigators?', a: ['It hides the funds', 'It evidences common control of the hop wallets', 'It burns gas', 'It is required by exchanges'], c: 1, x: 'Converging the split funds shows one controller.' },
          { q: 'Mixer demixing conclusions should be reported as…', a: ['Certain', 'Probabilistic, with stated heuristics and confidence', 'Never reported', 'Facts if the tool says so'], c: 1, x: 'Demixing relies on heuristics; state method and confidence.' },
        ],
      },
      {
        id: 'm5l3', title: 'Chain hopping, swaps & OTC', mins: 12,
        body: `
<div class="model" data-model="chainhop"></div>
<h3>Following value across chains</h3>
<ul class="check">
  <li><b>Instant swap services:</b> match by time + rate-adjusted value; the service can confirm the order (legal request).</li>
  <li><b>Bridges & cross-chain protocols:</b> decode both legs (amount, memo, recipient).</li>
  <li><b>Wrapped assets:</b> WBTC, renBTC-style tokens — value moves chains without leaving the token's issuer records.</li>
  <li><b>Stablecoins:</b> USDT/USDC are <b>centralised</b>; issuers can freeze addresses on request from authorities.</li>
</ul>
<div class="callout tip"><b>Elite tip — the amount ratio.</b> When BTC goes in and ETH comes out, convert both to USD at block time. A 0.5–3% gap (fees + spread) with tight timing is a strong swap match.</div>
<h3>OTC & underground banking</h3>
<p>OTC brokers and informal networks exchange large crypto amounts for cash or bank transfers, often using USDT on TRON. Signs: high-volume wallets receiving from many unrelated illicit sources, round-number USDT flows, rapid turnover.</p>`,
        quiz: [
          { q: '1.000 BTC leaves to a swap service at 10:02. Which ETH payout is the likely match (BTC = 20× ETH price)?', a: ['19.70 ETH at 10:09', '5.2 ETH at 10:05', '20.0 ETH three days later', '1.0 ETH at 10:03'], c: 0, x: '1 BTC ≈ 20 ETH; 19.70 is ~1.5% less (fees/spread) and minutes later.' },
          { q: 'Why do stablecoins matter in recovery?', a: ['They are untraceable', 'Centralised issuers can freeze tokens at specific addresses', 'They cannot be bridged', 'They always stay on Ethereum'], c: 1, x: 'Issuer-controlled tokens can be frozen — creating a recovery window.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm6', code: '06', title: 'Fraud & Attack Patterns', color: '#ff3d71',
    tagline: 'Recognise the scheme from its on-chain shape.',
    lessons: [
      {
        id: 'm6l1', title: 'Pig butchering & investment scams', mins: 12,
        body: `
<p class="lead">"Pig butchering" (sha zhu pan) is a long-con investment/romance scam that has caused <b>billions</b> in losses. Victims are groomed, shown fake profits and drained repeatedly.</p>
<div class="model" data-model="pigbutcher"></div>
<h3>On-chain shape</h3>
<ul class="check">
  <li>Victim buys crypto on their own exchange account, then sends to an address given by a "platform".</li>
  <li>The "platform" address receives from <b>many unrelated retail victims</b> in similar ranges.</li>
  <li>Fast forwarding to consolidation wallets, then to USDT-TRC20 hops and OTC/money brokers.</li>
  <li>Repeated victim payments for "taxes", "unlock fees" and "account upgrades".</li>
</ul>
<div class="callout key"><b>Scale the case.</b> Every other depositor to the scammer's deposit address is a potential victim. One consolidation wallet can turn one complaint into a network case.</div>`,
        quiz: [
          { q: 'A scam deposit address receives from 300 unrelated retail wallets, then forwards within minutes. What does this enable?', a: ['Nothing', 'Identifying additional victims and the network', 'Proof the exchange is guilty', 'Reversing transactions'], c: 1, x: 'Shared deposit addresses reveal victims and network structure.' },
        ],
      },
      {
        id: 'm6l2', title: 'Phishing, drainers & address poisoning', mins: 10,
        body: `
<div class="model" data-model="poison"></div>
<h3>Recognising address poisoning</h3>
<ul class="check">
  <li>A <b>zero-value</b> transfer, dust, or fake-token transfer from an address that <b>matches the first & last characters</b> of a real counterparty.</li>
  <li>Arrives <b>minutes after</b> a genuine large transfer.</li>
  <li>The loss tx goes to the lookalike — victim copied from history.</li>
</ul>
<div class="callout tip"><b>Prevention advice for clients.</b> Use an address book / allow-list, verify the <b>full</b> address, send a test amount and confirm with the recipient through another channel.</div>`,
        quiz: [
          { q: 'Telltale on-chain precursor of address poisoning?', a: ['A huge deposit', 'A 0-value or dust transfer from a lookalike address shortly before the loss', 'A bridge transfer', 'A smart-contract upgrade'], c: 1, x: 'Attackers seed the victim\'s history with a lookalike address.' },
        ],
      },
      {
        id: 'm6l3', title: 'Rug pulls, ransomware, wash trading & mega-heists', mins: 15,
        body: `
<div class="model" data-model="rugpull"></div>
<p><b>Due-diligence red flags:</b> unverified or proxy contracts with owner powers, unlocked LP, concentrated holdings, mint/blacklist functions, anonymous team with fresh deployer funded minutes before launch.</p>
<div class="model" data-model="ransomware"></div>
<div class="model" data-model="washtrade"></div>
<div class="model" data-model="bigheist"></div>
<div class="callout key"><b>Pattern thinking.</b> You will rarely see a "pure" typology. Real cases chain them: phishing → drainer → fan-out → DEX swap → bridge → OTC. Recognise each segment and pick the right technique for it.</div>`,
        quiz: [
          { q: 'Same NFT trades A→B→C→A at rising prices; A, B, C funded by one wallet. Pattern?', a: ['Rug pull', 'Wash trading', 'Peel chain', 'Address poisoning'], c: 1, x: 'Cycles between commonly-funded wallets indicate wash trading.' },
          { q: 'Why do large heists swap stablecoins to native ETH early?', a: ['Lower gas', 'Stablecoins can be frozen by issuers', 'ETH is untraceable', 'Required by bridges'], c: 1, x: 'Freezable tokens are a liability; native assets cannot be frozen by an issuer.' },
          { q: 'RaaS proceeds consistently split ~80/20. Who usually gets the larger share?', a: ['Core developers', 'Affiliates who carry out the attack', 'Mixers', 'Exchanges'], c: 1, x: 'In RaaS models the affiliate typically takes the majority.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm7', code: '07', title: 'Attribution & Off-Ramps', color: '#ff8a3d',
    tagline: 'Turning addresses into people — legally and defensibly.',
    lessons: [
      {
        id: 'm7l1', title: 'From cluster to identity', mins: 12,
        body: `
<div class="model" data-model="attribution"></div>
<h3>The attribution hierarchy (strongest → weakest)</h3>
<ol class="steps">
  <li><b>Records from a regulated service</b> (KYC, IP logs, devices, linked bank accounts) obtained via legal process.</li>
  <li><b>Self-attribution:</b> suspect publishes the address (donation link, forum signature, ransom note, ENS reverse record).</li>
  <li><b>Operational overlap:</b> same deposit address, gas funder, or infrastructure across cases.</li>
  <li><b>Behavioural patterns:</b> timing, amounts, tooling — supporting evidence, rarely sufficient alone.</li>
</ol>
<h3>Exchanges done right</h3>
<div class="model" data-model="exchange"></div>
<div class="callout tip"><b>Elite tip — the perfect exchange request.</b> Include: deposit address(es), tx hashes, asset, chain, amounts, UTC times, and what you need (KYC, login IPs, linked wallets, withdrawal destinations, bank details). Make it trivially easy to answer.</div>`,
        quiz: [
          { q: 'Strongest form of attribution?', a: ['Similar active hours', 'Exchange KYC records obtained through legal process', 'An explorer label', 'Address prefix'], c: 1, x: 'Records from a regulated entity via proper process are strongest.' },
          { q: 'Funds reach an exchange hot wallet via a deposit address. What do you NOT do?', a: ['Request records for the deposit address', 'Trace outgoing hot-wallet withdrawals as if they were the suspect\'s', 'Document the tx hash', 'Note the time'], c: 1, x: 'Hot wallets commingle all customers. Withdrawals from them are not the suspect\'s.' },
        ],
      },
      {
        id: 'm7l2', title: 'OSINT & behavioural fingerprinting', mins: 12,
        body: `
<p class="lead">On-chain data tells you what. OSINT and behaviour tell you who and where.</p>
<h3>Pivots from an address</h3>
<ul class="check">
  <li>Search the full address in search engines, GitHub, Pastebin-style sites, forums, social media and scam-report databases.</li>
  <li>Naming services (ENS, Unstoppable, etc.) and their reverse records / text records.</li>
  <li>NFT profiles, marketplace usernames, airdrop and governance participation.</li>
  <li>Website infrastructure for scam platforms: domains, registrars, hosting, analytics IDs, TLS certificates.</li>
</ul>
<h3>Timezone inference</h3>
<p>Plot a cluster's transaction times by hour (UTC). Humans sleep — the quiet window suggests a timezone. Try different patterns:</p>
<div class="widget" data-widget="timezone"></div>
<div class="callout warn"><b>Corroboration only.</b> Timing analysis is suggestive, not conclusive: bots, shift workers and deliberate scheduling distort it.</div>`,
        quiz: [
          { q: 'A cluster is silent between 18:00 and 01:00 UTC daily. A plausible timezone is…', a: ['UTC−5', 'UTC+8', 'UTC+0', 'Impossible to say anything'], c: 1, x: '18:00–01:00 UTC = 02:00–09:00 at UTC+8 — a typical sleep window. Still only supporting evidence.' },
        ],
      },
      {
        id: 'm7l3', title: 'Freezes, seizures & legal frameworks', mins: 9,
        body: `
<h3>Key frameworks</h3>
<ul class="check">
  <li><b>FATF Recommendations</b> — global AML standards; Recommendation 15/16 cover virtual assets & the <b>Travel Rule</b> (originator/beneficiary info between VASPs).</li>
  <li><b>EU MiCA & Transfer of Funds Regulation</b> — licensing of crypto-asset service providers and Travel Rule in the EU.</li>
  <li><b>Sanctions</b> — OFAC (US), EU, UK OFSI lists include crypto addresses. Screening is mandatory for regulated firms.</li>
  <li><b>MLATs</b> — cross-border evidence requests between states. Slow; plan early.</li>
</ul>
<h3>Recovery levers</h3>
<table class="tbl">
  <tr><th>Lever</th><th>When it works</th></tr>
  <tr><td>Exchange freeze</td><td>Funds sitting in a regulated exchange account — needs a fast, well-documented request, usually from law enforcement</td></tr>
  <tr><td>Stablecoin issuer freeze</td><td>USDT/USDC still at an address — issuer can blacklist it on lawful request</td></tr>
  <tr><td>Seizure / forfeiture</td><td>Law-enforcement action with court orders</td></tr>
  <tr><td>Civil remedies</td><td>Freezing injunctions, disclosure orders against exchanges in some jurisdictions</td></tr>
</table>
<div class="callout key"><b>Speed is everything.</b> Most recoverable value is recovered in the <b>first 24–72 hours</b>. A fast, precise report beats a perfect one next week.</div>`,
        quiz: [
          { q: 'The FATF "Travel Rule" requires…', a: ['Exchanges to publish all trades', 'VASPs to exchange originator and beneficiary info for transfers', 'Users to travel to verify KYC', 'Bridges to be licensed'], c: 1, x: 'The Travel Rule mirrors wire-transfer rules for virtual asset transfers between VASPs.' },
        ],
      },
    ],
  },
  /* ======================================================================= */
  {
    id: 'm8', code: '08', title: 'Tooling, Reporting & Mastery', color: '#00e5c7',
    tagline: 'The professional toolkit and the report that wins the case.',
    lessons: [
      {
        id: 'm8l1', title: 'The investigator\'s toolkit', mins: 9,
        body: `
<table class="tbl">
  <tr><th>Category</th><th>Examples</th><th>Use</th></tr>
  <tr><td>Block explorers</td><td>mempool.space, Blockstream, Etherscan & family, Tronscan, Solscan, Blockchair</td><td>Raw data, verification, logs, traces</td></tr>
  <tr><td>Commercial analytics</td><td>Chainalysis Reactor, TRM Labs, Elliptic, Crystal</td><td>Clustering, attribution DB, cross-chain graphing, alerts</td></tr>
  <tr><td>Free/freemium graphing</td><td>Arkham, Breadcrumbs, MetaSleuth</td><td>Quick visual traces & labels</td></tr>
  <tr><td>Open-source</td><td>GraphSense, BlockSci (archival), your own node + SQL (e.g. BigQuery public datasets)</td><td>Custom analytics, research</td></tr>
  <tr><td>Tx debuggers</td><td>Phalcon, Tenderly, Etherscan trace</td><td>Exploit reconstruction</td></tr>
  <tr><td>Bridge explorers</td><td>Bridge-specific scanners (e.g. LayerZero Scan, Wormholescan)</td><td>Cross-chain leg matching</td></tr>
</table>
<div class="callout tip"><b>Elite tip.</b> Tools disagree. Verify critical hops on raw data, and cite both the tool and the underlying tx hash.</div>
<p>Practice building your own graphs in the <b>Investigation Board</b> (left menu) — the same workflow you'll use in professional graph tools.</p>`,
        quiz: [
          { q: 'Two tools label the same address differently. Best practice?', a: ['Pick the newer label', 'Verify on raw data and cite sources + confidence for each claim', 'Ignore both', 'Use whichever helps the case'], c: 1, x: 'Labels are claims; verify and document their source.' },
        ],
      },
      {
        id: 'm8l2', title: 'Writing the report', mins: 10,
        body: `
<p class="lead">Your report is the product. It must be understood by a judge, actionable by an exchange, and bulletproof against an opposing expert.</p>
<h3>Structure</h3>
<ol class="steps">
  <li><b>Executive summary</b> — the answer in 5 lines: what happened, how much, where it went, what to do.</li>
  <li><b>Scope & sources</b> — question asked, data sources, tools & versions, accounting method.</li>
  <li><b>Methodology</b> — heuristics used and their limitations.</li>
  <li><b>Findings</b> — hop-by-hop narrative with graph figures; each hop with tx hash, amount, time, confidence.</li>
  <li><b>Attribution</b> — services and entities identified, with sources.</li>
  <li><b>Recommendations</b> — freezes, legal process targets, monitoring.</li>
  <li><b>Appendices</b> — full tx tables, address lists, glossary.</li>
</ol>
<div class="callout key"><b>One graph, one message.</b> Each figure should answer one question. A 300-node hairball convinces no one.</div>`,
        quiz: [
          { q: 'What belongs in the executive summary?', a: ['Every tx hash', 'The key answer: what happened, amounts, destinations, recommended actions', 'Tool licences', 'Your CV'], c: 1, x: 'Decision-makers read the summary; details go to findings and appendices.' },
        ],
      },
      {
        id: 'm8l3', title: 'Thinking like an elite investigator', mins: 8,
        body: `
<p class="lead">Elite investigators aren't defined by tools. They're defined by <b>habits</b>.</p>
<div class="grid4">
  <div class="card-mini"><b>Hypothesis-driven</b><span>State what you expect to find, then try to disprove it.</span></div>
  <div class="card-mini"><b>Value-focused</b><span>Follow the money of interest; ignore noise.</span></div>
  <div class="card-mini"><b>Fast on freezable</b><span>Prioritise stablecoins and exchange touchpoints.</span></div>
  <div class="card-mini"><b>Honest about doubt</b><span>Confidence levels on every inference.</span></div>
</div>
<h3>Your path forward</h3>
<ul class="check">
  <li>Complete every <b>Case Lab</b> and hit 90%+ in the <b>Pattern Dojo</b>.</li>
  <li>Pass the <b>Final Exam</b> to unlock your certificate.</li>
  <li>Read public investigation reports and reproduce their traces on an explorer.</li>
  <li>Consider recognised certifications offered by industry analytics vendors and AML bodies.</li>
</ul>`,
        quiz: [
          { q: 'Best habit when you think you\'ve found the suspect\'s change output?', a: ['Report it as fact', 'Seek independent confirming signals and try to disprove it', 'Ignore other outputs forever', 'Ask the suspect'], c: 1, x: 'Elite analysts test hypotheses with independent evidence.' },
        ],
      },
    ],
  },
];

window.GLOSSARY = [
  ['Address', 'Identifier that can receive crypto, derived from a public key, script or contract.'],
  ['Address poisoning', 'Scam seeding a victim\'s history with a lookalike address so they copy it by mistake.'],
  ['Anonymity set', 'Number of possible owners an output could belong to after mixing.'],
  ['Approval', 'ERC-20/721 permission letting a spender move tokens from an owner.'],
  ['Attribution', 'Linking addresses/clusters to real-world entities or people.'],
  ['Bridge', 'Protocol moving value between blockchains (lock/mint or liquidity-based).'],
  ['Change output', 'UTXO output returning leftover value to the sender.'],
  ['Chain hopping', 'Moving funds across chains to break single-chain tracing.'],
  ['CIOH', 'Common-Input-Ownership Heuristic: co-spent inputs share an owner.'],
  ['Cluster', 'Set of addresses inferred to be controlled by one entity.'],
  ['CoinJoin', 'Collaborative tx mixing inputs from many users into equal outputs.'],
  ['Deposit address', 'Exchange-generated address unique to a customer account.'],
  ['Drainer', 'Malicious kit/contract that steals assets via approvals or signatures.'],
  ['EOA', 'Externally Owned Account — key-controlled account on EVM chains.'],
  ['Event log', 'Data emitted by smart contracts (e.g. Transfer) recorded in tx receipts.'],
  ['Fan-out / fan-in', 'Splitting funds into many wallets / consolidating them back.'],
  ['FIFO / LIFO / pro-rata', 'Accounting methods for allocating commingled funds.'],
  ['Flash loan', 'Uncollateralised loan repaid within one transaction.'],
  ['Hot wallet', 'Online exchange wallet used for operations; commingles customer funds.'],
  ['Internal transaction', 'Value transfer made by contract execution, visible via traces.'],
  ['KYC', 'Know Your Customer — identity verification by regulated services.'],
  ['MLAT', 'Mutual Legal Assistance Treaty — cross-border evidence request.'],
  ['Mixer', 'Service or contract that obscures links between deposits and withdrawals.'],
  ['Nonce', 'Per-account transaction counter on EVM chains.'],
  ['OTC desk', 'Over-the-counter broker for large off-exchange trades.'],
  ['Peel chain', 'Sequence of txs peeling small amounts off a large balance.'],
  ['Permit', 'Off-chain signature granting token allowance (EIP-2612, Permit2).'],
  ['Pig butchering', 'Long-con romance/investment scam with fake trading platforms.'],
  ['Rug pull', 'Token project creators abandoning it and draining liquidity.'],
  ['Sweep', 'Moving funds from many deposit addresses into a central wallet.'],
  ['Travel Rule', 'FATF rule requiring VASPs to share originator/beneficiary info.'],
  ['UTXO', 'Unspent Transaction Output — discrete unit of value in Bitcoin-like chains.'],
  ['VASP', 'Virtual Asset Service Provider — exchanges, custodians, etc.'],
  ['Wash trading', 'Trading with yourself to fake volume or price.'],
];
