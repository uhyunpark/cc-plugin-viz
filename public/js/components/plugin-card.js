import { scopeBadge } from './scope-badge.js';

function scopeChipLabel(inst) {
  if (inst.scope === 'user') return 'User (Global)';
  const dirName = inst.projectPath ? inst.projectPath.split('/').pop() : 'unknown';
  return `${inst.scope}: ${dirName}`;
}

function buildAddScopeItems(plugin, knownProjectPaths) {
  const scopes = ['user', 'project', 'local'];
  const items = [];

  for (const scope of scopes) {
    if (scope === 'user') {
      const exists = plugin.installations.some(i => i.scope === 'user');
      if (!exists) items.push({ label: 'User (Global)', scope: 'user', projectPath: null });
    } else {
      const paths = [...new Set(knownProjectPaths)].sort();
      for (const pp of paths) {
        const exists = plugin.installations.some(i => i.scope === scope && i.projectPath === pp);
        if (!exists) {
          const dirName = pp.split('/').pop();
          items.push({ label: `${scope === 'project' ? 'Project' : 'Local'}: ${dirName}`, scope, projectPath: pp });
        }
      }
      items.push({ label: `${scope === 'project' ? 'Project' : 'Local'}: Other...`, scope, projectPath: null, isOther: true });
    }
  }

  return items;
}

export function pluginCard(plugin, { onToggle, onClick, onAddScope, onRemoveScope, knownProjectPaths = [], draggable = false } = {}) {
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

  const typeBadges = [];
  if (plugin.hasSkills) typeBadges.push('<span class="type-badge">Skills</span>');
  if (plugin.hasMcpServers) typeBadges.push('<span class="type-badge">MCP</span>');
  if (plugin.hasHooks) typeBadges.push('<span class="type-badge">Hooks</span>');
  if (plugin.hasLspServers) typeBadges.push('<span class="type-badge">LSP</span>');

  // Build scope chips HTML
  const scopeChips = plugin.installations.map((inst, idx) => {
    const label = scopeChipLabel(inst);
    return `<span class="scope-chip scope-chip-${inst.scope}" data-idx="${idx}" title="${inst.projectPath || 'Global'}">${label}<button class="chip-remove" data-idx="${idx}" title="Remove from this scope">&times;</button></span>`;
  }).join('');

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title-block">
        <h3 class="card-name">${plugin.name}</h3>
        <span class="card-marketplace">@${plugin.marketplace}</span>
      </div>
      <label class="toggle-switch" title="${plugin.enabled ? 'Enabled' : 'Disabled'}">
        <input type="checkbox" ${plugin.enabled ? 'checked' : ''} />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <p class="card-description">${plugin.description || 'No description'}</p>
    <div class="card-scopes">
      ${scopeChips}
      ${onAddScope ? '<button class="scope-add-btn" title="Add to scope">+</button>' : ''}
    </div>
    <div class="card-footer">
      <div class="card-meta">
        <span class="card-version">v${plugin.version}</span>
        ${typeBadges.join('')}
      </div>
    </div>
  `;

  // Toggle handler
  const toggle = card.querySelector('input[type="checkbox"]');
  toggle.addEventListener('change', (e) => {
    e.stopPropagation();
    if (onToggle) onToggle(plugin.id, toggle.checked);
  });

  // Scope chip remove handlers
  card.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const inst = plugin.installations[idx];
      if (!inst) return;

      const label = scopeChipLabel(inst);
      if (plugin.installations.length === 1) {
        if (!confirm(`This is the last scope for "${plugin.name}". Removing it will uninstall the plugin. Continue?`)) return;
      } else {
        if (!confirm(`Remove "${plugin.name}" from ${label}?`)) return;
      }

      if (onRemoveScope) onRemoveScope(plugin.id, inst.scope, inst.projectPath);
    });
  });

  // Add scope button handler
  const addBtn = card.querySelector('.scope-add-btn');
  if (addBtn && onAddScope) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Close any existing dropdown
      document.querySelectorAll('.scope-add-dropdown').forEach(el => el.remove());

      const items = buildAddScopeItems(plugin, knownProjectPaths);
      if (items.length === 0) return;

      const dropdown = document.createElement('div');
      dropdown.className = 'scope-add-dropdown';

      for (const item of items) {
        const el = document.createElement('div');
        el.className = 'scope-add-item';
        el.textContent = item.label;

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          dropdown.remove();

          if (item.isOther) {
            const pp = prompt(`Enter project path for ${item.scope} scope:`);
            if (pp) onAddScope(plugin.id, item.scope, pp);
          } else {
            onAddScope(plugin.id, item.scope, item.projectPath);
          }
        });

        dropdown.appendChild(el);
      }

      // Position relative to button, render on body
      const rect = addBtn.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.left = `${rect.left}px`;
      document.body.appendChild(dropdown);

      // Close on outside click or scroll
      const closeHandler = (ev) => {
        if (!dropdown.contains(ev.target) && ev.target !== addBtn) {
          dropdown.remove();
          document.removeEventListener('click', closeHandler);
          window.removeEventListener('scroll', closeHandler, true);
        }
      };
      setTimeout(() => {
        document.addEventListener('click', closeHandler);
        window.addEventListener('scroll', closeHandler, true);
      }, 0);
    });
  }

  // Click handler (opens detail modal)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.toggle-switch') || e.target.closest('.chip-remove') || e.target.closest('.scope-add-btn') || e.target.closest('.scope-add-dropdown')) return;
    if (onClick) onClick(plugin.id);
  });

  return card;
}
