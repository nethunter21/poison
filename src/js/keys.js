/* Poison Terminal — keyboard shortcuts (fully rebindable) */
(function (P) {
  const U = P.U, UI = P.UI;

  const ACTIONS = [
    ['search', 'Search / command palette', 'Ctrl+K', () => UI.openSearch()],
    ['buy1', 'Buy preset 1', '1', () => UI.buyPreset(0)],
    ['buy2', 'Buy preset 2', '2', () => UI.buyPreset(1)],
    ['buy3', 'Buy preset 3', '3', () => UI.buyPreset(2)],
    ['buy4', 'Buy preset 4', '4', () => UI.buyPreset(3)],
    ['sell1', 'Sell preset 1', 'Q', () => UI.sellPreset(0)],
    ['sell2', 'Sell preset 2', 'W', () => UI.sellPreset(1)],
    ['sell3', 'Sell preset 3', 'E', () => UI.sellPreset(2)],
    ['sell4', 'Sell preset 4', 'R', () => UI.sellPreset(3)],
    ['execute', 'Execute order', 'Enter', () => UI.execute()],
    ['stopLoss', 'Arm / disarm stop loss', 'L', () => UI.toggleSL()],
    ['takeProfit', 'Arm / disarm take profit', 'Shift+L', () => UI.toggleTP()],
    ['breakeven', 'Move stop loss to breakeven', 'Shift+B', () => UI.breakeven()],
    ['toggleSide', 'Toggle buy / sell', 'X', () => UI.toggleSide()],
    ['sideBuy', 'Buy tab', 'B', () => UI.setSide('buy')],
    ['sideSell', 'Sell tab', 'S', () => UI.setSide('sell')],
    ['amount', 'Focus amount input', 'A', () => UI.focusAmount()],
    ['next', 'Next coin', 'ArrowDown', () => UI.moveCursor(1)],
    ['prev', 'Previous coin', 'ArrowUp', () => UI.moveCursor(-1)],
    ['next2', 'Next coin (alt)', 'J', () => UI.moveCursor(1)],
    ['prev2', 'Previous coin (alt)', 'K', () => UI.moveCursor(-1)],
    ['listNextTab', 'Next list', 'ArrowRight', () => UI.cycleList(1)],
    ['listPrevTab', 'Previous list', 'ArrowLeft', () => UI.cycleList(-1)],
    ['back', 'Back to previous coin', 'Alt+ArrowLeft', () => UI.back()],
    ['forward', 'Forward', 'Alt+ArrowRight', () => UI.forward()],
    ['listNew', 'New pairs', 'N', () => UI.setList('new')],
    ['listStretch', 'Final stretch', 'G', () => UI.setList('stretch')],
    ['listMigrated', 'Migrated', 'U', () => UI.setList('migrated')],
    ['listTrending', 'Trending', 'T', () => UI.setList('trending')],
    ['listHoldings', 'My bags', 'H', () => UI.setList('holdings')],
    ['listWatch', 'Watchlist', 'V', () => UI.setList('watch')],
    ['watch', 'Add / remove watchlist', 'F', () => UI.toggleWatch()],
    ['pnl', 'PnL card', 'P', () => P.PnL.open()],
    ['copyCA', 'Copy contract address', 'C', () => UI.copyCA()],
    ['tfPrev', 'Timeframe down', '[', () => UI.cycleTf(-1)],
    ['tfNext', 'Timeframe up', ']', () => UI.cycleTf(1)],
    ['unit', 'Chart: MCap / Price', 'M', () => UI.toggleUnit()],
    ['tabTrades', 'Bottom: trades', 'Alt+1', () => UI.setBottom('trades')],
    ['tabPositions', 'Bottom: positions', 'Alt+2', () => UI.setBottom('positions')],
    ['tabHistory', 'Bottom: history', 'Alt+3', () => UI.setBottom('history')],
    ['panic', 'Panic sell all positions', 'Shift+Q', () => UI.panicSell()],
    ['zen', 'Zen mode (chart only)', 'Z', () => UI.toggleZen()],
    ['settings', 'Settings', 'Ctrl+,', () => UI.openSettings()],
    ['help', 'Shortcut cheat sheet', '?', () => UI.openHelp()],
    ['fullscreen', 'Fullscreen', 'F11', () => window.native ? window.native.fullscreen() : document.documentElement.requestFullscreen?.()]
  ];
  const DEFAULT = Object.fromEntries(ACTIONS.map((a) => [a[0], a[2]]));
  let map = Object.assign({}, DEFAULT, Object.fromEntries(Object.entries(U.store.get('keymap', {})).filter(([k]) => k in DEFAULT)));
  let lookup = {};
  const rebuild = () => { lookup = {}; for (const [id, k] of Object.entries(map)) if (k) lookup[k] = id; };
  rebuild();

  // turn a KeyboardEvent into a canonical combo string, e.g. "Ctrl+Shift+K"
  function norm(e) {
    let base, shiftMatters = true;
    if (/^Digit\d$/.test(e.code)) base = e.code.slice(5);
    else if (/^Numpad\d$/.test(e.code)) base = e.code.slice(6);
    else if (/^Key[A-Z]$/.test(e.code)) base = e.code.slice(3);
    else if (e.key && e.key.length === 1) { base = e.key; shiftMatters = false; }
    else base = e.key;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(base)) return null;
    const mods = [];
    if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey && shiftMatters) mods.push('Shift');
    return mods.concat(base === ' ' ? 'Space' : base).join('+');
  }

  let listening = null;
  const K = (P.Keys = {
    label: (id) => map[id] || '',
    list: () => ACTIONS.map(([id, label]) => [id, label, map[id]]),
    reset() { map = Object.assign({}, DEFAULT); U.store.set('keymap', {}); rebuild(); },
    listen(id, cb) { listening = { id, cb }; },
    stopListening() { listening = null; }
  });

  document.addEventListener('keydown', (e) => {
    if (listening) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { const l = listening; listening = null; l.cb(map[l.id]); return; }
      let combo = e.key === 'Backspace' || e.key === 'Delete' ? '' : norm(e);
      if (combo === null) return;
      // steal binding from any other action
      for (const k of Object.keys(map)) if (combo && map[k] === combo) map[k] = '';
      map[listening.id] = combo;
      const saved = {}; for (const k of Object.keys(map)) if (map[k] !== DEFAULT[k]) saved[k] = map[k];
      U.store.set('keymap', saved); rebuild();
      const l = listening; listening = null; l.cb(combo);
      return;
    }
    const a = document.activeElement;
    const inInput = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    if (e.key === 'Escape') {
      if (UI.closeTop()) { e.preventDefault(); return; }
      if (inInput) { a.blur(); e.preventDefault(); }
      return;
    }
    const combo = norm(e);
    if (!combo) return;
    if (P.PnL.isOpen()) {
      if (combo === 'Ctrl+S') { e.preventDefault(); P.PnL.action('save'); }
      else if (combo === 'Ctrl+C' && !inInput && !String(getSelection())) { e.preventDefault(); P.PnL.action('copy'); }
      return;
    }
    if (UI.modalOpen()) return;
    if (inInput && !combo.startsWith('Ctrl+') && !combo.startsWith('Alt+') && !/^F\d+$/.test(combo)) return;
    if (inInput && combo === 'Ctrl+C') return;
    let id = lookup[combo];
    if (!id && combo === '/') id = 'search';
    if (!id) return;
    if (e.repeat && !['next', 'prev', 'next2', 'prev2'].includes(id)) return;
    e.preventDefault();
    const act = ACTIONS.find((x) => x[0] === id);
    act && act[3]();
  });
})(window.P);
