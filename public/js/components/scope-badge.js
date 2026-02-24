const SCOPE_COLORS = {
  user: 'badge-user',
  project: 'badge-project',
  local: 'badge-local',
};

export function scopeBadge(scope) {
  const cls = SCOPE_COLORS[scope] || '';
  return `<span class="scope-badge ${cls}">${scope}</span>`;
}
