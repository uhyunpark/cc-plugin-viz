import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { detectCapabilities } from '../../server/lib/capabilities.js';
import { readJSON } from '../../server/lib/reader.js';

const cacheDir = join(import.meta.dirname, '..', 'fixtures', 'plugins-cache');

async function metaFor(pluginDir) {
  return readJSON(join(pluginDir, '.claude-plugin', 'plugin.json'));
}

describe('detectCapabilities — convention-based discovery', () => {
  const dir = join(cacheDir, 'convention-plugin');

  it('unifies skills/ (SKILL.md) and legacy commands/ into one skills list', async () => {
    // Commands are legacy skills — both invoke as /name, so they are merged.
    const meta = await metaFor(dir);
    const caps = await detectCapabilities(dir, meta);
    const names = caps.skills.map(s => s.name).sort();
    assert.deepEqual(names, ['alpha', 'bar', 'beta', 'foo', 'sub/nested']); // notaskill excluded
  });

  it('tags each skill with its source format (skill vs legacy command)', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    const byName = Object.fromEntries(caps.skills.map(s => [s.name, s.format]));
    assert.equal(byName.alpha, 'skill');
    assert.equal(byName.foo, 'command');
    assert.equal(byName['sub/nested'], 'command');
  });

  it('discovers agents from agents/ dir', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.deepEqual(caps.agents.map(a => a.name), ['helper']);
  });

  it('reads hooks from hooks/hooks.json', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.hooks);
    assert.ok(caps.hooks.hooks.PreToolUse);
  });

  it('reads mcpServers from root .mcp.json', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.mcpServers);
    assert.ok(caps.mcpServers.mcpServers.demo);
  });

  it('reads lspServers from root .lsp.json', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.lspServers);
    assert.ok(caps.lspServers.lspServers.gopls);
  });

  it('reads monitors from monitors/monitors.json', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.monitors);
    assert.ok(caps.monitors.monitors.watcher);
  });

  it('lists bin/ executables', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.deepEqual(caps.bin.map(b => b.name).sort(), ['helper', 'mytool']);
  });
});

describe('detectCapabilities — explicit plugin.json paths', () => {
  const dir = join(cacheDir, 'explicit-plugin');

  it('honors custom skills path', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.deepEqual(caps.skills.map(s => s.name), ['gamma']);
  });

  it('honors custom hooks path', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.hooks.hooks.Stop);
  });

  it('honors custom mcpServers path', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.mcpServers.mcpServers.x);
  });

  it('honors inline lspServers object in plugin.json', async () => {
    // An inline plugin.json field is returned verbatim (the server map itself).
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.ok(caps.lspServers['rust-analyzer']);
  });
});

describe('detectCapabilities — empty plugin', () => {
  const dir = join(cacheDir, 'empty-plugin');

  it('returns empty lists and null configs', async () => {
    const caps = await detectCapabilities(dir, await metaFor(dir));
    assert.deepEqual(caps.skills, []);
    assert.deepEqual(caps.agents, []);
    assert.deepEqual(caps.bin, []);
    assert.equal(caps.hooks, null);
    assert.equal(caps.mcpServers, null);
    assert.equal(caps.lspServers, null);
    assert.equal(caps.monitors, null);
  });

  it('handles a missing/invalid installPath gracefully', async () => {
    const caps = await detectCapabilities(join(cacheDir, 'does-not-exist'), {});
    assert.deepEqual(caps.skills, []);
    assert.equal(caps.hooks, null);
  });
});
