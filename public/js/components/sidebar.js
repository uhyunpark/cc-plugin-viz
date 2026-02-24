export function renderSidebar(container, activeView, onNavigate) {
  const items = [
    { id: 'overview', label: 'Overview', icon: '&#9783;' },
    { id: 'by-scope', label: 'By Scope', icon: '&#9776;', children: [
      { id: 'scope-user', label: 'User (Global)' },
      { id: 'scope-project', label: 'Project' },
      { id: 'scope-local', label: 'Local' },
    ]},
    { id: 'marketplace', label: 'Marketplace', icon: '&#9733;' },
    { id: 'blocklist', label: 'Blocklist', icon: '&#9888;' },
  ];

  container.innerHTML = `
    <div class="sidebar-header">
      <h1 class="sidebar-title">cc-plugin-viz</h1>
    </div>
    <ul class="sidebar-nav">
      ${items.map(item => `
        <li class="nav-item ${activeView === item.id ? 'active' : ''}">
          <a href="#" data-view="${item.id}" class="nav-link">
            <span class="nav-icon">${item.icon || ''}</span>
            ${item.label}
          </a>
          ${item.children ? `
            <ul class="nav-children">
              ${item.children.map(child => `
                <li class="nav-child ${activeView === child.id ? 'active' : ''}">
                  <a href="#" data-view="${child.id}" class="nav-link">${child.label}</a>
                </li>
              `).join('')}
            </ul>
          ` : ''}
        </li>
      `).join('')}
    </ul>
  `;

  container.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(el.dataset.view);
    });
  });
}
