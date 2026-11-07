const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage, net } = require('electron');
const path = require('path');
const fs = require('fs');

const ALLOWED_HOSTS = new Set(['api.dexscreener.com', 'api.geckoterminal.com']);
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
      backgroundThrottling: false,
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

ipcMain.handle('net:json', async (_e, url, headers) => {
  let u;
  try { u = new URL(url); } catch { throw new Error('bad url'); }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) throw new Error('host not allowed');
  const res = await net.fetch(url, { headers: Object.assign({ Accept: 'application/json' }, headers || {}) });
  if (!res.ok) { const err = new Error('HTTP ' + res.status); err.status = res.status; throw err; }
  return await res.json();
});

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

ipcMain.handle('img:fetch', async (_e, url) => {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  try {
    const res = await net.fetch(url);
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    return 'data:' + ct.split(';')[0] + ';base64,' + buf.toString('base64');
  } catch { return null; }
});

ipcMain.on('open:external', (_e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); });
ipcMain.on('clip:text', (_e, text) => clipboard.writeText(String(text)));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
