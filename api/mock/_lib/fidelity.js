import { randomUUID } from 'crypto';

// ── Graph response helpers ─────────────────────────────────────────────────

export function graphCollection(items, opts = {}) {
  const { context = '', nextLink = null, count = null } = opts;
  const envelope = { value: items };
  if (context) envelope['@odata.context'] = context;
  if (nextLink) envelope['@odata.nextLink'] = nextLink;
  if (count !== null) envelope['@odata.count'] = count;
  return envelope;
}

export function graphSingle(item, context = '') {
  if (context) return { '@odata.context': context, ...item };
  return item;
}

export function graphError(code, message, status = 400) {
  return {
    status,
    body: {
      error: {
        code,
        message,
        innerError: {
          date: new Date().toISOString(),
          'request-id': randomUUID(),
          'client-request-id': randomUUID(),
        },
      },
    },
  };
}

export const GRAPH_ERRORS = {
  badRequest: (msg) => graphError('BadRequest', msg, 400),
  unauthorized: () => graphError('Unauthorized', 'Access token is missing or invalid.', 401),
  forbidden: (msg = 'Access denied.') => graphError('Forbidden', msg, 403),
  notFound: (resource) => graphError('Request_ResourceNotFound', `Resource '${resource}' does not exist or one of its queried reference-property objects are not present.`, 404),
  methodNotAllowed: (method) => graphError('Request_BadRequest', `The HTTP method '${method}' is not supported for this request.`, 405),
  conflict: (msg) => graphError('Request_InvalidOperation', msg, 409),
  preconditionFailed: () => graphError('PreconditionFailed', 'ETag does not match.', 412),
  tooManyRequests: (retryAfter = 5) => ({ ...graphError('TooManyRequests', `Request was throttled. Retry after ${retryAfter} seconds.`, 429), retryAfter }),
  notImplemented: (feature) => graphError('NotImplemented', `'${feature}' is not implemented in this mock.`, 501),
  internalError: () => graphError('InternalServerError', 'An unexpected condition was encountered.', 500),
};

// ── Workday response helpers ───────────────────────────────────────────────

export function workdayCollection(items, opts = {}) {
  const { total = null, offset = 0 } = opts;
  return { data: items, total: total ?? items.length };
}

export function workdaySingle(item) {
  return item;
}

export function workdayError(code, message, details = [], status = 400) {
  return {
    status,
    body: { error: message, code, details },
  };
}

export const WORKDAY_ERRORS = {
  badRequest: (msg, details = []) => workdayError('INVALID_REQUEST', msg, details, 400),
  unauthorized: () => workdayError('UNAUTHORIZED', 'Authentication required.', [], 401),
  forbidden: () => workdayError('FORBIDDEN', 'Access denied.', [], 403),
  notFound: (resource) => workdayError('NOT_FOUND', `${resource} not found.`, [], 404),
  conflict: (msg) => workdayError('CONFLICT', msg, [], 409),
  rateLimited: (retryAfter = 5) => ({ ...workdayError('RATE_LIMITED', `Too many requests. Retry after ${retryAfter} seconds.`, [], 429), retryAfter }),
  internalError: () => workdayError('INTERNAL_ERROR', 'An unexpected error occurred.', [], 500),
};

// ── Response headers ───────────────────────────────────────────────────────

export function responseHeaders(system = 'graph') {
  const reqId = randomUUID();
  return {
    'Content-Type': 'application/json',
    'request-id': reqId,
    'client-request-id': reqId,
    ...(system === 'graph' ? { 'OData-Version': '4.0' } : {}),
    'X-Mock-Platform': 'coe-prototypes',
  };
}

// ── Auth check ─────────────────────────────────────────────────────────────

export function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.toLowerCase().startsWith('bearer ') || auth.length < 8) {
    return false;
  }
  return true; // accept any bearer token
}

// ── Throttle ───────────────────────────────────────────────────────────────

export function shouldThrottle(settings) {
  if (!settings?.throttle?.enabled) return false;
  const rate = settings.throttle.rate ?? 0.1;
  return Math.random() < rate;
}

// ── ETag ───────────────────────────────────────────────────────────────────

export function makeEtag(item) {
  const str = JSON.stringify(item) + (item.lastModifiedDateTime || '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return `W/"${(h >>> 0).toString(16)}"`;
}

// ── Pagination token ───────────────────────────────────────────────────────

export function encodeNextLink(baseUrl, skip, top) {
  const token = Buffer.from(JSON.stringify({ skip, top })).toString('base64url');
  return `${baseUrl}?$skiptoken=${token}`;
}

export function decodeSkipToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString());
  } catch {
    return null;
  }
}

// ── CORS ──────────────────────────────────────────────────────────────────

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Mock-Tenant, X-Mock-User-Id, If-Match',
  };
}
