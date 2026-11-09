/* Exposes a minimal, explicit API to the launcher UI (window.poisonNative). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('poisonNative', {
  launch: (config) => ipcRenderer.invoke('poison:launch', config),
  window: (action) => ipcRenderer.send('poison:window', action),
  close: () => ipcRenderer.send('poison:window', 'close'),
});
