# CoE Mock Platform — Build Plan

A high-fidelity, spec-driven mock of Microsoft Graph and Workday, designed so that any agent written against it can be cut over to production with only a base-URL/auth swap. The mock is also the data layer for a forthcoming "virtual desktop" demo UI (Teams / Outlook / Workday as switchable apps over a shared store).

This document is the build plan. The companion document — [`API_GUIDE.md`](./API_GUIDE.md) — is the developer-facing reference for what the mock exposes and how to call it.

---

## 1. Guiding principles

1. **Spec-driven, not endpoint-driven.** Microsoft and Workday both publish machine-readable API specs. We load them once and dispatch generically. We do not hand-write 200 route handlers.
2. **Fidelity over breadth on day one.** A small set of endpoints that behave *exactly* like prod (envelopes, errors, pagination, throttling, ETags) is more valuable than a wide set that diverges. Wrong behaviour in the mock turns into "works in sandbox, breaks in prod" bugs later.
3. **Agent-agnostic.** The mock is built before any specific agent rewires against it. No endpoint exists because "the Timesheet Reminder needed it."
4. **One coherent identity layer.** Workday Workers and Graph Users are projections of the same underlying people. Email addresses, manager chains, and org structure line up across both systems automatically.
5. **Tenant isolation.** Every demo runs in its own tenant. State never leaks between scenarios. Resetting a tenant wipes one slice cleanly.
6. **Strict validation.** Inbound request bodies are validated against the spec. Bad requests return Graph/Workday-shaped 400 errors. The mock fails the way prod fails.
7. **No mocked auth.** Sandbox accepts any `Bearer` token. Documented as the single known fidelity gap. Real OAuth flows are explicitly out of scope.

---

## 2. Target architecture

```
api/
  mock/
    PLAN.md                          ← this file
    API_GUIDE.md                     ← developer reference for the mock surface
    graph/
      [...path].js                   ← single catch-all Vercel function for Graph
    workday/
      [...path].js                   ← single catch-all Vercel function for Workday
    _specs/
      graph/                         ← Microsoft Graph OpenAPI + CSDL (committed)
      workday/                       ← Workday REST API v1 OpenAPI per service
      raas/                          ← hand-authored RaaS report definitions
    _lib/
      spec-loader.js                 ← parse specs → entity + operation registry
      router.js                      ← URL pattern → entity + operation
      odata-query.js                 ← $filter / $select / $expand / $top / $skip / $orderby / $search / $count
      store.js                       ← KV-backed CRUD, namespaced per tenant
      fidelity.js                    ← envelope, errors, pagination tokens, throttling, ETags, request IDs
      validator.js                   ← request body validation against entity schema
      tenant.js                      ← tenant resolution + isolation helpers
      seed/
        identity.js                  ← canonical people + org chart
        graph-projection.js          ← project identity into Graph entities
        workday-projection.js        ← project identity into Workday entities
        scenarios/                   ← scenario packs as JSON deltas
      actions/
        graph/
          send-mail.js
          reply.js
          reply-all.js
          channel-post.js
          chat-post.js
          create-event.js
          accept-event.js
          ...
        workday/
          submit-time-entry.js
          request-absence.js
          approve-absence.js
          submit-timesheet.js
          ...
        raas/
          report-runner.js           ← generic RaaS executor over registered reports
```

Two catch-all routes (one per system) keep Vercel function count low. Everything dispatches through the engine in `_lib/`.

---

## 3. Phased delivery

### Phase 1 — Foundation (no agents, no UI changes)

**Goal:** Engine boots. Any entity in the loaded specs is reachable via generic CRUD. Fidelity contract holds.

1. **Pull specs into the repo.**
   - Graph: clone the relevant slice of `microsoftgraph/msgraph-metadata` (v1.0 OpenAPI YAML). Commit under `_specs/graph/`.
   - Workday: download OpenAPI specs for the Tier-1 services (Staffing, Absence Management, Time Tracking, Compensation, Payroll). Commit under `_specs/workday/`.
   - Lock spec versions. Note the version in `_specs/VERSIONS.md`.
2. **Spec loader.** Parse OpenAPI/CSDL into an in-memory registry: `{ entityName → { schema, operations, pathTemplates } }`. Cold-start cost is fine — this is a long-lived warm function on Vercel.
3. **Router.** Match the request path against the registry's path templates. Produce a typed handler invocation: `(operation, entityType, ids, query, body) → response`.
4. **Store.** KV-backed CRUD keyed as `mock:{system}:{tenant}:{entityType}:{id}` plus per-type index keys. Tenant resolved from a header or query param (`X-Mock-Tenant` / `?tenant=`).
5. **Fidelity layer.**
   - Graph: `@odata.context`, `@odata.nextLink`, `@odata.count`, GUID IDs, ISO-8601 timestamps, `{ error: { code, message, innerError: { date, request-id, client-request-id } } }`.
   - Workday: `{ data, total }` envelope, WID-format IDs (32-char hex), Workday error shape.
   - Headers: `request-id`, `client-request-id`, `Retry-After` on 429, `ETag` on resources that support it.
   - Throttling toggle per tenant: when on, a percentage of requests return 429 with realistic `Retry-After`.
6. **OData query engine.** Support `$filter` (`eq`, `ne`, `gt`, `ge`, `lt`, `le`, `and`, `or`, `not`, `contains`, `startswith`, `endswith`), `$select`, `$top`, `$skip`, `$orderby`, `$count`, `$search`. `$expand` deferred to Phase 2 — flag clearly when unsupported.
7. **Validator.** Inbound bodies validated against the entity schema from the spec. Failures return spec-shaped 400s.
8. **Smoke harness.** A simple `npm run smoke` script that hits every Tier-1 entity's list + get + create + update + delete and asserts envelope/error shapes. This is the regression net.

**Exit criteria:** A `curl` against `/api/mock/graph/v1.0/users` returns a Graph-shaped envelope with seeded users. POSTing a malformed body returns a Graph-shaped 400.

---

### Phase 2 — Realism

**Goal:** Seed data is coherent, plausible, and relationally consistent across both systems. The non-CRUD verbs work.

9. **Identity layer.** A canonical `Person` model (name, email, role, manager, hire date, location, etc.) seeded by faker with a tenant-deterministic seed. ~50 people per tenant by default, configurable.
10. **Graph projection.** Identity → `users`, `groups`, `teams` (with `channels`, members), `chats` (1:1 and group), mailbox bootstrap, calendar bootstrap.
11. **Workday projection.** Identity → `workers`, `positions`, `organizations`, `compensation`, `pto_balances`, `time_entry_periods`.
12. **Scenario packs.** A scenario is a JSON delta applied on top of a tenant's base seed. Format: `{ tenant, baseTenant?, deltas: [...] }`. Examples to ship: `q4-timesheet-rush`, `new-hire-onboarding`, `mass-absence-event`, `probation-review-due`.
13. **Actions (Graph).** Hand-rolled handlers for the verbs that aren't generic CRUD: `sendMail`, `reply`, `replyAll`, `forward`, channel/chat `messages` POST, `events` create + accept + decline, `move` (mail folder), `markAsRead`.
14. **Actions (Workday).** `submitTimeEntry`, `submitTimesheet`, `requestAbsence`, `approveAbsence`, `cancelAbsence`. Each updates relational state (e.g., approving an absence decrements PTO balance, posts a calendar event, sends a Graph notification mail).
15. **RaaS registry.** Hand-authored JSON definitions for custom reports — input params, output columns, query against the store. Generic runner handles execution. Ship 3-4 example reports.
16. **Cross-system effects.** Approving a Workday absence posts a Graph calendar event for the worker. Sending a Graph mail from one user to another lands in the recipient's mailbox. These hooks live in `_lib/effects/`.

**Exit criteria:** A scenario pack loads cleanly. Calling `sendMail` from user A to user B causes user B's `/me/messages` to show the new mail. Approving an absence in Workday adds an OOF event to the user's Graph calendar.

---

### Phase 3 — Virtual desktop UI

**Goal:** The `/sandbox` surface becomes a windowed "computer" with switchable apps, each a pure reader of mock state.

17. **Desktop shell.** `/VirtualDesktop/` — window manager, app launcher, tenant selector, scenario loader, throttling toggle, reset button. State persisted to localStorage.
18. **Outlook app.** `/sandbox/apps/outlook/` — inbox, folders, compose, reply, calendar view, event detail. Reads from `/api/mock/graph` only.
19. **Teams app.** `/sandbox/apps/teams/` — channels, chats, message composer, mentions, reactions. Reads from `/api/mock/graph` only.
20. **Workday app.** `/sandbox/apps/workday/` — worker profile, org chart, timesheet entry, absence request, PTO balance, manager approvals queue. Reads from `/api/mock/workday` only.
21. **Live updates.** Long-poll or SSE channel so an agent posting to Graph causes the Teams app to render the new message within a couple of seconds. Same model as the existing sandbox poll loop.
22. **App scaffolding.** A thin `MockApp` class with mount/unmount, focus state, and a standard chrome (title bar, close, minimize). New apps drop in with minimal boilerplate.
23. **Existing prototypes migration.** The current `/sandbox/templates/{teams,workday,excel}/` get retired or re-pointed at the new apps. Existing scenarios continue to work during the transition via a compatibility shim.

**Exit criteria:** Open the desktop, switch tenants to `acme-corp`, launch Teams + Outlook + Workday side-by-side. An agent posts a Teams message via Graph — it appears in the Teams app live.

---

### Phase 4 — Agent harness (per-agent, ongoing)

**Goal:** Existing prototypes rewired against the mock through a thin client abstraction. Prod cutover documented.

24. **`GraphClient` / `WorkdayClient`.** Minimal wrappers: base URL from env, bearer token from env, request shaping, retry on 429 with `Retry-After`, error parsing. No SDK dependency.
25. **Cutover contract.** `.env.example` shows `GRAPH_BASE_URL`, `GRAPH_TOKEN`, `WORKDAY_BASE_URL`, `WORKDAY_TOKEN`, `MOCK_TENANT`. Sandbox values vs. prod values documented side-by-side.
26. **First migration.** Timesheet Reminder Agent rewired against `GraphClient` + `WorkdayClient`. End-to-end demo runs in the new desktop UI.
27. **Migration playbook.** Short doc on how to migrate any agent — inventory the endpoints it touches, swap fetch calls for the client, add a `.env.local`, run the smoke harness.

**Exit criteria:** Timesheet Reminder Agent runs identically against the mock and (in principle, untested for real) against prod with only env-var changes.

---

## 4. Decisions log

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Per-endpoint files vs. catch-all | Catch-all per system | Two Vercel functions total. Avoids file-count sprawl. |
| 2 | Persistence | Vercel KV | Already in deps. Per-tenant namespacing in the key. |
| 3 | Auth | Accept any `Bearer` | OAuth out of scope. Documented gap. |
| 4 | Validation | Strict against spec | Mock must fail like prod fails. |
| 5 | `$expand` support | Phase 2+, partial | Hard to do generically. Whitelist common expansions per entity. |
| 6 | RaaS approach | Hand-authored report definitions | No spec for custom reports. Treat as a separate registry. |
| 7 | Throttling | Per-tenant toggle | Off by default. On for "resilience demo" scenarios. |
| 8 | Webhooks / Change notifications | Out of scope for Phase 1-3 | Most agents can poll. Revisit if a specific demo needs it. |
| 9 | Spec version pinning | Yes, in `_specs/VERSIONS.md` | Spec drift is the silent killer of a mock. |
| 10 | Tenant resolution | Header `X-Mock-Tenant` with `?tenant=` fallback | Default `dev` tenant if absent. |

Open decisions to revisit before Phase 1 ships:

- **Graph beta vs v1.0.** Default to v1.0. Beta endpoints come on demand.
- **Workday version line.** WD's REST API has versioned endpoints (`/ccx/api/v1/...`). Pin one major version per service.
- **State export/import format.** Probably JSON dump of all KV keys under a tenant prefix. Useful for sharing scenarios.

---

## 5. Sizing and effort

Rough estimates, single contributor, focused sessions:

- Phase 1: ~5-7 sessions. Spec loader and OData engine are the long poles.
- Phase 2: ~4-5 sessions. Identity/projection is straightforward; actions are mostly small.
- Phase 3: ~5-6 sessions. Each app is a few hours; desktop shell + live updates are the bulk.
- Phase 4: ~1 session per agent migration.

Total to first end-to-end demo on the new stack: ~15-18 focused sessions.

---

## 6. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OData `$filter` parser is a rabbit hole | High | Medium | Ship a limited but correct subset. Document what isn't supported. Return 400 for unsupported operators rather than wrong results. |
| KV size limits at scale | Medium | Low | Tenant data is small. If a tenant grows past limits, paginate the seed itself. |
| Spec drift over time | Medium | Medium | Pin versions; CI job can diff committed specs against upstream monthly. |
| Vercel cold-start cost of loading large specs | Medium | Low | Spec parse is one-time per warm instance. Pre-parse to compact JSON at build time if needed. |
| Workday's REST surface is less complete than Graph | High | Medium | RaaS bridges the gap. Document what real Workday integrations look like (RaaS-heavy) so demos are realistic. |
| "Works in mock, breaks in prod" via mocked-away auth | Medium | High | Document the auth gap loudly. Add an obvious banner to the desktop UI. Encourage agents to centralize auth in the client so swap-in is mechanical. |
| Cross-system effects become a tangled web | Medium | Medium | Keep effects unidirectional and explicit. One effect = one named hook in `_lib/effects/`. No magic. |

---

## 7. What's explicitly out of scope

- OAuth, MSAL, token endpoints, app registrations.
- Webhooks, Graph change notifications, Workday push subscriptions.
- SharePoint, OneDrive, Planner, Viva, Power Platform — Tier 3, add when a demo needs it.
- Workday Studio integrations, EIBs, RaaS report *authoring* (just executing pre-defined reports).
- Multi-region behaviour, sovereign clouds (GCC, GCC High, etc.).
- Anything resembling real PII. Seed data is faker-generated and obviously synthetic.

---

## 8. Next action

Start Phase 1, step 1: pull the Graph metadata repo's v1.0 OpenAPI YAML into `_specs/graph/` and pin the version. Then sketch the spec loader against it. The first thing that should work end-to-end is `GET /api/mock/graph/v1.0/users` returning a Graph-shaped envelope of seeded users.
