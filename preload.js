// preload.js
console.log("Preload script is running");
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  addShortcut: (shortcut) => ipcRenderer.invoke('add-shortcut', shortcut),
  deleteShortcut: (index) => ipcRenderer.invoke('delete-shortcut', index),
  executeShortcut: (shortcut) => ipcRenderer.invoke('execute-shortcut', shortcut),
  queryGoogle: (query) => ipcRenderer.invoke('query-google', query),
  hideWindow: () => ipcRenderer.invoke('hide-window')
});

console.log("API exposed:", !!window.api);