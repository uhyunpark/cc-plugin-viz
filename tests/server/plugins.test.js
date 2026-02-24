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
