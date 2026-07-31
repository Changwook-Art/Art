'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

// ---------------------------------------------------------------------------
// Local static server.
//
// face-api.js loads its model weights with `fetch()`, and Chromium refuses to
// fetch() the file:// scheme even with webSecurity disabled. Serving the
// renderer and models over http://127.0.0.1 sidesteps that cleanly. The server
// binds to loopback only, so nothing is exposed off the machine.
// ---------------------------------------------------------------------------
function startServer() {
  const rendererRoot = path.join(__dirname, 'renderer');
  const modelsRoot = path.join(__dirname, 'models');

  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath;
      if (urlPath.startsWith('/models/')) {
        filePath = path.join(modelsRoot, urlPath.slice('/models/'.length));
      } else {
        const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
        filePath = path.join(rendererRoot, rel);
      }

      // Prevent path traversal outside the served roots.
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(rendererRoot) && !resolved.startsWith(modelsRoot)) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      fs.readFile(resolved, (err, data) => {
        if (err) {
          res.writeHead(404).end('Not found');
          return;
        }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    } catch (e) {
      res.writeHead(500).end('Server error');
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

async function createWindow() {
  const port = await startServer();

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0f1115',
    title: 'PhotoSorter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

async function walkImages(dir, acc) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkImages(full, acc);
    } else if (IMAGE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      acc.push(full);
    }
  }
  return acc;
}

// Let the user pick individual image files.
ipcMain.handle('pick-photos', async () => {
  const result = await dialog.showOpenDialog({
    title: '사진 선택',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '이미지', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
  });
  if (result.canceled) return [];
  return result.filePaths;
});

// Let the user pick a folder; return every image found (recursively).
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: '사진 폴더 선택',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  const images = [];
  await walkImages(result.filePaths[0], images);
  return images;
});

// Read a single image and return it as a data URL for the renderer to load.
ipcMain.handle('read-image', async (_evt, filePath) => {
  try {
    const buf = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'image/jpeg';
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});

// Pick an output folder for the export step.
ipcMain.handle('pick-output', async () => {
  const result = await dialog.showOpenDialog({
    title: '내보낼 폴더 선택',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

function sanitizeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim() || '인물';
}

// Copy each cluster's photos into its own subfolder under outputDir.
// clusters: [{ label, paths: [absolutePath, ...] }]
ipcMain.handle('export-clusters', async (_evt, payload) => {
  const { outputDir, clusters } = payload || {};
  if (!outputDir || !Array.isArray(clusters)) {
    return { ok: false, error: '잘못된 요청입니다.' };
  }

  const root = path.join(outputDir, 'PhotoSorter_결과');
  let copied = 0;
  const used = new Set();

  try {
    await fsp.mkdir(root, { recursive: true });
    for (const cluster of clusters) {
      let folderName = sanitizeName(cluster.label);
      let unique = folderName;
      let n = 2;
      while (used.has(unique.toLowerCase())) {
        unique = `${folderName}_${n++}`;
      }
      used.add(unique.toLowerCase());

      const targetDir = path.join(root, unique);
      await fsp.mkdir(targetDir, { recursive: true });

      for (const src of cluster.paths) {
        const base = path.basename(src);
        let dest = path.join(targetDir, base);
        // Avoid clobbering same-named files from different source folders.
        if (fs.existsSync(dest)) {
          const ext = path.extname(base);
          const stem = path.basename(base, ext);
          dest = path.join(targetDir, `${stem}_${copied}${ext}`);
        }
        await fsp.copyFile(src, dest);
        copied++;
      }
    }
    return { ok: true, copied, outputPath: root };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
});
