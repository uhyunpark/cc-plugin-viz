import { readJSON } from '../lib/reader.js';
import { writeJSON } from '../lib/writer.js';
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const VALID_SCOPES = ['user', 'project', 'local'];

// Strip CLAUDECODE env to allow nested claude CLI calls
const cleanEnv = { ...process.env };
delete cleanEnv.CLAUDECODE;
const execOpts = { timeout: 120000, env: cleanEnv };


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
      const install = installations[0];
      const pluginMeta = await readJSON(join(install.installPath, '.claude-plugin', 'plugin.json'));

      const [name, marketplace] = id.split('@');
      plugins.push({
        id,
        name,
        marketplace,
        description: pluginMeta?.description || '',
        version: install.version,
        installPath: install.installPath,
        enabled: enabledPlugins[id] === true,
        hasSkills: !!pluginMeta?.skills,
        hasHooks: !!pluginMeta?.hooks,
        hasMcpServers: !!pluginMeta?.mcpServers,
        hasLspServers: false,
        installations: installations.map(inst => ({
          scope: inst.scope,
          projectPath: inst.projectPath || null,
          installedAt: inst.installedAt,
          lastUpdated: inst.lastUpdated,
        })),
      });
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
        installPath: install.installPath,
        enabled: enabledPlugins[id] === true,
        installations: installations.map(inst => ({
          scope: inst.scope,
          projectPath: inst.projectPath || null,
          installedAt: inst.installedAt,
          lastUpdated: inst.lastUpdated,
        })),
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

  router.post('/api/plugins/:id/add-scope', async ({ params, body, sendJSON }) => {
    if (!VALID_SCOPES.includes(body.scope)) {
      sendJSON(400, { ok: false, error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}` });
      return;
    }

    if ((body.scope === 'project' || body.scope === 'local') && !body.projectPath) {
      sendJSON(400, { ok: false, error: 'projectPath is required for project/local scope' });
      return;
    }

    const registry = await readJSON(paths.installedPlugins);
    const installations = registry?.plugins?.[params.id];
    if (!installations) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    // Check for duplicate scope+projectPath
    const exists = installations.some(inst =>
      inst.scope === body.scope &&
      (body.scope === 'user' || inst.projectPath === body.projectPath)
    );
    if (exists) {
      sendJSON(409, { ok: false, error: 'Plugin is already installed in this scope' });
      return;
    }

    // Clone metadata from first installation
    const base = installations[0];
    const newInstall = {
      scope: body.scope,
      installPath: base.installPath,
      version: base.version,
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    if (base.gitCommitSha) newInstall.gitCommitSha = base.gitCommitSha;
    if (body.scope !== 'user') newInstall.projectPath = body.projectPath;

    installations.push(newInstall);
    await writeJSON(paths.installedPlugins, registry, paths.backupDir);
    sendJSON(200, { ok: true, data: { id: params.id, scope: body.scope, projectPath: body.projectPath || null } });
  });

  router.delete('/api/plugins/:id/scope', async ({ params, body, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    const installations = registry?.plugins?.[params.id];
    if (!installations) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const idx = installations.findIndex(inst =>
      inst.scope === body.scope &&
      (body.scope === 'user' || inst.projectPath === body.projectPath)
    );
    if (idx === -1) {
      sendJSON(404, { ok: false, error: 'Installation not found for this scope' });
      return;
    }

    installations.splice(idx, 1);

    if (installations.length === 0) {
      // Last installation removed — fully uninstall
      delete registry.plugins[params.id];
      await writeJSON(paths.installedPlugins, registry, paths.backupDir);
      try {
        await execAsync(`claude plugin uninstall "${params.id}" --scope ${body.scope}`, execOpts);
      } catch { /* best effort cleanup */ }
    } else {
      await writeJSON(paths.installedPlugins, registry, paths.backupDir);
    }

    sendJSON(200, { ok: true, data: { id: params.id, remaining: installations.length } });
  });

  router.post('/api/plugins/install', async ({ body, sendJSON }) => {
    const { name, marketplace, scope, projectPath } = body;

    if (!name || !marketplace) {
      sendJSON(400, { ok: false, error: 'name and marketplace are required' });
      return;
    }

    if (!scope || !VALID_SCOPES.includes(scope)) {
      sendJSON(400, { ok: false, error: `scope is required and must be one of: ${VALID_SCOPES.join(', ')}` });
      return;
    }

    if ((scope === 'project' || scope === 'local') && !projectPath) {
      sendJSON(400, { ok: false, error: 'projectPath is required for project/local scope' });
      return;
    }

    try {
      const cmd = `claude plugin install "${name}@${marketplace}" --scope ${scope}`;
      const { stdout, stderr } = await execAsync(cmd, execOpts);
      sendJSON(200, { ok: true, data: { message: stdout || 'Installed successfully', stderr } });
    } catch (err) {
      sendJSON(500, { ok: false, error: `Install failed: ${err.message}` });
    }
  });

  router.delete('/api/plugins/:id', async ({ params, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    try {
      const cmd = `claude plugin uninstall "${params.id}"`;
      const { stdout, stderr } = await execAsync(cmd, execOpts);
      sendJSON(200, { ok: true, data: { message: stdout || 'Uninstalled successfully', stderr } });
    } catch (err) {
      sendJSON(500, { ok: false, error: `Uninstall failed: ${err.message}` });
    }
  });

  router.put('/api/plugins/:id/config', async ({ params, body, sendJSON }) => {
    const registry = await readJSON(paths.installedPlugins);
    if (!registry?.plugins?.[params.id]) {
      sendJSON(404, { ok: false, error: 'Plugin not found' });
      return;
    }

    const install = registry.plugins[params.id][0];
    const configPath = join(install.installPath, '.claude-plugin', 'plugin.json');
    const config = await readJSON(configPath);

    if (!config) {
      sendJSON(404, { ok: false, error: 'Plugin config not found' });
      return;
    }

    // Merge provided fields (only allow safe fields)
    const allowedFields = ['description'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        config[field] = body[field];
      }
    }

    await writeJSON(configPath, config, paths.backupDir);
    sendJSON(200, { ok: true, data: config });
  });
}
