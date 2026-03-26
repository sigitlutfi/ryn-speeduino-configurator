// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serial', {
  listPorts: () => ipcRenderer.invoke('serial:listPorts'),
  connect: (port, baud) => ipcRenderer.invoke('serial:connect', port, baud),
  disconnect: () => ipcRenderer.invoke('serial:disconnect'),
  sendCommand: (cmd) => ipcRenderer.invoke('serial:sendCommand', cmd),
  onData: (callback) => {
    ipcRenderer.on('serial:data', (_event, data) => callback(data));
  },
  onStatus: (callback) => ipcRenderer.on('serial:status', (_event, status) => callback(status)),
  offAll: () => {
    ipcRenderer.removeAllListeners('serial:data');
    ipcRenderer.removeAllListeners('serial:status');
  },
});

contextBridge.exposeInMainWorld('projects', {
  pickIni: () => ipcRenderer.invoke('project:pick-ini'),
  pickSave: (name) => ipcRenderer.invoke('project:pick-save', name),
  pickSaveLocation: (name) => ipcRenderer.invoke('project:pick-save', name), // alias
  pickExisting: () => ipcRenderer.invoke('project:pick-existing'),
  loadIni: (path) => ipcRenderer.invoke('project:load-ini', path),
  loadFile: (path) => ipcRenderer.invoke('project:load-file', path),
  saveFile: (path, data) => ipcRenderer.invoke('project:save-file', path, data),
  addRecent: (project) => ipcRenderer.invoke('project:add-recent', project),
  pickImage: () => ipcRenderer.invoke('project:pick-image'),
});

contextBridge.exposeInMainWorld('config', {
  get: () => ipcRenderer.invoke('config:get'),
  saveSettings: (settings) => ipcRenderer.invoke('config:save-settings', settings),
});
