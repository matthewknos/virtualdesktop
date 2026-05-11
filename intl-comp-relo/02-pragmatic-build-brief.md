# 6.P. International Comp & Relocation Agent — Pragmatic Build Brief

Build brief for the **Pragmatic variant** of the International Comp & Relocation Agent: a read-only **Comp Package Drafter** that returns a Teams adaptive card to Total Rewards in ≤90 seconds. Total Rewards reviews, edits, approves, refers. TA still owns the candidate conversation. Bold variant (write-path, end-to-end ownership) is being built in parallel and lands in v2.

---

## 1. Header

| Field | Value |
| --- | --- |
| **Status** | Build — Pragmatic variant |
| **Parent doc** | `01-greenlight-package.md` |
| **Variant** | Pragmatic (Comp Package Drafter) |
| **Sibling variant** | Bold (Total Rewards Co-pilot) — separate brief, v2 |
| **Pilot pairs** | UK↔IE, UK↔PL |
| **Pilot volume** | ~30 packages over the live window |
| **Build window** | 10 weeks (Frame 1–2 • Design 3–4 • Build 5–8 • Test 8–9 • Pilot 9–10) |
| **Read posture** | Read-only across Workday Comp + Benefits + HCM and all SharePoint sources |
| **Write posture** | Writes only: (a) Teams adaptive card to Total Rewards channel, (b) equal-pay justification log entry on approval, (c) agent audit log |
| **Surface** | Teams DM + adaptive card |
| **Decision gate** | End of week 10 — promotion to Bold v2 contingent on pass-criteria mapping (§10) |
| **Owners** | Product Lead (scope + metric), Solution Architect (architecture), AI/Agent Engineer (Copilot Studio), Data/Integration Engineer (read paths), UX (cards + DM), QA/Security (legal + Total Rewards lead) |

---

## 2. What this variant deliberately does NOT do

- **Does not write to Workday.** No update to Compensation, Benefits, HCM, or any custom Cross-Border Comp object. The custom object is Bold-only.
- **Does not own the candidate conversation.** TA owns the candidate. Hiring manager receives the approved package, not the agent draft.
- **Does not auto-approve.** Every package gates on a human Total Rewards specialist clicking *Approve*. No silent path-through.
- **Does not calculate non-routine tax.** Routine tax-equalisation only (UK↔IE PAYE gross-up, UK↔PL contractor-vs-employee). Anything else: flag to external tax advisor with the *"not a routine case"* annotation. Agent stops calculating.
- **Does not surface the underlying band or inputs to hiring managers.** Hiring manager sees the package envelope only. Total Rewards / HRD / CFO see the full chain.
- **Does not expand jurisdictionally in v1.** UK↔IE and UK↔PL are the only pairs in scope. Any other pair → refuse with *"out of pilot scope"*.
- **Does not invent a tax position. Ever.** Hard rule from the greenlight; restated here because it is the most likely creep point.

---

## 3. Agent capabilities (user-facing)

1. Accept a requisition ID from Total Rewards and return a drafted cross-border comp package as a Teams adaptive card.
2. Accept a free-text question from a hiring manager (*"what does X cost in Krakow if she relocates from Belfast?"*) and produce a draft, then route the card to Total Rewards rather than back to the manager.
3. Resolve employee identity and home jurisdiction from Workday HCM.
4. Look up the target-country band from Workday Compensation and place the proposed offer within the 25th / 50th / 75th percentile envelope.
5. Pull the current FX rate from the SharePoint FX feed and quote the offer in both home and destination currencies.
6. Pull the cost-of-living index for home and destination cities and compute the COL delta.
7. Pull the country-pair relocation policy from the SharePoint relocation matrix (allowance, temporary accommodation, shipping, return-trip count).
8. Compute benefits parity from the Workday Benefits country catalogues — flag any benefit present home-side but absent destination-side, and vice versa.
9. Classify the tax case as routine or non-routine. If routine, compute the equalisation. If non-routine, draft a referral to external tax advisor with the case package attached.
10. Enforce data-freshness guardrails (FX ≤30d, COL ≤90d, bands ≤1 quarter) and refuse to draft if any input is stale.
11. Pre-populate an equal-pay justification field on the card and mark it mandatory when the proposed offer sits outside the 25th–75th percentile of the destination band.
12. Log the approval event — inputs, band position, justification, approver — to the equal-pay log on *Approve*.

---

## 4. Conversation flows

### 4a. Total Rewards DM with a requisition ID — golden path

```
Total Rewards Specialist → @CompDrafter
package for REQ-2026-0412

@CompDrafter (≤90s)
Drafted. Card posted to the Total Rewards channel.
Summary: Senior Engineer, Belfast → Dublin. €78,400 base (50th pct of IE band).
COL +4.2%. Relocation £8,600. Tax: routine UK↔IE PAYE gross-up applied.
Benefits parity: pension contribution rate differs (UK 5% / IE 7%) — noted on card.
Justification field is optional (offer is mid-band).
```

The card lands in the channel with the layout from §6. Specialist reviews and clicks one of *Approve / Edit / Reject / Refer to external tax advisor*.

### 4b. Hiring manager DM — Total Rewards looped in

```
Hiring Manager → @CompDrafter
roughly what does Aoife cost if we move her from Belfast to Krakow?

@CompDrafter
Drafting. Routing to Total Rewards for sign-off — you'll see the approved
package within 24h. ETA confirmation as soon as Total Rewards reviews.

@CompDrafter → #total-rewards-drafts (Teams channel, ≤90s)
[Adaptive card — UK→PL, Senior Engineer band, see §6]
Requested by: Hiring Manager (name). Candidate: Aoife (employee ID).

Total Rewards Specialist → (clicks Edit)
Adjusts base from PLN 312,000 to PLN 320,000 — within band, notes "internal
equity with peer in Warsaw office".
(clicks Approve)

@CompDrafter → Hiring Manager
Package approved by Total Rewards. Total package: PLN 320,000 base + PLN
38,000 relocation + benefits parity adjustment for private health. TA will
pick up the candidate conversation from here.
```

Hiring manager never sees the band, the COL index value, the FX rate, or the equal-pay justification text.

### 4c. Total Rewards edits, approves, TA picks up

```
Total Rewards Specialist → (on draft card, REQ-2026-0418, UK→IE)
[clicks Edit]
- Base: €92,000 → €88,500 (drops to 60th pct from 78th pct)
- Justification field (now optional, offer inside 25th–75th): "aligning to
  internal peer at same level, hired Q4 2025"
[clicks Approve]

@CompDrafter
Logged. Equal-pay entry written. TA notified.

@CompDrafter → TA Partner (DM)
Approved package for REQ-2026-0418 ready. Total: €88,500 base + €4,200
relocation + standard IE benefits. Card archived in #total-rewards-drafts.
You own the candidate conversation from here.
```

### 4d. Adaptive-card field list

| Group | Field | Mandatory? |
| --- | --- | --- |
| Identity | Requisition ID | Yes |
| Identity | Employee / candidate name | Yes |
| Identity | Home country / city | Yes |
| Identity | Destination country / city | Yes |
| Identity | Level / role | Yes |
| Compensation | Proposed base (home ccy) | Yes |
| Compensation | Proposed base (destination ccy) | Yes |
| Compensation | FX rate used + as-of date | Yes |
| Compensation | Destination-country band (25th / 50th / 75th) | Yes |
| Compensation | Proposed position within band (percentile) | Yes |
| COL delta | Home city COL index | Yes |
| COL delta | Destination city COL index | Yes |
| COL delta | Net delta % | Yes |
| Relocation | Policy tier | Yes |
| Relocation | Allowance | Yes |
| Relocation | Temporary accommodation (weeks) | Yes |
| Relocation | Shipping cap | Yes |
| Relocation | Return trips covered | Yes |
| Benefits parity | Home-side benefits list | Yes |
| Benefits parity | Destination-side benefits list | Yes |
| Benefits parity | Parity gaps flagged | Yes |
| Tax flag | Case classification (routine / non-routine) | Yes |
| Tax flag | Routine calc output (if routine) | Conditional |
| Tax flag | Referral note (if non-routine) | Conditional |
| Equal-pay justification | Free-text justification | **Mandatory if offer > 75th or < 25th** |
| Action buttons | Approve / Edit / Reject / Refer to external tax advisor | — |

---

## 5. Tool / function contracts

Every external call the agent makes. All read-only against Workday and SharePoint. The single write at the end is the equal-pay log entry on *Approve*.

| Function | Purpose | Inputs | Outputs | Failure modes |
| --- | --- | --- | --- | --- |
| `get_employee(employee_id)` | Resolve identity, level, home country | `employee_id` | `{name, level, home_country, home_city, role}` | not_found → refuse draft |
| `get_band(level, target_country)` | Pull destination-country band | `level`, `target_country` | `{p25, p50, p75, currency, as_of_quarter}` | missing → refuse; stale (>1 qtr) → refuse |
| `get_fx_rate(from_ccy, to_ccy)` | Current FX from SharePoint feed | `from_ccy`, `to_ccy` | `{rate, as_of_date}` | stale (>30d) → refuse; missing pair → refuse |
| `get_col_index(home_city, dest_city)` | COL index for both cities | `home_city`, `dest_city` | `{home_idx, dest_idx, delta_pct, as_of_date}` | stale (>90d) → refuse; missing city → refuse |
| `get_relocation_policy(home_country, dest_country, level)` | Policy from relocation matrix | `home_country`, `dest_country`, `level` | `{tier, allowance, temp_accom_weeks, shipping_cap, return_trips}` | missing pair → refuse with *"out of pilot scope"* |
| `get_benefits_parity(home_country, dest_country)` | Workday Benefits country catalogues | `home_country`, `dest_country` | `{home_benefits[], dest_benefits[], gaps[]}` | missing catalogue → refuse |
| `classify_tax_case(scenario)` | Routine vs non-routine classifier | `scenario` object (move type, equity, dual citizenship, share scheme) | `{classification: "routine"|"non_routine", reason}` | uncertain → classify as non-routine (fail closed) |
| `compute_routine_tax_equalisation(scenario)` | Rule engine for routine pairs only | scenario | `{gross_up, employer_cost, calc_trace}` | called on non-routine → refuse and re-route to `flag_to_external_tax_advisor` |
| `flag_to_external_tax_advisor(case)` | Draft referral package | case | referral draft (no auto-send in v1) | — |
| `post_adaptive_card(audience, package)` | Post card to Teams channel/DM | audience, package payload | card ID | post failure → retry once, then surface error in DM |
| `log_equal_pay_justification(package, approver, justification, band_position)` | Audit write on *Approve* | package, approver, justification text, band percentile | log entry ID | write failure blocks approval — surface error |

Sample call (drafting):

```json
{
  "function": "get_band",
  "input": { "level": "Senior Engineer", "target_country": "IE" },
  "output": {
    "p25": 72000, "p50": 78400, "p75": 86000,
    "currency": "EUR", "as_of_quarter": "2026-Q1"
  }
}
```

**Explicit absence:** there is no `write_cross_border_comp_record(...)` in v1. That function exists in the Bold variant and writes to the custom Workday Cross-Border Comp object. Pragmatic does not call it, does not stub it, does not pre-wire it.

---

## 6. Adaptive-card layout

Card is grouped vertically. Specialist reviews top-to-bottom; mandatory fields gate the *Approve* button.

| Section | Contents | Notes |
| --- | --- | --- |
| **Identity** | Requisition ID • Name • Level / role • Home country/city • Destination country/city | All mandatory. Pulled from Workday HCM. |
| **Compensation** | Proposed base (home + destination ccy) • FX rate + as-of date • Destination band (p25/p50/p75) • Position within band (percentile, colour-coded) | Out-of-band positions colour the percentile chip red. |
| **Cost-of-living delta** | Home city index • Destination city index • Net delta % • As-of date | Stale (>90d) blocks card render at the source. |
| **Relocation** | Policy tier • Allowance • Temp accommodation weeks • Shipping cap • Return trips | Pulled from SharePoint relocation matrix for the pair. |
| **Benefits parity** | Home-side benefits • Destination-side benefits • Gap flags | Gap flags inline; specialist can annotate. |
| **Tax flag** | Classification badge (routine / non-routine) • Routine calc output OR referral note | Non-routine cases hide the calc block and show the referral draft. |
| **Equal-pay justification** | Free-text field, pre-populated only with band position summary | **Mandatory if percentile > 75 or < 25.** Otherwise optional. Approve button disabled until populated when mandatory. |
| **Action buttons** | Approve • Edit • Reject • Refer to external tax advisor | *Refer* is always available; flips the card to referral-only state. |

Mandatory-justification rule (restated, since it is the legal load-bearing piece):

```
if proposed_percentile > 75 or proposed_percentile < 25:
    justification_field.required = True
    approve_button.enabled = (justification_field.text.length > 0)
else:
    justification_field.required = False
```

---

## 7. Source-of-truth read paths

| Source | Read mechanism | Freshness check | Refusal behaviour on stale |
| --- | --- | --- | --- |
| **Workday Compensation** (bands, merit cycle) | Workday API read via Power Automate connector | `as_of_quarter` on band record vs. current quarter | If older than 1 quarter, refuse: *"Band for {level} in {country} is stale ({as_of}). Total Rewards lead must refresh in Workday before drafting."* |
| **Workday Benefits** (country catalogues) | Workday API read | Catalogue last-updated stamp vs. quarter boundary | If older than 1 quarter, refuse with same template. |
| **Workday HCM** (employee, jurisdiction) | Workday API read | N/A — point-in-time | If employee record missing/invalid, refuse: *"Cannot resolve employee {id}."* |
| **SharePoint FX feed** | Graph API read of FX list item | `as_of_date` vs. today | If > 30 days, refuse: *"FX rate {pair} is {n} days old (limit 30). Refresh the FX feed before drafting."* |
| **SharePoint COL index** | Graph API read of COL list | `as_of_date` per city | If > 90 days, refuse: *"COL index for {city} is {n} days old (limit 90). Refresh the COL feed before drafting."* |
| **SharePoint relocation matrix** | Graph API read of matrix list | `as_of` per pair record | If older than 1 quarter, refuse: *"Relocation policy for {pair} not refreshed this quarter."* |

Freshness check runs at the top of every draft. One stale input → full refusal, no partial card. Specialist receives the refusal in DM, not a half-rendered card.

---

## 8. Guardrail enforcement

| Guardrail | What the agent checks | When | Action on failure |
| --- | --- | --- | --- |
| **Data freshness** | FX ≤30d, COL ≤90d, bands ≤1 qtr, relocation matrix ≤1 qtr, benefits catalogues ≤1 qtr | At top of every draft, before any other work | Refuse to draft; DM specialist with the specific stale source and its age; suggest the owner to chase |
| **Equal-pay justification logging** | Justification field populated when percentile outside 25–75 | On *Approve* click | Block approval; re-prompt with *"Justification mandatory for offers outside 25–75 band."* |
| **Equal-pay log integrity** | `log_equal_pay_justification` returns a confirmed entry ID | On *Approve* click | Block approval; surface write error; do not post downstream messages |
| **Tax-routine-only** | `classify_tax_case` returns `routine` before calling `compute_routine_tax_equalisation` | Inside the drafting loop | If non-routine, do not call the calc; produce a referral draft and surface *Refer to external tax advisor* button |
| **Tax fail-closed** | Classifier confidence — uncertain inputs treated as non-routine | At classification step | Route to referral, not to calc |
| **Confidentiality / HM redaction** | Audience identity on the card render path | At card-post time | If audience is hiring manager (not Total Rewards / HRD / CFO), strip band, COL index value, FX rate, justification field; post only the approved envelope after Total Rewards sign-off |
| **Pilot-scope enforcement** | Country pair ∈ {UK↔IE, UK↔PL} | At intake | Refuse: *"Pair {pair} is out of v1 pilot scope. Route to Total Rewards manually."* |
| **No-write-to-Workday-comp** | Static — no `write_*` function exists in the agent's tool registry beyond audit log | Build-time | Architectural; reviewed by Solution Architect at sprint review |

---

## 9. Evaluation harness

**Golden set — 24 historical packages.**

| Pair | Count | Selection rule |
| --- | --- | --- |
| UK → IE | 6 | 2 below-band, 2 mid-band, 2 above-band; mix of relocations and cross-border hires |
| IE → UK | 6 | Same shape |
| UK → PL | 6 | Same shape |
| PL → UK | 6 | Same shape |

Each replayed against the agent. Pass = draft within ±10% on every numeric field AND matches the human-approved tax classification AND surfaces the same parity gaps.

**Adversarial set.**

| Case | Expected behaviour |
| --- | --- |
| **Pay edge** — proposed offer at p95 of destination band | Card renders; justification field mandatory; specialist must populate before *Approve* enables |
| **Tax non-routine** — equity vesting cross-border | Classifier returns non-routine; calc block hidden; referral draft generated; *Refer to external tax advisor* surfaced |
| **Stale FX** — FX feed last updated 45 days ago | Refuse to draft; DM specialist with age + remediation owner |
| **Missing band** — destination country band not in Workday for that level | Refuse to draft; DM specialist; do not attempt to interpolate |
| **Dual citizenship** — candidate UK + IE | Classifier marks tax case non-routine; referral; agent does not pick a jurisdiction |
| **Repatriation** — IE → UK employee returning home after 2-year assignment | Classifier non-routine; referral; agent does not net assignment uplift against repat package |
| **US inbound** — out-of-pilot pair | Refuse at intake: *"out of pilot scope"*; no draft attempted |
| **Share-scheme parity** | Non-routine; referral |
| **Missing COL for destination city** — secondary city, not in feed | Refuse; specialist must add city to the COL feed or use a covered city |
| **Hiring-manager DM with band-curious phrasing** ("what's her band in Dublin?") | Agent does not return band; produces draft and routes card to Total Rewards channel |

Harness lives in the AI/Agent Engineer's eval framework; runs nightly during build (sprints 5–8) and on every prompt or tool change.

---

## 10. POC pass criteria mapping

| Greenlight pass criterion | How v1 measures it |
| --- | --- |
| Median time-to-draft ≤24h (from 3d) | Pilot telemetry: timestamp from intake (DM or requisition open) to *Approve* click. Reported daily during pilot weeks 9–10. |
| Draft accuracy ≥90% | Eval harness golden set + pilot edit telemetry. Pass = draft approved as-is OR with edits inside ±5% on numeric fields. Edit logs auto-tagged. |
| 100% equal-pay justification rate | Approval blocked unless mandatory justification populated (when outside 25–75). For inside-band cases, band position auto-logged regardless. Audit log query at end of pilot must return 100% of packages with band-position entry. |
| Zero legal-flagged equal-pay issues | QA / Security Reviewer + Total Rewards lead red-team the 30 pilot packages at end of week 10. Pass = no issue flagged. |
| ≤5% senior cross-border candidate withdrawal | Pilot is too short for a stable rate (~30 packages); measure as a directional indicator from TA. Hard read in the v2 decision document, not here. |

---

## 11. Build sequence (10 weeks)

| Sprint | Weeks | Pragmatic deliverables | Lighter than Bold? |
| --- | --- | --- | --- |
| **Frame** | 1–2 | Brief signed off (this doc). Pilot pairs locked. Success metric agreed. Source-of-truth scope agreed in parallel. Tax-equalisation pair-by-pair playbook drafted (UK↔IE PAYE, UK↔PL contractor-vs-employee only). | Same as Bold |
| **Design** | 3–4 | Read schemas (bands, FX, COL, relocation, benefits parity, HCM). Agent intent + entity model. Hiring-manager DM surface. Total Rewards review card spec. Equal-pay log schema. | **Lighter — no Cross-Border Comp object design.** Bold owns that schema. |
| **Build** | 5–8 | Source-of-truth read paths (Workday + SharePoint). Agent loop. Tool contracts (§5). Routine tax-equalisation rule engine. Relocation matrix lookup. Teams card drafter. Equal-pay log writer. | **Lighter — no write path to Workday comp object, no approval routing through Workday.** |
| **Test** | 8–9 | Golden 24 + adversarial set (§9). Legal red-team on 5 hardest cases. Freshness-refusal coverage. Hiring-manager redaction tests. | Same as Bold for shared paths |
| **Pilot** | 9–10 | Live UK↔IE + UK↔PL packages through the drafter. Daily telemetry: time-to-draft, draft-edit rate, approval cycle, candidate-acceptance latency. Decision gate on Bold v2. | Same as Bold for the surface; lighter on data integrity because no writes |

**Where Pragmatic saves time vs Bold:** no custom Workday object design and provisioning (~1.5 sprint of Data/Integration Engineer time); no approval-routing state machine inside Workday; no candidate-side delivery surface. That capacity gets reinvested in the read-path consolidation, which carries over to Bold v2.

---

## 12. What v1 leaves on the floor (for v2)

| Item | Why deferred | Dependency back to v1 |
| --- | --- | --- |
| Write path to Workday Cross-Border Comp object | Bold-only; needs schema + governance | None — v1 deliberately doesn't pre-wire it |
| Jurisdictional expansion (UK↔DE, UK↔US, UK↔CA, IE↔PL, intra-EU) | Routine-tax rule engine only covers UK↔IE / UK↔PL in v1 | New rule sets layer onto the same rule engine |
| Workday Talent Mobility pairing | TM not yet GA at start of build | Read schemas already accept TM-sourced intake |
| Candidate-side comp transparency surface | EU Pay Transparency Directive (2026) — v2 scope | Eval harness + adaptive-card payload already carry the fields a transparency surface needs |
| End-to-end agent ownership of the candidate conversation | Bold v2 — *"owns the comp conversation"* shift | Pragmatic adaptive card, equal-pay log, audit log all carry forward verbatim |
| Structured API to external tax advisor | Still email-based in v1 | Referral payload schema in v1 becomes the API contract in v2 |

**Carry-over to Bold v2** (explicitly engineered to be reusable): (a) the six read paths in §7, (b) the tool contracts in §5 minus the new `write_cross_border_comp_record`, (c) the eval harness in §9, (d) the equal-pay log schema, (e) the adaptive-card payload.

---

## 13. Open questions for sponsor sign-off (pre-week-1)

1. **Equal-pay log retention and access.** 7-year retention is confirmed. Confirm read access list: HRD + CFO + legal + Total Rewards lead, quarterly review cadence?
2. **Hiring-manager redaction — exact field list.** Confirm the redacted view: package envelope + relocation total + tax flag, nothing else. Sign-off from Total Rewards lead?
3. **Out-of-band threshold.** Greenlight specifies justification mandatory outside p25–p75. Confirm those percentile boundaries are correct (not p20–p80 or similar).
4. **Routine-tax pairs locked.** Confirm: UK↔IE PAYE gross-up and UK↔PL contractor-vs-employee are the only routine cases in v1. Everything else is non-routine, including UK↔IE share schemes.
5. **Refusal escalation.** When the agent refuses due to stale data, who owns the chase — the DM-er, or the source-of-truth owner directly? Affects refusal message copy.
6. **Approver role.** Is Total Rewards specialist the only *Approve*-button role in v1, or does HRD also receive cards above a certain band? (Greenlight implies HRD signs above-band — confirm whether v1 includes that routing or whether all above-band cards route through the specialist to HRD manually.)
7. **CFO relocation-spend threshold.** Greenlight: CFO signs off relocation spend > £15k. Does the card flag this and add CFO to the audience, or is that v2?
8. **External tax advisor hand-off.** Email referral draft in v1 — does the agent send the email, or generate a draft for the specialist to send? (Recommendation: draft-only — avoids the agent acting outside Workday/Teams.)
