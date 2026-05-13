# CoE Prototype Catalogue

A running map of CoE prototypes built in this repo and the reusable kit they share.

---

## Reusable kit

[`_tenant-kit/`](_tenant-kit/README.md) — Workday tenant chrome + Microsoft Teams chat panel, divider, helpers, system + expressive icon sprites. Copy this folder when starting a new prototype.

---

## Prototypes

### Agentic Probation
- **Path:** [`probation/`](probation/)
- **Live:** coe-prototypes.vercel.app/probation
- **What it is:** AI assistant in Microsoft Teams that watches the probation lifecycle in Workday, nudges manager and employee at six beats (Week 1 → Review Day), and drafts the review pack from real evidence.
- **Status:** Working prototype with three personas (Manager Dave, Employee Alice, Employee Ben), six timeline beats, scripted bot nudges.
- **Design guide:** [`probation/DESIGN_GUIDE.md`](probation/DESIGN_GUIDE.md) (also `.docx`).
- **Built before the kit existed.** Chrome lives inline in `probation/index.html`; the kit was extracted from this prototype.

### R&R Auto-Approver
- **Path:** [`r-and-r/`](r-and-r/)
- **Live:** coe-prototypes.vercel.app/r-and-r
- **What it is:** Agent that auto-approves the ~190 in-policy R&R nominations per cycle in Workday, leaves the ~10 exceptions on the existing BP for People Ops, and surfaces every decision in a SharePoint Excel sheet for ambient transparency.
- **Status:** Four-page prototype — landing (`/r-and-r`), live demo (`/r-and-r/demo`), agent design (`/r-and-r/agent-design`), delivery plan (`/r-and-r/delivery-plan`).
- **Demo principle:** demo = production. Workday tenant on the left submits nominations live; SharePoint Excel sheet on the right shows the decision row appear with full rule trace.
- **Demo page note:** overrides the tenant-kit body zoom/split-pane to fit the two-pane Workday + SharePoint layout (does not reuse `.panel-workday` / `.panel-chat`).

### Sickness Absence Framework Coach
- **Path:** [`sickness-absence/`](sickness-absence/)
- **Live:** coe-prototypes.vercel.app/sickness-absence (⌘K-hidden on the gallery; URL publicly hittable)
- **What it is:** UK-only Workday-resident agent that turns the Sickness Absence Framework from "manager remembers to do it" into "Workday Inbox makes sure it happens" — Loop A drafts an RTW task on every absence-close; Loop B re-tallies the rolling-12-month count + day against Stage 1 thresholds nightly and drafts a stage-review task when crossed; Loop C runs nightly day-of-week + payday clustering across the UK BU and surfaces soft pattern signals when an individual's absence shape diverges from team baseline at p<0.05 (the new v1 capability that absorbs roadmap #59 Sickness Absence Pattern Coach into the #22 build). Protected-characteristic absences structurally excluded via a PO-maintained exclusion mechanism.
- **Status:** Four-page prototype — landing (`/sickness-absence`), agent design (`/sickness-absence/agent-design`), delivery plan (`/sickness-absence/delivery-plan`), live demo (`/sickness-absence/demo`). Demo is a Teams/Copilot-style chat surface where the manager interacts with the Sickness Absence Coach — three scripted scenarios (Eve Hart / Tom Reed / Priya M.) covering a Stage 1 fire, a pattern catch (Friday clustering — the new Loop C capability), and a protected-absence no-fire (Equality Act 2010 §18 exclusion).
- **Demo principle:** chat, not wireframe. CoE head directive: the agent comes to the manager in a conversational surface, not as static UI panels. Same principle as the probation prototype's Teams chat.
- **Brief lineage:** v1 of the agent design + delivery plan (`director-briefs/04-...-*.md`) are marked HISTORICAL INPUT — they used Bradford-factor framing. v2 supersedes; both v2 files anchor on UK Sickness Absence Policy v8.0 Appendix A (count + day thresholds).
- **Load-bearing dependency:** the PO exclusion mechanism does not exist in Workday today — Equality Act 2010 §15/§18 exposure if v1 ships without it. v1 reads from a PO-maintained SharePoint list during a mandatory 4-week shadow phase; cuts over to a native Workday Custom Field before live Inbox writes. See §12 Stress-test in the v2 build spec.

---

## Adding a new prototype

1. Copy the kit:
   ```bash
   cp -r _tenant-kit my-new-prototype
   cd my-new-prototype
   mv tenant-template.html index.html
   ```
2. Fill the slots in `index.html` (top bar / timeline / profile grid / Teams messages).
3. Add an entry above with: name, path, what it is, status, design guide link.
4. If routing is needed, update `vercel.json` and the root `index.html`.
