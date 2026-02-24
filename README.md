# cc-plugin-viz

Visual dashboard for managing Claude Code plugins across scopes (user, project, local).

## Features

- **Overview** — see all installed plugins at a glance with search and filtering
- **By Scope** — drag-and-drop plugins between user/project/local scopes
- **Marketplace** — browse registered marketplaces, see install counts, one-click install
- **Plugin Detail** — view skills, hooks, MCP servers; toggle enable/disable; change scope; uninstall
- **Blocklist** — view and manage blocked plugins
- **Duplicate Detection** — warns when the same plugin is installed from multiple sources

## Requirements

- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed

## Install

### From GitHub

```bash
claude plugins install --from-github uhyun/cc-plugin-viz
```

### From local clone

```bash
git clone https://github.com/uhyun/cc-plugin-viz.git
claude plugins install ./cc-plugin-viz
```

> **Scope options:** Add `--scope project` to install for a specific project only, or omit for global (user) scope.

## Usage

Once installed, open any Claude Code conversation and type:

```
/viz
```

This starts a local server and opens the dashboard at http://127.0.0.1:3333.

### Custom port

If port 3333 is in use, Claude will use:

```bash
PORT=3334 node <plugin-root>/server/index.js
```

### Run without installing

You can also run the dashboard standalone:

```bash
git clone https://github.com/uhyun/cc-plugin-viz.git
cd cc-plugin-viz
node server/index.js
```

## Development

```bash
git clone https://github.com/uhyun/cc-plugin-viz.git
cd cc-plugin-viz

# Run tests
npm test

# Start dev server
npm start
```

### Architecture

Zero external dependencies. Built entirely with Node.js built-in modules and vanilla JS.

```
server/
  index.js          # HTTP server, static file serving
  router.js         # URL pattern matching with params
  lib/
    paths.js        # Resolves ~/.claude/plugins/* paths
    reader.js       # Safe JSON file reader
    writer.js       # Atomic JSON writer with backup
  routes/
    plugins.js      # CRUD for installed plugins
    marketplaces.js # Marketplace browsing
    settings.js     # Settings, blocklist, install counts
public/
  index.html        # App shell
  style.css         # Full stylesheet
  js/
    api.js          # Fetch wrapper for all endpoints
    app.js          # Router and state management
    components/     # Sidebar, plugin card, modal, badges
    views/          # Overview, by-scope, marketplace, blocklist, detail
skills/
  viz/SKILL.md      # Claude Code skill definition
tests/              # Node.js test runner (node:test)
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plugins` | List all installed plugins |
| GET | `/api/plugins/:id` | Plugin detail with skills/hooks/MCP |
| PATCH | `/api/plugins/:id/toggle` | Enable/disable a plugin |
| PATCH | `/api/plugins/:id/scope` | Change plugin scope |
| POST | `/api/plugins/install` | Install via claude CLI |
| DELETE | `/api/plugins/:id` | Uninstall via claude CLI |
| PUT | `/api/plugins/:id/config` | Edit plugin config |
| GET | `/api/marketplaces` | List registered marketplaces |
| GET | `/api/marketplaces/:name/plugins` | Browse marketplace plugins |
| GET | `/api/settings` | Read enabled plugins settings |
| GET | `/api/blocklist` | List blocked plugins |
| POST | `/api/blocklist/:id` | Add to blocklist |
| DELETE | `/api/blocklist/:id` | Remove from blocklist |
| GET | `/api/install-counts` | Plugin install counts |

## Marketplace Registration

To make this plugin discoverable in a Claude Code marketplace, add it to your marketplace's `marketplace.json`:

```json
{
  "plugins": [
    {
      "name": "cc-plugin-viz",
      "description": "Visual dashboard for managing Claude Code plugins",
      "version": "0.1.0",
      "source": "https://github.com/uhyun/cc-plugin-viz",
      "category": "development"
    }
  ]
}
```

## License

MIT
