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
