import { showModal } from '../components/modal.js';

export async function renderMarketplace(container, { api, searchQuery }) {
  container.innerHTML = `
    <div class="view-header">
      <h2>Marketplace</h2>
    </div>
    <div class="marketplace-tabs" id="marketplace-tabs"></div>
    <div class="card-grid" id="marketplace-grid"></div>
  `;

  const marketplacesRes = await api.getMarketplaces();
  if (!marketplacesRes.ok) return;

  const tabs = container.querySelector('#marketplace-tabs');
  const grid = container.querySelector('#marketplace-grid');
  const marketplaces = marketplacesRes.data;

  if (marketplaces.length === 0) {
    grid.innerHTML = '<p class="empty-state">No marketplaces registered.</p>';
    return;
  }

  // Render tabs
  tabs.innerHTML = marketplaces.map((m, i) => `
    <button class="marketplace-tab ${i === 0 ? 'active' : ''}" data-name="${m.name}">${m.name}</button>
  `).join('');

  async function loadMarketplace(name) {
    const res = await api.getMarketplacePlugins(name);
    if (!res.ok) return;

    let plugins = res.data;
    if (searchQuery) {
      plugins = plugins.filter(p =>
        p.name.toLowerCase().includes(searchQuery) ||
        p.description.toLowerCase().includes(searchQuery)
      );
    }

    // Sort by install count descending
    plugins.sort((a, b) => (b.installCount || 0) - (a.installCount || 0));

    grid.innerHTML = '';

    if (plugins.length === 0) {
      grid.innerHTML = '<p class="empty-state">No plugins found.</p>';
      return;
    }

    for (const plugin of plugins) {
      const card = document.createElement('div');
      card.className = `marketplace-card ${plugin.installed ? 'installed' : ''}`;
      card.innerHTML = `
        <div class="card-header">
          <h3 class="card-name">${plugin.name}</h3>
          <div class="card-header-actions">
            ${plugin.installed ? '<span class="installed-badge">Installed</span>' : ''}
          </div>
        </div>
        <p class="card-description">${plugin.description || ''}</p>
        <div class="card-footer">
          <span class="card-category">${plugin.category || ''}</span>
          <span class="install-count">${formatCount(plugin.installCount)} installs</span>
          ${plugin.installed ? '' : `<button class="btn-install" data-name="${plugin.name}" data-marketplace="${name}">Install</button>`}
        </div>
      `;
      grid.appendChild(card);
    }

    // Install button handlers
    grid.querySelectorAll('.btn-install').forEach(btn => {
      btn.addEventListener('click', () => {
        showInstallModal(btn.dataset.name, btn.dataset.marketplace, api);
      });
    });

  }

  // Tab click handlers
  tabs.querySelectorAll('.marketplace-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelector('.active')?.classList.remove('active');
      tab.classList.add('active');
      loadMarketplace(tab.dataset.name);
    });
  });

  // Load first marketplace
  if (marketplaces.length > 0) {
    loadMarketplace(marketplaces[0].name);
  }
}

function showInstallModal(name, marketplace, api) {
  const el = document.createElement('div');
  el.innerHTML = `
    <h3>Install ${name}</h3>
    <div class="form-group">
      <label>Scope</label>
      <select id="install-scope">
        <option value="user">User (Global)</option>
        <option value="project">Project</option>
        <option value="local">Local</option>
      </select>
    </div>
    <div class="form-group hidden" id="project-path-group">
      <label>Project Path</label>
      <input type="text" id="install-project-path" placeholder="/path/to/project" />
    </div>
    <button class="btn-primary" id="confirm-install">Install</button>
  `;

  const modal = showModal(el);

  el.querySelector('#install-scope').addEventListener('change', (e) => {
    const group = el.querySelector('#project-path-group');
    group.classList.toggle('hidden', e.target.value === 'user');
  });

  el.querySelector('#confirm-install').addEventListener('click', async () => {
    const scope = el.querySelector('#install-scope').value;
    const projectPath = el.querySelector('#install-project-path').value;
    const res = await api.installPlugin(name, marketplace, scope, projectPath || undefined);
    modal.close();
    if (res.ok) location.reload();
  });
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
