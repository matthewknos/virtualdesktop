# Agentic Probation — Product Design Guide

**A blueprint for productising and deploying an AI probation-review assistant on real Workday tenants.**

*Centre of Excellence for AI · Working draft · 2026-05-08*

---

## 1. Executive summary

**Agentic Probation** is an AI assistant that sits in Microsoft Teams alongside a customer's Workday tenant, watches the probation lifecycle as it unfolds, nudges managers and employees at six lifecycle beats, and at review time drafts the review pack from real evidence — so the manager isn't starting from a blank template.

This document describes what the **production product** looks like — architecture, integrations, governance, operating model, and rollout — for customers ready to take it past prototype.

It is not a build log of the demo.

---

## 2. The problem

Probation reviews fail for predictable, non-performance reasons:

- Goals are set late or never, leaving nothing to review against.
- Feedback is sparse because nobody asks for it until days before the review.
- Line managers run probation reviews three times a year at most — they're never expert at it.
- Workday's standard Probation Review BP renders a **blank** review pack; the manager spends the day before the review hunting for evidence.

The cost is outcome quality, not admin time. Employees who could have been course-corrected at week 4 end up on extension at week 12. Strong hires don't get the affirming review they earned.

**Target outcome:** within 12 months of deployment, customers should see (a) goal-set-by-week-2 rates above 90%, (b) probation extensions driven by *evidence* not by *late discovery*, and (c) measurable reduction in manager prep time per review.

---

## 3. Product overview

A Microsoft Teams bot (the **Probation Copilot**) plus a backend orchestrator that integrates with Workday HCM. The bot operates over six beats per probation:

| Beat | Trigger | Manager action drafted | Employee action drafted |
|---|---|---|---|
| **Week 1** | Probation BP initiated | Goal-setting 1:1 talking points | Welcome + timeline explainer |
| **Week 4** | Goals missing or partial | Nudge to employee, draft message | Prompt to request early peer feedback |
| **Week 8** | Feedback gap detected | Peer-feedback request draft | Check-in with manager prompt |
| **T-30** | 30 days to review | Offer to start review pack | Draft self-assessment from goal updates |
| **T-7** | 7 days to review | Deliver draft pack with recommended outcome | Self-assessment submission prompt |
| **Review Day** | BP at decision step | Write outcome back to Workday, suggest next steps | Transition to post-probation goals or extension plan |

The bot **drafts** at every step. Sending, posting, and submitting are always human actions.

---

## 4. Architecture

### 4.1 Components

```
┌──────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
│  Microsoft Teams │◄──►│  Orchestrator        │◄──►│  Workday tenant  │
│  (Bot Framework) │    │  (stateless workers) │    │  (REST + SOAP)   │
└──────────────────┘    └──────┬───────────────┘    └──────────────────┘
                               │
                        ┌──────▼───────┐    ┌──────────────────┐
                        │  LLM gateway │◄──►│  Anthropic API   │
                        │  (Claude)    │    │  (Sonnet 4.6)    │
                        └──────┬───────┘    └──────────────────┘
                               │
                        ┌──────▼───────┐
                        │  Audit store │
                        │  (immutable) │
                        └──────────────┘
```

### 4.2 Workday integration surface

| Capability | Workday API | Purpose |
|---|---|---|
| Read employee + manager + probation BP state | `Get_Workers`, `Get_Business_Process_Step` | Drive lifecycle detection |
| Read goals + progress | `Get_Goals` (Talent) | Evidence for review pack |
| Read feedback | Anytime Feedback web service | Evidence for review pack |
| Read self-assessment | Reports-as-a-Service (RaaS) over the probation BP | Pull free-text answers |
| Write outcome | `Submit_Performance_Review` step transition via ISU | Close the loop on Review Day |
| Subscribe to BP events | Workday EIB / Event Subscription | Trigger lifecycle beats |

All Workday calls use a customer-provisioned **Integration System User (ISU)** with a scoped Security Group. No customer is asked to elevate permissions beyond what's listed.

### 4.3 Data residency and tenancy

- **Customer data never trains a model.** Anthropic API calls are zero-retention via the no-train flag.
- **Per-customer tenant isolation** — orchestrator runs in a customer-bound namespace; secrets and event streams are not pooled.
- **Region pinning** — EU customers run in eu-west, US customers in us-east. Configurable at provisioning.

---

## 5. Governance & compliance

### 5.1 Decision boundaries

The bot **recommends**. The human **decides**. This is not a design preference; it is the position that keeps the product outside **GDPR Article 22** (automated decision-making producing legal or similarly significant effects). Specifically:

- The bot can **suggest** an outcome (Pass / Extend / Fail) with the underlying signals shown.
- The bot **never** writes that outcome to Workday without the manager confirming inside Teams.
- The bot **never** sends an external message (peer feedback request, employee nudge, HRBP escalation) without the human pressing Send.

### 5.2 Audit trail

Every recommendation is written to an immutable audit log with:
- The signals it drew from (goal IDs, feedback IDs, self-assessment excerpt hashes).
- The model + prompt version that generated it.
- The human's response (accept / edit / dismiss).
- A 7-year retention by default (matches typical HR record-keeping policy).

This is **required** for SAR (Subject Access Request) responses and fairness reviews. It is not optional.

### 5.3 Fairness review

The orchestrator runs a quarterly fairness check across the audit log:
- Pass/Extend/Fail recommendation rates by demographic dimensions the customer chooses to expose (gender, ethnicity, age band, working pattern).
- Outliers are surfaced to the customer's HR ethics function — not auto-corrected.

### 5.4 Explainability surface

Every nudge in Teams shows a **"Why did I get this?"** link that opens the underlying signals. No black boxes shipped to managers.

---

## 6. Design principles

1. **Draft, don't send.** Composition by AI; transmission by human.
2. **Person-scoped context.** The bot only ever shows a user the items they own in Workday — managers see their reports, employees see themselves. No HR-wide views inside the bot.
3. **Quiet by default.** Six beats, plus dismissals. No "just checking in" messages.
4. **Workday accuracy over convenience.** The product matches how Workday really works (self-assessment lives in the Probation BP, managers don't author goals on behalf of employees, etc.) even when that's less convenient.
5. **Recommendation, not decision.** Always show the underlying signals.
6. **Customer configures, vendor doesn't decide.** Probation length, beat timing, feedback expectations, and outcome categories are all per-customer config.

---

## 7. Configuration model

Each customer gets a **probation profile** YAML covering:

```yaml
probation:
  duration_days: 90              # or 180, or country-specific
  beats:
    - name: week_1
      offset_days: 7
    - name: week_4
      offset_days: 28
    # ...
  goal_expectations:
    must_set_by_day: 14
    minimum_count: 3
  feedback_expectations:
    minimum_peer_responses: 3
    request_by_day: 56
  outcomes:
    - PASS
    - EXTEND
    - FAIL
  hrbp_escalation:
    on: [extend, fail]
    channel: teams_dm
```

Defaults exist for UK-, EU-, US-, and APAC-typical setups. Customers override per-region or per-business-unit.

---

## 8. Deployment & rollout

### 8.1 Prerequisites (customer side)

- Workday tenant with Talent / Performance enabled.
- An ISU with permissions scoped to the integrations in §4.2.
- Microsoft Teams with bot installation rights for the target user population.
- A signed DPA covering employee personal data processing.

### 8.2 Provisioning sequence

1. **Customer kickoff** — confirm probation profile, integration scope, DPA.
2. **ISU + Security Group provisioning** in the customer's Workday tenant.
3. **Sandbox tenant connection** — orchestrator connects to a non-prod Workday and a non-prod Teams.
4. **Pilot cohort** — typically 10–30 managers / 30–100 probationers for 90 days.
5. **Pilot review** — pass/fail decision based on goal-set rates, manager NPS, audit-log inspection.
6. **Production cutover** — same orchestrator, switch credentials.
7. **Quarterly fairness review** begins from Day 1 of production.

### 8.3 Change management

This is HR software touching probation outcomes. Rollout that skips communication will fail.

- **Manager training** — 30 minutes async + 1 office-hours session.
- **Employee comms** — what the bot does, what it doesn't, how to opt a 1:1 conversation out of the audit (it can't, but they should know).
- **HRBP enablement** — they own escalations from the bot; they need to see the audit log.
- **Works-council / employee-rep consultation** — required in DE, FR, NL and recommended elsewhere.

### 8.4 Success metrics (track from Day 1)

| Metric | Target | Measured by |
|---|---|---|
| Goals set by Day 14 | ≥ 90% | Workday goal records vs. probation start date |
| Peer feedback requests sent by Week 8 | ≥ 80% | Anytime Feedback request count |
| Manager prep time per review | -50% vs. baseline | Manager-reported survey |
| Manager NPS on the bot | ≥ +30 | In-Teams quarterly survey |
| Recommendation acceptance rate | 60–85%* | Audit log |
| Demographic outcome parity | within tolerance | Quarterly fairness review |

*Both extremes are flags. Below 60% means the bot is poorly calibrated; above 85% means managers are rubber-stamping.

---

## 9. Out of scope (deliberately, for v1)

- **Aggregation, digest mode, quiet hours.** Six nudges per probationer × 6–12 reports per manager = noise risk. v2 problem.
- **Cross-probation analytics dashboard.** HRBPs will ask. v2.
- **Performance review beyond probation.** Annual review is a different shape; don't conflate.
- **Auto-execution of any Workday write other than the final outcome.** Even the outcome is human-confirmed.
- **Integration with non-Workday HCMs.** Possible later; not v1.

---

## 10. Technical risks & mitigations

| Risk | Mitigation |
|---|---|
| Workday API throttling on large customers | Event subscription + cache; avoid polling at scale |
| LLM latency degrading Teams UX | Pre-draft at beat trigger, not at Teams open |
| Hallucination in review pack | Citations to source goal/feedback IDs are mandatory in every drafted paragraph |
| Manager treats recommendation as decision | Explicit "Recommendation, not decision" copy + acceptance-rate monitoring |
| Customer's probation BP is heavily customised | Configuration profile (§7) covers structural variance; deeply non-standard customers need scoping call |
| Works council blocks deployment | DPA + audit-log demo + opt-out posture in pre-sales |

---

## 11. Roadmap

**v1 (target Q3 2026)** — single-tenant deployments, six beats, Pass/Extend/Fail outcome, audit log, fairness review.
**v1.5** — digest mode, quiet hours, HRBP cross-probation view.
**v2** — extension lifecycle (running the extended period itself with adjusted beats), annual-review cousin.
**v3** — cross-HCM (SuccessFactors, Oracle HCM) by abstracting the Workday integration layer.

---

## 12. Asset attribution

This document and the prototype use Workday Canvas Tokens, Canvas Kit CSS, Canvas System Icons, Canvas Expressive Icons, Canvas Kit CSS Fonts, and Canvas Kit CSS Core, © Workday, Inc. The product is not endorsed by or affiliated with Workday.
