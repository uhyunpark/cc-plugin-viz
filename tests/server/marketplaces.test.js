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
