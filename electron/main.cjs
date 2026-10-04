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
