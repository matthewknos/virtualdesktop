# CoE Sandbox

A shared mock backend + reusable chat surfaces for testing CoE agents without rebuilding the chrome for every demo. Hosted at `coe-prototypes.vercel.app/sandbox`.

## What it is

- **API** (`api/sandbox.js`) — Vercel serverless function exposing scenarios, mutable per-scenario state, a chat message bus, and a webhook for external agents to push messages in.
- **Landing** (`sandbox/index.html`) — scenario picker + inline API reference.
- **Router** (`sandbox/demo/index.html`) — reads `?scenario=<id>` from the URL, fetches the scenario, redirects to the correct surface (`./templates/<template>/?scenario=...`).
- **Templates** (`sandbox/templates/{teams,excel,workday}/`) — reusable chrome that hydrates from the API.

## Scenarios

Seeded in `api/sandbox.js`:

| id | agent | template |
|---|---|---|
| `timesheet-chaser` | Timesheet Reminder Agent | teams |
| `sickness-absence` | Sickness Absence Framework Coach | teams |
| `probation-review` | Probation Review Orchestrator | workday |

Each scenario carries: `personas[]`, `initialState`, optional `template`. State is shallow-merge mutable via the API.

## Templates

- **teams** — full Microsoft Teams replica with chat, rail switch (chat/calendar), 2-second message polling, post + reset. The only template with an active message loop today.
- **workday** — read-only Workday-styled state viewer (dashboards, workers, timesheets, absence, raw-state). No chat loop; suits scenarios where the agent action is observable in mutated state rather than chat.
- **excel** — Excel-styled flat grid renderer over `state.workers` / `state.employees` / `state.timesheet.days`. Read-only. Currently unused by any seeded scenario.

## API surface

Base: `/api/sandbox`. A `vercel.json` rewrite forwards `/api/sandbox/:path*` to the handler so its internal regex routing receives sub-paths.

```
GET    /api/sandbox/scenarios                       → { scenarios: [...] }
GET    /api/sandbox/scenarios/:id                   → full scenario
GET    /api/sandbox/scenarios/:id/state             → current mutable state
POST   /api/sandbox/scenarios/:id/state             → shallow-merge top-level keys
DELETE /api/sandbox/scenarios/:id/state             → reset to initialState
GET    /api/sandbox/scenarios/:id/messages?since=ts → chat history (ms cursor)
POST   /api/sandbox/scenarios/:id/messages          → { from, text, persona? }
POST   /api/sandbox/webhook                         → external agent → sandbox
                                                       body: { scenarioId, message, stateUpdates? }
```

## Client

`sandbox/sandbox-client.js` exposes `window.SandboxClient` with one method per route:

```html
<script src="/sandbox/sandbox-client.js"></script>
<script>
  const c = new SandboxClient('');           // empty base = same-origin
  const s = await c.getScenario('timesheet-chaser');
  await c.postMessage('timesheet-chaser', { from: 'agent', text: 'Hi Alice…' });
  const msgs = await c.getMessages('timesheet-chaser', { since: 0 });
</script>
```

## External agent integration

Point your agent at the webhook to push messages and state updates:

```bash
curl -X POST https://coe-prototypes.vercel.app/api/sandbox/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "scenarioId": "timesheet-chaser",
    "message": { "from": "agent", "text": "Friday afternoon nudge — still missing Thu/Fri.", "persona": "agent" },
    "stateUpdates": { "escalation": { "nudgeCount": 1 } }
  }'
```

The Teams template polls `/messages` every 2 seconds and will render new messages automatically.

## Adding a scenario

1. Append a new entry to `SCENARIOS` in `api/sandbox.js` — `id`, `name`, `agent`, `template`, `description`, `personas[]`, `initialState`.
2. Pick a template (`teams` if you need chat, `workday`/`excel` if read-only).
3. Surface it on the landing page if needed (`sandbox/index.html` already auto-lists via `client.listScenarios()`).

## Caveats

- **State resets on cold-start.** The in-memory `runtime` Map lives inside the function process. Warm invocations preserve state; cold-starts wipe it. Fine for single-session demos; wire Vercel KV if you need persistence across sessions.
- **No auth.** Anyone with the URL can read/write any scenario's state. Don't put real data in here.
- **`probation-review` routes to the `workday` template, which has no chat loop.** The scenario is observable as state mutations only — no conversational surface. Don't expect to talk to the agent in this scenario from the sandbox; standalone demos under `/probation` still own the chat experience for that agent.
- **Existing one-off demos under `/sickness-absence/demo`, `/r-and-r/demo`, `/probation` are standalone and do not call the sandbox API.** The sandbox is for new integration testing, not retrofitting the existing demos.
