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
