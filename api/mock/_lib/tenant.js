/**
 * Tenant resolution. Every request runs against an isolated state slice.
 * Priority: X-Mock-Tenant header > ?tenant= query param > 'dev' default.
 */
export function resolveTenant(req) {
  const fromHeader = req.headers['x-mock-tenant'];
  if (fromHeader && /^[a-z0-9-_]{1,64}$/.test(fromHeader)) return fromHeader;

  const url = new URL(req.url, 'http://localhost');
  const fromQuery = url.searchParams.get('tenant');
  if (fromQuery && /^[a-z0-9-_]{1,64}$/.test(fromQuery)) return fromQuery;

  return 'dev';
}

export function resolveActingUser(req, tenant) {
  const fromHeader = req.headers['x-mock-user-id'];
  if (fromHeader) return fromHeader;
  return null; // graph.js falls back to first seeded user
}
