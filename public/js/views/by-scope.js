import { pluginCard } from '../components/plugin-card.js';

export function renderByScope(container, plugins, { filterScope, searchQuery, onToggle, onCardClick, onAddScope, onRemoveScope, onUninstall, knownProjectPaths = [] }) {
  // Filter by search
  let filtered = plugins.filter(p => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery) && !p.description.toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  // Filter by scope if specified
  if (filterScope) {
    filtered = filtered.filter(p => p.installations.some(i => i.scope === filterScope));
  }

  // Group by scope + projectPath
  const groups = {};
  for (const plugin of filtered) {
    for (const inst of plugin.installations) {
      if (filterScope && inst.scope !== filterScope) continue;
      const key = inst.scope === 'user' ? 'user' : `${inst.scope}:${inst.projectPath || 'unknown'}`;
      if (!groups[key]) groups[key] = { scope: inst.scope, projectPath: inst.projectPath, pluginIds: new Set() };
      groups[key].pluginIds.add(plugin.id);
    }
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

  // Build a lookup for quick access
  const pluginMap = {};
  for (const p of filtered) pluginMap[p.id] = p;

  for (const [key, group] of Object.entries(groups)) {
    const section = document.createElement('div');
    section.className = 'scope-group';

    const label = group.scope === 'user' ? 'User (Global)'
      : `${group.scope.charAt(0).toUpperCase() + group.scope.slice(1)}: ${group.projectPath}`;

    section.innerHTML = `
      <div class="scope-group-header">
        <h3>${label}</h3>
        <span class="scope-group-count">${group.pluginIds.size}</span>
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

      if (onAddScope) {
        onAddScope(pluginId, targetScope, targetProject);
      }
    });

    for (const pluginId of group.pluginIds) {
      const plugin = pluginMap[pluginId];
      if (!plugin) continue;
      dropZone.appendChild(pluginCard(plugin, {
        onToggle,
        onClick: onCardClick,
        onAddScope,
        onRemoveScope,
        onUninstall,
        knownProjectPaths,
        draggable: true,
      }));
    }

    groupsEl.appendChild(section);
  }
}
