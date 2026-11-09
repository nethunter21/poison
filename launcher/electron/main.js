/* POISON CLIENT — Electron main process. */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');
const game = require('./game');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
let running = null; // { startedAt }

const gameRoot = () => path.join(app.getPath('appData'), '.poison-client');
const runtimeRoot = () => path.join(gameRoot(), 'runtime');

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 900, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#07040a', title: 'POISON Client', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  // external links open in the real browser, never inside the launcher
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };

/* ---------- accounts ---------- */
ipcMain.handle('poison:accounts', () => auth.publicView());
ipcMain.handle('poison:login', () => auth.login());
ipcMain.handle('poison:logout', (_e, uuid) => auth.logout(uuid));
ipcMain.handle('poison:select', (_e, uuid) => auth.select(uuid));

/* ---------- versions ---------- */
ipcMain.handle('poison:versions', async () => {
  try { return { ok: true, ...(await game.listVersions()) }; } catch (e) { return { ok: false, message: e.message }; }
});

/* ---------- launch ---------- */
ipcMain.handle('poison:launch', async (_e, config) => {
  if (running) return { ok: false, message: 'Minecraft is already running.' };
  const L = config.launcher || {};
  try {
    send('poison:progress', { stage: 'auth', text: 'Signing in to Minecraft services', done: 0, total: 1 });
    const authorization = await auth.getLaunchAuth();
    running = { startedAt: Date.now() };
    const res = await game.launch({
      version: config.profile.version,
      loader: config.profile.loader,
      ram: L.ram, jvm: L.jvm, width: L.width, height: L.height, fullscreen: L.fullscreen, javaPath: L.javaPath,
      root: gameRoot(), runtimeRoot: runtimeRoot(), auth: authorization, config,
    }, (ev, payload) => {
      if (ev === 'progress') send('poison:progress', payload);
      else if (ev === 'log') send('poison:log', payload);
      else if (ev === 'exit') {
        running = null;
        send('poison:exit', payload);
        if (win && !win.isDestroyed() && !win.isVisible()) win.show();
      }
    });
    if (L.closeOnLaunch && win) win.hide(); // comes back when the game closes
    return res;
  } catch (e) {
    running = null;
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
});

/* ---------- misc ---------- */
ipcMain.handle('poison:openFolder', (_e, which) => {
  const dir = which === 'mods' ? path.join(gameRoot(), 'mods') : which === 'screenshots' ? path.join(gameRoot(), 'screenshots') : gameRoot();
  fs.mkdirSync(dir, { recursive: true });
  return shell.openPath(dir);
});
ipcMain.handle('poison:info', () => ({ version: app.getVersion(), gameDir: gameRoot(), platform: process.platform }));
ipcMain.on('poison:window', (_e, action) => {
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === 'close') win.close();
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.whenReady().then(() => { auth.load(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
