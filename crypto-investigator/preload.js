const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  minimize: () => ipcRenderer.send('win:min'),
  maximize: () => ipcRenderer.send('win:max'),
  close: () => ipcRenderer.send('win:close'),
  fullscreen: () => ipcRenderer.send('win:fullscreen'),
  onState: (fn) => ipcRenderer.on('win:state', (_e, s) => fn(s)),
});
