const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1640,
    height: 980,
    minWidth: 1180,
    minHeight: 720,
    frame: false,
    show: false,
    backgroundColor: '#05060a',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); }
  });
  win.on('maximize', () => win.webContents.send('win:state', { maximized: true }));
  win.on('unmaximize', () => win.webContents.send('win:state', { maximized: false }));
}

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:fullscreen', () => win && win.setFullScreen(!win.isFullScreen()));

ipcMain.handle('img:save', async (_e, dataUrl, suggestedName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save PnL card',
    defaultPath: path.join(app.getPath('pictures'), suggestedName || 'pnl-card.png'),
    filters: [{ name: 'PNG image', extensions: ['png'] }]
  });
  if (canceled || !filePath) return null;
  const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  return filePath;
});

ipcMain.handle('img:copy', async (_e, dataUrl) => {
  clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
  return true;
});

ipcMain.on('open:external', (_e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });
ipcMain.on('clip:text', (_e, text) => clipboard.writeText(String(text)));

// Lightweight: everything runs offline, no network access needed.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,MediaSessionService');
app.commandLine.appendSwitch('disable-http-cache');
app.whenReady().then(() => {
  // block every outgoing network request — the market is simulated locally
  session.defaultSession.webRequest.onBeforeRequest((d, cb) => cb({ cancel: /^(https?|wss?):/i.test(d.url) }));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
