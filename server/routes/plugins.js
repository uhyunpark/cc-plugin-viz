import { readJSON } from '../lib/reader.js';
import { join } from 'node:path';

export function registerPluginRoutes(router, paths) {

  router.get('/api/plugins', async ({ sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    const settings = await readJSON(paths.settings);
    const enabledPlugins = settings?.enabledPlugins || {};

    if (!registry?.plugins) {
      sendJSON(200, { ok: true, data: [] });
      return;
    }

    const plugins = [];

    for (const [id, installations] of Object.entries(registry.plugins)) {
      for (const install of installations) {
        // Read plugin.json for type info
        const pluginMeta = await readJSON(join(install.installPath, '.claude-plugin', 'plugin.json'));

        const [name, marketplace] = id.split('@');
        plugins.push({
          id,
          name,
          marketplace,
          description: pluginMeta?.description || '',
          version: install.version,
          scope: install.scope,
          projectPath: install.projectPath || null,
          installPath: install.installPath,
          installedAt: install.installedAt,
          lastUpdated: install.lastUpdated,
          enabled: enabledPlugins[id] === true,
          hasSkills: !!pluginMeta?.skills,
          hasHooks: !!pluginMeta?.hooks,
          hasMcpServers: !!pluginMeta?.mcpServers,
          hasLspServers: false,
        });
      }
    }

    sendJSON(200, { ok: true, data: plugins });
  });
}
