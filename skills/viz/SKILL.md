---
name: viz
description: Launch the plugin visualization dashboard in your browser
---

Launch the cc-plugin-viz dashboard server and open it in the browser.

When the user invokes /viz, run:

```bash
node ${CLAUDE_PLUGIN_ROOT}/server/index.js
```

This starts a local HTTP server and opens the dashboard at http://localhost:3333.
Print the URL so the user can re-open it.
