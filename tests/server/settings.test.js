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
