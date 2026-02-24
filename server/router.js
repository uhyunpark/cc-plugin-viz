export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    // Convert /api/plugins/:id/toggle to regex
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    this.routes.push({
      method,
      regex: new RegExp(`^${regexStr}$`),
      paramNames,
      handler,
    });
  }

  get(pattern, handler) { this.add('GET', pattern, handler); }
  post(pattern, handler) { this.add('POST', pattern, handler); }
  patch(pattern, handler) { this.add('PATCH', pattern, handler); }
  put(pattern, handler) { this.add('PUT', pattern, handler); }
  delete(pattern, handler) { this.add('DELETE', pattern, handler); }

  match(method, url) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = url.match(route.regex);
      if (match) {
        const params = {};
        route.paramNames.forEach((name, i) => {
          params[name] = decodeURIComponent(match[i + 1]);
        });
        return { handler: route.handler, params };
      }
    }
    return null;
  }
}
