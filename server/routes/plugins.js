import { readJSON } from '../lib/reader.js';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';

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

  router.get('/api/plugins/:id', async ({ params, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    const settings = await readJSON(paths.settings);
    const enabledPlugins = settings?.enabledPlugins || {};
    const id = params.id;

    const installations = registry?.plugins?.[id];
    if (!installations || installations.length === 0) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const install = installations[0];
    const pluginMeta = await readJSON(join(install.installPath, '.claude-plugin', 'plugin.json'));

    // Read skills if available
    let skills = [];
    if (pluginMeta?.skills) {
      const skillsDir = join(install.installPath, pluginMeta.skills);
      try {
        const entries = await readdir(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            skills.push({ name: entry.name, path: join(skillsDir, entry.name) });
          }
        }
      } catch { /* no skills dir */ }
    }

    // Read hooks if available
    let hooks = null;
    if (pluginMeta?.hooks) {
      hooks = await readJSON(join(install.installPath, pluginMeta.hooks));
    }

    // Read MCP servers if available
    let mcpServers = null;
    if (pluginMeta?.mcpServers) {
      mcpServers = await readJSON(join(install.installPath, pluginMeta.mcpServers));
    }

    const [name, marketplace] = id.split('@');

    sendJSON(200, {
      ok: true,
      data: {
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
        skills,
        hooks,
        mcpServers,
        pluginMeta,
      },
    });
  });
}
