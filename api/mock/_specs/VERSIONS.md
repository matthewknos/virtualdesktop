# Mock Platform — Spec Versions

Compact Tier 1 specs are hand-authored from official documentation. Full upstream specs are linked below for reference and drift-checking.

| System | Version / Date | Source |
|---|---|---|
| Microsoft Graph | v1.0 (May 2026) | https://learn.microsoft.com/en-us/graph/api/overview |
| Workday REST API | v1 (May 2026) | https://developer.workday.com/docs/rest-api |
| Workday RaaS | (hand-authored) | Internal |

## Update procedure

1. Check official docs for schema changes to Tier 1 entities.
2. Update the relevant `tier1.json` entity schema.
3. Update the date in this table.
4. Run `npm run smoke` to confirm the engine still passes.
