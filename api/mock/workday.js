/**
 * Workday REST API v1 mock — catch-all handler.
 * Rewrite: /api/mock/workday/:path* → /api/mock/workday
 *
 * Also handles RaaS: /api/mock/workday/ccx/service/customreport2/{tenant}/{report}
 */

import { randomUUID } from 'crypto';
import { resolveTenant } from './_lib/tenant.js';
import {
  workdayCollection, workdaySingle, WORKDAY_ERRORS,
  responseHeaders, checkAuth, shouldThrottle, corsHeaders,
} from './_lib/fidelity.js';
import { store } from './_lib/store.js';
import { applyWorkdayQuery } from './_lib/odata-query.js';
import { getWorkdayRegistry, matchPath, getRaasReports } from './_lib/spec-loader.js';
import { validateBody, stripReadOnly, applyDefaults } from './_lib/validator.js';
import { seedWorkday } from './_lib/seed/workday-projection.js';
import { onAbsenceApproved } from './_lib/effects/index.js';

const SYSTEM = 'workday';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '', corsHeaders());
  }

  const headers = { ...responseHeaders('workday'), ...corsHeaders() };

  if (!checkAuth(req)) {
    const err = WORKDAY_ERRORS.unauthorized();
    return send(res, err.status, err.body, headers);
  }

  const tenant = resolveTenant(req);

  try {
    await seedWorkday(tenant);
  } catch (e) {
    console.error('Workday seed error:', e);
    const err = WORKDAY_ERRORS.internalError();
    return send(res, err.status, err.body, headers);
  }

  const settings = await store.getSettings(SYSTEM, tenant);
  if (shouldThrottle(settings)) {
    const retryAfter = settings.throttle?.retryAfterSeconds ?? 5;
    const err = WORKDAY_ERRORS.rateLimited(retryAfter);
    headers['Retry-After'] = String(retryAfter);
    return send(res, 429, err.body, headers);
  }

  const url = new URL(req.url, 'http://localhost');
  const rawPath = url.pathname.replace(/^\/api\/mock\/workday/, '') || '/';
  const params = Object.fromEntries(url.searchParams.entries());

  // Tenant admin
  if (rawPath === '/_tenant' || rawPath.startsWith('/_tenant/')) {
    return handleTenantAdmin(req, res, rawPath, tenant, headers);
  }

  // RaaS reports
  const raasMatch = rawPath.match(/^\/ccx\/service\/customreport2\/([^/]+)\/([^/?]+)/);
  if (raasMatch) {
    return handleRaaS(req, res, raasMatch[1], raasMatch[2], params, tenant, headers);
  }

  const registry = getWorkdayRegistry();
  const match = matchPath(registry, rawPath, req.method);

  if (!match) {
    const anyMatch = matchPath(registry, rawPath, 'GET');
    if (anyMatch) {
      const err = WORKDAY_ERRORS.badRequest(`Method ${req.method} not allowed.`);
      return send(res, 405, err.body, headers);
    }
    const err = WORKDAY_ERRORS.notFound(rawPath);
    return send(res, 404, err.body, headers);
  }

  if (match.relation === 'action') {
    return handleAction(req, res, match, rawPath, params, tenant, headers);
  }

  return handleCRUD(req, res, match, match.pathParams ?? {}, params, tenant, rawPath, headers);
}

// ── Generic CRUD ───────────────────────────────────────────────────────────

async function handleCRUD(req, res, match, pathParams, params, tenant, rawPath, headers) {
  const { entityName, entityDef, relation } = match;
  const storeType = resolveStoreType(entityName, pathParams);

  switch (req.method) {
    case 'GET': {
      if (relation === 'single') {
        const id = resolveId(pathParams, entityDef);
        const entity = await store.getEntity(SYSTEM, tenant, storeType, id);
        if (!entity) { const err = WORKDAY_ERRORS.notFound(`${entityName} '${id}'`); return send(res, 404, err.body, headers); }
        return send(res, 200, workdaySingle(withHref(entity, rawPath)), headers);
      }

      let items = await store.listEntities(SYSTEM, tenant, storeType);

      // Parent filter for nested resources
      const parentId = resolveParentId(pathParams, match);
      if (parentId) {
        items = items.filter(i => i._workerId === parentId || i._ownerId === parentId);
      }

      const entityQueryDef = buildQueryDef(entityName, entityDef);
      const { items: page, total, hasMore } = applyWorkdayQuery(items, params, entityQueryDef);
      return send(res, 200, workdayCollection(page.map(i => withHref(i, rawPath)), { total }), headers);
    }

    case 'POST': {
      let body = await parseBody(req);
      if (!body) body = {};
      const errors = validateBody(body, entityDef ?? {}, 'create');
      if (errors.length) {
        const err = WORKDAY_ERRORS.badRequest('Validation failed.', errors);
        return send(res, 400, err.body, headers);
      }
      const cleaned = stripReadOnly(body, entityDef ?? {});
      const withDefaults2 = applyDefaults(cleaned, entityDef ?? {}, 'create');
      const parentId = resolveParentId(pathParams, match);
      const wid = makeWID();
      const now = new Date().toISOString();
      const newEntity = {
        id: wid,
        descriptor: buildDescriptor(entityName, withDefaults2, wid),
        href: `${rawPath}/${wid}`,
        ...withDefaults2,
        lastModifiedDateTime: now,
        createdDateTime: now,
        ...(parentId ? { _workerId: parentId } : {}),
      };
      await store.setEntity(SYSTEM, tenant, storeType, wid, newEntity);
      return send(res, 201, workdaySingle(newEntity), headers);
    }

    case 'PATCH': {
      const id = resolveId(pathParams, entityDef);
      const existing = await store.getEntity(SYSTEM, tenant, storeType, id);
      if (!existing) { const err = WORKDAY_ERRORS.notFound(`${entityName} '${id}'`); return send(res, 404, err.body, headers); }
      let body = await parseBody(req);
      if (!body) body = {};
      const cleaned = stripReadOnly(body, entityDef ?? {});
      const updated = { ...existing, ...cleaned, lastModifiedDateTime: new Date().toISOString() };
      await store.setEntity(SYSTEM, tenant, storeType, id, updated);
      return send(res, 200, workdaySingle(updated), headers);
    }

    case 'DELETE': {
      const id = resolveId(pathParams, entityDef);
      const existing = await store.getEntity(SYSTEM, tenant, storeType, id);
      if (!existing) { const err = WORKDAY_ERRORS.notFound(`${entityName} '${id}'`); return send(res, 404, err.body, headers); }
      await store.deleteEntity(SYSTEM, tenant, storeType, id);
      return send(res, 204, '', headers);
    }

    default: {
      const err = WORKDAY_ERRORS.badRequest(`Method ${req.method} not allowed.`);
      return send(res, 405, err.body, headers);
    }
  }
}

// ── Action handlers ────────────────────────────────────────────────────────

async function handleAction(req, res, match, rawPath, params, tenant, headers) {
  const body = await parseBody(req) ?? {};
  const pathParams = match.pathParams ?? {};
  const now = new Date().toISOString();

  switch (match.actionHandler) {
    case 'time-entry-submit': {
      const { workerId, entryId } = pathParams;
      const entry = await store.getEntity(SYSTEM, tenant, `timeEntry:${workerId}`, entryId);
      if (!entry) { const err = WORKDAY_ERRORS.notFound(`timeEntry '${entryId}'`); return send(res, 404, err.body, headers); }
      if (entry.status === 'Approved') {
        const err = WORKDAY_ERRORS.conflict('Time entry is already approved.');
        return send(res, 409, err.body, headers);
      }
      const updated = { ...entry, status: 'Submitted', submittedDateTime: now, lastModifiedDateTime: now };
      await store.setEntity(SYSTEM, tenant, `timeEntry:${workerId}`, entryId, updated);
      return send(res, 200, workdaySingle(updated), headers);
    }

    case 'timesheet-submit': {
      const { workerId, sheetId } = pathParams;
      const sheet = await store.getEntity(SYSTEM, tenant, `timesheet:${workerId}`, sheetId);
      if (!sheet) { const err = WORKDAY_ERRORS.notFound(`timesheet '${sheetId}'`); return send(res, 404, err.body, headers); }
      const updated = { ...sheet, status: 'Submitted', lastModifiedDateTime: now };
      await store.setEntity(SYSTEM, tenant, `timesheet:${workerId}`, sheetId, updated);
      return send(res, 200, workdaySingle(updated), headers);
    }

    case 'absence-approve': {
      const { requestId } = pathParams;
      const req2 = await findAbsenceRequest(tenant, requestId);
      if (!req2) { const err = WORKDAY_ERRORS.notFound(`absenceRequest '${requestId}'`); return send(res, 404, err.body, headers); }
      if (!['Submitted','PendingApproval','Draft'].includes(req2.status)) {
        const err = WORKDAY_ERRORS.conflict(`Cannot approve a request with status '${req2.status}'.`);
        return send(res, 409, err.body, headers);
      }
      const updated = { ...req2, status: 'Approved', approvedDateTime: now, lastModifiedDateTime: now };
      await store.setEntity(SYSTEM, tenant, `absenceRequest:${req2._workerId}`, requestId, updated);
      // Deduct from PTO balance
      await deductPtoBalance(tenant, req2._workerId, req2.type?.id, req2.totalDays ?? 0);
      // Cross-system effect: create Graph OOF event + notify
      const worker = await store.getEntity(SYSTEM, tenant, 'worker', req2._workerId);
      if (worker) {
        await onAbsenceApproved(tenant, worker, updated);
      }
      return send(res, 200, workdaySingle(updated), headers);
    }

    case 'absence-deny': {
      const { requestId } = pathParams;
      const req2 = await findAbsenceRequest(tenant, requestId);
      if (!req2) { const err = WORKDAY_ERRORS.notFound(`absenceRequest '${requestId}'`); return send(res, 404, err.body, headers); }
      const updated = { ...req2, status: 'Denied', denialReason: body.reason ?? null, lastModifiedDateTime: now };
      await store.setEntity(SYSTEM, tenant, `absenceRequest:${req2._workerId}`, requestId, updated);
      return send(res, 200, workdaySingle(updated), headers);
    }

    case 'absence-cancel': {
      const { requestId } = pathParams;
      const req2 = await findAbsenceRequest(tenant, requestId);
      if (!req2) { const err = WORKDAY_ERRORS.notFound(`absenceRequest '${requestId}'`); return send(res, 404, err.body, headers); }
      if (req2.status === 'Approved') {
        // Restore balance
        await deductPtoBalance(tenant, req2._workerId, req2.type?.id, -(req2.totalDays ?? 0));
      }
      const updated = { ...req2, status: 'Cancelled', lastModifiedDateTime: now };
      await store.setEntity(SYSTEM, tenant, `absenceRequest:${req2._workerId}`, requestId, updated);
      return send(res, 200, workdaySingle(updated), headers);
    }

    default: {
      const err = WORKDAY_ERRORS.badRequest(`Action '${match.actionHandler}' not implemented.`);
      return send(res, 501, err.body, headers);
    }
  }
}

// ── RaaS ──────────────────────────────────────────────────────────────────

async function handleRaaS(req, res, reportTenant, reportName, params, tenant, headers) {
  const reports = getRaasReports();
  const reportDef = reports.find(r => r.name === reportName);

  if (!reportDef) {
    const err = WORKDAY_ERRORS.notFound(`Report '${reportName}'`);
    return send(res, 404, err.body, headers);
  }

  // Validate required params
  for (const p of reportDef.params) {
    if (p.required && !params[p.name]) {
      const err = WORKDAY_ERRORS.badRequest(`Required parameter '${p.name}' is missing.`);
      return send(res, 400, err.body, headers);
    }
  }

  let data = [];

  switch (reportName) {
    case 'Headcount_By_Department': {
      const workers = await store.listEntities(SYSTEM, tenant, 'worker');
      const byOrg = {};
      for (const w of workers) {
        const org = w.supervisoryOrganization?.descriptor ?? 'Unknown';
        if (!byOrg[org]) byOrg[org] = { org, orgId: w.supervisoryOrganization?.id, manager: null, managerId: null, headcount: 0 };
        byOrg[org].headcount++;
        if (!byOrg[org].manager && w.manager) {
          byOrg[org].manager = w.manager.descriptor;
          byOrg[org].managerId = w.manager.id;
        }
      }
      data = Object.values(byOrg);
      break;
    }

    case 'Timesheet_Compliance': {
      const startDate = params.Start_Date;
      const endDate = params.End_Date;
      const workers = await store.listEntities(SYSTEM, tenant, 'worker');
      data = [];
      for (const w of workers) {
        const entries = await store.listEntities(SYSTEM, tenant, `timeEntry:${w.id}`);
        const inRange = entries.filter(e => e.date >= startDate && e.date <= endDate);
        const missing = inRange.filter(e => e.status === 'Draft').length;
        if (missing > 0) {
          const last = inRange.filter(e => e.status !== 'Draft').sort((a,b) => b.date.localeCompare(a.date))[0];
          data.push({ workerId: w.id, workerName: w.descriptor, manager: w.manager?.descriptor ?? '', managerId: w.manager?.id ?? '', daysMissing: missing, lastSubmitted: last?.date ?? null });
        }
      }
      break;
    }

    case 'Absence_Liability': {
      const workers = await store.listEntities(SYSTEM, tenant, 'worker');
      data = [];
      for (const w of workers) {
        const balances = await store.listEntities(SYSTEM, tenant, `timeOffBalance:${w.id}`);
        const pto = balances.find(b => b.type?.id === 'ANNUAL_LEAVE');
        if (pto) {
          data.push({ workerId: w.id, workerName: w.descriptor, balanceDays: pto.balance, balanceHours: pto.balance * 8, liabilityUSD: Math.round(pto.balance * 350) });
        }
      }
      break;
    }

    case 'Probation_Due': {
      const daysAhead = parseInt(params.Days_Ahead ?? '30');
      const workers = await store.listEntities(SYSTEM, tenant, 'worker');
      const today = new Date();
      data = [];
      for (const w of workers) {
        const hire = new Date(w.hireDate);
        const probEnd = new Date(hire);
        probEnd.setMonth(probEnd.getMonth() + 3); // 3-month probation
        const diffDays = Math.floor((probEnd - today) / 86400000);
        if (diffDays >= 0 && diffDays <= daysAhead) {
          data.push({ workerId: w.id, workerName: w.descriptor, manager: w.manager?.descriptor ?? '', hireDate: w.hireDate, probationEndDate: probEnd.toISOString().split('T')[0], daysRemaining: diffDays });
        }
      }
      break;
    }

    default:
      data = [];
  }

  const format = params.format ?? 'json';
  if (format === 'csv') {
    if (data.length === 0) return send(res, 200, '', { ...headers, 'Content-Type': 'text/csv' });
    const cols = reportDef.columns;
    const csv = [cols.join(','), ...data.map(row => cols.map(c => JSON.stringify(row[c] ?? '')).join(','))].join('\n');
    return send(res, 200, csv, { ...headers, 'Content-Type': 'text/csv' });
  }

  return send(res, 200, { Report_Entry: data }, headers);
}

// ── Tenant admin ───────────────────────────────────────────────────────────

async function handleTenantAdmin(req, res, rawPath, tenant, headers) {
  const parts = rawPath.split('/').filter(Boolean);
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
  const err = WORKDAY_ERRORS.notFound(rawPath);
  return send(res, 404, err.body, headers);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveId(pathParams, entityDef) {
  const vals = Object.values(pathParams);
  return vals[vals.length - 1];
}

function resolveParentId(pathParams, match) {
  const parentParam = match.parentParam;
  if (parentParam && pathParams[parentParam]) return pathParams[parentParam];
  if (pathParams.workerId) return pathParams.workerId;
  return null;
}

function resolveStoreType(entityName, pathParams) {
  const parentId = pathParams.workerId ?? pathParams.orgId;
  if (parentId && ['timeEntry','timesheet','absenceRequest','timeOffBalance','compensation','position'].includes(entityName)) {
    return `${entityName}:${parentId}`;
  }
  return entityName;
}

function buildQueryDef(entityName, entityDef) {
  const datFields = { timeEntry: 'date', absenceRequest: 'startDate', timesheet: 'periodStart' };
  return { ...entityDef, dateField: datFields[entityName] };
}

function withHref(entity, basePath) {
  if (entity.href) return entity;
  return { ...entity, href: `${basePath}/${entity.id}` };
}

function buildDescriptor(entityName, body, id) {
  if (body.descriptor) return body.descriptor;
  if (body.date) return `Entry ${body.date}`;
  if (body.startDate) return `${entityName} ${body.startDate}`;
  return `${entityName} ${id.slice(0, 8)}`;
}

function makeWID() {
  return randomUUID().replace(/-/g, '').slice(0, 32);
}

async function findAbsenceRequest(tenant, requestId) {
  const workers = await store.listEntities(SYSTEM, tenant, 'worker');
  for (const w of workers) {
    const req = await store.getEntity(SYSTEM, tenant, `absenceRequest:${w.id}`, requestId);
    if (req) return req;
  }
  return null;
}

async function deductPtoBalance(tenant, workerId, typeId, days) {
  if (!typeId || !days) return;
  const balances = await store.listEntities(SYSTEM, tenant, `timeOffBalance:${workerId}`);
  const bal = balances.find(b => b.type?.id === typeId);
  if (!bal) return;
  const updated = { ...bal, balance: bal.balance - days, taken: (bal.taken ?? 0) + days };
  await store.setEntity(SYSTEM, tenant, `timeOffBalance:${workerId}`, bal.id, updated);
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
