const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');

const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

let mainWindow;
let backendProcess = null;

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:8000/', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  const isRunning = await checkBackendHealth();
  if (isRunning) {
    console.log('Backend is already running on port 8000.');
    return;
  }

  const candidatePaths = [
    // 1. Packaged resources path
    path.join(process.resourcesPath, 'backend', 'backend.exe'),
    path.join(process.resourcesPath, 'backend.exe'),
    // 2. Portable executable directory (if running portable)
    process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'resources', 'backend', 'backend.exe') : null,
    process.env.PORTABLE_EXECUTABLE_DIR ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'backend', 'backend.exe') : null,
    // 3. Local/unpacked paths
    path.join(__dirname, '../dist-backend/backend/backend.exe'),
    path.join(__dirname, '../../dist-backend/backend/backend.exe'),
    path.join(process.cwd(), 'dist-backend/backend/backend.exe'),
    path.join(process.cwd(), 'release/win-unpacked/resources/backend/backend.exe')
  ].filter(Boolean);

  let backendExe = null;
  let backendArgs = [];
  let backendCwd = null;

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      backendExe = p;
      backendCwd = path.dirname(p);
      break;
    }
  }

  // Fallback to local python venv if running in development environment
  if (!backendExe) {
    const venvPython = path.join(__dirname, '../backend/venv/Scripts/python.exe');
    if (fs.existsSync(venvPython)) {
      backendExe = venvPython;
      backendArgs = ['-m', 'uvicorn', 'backend.server:app', '--host', '127.0.0.1', '--port', '8000'];
      backendCwd = path.join(__dirname, '..');
    }
  }

  if (backendExe) {
    console.log(`Starting backend server: ${backendExe}`);
    try {
      const logDir = app.getPath('userData');
      const errLog = path.join(logDir, 'backend_stderr.log');
      const errStream = fs.createWriteStream(errLog, { flags: 'a' });

      backendProcess = spawn(backendExe, backendArgs, {
        cwd: backendCwd,
        windowsHide: true,
        stdio: ['ignore', 'ignore', errStream]
      });

      backendProcess.on('error', (err) => {
        console.error('Failed to spawn backend process:', err);
      });
    } catch (err) {
      console.error('Exception spawning backend:', err);
    }

    // Wait up to 12 seconds for the backend to become responsive
    const startTime = Date.now();
    let online = false;
    while (Date.now() - startTime < 12000) {
      await new Promise(r => setTimeout(r, 250));
      online = await checkBackendHealth();
      if (online) {
        console.log('Backend confirmed healthy on port 8000.');
        break;
      }
    }
    if (!online) {
      console.warn('Backend did not answer on port 8000 within 12 seconds, continuing with window launch.');
    }
  }
}

function stopBackend() {
  if (backendProcess && backendProcess.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${backendProcess.pid} /T /F`);
      } else {
        backendProcess.kill('SIGTERM');
