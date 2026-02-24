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
