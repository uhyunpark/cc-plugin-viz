import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { readJSON } from './reader.js';

// Detects a plugin's components the way Claude Code does: by directory
// convention (skills/, commands/, agents/, hooks/hooks.json, .mcp.json),
// with optional overrides declared in .claude-plugin/plugin.json.
//
// For each component type, the default convention location is always scanned;
// any explicit path(s) in plugin.json are added on top (Claude treats
// plugin.json fields as additive, not replacements).

function resolvePaths(installPath, defaultRel, declared) {
  const out = [join(installPath, defaultRel)];
  if (typeof declared === 'string') {
    out.push(join(installPath, declared));
  } else if (Array.isArray(declared)) {
    for (const d of declared) {
      if (typeof d === 'string') out.push(join(installPath, d));
    }
  }
  // Dedupe while preserving order
  return [...new Set(out)];
}

// List direct subdirectories that contain a SKILL.md file.
async function listSkills(dir) {
  const skills = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return skills;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(dir, entry.name);
    try {
      const files = await readdir(skillPath);
      if (files.includes('SKILL.md')) {
        skills.push({ name: entry.name, path: skillPath });
      }
    } catch { /* unreadable dir */ }
  }
  return skills;
}

// Recursively list `.md` files, naming each by its path relative to `root`
// (without the extension), using forward slashes for namespaced commands.
async function listMarkdown(root) {
  const results = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = relative(root, full).slice(0, -3).split(sep).join('/');
        results.push({ name, path: full });
      }
    }
  }
  await walk(root);
  return results;
}

// List regular files directly inside a directory (used for bin/ executables).
async function listFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isFile()) results.push({ name: entry.name, path: join(dir, entry.name) });
  }
  return results;
}

// If `declared` is an inline object/array, use it as-is. If it's a string (or
// undefined), read JSON from the default convention file plus any declared path.
async function resolveConfig(installPath, defaultRel, declared) {
  if (declared && typeof declared === 'object') return declared;
  const candidates = resolvePaths(installPath, defaultRel, declared);
  for (const file of candidates) {
    const json = await readJSON(file);
    if (json) return json;
  }
  return null;
}

async function collectMany(installPath, defaultRel, declared, lister, format) {
  const dirs = resolvePaths(installPath, defaultRel, declared);
  const seen = new Set();
  const out = [];
  for (const dir of dirs) {
    for (const item of await lister(dir)) {
      if (seen.has(item.name)) continue;
      seen.add(item.name);
      out.push(format ? { ...item, format } : item);
    }
  }
  return out;
}

function dedupeByName(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    out.push(item);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function detectCapabilities(installPath, pluginMeta = {}) {
  const meta = pluginMeta || {};
  const [skillFiles, commandFiles, agents, hooks, mcpServers, lspServers, monitors, bin] =
    await Promise.all([
      collectMany(installPath, 'skills', meta.skills, listSkills, 'skill'),
      collectMany(installPath, 'commands', meta.commands, listMarkdown, 'command'),
      collectMany(installPath, 'agents', meta.agents, listMarkdown),
      resolveConfig(installPath, join('hooks', 'hooks.json'), meta.hooks),
      resolveConfig(installPath, '.mcp.json', meta.mcpServers),
      resolveConfig(installPath, '.lsp.json', meta.lspServers),
      resolveConfig(installPath, join('monitors', 'monitors.json'), meta.monitors),
      collectMany(installPath, 'bin', meta.bin, listFiles),
    ]);

  // Slash commands were merged into skills in Claude Code: a commands/*.md file
  // and a skills/<name>/SKILL.md both produce /name and behave identically.
  // We surface them as a single unified list (skills/ wins on name clash),
  // tagging each entry's source format.
  const skills = dedupeByName([...skillFiles, ...commandFiles]);

  return {
    skills,
    agents: dedupeByName(agents),
    hooks,
    mcpServers,
    lspServers,
    monitors,
    bin: dedupeByName(bin),
  };
}
