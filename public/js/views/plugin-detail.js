import { showModal } from '../components/modal.js';

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
      <label class="toggle-switch">
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
      <div class="detail-installations">${installationsHtml}</div>
    </div>

    ${plugin.skills?.length ? `
    <div class="detail-section">
      <h3>Skills (${plugin.skills.length})</h3>
      <ul class="skills-list">
        ${plugin.skills.map(s => `<li>${s.name}</li>`).join('')}
      </ul>
    </div>` : ''}

    ${plugin.hooks ? `
    <div class="detail-section">
      <h3>Hooks</h3>
      <pre class="code-block">${JSON.stringify(plugin.hooks, null, 2)}</pre>
    </div>` : ''}

    ${plugin.mcpServers ? `
    <div class="detail-section">
      <h3>MCP Servers</h3>
      <pre class="code-block">${JSON.stringify(plugin.mcpServers, null, 2)}</pre>
    </div>` : ''}

    <div class="detail-actions">
      <button class="btn-danger" id="uninstall-btn">Uninstall Completely</button>
    </div>
  `;

  const modal = showModal(el);

  // Toggle handler
  el.querySelector('#detail-toggle').addEventListener('change', async (e) => {
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
