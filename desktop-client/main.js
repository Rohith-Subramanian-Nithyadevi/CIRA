const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let isSafeExit = false;

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

  // Prevent screenshots and screen recording
  mainWindow.setContentProtection(true);

  // Block any attempt to open a new window (e.g. target="_blank" links or window.open)
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // PRD: Browser & Copy-Paste Blocking (partially handled by disabling devtools and shortcuts)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && ['c', 'v', 'x'].includes(input.key.toLowerCase())) {
      event.preventDefault();
    }
  });

  // Only allow exit if the explicit "Exit App" button was clicked
  mainWindow.on('close', (e) => {
    if (!isSafeExit) {
      e.preventDefault();
      console.log('Blocked attempt to close window without clicking exit');
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // Disable common exit shortcuts
  globalShortcut.register('CommandOrControl+Q', () => {
    console.log('Blocked User attempt to quit (Cmd+Q)');
  });
  globalShortcut.register('Alt+F4', () => {
    console.log('Blocked User attempt to close window (Alt+F4)');
  });
  globalShortcut.register('CommandOrControl+Tab', () => {
     console.log('Blocked User attempt to switch app (Cmd+Tab)');
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Block force-quitting from the OS menu bar or dock
app.on('before-quit', (e) => {
  if (!isSafeExit) {
    e.preventDefault();
    console.log('Blocked OS-level quit request');
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('quit-app', () => {
  isSafeExit = true; // Authorize the exit
  app.quit();
});
