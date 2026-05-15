# Virtual Desktop Application Catalogue

> Consolidated from all 8 active agent designs in `~/Desktop/AI-CoE/director-briefs/` plus the 59-entry ROADMAP.md.
> Purpose: define every application and internal page that must exist inside the virtual desktop UI.

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Already exists (in VirtualDesktop or as a live prototype) |
| 🟡 | Stub exists but needs full implementation |
| 🔴 | Not built yet — needed for agent demo |
| 📦 | Reuse existing system app (Workday/Teams/Outlook) |

---

## Tier 1 — System Applications (shared across all agents)

These are the "native" apps of the virtual desktop. Every agent interaction surfaces through at least one of them.

### 1. Workday
> Primary system of record for HR, time, absence, compensation, org data.

| Page / View | Status | Used By |
|---|---|---|
| Worker profile (read-only) | 🟡 stub | All People Ops agents |
| Worker profile — absence history pane | 🔴 | #04 Sickness Absence |
| Worker profile — immigration case tab | 🔴 | #07 Immigration Visa |
| Worker profile — probation status / timeline | 🔴 | #03 Probation |
| Worker profile — retention risk score | 🔴 | #05 Retention Risk |
| Worker profile — skills profile | 🔴 | #57 Skills Profile |
| Inbox / tasks (adaptive cards) | 🔴 | #03, #04, #07, #09 |
| Time Tracking — timesheet entry | 🟡 stub | #01 Timesheet Chaser |
| Time Tracking — timesheet compliance dashboard | 🔴 | #01 Timesheet Chaser (PMO view) |
| Absence — submit request | 🟡 stub | #04 Sickness Absence |
| Absence — approval queue | 🔴 | #04, #07, #09 |
| R&R — nomination submission | 🔴 | #09 R&R |
| R&R — nominations queue (approver view) | 🔴 | #09 R&R |
| Performance — goals | 🔴 | #08 Continuous Feedback |
| Performance — feedback / check-ins | 🔴 | #08 Continuous Feedback |
| Performance — EOYR form | 🔴 | #08 Continuous Feedback |
| Talent — succession plan | 🔴 | #56 Succession Health |
| Talent — calibration prep | 🔴 | #25 Talent Calibration |
| Talent — promotion panel | 🔴 | #26 Promotion Panel |
| Org chart / supervisory orgs | 🔴 | #05 Retention Risk, #56 Succession |
| Reports & Analytics (RaaS) | 📦 mock | #01, #04, #10, #20, #35 |
| PSA — project burn / milestone view | 🔴 | #02, #10, #12, #16 |
| PSA — utilisation dashboard | 🔴 | #10, #12, #43 |
| Onboarding — joiner checklist | 🔴 | #05 New Starter, #54 Onboarding |

### 2. Teams
> Chat, channels, adaptive cards, bot DMs.

| Page / View | Status | Used By |
|---|---|---|
| Chat list + DM threads | 🟡 stub | All agents |
| Channel list + messages | 🟡 stub | #01, #02, #04, #08, #40 |
| Adaptive card renderer (bot posts) | 🔴 | #01, #03, #04, #05, #07 |
| Bot conversation pane | 🔴 | #01, #03, #04, #05, #08, #47 |
| Presence / status | 🔴 | #05 Retention Risk |
| "Friday wins" channel (signal source) | 🔴 | #08 Continuous Feedback |

### 3. Outlook
> Email, calendar, notifications.

| Page / View | Status | Used By |
|---|---|---|
| Inbox — message list | 🟡 stub | All agents |
| Inbox — reading pane | 🔴 | All agents |
| Compose / draft | 🔴 | #01, #02, #08, #40, #46 |
| Calendar — week view | 🔴 | #01, #03, #05, #08 |
| Calendar — event detail / accept-decline | 🔴 | #03 Probation (review booking) |
| Sent items | 🔴 | #01, #02, #40 |
| Daily digest (Workday-style) | 🔴 | #44 Approval-Inbox Co-pilot |

### 4. Finder (Files)
> File browser for SharePoint, OneDrive, local.

| Page / View | Status | Used By |
|---|---|---|
| File tree / folder browser | 🔴 | #02, #03, #04, #08, #34 |
| Document preview | 🔴 | #02, #03, #04 |
| Upload / save | 🔴 | #03, #04, #08 |

---

## Tier 2 — Agent-Specific Applications

Each agent that needs a dedicated UI beyond system apps gets its own app window in the desktop.

### A. Timesheet Chaser (#01)
> PMO / consultant surface for timesheet compliance + auto-draft confirmation.

| Page / View | Status | Audience |
|---|---|---|
| Compliance Dashboard | 🔴 | PMO — submission rate, repeat offenders, project-code anomalies |
| Timesheet Draft Card | 🔴 | Consultant — "Confirm or amend" pre-drafted week |
| Exception Review | 🔴 | PM — overtime, wrong project, missing PO |
| Audit Log | 🔴 | PMO — every nudge, every confirmation, every escalation |
| Policy Q&A (edge cases) | 📦 Self-Service | Consultant |

### B. Status Report Drafter (#02)
> PM surface for RAG status reports; steerco surface for live dashboard.

| Page / View | Status | Audience |
|---|---|---|
| PM Draft Editor | 🔴 | PM — pre-filled report, RAG selector, commentary box |
| Steerco Dashboard | 🔴 | Account leads — per-account RAG, cited claims, hyperlink drill-down |
| Template Admin | 🔴 | PMO Lead — single mandated template, field mapping |
| Shadow Comparison | 🔴 | PMO — agent RAG vs PM RAG, agreement rate |

### C. Probation Review Orchestrator (#03)
> Manager + People Ops surface for probation lifecycle.

| Page / View | Status | Notes |
|---|---|---|
| Probation Tracker | ✅ live at `/probation` | People Ops — all active probations, timeline, alerts |
| Review Pack | ✅ live at `/probation` | Manager — evidence pack, decision form, draft write-up |
| Calendar Booking | 📦 Outlook | Manager — review 1:1 auto-booked |
| Escalation Queue | 🔴 | People Ops — missing manager, conflict, managed-out |

### D. Sickness Absence Framework Coach (#04)
> Manager + People Ops surface for UK absence framework.

| Page / View | Status | Notes |
|---|---|---|
| Absence Dashboard | ✅ live at `/sickness-absence` | Manager — absence history, threshold status |
| RTW Task Card | ✅ live at `/sickness-absence/demo` | Manager — pre-drafted WARM talking points |
| Stage Alert Card | ✅ live at `/sickness-absence/demo` | Manager — Stage 1/2/3 prompt with framework excerpt |
| PO Exclusion Flags | 🔴 | People Ops — disability/pregnancy exclusion management |
| Transparency Log | 🔴 | People Ops — SharePoint-style append-only audit log |
| Skip-Level Escalation | 🔴 | Skip manager — unactioned Inbox task nudge |
| Pattern Auditor (Loop C) | 🔴 | People Ops — Monday/Friday clustering, payday patterns |

### E. Retention Risk Early Warning (#05)
> Manager surface for flight-risk signals + coaching.

| Page / View | Status | Audience |
|---|---|---|
| Weekly Risk Digest | 🔴 | Manager — top 3–5 at-risk reports, signal summary, talking points |
| Individual Risk Profile | 🔴 | Manager — full signal breakdown (Peakon, comp, tenure, 1:1 gaps) |
| Calibration Panel | 🔴 | Talent / HR — protected-characteristic audit, fairness review |
| Development Conversation Log | 🔴 | Manager — 6-monthly tracked cadence |

### F. Immigration & Visa Case Tracker (#07)
> Global Mobility + employee surface for visa case lifecycle.

| Page / View | Status | Audience |
|---|---|---|
| Case Tracker Board | 🔴 | Global Mobility — Kanban/list of all cases, milestones, deadlines |
| Case Detail View | 🔴 | Global Mobility + employee — milestone history, next action, documents |
| RTW Expiry Dashboard | 🔴 | Global Mobility — BRP/passport/visa expiry at 90/30/7 days |
| Compliance Audit Pack | 🔴 | Global Mobility — one-click Home Office audit report |
| Hiring-Manager Guardrail | 🔴 | Manager — project-assignment visa-conflict flag |
| Employee Portal | 🔴 | Employee — my case status, next action, document upload |

### G. Continuous Feedback / EOYR Replacement (#08)
> Manager + consultant surface for feedback capture + EOYR synthesis.

| Page / View | Status | Audience |
|---|---|---|
| Feedback Pipeline | 🔴 | Manager — consent-gated signal sources, capture density |
| Quarterly Evidence Digest | 🔴 | Manager + consultant — auto-drafted per-consultant digest |
| Check-in Prompt | 🔴 | Manager — 30-min check-in scheduler, capture form |
| EOYR Draft Editor | 🔴 | Manager + consultant — self-assessment + manager assessment drafts |
| Calibration Outlier Panel | 🔴 | Calibration panel — unusually positive/negative captures |
| Consent Dashboard | 🔴 | Consultant — what the agent captured, per-source opt-in/out |

### H. R&R Agentic Approver (#09)
> People Ops surface for auto-approval + audit.

| Page / View | Status | Notes |
|---|---|---|
| Nominations Queue | ✅ live at `/r-and-r/demo` | People Ops — incoming nominations, exception routing |
| Approval Audit Log | ✅ live at `/r-and-r/demo` | People Ops — every decision with ruleset_version |
| Policy Ruleset Viewer | 🔴 | People Ops — versioned YAML ruleset, threshold config |
| Shadow Mode Comparator | 🔴 | People Ops — agent vs human decision side-by-side |
| Pattern Detection (Phase 2) | 🔴 | People Ops — reciprocity, ring nominations, off-policy bursts |

---

## Tier 3 — Cross-Cutting / Platform Applications

These support multiple agents or provide shared infrastructure.

### Agent Directory / Launchpad
> Single place to discover, configure, and launch any agent.

| Page / View | Status | Purpose |
|---|---|---|
| Agent Grid | 🔴 | Browse all 59 agents, filter by function / priority / stage |
| Agent Detail Card | 🔴 | Per-agent: design doc, delivery plan, demo link, status |
| Agent Admin | 🔴 | Enable/disable agents per tenant, configure thresholds |

### Analytics / Reporting
> Shared dashboards that aggregate across agents.

| Page / View | Status | Purpose |
|---|---|---|
| CoE Value Tracker | 🔴 | Hours saved, £ recovered, adoption rates across all agents |
| Agent Health Monitor | 🔴 | Shadow-mode agreement rates, exception counts, drift detection |
| Audit Console | 🔴 | Cross-agent audit log search, 7-year retention compliance |

---

## Summary Table — Build Priority

| Priority | Apps / Pages | Count | Effort |
|---|---|---|---|
| **P0 — Fix stubs** | Teams chat+channels, Outlook inbox+reading pane, Workday profile | 3 apps | Medium |
| **P1 — Live prototypes** | Probation tracker, Sickness Absence demo, R&R demo | 3 apps | Mostly done |
| **P2 — MVP agents** | Timesheet dashboard, Status Report drafter, Immigration tracker, Retention Risk digest, Feedback/EOYR draft | 5 apps | High |
| **P3 — Fast Follow** | Onboarding, Off-boarding, Contract Tracker, Overburn, Utilisation, etc. | 10+ apps | High |
| **P4 — Future** | Skills Profile, Succession, Promotion Panel, Bid Resource, etc. | 15+ apps | Very High |

---

## Recommended Next Steps

1. **Complete Tier 1 stubs first** — Teams, Outlook, Workday need functional CRUD against the live mock API so agents have surfaces to write into.
2. **Package existing prototypes as desktop apps** — `/probation`, `/sickness-absence/demo`, `/r-and-r/demo` should be launchable from the desktop dock as first-class apps.
3. **Build the Agent Directory** — a simple grid/catalogue that lets users browse and launch any agent demo. This is the "app store" of the virtual desktop.
4. **Pick 2 P2 agents to build next** — Timesheet Chaser (high signal, clear PMO/consultant split) and R&R Approver (already has a working demo, needs policy ruleset + audit log pages) are the best candidates.
