export function registerSettingsRoutes(router, paths) {
  router.get('/api/settings', async ({ sendJSON }) => {
    sendJSON(200, { ok: true, data: {} });
  });
}
