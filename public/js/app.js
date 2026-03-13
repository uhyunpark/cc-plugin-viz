import { api } from './api.js';
import { renderSidebar } from './components/sidebar.js';
import { renderOverview } from './views/overview.js';
import { renderByScope } from './views/by-scope.js';
import { renderMarketplace } from './views/marketplace.js';
import { renderBlocklist } from './views/blocklist.js';
import { showPluginDetail } from './views/plugin-detail.js';

let currentView = 'overview';
let pluginsCache = [];
let searchQuery = '';

async function loadPlugins() {
  const res = await api.getPlugins();
  if (res.ok) pluginsCache = res.data;
  return pluginsCache;
}

function navigate(view) {
  currentView = view;
  render();
}

async function handleToggle(pluginId, enabled) {
  await api.togglePlugin(pluginId, enabled);
  await render();
}

function handleCardClick(pluginId) {
  showPluginDetail(pluginId, { api, onRefresh: render });
}

async function handleAddScope(pluginId, scope, projectPath) {
  if ((scope === 'project' || scope === 'local') && !projectPath) {
    projectPath = prompt(`Enter project path for ${scope} scope:`);
    if (!projectPath) return;
  }
  await api.addScope(pluginId, scope, projectPath);
  await render();
}

async function handleRemoveScope(pluginId, scope, projectPath) {
  await api.removeScope(pluginId, scope, projectPath);
  await render();
}

function getKnownProjectPaths() {
  const paths = new Set();
  for (const p of pluginsCache) {
    for (const inst of p.installations) {
      if (inst.projectPath) paths.add(inst.projectPath);
    }
  }
  return [...paths];
}

async function render() {
  const sidebar = document.getElementById('sidebar');
  const viewEl = document.getElementById('view');

  renderSidebar(sidebar, currentView, navigate);

  await loadPlugins();

  const scopeMap = {
    'scope-user': 'user',
    'scope-project': 'project',
    'scope-local': 'local',
  };

  const knownProjectPaths = getKnownProjectPaths();

  if (currentView === 'overview') {
    renderOverview(viewEl, pluginsCache, {
      searchQuery,
      onToggle: handleToggle,
      onCardClick: handleCardClick,
      onAddScope: handleAddScope,
      onRemoveScope: handleRemoveScope,
      knownProjectPaths,
    });
  } else if (currentView === 'by-scope' || scopeMap[currentView]) {
    renderByScope(viewEl, pluginsCache, {
      filterScope: scopeMap[currentView] || null,
      searchQuery,
      onToggle: handleToggle,
      onCardClick: handleCardClick,
      onAddScope: handleAddScope,
      onRemoveScope: handleRemoveScope,
      knownProjectPaths,
    });
  } else if (currentView === 'marketplace') {
    await renderMarketplace(viewEl, { api, searchQuery });
  } else if (currentView === 'blocklist') {
    await renderBlocklist(viewEl, { api });
  }
}

// Toast helper
function showToast(message, duration = 5000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Reload plugins reminder
document.getElementById('reload-plugins-btn').addEventListener('click', () => {
  showToast('Run <code>/reload-plugins</code> in your Claude Code session to pick up changes');
});

// Search handler
document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  render();
});

// Initial render
render();

// Export for use by components
export { api, pluginsCache, searchQuery, navigate, render, loadPlugins };
