'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a small, explicit API to the renderer. The renderer has no direct
// Node/Electron access — it can only call these vetted channels.
contextBridge.exposeInMainWorld('api', {
  pickPhotos: () => ipcRenderer.invoke('pick-photos'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  readImage: (filePath) => ipcRenderer.invoke('read-image', filePath),
  pickOutput: () => ipcRenderer.invoke('pick-output'),
  exportClusters: (payload) => ipcRenderer.invoke('export-clusters', payload),
});
