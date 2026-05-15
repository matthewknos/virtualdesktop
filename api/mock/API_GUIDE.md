# CoE Mock Platform — API Guide

Developer reference for the mocked Microsoft Graph and Workday surfaces hosted at `/api/mock/graph/*` and `/api/mock/workday/*`. The companion document — [`PLAN.md`](./PLAN.md) — covers how the platform is built and the phased delivery roadmap. This document covers **how to call it** and **what it guarantees**.

---

## 1. The fidelity contract

The mock matches the real APIs on the things agents actually depend on:

- **Response envelopes.** Graph wraps collections in `{ "@odata.context", "value", "@odata.nextLink", "@odata.count" }`. Workday v1 wraps in `{ data, total }`. Both are reproduced exactly.
- **IDs.** Graph IDs are real GUIDs (`8c5f1234-...`). Workday IDs are WIDs (32-char lowercase hex). Both are stable per tenant per seed.
- **Timestamps.** ISO-8601 with `Z` suffix everywhere. Graph's `createdDateTime`, `lastModifiedDateTime`, etc., are all populated.
- **Errors.** Graph errors return `{ error: { code, message, innerError: { date, request-id, client-request-id } } }`. Workday errors return Workday's own shape (see §7). Status codes match.
- **Pagination.** Opaque `@odata.nextLink` tokens, not page numbers. Workday uses `offset` + `limit`.
- **Throttling.** When a tenant has throttling enabled, a configurable percentage of requests return `429 Too Many Requests` with a `Retry-After` header in seconds. Clients that retry correctly will succeed.
- **ETags.** Resources that support optimistic concurrency in real Graph return `@odata.etag` and accept `If-Match` headers. Conflicts return `412 Precondition Failed`.
- **Request IDs.** Every response includes `request-id` and `client-request-id` headers. Echoed back in error envelopes.
- **Validation.** Bodies are validated against the spec's entity schemas. Bad bodies return spec-shaped 400s with field-level detail.

What the mock does **not** match:

- **Authentication.** Any `Bearer <anything>` is accepted. No OAuth flow, no token introspection, no app permissions. Documented gap.
- **Webhooks / change notifications.** Subscription endpoints exist as stubs that 200 but never fire. Use polling.
- **Rate limit accounting.** Throttling is probabilistic, not bucketed.
- **Eventual consistency.** Writes are immediately readable. Real Graph sometimes lags by seconds.

---

## 2. Base URLs and routing

```
Microsoft Graph mock:  /api/mock/graph/v1.0/*
Workday mock:          /api/mock/workday/ccx/api/v1/{service}/*
Workday RaaS mock:     /api/mock/workday/ccx/service/customreport2/{tenant}/{report}
```

Hosted at `https://coe-prototypes.vercel.app` and locally on whatever your dev port is. Path segments after `/v1.0` (Graph) or `/ccx/api/v1` (Workday) are matched against the loaded OpenAPI specs.

A `vercel.json` rewrite forwards `/api/mock/graph/:path*` and `/api/mock/workday/:path*` into the two catch-all handlers.

---

## 3. Tenants and isolation

Every request runs against a **tenant** — an isolated state slice. Tenants are resolved in priority order:

1. Header: `X-Mock-Tenant: acme-corp`
2. Query: `?tenant=acme-corp`
3. Default: `dev`

Tenants are created on first use with a deterministic faker seed derived from the tenant name. So `acme-corp` always has the same 50 people, same org chart, same calendar. Two demos can run concurrently on different tenants without colliding.

Reset a tenant:

```bash
curl -X DELETE /api/mock/_tenant/acme-corp
```

Snapshot a tenant (for sharing):

```bash
curl /api/mock/_tenant/acme-corp/export > snapshot.json
curl -X POST /api/mock/_tenant/acme-corp/import \
  -H 'Content-Type: application/json' \
  --data-binary @snapshot.json
```

Toggle throttling for a tenant:

```bash
curl -X POST /api/mock/_tenant/acme-corp/settings \
  -H 'Content-Type: application/json' \
  -d '{ "throttle": { "enabled": true, "rate": 0.1, "retryAfterSeconds": 5 } }'
```

---

## 4. Authentication

Send any bearer token. The mock does not validate it.

```http
Authorization: Bearer ANY-STRING
X-Mock-Tenant: acme-corp
```

If you omit the `Authorization` header entirely, the mock returns a Graph-shaped 401 — useful for testing your client's auth error handling.

For agents that will eventually run against real Graph/Workday, centralize the token acquisition in your client so the swap is one line. See `GraphClient` / `WorkdayClient` in Phase 4 of the [plan](./PLAN.md).

---

## 5. OData query support (Graph)

Supported on collection endpoints unless noted otherwise per-entity:

| Operator | Support | Examples |
|---|---|---|
| `$select` | Full | `$select=id,displayName,mail` |
| `$filter` | Partial | See operator table below |
| `$top` | Full | `$top=25` (max 999) |
| `$skip` | Full | `$skip=50` |
| `$orderby` | Full | `$orderby=displayName desc` |
| `$count` | Full | `$count=true` → adds `@odata.count` |
| `$search` | Partial | `$search="alice"` — string-contains across indexed fields |
| `$expand` | Limited | Whitelisted per entity. Returns 501 if unsupported. |
| `$format` | No | JSON only. |

`$filter` operators:

| Operator | Supported |
|---|---|
| `eq`, `ne`, `gt`, `ge`, `lt`, `le` | Yes |
| `and`, `or`, `not` | Yes |
| `contains(field, 'x')` | Yes |
| `startswith(field, 'x')` | Yes |
| `endswith(field, 'x')` | Yes |
| `any` / `all` on collections | Phase 2 |
| Lambda expressions | Phase 2 |
| Arithmetic in filters | No |

Unsupported operators return `400 Bad Request` with `code: "BadRequest"` and a message naming the unsupported feature — never silent partial matches.

Pagination tokens are opaque base64 blobs. Treat `@odata.nextLink` as a URL to GET as-is.

---

## 6. Query support (Workday)

Workday v1 uses simpler query semantics:

| Param | Meaning |
|---|---|
| `limit` | Page size, default 100, max 100 |
| `offset` | Items to skip |
| `effective` | Effective date for time-bound resources (`YYYY-MM-DD`) |
| `search` | String search across resource-specific fields |

Most resource-specific filters are path-segment or named query params, not a generic `$filter`. Each entity in the catalog (§9) notes which filters it supports.

---

## 7. Error shapes

**Graph:**

```json
{
  "error": {
    "code": "BadRequest",
    "message": "Property 'foo' is not a valid OData identifier.",
    "innerError": {
      "date": "2026-05-14T09:12:33.000Z",
      "request-id": "9c8f1234-aa11-...",
      "client-request-id": "9c8f1234-aa11-..."
    }
  }
}
```

Common codes used by the mock: `BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `MethodNotAllowed`, `PreconditionFailed`, `TooManyRequests`, `InternalServerError`, `NotImplemented`.

**Workday:**

```json
{
  "error": "Invalid request",
  "code": "INVALID_REQUEST",
  "details": [
    { "field": "endDate", "message": "endDate must be on or after startDate" }
  ]
}
```

Common codes: `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

---

## 8. Throttling

When throttling is enabled on a tenant, responses may include:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 5
Content-Type: application/json

{
  "error": {
    "code": "TooManyRequests",
    "message": "Request was throttled. Retry after 5 seconds.",
    "innerError": { ... }
  }
}
```

Honour `Retry-After`. The same request retried after the indicated delay will succeed (assuming the dice roll lands differently). Useful for demonstrating resilient retry behaviour in agents.

---

## 9. Entity catalog

Coverage tiers:

- **Tier 1** — seeded with realistic data, full CRUD, validated bodies, common query operators supported.
- **Tier 2** — engine-supported (any spec entity is queryable), but empty or sparse seed data. Returns valid empty collections.
- **Tier 3** — not exposed by the mock. Returns `404` or `501 NotImplemented` per spec convention.

### 9.1 Microsoft Graph — Tier 1

#### Users and groups

| Endpoint | Notes |
|---|---|
| `GET /v1.0/me` | Returns the calling-user identity. Defaults to first seeded user; override with `X-Mock-User-Id` header. |
| `GET /v1.0/users` | List users. `$select`, `$filter`, `$top`, `$skip`, `$orderby`, `$search`. |
| `GET /v1.0/users/{id}` | Single user. Accepts GUID or `userPrincipalName`. |
| `GET /v1.0/users/{id}/manager` | Manager record. |
| `GET /v1.0/users/{id}/directReports` | Direct reports collection. |
| `GET /v1.0/groups` | List groups. |
| `GET /v1.0/groups/{id}/members` | Group members. |

#### Mail

| Endpoint | Notes |
|---|---|
| `GET /v1.0/me/messages` | Inbox. `$filter` on `isRead`, `receivedDateTime`, `from`, `subject`. |
| `GET /v1.0/me/messages/{id}` | Single message. Includes full body. |
| `POST /v1.0/me/sendMail` | Action. Sends to recipients in the tenant — lands in their `/me/messages` immediately. |
| `POST /v1.0/me/messages/{id}/reply` | Action. |
| `POST /v1.0/me/messages/{id}/replyAll` | Action. |
| `POST /v1.0/me/messages/{id}/forward` | Action. |
| `PATCH /v1.0/me/messages/{id}` | Update `isRead`, flags. |
| `GET /v1.0/me/mailFolders` | Folder list. |

#### Calendar

| Endpoint | Notes |
|---|---|
| `GET /v1.0/me/events` | List events. `$filter` on `start/dateTime`, `end/dateTime`. |
| `GET /v1.0/me/calendar/calendarView` | Range-bounded view. Required `startDateTime` + `endDateTime`. |
| `POST /v1.0/me/events` | Create event. Attendees in the tenant get the invite mail. |
| `PATCH /v1.0/me/events/{id}` | Update event. |
| `DELETE /v1.0/me/events/{id}` | Cancel event. |
| `POST /v1.0/me/events/{id}/accept` | Action. |
| `POST /v1.0/me/events/{id}/decline` | Action. |
| `POST /v1.0/me/events/{id}/tentativelyAccept` | Action. |

#### Teams chat and channels

| Endpoint | Notes |
|---|---|
| `GET /v1.0/me/chats` | 1:1 and group chats for the calling user. |
| `GET /v1.0/chats/{id}/messages` | Messages in a chat. |
| `POST /v1.0/chats/{id}/messages` | Post a message. Other participants see it on their next poll. |
| `GET /v1.0/teams/{id}/channels` | Channels of a team. |
| `GET /v1.0/teams/{id}/channels/{id}/messages` | Messages in a channel. |
| `POST /v1.0/teams/{id}/channels/{id}/messages` | Post a message. Supports `mentions`, `attachments`. |

#### Presence

| Endpoint | Notes |
|---|---|
| `GET /v1.0/me/presence` | Current presence. |
| `GET /v1.0/users/{id}/presence` | Presence for any user. |

### 9.2 Microsoft Graph — Tier 2

Generic CRUD works against any entity in the loaded spec but with empty seed data: `sites`, `drives`, `driveItems`, `planner` (plans/tasks/buckets), `todo` (lists/tasks), `directoryRoles`, `subscribedSkus`, `applications`, `servicePrincipals`. Adding seed coverage is a one-line registration in `_lib/seed/graph-projection.js`.

### 9.3 Microsoft Graph — Tier 3 (not exposed)

`security/*`, `compliance/*`, `reports/*`, `communications/callRecords`, `print/*`, `education/*`, `identityGovernance/*`. Returns `404` or `501`.

### 9.4 Workday — Tier 1

#### Staffing

| Endpoint | Notes |
|---|---|
| `GET /workers` | List workers. Filters: `search`, `supervisoryOrganization`, `location`. |
| `GET /workers/{id}` | Worker detail. |
| `GET /workers/{id}/directReports` | Subordinates. |
| `GET /workers/{id}/positions` | Current and past positions. |
| `GET /supervisoryOrganizations` | Org structure. |

#### Time tracking

| Endpoint | Notes |
|---|---|
| `GET /workers/{id}/timeEntries` | Time entries. Filters: `fromDate`, `toDate`, `status`. |
| `POST /workers/{id}/timeEntries` | Create an entry. Validated: hours > 0, date within open period. |
| `PATCH /workers/{id}/timeEntries/{id}` | Update. |
| `POST /workers/{id}/timeEntries/{id}/submit` | Action. Moves to `submitted` status. |
| `POST /workers/{id}/timesheets/{period}/submit` | Submit the whole period. |
| `GET /workers/{id}/timeOffBalances` | PTO / sick / other balances. |

#### Absence management

| Endpoint | Notes |
|---|---|
| `GET /workers/{id}/absenceRequests` | Requests. Filters: `status`, `fromDate`, `toDate`. |
| `POST /workers/{id}/absenceRequests` | Create a request. Validates against PTO balance. |
| `POST /absenceRequests/{id}/approve` | Manager action. Decrements balance, posts Graph calendar event. |
| `POST /absenceRequests/{id}/deny` | Manager action. |
| `POST /absenceRequests/{id}/cancel` | Worker action. |

#### Compensation

| Endpoint | Notes |
|---|---|
| `GET /workers/{id}/compensation` | Current compensation snapshot. |
| `GET /workers/{id}/compensationHistory` | History entries. |

### 9.5 Workday — Tier 2

Engine-supported, sparse seed: `recruiting/jobRequisitions`, `recruiting/candidates`, `talent/performance`, `learning/enrollments`, `payroll/paySlips`. Same one-line registration to upgrade to Tier 1.

### 9.6 Workday RaaS

Custom reports exposed at `/ccx/service/customreport2/{tenant}/{report}`. Mock ships with these example reports:

| Report | Purpose | Output columns |
|---|---|---|
| `Headcount_By_Department` | Per-org headcount with manager | `org`, `manager`, `headcount` |
| `Timesheet_Compliance` | Workers with missing/late timesheets in a window | `worker`, `manager`, `daysMissing`, `lastSubmitted` |
| `Absence_Liability` | PTO balance liability in days and currency | `worker`, `balanceDays`, `liabilityUSD` |
| `Probation_Due` | Workers approaching probation end | `worker`, `manager`, `hireDate`, `probationEndDate` |

Reports accept input params via query string (`?Start_Date=2026-01-01&End_Date=2026-03-31`). Output format is JSON by default; `?format=csv` returns CSV.

Adding a report = drop a JSON definition in `_specs/raas/` and reference it. See `PLAN.md` §3 step 15.

---

## 10. Cross-system effects

Some actions in one system cause state changes in the other. These are deliberate and explicit — each effect is a named hook in `_lib/effects/`.

| Trigger | Effect |
|---|---|
| Workday: absence request approved | Graph: out-of-office calendar event created on worker's calendar; notification mail sent to worker and manager. |
| Workday: timesheet submitted | Graph: confirmation mail to worker. |
| Graph: meeting created with attendees in the tenant | Graph: invite mail to each attendee; event appears on their calendars. |
| Graph: sendMail with recipient in the tenant | Graph: message lands in recipient's inbox. |
| Workday: worker terminated (Phase 2+) | Graph: user marked disabled; calendar events cancelled. |

Effects fire synchronously on the mutation request — by the time the POST returns, downstream state is consistent.

---

## 11. Examples

Get the calling user:

```bash
curl https://coe-prototypes.vercel.app/api/mock/graph/v1.0/me \
  -H 'Authorization: Bearer dev' \
  -H 'X-Mock-Tenant: acme-corp'
```

List unread mail:

```bash
curl "https://coe-prototypes.vercel.app/api/mock/graph/v1.0/me/messages?\$filter=isRead eq false&\$top=10" \
  -H 'Authorization: Bearer dev' \
  -H 'X-Mock-Tenant: acme-corp'
```

Send mail:

```bash
curl -X POST https://coe-prototypes.vercel.app/api/mock/graph/v1.0/me/sendMail \
  -H 'Authorization: Bearer dev' \
  -H 'X-Mock-Tenant: acme-corp' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": {
      "subject": "Timesheet reminder",
      "body": { "contentType": "Text", "content": "Hi — please submit your timesheet." },
      "toRecipients": [
        { "emailAddress": { "address": "alice@acme-corp.test" } }
      ]
    }
  }'
```

Submit a timesheet entry:

```bash
curl -X POST https://coe-prototypes.vercel.app/api/mock/workday/ccx/api/v1/workers/{wid}/timeEntries \
  -H 'Authorization: Bearer dev' \
  -H 'X-Mock-Tenant: acme-corp' \
  -H 'Content-Type: application/json' \
  -d '{ "date": "2026-05-13", "hours": 8, "project": "PROJ-A" }'
```

Run a RaaS report:

```bash
curl "https://coe-prototypes.vercel.app/api/mock/workday/ccx/service/customreport2/acme-corp/Timesheet_Compliance?Start_Date=2026-05-01&End_Date=2026-05-14&format=json" \
  -H 'Authorization: Bearer dev'
```

---

## 12. Client libraries

Phase 4 ships thin wrappers:

```js
import { GraphClient } from '/api/mock/_lib/clients/graph-client.js';
const graph = new GraphClient({
  baseUrl: process.env.GRAPH_BASE_URL,   // /api/mock/graph or https://graph.microsoft.com
  token:   process.env.GRAPH_TOKEN,
  tenant:  process.env.MOCK_TENANT,      // ignored when pointing at real Graph
});

const me = await graph.get('/v1.0/me');
const inbox = await graph.get('/v1.0/me/messages', { $filter: 'isRead eq false', $top: 10 });
await graph.post('/v1.0/me/sendMail', { message: { ... } });
```

The client handles 429 retry with `Retry-After`, error parsing into a typed exception, and pagination (`graph.getAll(path)` follows `@odata.nextLink` until exhausted).

Equivalent `WorkdayClient` for Workday endpoints.

---

## 13. What to read next

- [`PLAN.md`](./PLAN.md) — build phases, file layout, decisions log, risks.
- `_specs/VERSIONS.md` (Phase 1) — pinned spec versions.
- `_lib/seed/scenarios/README.md` (Phase 2) — how scenario packs work.
- The desktop UI quickstart (Phase 3) — how to launch a tenant and switch apps.
