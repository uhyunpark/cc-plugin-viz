export async function renderBlocklist(container, { api }) {
  const res = await api.getBlocklist();
  if (!res.ok) return;

  const { plugins } = res.data;

  container.innerHTML = `
    <div class="view-header">
      <h2>Blocklist</h2>
      <span class="plugin-count">${plugins.length} blocked</span>
    </div>
    <div class="blocklist" id="blocklist"></div>
  `;

  const list = container.querySelector('#blocklist');

  if (plugins.length === 0) {
    list.innerHTML = '<p class="empty-state">No blocked plugins.</p>';
    return;
  }

  for (const entry of plugins) {
    const row = document.createElement('div');
    row.className = 'blocklist-row';
    row.innerHTML = `
      <div class="blocklist-info">
        <strong>${entry.plugin}</strong>
        <span class="blocklist-reason">${entry.reason || 'No reason'}</span>
        ${entry.text ? `<p class="blocklist-text">${entry.text}</p>` : ''}
        <span class="blocklist-date">Blocked ${new Date(entry.added_at).toLocaleDateString()}</span>
      </div>
      <button class="btn-secondary btn-unblock" data-id="${entry.plugin}">Unblock</button>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll('.btn-unblock').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.removeFromBlocklist(btn.dataset.id);
      renderBlocklist(container, { api }); // Re-render
    });
  });
}
