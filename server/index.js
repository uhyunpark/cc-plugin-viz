import { createServer as httpCreateServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { Router } from './router.js';
import { getPluginPaths } from './lib/paths.js';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const publicDir = join(import.meta.dirname, '..', 'public');

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function serveStatic(req, res) {
  let filePath = join(publicDir, req.url === '/' ? 'index.html' : req.url);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    const content = await readFile(filePath);
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    return false;
  }
  return true;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export async function createServer({ port = 3333, claudeDir } = {}) {
  const paths = getPluginPaths(claudeDir);
  const router = new Router();

  // Import and register routes
  const { registerPluginRoutes } = await import('./routes/plugins.js');
  const { registerMarketplaceRoutes } = await import('./routes/marketplaces.js');
  const { registerSettingsRoutes } = await import('./routes/settings.js');

  registerPluginRoutes(router, paths);
  registerMarketplaceRoutes(router, paths);
  registerSettingsRoutes(router, paths);

  const server = httpCreateServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API routes
    if (pathname.startsWith('/api/')) {
      const match = router.match(req.method, pathname);
      if (match) {
        try {
          const body = ['POST', 'PATCH', 'PUT'].includes(req.method)
            ? await parseBody(req)
            : {};
          await match.handler({ req, res, params: match.params, body, sendJSON: (code, data) => sendJSON(res, code, data) });
        } catch (err) {
          sendJSON(res, 500, { ok: false, error: err.message });
        }
        return;
      }
      sendJSON(res, 404, { ok: false, error: 'Not found' });
      return;
    }

    // Static files
    const served = await serveStatic(req, res);
    if (!served) {
      // SPA fallback — serve index.html for unknown paths
      try {
        const content = await readFile(join(publicDir, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '3333', 10);
  const server = await createServer({ port });
  const addr = server.address();
  console.log(`cc-plugin-viz running at http://127.0.0.1:${addr.port}`);

  // Open browser
  const { exec } = await import('node:child_process');
  exec(`open http://127.0.0.1:${addr.port}`);
}
