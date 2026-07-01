// Preload script for secure communication between renderer and main process
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secureExamAPI', {
  // Expose specific functions if needed later
  quitApp: () => ipcRenderer.send('quit-app')
});
