import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm, mkdir, writeFile } from 'node:fs/promises';
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
    assert.equal(userPlugin.installations[0].scope, 'user');
    assert.equal(userPlugin.enabled, true);
    assert.equal(userPlugin.version, '1.0.0');
  });

  it('marks disabled plugins correctly', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    const json = await res.json();
    const scoped = json.data.find(p => p.id === 'scoped-plugin@test-marketplace');
    assert.equal(scoped.enabled, false);
    assert.equal(scoped.installations[0].scope, 'project');
    assert.equal(scoped.installations[0].projectPath, '/tmp/test-project');
  });

  it('GET /api/plugins/:id returns plugin detail by id', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace`);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.data.id, 'test-plugin@test-marketplace');
    assert.equal(json.data.version, '1.0.0');
  });

  it('GET /api/plugins/:id returns 404 for unknown plugin', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/nonexistent@nowhere`);
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(res.status, 404);
  });

  it('PATCH /api/plugins/:id/toggle toggles enabled state', async () => {
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

  it('PATCH /api/plugins/:id/toggle returns 404 for unknown plugin', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/unknown@nowhere/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(res.status, 404);
  });

  it('POST /api/plugins/:id/add-scope adds an installation scope', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/add-scope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'project', projectPath: '/tmp/my-project' }),
    });
    const json = await res.json();
    assert.equal(json.ok, true);

    const plugins = await fetch(`${baseUrl}/api/plugins`);
    const pluginsJson = await plugins.json();
    const plugin = pluginsJson.data.find(p => p.id === 'test-plugin@test-marketplace');
    const added = plugin.installations.find(i => i.scope === 'project');
    assert.ok(added);
    assert.equal(added.projectPath, '/tmp/my-project');
  });

  it('POST /api/plugins/:id/add-scope rejects invalid scope', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/add-scope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'invalid' }),
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/plugins/:id/add-scope requires projectPath for project scope', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/test-plugin@test-marketplace/add-scope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'project' }),
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/plugins/install rejects missing required fields', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-plugin' }),
    });
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(res.status, 400);
  });

  it('DELETE /api/plugins/:id rejects unknown plugin', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/unknown@nowhere`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 404);
  });
});

describe('GET /api/plugins — capability auto-discovery', () => {
  let server, baseUrl, tempDir;
  const conventionPlugin = join(import.meta.dirname, '..', 'fixtures', 'plugins-cache', 'convention-plugin');

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'viz-caps-'));
    await mkdir(join(tempDir, 'plugins'), { recursive: true });
    // Point an installation at the convention-plugin fixture so the API runs
    // real directory-convention discovery against it.
    const registry = {
      version: 2,
      plugins: {
        'convention-plugin@test-marketplace': [
          { scope: 'user', installPath: conventionPlugin, version: '1.0.0',
            installedAt: '2026-01-01T00:00:00.000Z', lastUpdated: '2026-01-01T00:00:00.000Z' },
        ],
      },
    };
    await writeFile(join(tempDir, 'plugins', 'installed_plugins.json'), JSON.stringify(registry));
    await writeFile(join(tempDir, 'settings.json'), JSON.stringify({ enabledPlugins: {} }));

    server = await createServer({ port: 0, claudeDir: tempDir });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server.close();
    await rm(tempDir, { recursive: true });
  });

  it('detects components by directory convention (skills unify legacy commands)', async () => {
    const res = await fetch(`${baseUrl}/api/plugins`);
    const json = await res.json();
    const p = json.data.find(p => p.id === 'convention-plugin@test-marketplace');
    assert.equal(p.hasSkills, true);
    assert.equal(p.hasAgents, true);
    assert.equal(p.hasHooks, true);
    assert.equal(p.hasMcpServers, true);
    assert.equal(p.hasLspServers, true);
    assert.equal(p.hasMonitors, true);
    assert.equal(p.hasBin, true);
    assert.equal(p.counts.skills, 5); // 2 skills/ + 3 legacy commands/, unified
    assert.equal(p.counts.agents, 1);
    assert.equal(p.counts.bin, 2);
    assert.equal(p.hasCommands, undefined); // commands are no longer a separate type
  });

  it('detail endpoint returns discovered component lists', async () => {
    const res = await fetch(`${baseUrl}/api/plugins/convention-plugin@test-marketplace`);
    const json = await res.json();
    assert.deepEqual(
      json.data.skills.map(s => s.name).sort(),
      ['alpha', 'bar', 'beta', 'foo', 'sub/nested'],
    );
    assert.deepEqual(json.data.agents.map(a => a.name), ['helper']);
    assert.deepEqual(json.data.bin.map(b => b.name).sort(), ['helper', 'mytool']);
    assert.equal(json.data.commands, undefined);
    assert.ok(json.data.hooks);
    assert.ok(json.data.mcpServers);
    assert.ok(json.data.monitors);
  });
});
