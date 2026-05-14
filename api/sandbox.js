/**
 * CoE Sandbox API — shared mock backend for agent testing and demos.
 *
 * Two scenario sources:
 *   1. SCENARIOS array below — curated, hardcoded, dev-maintained.
 *   2. Vercel KV — user-created scenarios via the self-serve form at /sandbox/new.
 *
 * Routes:
 *   GET    /api/sandbox/scenarios                  → list seeded + user-created
 *   POST   /api/sandbox/scenarios                  → create user scenario (returns id + deleteToken)
 *   GET    /api/sandbox/scenarios/:id              → one scenario (no deleteToken)
 *   DELETE /api/sandbox/scenarios/:id              → delete user scenario (requires deleteToken)
 *   GET    /api/sandbox/scenarios/:id/state        → current mutable state
 *   POST   /api/sandbox/scenarios/:id/state        → merge updates into state
 *   DELETE /api/sandbox/scenarios/:id/state        → reset to initialState
 *   GET    /api/sandbox/scenarios/:id/messages     → chat history
 *   POST   /api/sandbox/scenarios/:id/messages     → post a message
 *   POST   /api/sandbox/webhook                    → external agent → sandbox
 *
 * Persistence model:
 *   Scenario *definitions* persist (seeded in code; user-created in KV).
 *   Scenario *state and messages* are in-memory per function process — they
 *   reset on cold-start. Agents repopulate state via /state and /webhook on
 *   their next call, so this is fine for live-driven demos.
 */

import { kv } from '@vercel/kv';

const KV_AVAILABLE = Boolean(process.env.KV_REST_API_URL || process.env.KV_URL);
const TEMPLATES = ['teams', 'workday', 'excel'];
const KV_INDEX = 'sandbox:scenario:index'; // Set of user-created scenario ids
const KV_KEY = (id) => `sandbox:scenario:${id}`;
const KV_STATE_KEY = (id) => `sandbox:scenario:${id}:state`;
const KV_MSGS_KEY = (id) => `sandbox:scenario:${id}:messages`;
const MAX_MESSAGES = 500; // cap per scenario to keep KV lean

// ── Scenario catalogue ────────────────────────────────────────────────────

const SCENARIOS = [];

// ── Scenario definition lookup (seeded + KV) ──────────────────────────────

async function getScenarioDef(id) {
  const seeded = SCENARIOS.find((s) => s.id === id);
  if (seeded) return seeded;
  if (!KV_AVAILABLE) return null;
  const userDef = await kv.get(KV_KEY(id));
  return userDef || null;
}

async function listUserScenarios() {
  if (!KV_AVAILABLE) return [];
  const ids = await kv.smembers(KV_INDEX);
  if (!ids || ids.length === 0) return [];
  const defs = await Promise.all(ids.map((id) => kv.get(KV_KEY(id))));
  return defs.filter(Boolean);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function randomSuffix(n = 5) {
  return Math.random().toString(36).slice(2, 2 + n);
}

function genToken() {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('');
}

// Scenario data is now persisted in KV so it survives across Vercel
// function instances (which is the only way GET /messages can return what
// /webhook just pushed).

async function getState(id) {
  const def = await getScenarioDef(id);
  if (!def) return null;
  if (!KV_AVAILABLE) return structuredClone(def.initialState || {});
  const stored = await kv.get(KV_STATE_KEY(id));
  return stored || structuredClone(def.initialState || {});
}

async function setState(id, nextState) {
  if (!KV_AVAILABLE) return;
  await kv.set(KV_STATE_KEY(id), nextState);
}

async function clearState(id) {
  const def = await getScenarioDef(id);
  if (!def) return false;
  if (KV_AVAILABLE) {
    await kv.set(KV_STATE_KEY(id), structuredClone(def.initialState || {}));
    await kv.del(KV_MSGS_KEY(id));
  }
  return true;
}

async function getMessages(id) {
  if (!KV_AVAILABLE) return [];
  const raw = await kv.lrange(KV_MSGS_KEY(id), 0, -1);
  if (!raw || raw.length === 0) return [];
  return raw
    .map((entry) => (typeof entry === 'string' ? JSON.parse(entry) : entry))
    .sort((a, b) => a.timestamp - b.timestamp);
}

async function appendMessage(id, msg) {
  if (!KV_AVAILABLE) return;
  await kv.rpush(KV_MSGS_KEY(id), JSON.stringify(msg));
  await kv.ltrim(KV_MSGS_KEY(id), -MAX_MESSAGES, -1);
}

function sanitizeScenario(def) {
  const { initialState, deleteToken, ...rest } = def;
  return rest;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  // Fallback for environments where body isn't pre-parsed
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

// ── Request router ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/$/, '');

  // ── LIST SCENARIOS (seeded + user-created) ──
  if (path === '/api/sandbox/scenarios' && req.method === 'GET') {
    const userDefs = await listUserScenarios();
    return res.status(200).json({
      scenarios: [
        ...SCENARIOS.map((s) => ({ ...sanitizeScenario(s), source: 'seeded' })),
        ...userDefs.map((s) => ({ ...sanitizeScenario(s), source: 'user' })),
      ],
    });
  }

  // ── CREATE USER SCENARIO ──
  if (path === '/api/sandbox/scenarios' && req.method === 'POST') {
    if (!KV_AVAILABLE) {
      return res.status(503).json({ error: 'Scenario storage not configured. Set KV env vars in Vercel.' });
    }
    const body = await readBody(req);
    const name = (body.name || '').trim();
    const template = body.template;
    const description = (body.description || '').trim();
    const agent = (body.agent || '').trim() || 'Custom Agent';
    const personas = Array.isArray(body.personas) ? body.personas : [];
    const openingMessage = (body.openingMessage || '').trim();

    if (!name) return res.status(400).json({ error: 'Missing "name"' });
    if (!TEMPLATES.includes(template)) {
      return res.status(400).json({ error: `Invalid "template"; must be one of: ${TEMPLATES.join(', ')}` });
    }
    if (personas.length === 0) {
      return res.status(400).json({ error: 'At least one persona is required' });
    }
    const cleanedPersonas = personas
      .map((p) => ({
        id: slugify(p.id || p.role || p.name) || `p${randomSuffix(3)}`,
        name: String(p.name || '').trim(),
        role: String(p.role || '').trim(),
        initials: String(p.initials || (p.name || '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()),
      }))
      .filter((p) => p.name);
    if (cleanedPersonas.length === 0) {
      return res.status(400).json({ error: 'At least one persona with a name is required' });
    }

    // Generate a unique short id from the name + random suffix.
    const base = slugify(name) || 'demo';
    let id = `${base}-${randomSuffix(4)}`;
    // Re-roll on collision (cheap; KV.exists is fast).
    while (await kv.exists(KV_KEY(id))) {
      id = `${base}-${randomSuffix(5)}`;
    }
    const deleteToken = genToken();
    const def = {
      id,
      name,
      agent,
      template,
      description: description || `Custom demo using the ${template} template.`,
      personas: cleanedPersonas,
      openingMessage: openingMessage || null,
      initialState: {},
      source: 'user',
      createdAt: Date.now(),
      deleteToken,
    };
    await kv.set(KV_KEY(id), def);
    await kv.sadd(KV_INDEX, id);

    const host = req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const origin = `${proto}://${host}`;
    return res.status(201).json({
      id,
      deleteToken,
      demoUrl: `${origin}/sandbox/demo/?scenario=${id}`,
      webhookUrl: `${origin}/api/sandbox/webhook`,
      scenario: sanitizeScenario(def),
    });
  }

  // ── GET ONE SCENARIO ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+$/) && req.method === 'GET') {
    const id = path.split('/')[4];
    const def = await getScenarioDef(id);
    if (!def) return res.status(404).json({ error: 'Scenario not found' });
    return res.status(200).json(sanitizeScenario(def));
  }

  // ── DELETE USER SCENARIO ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+$/) && req.method === 'DELETE') {
    const id = path.split('/')[4];
    if (SCENARIOS.find((s) => s.id === id)) {
      return res.status(403).json({ error: 'Cannot delete seeded scenarios' });
    }
    if (!KV_AVAILABLE) return res.status(404).json({ error: 'Scenario not found' });
    const def = await kv.get(KV_KEY(id));
    if (!def) return res.status(404).json({ error: 'Scenario not found' });
    const provided = req.headers['x-delete-token'] || (await readBody(req)).deleteToken;
    if (!provided || provided !== def.deleteToken) {
      return res.status(403).json({ error: 'Invalid or missing delete token' });
    }
    await kv.del(KV_KEY(id));
    await kv.del(KV_STATE_KEY(id));
    await kv.del(KV_MSGS_KEY(id));
    await kv.srem(KV_INDEX, id);
    return res.status(200).json({ id, deleted: true });
  }

  // ── GET STATE ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/state$/) && req.method === 'GET') {
    const id = path.split('/')[4];
    if (!(await getScenarioDef(id))) return res.status(404).json({ error: 'Scenario not found' });
    const state = await getState(id);
    return res.status(200).json({ scenarioId: id, state });
  }

  // ── UPDATE STATE (shallow merge) ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/state$/) && req.method === 'POST') {
    const id = path.split('/')[4];
    if (!(await getScenarioDef(id))) return res.status(404).json({ error: 'Scenario not found' });
    const updates = (await readBody(req)) || {};
    const state = await getState(id);
    Object.keys(updates).forEach((key) => {
      if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
        state[key] = { ...(state[key] || {}), ...updates[key] };
      } else {
        state[key] = updates[key];
      }
    });
    await setState(id, state);
    return res.status(200).json({ scenarioId: id, state });
  }

  // ── RESET STATE ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/state$/) && req.method === 'DELETE') {
    const id = path.split('/')[4];
    if (!(await clearState(id))) return res.status(404).json({ error: 'Scenario not found' });
    const state = await getState(id);
    return res.status(200).json({ scenarioId: id, state, reset: true });
  }

  // ── GET MESSAGES ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/messages$/) && req.method === 'GET') {
    const id = path.split('/')[4];
    if (!(await getScenarioDef(id))) return res.status(404).json({ error: 'Scenario not found' });
    let msgs = await getMessages(id);
    const since = url.searchParams.get('since');
    if (since) {
      const t = Number(since);
      msgs = msgs.filter((m) => m.timestamp > t);
    }
    return res.status(200).json({ scenarioId: id, messages: msgs });
  }

  // ── POST MESSAGE ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/messages$/) && req.method === 'POST') {
    const id = path.split('/')[4];
    if (!(await getScenarioDef(id))) return res.status(404).json({ error: 'Scenario not found' });
    const body = (await readBody(req)) || {};
    if (!body.text || typeof body.text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "text" field' });
    }
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scenarioId: id,
      from: body.from || 'unknown',
      to: body.to || 'all',
      text: body.text,
      timestamp: Date.now(),
      actions: body.actions || null,
    };
    await appendMessage(id, msg);
    return res.status(201).json(msg);
  }

  // ── WEBHOOK (external agent → sandbox) ──
  if (path === '/api/sandbox/webhook' && req.method === 'POST') {
    const body = (await readBody(req)) || {};
    if (!body.scenarioId) {
      return res.status(400).json({ error: 'Missing "scenarioId" field' });
    }
    if (!body.text || typeof body.text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "text" field' });
    }
    if (!(await getScenarioDef(body.scenarioId))) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scenarioId: body.scenarioId,
      from: body.agentName || 'external-agent',
      to: body.to || 'user',
      text: body.text,
      timestamp: Date.now(),
      actions: body.actions || null,
      source: 'webhook',
    };
    await appendMessage(body.scenarioId, msg);

    if (body.stateUpdates && typeof body.stateUpdates === 'object') {
      const state = await getState(body.scenarioId);
      Object.keys(body.stateUpdates).forEach((key) => {
        if (typeof body.stateUpdates[key] === 'object' && body.stateUpdates[key] !== null && !Array.isArray(body.stateUpdates[key])) {
          state[key] = { ...(state[key] || {}), ...body.stateUpdates[key] };
        } else {
          state[key] = body.stateUpdates[key];
        }
      });
      await setState(body.scenarioId, state);
    }

    return res.status(201).json({ ok: true, message: msg });
  }

  // ── 404 ──
  return res.status(404).json({ error: 'Not found', path });
}
