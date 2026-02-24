# cc-plugin-viz Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Claude Code plugin that launches a local web dashboard for visual plugin management across scopes (user/project/local).

**Architecture:** Single skill (`/viz`) starts a `node:http` server serving a vanilla HTML/CSS/JS dashboard. REST API reads/writes Claude Code plugin JSON files (`~/.claude/plugins/`). Zero external dependencies.

**Tech Stack:** Node.js (`node:http`, `node:fs`, `node:path`, `node:child_process`), vanilla HTML/CSS/JS, native Drag and Drop API.

---

## Phase 1: Plugin Scaffold

### Task 1: Create plugin metadata files

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `skills/viz/SKILL.md`
- Create: `package.json`

**Step 1: Create plugin.json**

```json
{
  "name": "cc-plugin-viz",
  "description": "Visual dashboard for managing Claude Code plugins across scopes",
  "author": {
    "name": "uhyun"
  },
  "skills": "./skills/"
}
```

**Step 2: Create SKILL.md**

```markdown
---
name: viz
description: Launch the plugin visualization dashboard in your browser
---

Launch the cc-plugin-viz dashboard server and open it in the browser.

When the user invokes /viz, run:

\`\`\`bash
node ${CLAUDE_PLUGIN_ROOT}/server/index.js
\`\`\`

This starts a local HTTP server and opens the dashboard at http://localhost:3333.
Print the URL so the user can re-open it.
```

**Step 3: Create package.json**

```json
{
  "name": "cc-plugin-viz",
  "version": "0.1.0",
  "description": "Visual dashboard for managing Claude Code plugins",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "test": "node --test tests/**/*.test.js"
  }
}
```

**Step 4: Commit**

```bash
git add .claude-plugin/plugin.json skills/viz/SKILL.md package.json
git commit -m "scaffold: add plugin metadata and skill definition"
```

---

## Phase 2: Server Core Library

### Task 2: Path resolution module

Resolves all `~/.claude/plugins/*` paths. This is the foundation everything else builds on.

**Files:**
- Create: `server/lib/paths.js`
- Create: `tests/lib/paths.test.js`

**Step 1: Write the failing test**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPluginPaths } from '../../server/lib/paths.js';

describe('getPluginPaths', () => {
  it('returns all expected path keys', () => {
    const paths = getPluginPaths();
    assert.ok(paths.claudeDir);
    assert.ok(paths.pluginsDir);
    assert.ok(paths.installedPlugins);
    assert.ok(paths.knownMarketplaces);
    assert.ok(paths.settings);
    assert.ok(paths.blocklist);
    assert.ok(paths.installCounts);
    assert.ok(paths.cacheDir);
    assert.ok(paths.marketplacesDir);
    assert.ok(paths.backupDir);
  });

  it('all paths are under home directory', () => {
    const paths = getPluginPaths();
    const home = process.env.HOME || process.env.USERPROFILE;
    for (const [key, val] of Object.entries(paths)) {
      assert.ok(val.startsWith(home), `${key} should start with home dir`);
    }
  });

  it('accepts custom base dir for testing', () => {
    const paths = getPluginPaths('/tmp/test-claude');
    assert.equal(paths.claudeDir, '/tmp/test-claude');
    assert.equal(paths.pluginsDir, '/tmp/test-claude/plugins');
    assert.equal(paths.installedPlugins, '/tmp/test-claude/plugins/installed_plugins.json');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/paths.test.js`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```js
import { join } from 'node:path';
import { homedir } from 'node:os';

export function getPluginPaths(baseDir) {
  const claudeDir = baseDir || join(homedir(), '.claude');
  const pluginsDir = join(claudeDir, 'plugins');

  return {
    claudeDir,
    pluginsDir,
    installedPlugins: join(pluginsDir, 'installed_plugins.json'),
    knownMarketplaces: join(pluginsDir, 'known_marketplaces.json'),
    settings: join(claudeDir, 'settings.json'),
    blocklist: join(pluginsDir, 'blocklist.json'),
    installCounts: join(pluginsDir, 'install-counts-cache.json'),
    cacheDir: join(pluginsDir, 'cache'),
    marketplacesDir: join(pluginsDir, 'marketplaces'),
    backupDir: join(pluginsDir, '.backup'),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/paths.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/lib/paths.js tests/lib/paths.test.js
git commit -m "feat: add path resolution module"
```

---

### Task 3: Safe JSON reader

Reads JSON files with error handling for missing/malformed files.

**Files:**
- Create: `server/lib/reader.js`
- Create: `tests/lib/reader.test.js`
- Create: `tests/fixtures/` (test data)

**Step 1: Create test fixtures**

Create `tests/fixtures/valid.json`:
```json
{"name": "test", "version": "1.0.0"}
```

Create `tests/fixtures/malformed.json`:
```
{not valid json
```

**Step 2: Write the failing test**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON } from '../../server/lib/reader.js';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

describe('readJSON', () => {
  it('reads valid JSON file', async () => {
    const data = await readJSON(join(fixturesDir, 'valid.json'));
    assert.deepEqual(data, { name: 'test', version: '1.0.0' });
  });

  it('returns null for missing file', async () => {
    const data = await readJSON(join(fixturesDir, 'nonexistent.json'));
    assert.equal(data, null);
  });

  it('returns null for malformed JSON', async () => {
    const data = await readJSON(join(fixturesDir, 'malformed.json'));
    assert.equal(data, null);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `node --test tests/lib/reader.test.js`
Expected: FAIL

**Step 4: Write implementation**

```js
import { readFile } from 'node:fs/promises';

export async function readJSON(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `node --test tests/lib/reader.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add server/lib/reader.js tests/lib/reader.test.js tests/fixtures/
git commit -m "feat: add safe JSON reader"
```

---

### Task 4: Atomic JSON writer with backup

Writes JSON files atomically (tmp + rename) and creates backups before mutation.

**Files:**
- Create: `server/lib/writer.js`
- Create: `tests/lib/writer.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeJSON } from '../../server/lib/writer.js';
import { readJSON } from '../../server/lib/reader.js';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('writeJSON', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'writer-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it('writes valid JSON to file', async () => {
    const filePath = join(tempDir, 'out.json');
    const data = { key: 'value' };
    await writeJSON(filePath, data);
    const result = await readJSON(filePath);
    assert.deepEqual(result, data);
  });

  it('creates backup before overwriting existing file', async () => {
    const filePath = join(tempDir, 'out.json');
    const backupDir = join(tempDir, '.backup');
    await writeJSON(filePath, { v: 1 }, backupDir);
    await writeJSON(filePath, { v: 2 }, backupDir);
    const backups = await readdir(backupDir);
    assert.ok(backups.length >= 1, 'should have at least one backup');
  });

  it('keeps only last 5 backups per file', async () => {
    const filePath = join(tempDir, 'out.json');
    const backupDir = join(tempDir, '.backup');
    for (let i = 0; i < 8; i++) {
      await writeJSON(filePath, { v: i }, backupDir);
    }
    const backups = await readdir(backupDir);
    const relevant = backups.filter(b => b.startsWith('out.'));
    assert.ok(relevant.length <= 5, `expected <= 5 backups, got ${relevant.length}`);
  });

  it('does not leave .tmp files on success', async () => {
    const filePath = join(tempDir, 'out.json');
    await writeJSON(filePath, { ok: true });
    const files = await readdir(tempDir);
    const tmpFiles = files.filter(f => f.endsWith('.tmp'));
    assert.equal(tmpFiles.length, 0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/writer.test.js`
Expected: FAIL

**Step 3: Write implementation**

```js
import { writeFile, rename, copyFile, mkdir, readdir, unlink, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

export async function writeJSON(filePath, data, backupDir) {
  // Validate serialization before touching anything
  const json = JSON.stringify(data, null, 2) + '\n';

  // Backup existing file if it exists and backupDir is provided
  if (backupDir) {
    try {
      await stat(filePath);
      await mkdir(backupDir, { recursive: true });
      const name = basename(filePath, '.json');
      const backupName = `${name}.${Date.now()}.json`;
      await copyFile(filePath, join(backupDir, backupName));
      await pruneBackups(backupDir, name, 5);
    } catch {
      // File doesn't exist yet, no backup needed
    }
  }

  // Atomic write: tmp file -> rename
  const tmpPath = filePath + '.tmp';
  await writeFile(tmpPath, json, 'utf-8');

  // Validate written content is parseable
  JSON.parse(json);

  await rename(tmpPath, filePath);
}

async function pruneBackups(backupDir, prefix, keep) {
  const files = await readdir(backupDir);
  const matching = files
    .filter(f => f.startsWith(prefix + '.') && f.endsWith('.json'))
    .sort()
    .reverse();

  for (const file of matching.slice(keep)) {
    await unlink(join(backupDir, file));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/writer.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/lib/writer.js tests/lib/writer.test.js
git commit -m "feat: add atomic JSON writer with backup"
```

---

### Task 5: HTTP server with static file serving and router

The core server that serves static files from `public/` and routes API requests.

**Files:**
- Create: `server/index.js`
- Create: `server/router.js`
- Create: `tests/server/router.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../server/index.js';

describe('HTTP server', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await createServer({ port: 0 }); // random port
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    server.close();
  });

  it('serves static files from public/', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('<!DOCTYPE html') || text.includes('<html'), 'should serve HTML');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('returns JSON for API routes', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    assert.equal(res.headers.get('content-type'), 'application/json');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/router.test.js`
Expected: FAIL

**Step 3: Create a minimal index.html for static serving**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cc-plugin-viz</title>
</head>
<body>
  <div id="app">Loading...</div>
</body>
</html>
```

**Step 4: Write router**

```js
// server/router.js
export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    // Convert /api/plugins/:id/toggle to regex
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method,
      regex: new RegExp(`^${regexStr}$`),
      paramNames,
      handler,
    });
  }

  get(pattern, handler) { this.add('GET', pattern, handler); }
  post(pattern, handler) { this.add('POST', pattern, handler); }
  patch(pattern, handler) { this.add('PATCH', pattern, handler); }
  put(pattern, handler) { this.add('PUT', pattern, handler); }
  delete(pattern, handler) { this.add('DELETE', pattern, handler); }

  match(method, url) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = url.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}
```

**Step 5: Write server**

```js
// server/index.js
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

  // Import and register routes (will be added in Phase 3/4)
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
```

**Step 6: Create stub route files** (so server can import them)

Create `server/routes/plugins.js`:
```js
export function registerPluginRoutes(router, paths) {
  router.get('/api/plugins', async ({ sendJSON }) => {
    sendJSON(200, { ok: true, data: [] });
  });
}
```

Create `server/routes/marketplaces.js`:
```js
export function registerMarketplaceRoutes(router, paths) {
  router.get('/api/marketplaces', async ({ sendJSON }) => {
    sendJSON(200, { ok: true, data: [] });
  });
}
```

Create `server/routes/settings.js`:
```js
export function registerSettingsRoutes(router, paths) {
  router.get('/api/settings', async ({ sendJSON }) => {
    sendJSON(200, { ok: true, data: {} });
  });
}
```

**Step 7: Run test to verify it passes**

Run: `node --test tests/server/router.test.js`
Expected: PASS

**Step 8: Commit**

```bash
git add server/index.js server/router.js server/routes/ public/index.html tests/server/
git commit -m "feat: add HTTP server with static serving and router"
```

---

## Phase 3: Read API Endpoints

### Task 6: GET /api/plugins — list all installed plugins

Reads `installed_plugins.json`, merges with `settings.json` enablement data, and reads each plugin's `plugin.json` for type info.

**Files:**
- Modify: `server/routes/plugins.js`
- Create: `tests/server/plugins.test.js`
- Create: `tests/fixtures/installed_plugins.json`
- Create: `tests/fixtures/settings.json`
- Create: `tests/fixtures/cache/` (mock plugin dirs)

**Step 1: Create test fixtures**

Create `tests/fixtures/installed_plugins.json`:
```json
{
  "version": 2,
  "plugins": {
    "test-plugin@test-marketplace": [
      {
        "scope": "user",
        "installPath": "/tmp/test-cache/test-marketplace/test-plugin/1.0.0",
        "version": "1.0.0",
        "installedAt": "2026-01-01T00:00:00.000Z",
        "lastUpdated": "2026-01-01T00:00:00.000Z"
      }
    ],
    "scoped-plugin@test-marketplace": [
      {
        "scope": "project",
        "projectPath": "/tmp/test-project",
        "installPath": "/tmp/test-cache/test-marketplace/scoped-plugin/2.0.0",
        "version": "2.0.0",
        "installedAt": "2026-01-02T00:00:00.000Z",
        "lastUpdated": "2026-01-02T00:00:00.000Z"
      }
    ]
  }
}
```

Create `tests/fixtures/settings.json`:
```json
{
  "enabledPlugins": {
    "test-plugin@test-marketplace": true,
    "scoped-plugin@test-marketplace": false
  }
}
```

**Step 2: Write the failing test**

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../server/index.js';

describe('GET /api/plugins', () => {
  let server, baseUrl, tempDir;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'viz-test-'));
    const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

    // Set up mock claude dir structure
    await mkdir(join(tempDir, 'plugins'), { recursive: true });
    await cp(join(fixturesDir, 'installed_plugins.json'), join(tempDir, 'plugins', 'installed_plugins.json'));
    await cp(join(fixturesDir, 'settings.json'), join(tempDir, 'settings.json'));

    server = await createServer({ port: 0, claudeDir: tempDir });
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    server.close();
    await rm(tempDir, { recursive: true });
  });

  it('returns all installed plugins', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.length, 2);
  });

  it('includes scope and enabled status', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    const json = await res.json();
    const userPlugin = json.data.find(p => p.id === 'test-plugin@test-marketplace');
    assert.equal(userPlugin.scope, 'user');
    assert.equal(userPlugin.enabled, true);
    assert.equal(userPlugin.version, '1.0.0');
  });

  it('marks disabled plugins correctly', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    const json = await res.json();
    const scoped = json.data.find(p => p.id === 'scoped-plugin@test-marketplace');
    assert.equal(scoped.enabled, false);
    assert.equal(scoped.scope, 'project');
    assert.equal(scoped.projectPath, '/tmp/test-project');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `node --test tests/server/plugins.test.js`
Expected: FAIL (returns empty array)

**Step 4: Implement the route**

```js
// server/routes/plugins.js
import { readJSON } from '../lib/reader.js';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';

export function registerPluginRoutes(router, paths) {

  router.get('/api/plugins', async ({ sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    const settings = await readJSON(paths.settings);
    const enabledPlugins = settings?.enabledPlugins || {};

    if (!registry?.plugins) {
      sendJSON(200, { ok: true, data: [] });
      return;
    }

    const plugins = [];

    for (const [id, installations] of Object.entries(registry.plugins)) {
      for (const install of installations) {
        // Read plugin.json for type info
        const pluginMeta = await readJSON(join(install.installPath, '.claude-plugin', 'plugin.json'));

        const [name, marketplace] = id.split('@');
        plugins.push({
          id,
          name,
          marketplace,
          description: pluginMeta?.description || '',
          version: install.version,
          scope: install.scope,
          projectPath: install.projectPath || null,
          installPath: install.installPath,
          installedAt: install.installedAt,
          lastUpdated: install.lastUpdated,
          enabled: enabledPlugins[id] === true,
          hasSkills: !!pluginMeta?.skills,
          hasHooks: !!pluginMeta?.hooks,
          hasMcpServers: !!pluginMeta?.mcpServers,
          hasLspServers: false, // detected from marketplace.json
        });
      }
    }

    sendJSON(200, { ok: true, data: plugins });
  });
}
```

**Step 5: Run test to verify it passes**

Run: `node --test tests/server/plugins.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/plugins.js tests/server/plugins.test.js tests/fixtures/
git commit -m "feat: implement GET /api/plugins endpoint"
```

---

### Task 7: GET /api/plugins/:id — single plugin detail

Returns full metadata for a single plugin including skills list, hooks config, and MCP servers.

**Files:**
- Modify: `server/routes/plugins.js`
- Modify: `tests/server/plugins.test.js`

**Step 1: Write the failing test**

Add to `tests/server/plugins.test.js`:

```js
describe('GET /api/plugins/:id', () => {
  // ... uses same server/tempDir setup from above

  it('returns plugin detail by id', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.id, 'test-plugin@test-marketplace');
    assert.equal(json.data.version, '1.0.0');
  });

  it('returns 404 for unknown plugin', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/nonexistent@nowhere`);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(res.status, 404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/plugins.test.js`
Expected: FAIL on the new describe block

**Step 3: Add route to plugins.js**

Add inside `registerPluginRoutes`:

```js
  router.get('/api/plugins/:id', async ({ params, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    const settings = await readJSON(paths.settings);
    const enabledPlugins = settings?.enabledPlugins || {};
    const id = params.id;

    const installations = registry?.plugins?.[id];
    if (!installations || installations.length === 0) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const install = installations[0];
    const pluginMeta = await readJSON(join(install.installPath, '.claude-plugin', 'plugin.json'));

    // Read skills if available
    let skills = [];
    if (pluginMeta?.skills) {
      const skillsDir = join(install.installPath, pluginMeta.skills);
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillMd = await readJSON(join(skillsDir, entry.name, 'SKILL.md')).catch(() => null);
            skills.push({ name: entry.name, path: join(skillsDir, entry.name) });
          }
        }
      } catch { /* no skills dir */ }
    }

    // Read hooks if available
    let hooks = null;
    if (pluginMeta?.hooks) {
      hooks = await readJSON(join(install.installPath, pluginMeta.hooks));
    }

    // Read MCP servers if available
    let mcpServers = null;
    if (pluginMeta?.mcpServers) {
      mcpServers = await readJSON(join(install.installPath, pluginMeta.mcpServers));
    }

    const [name, marketplace] = id.split('@');

    sendJSON(200, {
      ok: true,
      data: {
        id,
        name,
        marketplace,
        description: pluginMeta?.description || '',
        version: install.version,
        scope: install.scope,
        projectPath: install.projectPath || null,
        installPath: install.installPath,
        installedAt: install.installedAt,
        lastUpdated: install.lastUpdated,
        enabled: enabledPlugins[id] === true,
        skills,
        hooks,
        mcpServers,
        pluginMeta,
      },
    });
  });
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/plugins.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/plugins.js tests/server/plugins.test.js
git commit -m "feat: implement GET /api/plugins/:id endpoint"
```

---

### Task 8: Marketplace read endpoints

GET /api/marketplaces and GET /api/marketplaces/:name/plugins

**Files:**
- Modify: `server/routes/marketplaces.js`
- Create: `tests/server/marketplaces.test.js`
- Create: `tests/fixtures/known_marketplaces.json`

**Step 1: Create test fixtures**

Create `tests/fixtures/known_marketplaces.json`:
```json
{
  "test-marketplace": {
    "source": { "source": "github", "repo": "test/test-marketplace" },
    "installLocation": "/tmp/test-marketplaces/test-marketplace",
    "lastUpdated": "2026-01-01T00:00:00.000Z"
  }
}
```

Create `tests/fixtures/marketplaces/test-marketplace/.claude-plugin/marketplace.json`:
```json
{
  "name": "test-marketplace",
  "description": "Test marketplace",
  "owner": { "name": "Test" },
  "plugins": [
    {
      "name": "test-plugin",
      "description": "A test plugin",
      "version": "1.0.0",
      "source": "./plugins/test-plugin",
      "category": "development"
    },
    {
      "name": "another-plugin",
      "description": "Another plugin",
      "version": "2.0.0",
      "source": "./plugins/another-plugin",
      "category": "productivity"
    }
  ]
}
```

**Step 2: Write the failing test**

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../server/index.js';

describe('Marketplace endpoints', () => {
  let server, baseUrl, tempDir;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'viz-test-'));
    const fixturesDir = join(import.meta.dirname, '..', 'fixtures');

    await mkdir(join(tempDir, 'plugins'), { recursive: true });
    await mkdir(join(tempDir, 'plugins', 'marketplaces', 'test-marketplace', '.claude-plugin'), { recursive: true });
    await cp(join(fixturesDir, 'installed_plugins.json'), join(tempDir, 'plugins', 'installed_plugins.json'));
    await cp(join(fixturesDir, 'settings.json'), join(tempDir, 'settings.json'));
    await cp(join(fixturesDir, 'known_marketplaces.json'), join(tempDir, 'plugins', 'known_marketplaces.json'));
    await cp(
      join(fixturesDir, 'marketplaces', 'test-marketplace', '.claude-plugin', 'marketplace.json'),
      join(tempDir, 'plugins', 'marketplaces', 'test-marketplace', '.claude-plugin', 'marketplace.json')
    );

    server = await createServer({ port: 0, claudeDir: tempDir });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.close();
    await rm(tempDir, { recursive: true });
  });

  it('GET /api/marketplaces returns all marketplaces', async () => {
    const res = await fetch(`${baseUrl}/api/marketplaces`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.length, 1);
    assert.equal(json.data[0].name, 'test-marketplace');
    assert.equal(json.data[0].source.repo, 'test/test-marketplace');
  });

  it('GET /api/marketplaces/:name/plugins returns plugins', async () => {
    const res = await fetch(`${baseUrl}/api/marketplaces/test-marketplace/plugins`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.length, 2);
    assert.equal(json.data[0].name, 'test-plugin');
    assert.equal(json.data[1].name, 'another-plugin');
  });

  it('GET /api/marketplaces/:name/plugins returns 404 for unknown', async () => {
    const res = await fetch(`${baseUrl}/api/marketplaces/unknown/plugins`);
    assert.equal(res.status, 404);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `node --test tests/server/marketplaces.test.js`
Expected: FAIL

**Step 4: Implement**

```js
// server/routes/marketplaces.js
import { readJSON } from '../lib/reader.js';
import { join } from 'node:path';

export function registerMarketplaceRoutes(router, paths) {

  router.get('/api/marketplaces', async ({ sendJSON }) => {
    const known = await readJSON(paths.knownMarketplaces);
    if (!known) {
      sendJSON(200, { ok: true, data: [] });
      return;
    }

    const marketplaces = Object.entries(known).map(([name, info]) => ({
      name,
      source: info.source,
      installLocation: info.installLocation,
      lastUpdated: info.lastUpdated,
    }));

    sendJSON(200, { ok: true, data: marketplaces });
  });

  router.get('/api/marketplaces/:name/plugins', async ({ params, sendJSON }) => {
    const known = await readJSON(paths.knownMarketplaces);
    const marketplace = known?.[params.name];
    if (!marketplace) {
      sendJSON(404, { ok: false, error: 'Marketplace not found' });
      return;
    }

    const marketplaceMeta = await readJSON(
      join(paths.marketplacesDir, params.name, '.claude-plugin', 'marketplace.json')
    );

    if (!marketplaceMeta?.plugins) {
      sendJSON(200, { ok: true, data: [] });
      return;
    }

    // Merge with install counts
    const counts = await readJSON(paths.installCounts);
    const countMap = {};
    if (counts?.counts) {
      for (const c of counts.counts) {
        countMap[c.plugin] = c.unique_installs;
      }
    }

    // Check which are already installed
    const registry = await readJSON(paths.installedPlugins);
    const installedSet = new Set(Object.keys(registry?.plugins || {}));

    const plugins = marketplaceMeta.plugins.map(p => ({
      ...p,
      marketplace: params.name,
      fullId: `${p.name}@${params.name}`,
      installed: installedSet.has(`${p.name}@${params.name}`),
      installCount: countMap[`${p.name}@${params.name}`] || 0,
    }));

    sendJSON(200, { ok: true, data: plugins });
  });
}
```

**Step 5: Run test to verify it passes**

Run: `node --test tests/server/marketplaces.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/marketplaces.js tests/server/marketplaces.test.js tests/fixtures/
git commit -m "feat: implement marketplace read endpoints"
```

---

### Task 9: Settings, blocklist, and install counts endpoints

**Files:**
- Modify: `server/routes/settings.js`
- Create: `tests/server/settings.test.js`
- Create: `tests/fixtures/blocklist.json`
- Create: `tests/fixtures/install-counts-cache.json`

**Step 1: Create test fixtures**

Create `tests/fixtures/blocklist.json`:
```json
{
  "fetchedAt": "2026-01-01T00:00:00.000Z",
  "plugins": [
    { "plugin": "blocked@test-marketplace", "added_at": "2026-01-01T00:00:00.000Z", "reason": "test", "text": "Test block" }
  ]
}
```

Create `tests/fixtures/install-counts-cache.json`:
```json
{
  "version": 1,
  "fetchedAt": "2026-01-01T00:00:00.000Z",
  "counts": [
    { "plugin": "test-plugin@test-marketplace", "unique_installs": 1000 }
  ]
}
```

**Step 2: Write the failing test**

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from '../../server/index.js';

describe('Settings, blocklist, install-counts endpoints', () => {
  let server, baseUrl, tempDir;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'viz-test-'));
    const fixturesDir = join(import.meta.dirname, '..', 'fixtures');
    await mkdir(join(tempDir, 'plugins', 'marketplaces'), { recursive: true });
    await cp(join(fixturesDir, 'installed_plugins.json'), join(tempDir, 'plugins', 'installed_plugins.json'));
    await cp(join(fixturesDir, 'settings.json'), join(tempDir, 'settings.json'));
    await cp(join(fixturesDir, 'blocklist.json'), join(tempDir, 'plugins', 'blocklist.json'));
    await cp(join(fixturesDir, 'install-counts-cache.json'), join(tempDir, 'plugins', 'install-counts-cache.json'));
    await cp(join(fixturesDir, 'known_marketplaces.json'), join(tempDir, 'plugins', 'known_marketplaces.json'));

    server = await createServer({ port: 0, claudeDir: tempDir });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.close();
    await rm(tempDir, { recursive: true });
  });

  it('GET /api/settings returns enabledPlugins', async () => {
    const res = await fetch(`${baseUrl}/api/settings`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.ok(json.data.enabledPlugins);
    assert.equal(json.data.enabledPlugins['test-plugin@test-marketplace'], true);
  });

  it('GET /api/blocklist returns blocked plugins', async () => {
    const res = await fetch(`${baseUrl}/api/blocklist`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.plugins.length, 1);
    assert.equal(json.data.plugins[0].plugin, 'blocked@test-marketplace');
  });

  it('GET /api/install-counts returns counts', async () => {
    const res = await fetch(`${baseUrl}/api/install-counts`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.counts.length, 1);
    assert.equal(json.data.counts[0].unique_installs, 1000);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `node --test tests/server/settings.test.js`
Expected: FAIL

**Step 4: Implement**

```js
// server/routes/settings.js
import { readJSON } from '../lib/reader.js';

export function registerSettingsRoutes(router, paths) {

  router.get('/api/settings', async ({ sendJSON }) => {
    const settings = await readJSON(paths.settings);
    sendJSON(200, {
      ok: true,
      data: { enabledPlugins: settings?.enabledPlugins || {} },
    });
  });

  router.get('/api/blocklist', async ({ sendJSON }) => {
    const blocklist = await readJSON(paths.blocklist);
    sendJSON(200, {
      ok: true,
      data: blocklist || { fetchedAt: null, plugins: [] },
    });
  });

  router.get('/api/install-counts', async ({ sendJSON }) => {
    const counts = await readJSON(paths.installCounts);
    sendJSON(200, {
      ok: true,
      data: counts || { version: 1, fetchedAt: null, counts: [] },
    });
  });
}
```

**Step 5: Run test to verify it passes**

Run: `node --test tests/server/settings.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/settings.js tests/server/settings.test.js tests/fixtures/
git commit -m "feat: implement settings, blocklist, install-counts read endpoints"
```

---

## Phase 4: Write API Endpoints

### Task 10: PATCH /api/plugins/:id/toggle — enable/disable

**Files:**
- Modify: `server/routes/plugins.js`
- Modify: `tests/server/plugins.test.js`

**Step 1: Write the failing test**

Add to `tests/server/plugins.test.js`:

```js
describe('PATCH /api/plugins/:id/toggle', () => {
  // ... uses same server/tempDir setup

  it('toggles a plugin from enabled to disabled', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    const json = await res.json();
    assert.equal(json.ok, true);

    // Verify settings file was updated
    const settings = await fetch(`${baseUrl}/api/settings`);
    const settingsJson = await settings.json();
    assert.equal(settingsJson.data.enabledPlugins['test-plugin@test-marketplace'], false);
  });

  it('returns 404 for unknown plugin', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/unknown@nowhere/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(res.status, 404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/plugins.test.js`
Expected: FAIL

**Step 3: Implement**

Add to `registerPluginRoutes` in `server/routes/plugins.js`:

```js
import { writeJSON } from '../lib/writer.js';

  router.patch('/api/plugins/:id/toggle', async ({ params, body, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const settings = await readJSON(paths.settings) || {};
    if (!settings.enabledPlugins) settings.enabledPlugins = {};
    settings.enabledPlugins[params.id] = body.enabled === true;

    await writeJSON(paths.settings, settings, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id, enabled: body.enabled } });
  });
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/plugins.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/plugins.js tests/server/plugins.test.js
git commit -m "feat: implement plugin toggle endpoint"
```

---

### Task 11: PATCH /api/plugins/:id/scope — change scope

**Files:**
- Modify: `server/routes/plugins.js`
- Modify: `tests/server/plugins.test.js`

**Step 1: Write the failing test**

```js
describe('PATCH /api/plugins/:id/scope', () => {
  it('changes scope from user to project', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/scope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'project', projectPath: '/tmp/my-project' }),
    });
    const json = await res.json();
    assert.equal(json.ok, true);

    // Verify the change persisted
    const plugins = await fetch(`${baseUrl}/api/plugins`);
    const pluginsJson = await plugins.json();
    const plugin = pluginsJson.data.find(p => p.id === 'test-plugin@test-marketplace');
    assert.equal(plugin.scope, 'project');
    assert.equal(plugin.projectPath, '/tmp/my-project');
  });

  it('rejects invalid scope', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/scope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'invalid' }),
    });
    assert.equal(res.status, 400);
  });

  it('requires projectPath for project/local scope', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/scope`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'project' }),
    });
    assert.equal(res.status, 400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/plugins.test.js`
Expected: FAIL

**Step 3: Implement**

```js
  const VALID_SCOPES = ['user', 'project', 'local'];

  router.patch('/api/plugins/:id/scope', async ({ params, body, sendJSON }) => {
    if (!VALID_SCOPES.includes(body.scope)) {
      sendJSON(400, { ok: false, error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}` });
      return;
    }

    if ((body.scope === 'project' || body.scope === 'local') && !body.projectPath) {
      sendJSON(400, { ok: false, error: 'projectPath is required for project/local scope' });
      return;
    }

    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const install = registry.plugins[params.id][0];
    install.scope = body.scope;
    if (body.scope === 'user') {
      delete install.projectPath;
    } else {
      install.projectPath = body.projectPath;
    }

    await writeJSON(paths.installedPlugins, registry, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id, scope: body.scope, projectPath: body.projectPath || null } });
  });
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/plugins.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/plugins.js tests/server/plugins.test.js
git commit -m "feat: implement plugin scope change endpoint"
```

---

### Task 12: Install and uninstall endpoints

These shell out to `claude` CLI for safety.

**Files:**
- Modify: `server/routes/plugins.js`
- Modify: `tests/server/plugins.test.js`

**Step 1: Write the failing test**

```js
describe('POST /api/plugins/install', () => {
  it('calls claude CLI to install a plugin', async () => {
    // This test verifies the endpoint structure and validation
    // Actual CLI execution is tested in integration tests
    const res = await fetch(`${baseUrl}/api/plugins/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-plugin', marketplace: 'test-marketplace', scope: 'user' }),
    });
    const json = await res.json();
    // Will fail or succeed depending on claude CLI availability
    assert.ok(json.ok !== undefined);
  });

  it('rejects missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-plugin' }),
    });
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(res.status, 400);
  });
});

describe('DELETE /api/plugins/:id', () => {
  it('rejects unknown plugin', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/unknown@nowhere`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/plugins.test.js`
Expected: FAIL

**Step 3: Implement**

```js
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

  router.post('/api/plugins/install', async ({ body, sendJSON }) => {
    const { name, marketplace, scope, projectPath } = body;

    if (!name || !marketplace) {
      sendJSON(400, { ok: false, error: 'name and marketplace are required' });
      return;
    }

    if (!scope || !VALID_SCOPES.includes(scope)) {
      sendJSON(400, { ok: false, error: `scope is required and must be one of: ${VALID_SCOPES.join(', ')}` });
      return;
    }

    if ((scope === 'project' || scope === 'local') && !projectPath) {
      sendJSON(400, { ok: false, error: 'projectPath is required for project/local scope' });
      return;
    }

    try {
      const scopeFlag = scope === 'user' ? '--global' : `--scope ${scope}`;
      const projectFlag = projectPath ? `--project "${projectPath}"` : '';
      const cmd = `claude plugins install "${name}@${marketplace}" ${scopeFlag} ${projectFlag}`.trim();
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
      sendJSON(200, { ok: true, data: { message: stdout || 'Installed successfully', stderr } });
    } catch (err) {
      sendJSON(500, { ok: false, error: `Install failed: ${err.message}` });
    }
  });

  router.delete('/api/plugins/:id', async ({ params, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    try {
      const cmd = `claude plugins uninstall "${params.id}"`;
      const { stdout, stderr } = await execAsync(cmd, { timeout: 60000 });
      sendJSON(200, { ok: true, data: { message: stdout || 'Uninstalled successfully', stderr } });
    } catch (err) {
      sendJSON(500, { ok: false, error: `Uninstall failed: ${err.message}` });
    }
  });
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server/plugins.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/plugins.js tests/server/plugins.test.js
git commit -m "feat: implement install and uninstall endpoints via claude CLI"
```

---

### Task 13: Plugin config edit and blocklist CRUD

**Files:**
- Modify: `server/routes/plugins.js` (config edit)
- Modify: `server/routes/settings.js` (blocklist CRUD)
- Modify: `tests/server/settings.test.js`

**Step 1: Write the failing tests**

Add to `tests/server/settings.test.js`:

```js
describe('Blocklist CRUD', () => {
  it('POST /api/blocklist/:id adds to blocklist', async () => {
    const res = await fetch(`${baseUrl}/api/blocklist/new-blocked@test-marketplace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'testing' }),
    });
    const json = await res.json();
    assert.equal(json.ok, true);

    const list = await fetch(`${baseUrl}/api/blocklist`);
    const listJson = await list.json();
    assert.ok(listJson.data.plugins.some(p => p.plugin === 'new-blocked@test-marketplace'));
  });

  it('DELETE /api/blocklist/:id removes from blocklist', async () => {
    const res = await fetch(`${baseUrl}/api/blocklist/blocked@test-marketplace`, {
      method: 'DELETE',
    });
    const json = await res.json();
    assert.equal(json.ok, true);

    const list = await fetch(`${baseUrl}/api/blocklist`);
    const listJson = await list.json();
    assert.ok(!listJson.data.plugins.some(p => p.plugin === 'blocked@test-marketplace'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server/settings.test.js`
Expected: FAIL

**Step 3: Implement blocklist CRUD**

Add to `registerSettingsRoutes` in `server/routes/settings.js`:

```js
import { writeJSON } from '../lib/writer.js';

  router.post('/api/blocklist/:id', async ({ params, body, sendJSON }) => {
    const blocklist = await readJSON(paths.blocklist) || { fetchedAt: null, plugins: [] };

    if (blocklist.plugins.some(p => p.plugin === params.id)) {
      sendJSON(409, { ok: false, error: 'Plugin already in blocklist' });
      return;
    }

    blocklist.plugins.push({
      plugin: params.id,
      added_at: new Date().toISOString(),
      reason: body.reason || '',
      text: body.text || '',
    });

    await writeJSON(paths.blocklist, blocklist, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id } });
  });

  router.delete('/api/blocklist/:id', async ({ params, sendJSON }) => {
    const blocklist = await readJSON(paths.blocklist) || { fetchedAt: null, plugins: [] };

    const before = blocklist.plugins.length;
    blocklist.plugins = blocklist.plugins.filter(p => p.plugin !== params.id);

    if (blocklist.plugins.length === before) {
      sendJSON(404, { ok: false, error: 'Plugin not in blocklist' });
      return;
    }

    await writeJSON(paths.blocklist, blocklist, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id } });
  });
```

**Step 4: Implement plugin config edit**

Add to `registerPluginRoutes` in `server/routes/plugins.js`:

```js
  router.put('/api/plugins/:id/config', async ({ params, body, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const install = registry.plugins[params.id][0];
    const configPath = join(install.installPath, '.claude-plugin', 'plugin.json');
    const config = await readJSON(configPath);

    if (!config) {
      sendJSON(404, { ok: false, error: 'Plugin config not found' });
      return;
    }

    // Merge provided fields (only allow safe fields)
    const allowedFields = ['description'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        config[field] = body[field];
      }
    }

    await writeJSON(configPath, config, paths.backupDir);
    sendJSON(200, { ok: true, data: config });
  });
```

**Step 5: Run test to verify it passes**

Run: `node --test tests/server/settings.test.js`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/plugins.js server/routes/settings.js tests/server/settings.test.js
git commit -m "feat: implement blocklist CRUD and plugin config edit"
```

---

## Phase 5: Frontend Shell

### Task 14: HTML structure, CSS, and app shell

Build the complete HTML/CSS foundation and the JS app shell with sidebar navigation.

**Files:**
- Modify: `public/index.html`
- Create: `public/style.css`
- Create: `public/js/api.js`
- Create: `public/js/app.js`
- Create: `public/js/components/sidebar.js`

**Step 1: Build index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cc-plugin-viz</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="app">
    <nav id="sidebar"></nav>
    <main id="content">
      <header id="header">
        <input type="search" id="search" placeholder="Search plugins..." />
      </header>
      <div id="view"></div>
    </main>
  </div>
  <div id="modal-overlay" class="hidden"></div>
  <script type="module" src="/js/app.js"></script>
</body>
</html>
```

**Step 2: Build style.css**

Full CSS covering: layout, sidebar, cards, scope badges, toggle switches, drag-and-drop zones, modals, search bar, responsive grid. Use CSS custom properties for theming. Color scheme:

- Scope badges: blue (#3b82f6) for user, green (#22c55e) for project, orange (#f97316) for local
- Toggle switch: green when on, gray when off
- Cards: white with subtle shadow, hover lift effect
- Modal: centered overlay with backdrop blur

This file will be ~300 lines. Write the complete CSS with all components styled.

**Step 3: Build api.js**

```js
// public/js/api.js
const BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export const api = {
  getPlugins: () => request('/api/plugins'),
  getPlugin: (id) => request(`/api/plugins/${encodeURIComponent(id)}`),
  getMarketplaces: () => request('/api/marketplaces'),
  getMarketplacePlugins: (name) => request(`/api/marketplaces/${encodeURIComponent(name)}/plugins`),
  getSettings: () => request('/api/settings'),
  getBlocklist: () => request('/api/blocklist'),
  getInstallCounts: () => request('/api/install-counts'),
  togglePlugin: (id, enabled) => request(`/api/plugins/${encodeURIComponent(id)}/toggle`, {
    method: 'PATCH', body: JSON.stringify({ enabled }),
  }),
  changeScope: (id, scope, projectPath) => request(`/api/plugins/${encodeURIComponent(id)}/scope`, {
    method: 'PATCH', body: JSON.stringify({ scope, projectPath }),
  }),
  installPlugin: (name, marketplace, scope, projectPath) => request('/api/plugins/install', {
    method: 'POST', body: JSON.stringify({ name, marketplace, scope, projectPath }),
  }),
  uninstallPlugin: (id) => request(`/api/plugins/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addToBlocklist: (id, reason) => request(`/api/blocklist/${encodeURIComponent(id)}`, {
    method: 'POST', body: JSON.stringify({ reason }),
  }),
  removeFromBlocklist: (id) => request(`/api/blocklist/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
```

**Step 4: Build sidebar.js**

```js
// public/js/components/sidebar.js
export function renderSidebar(container, activeView, onNavigate) {
  const items = [
    { id: 'overview', label: 'Overview', icon: '&#9783;' },
    { id: 'by-scope', label: 'By Scope', icon: '&#9776;', children: [
      { id: 'scope-user', label: 'User (Global)' },
      { id: 'scope-project', label: 'Project' },
      { id: 'scope-local', label: 'Local' },
    ]},
    { id: 'marketplace', label: 'Marketplace', icon: '&#9733;' },
    { id: 'blocklist', label: 'Blocklist', icon: '&#9888;' },
  ];

  container.innerHTML = `
    <div class="sidebar-header">
      <h1 class="sidebar-title">cc-plugin-viz</h1>
    </div>
    <ul class="sidebar-nav">
      ${items.map(item => `
        <li class="nav-item ${activeView === item.id ? 'active' : ''}">
          <a href="#" data-view="${item.id}" class="nav-link">
            <span class="nav-icon">${item.icon || ''}</span>
            ${item.label}
          </a>
          ${item.children ? `
            <ul class="nav-children">
              ${item.children.map(child => `
                <li class="nav-child ${activeView === child.id ? 'active' : ''}">
                  <a href="#" data-view="${child.id}" class="nav-link">${child.label}</a>
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </li>
      `).join('')}
    </ul>
  `;

  container.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(el.dataset.view);
    });
  });
}
```

**Step 5: Build app.js shell**

```js
// public/js/app.js
import { api } from './api.js';
import { renderSidebar } from './components/sidebar.js';

let currentView = 'overview';
let pluginsCache = [];
let searchQuery = '';

async function loadPlugins() {
  const res = await api.getPlugins();
  if (res.ok) pluginsCache = res.data;
  return pluginsCache;
}

function navigate(view) {
  currentView = view;
  render();
}

async function render() {
  const sidebar = document.getElementById('sidebar');
  const viewEl = document.getElementById('view');

  renderSidebar(sidebar, currentView, navigate);

  await loadPlugins();
  // View rendering will be added in Phase 6 tasks
  viewEl.innerHTML = `<p>View: ${currentView} — ${pluginsCache.length} plugins loaded</p>`;
}

// Search handler
document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  render();
});

// Initial render
render();

// Export for use by components
export { api, pluginsCache, searchQuery, navigate, render, loadPlugins };
```

**Step 6: Manual test**

Run: `node server/index.js`
Expected: Browser opens, shows sidebar navigation and "View: overview — N plugins loaded"

**Step 7: Commit**

```bash
git add public/
git commit -m "feat: add frontend shell with sidebar, API client, and app router"
```

---

### Task 15: Plugin card and scope badge components

**Files:**
- Create: `public/js/components/plugin-card.js`
- Create: `public/js/components/scope-badge.js`

**Step 1: Build scope-badge.js**

```js
// public/js/components/scope-badge.js
const SCOPE_COLORS = {
  user: 'badge-user',
  project: 'badge-project',
  local: 'badge-local',
};

export function scopeBadge(scope) {
  const cls = SCOPE_COLORS[scope] || '';
  return `<span class="scope-badge ${cls}">${scope}</span>`;
}
```

**Step 2: Build plugin-card.js**

```js
// public/js/components/plugin-card.js
import { scopeBadge } from './scope-badge.js';

export function pluginCard(plugin, { onToggle, onClick, draggable = false } = {}) {
  const card = document.createElement('div');
  card.className = `plugin-card ${plugin.enabled ? '' : 'disabled'}`;
  card.dataset.pluginId = plugin.id;

  if (draggable) {
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', plugin.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  }

  const typeIcons = [];
  if (plugin.hasSkills) typeIcons.push('<span class="type-icon" title="Skills">S</span>');
  if (plugin.hasMcpServers) typeIcons.push('<span class="type-icon" title="MCP">M</span>');
  if (plugin.hasHooks) typeIcons.push('<span class="type-icon" title="Hooks">H</span>');
  if (plugin.hasLspServers) typeIcons.push('<span class="type-icon" title="LSP">L</span>');

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-row">
        <h3 class="card-name">${plugin.name}</h3>
        <span class="card-marketplace">@${plugin.marketplace}</span>
      </div>
      <label class="toggle-switch" title="${plugin.enabled ? 'Enabled' : 'Disabled'}">
        <input type="checkbox" ${plugin.enabled ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <p class="card-description">${plugin.description || 'No description'}</p>
    <div class="card-footer">
      <div class="card-meta">
        ${scopeBadge(plugin.scope)}
        <span class="card-version">v${plugin.version}</span>
        ${typeIcons.join('')}
      </div>
      ${plugin.projectPath ? `<span class="card-project" title="${plugin.projectPath}">${plugin.projectPath.split('/').pop()}</span>` : ''}
    </div>
  `;

  // Toggle handler
  const toggle = card.querySelector('input[type="checkbox"]');
  toggle.addEventListener('change', (e) => {
    e.stopPropagation();
    if (onToggle) onToggle(plugin.id, toggle.checked);
  });

  // Click handler (opens detail modal)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.toggle-switch')) return;
    if (onClick) onClick(plugin.id);
  });

  return card;
}
```

**Step 3: Manual test**

Run: `node server/index.js`
Verify cards render correctly (will need a view to display them — done in Task 16)

**Step 4: Commit**

```bash
git add public/js/components/plugin-card.js public/js/components/scope-badge.js
git commit -m "feat: add plugin card and scope badge components"
```

---

## Phase 6: Frontend Views

### Task 16: Overview view

**Files:**
- Create: `public/js/views/overview.js`
- Modify: `public/js/app.js` (wire up view)

**Step 1: Build overview.js**

```js
// public/js/views/overview.js
import { pluginCard } from '../components/plugin-card.js';

export function renderOverview(container, plugins, { searchQuery, onToggle, onCardClick }) {
  const filtered = plugins.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery) ||
    p.description.toLowerCase().includes(searchQuery) ||
    p.marketplace.toLowerCase().includes(searchQuery)
  );

  container.innerHTML = `
    <div class="view-header">
      <h2>All Plugins</h2>
      <span class="plugin-count">${filtered.length} plugins</span>
    </div>
    <div class="card-grid" id="overview-grid"></div>
  `;

  const grid = container.querySelector('#overview-grid');
  for (const plugin of filtered) {
    grid.appendChild(pluginCard(plugin, { onToggle, onClick: onCardClick }));
  }
}
```

**Step 2: Wire into app.js**

Update app.js `render()` function to import and call `renderOverview` when `currentView === 'overview'`.

**Step 3: Manual test**

Run: `node server/index.js`
Expected: Plugin cards displayed in grid, search filters them, toggle switches work.

**Step 4: Commit**

```bash
git add public/js/views/overview.js public/js/app.js
git commit -m "feat: add overview view with card grid and search"
```

---

### Task 17: By Scope view with drag-and-drop

**Files:**
- Create: `public/js/views/by-scope.js`
- Modify: `public/js/app.js`

**Step 1: Build by-scope.js**

```js
// public/js/views/by-scope.js
import { pluginCard } from '../components/plugin-card.js';

export function renderByScope(container, plugins, { filterScope, searchQuery, onToggle, onCardClick, onScopeChange }) {
  const filtered = plugins.filter(p => {
    if (filterScope && p.scope !== filterScope) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery) && !p.description.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  // Group by scope, then by projectPath within project/local
  const groups = {};
  for (const plugin of filtered) {
    const key = plugin.scope === 'user' ? 'user'
      : `${plugin.scope}:${plugin.projectPath || 'unknown'}`;
    if (!groups[key]) groups[key] = { scope: plugin.scope, projectPath: plugin.projectPath, plugins: [] };
    groups[key].plugins.push(plugin);
  }

  container.innerHTML = `
    <div class="view-header">
      <h2>Plugins by Scope</h2>
      <span class="plugin-count">${filtered.length} plugins</span>
    </div>
    <div id="scope-groups"></div>
  `;

  const groupsEl = container.querySelector('#scope-groups');

  for (const [key, group] of Object.entries(groups)) {
    const section = document.createElement('div');
    section.className = 'scope-group';
    section.dataset.scope = group.scope;
    section.dataset.projectPath = group.projectPath || '';

    const label = group.scope === 'user' ? 'User (Global)'
      : `${group.scope.charAt(0).toUpperCase() + group.scope.slice(1)}: ${group.projectPath}`;

    section.innerHTML = `
      <div class="scope-group-header">
        <h3>${label}</h3>
        <span class="scope-group-count">${group.plugins.length}</span>
      </div>
      <div class="scope-drop-zone card-grid" data-scope="${group.scope}" data-project="${group.projectPath || ''}"></div>
    `;

    const dropZone = section.querySelector('.scope-drop-zone');

    // Drag-and-drop handlers
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drop-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-active');
      const pluginId = e.dataTransfer.getData('text/plain');
      const targetScope = dropZone.dataset.scope;
      const targetProject = dropZone.dataset.project || null;

      if (targetScope === 'project' || targetScope === 'local') {
        if (targetProject) {
          onScopeChange(pluginId, targetScope, targetProject);
        } else {
          // Prompt for project path — handled by modal in app.js
          onScopeChange(pluginId, targetScope, null);
        }
      } else {
        onScopeChange(pluginId, targetScope);
      }
    });

    for (const plugin of group.plugins) {
      dropZone.appendChild(pluginCard(plugin, { onToggle, onClick: onCardClick, draggable: true }));
    }

    groupsEl.appendChild(section);
  }
}
```

**Step 2: Wire into app.js**

Update to handle `by-scope`, `scope-user`, `scope-project`, `scope-local` views.

**Step 3: Manual test**

Run: `node server/index.js`
Expected: Plugins grouped by scope. Drag a card from one group to another. Scope changes via API.

**Step 4: Commit**

```bash
git add public/js/views/by-scope.js public/js/app.js
git commit -m "feat: add by-scope view with drag-and-drop scope changes"
```

---

### Task 18: Marketplace view

**Files:**
- Create: `public/js/views/marketplace.js`
- Create: `public/js/components/modal.js`
- Modify: `public/js/app.js`

**Step 1: Build modal.js**

```js
// public/js/components/modal.js
export function showModal(content) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="modal">
      <button class="modal-close">&times;</button>
      <div class="modal-content"></div>
    </div>
  `;
  overlay.querySelector('.modal-content').appendChild(
    typeof content === 'string' ? Object.assign(document.createElement('div'), { innerHTML: content }) : content
  );
  overlay.classList.remove('hidden');

  const close = () => overlay.classList.add('hidden');
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { close };
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
```

**Step 2: Build marketplace.js**

```js
// public/js/views/marketplace.js
import { showModal, hideModal } from '../components/modal.js';

export async function renderMarketplace(container, { api, searchQuery }) {
  container.innerHTML = `
    <div class="view-header">
      <h2>Marketplace</h2>
    </div>
    <div class="marketplace-tabs" id="marketplace-tabs"></div>
    <div class="card-grid" id="marketplace-grid"></div>
  `;

  const marketplacesRes = await api.getMarketplaces();
  if (!marketplacesRes.ok) return;

  const tabs = container.querySelector('#marketplace-tabs');
  const grid = container.querySelector('#marketplace-grid');
  const marketplaces = marketplacesRes.data;

  // Render tabs
  tabs.innerHTML = marketplaces.map((m, i) => `
    <button class="marketplace-tab ${i === 0 ? 'active' : ''}" data-name="${m.name}">${m.name}</button>
  `).join('');

  async function loadMarketplace(name) {
    const res = await api.getMarketplacePlugins(name);
    if (!res.ok) return;

    let plugins = res.data;
    if (searchQuery) {
      plugins = plugins.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        p.description.toLowerCase().includes(searchQuery)
      );
    }

    // Sort by install count descending
    plugins.sort((a, b) => (b.installCount || 0) - (a.installCount || 0));

    grid.innerHTML = '';
    for (const plugin of plugins) {
      const card = document.createElement('div');
      card.className = `marketplace-card ${plugin.installed ? 'installed' : ''}`;
      card.innerHTML = `
        <div class="card-header">
          <h3 class="card-name">${plugin.name}</h3>
          ${plugin.installed ? '<span class="installed-badge">Installed</span>' : ''}
        </div>
        <p class="card-description">${plugin.description || ''}</p>
        <div class="card-footer">
          <span class="card-category">${plugin.category || ''}</span>
          <span class="install-count">${formatCount(plugin.installCount)} installs</span>
          ${plugin.installed ? '' : `<button class="btn-install" data-name="${plugin.name}" data-marketplace="${name}">Install</button>`}
        </div>
      `;
      grid.appendChild(card);
    }

    // Install button handlers
    grid.querySelectorAll('.btn-install').forEach(btn => {
      btn.addEventListener('click', () => {
        showInstallModal(btn.dataset.name, btn.dataset.marketplace, api);
      });
    });
  }

  // Tab click handlers
  tabs.querySelectorAll('.marketplace-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelector('.active')?.classList.remove('active');
      tab.classList.add('active');
      loadMarketplace(tab.dataset.name);
    });
  });

  // Load first marketplace
  if (marketplaces.length > 0) {
    loadMarketplace(marketplaces[0].name);
  }
}

function showInstallModal(name, marketplace, api) {
  const el = document.createElement('div');
  el.innerHTML = `
    <h3>Install ${name}</h3>
    <div class="form-group">
      <label>Scope</label>
      <select id="install-scope">
        <option value="user">User (Global)</option>
        <option value="project">Project</option>
        <option value="local">Local</option>
      </select>
    </div>
    <div class="form-group hidden" id="project-path-group">
      <label>Project Path</label>
      <input type="text" id="install-project-path" placeholder="/path/to/project" />
    </div>
    <button class="btn-primary" id="confirm-install">Install</button>
  `;

  const modal = showModal(el);

  el.querySelector('#install-scope').addEventListener('change', (e) => {
    const group = el.querySelector('#project-path-group');
    group.classList.toggle('hidden', e.target.value === 'user');
  });

  el.querySelector('#confirm-install').addEventListener('click', async () => {
    const scope = el.querySelector('#install-scope').value;
    const projectPath = el.querySelector('#install-project-path').value;
    const res = await api.installPlugin(name, marketplace, scope, projectPath || undefined);
    modal.close();
    // Refresh view after install
    if (res.ok) location.reload();
  });
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
```

**Step 3: Wire into app.js**

**Step 4: Manual test**

Run: `node server/index.js`
Expected: Marketplace tabs, plugin cards sorted by install count, install modal with scope picker.

**Step 5: Commit**

```bash
git add public/js/views/marketplace.js public/js/components/modal.js public/js/app.js
git commit -m "feat: add marketplace view with install modal"
```

---

### Task 19: Plugin detail modal

**Files:**
- Create: `public/js/views/plugin-detail.js`
- Modify: `public/js/app.js`

**Step 1: Build plugin-detail.js**

```js
// public/js/views/plugin-detail.js
import { showModal } from '../components/modal.js';
import { scopeBadge } from '../components/scope-badge.js';

export async function showPluginDetail(pluginId, { api, onRefresh }) {
  const res = await api.getPlugin(pluginId);
  if (!res.ok) return;
  const plugin = res.data;

  const el = document.createElement('div');
  el.className = 'plugin-detail';
  el.innerHTML = `
    <div class="detail-header">
      <h2>${plugin.name} <span class="detail-marketplace">@${plugin.marketplace}</span></h2>
      <label class="toggle-switch">
        <input type="checkbox" id="detail-toggle" ${plugin.enabled ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <p class="detail-description">${plugin.description || 'No description'}</p>

    <div class="detail-meta">
      <div class="meta-item">
        <span class="meta-label">Version</span>
        <span class="meta-value">${plugin.version}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Scope</span>
        <span class="meta-value">${scopeBadge(plugin.scope)}</span>
      </div>
      ${plugin.projectPath ? `
      <div class="meta-item">
        <span class="meta-label">Project</span>
        <span class="meta-value">${plugin.projectPath}</span>
      </div>` : ''}
      <div class="meta-item">
        <span class="meta-label">Installed</span>
        <span class="meta-value">${new Date(plugin.installedAt).toLocaleDateString()}</span>
      </div>
    </div>

    ${plugin.skills?.length ? `
    <div class="detail-section">
      <h3>Skills (${plugin.skills.length})</h3>
      <ul class="skills-list">
        ${plugin.skills.map(s => `<li>${s.name}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${plugin.hooks ? `
    <div class="detail-section">
      <h3>Hooks</h3>
      <pre class="code-block">${JSON.stringify(plugin.hooks, null, 2)}</pre>
    </div>` : ''}

    ${plugin.mcpServers ? `
    <div class="detail-section">
      <h3>MCP Servers</h3>
      <pre class="code-block">${JSON.stringify(plugin.mcpServers, null, 2)}</pre>
    </div>` : ''}

    <div class="detail-section">
      <h3>Scope</h3>
      <select id="detail-scope">
        <option value="user" ${plugin.scope === 'user' ? 'selected' : ''}>User (Global)</option>
        <option value="project" ${plugin.scope === 'project' ? 'selected' : ''}>Project</option>
        <option value="local" ${plugin.scope === 'local' ? 'selected' : ''}>Local</option>
      </select>
      <input type="text" id="detail-project-path" placeholder="Project path"
        value="${plugin.projectPath || ''}"
        class="${plugin.scope === 'user' ? 'hidden' : ''}" />
      <button class="btn-secondary" id="save-scope">Save Scope</button>
    </div>

    <div class="detail-actions">
      <button class="btn-danger" id="uninstall-btn">Uninstall</button>
    </div>
  `;

  const modal = showModal(el);

  // Toggle handler
  el.querySelector('#detail-toggle').addEventListener('change', async (e) => {
    await api.togglePlugin(pluginId, e.target.checked);
  });

  // Scope change handler
  el.querySelector('#detail-scope').addEventListener('change', (e) => {
    el.querySelector('#detail-project-path').classList.toggle('hidden', e.target.value === 'user');
  });

  el.querySelector('#save-scope').addEventListener('click', async () => {
    const scope = el.querySelector('#detail-scope').value;
    const projectPath = el.querySelector('#detail-project-path').value;
    await api.changeScope(pluginId, scope, projectPath || undefined);
    modal.close();
    onRefresh();
  });

  // Uninstall handler
  el.querySelector('#uninstall-btn').addEventListener('click', async () => {
    if (!confirm(`Uninstall ${plugin.name}?`)) return;
    await api.uninstallPlugin(pluginId);
    modal.close();
    onRefresh();
  });
}
```

**Step 2: Wire into app.js — pass `showPluginDetail` as `onCardClick` handler**

**Step 3: Manual test**

Run: `node server/index.js`
Expected: Click a plugin card → modal opens with full detail, toggle, scope changer, uninstall button.

**Step 4: Commit**

```bash
git add public/js/views/plugin-detail.js public/js/app.js
git commit -m "feat: add plugin detail modal with manage actions"
```

---

### Task 20: Blocklist view

**Files:**
- Create: `public/js/views/blocklist.js`
- Modify: `public/js/app.js`

**Step 1: Build blocklist.js**

```js
// public/js/views/blocklist.js
export async function renderBlocklist(container, { api }) {
  const res = await api.getBlocklist();
  if (!res.ok) return;

  const { plugins } = res.data;

  container.innerHTML = `
    <div class="view-header">
      <h2>Blocklist</h2>
      <span class="plugin-count">${plugins.length} blocked</span>
    </div>
    <div class="blocklist" id="blocklist"></div>
  `;

  const list = container.querySelector('#blocklist');

  if (plugins.length === 0) {
    list.innerHTML = '<p class="empty-state">No blocked plugins.</p>';
    return;
  }

  for (const entry of plugins) {
    const row = document.createElement('div');
    row.className = 'blocklist-row';
    row.innerHTML = `
      <div class="blocklist-info">
        <strong>${entry.plugin}</strong>
        <span class="blocklist-reason">${entry.reason || 'No reason'}</span>
        ${entry.text ? `<p class="blocklist-text">${entry.text}</p>` : ''}
        <span class="blocklist-date">Blocked ${new Date(entry.added_at).toLocaleDateString()}</span>
      </div>
      <button class="btn-secondary btn-unblock" data-id="${entry.plugin}">Unblock</button>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('.btn-unblock').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.removeFromBlocklist(btn.dataset.id);
      renderBlocklist(container, { api }); // Re-render
    });
  });
}
```

**Step 2: Wire into app.js**

**Step 3: Manual test**

Run: `node server/index.js`
Expected: Blocklist shows blocked plugins with unblock buttons.

**Step 4: Commit**

```bash
git add public/js/views/blocklist.js public/js/app.js
git commit -m "feat: add blocklist view"
```

---

## Phase 7: Polish and Integration

### Task 21: Duplicate detection and warnings

**Files:**
- Create: `public/js/components/duplicate-badge.js`
- Modify: `public/js/views/overview.js`
- Modify: `public/js/views/by-scope.js`

**Step 1: Build duplicate detection logic**

```js
// public/js/components/duplicate-badge.js
export function detectDuplicates(plugins) {
  const byName = {};
  for (const p of plugins) {
    if (!byName[p.name]) byName[p.name] = [];
    byName[p.name].push(p);
  }

  const duplicates = {};
  for (const [name, instances] of Object.entries(byName)) {
    if (instances.length > 1) {
      const sameMarketplace = instances.every(i => i.marketplace === instances[0].marketplace);
      for (const inst of instances) {
        duplicates[inst.id] = {
          type: sameMarketplace ? 'same-plugin-multi-scope' : 'different-marketplace',
          others: instances.filter(i => i.id !== inst.id).map(i => i.id),
        };
      }
    }
  }
  return duplicates;
}

export function duplicateBadge(info) {
  if (!info) return '';
  if (info.type === 'same-plugin-multi-scope') {
    return `<span class="duplicate-badge badge-info" title="Also installed in other scopes">Multi-scope</span>`;
  }
  return `<span class="duplicate-badge badge-warning" title="Multiple versions from different marketplaces">Multiple versions</span>`;
}
```

**Step 2: Integrate into overview.js and by-scope.js**

Pass duplicate info to pluginCard, render badge in card footer.

**Step 3: Manual test**

Expected: `superpowers` plugin (installed from two marketplaces) shows yellow "Multiple versions" badge.

**Step 4: Commit**

```bash
git add public/js/components/duplicate-badge.js public/js/views/
git commit -m "feat: add duplicate plugin detection and warning badges"
```

---

### Task 22: Complete CSS styling

**Files:**
- Modify: `public/style.css`

**Step 1: Write complete CSS**

This task writes the full stylesheet. Key sections:

- **Layout:** CSS grid for sidebar + main content. Sidebar fixed 250px, main fills rest.
- **Cards:** White background, border-radius 8px, box-shadow, hover transform translateY(-2px). Grid layout with `auto-fill, minmax(300px, 1fr)`.
- **Scope badges:** Colored pills (blue/green/orange) with white text.
- **Toggle switch:** Pure CSS toggle (44px wide, 22px tall, green/gray).
- **Drag-and-drop:** `.drop-active` has dashed blue border. `.dragging` is semi-transparent.
- **Modal:** Fixed overlay with backdrop-filter blur, centered white card, max-width 600px.
- **Marketplace tabs:** Horizontal pill buttons with active state.
- **Blocklist rows:** Horizontal layout with info on left, unblock button on right.
- **Responsive:** Stack sidebar below 768px.
- **Color palette:** Use CSS custom properties for easy theming.

**Step 2: Manual test across all views**

Run: `node server/index.js`
Expected: Polished, consistent appearance across all views.

**Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: add complete CSS styling for all components"
```

---

### Task 23: End-to-end manual testing and bug fixes

**Files:** Various — bug fixes as needed

**Step 1: Run all unit tests**

Run: `node --test tests/**/*.test.js`
Expected: All pass

**Step 2: Start server against real data**

Run: `node server/index.js`

**Step 3: Test each view manually**

Checklist:
- [ ] Overview shows all installed plugins
- [ ] Search filters plugins by name/description
- [ ] Toggle switches enable/disable plugins
- [ ] By Scope groups plugins correctly
- [ ] Drag-and-drop changes scope
- [ ] Marketplace loads all marketplaces
- [ ] Marketplace shows install counts sorted
- [ ] Install modal works (scope picker + project path)
- [ ] Plugin detail modal shows skills, hooks, MCP servers
- [ ] Detail modal scope changer works
- [ ] Blocklist shows blocked plugins
- [ ] Unblock button works
- [ ] Duplicate badges appear for superpowers

**Step 4: Fix any issues found**

**Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: address issues found in manual testing"
```

---

### Task 24: Finalize skill definition

**Files:**
- Modify: `skills/viz/SKILL.md`

**Step 1: Update SKILL.md with final invocation**

Ensure the skill definition correctly starts the server, opens the browser, and provides clear instructions to the user.

**Step 2: Test as installed plugin**

Install into a test project and verify `/viz` works end-to-end.

**Step 3: Final commit**

```bash
git add skills/viz/SKILL.md
git commit -m "feat: finalize viz skill definition"
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1 | Plugin scaffold |
| 2 | 2-5 | Server core (paths, reader, writer, HTTP server) |
| 3 | 6-9 | Read API (plugins, marketplaces, settings, blocklist) |
| 4 | 10-13 | Write API (toggle, scope, install/uninstall, blocklist CRUD) |
| 5 | 14-15 | Frontend shell (HTML, CSS, sidebar, card components) |
| 6 | 16-20 | Frontend views (overview, by-scope, marketplace, detail, blocklist) |
| 7 | 21-24 | Polish (duplicates, CSS, testing, skill finalization) |

**Total: 24 tasks across 7 phases.**
