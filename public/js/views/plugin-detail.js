import { showModal } from '../components/modal.js';

// Config blobs are stored either wrapped ({ hooks: {...} }) or inline ({...}).
// Unwrap to the inner map regardless of shape.
function unwrap(config, key) {
  if (!config || typeof config !== 'object') return null;
  if (config[key] && typeof config[key] === 'object') return config[key];
  return config;
}

function chips(items) {
  return items.map(t => `<span class="summary-chip">${t}</span>`).join('');
}

// "PreToolUse, Stop" (the hook events this plugin handles)
function summarizeHooks(hooks) {
  const map = unwrap(hooks, 'hooks');
  const events = map ? Object.keys(map) : [];
  return events.length ? chips(events) : '<span class="summary-empty">configured</span>';
}

// server names: "atlassian", "github"
function summarizeMcp(mcp) {
  const map = unwrap(mcp, 'mcpServers');
  const names = map ? Object.keys(map) : [];
  return names.length ? chips(names) : '<span class="summary-empty">configured</span>';
}

// "gopls (.go)" — language server name + the extensions it handles
function summarizeLsp(lsp) {
  const map = unwrap(lsp, 'lspServers');
  if (!map) return '<span class="summary-empty">configured</span>';
  const parts = Object.entries(map).map(([name, cfg]) => {
    const exts = cfg && cfg.extensionToLanguage ? Object.keys(cfg.extensionToLanguage) : [];
    return exts.length ? `${name} (${exts.join(', ')})` : name;
  });
  return parts.length ? chips(parts) : '<span class="summary-empty">configured</span>';
}

// background process names defined in monitors/monitors.json
function summarizeMonitors(monitors) {
  const map = unwrap(monitors, 'monitors');
  const names = map ? Object.keys(map) : [];
  return names.length ? chips(names) : '<span class="summary-empty">configured</span>';
}

function configSection(title, summaryHtml, raw) {
  return `
    <div class="detail-section">
      <h3>${title}</h3>
      <div class="summary-row">${summaryHtml}</div>
      <details class="raw-config">
        <summary>Raw config</summary>
        <pre class="code-block">${JSON.stringify(raw, null, 2)}</pre>
      </details>
    </div>`;
}

export async function showPluginDetail(pluginId, { api, onRefresh }) {
  const res = await api.getPlugin(pluginId);
  if (!res.ok) return;
  const plugin = res.data;

  const installationsHtml = plugin.installations.map(inst => {
    const label = inst.scope === 'user' ? 'User (Global)'
      : `${inst.scope.charAt(0).toUpperCase() + inst.scope.slice(1)}: ${inst.projectPath}`;
    const date = new Date(inst.installedAt).toLocaleDateString();
    return `
      <div class="detail-installation">
        <span class="scope-chip scope-chip-${inst.scope}">${label}</span>
        <span class="detail-install-date">installed ${date}</span>
        <button class="btn-remove-scope" data-scope="${inst.scope}" data-project="${inst.projectPath || ''}">Remove</button>
      </div>`;
  }).join('');

  const el = document.createElement('div');
  el.className = 'plugin-detail';
  el.innerHTML = `
    <div class="detail-header">
      <h2>${plugin.name} <span class="detail-marketplace">@${plugin.marketplace}</span></h2>
      <label class="toggle-switch toggle-with-label" title="This switch controls the user (global) setting only">
        <span class="toggle-caption">${plugin.enabled ? 'Enabled' : 'Disabled'}<small>user / global</small></span>
        <input type="checkbox" id="detail-toggle" ${plugin.enabled ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <p class="detail-description">${plugin.description || 'No description'}</p>

    <div class="detail-meta">
      <div class="meta-item">
        <span class="meta-label">Version</span>
        <span class="meta-value">${plugin.version}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Install Path</span>
        <span class="meta-value" style="font-size:0.75rem;word-break:break-all">${plugin.installPath}</span>
      </div>
    </div>

    <div class="detail-section">
      <h3>Installed Scopes (${plugin.installations.length})</h3>
      <p class="section-hint">Where the plugin is <strong>registered</strong>. This is separate from the
      on/off switch above, which only toggles the <strong>user (global)</strong> setting.
      A <em>project</em> scope is committed to that repo's <code>.claude/settings.json</code> so teammates get it too.</p>
      <div class="detail-installations">${installationsHtml}</div>
    </div>

    ${plugin.skills?.length ? `
    <div class="detail-section">
      <h3>Skills (${plugin.skills.length}) <span class="section-hint">invoke as <code>/${plugin.name}:name</code></span></h3>
      <ul class="skills-list">
        ${plugin.skills.map(s => `<li>/${s.name}${s.format === 'command' ? ' <span class="legacy-tag">legacy command</span>' : ''}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${plugin.agents?.length ? `
    <div class="detail-section">
      <h3>Agents (${plugin.agents.length})</h3>
      <ul class="skills-list">
        ${plugin.agents.map(a => `<li>${a.name}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${plugin.hooks ? configSection('Hooks', summarizeHooks(plugin.hooks), plugin.hooks) : ''}

    ${plugin.mcpServers ? configSection('MCP Servers', summarizeMcp(plugin.mcpServers), plugin.mcpServers) : ''}

    ${plugin.lspServers ? configSection('LSP Servers', summarizeLsp(plugin.lspServers), plugin.lspServers) : ''}

    ${plugin.monitors ? configSection('Monitors', summarizeMonitors(plugin.monitors), plugin.monitors) : ''}

    ${plugin.bin?.length ? `
    <div class="detail-section">
      <h3>Bin (${plugin.bin.length}) <span class="section-hint">executables added to the Bash <code>PATH</code></span></h3>
      <ul class="skills-list">
        ${plugin.bin.map(b => `<li>${b.name}</li>`).join('')}
      </ul>
    </div>` : ''}

    <div class="detail-actions">
      <button class="btn-danger" id="uninstall-btn">Uninstall Completely</button>
    </div>
  `;

  const modal = showModal(el);

  // Toggle handler (controls the user/global setting only)
  const caption = el.querySelector('.toggle-caption');
  el.querySelector('#detail-toggle').addEventListener('change', async (e) => {
    if (caption) caption.innerHTML = `${e.target.checked ? 'Enabled' : 'Disabled'}<small>user / global</small>`;
    await api.togglePlugin(pluginId, e.target.checked);
  });

  // Remove scope handlers
  el.querySelectorAll('.btn-remove-scope').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scope = btn.dataset.scope;
      const projectPath = btn.dataset.project || null;
      const label = scope === 'user' ? 'User (Global)' : `${scope}: ${projectPath}`;

      if (plugin.installations.length === 1) {
        if (!confirm(`This is the last scope. Removing will uninstall "${plugin.name}" completely. Continue?`)) return;
      } else {
        if (!confirm(`Remove "${plugin.name}" from ${label}?`)) return;
      }

      await api.removeScope(pluginId, scope, projectPath);
      modal.close();
      onRefresh();
    });
  });

  // Uninstall handler
  el.querySelector('#uninstall-btn').addEventListener('click', async () => {
    if (!confirm(`Completely uninstall ${plugin.name}? This removes it from all scopes.`)) return;
    await api.uninstallPlugin(pluginId);
    modal.close();
    onRefresh();
  });
}
