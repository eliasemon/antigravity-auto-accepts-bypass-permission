import http from 'http';
import fs from 'fs';
import path from 'path';
import { getDefaultConfigDir } from './config.js';

export function getDaemonStatePath() {
  return path.join(getDefaultConfigDir(), 'daemon.json');
}

export function readDaemonState() {
  const filePath = getDaemonStatePath();
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function writeDaemonState(state) {
  const filePath = getDaemonStatePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

export function clearDaemonState() {
  const filePath = getDaemonStatePath();
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  }
}

/**
 * Creates lightweight local IPC HTTP server for daemon management.
 */
export function createIPCServer({ onStatus, onToggle, onPause, onResume, onStop }) {
  const server = http.createServer(async (req, res) => {
    // Only accept requests from localhost
    const remote = req.socket.remoteAddress;
    if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    const url = new URL(req.url, 'http://127.0.0.1');

    res.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/status' && req.method === 'GET') {
      const status = await onStatus();
      res.writeHead(200);
      return res.end(JSON.stringify(status));
    }

    if (url.pathname === '/toggle' && req.method === 'POST') {
      const result = await onToggle();
      res.writeHead(200);
      return res.end(JSON.stringify(result));
    }

    if (url.pathname === '/pause' && req.method === 'POST') {
      const result = await onPause();
      res.writeHead(200);
      return res.end(JSON.stringify(result));
    }

    if (url.pathname === '/resume' && req.method === 'POST') {
      const result = await onResume();
      res.writeHead(200);
      return res.end(JSON.stringify(result));
    }

    if (url.pathname === '/stop' && req.method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({ stopping: true }));
      setTimeout(() => onStop(), 100);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}

/**
 * Sends IPC request from CLI to running daemon
 */
export function sendIPCRequest(port, method, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: pathname,
        method,
        timeout: 3000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('IPC request timed out'));
    });
    req.end();
  });
}
