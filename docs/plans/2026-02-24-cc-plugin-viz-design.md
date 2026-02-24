# cc-plugin-viz Design

## Overview

A Claude Code plugin that launches a local web dashboard for visual plugin management. Solves the problem of managing plugins through CLI commands (`/marketplace`, `/plugin`) which is difficult even for developers and inaccessible to non-developers.

**Invocation:** `/viz` skill starts a Node.js HTTP server on localhost and opens the browser.

## Architecture

Monolithic skill + embedded server. Zero external dependencies — uses `node:http` only.

```
cc-plugin-viz/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── viz/
│       └── SKILL.md
├── server/
│   ├── index.js                 # Entry point — starts HTTP server
│   ├── routes/
│   │   ├── plugins.js           # CRUD for installed plugins
│   │   ├── marketplaces.js      # Read marketplace data
│   │   ├── settings.js          # Read/write settings
│   │   └── skills.js            # Read skill metadata
│   └── lib/
│       ├── paths.js             # Resolves ~/.claude/plugins/* paths
│       ├── reader.js            # Safe JSON file reading
│       └── writer.js            # Atomic JSON file writing with validation
├── public/
│   ├── index.html
│   ├── style.css
│   └── js/
│       ├── app.js               # Main app logic, routing
│       ├── api.js               # Fetch wrapper for REST API
│       └── components/
│           ├── sidebar.js
│           ├── plugin-card.js
│           ├── marketplace.js
│           ├── scope-badge.js
│           └── modal.js
└── package.json                 # Metadata only, no dependencies
```

## Data Sources

All data lives in `~/.claude/plugins/` as JSON files:

| File | Purpose |
|------|---------|
| `installed_plugins.json` | Central registry — scope, version, path, timestamps |
| `known_marketplaces.json` | Registered marketplace sources |
| `settings.json` | Global `enabledPlugins` |
| `<project>/.claude/settings.json` | Per-project `enabledPlugins` |
| `blocklist.json` | Blocked plugins |
| `install-counts-cache.json` | Install popularity metrics |
| `marketplaces/*/marketplace.json` | Full marketplace plugin catalogs |
| `cache/*/.claude-plugin/plugin.json` | Individual plugin metadata |

## REST API

### Read Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/plugins` | All installed plugins with scope, version, enabled status |
| `GET` | `/api/plugins/:id` | Single plugin detail (skills, hooks, MCP servers) |
| `GET` | `/api/marketplaces` | All registered marketplaces with catalogs |
| `GET` | `/api/marketplaces/:name/plugins` | Plugins in a specific marketplace |
| `GET` | `/api/settings` | Global and per-project enabledPlugins |
| `GET` | `/api/blocklist` | Blocklisted plugins |
| `GET` | `/api/install-counts` | Install popularity data |

### Write Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/plugins/:id/toggle` | Enable/disable a plugin |
| `PATCH` | `/api/plugins/:id/scope` | Change plugin scope |
| `POST` | `/api/plugins/install` | Install from marketplace (shells out to `claude` CLI) |
| `DELETE` | `/api/plugins/:id` | Uninstall (shells out to `claude` CLI) |
| `PUT` | `/api/plugins/:id/config` | Edit plugin configuration |
| `POST` | `/api/blocklist/:id` | Add to blocklist |
| `DELETE` | `/api/blocklist/:id` | Remove from blocklist |

### Response Shape

All endpoints return: `{ ok: boolean, data?: any, error?: string }`

## Dashboard UI

### Layout

Sidebar + main content area. Sidebar navigation: Overview, By Scope (User/Project/Local), Marketplace, Blocklist.

### Views

**Overview** — All installed plugins as cards in a grid. Each card shows: name, marketplace badge, version, scope badge (color-coded), project path, enabled/disabled toggle, plugin type icons (skill/MCP/hook/LSP).

**By Scope** — Cards grouped under scope headers. Supports drag-and-drop between scope groups to change a plugin's scope. Dropping to project/local scope prompts for project path selection.

**Marketplace** — Browse available plugins from all registered marketplaces. Shows name, description, category, install count. Install button opens modal for scope + project path. Already-installed plugins marked with checkmark.

**Blocklist** — List of blocked plugins with unblock buttons.

**Plugin Detail Modal** — Opened by clicking a card. Shows full metadata, skills list, hooks, MCP servers, enable/disable toggle, scope changer, uninstall button, edit config button.

### Interactions

- Toggle switch for instant enable/disable
- Drag-and-drop cards between scope groups
- Search/filter bar at top of main content
- Install from marketplace via modal
- Uninstall with confirmation dialog

### Duplicate Handling

**Same plugin, different scopes:** Show both cards with "also installed as..." badge. Lower-priority scope grayed out with "shadowed" label.

**Same name, different marketplaces:** Show both with yellow warning badge "Multiple versions installed." Detail modal shows comparison and offers "consolidate" action to pick one and uninstall the other.

## Error Handling & Safety

- **Atomic writes:** Write to `.tmp` → validate JSON → `fs.rename()` into place
- **Backups:** Before any write, copy target to `~/.claude/plugins/.backup/<filename>.<timestamp>.json`. Keep last 5 per file.
- **Validation:** Verify plugin IDs exist, validate schema before writing
- **Install/uninstall:** Shell out to `claude plugins install/uninstall` — don't reimplement git logic
- **Server binds to `127.0.0.1` only** — no network exposure, no auth needed

## Testing Strategy

- **Unit tests:** `reader.js`/`writer.js` against fixture JSON files. API routes with mocked file system.
- **Integration tests:** Server against temp directory with fixture data. Mock `claude` CLI for install/uninstall.
- **Manual testing:** Live against real plugin data (reads) and test directory (writes).
- **No frontend unit tests** — manual visual testing sufficient for dashboard UI.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Claude Code plugin (not standalone app) | Stays in the ecosystem, users already have Claude Code |
| HTML in browser (not TUI) | Accessible to non-developers |
| `node:http` (no Express) | Zero dependencies, plugin stays lightweight |
| Vanilla HTML/CSS/JS | No build step, ships as-is |
| Shell out for install/uninstall | Stay consistent with official CLI behavior |
| Monolithic skill + embedded server | Simplest architecture, can evolve later |
