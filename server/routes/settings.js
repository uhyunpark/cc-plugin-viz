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
