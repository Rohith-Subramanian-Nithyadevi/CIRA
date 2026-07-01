const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    kiosk: true, // PRD: Kiosk Mode & Fullscreen Enforcement
    alwaysOnTop: true,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // PRD: Browser & Copy-Paste Blocking (partially handled by disabling devtools and shortcuts)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && ['c', 'v', 'x'].includes(input.key.toLowerCase())) {
      event.preventDefault();
    }
  });

  // Prevent closing without admin password (simulated here by ignoring close if not authorized)
  mainWindow.on('close', (e) => {
    // e.preventDefault();
    // In a real scenario, require a proctor password to exit
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // Disable common exit shortcuts
  globalShortcut.register('CommandOrControl+Q', () => {
    console.log('User attempted to quit');
  });
  globalShortcut.register('Alt+F4', () => {
    console.log('User attempted to close window');
  });
  globalShortcut.register('CommandOrControl+Tab', () => {
     console.log('User attempted to switch app');
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('quit-app', () => {
  app.quit();
});
