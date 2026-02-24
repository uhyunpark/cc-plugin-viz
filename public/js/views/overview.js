import { pluginCard } from '../components/plugin-card.js';

export function renderOverview(container, plugins, { searchQuery, onToggle, onCardClick, onAddScope, onRemoveScope, knownProjectPaths = [] }) {
  const filtered = plugins.filter(p =>
    !searchQuery ||
    p.name.toLowerCase().includes(searchQuery) ||
    p.description.toLowerCase().includes(searchQuery) ||
    p.marketplace.toLowerCase().includes(searchQuery)
  );

  container.innerHTML = `
    <div class="view-header">
      <h2>All Plugins</h2>
      <span class="plugin-count">${filtered.length} plugins</span>
    </div>
    <div class="card-grid" id="overview-grid"></div>
  `;

  const grid = container.querySelector('#overview-grid');

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="empty-state">No plugins found.</p>';
    return;
  }

  for (const plugin of filtered) {
    grid.appendChild(pluginCard(plugin, {
      onToggle,
      onClick: onCardClick,
      onAddScope,
      onRemoveScope,
      knownProjectPaths,
    }));
  }
}
