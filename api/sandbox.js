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
const MAX_FILE_BYTES = 120_000;       // per file
const MAX_TOTAL_REF_BYTES = 400_000;  // sum of all files + referenceData
const MAX_FILES = 8;
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

async function callLLM(messages, { maxTokens = 1024, model = 'moonshot-v1-32k', temperature, jsonMode = false, returnMeta = false } = {}) {
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
  const content = data.choices?.[0]?.message?.content || '';
  if (returnMeta) {
    return { content, finishReason: data.choices?.[0]?.finish_reason || '', usage: data.usage || {} };
  }
  return content;
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

// Strip model-end artefacts and stray special tokens before any other parsing.
// Moonshot sometimes appends `<|endoftext|>` or chat-template tokens which
// would otherwise leak into the rendered bubble.
function stripModelArtefacts(raw) {
  if (!raw) return raw;
  return String(raw)
    .replace(/<\|endoftext\|>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|im_start\|>/g, '')
    .replace(/<\|eot_id\|>/g, '')
    .replace(/<\|end_of_text\|>/g, '');
}

// Parse a trailing <<ACTIONS>>["Yes","No"]<<END>> block emitted by the agent.
// Returns { text, actions } — text has the block stripped. Also tolerates
// the model dropping the <<END>> sentinel and using a stop-token instead.
function parseActions(raw) {
  raw = stripModelArtefacts(raw);
  let m = raw.match(/<<ACTIONS>>([\s\S]*?)<<END>>/);
  // Fallback: <<ACTIONS>>[...]  with no <<END>> — grab the first JSON array.
  if (!m) {
    const fallback = raw.match(/<<ACTIONS>>\s*(\[[\s\S]*?\])/);
    if (fallback) m = [fallback[0], fallback[1]];
  }
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
  // Strip the well-formed block, open-ended fallback, dangling opener, AND
  // any orphan closing tags (full <<END>> or truncated <<END>) that the LLM
  // occasionally emits without a matching opener.
  const cleaned = raw
    .replace(/<<ACTIONS>>[\s\S]*?<<END>>/g, '')
    .replace(/<<ACTIONS>>\s*\[[\s\S]*?\]\s*/g, '')
    .replace(/<<ACTIONS>>[\s\S]*$/g, '')
    .replace(/<<\s*END\s*>>?/g, '') // orphan <<END>> or <<END>
    .replace(/<<\s*END\b/g, '')
    .trim();
  return { text: cleaned, actions };
}

// Parse a trailing <<CALENDAR>>[{...}]<<END>> block — the agent's way of
// adding entries to state.calendar from chat. Strips the block from the text.
// Returns { text, events } where events is null or an array of event objects
// matching the teams template's calendar schema: { day, startHour, duration, title }.
const VALID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function parseCalendar(raw) {
  raw = stripModelArtefacts(raw);
  let m = raw.match(/<<CALENDAR>>([\s\S]*?)<<END>>/);
  if (!m) {
    const fallback = raw.match(/<<CALENDAR>>\s*(\[[\s\S]*?\])/);
    if (fallback) m = [fallback[0], fallback[1]];
  }
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
  const cleaned = raw
    .replace(/<<CALENDAR>>[\s\S]*?<<END>>/, '')
    .replace(/<<CALENDAR>>\s*\[[\s\S]*?\]\s*/, '')
    .replace(/<<CALENDAR>>[\s\S]*$/, '')
    .trim();
  return { text: cleaned, events };
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

function sanitizeScenario(def, { stripFileContent = false } = {}) {
  const { initialState, deleteToken, ...rest } = def; // deleteToken legacy on old scenarios — strip from public reads
  if (stripFileContent && Array.isArray(rest.referenceFiles)) {
    rest.referenceFiles = rest.referenceFiles.map(({ content, ...meta }) => meta);
  }
  return rest;
}

// Accept either an array of strings or a newline-separated string; return a
// cleaned array of non-empty trimmed strings.
function arrayOfStrings(input) {
  if (input == null) return [];
  const raw = Array.isArray(input) ? input : String(input).split(/\r?\n/);
  return raw.map((s) => String(s).replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean).slice(0, 8);
}

// Validate & cap reference files. Returns { files, error }. Files are
// objects { name, content, size }. Any non-text-looking content is rejected.
function sanitizeReferenceFiles(input, referenceDataLen = 0) {
  if (!Array.isArray(input)) return { files: [], error: null };
  const trimmed = input.slice(0, MAX_FILES);
  let total = referenceDataLen;
  const out = [];
  for (const f of trimmed) {
    if (!f || typeof f !== 'object') continue;
    const name = String(f.name || 'untitled').slice(0, 200);
    const content = String(f.content || '');
    if (!content) continue;
    if (content.length > MAX_FILE_BYTES) {
      return { files: [], error: `Reference file "${name}" exceeds ${Math.round(MAX_FILE_BYTES / 1000)}KB limit.` };
    }
    total += content.length;
    if (total > MAX_TOTAL_REF_BYTES) {
      return { files: [], error: `Total reference material exceeds ${Math.round(MAX_TOTAL_REF_BYTES / 1000)}KB limit.` };
    }
    out.push({ name, content, size: content.length });
  }
  return { files: out, error: null };
}

// { personaId: [chip, chip, ...] }
function sanitizePersonaChips(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const [pid, chips] of Object.entries(input)) {
    const arr = Array.isArray(chips) ? chips : String(chips || '').split(/\r?\n/);
    const clean = arr.map((c) => String(c).trim()).filter(Boolean).slice(0, 6);
    if (clean.length) out[String(pid)] = clean;
  }
  return out;
}

// [{ id, match (regex source string), chips: { personaId: [chip,...] } }]
function sanitizeFollowupMap(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((rule, i) => {
    if (!rule || typeof rule !== 'object') return null;
    const id = String(rule.id || `rule_${i}`).slice(0, 60);
    const match = String(rule.match || '').slice(0, 200);
    if (!match) return null;
    // Validate regex compiles; if not, escape as literal
    let regexSource = match;
    try { new RegExp(match, 'i'); }
    catch { regexSource = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    return {
      id,
      match: regexSource,
      chips: sanitizePersonaChips(rule.chips),
    };
  }).filter(Boolean);
}

function buildReferenceBlock(def) {
  const sections = [];
  if (def.styleGuidance) {
    sections.push(`## Style guidance (formatting, voice, conventions)\n${def.styleGuidance}`);
  }
  if (def.referenceData) {
    sections.push(`## Inline reference data (case records, dates, IDs, policy excerpts)\n${def.referenceData}`);
  }
  if (Array.isArray(def.referenceFiles) && def.referenceFiles.length) {
    const fileSections = def.referenceFiles
      .map((f) => `### File: ${f.name}\n${f.content}`)
      .join('\n\n');
    sections.push(`## Reference files (full text — ground truth, quote and cite by filename)\n${fileSections}`);
  }
  if (sections.length === 0) return '';
  return `# REFERENCE MATERIAL — AUTHORITATIVE
The demo owner has supplied the material below as your source of truth. Strict rules:
- This material WINS over your general training knowledge whenever they conflict.
- For any factual claim about policy, threshold, case, person, or date, base it ON THIS MATERIAL — not on generic HR/legal knowledge.
- When you draft a conversation, prompt, message, or letter, weave in specifics from this material (names, dates, IDs, policy section numbers, exact wording). Do not produce generic templates.
- Cite source filenames inline when you quote (e.g. "per Policy.md §4.2: …").
- If the user asks something the supplied material doesn't cover, say so plainly. Never substitute generic boilerplate.

${sections.join('\n\n')}

# END OF REFERENCE MATERIAL`;
}

const RUNTIME_DRAFTING_INSTRUCTION = `Drafting rules — apply ONLY when the user EXPLICITLY asks for one (phrases like "draft…", "write the message", "help me write", "give me the wording", "what would I say"). Do NOT draft in response to short imperative commands ("Submit Timesheet", "Approve", "Escalate", "Continue") — those are commitments, not requests for content.

When you do draft:
- Render the draft itself as a markdown blockquote (each line prefixed with "> ") so it visually reads as a draft, not your own voice.
- The draft's voice is the configured speaker (e.g. the line manager talking to their report). NOT yours. Do not sign it with your own agent name.
- Ground specifics in supplied reference material (names, dates, policy section numbers). Avoid generic boilerplate.
- One short framing line above ("Here's a draft you can adapt:") and one short offer below ("Want me to adjust the tone?"). Nothing else.
- The draft must be the thing the user actually asked for. If they asked you to chase someone for a missing timesheet, draft a chaser TO that person — don't draft a draft they'd send. Read the brief carefully.`;

const RUNTIME_COMMAND_INSTRUCTION = `Interpreting user replies — many user messages will arrive as button labels you previously offered. Treat short imperative verbs ("Submit Timesheet", "Approve", "Escalate to PM", "Cancel", "Yes", "Done") as the user committing to / requesting that action — NOT as a request to draft, explain, or restate.

Your response to a short command should:
- Acknowledge what the user has chosen in one short sentence.
- State what happens next (what you'll do, what they'll see, what changes in the system) — referring to the actual scenario context. If your scenario data names a specific Workday module, person, or document, name it.
- Offer the next sensible step via a fresh <<ACTIONS>> block, OR end cleanly if no follow-up is needed.

Examples (illustrative, not literal):
- User: "Submit Timesheet" → "Submitting your timesheet to Workday now. You'll see it in the Inbox queue under 'Pending approval' within a few minutes. Want me to chase your line manager if it sits there past Friday?"
- User: "Approve" → "Approved. The R&R nomination is now in the recognition queue. Anything else for this batch?"
- User: "Escalate to PM" → "Routing this to your PM. They'll see it in their Workday Inbox with the absence context attached."

Never respond to a short command with a generic email draft, a policy lecture, or unrelated content.`;

function sanitizeInfoPanel(ip) {
  if (!ip || typeof ip !== 'object') return null;
  const arr = (x) => Array.isArray(x) ? x.map((s) => String(s)).filter(Boolean).slice(0, 8) : [];
  return {
    heading: String(ip.heading || 'About this agent').slice(0, 120),
    does: arr(ip.does),
    connects: arr(ip.connects),
    refuses: arr(ip.refuses),
    references: arr(ip.references),
    closingNote: ip.closingNote ? String(ip.closingNote).slice(0, 280) : '',
  };
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
        ...SCENARIOS.map((s) => ({ ...sanitizeScenario(s, { stripFileContent: true }), source: 'seeded' })),
        ...userDefs.map((s) => ({ ...sanitizeScenario(s, { stripFileContent: true }), source: 'user' })),
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
    // Strip file content from public reads — runtime uses server-side def
    // for system-prompt injection; clients only need metadata.
    return res.status(200).json(sanitizeScenario(def, { stripFileContent: true }));
  }

  // ── ANALYSE — auto-fill configure fields from uploaded material ──
  // POST /api/sandbox/scenarios/:id/analyse
  // Body: { description?, referenceFiles?, referenceData?, devPassword? }
  // Returns: { suggestions: { tone, styleGuidance, capabilities[], connectsTo[],
  //   refuses[], savingsLine, personaOpenings{}, personaChips{}, personaRegisters{},
  //   followupMap[], suggestedDescription } }
  // The client merges these into the configure form (typically into blank fields
  // only) and the user reviews before hitting Configure.
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/analyse$/) && req.method === 'POST') {
    const id = path.split('/')[4];
    if (!KV_AVAILABLE) return res.status(503).json({ error: 'Scenario storage not configured.' });
    const def = await kv.get(KV_KEY(id));
    if (!def) return res.status(404).json({ error: 'Scenario not found.' });
    const body = await readBody(req);
    if (!checkDevPassword(req, body)) {
      return res.status(403).json({ error: 'Invalid or missing dev password.' });
    }

    const inputDesc = (body.description || '').trim();
    const inputRefData = (body.referenceData || '').trim();
    const incomingFiles = sanitizeReferenceFiles(body.referenceFiles, inputRefData.length);
    if (incomingFiles.error) return res.status(400).json({ error: incomingFiles.error });

    // Merge with prior files (same model as configure) so analyse can run
    // against the saved set too.
    const allPrior = Array.isArray(def.referenceFiles) ? def.referenceFiles : [];
    const priorFiles = allPrior.filter((pf) => !incomingFiles.files.find((nf) => nf.name === pf.name));
    const filesToAnalyse = priorFiles.concat(incomingFiles.files);

    if (!filesToAnalyse.length && !inputRefData && !inputDesc) {
      return res.status(400).json({ error: 'Upload at least one reference file, paste reference data, or write a one-line brief before auto-filling.' });
    }

    // For analyse we DO send file content (snippets) to the LLM — that's the
    // point. Cap each file's contribution to keep the prompt lean.
    const FILE_SNIPPET_BYTES = 6000;
    const fileSnippets = filesToAnalyse.map((f) => {
      const head = f.content.slice(0, FILE_SNIPPET_BYTES);
      const truncated = f.content.length > FILE_SNIPPET_BYTES;
      return `### File: ${f.name} (${(f.size / 1024).toFixed(1)} KB${truncated ? `, first ${FILE_SNIPPET_BYTES} chars shown` : ''})\n${head}`;
    }).join('\n\n');

    const personaList = (def.personas || []).map((p) => `- ${p.id}: ${p.name} (${p.role})`).join('\n') || '- (no personas defined yet)';

    const analysePrompt = `Read the supplied reference material and propose a configuration for an AI agent embedded in a Microsoft Teams demo.

Scenario: ${def.name} · Agent: ${def.agent} · Template: ${def.template}
Personas:
${personaList}

${inputDesc ? `Demo owner's one-line brief: ${inputDesc}\n` : ''}
${inputRefData ? `Inline reference data:\n---\n${inputRefData.slice(0, 4000)}${inputRefData.length > 4000 ? '\n…[truncated]…' : ''}\n---\n` : ''}
${fileSnippets ? `Reference files:\n${fileSnippets}\n` : ''}

Infer a configuration that grounds the agent in this material. Output a SINGLE JSON object with these keys (any may be omitted if you cannot reasonably infer):
- "suggestedDescription": a 2–4 sentence brief for the configure form, describing what the agent should do, in plain English.
- "tone": short tone & voice guidance (≤80 words).
- "styleGuidance": short output-shape guidance — markdown conventions, draft format, citation style (≤80 words).
- "capabilities": [3–6 short bullets, ≤15 words each] of what the agent does. Pulled from the material.
- "connectsTo": [2–5 short bullets] of systems / sources named in the material.
- "refuses": [2–5 short bullets] of hard rules the agent should not break. Pulled from policy / explicit prohibitions in the material.
- "savingsLine": one short sentence estimating time saved or stating a usage caveat.
- "personaOpenings": { personaId: opener ≤120 words }. Generate one per persona, addressed to that persona by name, grounded in the material. End with <<ACTIONS>>["A","B","C"]<<END>> if next-steps are obvious.
- "personaChips": { personaId: [2–4 chips, ≤30 chars each] } of plausible first-load quick replies for each persona.
- "personaRegisters": { personaId: ≤100-word tone shift } ONLY when different personas need genuinely different register. Otherwise empty object.
- "followupMap": [up to 6 { id, match (regex source, no slashes), chips: { personaId: [chips] } }] of follow-up rules keyed off plausible user phrases.

Rules:
- Ground every suggestion in the supplied material. Do NOT invent generic HR/PMO boilerplate.
- Quote specific names, dates, numbers, section IDs from the files where relevant.
- Keep total response under 2500 tokens.
- JSON object only. No prose, no fences.`;

    const promptBytes = analysePrompt.length;
    const analyseModel = promptBytes > 20_000 ? 'moonshot-v1-32k' : 'moonshot-v1-8k';

    let raw, finishReason;
    try {
      const meta = await callLLM(
        [
          { role: 'system', content: 'You output ONE JSON object that proposes a sandbox-agent configuration grounded in the supplied reference material. No prose, no markdown fences.' },
          { role: 'user', content: analysePrompt },
        ],
        { model: analyseModel, maxTokens: 3500, temperature: 0.25, jsonMode: true, returnMeta: true }
      );
      raw = meta.content;
      finishReason = meta.finishReason;
    } catch (err) {
      return res.status(502).json({ error: `Analyse LLM call failed: ${err.message}` });
    }

    const parsed = extractJSON(raw);
    if (!parsed) {
      return res.status(502).json({
        error: finishReason === 'length'
          ? 'Analyse LLM ran out of tokens before finishing the JSON. Try with fewer or smaller reference files.'
          : 'Analyse LLM returned non-JSON.',
        finishReason,
        rawPreview: String(raw).slice(0, 600),
      });
    }

    const arr = (x, max = 8) => Array.isArray(x) ? x.map((s) => String(s)).filter(Boolean).slice(0, max) : [];
    const objStr = (x) => (x && typeof x === 'object')
      ? Object.fromEntries(Object.entries(x).map(([k, v]) => [String(k), String(v || '').trim()]).filter(([, v]) => v))
      : {};
    const objArr = (x) => (x && typeof x === 'object')
      ? Object.fromEntries(Object.entries(x).map(([k, v]) => [String(k), arr(v, 6)]).filter(([, v]) => v.length))
      : {};

    const suggestions = {
      suggestedDescription: String(parsed.suggestedDescription || '').trim(),
      tone: String(parsed.tone || '').trim(),
      styleGuidance: String(parsed.styleGuidance || '').trim(),
      capabilities: arr(parsed.capabilities, 6),
      connectsTo: arr(parsed.connectsTo, 5),
      refuses: arr(parsed.refuses, 5),
      savingsLine: String(parsed.savingsLine || '').trim(),
      personaOpenings: objStr(parsed.personaOpenings),
      personaChips: objArr(parsed.personaChips),
      personaRegisters: objStr(parsed.personaRegisters),
      followupMap: sanitizeFollowupMap(parsed.followupMap),
    };

    return res.status(200).json({ id, suggestions });
  }

  // ── CONFIGURE SCENARIO (AI wizard) ──
  // Takes a plain-English description (+ optional structured inputs) and a
  // dev password. Asks the setup LLM to produce
  //   { systemPrompt, openingMessage, suggestedReplies, infoPanel, personaOpenings? }
  // and saves them on the scenario. First configure wipes any prior messages
  // and posts the opening. Subsequent configures are ADDITIVE — the new
  // description is appended to the prior brief chain, the LLM is told to
  // preserve prior intent, and the existing chat is left in place.
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/configure$/) && req.method === 'POST') {
    const id = path.split('/')[4];
    if (!KV_AVAILABLE) return res.status(503).json({ error: 'Scenario storage not configured.' });
    const def = await kv.get(KV_KEY(id));
    if (!def) return res.status(404).json({ error: 'Scenario not found or not user-created.' });
    const body = await readBody(req);
    if (!checkDevPassword(req, body)) {
      return res.status(403).json({ error: 'Invalid or missing dev password.' });
    }
    let description = (body.description || '').trim();
    const isReconfigure = Boolean(def.systemPrompt);
    // Description is optional when the request supplies reference material
    // OR a prior configuration exists — the LLM can derive the brief from
    // those sources. Otherwise it's required.
    const willHaveRefs = (Array.isArray(body.referenceFiles) && body.referenceFiles.length)
      || (Array.isArray(def.referenceFiles) && def.referenceFiles.length)
      || (body.referenceData && String(body.referenceData).trim().length)
      || (def.referenceData && String(def.referenceData).trim().length);
    if (!description) {
      if (!willHaveRefs && !isReconfigure) {
        return res.status(400).json({ error: 'Missing "description" and no reference material supplied — provide one.' });
      }
      description = isReconfigure
        ? 'Tighten and refresh from the latest reference material.'
        : 'Build the agent grounded in the supplied reference material.';
    }
    const priorDescriptions = Array.isArray(def.descriptions) ? def.descriptions : (def.description && isReconfigure ? [def.description] : []);

    // Optional structured inputs — all may be empty. The LLM will infer
    // anything missing from the description.
    const tone = (body.tone || '').trim();
    const capabilities = arrayOfStrings(body.capabilities);
    const connectsTo = arrayOfStrings(body.connectsTo);
    const refuses = arrayOfStrings(body.refuses);
    const savingsLine = (body.savingsLine || '').trim();
    const personaOpenings = (body.personaOpenings && typeof body.personaOpenings === 'object') ? body.personaOpenings : {};
    const styleGuidance = (body.styleGuidance || '').trim();
    const referenceData = (body.referenceData || '').trim();
    const personaChips = sanitizePersonaChips(body.personaChips);
    const followupMap = sanitizeFollowupMap(body.followupMap);
    // Per-persona register: short addendum injected into the system prompt
    // when that persona is the active speaker. Mirrors getSystemPromptForRole
    // in the sickness-absence demo.
    const personaRegisters = (body.personaRegisters && typeof body.personaRegisters === 'object')
      ? Object.fromEntries(Object.entries(body.personaRegisters)
          .map(([k, v]) => [String(k), String(v || '').trim()])
          .filter(([, v]) => v))
      : {};
    // Merge new files with prior files unless caller explicitly sent
    // `replaceReferenceFiles: true`. This makes additive reconfigures
    // genuinely additive on uploads too.
    const incomingFiles = sanitizeReferenceFiles(body.referenceFiles, referenceData.length);
    if (incomingFiles.error) return res.status(400).json({ error: incomingFiles.error });
    const replaceFiles = Boolean(body.replaceReferenceFiles);
    // If the client supplied `keepPriorFileNames`, that's the authoritative
    // list of which previously-saved files to keep. Otherwise default to
    // keeping all prior files (legacy behaviour) unless replaceFiles is set.
    const allPrior = Array.isArray(def.referenceFiles) ? def.referenceFiles : [];
    let basePrior;
    if (replaceFiles) {
      basePrior = [];
    } else if (Array.isArray(body.keepPriorFileNames)) {
      const keepSet = new Set(body.keepPriorFileNames.map((s) => String(s)));
      basePrior = allPrior.filter((pf) => keepSet.has(pf.name));
    } else {
      basePrior = allPrior;
    }
    // New files with the same name as a prior file override the prior content.
    const priorFiles = basePrior.filter((pf) => !incomingFiles.files.find((nf) => nf.name === pf.name));
    const referenceFiles = priorFiles.concat(incomingFiles.files);
    // Re-validate total size after merging
    const merged = sanitizeReferenceFiles(referenceFiles, referenceData.length);
    if (merged.error) return res.status(400).json({ error: merged.error });

    const personaList = (def.personas || []).map((p) => `- ${p.id}: ${p.name} (${p.role})`).join('\n') || '- (none defined)';
    const calendarCapability = def.template === 'teams'
      ? `\n\nThis is the Teams template, which has a working calendar tab. If the demo owner's brief involves scheduling meetings, booking calls, or adding events, mention in the system prompt that the agent can add calendar events by appending a trailing block:\n<<CALENDAR>>[{"day":"Tue","startHour":14,"duration":0.5,"title":"Catch-up with Alice"}]<<END>>\nDay must be Mon–Sun (current week), startHour is 0–23 (0.5 = half hour), duration in hours. Direct the agent to ask the user for missing details (which day/time) before booking, and to confirm what was booked in the reply text.`
      : '';

    const personaChipsBlock = Object.keys(personaChips).length
      ? `### Per-persona suggested-reply chips (verbatim — use these exactly when generating personaChips)\n${Object.entries(personaChips)
          .map(([pid, chips]) => `- ${pid}: ${chips.map((c) => `"${c}"`).join(', ')}`)
          .join('\n')}`
      : null;
    const followupBlock = followupMap.length
      ? `### Follow-up keyword map (use verbatim — populate the followupMap field)\nA list of rules. Each has an id, a regex source string, and per-persona chip arrays. When the user's message matches the regex (case-insensitive), the listed chips are surfaced to the relevant persona.\n${followupMap.map((r, i) => `(${i + 1}) id=${r.id} match=/${r.match}/i chips=${JSON.stringify(r.chips)}`).join('\n')}`
      : null;
    const referenceFilesNoteForSetup = referenceFiles.length
      ? `### Reference files (${referenceFiles.length}, injected at runtime — DO NOT read or echo content here)\n${referenceFiles.map((f) => `- ${f.name} (${Math.round(f.size / 100) / 10} KB)`).join('\n')}`
      : null;
    // Don't echo inline reference data verbatim — it can be many KB and the
    // setup LLM doesn't need to read it to write the system prompt. Send a
    // short signature + the first ~300 chars so the LLM can tell what kind of
    // material is loaded, but no more.
    const referenceDataNoteForSetup = referenceData
      ? `### Inline reference data (${referenceData.length} chars supplied, injected at runtime — DO NOT echo or paraphrase here)\nFirst 300 chars for context only:\n${referenceData.slice(0, 300)}${referenceData.length > 300 ? '…' : ''}`
      : null;
    const styleNoteForSetup = styleGuidance
      ? `### Style guidance (formatting, voice, conventions — bake into system prompt)\n${styleGuidance}`
      : null;

    const optionalSection = [
      tone && `### Tone & style\n${tone}`,
      styleNoteForSetup,
      capabilities.length && `### What the agent does (info-panel "What it does")\n${capabilities.map((c) => `- ${c}`).join('\n')}`,
      connectsTo.length && `### Systems it connects to (info-panel "Connects to")\n${connectsTo.map((c) => `- ${c}`).join('\n')}`,
      refuses.length && `### Hard rules — must refuse (info-panel "Will refuse to do")\n${refuses.map((c) => `- ${c}`).join('\n')}`,
      savingsLine && `### Time saved estimate (info-panel closing line)\n${savingsLine}`,
      referenceFilesNoteForSetup,
      referenceDataNoteForSetup,
      Object.keys(personaOpenings).filter((k) => String(personaOpenings[k] || '').trim()).length
        ? `### Per-persona opening messages (verbatim — use these exactly when generating personaOpenings)\n${Object.entries(personaOpenings)
            .filter(([, v]) => String(v || '').trim())
            .map(([pid, txt]) => `- ${pid}: ${String(txt).trim()}`)
            .join('\n')}`
        : null,
      Object.keys(personaRegisters).length
        ? `### Per-persona register addendum (verbatim — use these as the personaRegisters field; injected into the runtime system prompt when that persona is speaking)\n${Object.entries(personaRegisters)
            .map(([pid, txt]) => `- ${pid}:\n${txt}`)
            .join('\n\n')}`
        : null,
      personaChipsBlock,
      followupBlock,
    ].filter(Boolean).join('\n\n');

    const reconfigureHeader = isReconfigure
      ? `RECONFIGURE — additive only. Preserve every constraint, persona reference, hard rule, and tone choice from the prior system prompt. Weave the new brief in alongside; where they conflict, new wins.\n\nPRIOR SYSTEM PROMPT (preserve verbatim intent):\n---\n${def.systemPrompt}\n---`
      : 'First configure — build from scratch using the brief below.';

    const setupPrompt = `Configure a sandbox AI agent for the "${def.template}" template.${calendarCapability}

Name: ${def.name} · Agent: ${def.agent}
Personas (id : name (role)):
${personaList}

${reconfigureHeader}

NEW BRIEF:
${description}

${optionalSection ? `OPTIONAL INPUTS (use verbatim where supplied):\n${optionalSection}\n` : ''}
SIZE RULES (responses have been truncated before — stay under these):
- DO NOT copy reference-file or inline-data content anywhere. They're injected into the runtime prompt automatically. Refer to files by name only (e.g. "see Policy.md").
- systemPrompt ≤900 words. openingMessage ≤120 words. Each personaOpening ≤120 words. Each chip ≤30 chars. Each infoPanel bullet ≤15 words. personaRegisters ≤100 words each.

Output a JSON object with ONLY these keys:
- "systemPrompt": full system prompt — identity, tone, hard rules, persona-handling, reference files by name. ${isReconfigure ? 'Preserve prior prompt intent, add the new brief.' : 'Self-contained.'}
- "openingMessage": agent's first line to the FIRST persona by name. Markdown OK. End with <<ACTIONS>>["A","B","C"]<<END>>.
- "suggestedReplies": [2–4 strings, each ≤30 chars].
- "personaOpenings": { personaId: opener } for ALL personas. Verbatim if supplied above.
- "personaChips": { personaId: [2–4 chips] } for ALL personas. Verbatim if supplied above.
- "personaRegisters": { personaId: ≤100-word tone addendum } — only when personas need different register. Empty object if not.
- "followupMap": [up to 6 { id, match (regex source, no slashes), chips: { personaId: [chips] } }]. Verbatim if supplied. Empty array if no rules help.
- "infoPanel": { heading, does[2–6], connects[2–5], refuses[2–5], references[0–6: filename + brief note], closingNote }.

JSON OBJECT ONLY. No prose, no fences.`;

    const baseMessages = [
      { role: 'system', content: 'You output ONE JSON object. No prose, no markdown fences. Never copy reference content; reference files by name only.' },
      { role: 'user', content: setupPrompt },
    ];

    // Pick the smallest model whose context comfortably fits the prompt.
    // With reference data no longer echoed verbatim, the 8k model is plenty
    // for most calls (~4× cheaper than 32k). Fall back to 32k only when the
    // prompt itself is large.
    const promptBytes = JSON.stringify(baseMessages).length;
    const setupModel = promptBytes > 20_000 ? 'moonshot-v1-32k' : 'moonshot-v1-8k';

    let setupRaw, finishReason;
    try {
      const meta = await callLLM(baseMessages, {
        model: setupModel,
        maxTokens: 4000,
        temperature: 0.2,
        jsonMode: true,
        returnMeta: true,
      });
      setupRaw = meta.content;
      finishReason = meta.finishReason;
    } catch (err) {
      return res.status(502).json({ error: `Setup LLM call failed: ${err.message}` });
    }

    let config = extractJSON(setupRaw);

    // Retry only when actually truncated. Use 32k just in case the prompt
    // was a borderline fit for the 8k model.
    if (!config && finishReason === 'length') {
      try {
        const meta2 = await callLLM(
          [baseMessages[0], { role: 'user', content: `${setupPrompt}\n\nPrevious attempt truncated. Halve every field. followupMap may be []. personaRegisters may be {}.` }],
          { model: 'moonshot-v1-32k', maxTokens: 6000, temperature: 0.1, jsonMode: true, returnMeta: true }
        );
        setupRaw = meta2.content;
        finishReason = meta2.finishReason;
        config = extractJSON(setupRaw);
      } catch { /* fall through to error below */ }
    }

    if (!config) {
      return res.status(502).json({
        error: finishReason === 'length'
          ? 'Setup LLM ran out of tokens before finishing the JSON. Try removing some reference files or shortening the inline reference data.'
          : 'Setup LLM returned non-JSON.',
        finishReason,
        rawPreview: String(setupRaw).slice(0, 600),
      });
    }
    if (!config.systemPrompt || !config.openingMessage) {
      return res.status(502).json({ error: 'Setup LLM response missing required fields (systemPrompt/openingMessage).', config });
    }

    const nextDescriptions = priorDescriptions.concat([description]);

    const updatedDef = {
      ...def,
      systemPrompt: String(config.systemPrompt),
      openingMessage: String(config.openingMessage),
      suggestedReplies: Array.isArray(config.suggestedReplies)
        ? config.suggestedReplies.map((s) => String(s)).slice(0, 4)
        : [],
      personaOpenings: (config.personaOpenings && typeof config.personaOpenings === 'object') ? config.personaOpenings : {},
      personaChips: sanitizePersonaChips(config.personaChips) || {},
      personaRegisters: (config.personaRegisters && typeof config.personaRegisters === 'object')
        ? Object.fromEntries(Object.entries(config.personaRegisters)
            .map(([k, v]) => [String(k), String(v || '').trim()])
            .filter(([, v]) => v))
        : personaRegisters,
      followupMap: sanitizeFollowupMap(config.followupMap) || [],
      infoPanel: sanitizeInfoPanel(config.infoPanel) || def.infoPanel || null,
      // Reference material — stored separately, injected at runtime.
      referenceFiles,
      referenceData,
      styleGuidance,
      descriptions: nextDescriptions,
      // keep the most recent structured inputs for re-edit prefill on the form
      structuredInputs: {
        tone, capabilities, connectsTo, refuses, savingsLine, personaOpenings,
        styleGuidance, referenceData,
        personaChips, followupMap, personaRegisters,
      },
      configuredAt: Date.now(),
      reconfigureCount: (def.reconfigureCount || 0) + (isReconfigure ? 1 : 0),
    };
    await kv.set(KV_KEY(id), updatedDef);

    let openMsg = null;
    if (!isReconfigure) {
      // First configure: wipe chat, post opener.
      await kv.del(KV_MSGS_KEY(id));
      const parsedOpener = parseActions(updatedDef.openingMessage);
      openMsg = {
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
    }

    return res.status(200).json({
      id,
      scenario: sanitizeScenario(updatedDef),
      openingMessage: openMsg,
      reconfigured: isReconfigure,
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
    // If the scenario has a configured opening message, re-post it so the
    // user comes back to the same starting point they had on first load.
    const def = await getScenarioDef(id);
    if (def && def.openingMessage) {
      const parsedOpener = parseActions(String(def.openingMessage));
      const openMsg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        scenarioId: id,
        from: def.agent || 'agent',
        to: 'user',
        text: parsedOpener.text,
        timestamp: Date.now(),
        actions: parsedOpener.actions,
        source: 'reset-opener',
      };
      await appendMessage(id, openMsg);
    }
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
        const refBlock = buildReferenceBlock(def);
        // Per-persona register addendum — looked up by the current sender's
        // persona id. Mirrors getSystemPromptForRole() in the sickness-absence
        // demo so multi-persona scenarios shift tone correctly.
        const registers = def.personaRegisters || {};
        const activeRegister = registers[fromLower] || registers[msg.from] || '';
        // Order: reference material → identity → per-persona register → protocols.
        const parts = [];
        if (refBlock) parts.push(refBlock);
        parts.push(`# AGENT IDENTITY & BEHAVIOUR\n${def.systemPrompt}`);
        if (activeRegister) {
          const persona = (def.personas || []).find((p) => p.id === msg.from);
          const speakerLine = persona ? `\nCurrent speaker: ${persona.name}${persona.role ? ` (${persona.role})` : ''}\n` : '\n';
          parts.push(`# CURRENT SPEAKER — REGISTER OVERRIDE${speakerLine}\n${activeRegister}`);
        }
        parts.push(`# OUTPUT PROTOCOLS\n${RUNTIME_ACTION_INSTRUCTION}\n\n${RUNTIME_COMMAND_INSTRUCTION}\n\n${RUNTIME_DRAFTING_INSTRUCTION}${calendarInstr}`);
        const sysContent = parts.join('\n\n');
        const raw = await callLLM([
          { role: 'system', content: sysContent },
          ...llmHistory,
        ], { maxTokens: 1500 });
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
