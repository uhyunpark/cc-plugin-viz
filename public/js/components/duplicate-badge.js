export function detectDuplicates(plugins) {
  const byName = {};
  for (const p of plugins) {
    if (!byName[p.name]) byName[p.name] = [];
    byName[p.name].push(p);
  }

  const duplicates = {};
  for (const [name, instances] of Object.entries(byName)) {
    if (instances.length > 1) {
      const sameMarketplace = instances.every(i => i.marketplace === instances[0].marketplace);
      for (const inst of instances) {
        duplicates[inst.id] = {
          type: sameMarketplace ? 'same-plugin-multi-scope' : 'different-marketplace',
          others: instances.filter(i => i.id !== inst.id).map(i => i.id),
        };
      }
    }
  }
  return duplicates;
}

export function duplicateBadge(info) {
  if (!info) return '';
  if (info.type === 'same-plugin-multi-scope') {
    return `<span class="duplicate-badge badge-info" title="Also installed in other scopes">Multi-scope</span>`;
  }
  return `<span class="duplicate-badge badge-warning" title="Multiple versions from different marketplaces">Multiple versions</span>`;
}
