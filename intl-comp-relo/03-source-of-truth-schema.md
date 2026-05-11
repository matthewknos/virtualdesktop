# Source-of-Truth Schema — Cross-Border Comp Inputs

| Field | Value |
| --- | --- |
| **Status** | Design — pre-build |
| **Parent docs** | [01-greenlight-package.md](01-greenlight-package.md) • [02-bold-build-brief.md](02-bold-build-brief.md) • [02-pragmatic-build-brief.md](02-pragmatic-build-brief.md) |
| **Scope** | The six **input** sources the agent reads from. Not the Cross-Border Comp **output** object — that's [Bold §5](02-bold-build-brief.md#5-workday-cross-border-comp-object--proposed-schema). |
| **Sponsor** | Total Rewards lead + Workday IT lead (joint) |
| **Lift estimate** | ~6 weeks, ~0.5 FTE Data/Integration eng — runs in parallel to weeks 1–6 of the agent build |

The greenlight package is explicit: **this is a consolidation problem before it is an agent problem.** Today the agent's six inputs live across Workday and 6 SharePoint sites with conflicting versions. This doc specifies the target state — a single Workday-resident source-of-truth — and the migration to get there.

---

## 1. Today's state vs. target state

| Input | Today | Target |
| --- | --- | --- |
| Bands | Workday Compensation (authoritative) | Workday Compensation — extend metadata only (`as_of_quarter`, `source_version`) |
| FX feed | SharePoint site #1, manually updated by Total Rewards | Workday Extend object `XBC_FxRate` — refreshed via Power Automate from a single licensed feed |
| COL index | SharePoint site #2, last refresh of record varies by city | Workday Extend object `XBC_ColIndex` — refreshed quarterly from named provider |
| Relocation matrix | SharePoint site #3, owned by HR Ops | Workday Extend object `XBC_RelocationCorridor` — keyed on `(home, dest, level)` |
| Benefits parity | Workday Benefits (per-country catalogues) + SharePoint site #4 (parity rules) | Workday Benefits (unchanged) + Workday Extend object `XBC_BenefitsParityRule` for the cross-corridor reconciliation logic |
| Tax-equalisation rules | SharePoint site #5 + external tax advisor email thread | Workday Extend object `XBC_TaxRule` — routine cases only; non-routine handled by referral hand-off |

**SharePoint site #6** (mentioned in the greenlight's "6 different sources" count) is the legacy relocation policy doc archive — kept as a read-only reference link from each `XBC_RelocationCorridor` record, not migrated.

## 2. Why one Workday-resident object set

| Option | Notes | Decision |
| --- | --- | --- |
| Leave inputs federated; agent reads SharePoint live | No data migration. But: 6 freshness regimes, 6 audit trails, 6 owners. The agent's refusal-on-stale logic becomes 6 separate checks against 6 inconsistent metadata schemes. | **Rejected** |
| Federated reads with a thin "manifest" layer cataloguing freshness | Lighter lift. But: still 6 schemas, and audit retention is split. | Considered. Not chosen — manifest layer becomes its own SoT problem within 12 months. |
| **Consolidated Workday Extend objects** | One audit trail, one freshness regime, one access-control surface. ~6 weeks integration. Aligns with the Cross-Border Comp object the Bold agent writes. | **Chosen** |

Workday Extend was chosen over a separate data platform because (a) the agent already reads Workday for bands/benefits/HCM, (b) Workday's audit retention and access-control model satisfies the 7-year equal-pay requirement out of the box, and (c) the Bold-v2 write surface (`CrossBorderComp`) lives in Workday Extend already — same governance plane.

## 3. Schemas

### 3.1 Bands — `WD_CompBand` (existing, with extensions)

Existing Workday Compensation object. Two metadata fields added for the agent's freshness check:

```
WD_CompBand (existing)
  band_id              string, PK
  level                string, mandatory          # e.g., "Senior", "L4"
  country              ISO 3166-1 alpha-2, mandatory
  function             string, mandatory          # e.g., "Engineering", "Delivery"
  currency             ISO 4217, mandatory
  p25                  decimal, mandatory
  p50                  decimal, mandatory
  p75                  decimal, mandatory
  effective_date       date, mandatory
  # extensions for agent
  as_of_quarter        string, mandatory          # e.g., "2026-Q2"
  source_version       string, mandatory          # e.g., "TR-bands-2026Q2-v1"
```

Freshness rule: `as_of_quarter` must equal the current quarter. Stale → refusal.

### 3.2 FX feed — `XBC_FxRate` (new)

```
XBC_FxRate
  pair_id              string, PK                 # e.g., "GBP-EUR"
  from_ccy             ISO 4217, mandatory
  to_ccy               ISO 4217, mandatory
  rate                 decimal(18,6), mandatory
  as_of_date           date, mandatory
  source               string, mandatory          # e.g., "ECB reference rate"
  source_version       string, mandatory
  ingest_ts            timestamp, mandatory
```

Pre-load pairs needed for v1 pilot: `GBP-EUR`, `EUR-GBP`, `GBP-PLN`, `PLN-GBP`, `EUR-PLN`, `PLN-EUR`. Add pairs as jurisdictional coverage expands in v2.

Freshness rule: `as_of_date` ≥ today − 30 days. Refresh job runs weekly via Power Automate.

### 3.3 Cost-of-living index — `XBC_ColIndex` (new)

```
XBC_ColIndex
  city_id              string, PK                 # e.g., "GB-BFS"
  country              ISO 3166-1 alpha-2, mandatory
  city_name            string, mandatory
  index_value          decimal(8,2), mandatory    # baseline city = 100.00
  baseline_city_id     string, mandatory          # the index's reference city
  components           json, optional             # {housing, transport, goods, services}
  as_of_date           date, mandatory
  source               string, mandatory          # named provider
  source_version       string, mandatory
  ingest_ts            timestamp, mandatory
```

Pre-load cities for v1 pilot: London, Belfast, Dublin, Cork, Warsaw, Krakow, Gdańsk. Use ISO 3166-2 subdivision codes where unambiguous; otherwise IATA city codes.

Freshness rule: `as_of_date` ≥ today − 90 days per city. Refresh job runs quarterly.

### 3.4 Relocation matrix — `XBC_RelocationCorridor` (new)

```
XBC_RelocationCorridor
  corridor_id            string, PK              # e.g., "GB-IE-L4-Senior"
  home_country           ISO 3166-1 alpha-2, mandatory
  dest_country           ISO 3166-1 alpha-2, mandatory
  level                  string, mandatory
  lump_sum.amount        decimal, mandatory      # 0 allowed for in-policy "no relocation"
  lump_sum.currency      ISO 4217, conditional
  shipping.allowance     decimal, mandatory
  shipping.currency      ISO 4217, conditional
  temp_accom.max_days    integer, mandatory
  temp_accom.daily_cap   decimal, mandatory
  temp_accom.currency    ISO 4217, conditional
  tax_gross_up           boolean, mandatory
  policy_doc_ref         url, mandatory          # link to canonical policy doc on legacy SharePoint
  effective_from         date, mandatory
  effective_to           date, optional
  as_of_quarter          string, mandatory
  source_version         string, mandatory
```

Pre-load corridors for v1 pilot: all level × direction combinations for UK↔IE and UK↔PL. ~16 rows expected (4 levels × 2 corridors × 2 directions).

Freshness rule: `as_of_quarter` = current quarter, AND today between `effective_from` and `effective_to` (if set). Stale → refusal.

### 3.5 Benefits parity — `XBC_BenefitsParityRule` (new)

Workday Benefits already holds the per-country catalogues. This new object holds the **reconciliation logic** that the agent uses to compute the parity delta between home and destination.

```
XBC_BenefitsParityRule
  rule_id                string, PK
  category               enum {pension, healthcare, life, leave, learning, other}, mandatory
  home_country           ISO 3166-1 alpha-2, mandatory
  dest_country           ISO 3166-1 alpha-2, mandatory
  comparison_logic       enum {match_value, match_percentile, statutory_floor, custom_ref}, mandatory
  comparison_params      json, conditional       # e.g., {percentile: 50} for match_percentile
  custom_ref             url, conditional        # link to policy doc for custom_ref logic
  effective_from         date, mandatory
  effective_to           date, optional
  as_of_quarter          string, mandatory
  source_version         string, mandatory
```

Freshness rule: same as relocation corridor.

### 3.6 Tax-equalisation rules — `XBC_TaxRule` (new)

Routine cases only. Non-routine cases never enter this object — they go through `flag_to_external_tax_advisor` and live in the referral log.

```
XBC_TaxRule
  rule_id                string, PK              # e.g., "UK-IE-PAYE-EMP-2026"
  home_country           ISO 3166-1 alpha-2, mandatory
  dest_country           ISO 3166-1 alpha-2, mandatory
  employment_type        enum {employee, contractor, secondment}, mandatory
  scenario_tags          string[], mandatory     # e.g., ["PAYE-gross-up", "social-security-parity"]
  routine                boolean, mandatory      # always true in this object
  rule_logic_ref         url, mandatory          # link to canonical rule artefact
  inputs_schema          json, mandatory         # JSON Schema for the rule's required inputs
  outputs_schema         json, mandatory         # JSON Schema for the rule's outputs
  effective_from         date, mandatory
  effective_to           date, optional
  last_advised_at        date, mandatory         # last external-tax-advisor sign-off date
  source_version         string, mandatory
```

Pre-load rules for v1 pilot: `UK-IE-PAYE-EMP`, `IE-UK-PAYE-EMP`, `UK-PL-PIT-EMP`, `PL-UK-PIT-EMP`. Contractor variants land in v2.

Freshness rule: `last_advised_at` ≥ today − 12 months. Any rule that has not been re-confirmed by external advisor within a year cannot be used; the agent must flag the case.

## 4. Data lineage — output fields → input sources

Each field in the [Cross-Border Comp object](02-bold-build-brief.md#5-workday-cross-border-comp-object--proposed-schema) traces to one or more input sources. Used for: change-impact analysis, audit, debugging refusals.

| Cross-Border Comp field | Source(s) | Notes |
| --- | --- | --- |
| `corridor.*` | Workday HCM (subject), requisition (dest) | No SoT inputs |
| `comp.base.amount`, `comp.base.currency` | `WD_CompBand` (p25/p50/p75 by level × dest_country) + agent positioning logic | Currency = dest country band currency |
| `comp.sign_on.*` | Manual at requisition; not from SoT | Sponsor decides if sign-on is in scope for v1 |
| `comp.relocation.*` | `XBC_RelocationCorridor` | All lump-sum/shipping/temp-accom flow from one row |
| `comp.benefits_delta` | Workday Benefits (home + dest catalogues) + `XBC_BenefitsParityRule` | Rule applied per category |
| `comp.tax_equalisation.class` | `classify_tax_case` output, sourced from `XBC_TaxRule` matching | If no routine rule matches → class = `non_routine` |
| `comp.tax_equalisation.rule_id` | `XBC_TaxRule.rule_id` | Mandatory when class = routine |
| `comp.tax_equalisation.gross_up` | `XBC_TaxRule.rule_logic_ref` evaluated | Computed by `compute_routine_tax_equalisation` |
| `comp.tax_equalisation.referral_id` | `flag_to_external_tax_advisor` return | Mandatory when class = non_routine |
| `inputs.fx` | `XBC_FxRate` | `{rate, as_of_date as as_of, source}` |
| `inputs.col_delta_pct` | `XBC_ColIndex` (home_city, dest_city) | Computed: `(dest.index − home.index) / home.index` |
| `inputs.band` | `WD_CompBand` | `{p25, p50, p75, currency, as_of_quarter as as_of}` |
| `inputs.relocation_source_version` | `XBC_RelocationCorridor.source_version` | Snapshotted at draft time |
| `inputs.benefits_source_version` | `XBC_BenefitsParityRule.source_version` | Snapshotted at draft time |
| `equal_pay.band_position_pct` | `WD_CompBand` + agent positioning logic | Computed: `(base − p0) / (p100 − p0) × 100` |

## 5. Freshness cadence — summary

Single regime across all six sources. The agent runs `freshness_check` at the top of every draft; one stale input → full refusal.

| Source | Cadence | Refusal threshold | Refresh owner |
| --- | --- | --- | --- |
| `WD_CompBand` | Quarterly | `as_of_quarter` ≠ current quarter | Total Rewards lead |
| `XBC_FxRate` | Weekly (cap 30 days) | `as_of_date` < today − 30 | Power Automate job + escalation to Total Rewards |
| `XBC_ColIndex` | Quarterly (cap 90 days) | `as_of_date` < today − 90 | Total Rewards Ops |
| `XBC_RelocationCorridor` | Quarterly | `as_of_quarter` ≠ current quarter | HR Ops |
| `XBC_BenefitsParityRule` | Quarterly | `as_of_quarter` ≠ current quarter | Total Rewards + Benefits Ops |
| `XBC_TaxRule` | Annual re-confirmation by external advisor | `last_advised_at` < today − 365 | Total Rewards lead, contracted to external advisor |

The refusal copy that the agent shows to the user is in [Pragmatic §7](02-pragmatic-build-brief.md#7-source-of-truth-read-paths).

## 6. Migration plan (6 weeks, parallel to agent build weeks 1–6)

| Week | Deliverable |
| --- | --- |
| **1** | Extend schemas finalised and signed off by Total Rewards lead + Workday IT lead. Sponsor names a Data Owner per object. Legal sign-off on 7-year retention and access-control model. |
| **2** | Workday Extend objects stood up in sandbox. `source_version` stamping convention agreed. Audit retention rule applied. Access groups created: TotalRewards (full), HRD (full), CFO (full), HRBP (read), Agent service principal (read + scoped write to `CrossBorderComp` only). |
| **3** | FX + COL refresh jobs built in Power Automate. FX licensed feed contracted (or confirmed existing licence covers programmatic access). COL provider re-confirmed and quarterly cadence agreed. |
| **4** | Relocation matrix and Benefits parity rule rows authored for the v1 pilot corridors (UK↔IE, UK↔PL). Each row reviewed by HR Ops + Total Rewards. Source policy docs cross-linked. |
| **5** | Tax rule rows authored for v1 corridors. Routine-rule rule-logic artefacts (executable rule bodies) reviewed by external tax advisor; `last_advised_at` stamped. |
| **6** | End-to-end read test from the agent service principal: each `get_*` tool returns a valid row for every pilot scenario. Freshness refusal tested by deliberately staling one row per source. Migration handover to Data Owners. |

By week 6 (= agent build week 6, mid-Build sprint), every read the agent needs is hitting Workday — not SharePoint.

## 7. Governance

| Object | Data Owner | Change control |
| --- | --- | --- |
| `WD_CompBand` | Total Rewards lead | Existing Workday Compensation BP |
| `XBC_FxRate` | Total Rewards lead (machine-refreshed; humans only on provider change) | Power Automate job + alert on miss |
| `XBC_ColIndex` | Total Rewards Ops | Quarterly review ticket |
| `XBC_RelocationCorridor` | HR Ops | New corridor or rate change → Total Rewards lead + CFO sign-off |
| `XBC_BenefitsParityRule` | Total Rewards Ops + Benefits Ops | Quarterly review ticket |
| `XBC_TaxRule` | Total Rewards lead, with external advisor co-sign | Any new rule requires external advisor sign-off recorded in `last_advised_at` |

Quarterly fairness review: HRD + CFO + Legal review all approved Cross-Border Comp packages against the underlying SoT row versions for the quarter. Source-version stamping makes this audit reproducible.

## 8. Open questions for sponsor sign-off

1. **Workday Extend licensing** — does the current contract cover the five new objects, or is a tier change required? IT to confirm before week 1.
2. **FX provider** — is the existing licensed feed (if any) programmatically accessible, or do we need a new contract? Total Rewards lead to confirm.
3. **COL provider** — which provider is canonical going forward? Provider × cadence × cost decision needed by week 2.
4. **Sign-on bonus scope** — in or out of v1? Affects whether `comp.sign_on.*` has a SoT mapping or stays manual.
5. **Tax rule authoring** — does external tax advisor produce the rule bodies, or does Total Rewards author and external advisor signs off? Affects week-5 timeline.
6. **Legacy SharePoint sunset** — when do the six legacy sites become read-only? Proposal: read-only at end of week 6; archived at end of pilot (week 10).
7. **Data Owner named per object** — who owns each object day-to-day post-go-live? Cannot ship without this.
8. **Equal-pay audit access** — Legal needs read access to which subset of the SoT objects for the quarterly fairness review? Specify scope before access groups are built (week 2).
