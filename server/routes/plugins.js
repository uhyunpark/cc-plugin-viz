import { readJSON } from '../lib/reader.js';
import { writeJSON } from '../lib/writer.js';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';

const VALID_SCOPES = ['user', 'project', 'local'];

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

  router.patch('/api/plugins/:id/toggle', async ({ params, body, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const settings = await readJSON(paths.settings) || {};
    if (!settings.enabledPlugins) settings.enabledPlugins = {};
    settings.enabledPlugins[params.id] = body.enabled === true;

    await writeJSON(paths.settings, settings, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id, enabled: body.enabled } });
  });

  router.patch('/api/plugins/:id/scope', async ({ params, body, sendJSON }) => {
    if (!VALID_SCOPES.includes(body.scope)) {
      sendJSON(400, { ok: false, error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}` });
      return;
    }

    if ((body.scope === 'project' || body.scope === 'local') && !body.projectPath) {
      sendJSON(400, { ok: false, error: 'projectPath is required for project/local scope' });
      return;
    }

    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const install = registry.plugins[params.id][0];
    install.scope = body.scope;
    if (body.scope === 'user') {
      delete install.projectPath;
    } else {
      install.projectPath = body.projectPath;
    }

    await writeJSON(paths.installedPlugins, registry, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id, scope: body.scope, projectPath: body.projectPath || null } });
  });
}
