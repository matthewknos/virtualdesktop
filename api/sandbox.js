/**
 * CoE Sandbox API — shared mock backend for agent testing and demos.
 *
 * Two scenario sources:
 *   1. SCENARIOS array below — curated, hardcoded, dev-maintained.
 *   2. Vercel KV — user-created scenarios via the self-serve form at /sandbox/new.
 *
 * Routes:
 *   GET    /api/sandbox/scenarios                  → list seeded + user-created
 *   POST   /api/sandbox/scenarios                  → create user scenario
 *   GET    /api/sandbox/scenarios/:id              → one scenario
 *   DELETE /api/sandbox/scenarios/:id              → delete user scenario (requires X-Dev-Password)
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

// Shared dev password — internal-only sandbox. Override via SANDBOX_DEV_PASSWORD
// env var in Vercel without redeploying source if you want to rotate it.
const DEV_PASSWORD = process.env.SANDBOX_DEV_PASSWORD || 'COE101';
function checkDevPassword(req, body) {
  const provided = req.headers['x-dev-password'] || (body && body.devPassword);
  return Boolean(provided) && provided === DEV_PASSWORD;
}

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

// ── LLM call + adaptive-card action parser ────────────────────────────────

async function callLLM(messages, { maxTokens = 1024, model = 'moonshot-v1-32k', temperature, jsonMode = false } = {}) {
  if (!process.env.LLM_KEY) throw new Error('LLM_KEY not set');
  const payload = { model, max_tokens: maxTokens, messages };
  if (typeof temperature === 'number') payload.temperature = temperature;
  if (jsonMode) payload.response_format = { type: 'json_object' };
  const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LLM_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Pull the first balanced { … } object out of a string the LLM might have
// padded with prose, code fences, or commentary.
function extractJSON(raw) {
  if (!raw) return null;
  // Strip fenced code blocks if present.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try { return JSON.parse(slice); } catch { return null; }
      }
    }
  }
  return null;
}

// Parse a trailing <<ACTIONS>>["Yes","No"]<<END>> block emitted by the agent.
// Returns { text, actions } — text has the block stripped.
function parseActions(raw) {
  const m = raw.match(/<<ACTIONS>>(.*?)<<END>>/s);
  if (!m) return { text: raw.trim(), actions: null };
  let actions = null;
  try {
    const parsed = JSON.parse(m[1]);
    if (Array.isArray(parsed)) {
      actions = parsed
        .map((a) => {
          if (typeof a === 'string') return { label: a };
          if (a && typeof a === 'object' && a.label) {
            return { label: String(a.label), action: a.action || undefined, primary: !!a.primary };
          }
          return null;
        })
        .filter(Boolean);
    }
  } catch { /* malformed action block — leave as null */ }
  return { text: raw.replace(/<<ACTIONS>>[\s\S]*?<<END>>/, '').trim(), actions };
}

// Parse a trailing <<CALENDAR>>[{...}]<<END>> block — the agent's way of
// adding entries to state.calendar from chat. Strips the block from the text.
// Returns { text, events } where events is null or an array of event objects
// matching the teams template's calendar schema: { day, startHour, duration, title }.
const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function parseCalendar(raw) {
  const m = raw.match(/<<CALENDAR>>(.*?)<<END>>/s);
  if (!m) return { text: raw, events: null };
  let events = null;
  try {
    const parsed = JSON.parse(m[1]);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    events = arr
      .map((e) => {
        if (!e || typeof e !== 'object') return null;
        const day = VALID_DAYS.includes(e.day) ? e.day : null;
        const startHour = Number(e.startHour);
        const duration = Number(e.duration);
        const title = String(e.title || '').trim();
        if (!day || !title || !Number.isFinite(startHour) || !Number.isFinite(duration)) return null;
        return {
          day,
          startHour,
          duration: Math.max(0.25, duration),
          title,
          color: e.color || undefined,
          accent: e.accent || undefined,
        };
      })
      .filter(Boolean);
    if (events.length === 0) events = null;
  } catch { /* malformed — ignore */ }
  return { text: raw.replace(/<<CALENDAR>>[\s\S]*?<<END>>/, '').trim(), events };
}

// Build conversation history for runtime LLM calls.
// User personas are the "user" role; the agent is the "assistant" role.
function historyToLLM(scenarioDef, messages) {
  const agentNames = new Set([
    'agent',
    String(scenarioDef.agent || '').toLowerCase(),
  ]);
  return messages.map((m) => {
    const fromLower = String(m.from || '').toLowerCase();
    const isAgent = m.source === 'webhook' || agentNames.has(fromLower) || fromLower === 'assistant';
    return {
      role: isAgent ? 'assistant' : 'user',
      content: m.text,
    };
  });
}

const RUNTIME_ACTION_INSTRUCTION = `When you want to offer the user button choices, append a trailing block on its own line in this exact format:
<<ACTIONS>>["First option","Second option","Third option"]<<END>>
Use 2–3 short options (each under 30 chars). Omit the block entirely when no choice is needed.`;

const RUNTIME_CALENDAR_INSTRUCTION = `When the user asks you to schedule, book, or add a call/meeting to their calendar, append a calendar block on its own line in this exact format AFTER your normal text (and before any <<ACTIONS>> block):
<<CALENDAR>>[{"day":"Tue","startHour":14,"duration":0.5,"title":"Catch-up with Alice"}]<<END>>
Rules:
- "day" MUST be one of: Mon, Tue, Wed, Thu, Fri, Sat, Sun (current week only).
- "startHour" is 0–23 (e.g. 9.5 = 09:30, 14 = 14:00).
- "duration" is hours (e.g. 0.5 = 30 min, 1 = 1 hour).
- "title" is a short label.
- Confirm what you booked in your reply text. The event will appear instantly on the user's calendar tab.
- Only emit the block when actually adding an event. Never invent meetings the user didn't request.`;

function sanitizeScenario(def) {
  const { initialState, deleteToken, ...rest } = def; // deleteToken legacy on old scenarios — strip from public reads
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
    };
    await kv.set(KV_KEY(id), def);
    await kv.sadd(KV_INDEX, id);

    const host = req.headers.host;
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const origin = `${proto}://${host}`;
    return res.status(201).json({
      id,
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

  // ── CONFIGURE SCENARIO (AI wizard) ──
  // Takes a plain-English description + delete token. Asks the setup LLM to
  // produce {systemPrompt, openingMessage, suggestedReplies}; saves them on
  // the scenario; clears prior messages; posts the opening message. The
  // /messages auto-respond hook will then drive every subsequent turn.
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/configure$/) && req.method === 'POST') {
    const id = path.split('/')[4];
    if (!KV_AVAILABLE) return res.status(503).json({ error: 'Scenario storage not configured.' });
    const def = await kv.get(KV_KEY(id));
    if (!def) return res.status(404).json({ error: 'Scenario not found or not user-created.' });
    const body = await readBody(req);
    if (!checkDevPassword(req, body)) {
      return res.status(403).json({ error: 'Invalid or missing dev password.' });
    }
    const description = (body.description || '').trim();
    if (!description) return res.status(400).json({ error: 'Missing "description"' });

    const personaList = (def.personas || []).map((p) => `- ${p.name} (${p.role})`).join('\n') || '- (none defined)';
    const calendarCapability = def.template === 'teams'
      ? `\n\nThis is the Teams template, which has a working calendar tab. If the demo owner's brief involves scheduling meetings, booking calls, or adding events, mention in the system prompt that the agent can add calendar events by appending a trailing block:\n<<CALENDAR>>[{"day":"Tue","startHour":14,"duration":0.5,"title":"Catch-up with Alice"}]<<END>>\nDay must be Mon–Sun (current week), startHour is 0–23 (0.5 = half hour), duration in hours. Direct the agent to ask the user for missing details (which day/time) before booking, and to confirm what was booked in the reply text.`
      : '';
    const setupPrompt = `You are configuring a sandbox AI agent for the CoE Sandbox platform's "${def.template}" template.${calendarCapability}

Scenario name: ${def.name}
Agent name: ${def.agent}
Personas (who the agent talks to):
${personaList}

The demo owner has described what they want the agent to do:
---
${description}
---

Produce a JSON object with these exact keys (and ONLY these keys):
- "systemPrompt": a complete system prompt to drive the live conversation. Address it to the agent. Bake in the scenario name, persona names, tone, what to ask first, what to do when the user picks options, when to escalate or close out. Make it self-contained — the runtime will pass this verbatim as the system message every turn.
- "openingMessage": the agent's first line of chat, addressed to the primary persona by name. Markdown allowed. Should set context and offer 2–3 next-step choices via action buttons. End with a trailing <<ACTIONS>>["Choice A","Choice B"]<<END>> block (literal text, no escaping).
- "suggestedReplies": array of 2–4 short user-reply suggestions (each under 30 chars) the demo can show as quick-replies on first load.

Respond with the JSON object ONLY — no prose, no markdown fences, no commentary.`;

    let setupRaw;
    try {
      setupRaw = await callLLM([
        { role: 'system', content: 'You are a configuration assistant that outputs ONLY a single JSON object. No prose, no markdown, no commentary.' },
        { role: 'user', content: setupPrompt },
      ], { maxTokens: 1600, temperature: 0.2, jsonMode: true });
    } catch (err) {
      return res.status(502).json({ error: `Setup LLM call failed: ${err.message}` });
    }
    const config = extractJSON(setupRaw);
    if (!config) {
      return res.status(502).json({ error: 'Setup LLM returned non-JSON.', rawPreview: String(setupRaw).slice(0, 400) });
    }
    if (!config.systemPrompt || !config.openingMessage) {
      return res.status(502).json({ error: 'Setup LLM response missing required fields (systemPrompt/openingMessage).', config });
    }

    // Persist on the scenario definition.
    const updatedDef = {
      ...def,
      systemPrompt: String(config.systemPrompt),
      openingMessage: String(config.openingMessage),
      suggestedReplies: Array.isArray(config.suggestedReplies)
        ? config.suggestedReplies.map((s) => String(s)).slice(0, 4)
        : [],
      configuredAt: Date.now(),
    };
    await kv.set(KV_KEY(id), updatedDef);

    // Reset chat: the new system prompt defines a different conversation.
    await kv.del(KV_MSGS_KEY(id));

    // Post the opening message as if from the agent.
    const parsedOpener = parseActions(updatedDef.openingMessage);
    const openMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scenarioId: id,
      from: updatedDef.agent || 'agent',
      to: 'user',
      text: parsedOpener.text,
      timestamp: Date.now(),
      actions: parsedOpener.actions,
      source: 'configure',
    };
    await appendMessage(id, openMsg);

    return res.status(200).json({
      id,
      scenario: sanitizeScenario(updatedDef),
      openingMessage: openMsg,
    });
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
    if (!checkDevPassword(req, await readBody(req))) {
      return res.status(403).json({ error: 'Invalid or missing dev password' });
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
    const def = await getScenarioDef(id);
    if (!def) return res.status(404).json({ error: 'Scenario not found' });
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

    // ── Auto-respond hook ──
    // If the scenario has been configured with a systemPrompt and this
    // message is from a user (not the agent itself), generate + post an
    // agent reply inline. Adds 1–3s to the POST response.
    let agentReply = null;
    const agentNameLower = String(def.agent || '').toLowerCase();
    const fromLower = String(msg.from || '').toLowerCase();
    const isFromUser = fromLower !== 'agent' && fromLower !== agentNameLower && msg.source !== 'webhook';
    if (def.systemPrompt && isFromUser) {
      try {
        const history = await getMessages(id);
        const llmHistory = historyToLLM(def, history);
        const calendarInstr = def.template === 'teams' ? `\n\n${RUNTIME_CALENDAR_INSTRUCTION}` : '';
        const sysContent = `${def.systemPrompt}\n\n${RUNTIME_ACTION_INSTRUCTION}${calendarInstr}`;
        const raw = await callLLM([
          { role: 'system', content: sysContent },
          ...llmHistory,
        ], { maxTokens: 800 });
        // Strip calendar block first so it doesn't end up in the rendered chat.
        const cal = def.template === 'teams' ? parseCalendar(raw) : { text: raw, events: null };
        const parsed = parseActions(cal.text);
        if (cal.events && cal.events.length) {
          const state = await getState(id);
          const existing = Array.isArray(state.calendar) ? state.calendar : [];
          state.calendar = existing.concat(cal.events);
          await setState(id, state);
        }
        if (parsed.text) {
          agentReply = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            scenarioId: id,
            from: def.agent || 'agent',
            to: 'user',
            text: parsed.text,
            timestamp: Date.now(),
            actions: parsed.actions,
            source: 'auto-agent',
            stateChanged: Boolean(cal.events && cal.events.length),
          };
          await appendMessage(id, agentReply);
        }
      } catch (err) {
        // Don't fail the user's POST if the agent reply errors; just log.
        console.error('auto-respond failed:', err.message);
      }
    }

    return res.status(201).json({ message: msg, agentReply });
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
