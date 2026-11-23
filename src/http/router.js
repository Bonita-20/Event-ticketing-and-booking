/**
 * Compiles a route pattern like "/api/events/:eventId/tiers/:tierId"
 * into a segment matcher and list of parameter names.
 */
function compilePattern(pattern) {
  const cleanPattern = pattern === '/' ? '/' : pattern.replace(/\/+$/, '');
  const parts = cleanPattern === '/' ? [] : cleanPattern.slice(1).split('/');
  const paramNames = [];

  const regexParts = parts.map((part) => {
    if (part.startsWith(':')) {
      const name = part.slice(1);
      paramNames.push(name);
      return '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });

  const regex = new RegExp(`^/${regexParts.join('/')}$`);
  return { regex, paramNames };
}

export class Router {
  #routes = [];

  register(method, pattern, handler) {
    const upperMethod = method.toUpperCase();
    const { regex, paramNames } = compilePattern(pattern);
    this.#routes.push({
      method: upperMethod,
      pattern,
      regex,
      paramNames,
      handler,
    });
    return this;
  }

  get(pattern, handler) {
    return this.register('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.register('POST', pattern, handler);
  }

  patch(pattern, handler) {
    return this.register('PATCH', pattern, handler);
  }

  put(pattern, handler) {
    return this.register('PUT', pattern, handler);
  }

  delete(pattern, handler) {
    return this.register('DELETE', pattern, handler);
  }

  /**
   * Matches an HTTP method and pathname against registered routes.
   * Returns { handler, params } or null if no route matches.
   */
  match(method, pathname) {
    const upperMethod = method.toUpperCase();
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');

    for (const route of this.#routes) {
      if (route.method !== upperMethod) continue;

      const match = cleanPath.match(route.regex);
      if (!match) continue;

      const params = {};
      route.paramNames.forEach((name, idx) => {
        params[name] = decodeURIComponent(match[idx + 1]);
      });

      return { handler: route.handler, params };
    }

    return null;
  }
}