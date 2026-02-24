const BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

export const api = {
  getPlugins: () => request('/api/plugins'),
  getPlugin: (id) => request(`/api/plugins/${encodeURIComponent(id)}`),
  getMarketplaces: () => request('/api/marketplaces'),
  getMarketplacePlugins: (name) => request(`/api/marketplaces/${encodeURIComponent(name)}/plugins`),
  getSettings: () => request('/api/settings'),
  getBlocklist: () => request('/api/blocklist'),
  getInstallCounts: () => request('/api/install-counts'),
  togglePlugin: (id, enabled) => request(`/api/plugins/${encodeURIComponent(id)}/toggle`, {
    method: 'PATCH', body: JSON.stringify({ enabled }),
  }),
  addScope: (id, scope, projectPath) => request(`/api/plugins/${encodeURIComponent(id)}/add-scope`, {
    method: 'POST', body: JSON.stringify({ scope, projectPath }),
  }),
  removeScope: (id, scope, projectPath) => request(`/api/plugins/${encodeURIComponent(id)}/scope`, {
    method: 'DELETE', body: JSON.stringify({ scope, projectPath }),
  }),
  installPlugin: (name, marketplace, scope, projectPath) => request('/api/plugins/install', {
    method: 'POST', body: JSON.stringify({ name, marketplace, scope, projectPath }),
  }),
  uninstallPlugin: (id) => request(`/api/plugins/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addToBlocklist: (id, reason) => request(`/api/blocklist/${encodeURIComponent(id)}`, {
    method: 'POST', body: JSON.stringify({ reason }),
  }),
  removeFromBlocklist: (id) => request(`/api/blocklist/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
