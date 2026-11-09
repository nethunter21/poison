/* POISON CLIENT — Electron shell.
 * Opens the launcher UI in a frameless window and exposes a small IPC surface:
 *   - window controls (min / max / close)
 *   - launch(config): writes the client config to disk and calls startGame()
 *
 * startGame() is intentionally a stub. Starting the real game needs a Microsoft account
 * login (Xbox Live -> Minecraft services) and a game-file downloader. A common route is
 * the `msmc` (auth) + `minecraft-launcher-core` (download/launch) npm packages, with your
 * client mod jar added to the classpath/mods folder. Never ship an "offline" bypass.
 */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#07040a',
    title: 'POISON Client',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

function configPath() {
  return path.join(app.getPath('userData'), 'poison-config.json');
}

async function startGame(config) {
  // TODO: authenticate + download + spawn the JVM here (see header comment).
  return { ok: false, message: `Config saved to ${configPath()}. Wire startGame() in electron/main.js to launch ${config.profile.version}.` };
}

ipcMain.handle('poison:launch', async (_e, config) => {
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
    return await startGame(config);
  } catch (err) {
    return { ok: false, message: String(err && err.message ? err.message : err) };
  }
});

ipcMain.on('poison:window', (_e, action) => {
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === 'close') win.close();
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
