import { api } from './api.js';
import { renderSidebar } from './components/sidebar.js';

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

async function render() {
  const sidebar = document.getElementById('sidebar');
  const viewEl = document.getElementById('view');

  renderSidebar(sidebar, currentView, navigate);

  await loadPlugins();
  // View rendering will be added in Phase 6 tasks
  viewEl.innerHTML = `<p>View: ${currentView} &mdash; ${pluginsCache.length} plugins loaded</p>`;
}

// Search handler
document.getElementById('search').addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  render();
});

// Initial render
render();

// Export for use by components
export { api, pluginsCache, searchQuery, navigate, render, loadPlugins };
