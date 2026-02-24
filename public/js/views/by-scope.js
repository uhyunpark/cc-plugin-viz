import { pluginCard } from '../components/plugin-card.js';

export function renderByScope(container, plugins, { filterScope, searchQuery, onToggle, onCardClick, onScopeChange, duplicates }) {
  const filtered = plugins.filter(p => {
    if (filterScope && p.scope !== filterScope) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery) && !p.description.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  // Group by scope, then by projectPath within project/local
  const groups = {};
  for (const plugin of filtered) {
    const key = plugin.scope === 'user' ? 'user'
      : `${plugin.scope}:${plugin.projectPath || 'unknown'}`;
    if (!groups[key]) groups[key] = { scope: plugin.scope, projectPath: plugin.projectPath, plugins: [] };
    groups[key].plugins.push(plugin);
  }

  container.innerHTML = `
    <div class="view-header">
      <h2>Plugins by Scope</h2>
      <span class="plugin-count">${filtered.length} plugins</span>
    </div>
    <div id="scope-groups"></div>
  `;

  const groupsEl = container.querySelector('#scope-groups');

  if (Object.keys(groups).length === 0) {
    groupsEl.innerHTML = '<p class="empty-state">No plugins found.</p>';
    return;
  }

  for (const [key, group] of Object.entries(groups)) {
    const section = document.createElement('div');
    section.className = 'scope-group';
    section.dataset.scope = group.scope;
    section.dataset.projectPath = group.projectPath || '';

    const label = group.scope === 'user' ? 'User (Global)'
      : `${group.scope.charAt(0).toUpperCase() + group.scope.slice(1)}: ${group.projectPath}`;

    section.innerHTML = `
      <div class="scope-group-header">
        <h3>${label}</h3>
        <span class="scope-group-count">${group.plugins.length}</span>
      </div>
      <div class="scope-drop-zone card-grid" data-scope="${group.scope}" data-project="${group.projectPath || ''}"></div>
    `;

    const dropZone = section.querySelector('.scope-drop-zone');

    // Drag-and-drop handlers
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drop-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-active');
      const pluginId = e.dataTransfer.getData('text/plain');
      const targetScope = dropZone.dataset.scope;
      const targetProject = dropZone.dataset.project || null;

      if (targetScope === 'project' || targetScope === 'local') {
        if (targetProject) {
          onScopeChange(pluginId, targetScope, targetProject);
        } else {
          onScopeChange(pluginId, targetScope, null);
        }
      } else {
        onScopeChange(pluginId, targetScope);
      }
    });

    for (const plugin of group.plugins) {
      dropZone.appendChild(pluginCard(plugin, {
        onToggle,
        onClick: onCardClick,
        draggable: true,
        duplicateInfo: duplicates?.[plugin.id],
      }));
    }

    groupsEl.appendChild(section);
  }
}
