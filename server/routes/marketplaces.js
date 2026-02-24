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
