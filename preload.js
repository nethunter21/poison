const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('native', {
  isElectron: true,
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  fullscreen: () => ipcRenderer.send('win:fullscreen'),
  onWinState: (cb) => ipcRenderer.on('win:state', (_e, s) => cb(s)),
  json: (url, headers) => ipcRenderer.invoke('net:json', url, headers),
  saveImage: (dataUrl, name) => ipcRenderer.invoke('img:save', dataUrl, name),
  fetchImage: (url) => ipcRenderer.invoke('img:fetch', url),
  copyImage: (dataUrl) => ipcRenderer.invoke('img:copy', dataUrl),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  copyText: (t) => ipcRenderer.send('clip:text', t)
});
