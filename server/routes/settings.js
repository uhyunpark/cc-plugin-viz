import { readJSON } from '../lib/reader.js';
import { writeJSON } from '../lib/writer.js';

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
}
