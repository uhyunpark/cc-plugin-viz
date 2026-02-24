import { scopeBadge } from './scope-badge.js';

export function pluginCard(plugin, { onToggle, onClick, draggable = false, duplicateInfo } = {}) {
  const card = document.createElement('div');
  card.className = `plugin-card ${plugin.enabled ? '' : 'disabled'}`;
  card.dataset.pluginId = plugin.id;

  if (draggable) {
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', plugin.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  }

  const typeIcons = [];
  if (plugin.hasSkills) typeIcons.push('<span class="type-icon" title="Skills">S</span>');
  if (plugin.hasMcpServers) typeIcons.push('<span class="type-icon" title="MCP">M</span>');
  if (plugin.hasHooks) typeIcons.push('<span class="type-icon" title="Hooks">H</span>');
  if (plugin.hasLspServers) typeIcons.push('<span class="type-icon" title="LSP">L</span>');

  let dupBadge = '';
  if (duplicateInfo) {
    if (duplicateInfo.type === 'same-plugin-multi-scope') {
      dupBadge = '<span class="duplicate-badge badge-info" title="Also installed in other scopes">Multi-scope</span>';
    } else {
      dupBadge = '<span class="duplicate-badge badge-warning" title="Multiple versions from different marketplaces">Multiple versions</span>';
    }
  }

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-row">
        <h3 class="card-name">${plugin.name}</h3>
        <span class="card-marketplace">@${plugin.marketplace}</span>
      </div>
      <label class="toggle-switch" title="${plugin.enabled ? 'Enabled' : 'Disabled'}">
        <input type="checkbox" ${plugin.enabled ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <p class="card-description">${plugin.description || 'No description'}</p>
    <div class="card-footer">
      <div class="card-meta">
        ${scopeBadge(plugin.scope)}
        <span class="card-version">v${plugin.version}</span>
        ${typeIcons.join('')}
        ${dupBadge}
      </div>
      ${plugin.projectPath ? `<span class="card-project" title="${plugin.projectPath}">${plugin.projectPath.split('/').pop()}</span>` : ''}
    </div>
  `;

  // Toggle handler
  const toggle = card.querySelector('input[type="checkbox"]');
  toggle.addEventListener('change', (e) => {
    e.stopPropagation();
    if (onToggle) onToggle(plugin.id, toggle.checked);
  });

  // Click handler (opens detail modal)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.toggle-switch')) return;
    if (onClick) onClick(plugin.id);
  });

  return card;
}
