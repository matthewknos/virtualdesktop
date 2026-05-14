/**
 * CoE Sandbox API — shared mock backend for agent testing and demos.
 *
 * Provides:
 *   • Scenario definitions (mock data + personas) for each CoE agent
 *   • In-memory state per scenario (timesheets, absence records, etc.)
 *   • Message bus per scenario (chat between user personas and external agents)
 *   • Webhook endpoint so external agent code can push messages into the sandbox
 *
 * Routes:
 *   GET    /api/sandbox/scenarios                  → list all
 *   GET    /api/sandbox/scenarios/:id              → one scenario
 *   GET    /api/sandbox/scenarios/:id/state        → current mutable state
 *   POST   /api/sandbox/scenarios/:id/state        → merge updates into state
 *   DELETE /api/sandbox/scenarios/:id/state        → reset to initialState
 *   GET    /api/sandbox/scenarios/:id/messages     → chat history
 *   POST   /api/sandbox/scenarios/:id/messages     → post a message
 *   POST   /api/sandbox/webhook                    → external agent → sandbox
 *
 * Limitations (serverless):
 *   State is held in-memory inside the function process. It survives warm
 *   invocations but resets on cold-start. For demo/testing sessions this is
 *   usually fine — a session runs in one burst. If you need persistence,
 *   wire in Vercel KV or Redis.
 */

// ── Scenario catalogue ────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'timesheet-chaser',
    name: 'Timesheet Chaser',
    agent: 'Timesheet Reminder Agent',
    template: 'teams',
    description:
      'Consultant Alice Chen is missing Thursday and Friday on her timesheet for the week ending 15 May. ' +
      'The agent nudges her in Teams on Friday afternoon, and escalates to PM Mark Davies if still missing Monday morning.',
    personas: [
      { id: 'consultant', name: 'Alice Chen', role: 'Senior Consultant', avatar: 'AC', initials: 'AC' },
      { id: 'pm', name: 'Mark Davies', role: 'Delivery Manager', avatar: 'MD', initials: 'MD' },
    ],
    initialState: {
      weekEnding: '2026-05-15',
      consultant: {
        name: 'Alice Chen',
        role: 'Senior Consultant',
        costCentre: 'AMS-UK-01',
        manager: 'Mark Davies',
        email: 'alice.chen@example.com',
      },
      projects: [
        { code: 'PRJ-8842', client: 'Acme Corp', name: 'Platform Migration', allocation: 0.6 },
        { code: 'PRJ-9901', client: 'Internal', name: 'CoE Knowledge Base', allocation: 0.2 },
        { code: 'TRG-001', client: 'Internal', name: 'AWS Training', allocation: 0.2 },
      ],
      timesheet: {
        status: 'partial', // partial | submitted | approved
        days: [
          { day: 'Mon', date: '2026-05-11', hours: 8.0, project: 'PRJ-8842', submitted: true },
          { day: 'Tue', date: '2026-05-12', hours: 8.0, project: 'PRJ-8842', submitted: true },
          { day: 'Wed', date: '2026-05-13', hours: 8.0, project: 'PRJ-9901', submitted: true },
          { day: 'Thu', date: '2026-05-14', hours: 0, project: null, submitted: false },
          { day: 'Fri', date: '2026-05-15', hours: 0, project: null, submitted: false },
        ],
        totalHours: 24.0,
        targetHours: 40.0,
      },
      history: {
        last4Weeks: [
          { weekEnding: '2026-05-08', status: 'submitted', onTime: true },
          { weekEnding: '2026-05-01', status: 'submitted', onTime: true },
          { weekEnding: '2026-04-24', status: 'submitted', onTime: false },
          { weekEnding: '2026-04-17', status: 'submitted', onTime: true },
        ],
        lateCount: 1,
      },
      escalation: {
        nudgeCount: 0,
        maxNudges: 3,
        escalatedToPM: false,
        pmNotifiedAt: null,
      },
      calendar: [
        { day: 'Mon', title: 'Acme stand-up', duration: 0.5, project: 'PRJ-8842' },
        { day: 'Tue', title: 'Sprint planning', duration: 1.0, project: 'PRJ-8842' },
        { day: 'Wed', title: 'CoE sync', duration: 1.0, project: 'PRJ-9901' },
        { day: 'Thu', title: 'Acme architecture review', duration: 2.0, project: 'PRJ-8842' },
        { day: 'Fri', title: 'AWS training — IAM deep-dive', duration: 3.0, project: 'TRG-001' },
      ],
    },
  },
  {
    id: 'sickness-absence',
    name: 'Sickness Absence Framework Coach',
    agent: 'Sickness Absence Framework Coach',
    template: 'teams',
    description:
      'Line manager Mark Davies has three direct reports with recent absence records. ' +
      'The agent coaches him through Return-to-Work conversations and flags Stage 1 threshold crossings.',
    personas: [
      { id: 'manager', name: 'Mark Davies', role: 'Line Manager', avatar: 'MD', initials: 'MD' },
      { id: 'people_ops', name: 'Polly Newman', role: 'People Operations Lead', avatar: 'PN', initials: 'PN' },
    ],
    initialState: {
      manager: { name: 'Mark Davies', role: 'Line Manager', directReports: 12 },
      workers: [
        {
          name: 'Eve Hart',
          role: 'Business Analyst',
          absence: {
            instances: 3,
            days: 7,
            lastInstance: { from: '2026-05-05', to: '2026-05-07', reason: 'Self-certified', excluded: false },
            rolling12Month: { instances: 3, days: 7 },
            stage1Threshold: { instances: 3, days: 8 },
            atRisk: true,
          },
        },
        {
          name: 'Tom Reed',
          role: 'Senior Developer',
          absence: {
            instances: 1,
            days: 2,
            lastInstance: { from: '2026-04-20', to: '2026-04-21', reason: 'Self-certified', excluded: false },
            rolling12Month: { instances: 1, days: 2 },
            stage1Threshold: { instances: 3, days: 8 },
            atRisk: false,
          },
        },
        {
          name: 'Priya M.',
          role: 'Consultant',
          absence: {
            instances: 0,
            days: 0,
            lastInstance: null,
            rolling12Month: { instances: 0, days: 0 },
            stage1Threshold: { instances: 3, days: 8 },
            atRisk: false,
          },
        },
      ],
      exclusions: [
        { worker: 'Priya M.', reason: 'Pregnancy-related', regulation: 'EqA 2010 §18', active: true },
      ],
      thresholds: {
        stage1: { instances: 3, days: 8, orEither: false },
        stage2: { instances: 4, days: 12, orEither: false },
        stage3: { instances: 5, days: 18, orEither: false },
      },
      recentEvents: [
        { date: '2026-05-07', worker: 'Eve Hart', type: 'absence_closed', days: 3 },
        { date: '2026-05-08', worker: 'Eve Hart', type: 'rtw_task_drafted', due: '2026-05-12' },
        { date: '2026-05-12', worker: 'Eve Hart', type: 'stage1_review_drafted', due: '2026-05-19' },
      ],
    },
  },
  {
    id: 'probation-review',
    name: 'Probation Review Orchestrator',
    agent: 'Probation Review Orchestrator',
    template: 'workday',
    description:
      'Manager Dave oversees Alice (Week 4, on track) and Ben (Week 10, at risk). ' +
      'The agent nudges at six lifecycle beats and drafts the review pack from real evidence.',
    personas: [
      { id: 'manager', name: 'Dave', role: 'Line Manager', avatar: 'D', initials: 'D' },
      { id: 'alice', name: 'Alice', role: 'Junior Consultant', avatar: 'A', initials: 'A' },
      { id: 'ben', name: 'Ben', role: 'Developer', avatar: 'B', initials: 'B' },
    ],
    initialState: {
      manager: { name: 'Dave', role: 'Line Manager', directReports: 5 },
      employees: [
        {
          name: 'Alice',
          role: 'Junior Consultant',
          startDate: '2026-04-13',
          week: 4,
          status: 'on_track',
          milestones: [
            { week: 1, label: 'Welcome', complete: true },
            { week: 4, label: 'Mid-point check', complete: true },
            { week: 8, label: 'Evidence gather', complete: false },
            { week: 12, label: 'Review day', complete: false },
          ],
          evidence: [
            { date: '2026-04-20', type: 'feedback', source: 'Peer review', text: 'Great client presence on Acme call.' },
            { date: '2026-05-01', type: 'training', text: 'Completed Workday fundamentals.' },
          ],
        },
        {
          name: 'Ben',
          role: 'Developer',
          startDate: '2026-02-16',
          week: 10,
          status: 'at_risk',
          milestones: [
            { week: 1, label: 'Welcome', complete: true },
            { week: 4, label: 'Mid-point check', complete: true },
            { week: 8, label: 'Evidence gather', complete: true },
            { week: 12, label: 'Review day', complete: false },
          ],
          evidence: [
            { date: '2026-03-10', type: 'feedback', source: 'Manager', text: 'Code quality below standard — needs pairing.' },
            { date: '2026-04-05', type: 'training', text: 'Missed security training — rescheduled.' },
            { date: '2026-04-28', type: 'feedback', source: 'Tech lead', text: 'Still inconsistent with PR reviews.' },
          ],
        },
      ],
      nextNudge: { employee: 'Ben', type: 'review_pack_draft', due: '2026-05-15' },
    },
  },
];

// ── In-memory runtime state ───────────────────────────────────────────────

const runtime = new Map(); // scenarioId → { state, messages }

function ensureScenario(id) {
  if (!runtime.has(id)) {
    const def = SCENARIOS.find((s) => s.id === id);
    if (!def) return null;
    runtime.set(id, {
      state: structuredClone(def.initialState),
      messages: [],
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });
  }
  const sc = runtime.get(id);
  sc.lastAccessed = Date.now();
  return sc;
}

function resetScenario(id) {
  const def = SCENARIOS.find((s) => s.id === id);
  if (!def) return false;
  runtime.set(id, {
    state: structuredClone(def.initialState),
    messages: [],
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  });
  return true;
}

function sanitizeScenario(def) {
  const { initialState, ...rest } = def;
  return rest;
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

  // ── LIST SCENARIOS ──
  if (path === '/api/sandbox/scenarios' && req.method === 'GET') {
    return res.status(200).json({
      scenarios: SCENARIOS.map(sanitizeScenario),
    });
  }

  // ── GET ONE SCENARIO ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+$/) && req.method === 'GET') {
    const id = path.split('/').pop();
    const def = SCENARIOS.find((s) => s.id === id);
    if (!def) return res.status(404).json({ error: 'Scenario not found' });
    return res.status(200).json(sanitizeScenario(def));
  }

  // ── GET STATE ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/state$/) && req.method === 'GET') {
    const id = path.split('/').pop();
    const sc = ensureScenario(id);
    if (!sc) return res.status(404).json({ error: 'Scenario not found' });
    return res.status(200).json({ scenarioId: id, state: sc.state });
  }

  // ── UPDATE STATE (shallow merge) ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/state$/) && req.method === 'POST') {
    const id = path.split('/').pop();
    const sc = ensureScenario(id);
    if (!sc) return res.status(404).json({ error: 'Scenario not found' });
    const updates = req.body || {};
    // Shallow merge top-level keys only
    Object.keys(updates).forEach((key) => {
      if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
        sc.state[key] = { ...(sc.state[key] || {}), ...updates[key] };
      } else {
        sc.state[key] = updates[key];
      }
    });
    return res.status(200).json({ scenarioId: id, state: sc.state });
  }

  // ── RESET STATE ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/state$/) && req.method === 'DELETE') {
    const id = path.split('/').pop();
    if (!resetScenario(id)) return res.status(404).json({ error: 'Scenario not found' });
    const sc = runtime.get(id);
    return res.status(200).json({ scenarioId: id, state: sc.state, reset: true });
  }

  // ── GET MESSAGES ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/messages$/) && req.method === 'GET') {
    const id = path.split('/').pop();
    const sc = ensureScenario(id);
    if (!sc) return res.status(404).json({ error: 'Scenario not found' });
    const since = url.searchParams.get('since');
    let msgs = sc.messages;
    if (since) {
      const t = Number(since);
      msgs = msgs.filter((m) => m.timestamp > t);
    }
    return res.status(200).json({ scenarioId: id, messages: msgs });
  }

  // ── POST MESSAGE ──
  if (path.match(/^\/api\/sandbox\/scenarios\/[^/]+\/messages$/) && req.method === 'POST') {
    const id = path.split('/').pop();
    const sc = ensureScenario(id);
    if (!sc) return res.status(404).json({ error: 'Scenario not found' });
    const body = req.body || {};
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
    sc.messages.push(msg);
    return res.status(201).json(msg);
  }

  // ── WEBHOOK (external agent → sandbox) ──
  if (path === '/api/sandbox/webhook' && req.method === 'POST') {
    const body = req.body || {};
    if (!body.scenarioId) {
      return res.status(400).json({ error: 'Missing "scenarioId" field' });
    }
    if (!body.text || typeof body.text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "text" field' });
    }
    const sc = ensureScenario(body.scenarioId);
    if (!sc) return res.status(404).json({ error: 'Scenario not found' });

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
    sc.messages.push(msg);

    // Optionally auto-update state if the webhook carries state mutations
    if (body.stateUpdates && typeof body.stateUpdates === 'object') {
      Object.keys(body.stateUpdates).forEach((key) => {
        if (typeof body.stateUpdates[key] === 'object' && body.stateUpdates[key] !== null && !Array.isArray(body.stateUpdates[key])) {
          sc.state[key] = { ...(sc.state[key] || {}), ...body.stateUpdates[key] };
        } else {
          sc.state[key] = body.stateUpdates[key];
        }
      });
    }

    return res.status(201).json({ ok: true, message: msg });
  }

  // ── 404 ──
  return res.status(404).json({ error: 'Not found', path });
}
