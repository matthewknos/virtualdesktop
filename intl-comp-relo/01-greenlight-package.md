# 6. International Comp & Relocation Agent — Greenlight Package

| Field | Value |
| --- | --- |
| **Status** | Candidate |
| **Area** | Total Rewards • Mobility |
| **Timeline** | 10 weeks |
| **Pod** | ~1.9 FTE across 7 roles |
| **Pilot** | UK↔IE + UK↔PL: ~30 packages |
| **Headline value** | 3-day median → 24-hour answer • senior-candidate withdrawal cut from ~12% to ≤5% |

---

## The problem

AI-CoE runs ~60–80 cross-border comp packages a year (relocations + cross-border hires + short-term assignments). Each takes 2–5 days of HRBP + Total Rewards + Tax to assemble. ~250 person-days / year burned on package construction. ~10–15% of senior cross-border candidates withdraw due to slow offer cycle — €150–300k / year recruitment leakage at the senior end.

The signal exists — in six different places. Workday holds the bands. SharePoint holds FX. SharePoint holds cost-of-living. SharePoint holds the relocation matrix. Workday holds benefits. The external tax advisor (PwC) is on email. The hiring manager sees none of it. Time-to-offer drifts from 5 days to 15.

## Reframed outcome

Give Total Rewards a one-DM Teams interface that returns a draft cross-border comp package in **under 90 seconds** — band + FX-normalised offer + COL delta + tax-equalisation flag + relocation policy + benefits parity — against a consolidated source-of-truth.

- Time-to-offer drops from 3-day median to 24 hours.
- Senior-candidate withdrawal-due-to-slow-offer drops from ~12% to ≤5%.

**This is a consolidation problem before it is an agent problem.**

## Origin — walking up the ladder

> The chaser is the weather. The originator is the climate. We fix the climate.

| Step | Who / what | Symptom |
| --- | --- | --- |
| **Chaser** | Total Rewards specialist building the package against the clock, triangulating bands + FX + COL + tax + benefits + relocation from 6 different sources. | Senior candidate withdraws because the offer took too long; or accepts and discovers 6 months later the package is misaligned with a colleague who relocated the other direction. |
| **Requester** | Talent Acquisition partner / hiring manager needing a number for the offer letter. | — |
| **Approver** | HR Director (senior packages above band) and CFO (relocation spend > £15k). | — |
| **Originator** | No single originator. Inputs scattered across Workday, 6 SharePoint sites, and external-tax-advisor email. | Consolidation problem before it is an agent problem. |

## Solution — Bold

**Total Rewards Co-pilot.**

**Outcome.** Agent owns the cross-border package end-to-end. Hiring manager DMs the question; agent pulls band, COL delta, FX rate, benefits parity, relocation-policy clauses and routine tax-equalisation; drafts the full package; posts to Total Rewards for sign-off; routes to candidate with TA in the loop. **24-hour SLA end-to-end.**

- **Agent owner:** Copilot Studio agent. Workday-resident Cross-Border Comp object as the canonical record.
- **Data read:** Workday Compensation (bands, merit cycle); Workday Benefits (country catalogues); Workday HCM (employee, jurisdiction); SharePoint (FX feed, COL index, relocation matrix, tax-equalisation rules).
- **Data write:** Workday Cross-Border Comp object; equal-pay justification log; Teams adaptive card to Total Rewards / hiring manager.

**Human touchpoints**
- Total Rewards specialist signs off the package.
- HRD signs off above-band packages. CFO signs off relocation spend > £15k.
- External tax advisor handles non-routine tax-equalisation (agent flags, does not calculate).

**Guardrails**
- **Source-of-truth refresh cadence:** FX 30 days, COL 90 days, bands quarterly. Agent refuses to produce a package if any input is stale.
- **Equal-pay log:** every package logs band position, justification (if outside 25th–75th percentile), inputs, who approved.
- **Tax-equalisation:** routine cases only via rule engine. Non-routine flagged to external tax advisor; agent stops calculating.
- **Confidentiality:** hiring manager sees the package output, not underlying band or inputs. Total Rewards + HRD + CFO see everything.

**What gets retired**
- Slack/SharePoint-thread package construction.
- 6-SharePoint-site triangulation.
- 3-day median time-to-offer.
- Tax-advisor-email-as-workflow for routine cases.

## Solution — Pragmatic

**Comp Package Drafter.**

**Outcome.** Agent drafts the package on demand into a Teams adaptive card for the Total Rewards specialist — bands, FX, COL, tax flag, relocation policy, benefits parity, equal-pay justification field. Total Rewards reviews and signs off; TA still owns the conversation with the candidate. **Median time-to-draft drops from 3 days to 90 seconds.**

- **Agent owner:** Copilot Studio agent. Read-only across Workday + SharePoint in v1.
- **Data read:** Same sources as Bold, read-only.
- **Data write:** Teams adaptive card; equal-pay justification log on approval.

**Human touchpoints**
- Total Rewards specialist reviews / edits / approves / refers to external tax advisor.
- Hiring manager receives the approved package, not the underlying inputs.

**Guardrails**
- Same as Bold but the agent never writes to Workday beyond the audit log.
- Pilot scope: UK↔IE + UK↔PL only in v1.

**What gets retired**
- The 3-day Slack/SharePoint-thread package construction for routine UK↔IE / UK↔PL pairs.

## Upstream fix (do regardless)

Consolidate the comp inputs (bands, FX assumptions, cost-of-living index, relocation matrix, benefits parity, tax-equalisation rules) into a single Workday-resident source-of-truth, refreshed quarterly. Today they live in 6 SharePoint sites with conflicting versions.

~6 weeks integration work, sponsored by Total Rewards lead + IT Workday team.

## Quantitative anchors

| Signal | Value |
| --- | --- |
| Headcount | ~1,800 (UK 1,100 • IE 280 • PL 220 • DE 80 • NA 120) |
| Cross-border packages / year | ~60–80, +15% YoY |
| Median elapsed time per package (today) | 3 days (range 2–5) |
| Total Rewards capacity | 2 FTE for 1,800 staff — bottleneck |
| Senior candidates withdrawing due to slow offer | ~10–15% |
| Annual recruitment leakage from slow offers | €150–300k |
| Tax-equalisation cases / year | ~10 (external advisor fees ~€50k) |
| Relocation packages / year | ~25 (~£300k spend) |

## Workday portfolio overlap

| Workday agent | Overlap | Our posture |
| --- | --- | --- |
| Compensation | Source-of-truth (within-country bands, merit cycles) | Read in v1 |
| Benefits | Source-of-truth (country catalogues) | Read in v1 |
| Talent Mobility (announced) | Adjacent — surfaces internal moves; this agent prices them | Pair in v2 |
| Cross-border package build-up | White space — FX-normalised offer + COL delta + tax-equalisation + relocation + benefits parity in one document, in 24 hours | Build — AI-CoE IP |

## Risk profile

**Equal-pay risk.** Any cross-border recommendation must be defensible against UK Equality Act 2010, Ireland Employment Equality Acts, Germany Entgelttransparenzgesetz, EU Pay Transparency Directive (effective 2026). Agent logs every recommendation.

**Tax & data-freshness guardrails.** Routine tax-equalisation via rule engine only — non-routine flagged to external tax advisor. Stale inputs → refusal to produce a package. Audit retention 7 years.

## Architecture (one breath)

Copilot Studio agent + Power Automate + Workday Extend (Compensation, Benefits, custom Cross-Border Comp object) + SharePoint (FX feed, COL index, relocation matrix, tax-equalisation rules) + Teams DM surface.

**Two paths:**
1. Hiring manager DMs *"what does [name] cost in [city]?"* → agent posts package preview to Total Rewards for sign-off.
2. Total Rewards DMs *"package for [requisition id]"* → full package drafted into Teams adaptive card for review.

## Riskiest design choice

Cross-jurisdictional tax-equalisation rule engine.

- **Routine cases** (UK↔IE PAYE gross-up, UK↔PL contractor-vs-employee, UK↔DE Steuerausgleich) live in the rule engine.
- **Non-routine cases** (equity vesting cross-border, share-scheme parity, US inbound) flagged to external tax advisor explicitly with *"this is not a routine case — referral attached"*.

**Hard rule: the agent never invents a tax position.**

## Sprint plan

| Sprint | Weeks | Outputs |
| --- | --- | --- |
| **Frame** | 1–2 | Brief signed off. Pilot pairs locked (UK↔IE, UK↔PL). Success metric agreed. Source-of-truth scope agreed in parallel. Tax-equalisation pair-by-pair playbook started. |
| **Design** | 3–4 | Source-of-truth schema (bands, FX, COL, relocation, benefits parity). Agent architecture. Hiring-manager DM surface. Total Rewards review card. Equal-pay justification log. |
| **Build** | 5–8 | Source-of-truth consolidation (Workday object). Agent loop. Package-build tool. FX & COL lookups. Tax-equalisation rule engine for routine cases. Relocation matrix lookup. Teams card drafter. Audit log. |
| **Test** | 8–9 | Golden path: 24 historical packages (12 UK↔IE, 12 UK↔PL) replayed. Adversarial: pay edge, tax non-routine, stale FX, missing band, dual-citizenship, repatriation, US inbound. Legal red-team. |
| **Pilot** | 9–10 | Live cross-border packages routed through the agent. Daily measurement of time-to-draft, draft-edit rate, approval cycle, candidate-acceptance latency. Decision gate on v2. |

## UX moments

| Moment | When | What |
| --- | --- | --- |
| **Hiring manager asks** | Manager DMs the agent | *"What does [name] cost in Krakow if she relocates from Belfast?"* — Agent returns a one-screen summary in 90 sec: total package (€X / PLN Y), home-vs-dest delta, relocation cost, tax flag, ETA on formal sign-off (24 hours). |
| **Total Rewards reviews** | Specialist gets a Teams card | Full package: all inputs, band position, equal-pay justification field (mandatory if > 75th percentile or < 25th), *Approve / Edit / Reject / Refer to external advisor* buttons. 5-minute review. |
| **Audit & justification** | Every approved package | Logs inputs, band position, equal-pay justification, FX rate. Surfaced to HRD + CFO + legal quarterly for fairness review. |

## POC pass criteria

- Median time-to-draft drops from ~3 days to ≤24 hours on UK↔IE and UK↔PL pairs.
- Draft accuracy ≥90% (Total Rewards approves draft as-is or with minor edits).
- Equal-pay justification rate at 100% (every package logs band position).
- Zero legal-flagged equal-pay issues.
- Senior cross-border candidate-withdrawal-due-to-slow-offer drops from ~12% baseline to ≤5%.

## Pod & cost

| Role | FTE | Commitment |
| --- | --- | --- |
| Solution Architect | 0.4 | 10 weeks — architecture + data consolidation |
| AI / Agent Engineer | 0.5 | 10 weeks — Copilot Studio build + evals |
| Data / Integration Engineer | 0.5 | 10 weeks — Workday + SharePoint consolidation (the lift) |
| UX Designer | 0.2 | 5 weeks — hiring-manager + Total Rewards surface |
| QA / Security Reviewer | 0.2 | 10 weeks — legal + Total Rewards lead |
| Product Lead | 0.1 | 10 weeks — scope and metric ownership |
| **Total** | **= 1.9** | **= 19 FTE-weeks + ~£600 Azure OpenAI** |

## Real vs stubbed in v1

**Real.** Workday Comp + Benefits + HCM reads, custom Cross-Border Comp object, FX feed, COL lookup, relocation matrix, routine tax-equalisation rule engine, Teams adaptive card, audit log.

**Stubbed.**
- External tax advisor referral hand-off (today is email; v2 has structured API).
- Workday Talent Mobility pairing (v2 once GA).
- Full jurisdictional coverage (UK↔IE + UK↔PL only in v1; UK↔DE, UK↔US, UK↔CA, IE↔PL, intra-EU in v2).
- Candidate-side comp transparency surface (v2).

## v1 → v2 path

**v1** (UK↔IE + UK↔PL, Pragmatic) ships the drafter.

**v2 adds**
1. **Bold "Total Rewards Co-pilot"** — agent owns the package end-to-end, posts direct to Total Rewards approval queue, then to candidate, with TA in the loop only when the candidate negotiates.
2. Full jurisdictional coverage.
3. Workday Talent Mobility pairing (TM surfaces the move; this agent prices it).
4. Candidate-side comp transparency in line with EU Pay Transparency Directive.

v2 shifts the agent from *"drafts and submits"* to *"owns the comp conversation"*.

## The ask

1. **Sponsor Total Rewards + IT** to consolidate the cross-border comp inputs into a single Workday-resident source-of-truth over the 10-week build.
2. **Sponsor 1.9 FTE for 10 weeks** across the CoE — the data work is the lift, not the agent.

**Without (1), v2 is impossible.**
