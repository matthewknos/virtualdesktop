/**
 * Microsoft Graph mock — catch-all handler.
 * Rewrite: /api/mock/graph/:path* → /api/mock/graph
 *
 * Fidelity contract: see api/mock/API_GUIDE.md
 * Entity catalog:    see api/mock/_specs/graph/tier1.json
 */

import { randomUUID } from 'crypto';
import { resolveTenant, resolveActingUser } from './_lib/tenant.js';
import {
  graphCollection, graphSingle, GRAPH_ERRORS,
  responseHeaders, checkAuth, shouldThrottle, makeEtag,
  encodeNextLink, decodeSkipToken, corsHeaders,
} from './_lib/fidelity.js';
import { store } from './_lib/store.js';
import { applyODataQuery } from './_lib/odata-query.js';
import { getGraphRegistry, matchPath, extractPathParams } from './_lib/spec-loader.js';
import { validateBody, stripReadOnly, applyDefaults } from './_lib/validator.js';
import { seedGraph } from './_lib/seed/graph-projection.js';

const SYSTEM = 'graph';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return send(res, 204, '', corsHeaders());
  }

  const headers = { ...responseHeaders('graph'), ...corsHeaders() };

  // Auth
  if (!checkAuth(req)) {
    const err = GRAPH_ERRORS.unauthorized();
    return send(res, err.status, err.body, headers);
  }

  const tenant = resolveTenant(req);
  const actingUserId = resolveActingUser(req, tenant);

  // Seed on first request
  try {
    await seedGraph(tenant);
  } catch (e) {
    console.error('Graph seed error:', e);
    const err = GRAPH_ERRORS.internalError();
    return send(res, err.status, err.body, headers);
  }

  // Throttle check
  const settings = await store.getSettings(SYSTEM, tenant);
  if (shouldThrottle(settings)) {
    const retryAfter = settings.throttle?.retryAfterSeconds ?? 5;
    const err = GRAPH_ERRORS.tooManyRequests(retryAfter);
    headers['Retry-After'] = String(retryAfter);
    return send(res, 429, err.body, headers);
  }

  // Extract path (strip /api/mock/graph prefix)
  const url = new URL(req.url, 'http://localhost');
  const rawPath = url.pathname.replace(/^\/api\/mock\/graph/, '') || '/';
  const params = Object.fromEntries(url.searchParams.entries());

  // Tenant management routes
  if (rawPath === '/_tenant' || rawPath.startsWith('/_tenant/')) {
    return handleTenantAdmin(req, res, rawPath, tenant, headers, settings);
  }

  // Route matching
  const registry = getGraphRegistry();
  const match = matchPath(registry, rawPath, req.method);

  if (!match) {
    // Check if path exists but method not allowed
    const anyMatch = matchPath(registry, rawPath, 'GET') || matchPath(registry, rawPath, 'POST');
    if (anyMatch) {
      const err = GRAPH_ERRORS.methodNotAllowed(req.method);
      return send(res, 405, err.body, headers);
    }
    const err = GRAPH_ERRORS.notFound(rawPath);
    return send(res, 404, err.body, headers);
  }

  // Action handlers
  if (match.relation === 'action') {
    return handleAction(req, res, match, rawPath, params, tenant, actingUserId, headers);
  }

  // Resolve acting user for /me paths
  const meId = actingUserId ?? (await getFirstUserId(tenant));

  // Substitute /me → actual user ID in entity resolution
  const resolvedPathParams = { ...match.pathParams };
  if (rawPath.startsWith('/v1.0/me')) {
    resolvedPathParams.userId = meId;
  }

  // Dispatch to generic CRUD
  return handleCRUD(req, res, match, resolvedPathParams, params, tenant, meId, rawPath, headers);
}

// ── Generic CRUD ───────────────────────────────────────────────────────────

async function handleCRUD(req, res, match, pathParams, params, tenant, meId, rawPath, headers) {
  const { entityName, entityDef, relation } = match;

  // Per-user collections (mail, events, etc.) use user-scoped store keys
  const storeType = resolveStoreType(entityName, pathParams, rawPath);

  switch (req.method) {
    case 'GET': {
      if (match.navigationName === 'manager') {
        const userId = pathParams.userId ?? meId;
        const user = await store.getEntity(SYSTEM, tenant, 'user', userId);
        if (!user?._managerId) {
          const err = GRAPH_ERRORS.notFound('manager');
          return send(res, 404, err.body, headers);
        }
        const manager = await store.getEntity(SYSTEM, tenant, 'user', user._managerId);
        if (!manager) { const err = GRAPH_ERRORS.notFound('manager'); return send(res, 404, err.body, headers); }
        const etag = makeEtag(manager);
        return send(res, 200, graphSingle(manager), { ...headers, ETag: etag });
      }

      if (relation === 'me') {
        const user = await store.getEntity(SYSTEM, tenant, 'user', meId);
        if (!user) { const err = GRAPH_ERRORS.notFound('me'); return send(res, 404, err.body, headers); }
        const etag = makeEtag(user);
        return send(res, 200, graphSingle(user), { ...headers, ETag: etag });
      }

      if (relation === 'single') {
        const id = resolveId(pathParams, entityDef);
        // Allow lookup by UPN for users
        let entity = await store.getEntity(SYSTEM, tenant, storeType, id);
        if (!entity && entityName === 'user') {
          entity = await findUserByUPN(tenant, id);
        }
        if (!entity) { const err = GRAPH_ERRORS.notFound(`${entityName} '${id}'`); return send(res, 404, err.body, headers); }
        const etag = makeEtag(entity);
        return send(res, 200, graphSingle(entity), { ...headers, ETag: etag });
      }

      if (relation === 'view') {
        // calendarView requires startDateTime/endDateTime
        const start = params.startDateTime;
        const end   = params.endDateTime;
        if (!start || !end) {
          const err = GRAPH_ERRORS.badRequest("'startDateTime' and 'endDateTime' are required for calendarView.");
          return send(res, 400, err.body, headers);
        }
        let items = await store.listEntities(SYSTEM, tenant, storeType);
        items = items.filter(e => {
          const es = e.start?.dateTime ?? '';
          const ee = e.end?.dateTime ?? '';
          return es >= start && ee <= end;
        });
        const { items: page, count, nextLink } = applyODataQuery(items, params, entityDef);
        const context = `https://graph.microsoft.com/v1.0/$metadata#Collection(microsoft.graph.event)`;
        const nl = nextLink ? encodeNextLink(`${req.url.split('?')[0]}`, nextLink.skip, nextLink.top) : null;
        return send(res, 200, graphCollection(page, { context, nextLink: nl, count: params.$count === 'true' ? count : null }), headers);
      }

      // Collection
      let items = await store.listEntities(SYSTEM, tenant, storeType);

      // Navigation property filtering (e.g. /users/{id}/directReports)
      if (match.navigationFor && match.navigationName) {
        items = await resolveNavigation(tenant, match.navigationFor, match.navigationName, pathParams, items);
      }

      // Filter per-user collections to the right owner
      const ownerId = pathParams.userId ?? meId;
      if (entityDef && isUserOwned(entityName)) {
        items = items.filter(i => !i._ownerId || i._ownerId === ownerId);
      }

      // skiptoken (pagination cursor)
      if (params.$skiptoken) {
        const decoded = decodeSkipToken(params.$skiptoken);
        if (decoded) { params.$skip = decoded.skip; params.$top = decoded.top; }
      }

      const { items: page, count, nextLink } = applyODataQuery(items, params, entityDef);
      const context = `https://graph.microsoft.com/v1.0/$metadata#${entityName}`;
      const nl = nextLink ? encodeNextLink(`${req.url.split('?')[0]}`, nextLink.skip, nextLink.top) : null;
      return send(res, 200, graphCollection(page, { context, nextLink: nl, count: params.$count === 'true' ? count : null }), headers);
    }

    case 'POST': {
      let body = await parseBody(req);
      if (!body) body = {};
      const errors = validateBody(body, entityDef ?? {}, 'create');
      if (errors.length) {
        const err = GRAPH_ERRORS.badRequest(errors.map(e => e.message).join(' '));
        return send(res, 400, err.body, headers);
      }
      const cleaned = stripReadOnly(body, entityDef ?? {});
      const withDefaults = applyDefaults(cleaned, entityDef ?? {}, 'create');
      const now = new Date().toISOString();
      const newEntity = {
        id: randomUUID(),
        ...withDefaults,
        createdDateTime: now,
        lastModifiedDateTime: now,
        _ownerId: pathParams.userId ?? meId,
      };
      // Auto-populate sender for chat messages
      if (entityName === 'chatMessage' && meId) {
        const sender = await store.getEntity(SYSTEM, tenant, 'user', meId);
        if (sender) {
          newEntity.from = { user: { id: sender.id, displayName: sender.displayName } };
        }
      }
      await store.setEntity(SYSTEM, tenant, storeType, newEntity.id, newEntity);
      return send(res, 201, graphSingle(newEntity), headers);
    }

    case 'PATCH': {
      const id = resolveId(pathParams, entityDef);
      const existing = await store.getEntity(SYSTEM, tenant, storeType, id);
      if (!existing) { const err = GRAPH_ERRORS.notFound(`${entityName} '${id}'`); return send(res, 404, err.body, headers); }
      // ETag check
      const ifMatch = req.headers['if-match'];
      if (ifMatch && ifMatch !== '*' && ifMatch !== makeEtag(existing)) {
        const err = GRAPH_ERRORS.preconditionFailed();
        return send(res, 412, err.body, headers);
      }
      let body = await parseBody(req);
      if (!body) body = {};
      const cleaned = stripReadOnly(body, entityDef ?? {});
      const updated = { ...existing, ...cleaned, lastModifiedDateTime: new Date().toISOString() };
      await store.setEntity(SYSTEM, tenant, storeType, id, updated);
      return send(res, 200, graphSingle(updated), headers);
    }

    case 'DELETE': {
      const id = resolveId(pathParams, entityDef);
      const existing = await store.getEntity(SYSTEM, tenant, storeType, id);
      if (!existing) { const err = GRAPH_ERRORS.notFound(`${entityName} '${id}'`); return send(res, 404, err.body, headers); }
      await store.deleteEntity(SYSTEM, tenant, storeType, id);
      return send(res, 204, '', headers);
    }

    default: {
      const err = GRAPH_ERRORS.methodNotAllowed(req.method);
      return send(res, 405, err.body, headers);
    }
  }
}

// ── Action handlers ────────────────────────────────────────────────────────

async function handleAction(req, res, match, rawPath, params, tenant, actingUserId, headers) {
  const meId = actingUserId ?? (await getFirstUserId(tenant));
  const body = await parseBody(req) ?? {};
  const pathParams = match.pathParams ?? {};

  switch (match.actionHandler) {
    case 'send-mail': {
      const { message, saveToSentItems = true } = body;
      if (!message?.subject) {
        const err = GRAPH_ERRORS.badRequest("'message.subject' is required for sendMail.");
        return send(res, 400, err.body, headers);
      }
      const sender = await store.getEntity(SYSTEM, tenant, 'user', meId);
      const now = new Date().toISOString();
      const msgId = randomUUID();
      const outMsg = {
        id: msgId,
        subject: message.subject,
        bodyPreview: (message.body?.content ?? '').slice(0, 255),
        body: message.body ?? { contentType: 'text', content: '' },
        from: { emailAddress: { name: sender?.displayName ?? 'Sender', address: sender?.mail ?? '' } },
        toRecipients: message.toRecipients ?? [],
        ccRecipients: message.ccRecipients ?? [],
        bccRecipients: message.bccRecipients ?? [],
        isRead: false,
        isDraft: false,
        importance: message.importance ?? 'normal',
        hasAttachments: false,
        receivedDateTime: now,
        sentDateTime: now,
        createdDateTime: now,
        lastModifiedDateTime: now,
        conversationId: randomUUID(),
        internetMessageId: `<${randomUUID()}@mock.local>`,
        parentFolderId: null,
      };
      // Deliver to each recipient in the tenant
      const allUsers = await store.listEntities(SYSTEM, tenant, 'user');
      const recipients = [...(message.toRecipients ?? []), ...(message.ccRecipients ?? [])];
      for (const r of recipients) {
        const addr = r.emailAddress?.address;
        const user = allUsers.find(u => u.mail === addr || u.userPrincipalName === addr);
        if (user) {
          const inbox = { ...outMsg, id: randomUUID(), _ownerId: user.id };
          await store.setEntity(SYSTEM, tenant, `message:${user.id}`, inbox.id, inbox);
        }
      }
      // Save to sender's Sent Items
      if (saveToSentItems) {
        const sent = { ...outMsg, _ownerId: meId, parentFolderId: `${meId}:folder:SentItems` };
        await store.setEntity(SYSTEM, tenant, `message:${meId}`, sent.id, sent);
      }
      return send(res, 202, '', headers);
    }

    case 'message-reply':
    case 'message-reply-all':
    case 'message-forward': {
      // Stub — mark 202 Accepted
      return send(res, 202, '', headers);
    }

    case 'message-move': {
      const msgId = pathParams.messageId;
      const userId = pathParams.userId ?? meId;
      const existing = await store.getEntity(SYSTEM, tenant, `message:${userId}`, msgId);
      if (!existing) { const err = GRAPH_ERRORS.notFound(`message '${msgId}'`); return send(res, 404, err.body, headers); }
      const updated = { ...existing, parentFolderId: body.destinationId ?? existing.parentFolderId };
      await store.setEntity(SYSTEM, tenant, `message:${userId}`, msgId, updated);
      return send(res, 200, graphSingle(updated), headers);
    }

    case 'event-accept':
    case 'event-decline':
    case 'event-tentative': {
      const eventId = pathParams.eventId;
      const userId = pathParams.userId ?? meId;
      const existing = await store.getEntity(SYSTEM, tenant, `event:${userId}`, eventId);
      if (!existing) { const err = GRAPH_ERRORS.notFound(`event '${eventId}'`); return send(res, 404, err.body, headers); }
      const responseMap = { 'event-accept': 'accepted', 'event-decline': 'declined', 'event-tentative': 'tentativelyAccepted' };
      const updated = { ...existing, responseStatus: { response: responseMap[match.actionHandler], time: new Date().toISOString() } };
      await store.setEntity(SYSTEM, tenant, `event:${userId}`, eventId, updated);
      return send(res, 202, '', headers);
    }

    default: {
      const err = GRAPH_ERRORS.notImplemented(match.actionHandler ?? 'unknown action');
      return send(res, 501, err.body, headers);
    }
  }
}

// ── Tenant admin ───────────────────────────────────────────────────────────

async function handleTenantAdmin(req, res, rawPath, tenant, headers, settings) {
  const parts = rawPath.split('/').filter(Boolean); // ['_tenant', tenant?, 'action?']
  const targetTenant = parts[1] ?? tenant;

  if (req.method === 'DELETE' && parts[1]) {
    await store.resetTenant(SYSTEM, targetTenant);
    return send(res, 200, { message: `Tenant '${targetTenant}' reset.` }, headers);
  }
  if (req.method === 'GET' && parts[2] === 'export') {
    const data = await store.exportTenant(SYSTEM, targetTenant);
    return send(res, 200, data, headers);
  }
  if (req.method === 'POST' && parts[2] === 'import') {
    const body = await parseBody(req) ?? {};
    await store.importTenant(SYSTEM, targetTenant, body);
    return send(res, 200, { message: 'Imported.' }, headers);
  }
  if (req.method === 'POST' && parts[2] === 'settings') {
    const body = await parseBody(req) ?? {};
    await store.updateSettings(SYSTEM, targetTenant, body);
    return send(res, 200, { message: 'Settings updated.' }, headers);
  }
  const err = GRAPH_ERRORS.notFound(rawPath);
  return send(res, 404, err.body, headers);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveId(pathParams, entityDef) {
  const idField = entityDef?.idField ?? 'id';
  // Pick the last path param value (most specific ID)
  const vals = Object.values(pathParams);
  return vals[vals.length - 1];
}

function resolveStoreType(entityName, pathParams, rawPath) {
  // Per-user collections use scoped store keys
  if (isUserOwned(entityName)) {
    const userId = pathParams.userId ?? pathParams.ownerId;
    if (userId) return `${entityName}:${userId}`;
  }
  // Channel messages scoped to channel
  if (entityName === 'chatMessage' && pathParams.channelId) {
    return `chatMessage:channel:${pathParams.channelId}`;
  }
  if (entityName === 'chatMessage' && pathParams.chatId) {
    return `chatMessage:chat:${pathParams.chatId}`;
  }
  if (entityName === 'channel' && pathParams.teamId) {
    return `channel:${pathParams.teamId}`;
  }
  if (entityName === 'mailFolder' && pathParams.userId) {
    return `mailFolder:${pathParams.userId}`;
  }
  return entityName;
}

function isUserOwned(entityName) {
  return ['message', 'event', 'mailFolder'].includes(entityName);
}

async function getFirstUserId(tenant) {
  const users = await store.listEntities(SYSTEM, tenant, 'user');
  return users[0]?.id ?? 'unknown';
}

async function findUserByUPN(tenant, upn) {
  const users = await store.listEntities(SYSTEM, tenant, 'user');
  return users.find(u => u.userPrincipalName === upn || u.mail === upn) ?? null;
}

async function resolveNavigation(tenant, forEntity, navName, pathParams, allItems) {
  const parentId = Object.values(pathParams)[0];
  if (navName === 'directReports') {
    const all = await store.listEntities(SYSTEM, tenant, 'user');
    return all.filter(u => u._managerId === parentId || (allItems.some && false));
  }
  if (navName === 'members') {
    const group = await store.getEntity(SYSTEM, tenant, 'group', parentId)
      ?? await store.getEntity(SYSTEM, tenant, 'team', parentId);
    if (!group?._memberIds) return [];
    const all = await store.listEntities(SYSTEM, tenant, 'user');
    return all.filter(u => group._memberIds.includes(u.id));
  }
  return allItems;
}

async function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) { resolve(null); return; }
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  const finalHeaders = { ...headers };
  if (json) finalHeaders['Content-Length'] = Buffer.byteLength(json).toString();
  res.writeHead(status, finalHeaders);
  res.end(json || '');
}
