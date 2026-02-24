export function registerPluginRoutes(router, paths) {
  router.get('/api/plugins', async ({ sendJSON }) => {
    sendJSON(200, { ok: true, data: [] });
  });
}
