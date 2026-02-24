import { showModal } from '../components/modal.js';
import { scopeBadge } from '../components/scope-badge.js';

export async function showPluginDetail(pluginId, { api, onRefresh }) {
  const res = await api.getPlugin(pluginId);
  if (!res.ok) return;
  const plugin = res.data;

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
        <span class="meta-label">Scope</span>
        <span class="meta-value">${scopeBadge(plugin.scope)}</span>
      </div>
      ${plugin.projectPath ? `
      <div class="meta-item">
        <span class="meta-label">Project</span>
        <span class="meta-value">${plugin.projectPath}</span>
      </div>` : ''}
      <div class="meta-item">
        <span class="meta-label">Installed</span>
        <span class="meta-value">${new Date(plugin.installedAt).toLocaleDateString()}</span>
      </div>
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

    <div class="detail-section">
      <h3>Scope</h3>
      <select id="detail-scope">
        <option value="user" ${plugin.scope === 'user' ? 'selected' : ''}>User (Global)</option>
        <option value="project" ${plugin.scope === 'project' ? 'selected' : ''}>Project</option>
        <option value="local" ${plugin.scope === 'local' ? 'selected' : ''}>Local</option>
      </select>
      <input type="text" id="detail-project-path" placeholder="Project path"
        value="${plugin.projectPath || ''}"
        class="${plugin.scope === 'user' ? 'hidden' : ''}" />
      <button class="btn-secondary" id="save-scope">Save Scope</button>
    </div>

    <div class="detail-actions">
      <button class="btn-danger" id="uninstall-btn">Uninstall</button>
    </div>
  `;

  const modal = showModal(el);

  // Toggle handler
  el.querySelector('#detail-toggle').addEventListener('change', async (e) => {
    await api.togglePlugin(pluginId, e.target.checked);
  });

  // Scope change handler
  el.querySelector('#detail-scope').addEventListener('change', (e) => {
    el.querySelector('#detail-project-path').classList.toggle('hidden', e.target.value === 'user');
  });

  el.querySelector('#save-scope').addEventListener('click', async () => {
    const scope = el.querySelector('#detail-scope').value;
    const projectPath = el.querySelector('#detail-project-path').value;
    await api.changeScope(pluginId, scope, projectPath || undefined);
    modal.close();
    onRefresh();
  });

  // Uninstall handler
  el.querySelector('#uninstall-btn').addEventListener('click', async () => {
    if (!confirm(`Uninstall ${plugin.name}?`)) return;
    await api.uninstallPlugin(pluginId);
    modal.close();
    onRefresh();
  });
}
