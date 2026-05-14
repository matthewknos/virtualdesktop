# CoE Sandbox — Teams template integration guide

> How to drive the Teams sandbox surface from an external agent. Covers the API shape, message + action protocol, calendar rail state, polling behaviour, and the self-serve scenario create flow.

**Base URL:** `https://coe-prototypes.vercel.app`
**Webhook endpoint:** `POST /api/sandbox/webhook`

---

## 1. The 60-second quickstart

1. Open `https://coe-prototypes.vercel.app/sandbox/new` and create a scenario. Pick the **Teams** template. (Deletion and AI-configuration are gated by a shared internal dev password — ask the team.)
2. Note the `scenarioId` you got back (something like `onboarding-nudge-a7c4`).
3. From your agent, POST a message:

```bash
curl -X POST https://coe-prototypes.vercel.app/api/sandbox/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "scenarioId": "onboarding-nudge-a7c4",
    "agentName": "Onboarding Coach",
    "text": "Hi Alice — looks like you haven'\''t completed your IT setup yet. Want a hand?",
    "actions": [
      { "label": "Yes, walk me through it", "action": "start_setup", "primary": true },
      { "label": "Not now", "action": "dismiss" }
    ]
  }'
```

4. Open the demo URL in a browser. The message appears in chat within ~2 seconds (the template polls `/messages` every 2s).

That's the whole loop. Everything else in this guide is detail on the message shape, state mutations, and the create/delete API.

---

## 2. Message shape

Every message — whether posted via webhook or `POST /messages` — has this shape:

```json
{
  "from": "agent",
  "to": "consultant",
  "text": "Markdown-supported body.",
  "actions": [
    { "label": "Approve", "action": "approve", "primary": true },
    { "label": "Reject", "action": "reject" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | string | yes | Persona `id`, or `"agent"`, or persona name. Drives avatar, sender label, and which side the bubble sits on. If `from` equals the active viewer's persona id, the bubble renders right-aligned ("you"); otherwise left-aligned. |
| `to` | string | no | Semantic only. Not displayed. Useful for your agent's internal routing. |
| `text` | string | yes | Markdown supported: bold, italic, links, code, code blocks, blockquotes (`>`), bullet + numbered lists. |
| `actions` | array | no | Adaptive-card-style buttons rendered under the bubble. See §3. |
| `timestamp` | number | server | Auto-set in milliseconds since epoch on insert. Don't send it. |
| `id` | string | server | Auto-generated. Don't send it. |

**Persona attribution.** When you create a scenario you define one or more personas (`name`, `role`, `initials`). The first persona is the active viewer by default. Use `from: "<persona_id>"` to attribute messages — the template generates ids by slugifying the persona's role (or name) on create. Posting messages with a brand-new `from` value still works; the avatar will just show the initials it can infer.

---

## 3. Action buttons (adaptive cards)

Send `actions` to render Microsoft-Teams-style adaptive-card buttons under a message:

```json
{
  "from": "agent",
  "text": "Your timesheet for week ending 15 May is missing Thursday and Friday.",
  "actions": [
    { "label": "Submit now", "action": "open_timesheet", "primary": true },
    { "label": "Remind me Monday", "action": "snooze" },
    { "label": "I was on leave", "action": "log_leave" }
  ]
}
```

| Action field | Type | Notes |
|---|---|---|
| `label` | string, required | The visible button text. |
| `action` | string, optional | Identifier your agent uses to route the click. Round-trips back to you (see below). |
| `primary` | boolean, optional | When `true`, renders as the filled primary-style button. Use sparingly — one primary per card is conventional. |

**Click behaviour.** The default template handler posts the `label` back as a user message from the active persona — that means the click shows up as a new entry in `GET /messages` with `from: "<persona_id>"` and `text: "<the button label>"`. Your agent can then react to it on its next poll or webhook tick.

If you want richer click semantics (open URL, etc.), the `action` field is forwarded too — your agent sees it on the message poll. Treat `label` as the human-readable acknowledgement, `action` as the machine identifier.

---

## 4. State and the calendar rail

The Teams template renders **two** state-driven surfaces:

- **Chat** — driven by `/messages` (not state). Covered above.
- **Calendar rail** — driven by `state.calendar`. The rest of the state object is stored but not rendered by the Teams template (it'll show up on Workday/Excel surfaces if you wire those later).

### `state.calendar` shape

```json
{
  "calendar": [
    { "day": "Mon", "startHour": 9,    "duration": 0.5, "title": "Daily standup" },
    { "day": "Wed", "startHour": 14,   "duration": 1.0, "title": "Sprint review", "color": "#1f7a3c" },
    { "day": "Thu", "startHour": 10.5, "duration": 2.0, "title": "Workshop",      "color": "#b64400" }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `day` | `"Mon"…"Sun"` | Required. Must match exactly — three-letter, title-case. |
| `startHour` | number 0–24 | Hour of day; decimals OK (`10.5` = 10:30). |
| `duration` | number | Hours. Decimals OK. Minimum visible height is enforced. |
| `title` | string | Shown in the event bar. |
| `color` | hex string | Optional. Defaults to Teams purple `#5b5fc7`. |
| `accent` | hex string | Optional. Left-border colour; defaults to a darker shade of `color`. |

### Setting state

Two patterns. Use whichever fits your agent code:

**Inline with a webhook message** (easiest — one round trip):

```bash
curl -X POST https://coe-prototypes.vercel.app/api/sandbox/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "scenarioId": "your-id",
    "agentName": "Calendar Bot",
    "text": "I'\''ve added the workshop to your calendar.",
    "stateUpdates": {
      "calendar": [
        { "day": "Thu", "startHour": 10.5, "duration": 2.0, "title": "Workshop" }
      ]
    }
  }'
```

**Direct state POST** (no message):

```bash
curl -X POST https://coe-prototypes.vercel.app/api/sandbox/scenarios/your-id/state \
  -H 'Content-Type: application/json' \
  -d '{
    "calendar": [
      { "day": "Thu", "startHour": 10.5, "duration": 2.0, "title": "Workshop" }
    ]
  }'
```

### Merge semantics

State updates are **shallow-merged by top-level key**.

- Sending `{ "calendar": [...] }` **replaces** the whole `calendar` array (it's not deep-merged element-by-element).
- Sending `{ "escalation": { "nudgeCount": 1 } }` merges the inner object — existing keys in `escalation` are preserved, `nudgeCount` is overwritten.
- Other top-level state keys you set (`workers`, `timesheet`, anything custom) are preserved verbatim but only `calendar` is currently visualised on the Teams template.

To wipe and reset, hit `DELETE /api/sandbox/scenarios/:id/state`.

---

## 5. Reading state and messages from your agent

Useful when your agent is reactive (responds to user clicks/inputs) rather than push-only.

```bash
# Current state (no messages)
curl https://coe-prototypes.vercel.app/api/sandbox/scenarios/your-id/state

# All chat history
curl https://coe-prototypes.vercel.app/api/sandbox/scenarios/your-id/messages

# Only messages newer than a cursor
curl 'https://coe-prototypes.vercel.app/api/sandbox/scenarios/your-id/messages?since=1715678400000'
```

The `since` parameter is a millisecond timestamp. Use the `timestamp` of the last message you saw, not `Date.now()` (network skew will drop messages).

**Polling pattern:**

```js
let cursor = 0;
setInterval(async () => {
  const r = await fetch(`/api/sandbox/scenarios/your-id/messages?since=${cursor}`);
  const { messages } = await r.json();
  for (const m of messages) {
    cursor = Math.max(cursor, m.timestamp);
    if (m.from === 'agent') continue;       // skip our own
    await myAgent.handle(m);                // your reactive logic
  }
}, 2000);
```

---

## 6. Cold-start behaviour (read this once)

Scenario *definitions* persist in Vercel KV — they survive cold-starts, restarts, and Vercel deploys.

Scenario *state and messages* live in the function process's memory and **reset on cold-start** — roughly after 15 minutes of inactivity, or whenever Vercel reschedules the function. This is fine for live-driven demos (your agent re-populates state on its first webhook call) but it means:

- You can't create a scenario, walk away for an hour, and expect old chat history to still be there.
- If your demo depends on pre-seeded state, your agent should idempotently re-apply that state on every cold-start. The cheapest pattern: have your agent ping `GET /state` on startup; if the state object is empty / missing your expected keys, push fresh `stateUpdates` before the demo runs.

If long-lived state matters for your use case, raise it — we can wire scenario state into KV too, it just costs a write per mutation instead of being free.

---

## 7. The self-serve create flow (API)

The form at `/sandbox/new` is the easy path. If you'd rather provision scenarios programmatically (e.g. one-per-CI-run):

```bash
curl -X POST https://coe-prototypes.vercel.app/api/sandbox/scenarios \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Onboarding nudge demo",
    "agent": "Onboarding Coach",
    "description": "Walks a new hire through their IT setup.",
    "template": "teams",
    "personas": [
      { "name": "Alice Chen", "role": "New Hire" },
      { "name": "IT Helpdesk", "role": "Support" }
    ],
    "openingMessage": "Hi Alice — welcome to the team!"
  }'
```

Response:

```json
{
  "id": "onboarding-nudge-demo-a7c4",
  "demoUrl": "https://coe-prototypes.vercel.app/sandbox/demo/?scenario=onboarding-nudge-demo-a7c4",
  "webhookUrl": "https://coe-prototypes.vercel.app/api/sandbox/webhook",
  "scenario": { /* full sanitised scenario */ }
}
```

### Delete

Gated by the shared internal dev password (ask the team). Pass it as the `X-Dev-Password` header:

```bash
curl -X DELETE https://coe-prototypes.vercel.app/api/sandbox/scenarios/onboarding-nudge-demo-a7c4 \
  -H 'X-Dev-Password: <password>'
```

---

## 8. Full route reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/sandbox/scenarios` | List all scenarios (seeded + user-created). |
| `POST` | `/api/sandbox/scenarios` | Create a user scenario. |
| `GET` | `/api/sandbox/scenarios/:id` | Get one scenario definition. |
| `DELETE` | `/api/sandbox/scenarios/:id` | Delete a user scenario. Requires `X-Dev-Password` header. |
| `POST` | `/api/sandbox/scenarios/:id/configure` | AI-configure the agent. Requires `X-Dev-Password` header. Body: `{description}`. |
| `GET` | `/api/sandbox/scenarios/:id/state` | Read current mutable state. |
| `POST` | `/api/sandbox/scenarios/:id/state` | Shallow-merge updates into state. |
| `DELETE` | `/api/sandbox/scenarios/:id/state` | Reset state to scenario's `initialState`. |
| `GET` | `/api/sandbox/scenarios/:id/messages?since=ts` | Chat history; `since` is a millisecond timestamp cursor. |
| `POST` | `/api/sandbox/scenarios/:id/messages` | Post one message. |
| `POST` | `/api/sandbox/webhook` | One-shot: message + optional state update. Body must include `scenarioId`. |

All endpoints are CORS-enabled. No auth (yet). Don't put real data in the sandbox.

---

## 9. Common pitfalls

- **Calendar events not showing up?** Check the `day` field is one of `"Mon"…"Sun"` exactly — not `"Monday"`, not lowercase. The template selects DOM columns by `[data-day="Mon"]` literally.
- **Bubble appears on the wrong side?** The bubble side is determined by `msg.from === currentPersona.id`. The active persona is the first one in your scenario's `personas` array. If you want the agent's reply to be left-aligned, use `from: "agent"` (not the user's persona id).
- **Action buttons aren't clickable?** Check you're using `actions` (plural) on the message body, and that each action has a `label`. Buttons without `label` are skipped silently.
- **Markdown not rendering?** The template's renderer supports basic GFM (bold, italic, code, links, lists, blockquotes, tables). It does **not** support raw HTML inside markdown — `<script>` and friends are stripped.
- **`since=` returning everything?** You probably sent a string. The cursor is parsed as `Number(since)`; non-numeric values become `NaN` and the filter passes everything through.
- **Got a 503 on `POST /scenarios`?** KV isn't connected. Project owner needs to wire the Redis instance in Vercel → Storage → Connect Project.

---

## 10. Worked example: a stateful nudge agent

End-to-end pattern your agent can follow:

```js
const BASE = 'https://coe-prototypes.vercel.app';
const SCENARIO = 'onboarding-nudge-demo-a7c4';

// 1. Seed state on cold-start (idempotent)
async function ensureState() {
  const { state } = await fetch(`${BASE}/api/sandbox/scenarios/${SCENARIO}/state`).then(r => r.json());
  if (!state.calendar) {
    await fetch(`${BASE}/api/sandbox/scenarios/${SCENARIO}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendar: [
          { day: 'Mon', startHour: 9, duration: 0.5, title: 'Daily standup' },
        ],
        progress: { steps: ['it_setup', 'manager_intro', 'training'], completed: [] },
      }),
    });
  }
}

// 2. Push the opening nudge (with adaptive-card buttons)
async function nudge() {
  await fetch(`${BASE}/api/sandbox/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenarioId: SCENARIO,
      agentName: 'Onboarding Coach',
      text: 'Welcome Alice! Want to start with **IT setup** or **meeting your manager**?',
      actions: [
        { label: 'IT setup',         action: 'step:it_setup',     primary: true },
        { label: 'Meet my manager',  action: 'step:manager_intro' },
      ],
    }),
  });
}

// 3. Poll for clicks and react
let cursor = Date.now();
setInterval(async () => {
  const { messages } = await fetch(`${BASE}/api/sandbox/scenarios/${SCENARIO}/messages?since=${cursor}`).then(r => r.json());
  for (const m of messages) {
    cursor = Math.max(cursor, m.timestamp);
    if (m.from === 'agent' || m.source === 'webhook') continue;
    // m.text is the button label; the action id rode along but the default
    // click handler doesn't echo it back — match on label or on a slug of it.
    if (m.text === 'IT setup') {
      await fetch(`${BASE}/api/sandbox/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: SCENARIO,
          agentName: 'Onboarding Coach',
          text: 'Great — first thing: set up your laptop password manager.',
          stateUpdates: { progress: { completed: ['it_setup_started'] } },
        }),
      });
    }
  }
}, 2000);

await ensureState();
await nudge();
```

That's the whole pattern: idempotent state seed, push the opener with actions, poll for clicks, react with messages + state mutations.

---

*Internal — AI Centre of Excellence. Sandbox is for development and testing only; no real employee or client data.*
