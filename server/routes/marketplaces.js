export function registerMarketplaceRoutes(router, paths) {
  router.get('/api/marketplaces', async ({ sendJSON }) => {
    sendJSON(200, { ok: true, data: [] });
  });
}
