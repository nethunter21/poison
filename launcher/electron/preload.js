/* Exposes a minimal, explicit API to the launcher UI as window.poisonNative. */
const { contextBridge, ipcRenderer } = require('electron');

const sub = (ch) => (fn) => {
  const h = (_e, p) => fn(p);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('poisonNative', {
  accounts: () => ipcRenderer.invoke('poison:accounts'),
  login: () => ipcRenderer.invoke('poison:login'),
  logout: (uuid) => ipcRenderer.invoke('poison:logout', uuid),
  selectAccount: (uuid) => ipcRenderer.invoke('poison:select', uuid),
  versions: () => ipcRenderer.invoke('poison:versions'),
  launch: (config) => ipcRenderer.invoke('poison:launch', config),
  openFolder: (which, version, loader) => ipcRenderer.invoke('poison:openFolder', which, version, loader),
  info: () => ipcRenderer.invoke('poison:info'),
  onProgress: sub('poison:progress'),
  onLog: sub('poison:log'),
  onExit: sub('poison:exit'),
  window: (action) => ipcRenderer.send('poison:window', action),
  close: () => ipcRenderer.send('poison:window', 'close'),
});
