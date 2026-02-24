---
name: viz
description: Launch the plugin visualization dashboard in your browser
---

Launch the cc-plugin-viz dashboard server and open it in the browser.

When the user invokes /viz, execute this command using the Bash tool:

```bash
node ${CLAUDE_PLUGIN_ROOT}/server/index.js
```

This starts a local HTTP server on port 3333 and automatically opens the dashboard in the default browser.

After running the command, tell the user:

> Dashboard running at http://127.0.0.1:3333
>
> Features:
> - **Overview** — see all installed plugins at a glance
> - **By Scope** — drag-and-drop plugins between user/project/local scopes
> - **Marketplace** — browse and install plugins from registered marketplaces
> - **Blocklist** — manage blocked plugins
>
> Click any plugin card for details, toggle switches to enable/disable, or use the search bar to filter.

If port 3333 is already in use, set a different port:

```bash
PORT=3334 node ${CLAUDE_PLUGIN_ROOT}/server/index.js
```
