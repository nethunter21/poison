/* Poison Terminal — boot */
(function (P) {
  const U = P.U;
  const splash = document.getElementById('splash');
  let hidden = false;
  const hide = () => { if (hidden) return; hidden = true; splash.classList.add('out'); setTimeout(() => splash.remove(), 800); };

  P.UI.init();
  const kb = document.getElementById('searchKbd'); if (kb) kb.textContent = P.Keys.label('search').replace('+', ' ') || '/';

  P.Data.on('lists', () => setTimeout(hide, 350));
  setTimeout(hide, 6000);
  P.Data.start();

  // light housekeeping
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());
  window.addEventListener('error', (e) => console.error('[poison]', e.message));
  window.addEventListener('beforeunload', () => P.Data.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) P.Data.save(); });
})(window.P);
