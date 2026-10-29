const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#05060d',
    show: false,
    icon: path.join(__dirname, 'app', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // Open external links in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  win.on('maximize', () => win.webContents.send('win:state', 'max'));
  win.on('unmaximize', () => win.webContents.send('win:state', 'normal'));
}

ipcMain.on('win:min', () => win && win.minimize());
ipcMain.on('win:max', () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:fullscreen', () => win && win.setFullScreen(!win.isFullScreen()));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
