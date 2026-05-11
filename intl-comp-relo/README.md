# International Comp & Relocation Agent

A Total Rewards drafter that returns a full cross-border comp package — band, FX-normalised offer, COL delta, tax flag, relocation policy, benefits parity, equal-pay justification — in under 90 seconds, against a consolidated Workday-resident source of truth.

**Status:** Candidate. Not catalogued; the home-page card is gated behind ⌘K / Ctrl+K. Direct URLs work for anyone who has them.

**Live pages**

| Page | URL | Audience |
| --- | --- | --- |
| Landing | `/intl-comp-relo` | Entry point; routes to the three docs below |
| Proposal | `/intl-comp-relo/proposal` | Total Rewards lead, HR Director, CFO, Workday IT lead |
| Technical | `/intl-comp-relo/technical` | IT, Architect, Engineer, anyone reviewing how the agent works |
| Demo | *(not built)* | Deferred until at least one sponsor has nodded to the proposal |

**Design package (markdown — for the build team, not sponsors)**

| File | What it is |
| --- | --- |
| [`01-greenlight-package.md`](01-greenlight-package.md) | The pitch. Problem, origin ladder, Bold + Pragmatic solutions, quantitative anchors, Workday portfolio overlap, risk profile, architecture, sprint plan, pod & cost, the ask. |
| [`02-bold-build-brief.md`](02-bold-build-brief.md) | Bold variant (v2). End-to-end agent with write access to `CrossBorderComp`. 14 tool contracts, full schema + state machine, approval routing decision table, Bold-specific risks. |
| [`02-pragmatic-build-brief.md`](02-pragmatic-build-brief.md) | Pragmatic variant (v1). Read-only drafter. Explicit non-goals, adaptive-card field list, source-of-truth read paths with freshness refusal copy, POC pass-criteria mapping. |
| [`03-source-of-truth-schema.md`](03-source-of-truth-schema.md) | The data lift. Today's state vs. target Workday Extend objects (`XBC_FxRate`, `XBC_ColIndex`, `XBC_RelocationCorridor`, `XBC_BenefitsParityRule`, `XBC_TaxRule`). Data lineage, freshness cadence, 6-week migration plan, governance. |
| [`04-evaluation-harness.md`](04-evaluation-harness.md) | Replayable eval that gates v1 ship. 24 golden cases (UK↔IE, UK↔PL), 12 adversarial cases (one per guardrail), scoring rubric with per-field tolerances, fixture spec, run cadence. |

**How the pieces relate**

```
01-greenlight ─┬─▶ proposal/index.html  (sponsor pitch)
               │
               ├─▶ 02-bold-build-brief
               │      │
               │      └─▶ 03-source-of-truth-schema
               │              │
               ├─▶ 02-pragmatic-build-brief
               │      │
               │      └─▶ 03-source-of-truth-schema
               │
               └─▶ 04-evaluation-harness
                          │
                          └─▶ technical/index.html  (technical overview)
```

The HTML pages are sponsor-facing surfaces. The markdown docs are build-team working artefacts. The technical HTML transposes ~70% of the markdown into a single readable surface for IT / Architect / Engineer audiences; the build team uses the markdown directly.

**Naming hygiene**

All artefacts in this directory follow the AI-CoE naming rule: neither `Kainos` nor `Niokas` appears anywhere. Real-named people are role-described. The external tax advisor is referred to generically.

**Next steps if greenlit**

1. Schedule the four sponsor conversations (Total Rewards lead, HRD, CFO, Workday IT lead). Answer the 8 source-of-truth open questions before week 1.
2. Stand up the Workday Extend `XBC_*` objects in sandbox (week 1–2 of the data lift).
3. Build the agent loop in Copilot Studio against the sandbox SoT (weeks 3–8).
4. Author the 36 eval cases (golden + adversarial) from historical packages provided by Total Rewards (weeks 1–4, in parallel).
5. Pre-pilot gate at week 9: ≥22/24 golden, 12/12 adversarial, zero legal-flagged equal-pay issues.
6. Pilot weeks 9–10 on live UK↔IE + UK↔PL packages.

**Next steps if not greenlit**

Three reusable patterns from this design generalise to other AI-CoE prototypes regardless of whether this build ships:

- *Data-consolidation-before-agentification* — the upstream lift is the project, not the agent.
- *Freshness-refusal as a first-class guardrail* — stale input → refusal, not best-effort.
- *Equal-pay justification logging* — sealed-on-approval audit row with source-version stamping, 7-year retention.

Worth extracting into the CoE skill library independent of this prototype's fate.
