# CoE Tenant Kit

Reusable Workday tenant + Microsoft Teams chrome for CoE prototypes.

The first prototype (Agentic Probation) hand-rolled this chrome end-to-end. Anything new starts here instead — copy the kit, slot domain content, ship.

---

## Files

| File | What it is |
|---|---|
| `tenant-template.html` | Working starter. Open in a browser; you get the WD tenant on the left and Teams panel on the right with a draggable divider. Fill the SLOT regions. |
| `tenant-styles.css` | All Workday + Teams chrome CSS extracted from the probation prototype. ~840 lines, uses Canvas tokens for colour / spacing / type. |
| `tenant-icons.svg` | Workday Canvas System Icons sprite (12 symbols). Loaded by the template via `fetch` and inlined into the DOM. |
| `tenant-helpers.js` | Runtime helpers: `initSplitDrag()`, `loadExpressiveIcons()`, `bindHeaderPersonaPhoto()`. |
| `README.md` | This file — catalogue + usage. |

---

## Starting a new prototype

```bash
cp -r _tenant-kit ../my-new-prototype
cd ../my-new-prototype
mv tenant-template.html index.html
```

Open `index.html` in a browser to confirm the chrome boots, then:

1. Edit the `topbar` (top of file) — set the title and persona switcher labels for your prototype, or remove it.
2. Edit the `timeline` — keep if your prototype simulates progression through stages, otherwise delete the whole `.timeline` block.
3. Fill the `wd-profile-grid` slots — left column (worker card / side cards), centre column (cards / tabs / lists), right column (more side cards).
4. Edit the Teams `chat-messages` block — populate bot cards from your data layer.

Wire your `<script>` after `tenant-helpers.js` to drive interactivity (persona switching, timeline scrubbing, bot rendering).

---

## What the kit ships, visually

### Top frame (optional)

- **`.topbar`** — slim dark CoE branding bar. `.topbar-brand`, `.topbar-title`, `.persona-group` with `.persona-btn` (active class).
- **`.timeline`** — simulator strip with `.timeline-step` buttons. Active and `.passed` states styled.

### Workday tenant pane (`.panel-workday`)

- **`.wd-header`** — slim navy bar (48px). Logo slot, centred pill `.wd-search`, right-side icons (`.wd-icon-btn`, `.wd-icon-bell-badge`, `.wd-profile-photo`).
- **`.wd-rail`** — left vertical icon nav (Home / Personal / Team / More / Saved / Settings). Items use `.wd-rail-item` with `.active`.
- **`.wd-main`** — main content area, padded.
- **`.wd-profile-grid`** — three-column layout. Folds responsively when the pane is narrow (right rail wraps below centre at < 1700px).
  - **`.wd-left-col`** — vertical stack: breadcrumb, dropdown, worker card, additional cards.
  - **`.wd-center-col`** — primary content. Use `.cnvs-card`, `.tabs-card`, `.inbox-card-bottom`, `.wd-tile-row`.
  - **`.wd-side-col`** — secondary cards using `.wd-side-card`.
- **`.wd-worker-v2`** — the blue-banner / avatar-overlap card. Generic enough for any "subject" view (worker, project, vendor). Use `.wd-worker-banner`, `.wd-worker-avatar-v2`, `.wd-worker-pronoun`, `.wd-worker-name`, `.wd-worker-role`, `.wd-actions-pill`, `.wd-quick-buttons` with `.wd-quick-btn`, `.wd-more-link`.
- **`.wd-tile-row`** — 4-up (2-up at narrow) icon-and-label tile row. Use `.wd-tile`, `.wd-tile-icon`, `.wd-tile-label`, `.wd-tile-value`.
- **`.wd-side-card`** — generic side card. `<h3>`, then `.wd-detail-row` rows with `.wd-detail-label` and `.wd-detail-value`. `.wd-side-card-empty` for empty-state copy.
- **`.tabs-card`** — tabbed card with `.cnvs-tabs-list` + `.cnvs-tab-item`. Tab panels use `.tab-panel` with `.active`.
- **`.inbox-card-bottom`** — list-of-tasks card with `.inbox-card-heading` and `.cnvs-count-badge`.

### Drag divider (`.wd-divider`)

5px-wide grippable handle between the panes. Default split 70/30, draggable between 25 and 80 percent. Choice persists for the session via `sessionStorage` key `wd_split_pct`. Keyboard: focus the divider, ←/→ nudge by 2%.

### Teams chat panel (`.panel-chat`)

- **`.tx-header`** — single conversation header with `.tx-identity` (avatar + status dot), tabs (`.tx-tab`, `.tx-tab-add`), action buttons (`.tx-act-btn`). Below 520px the kit auto-collapses Search and Open-in-new-window via container query.
- **`.chat-messages`** — scroll area for bot/user messages.
- **`.teams-msg`** — message row. Variants: `.teams-msg-bot`, `.teams-msg-user`, `.teams-msg-info`.
- **`.teams-msg-bubble`** — message bubble.
- **`.teams-msg-actions`** with `.teams-msg-cta` / `.teams-msg-cta-secondary` — action buttons under a bot card.
- **`.tx-compose`** — decorative compose bar at bottom (input is `disabled` by default).

### Loading states

- **`.cnvs-loading-animation`** + **`.cnvs-loading-dots`** — Canvas Kit loading indicators are loaded; drop them in where useful.

### Modals / action bars

- **`.cnvs-modal`** — modal chrome via canvas-kit-css-modal.
- **`.cnvs-action-bar`** — sticky action bar via canvas-kit-css-action-bar.
- **`.cnvs-page-header`** — page title strip via canvas-kit-css-page-header.

---

## Icons

### Canvas System Icons (sprite, inlined)

Loaded from `tenant-icons.svg`. Reference with `<use href="#wd-icon-{name}">`. Available:

`notifications`, `inbox-fill`, `search`, `user-focus`, `document`, `document-task`, `exclamation-triangle`, `comment`, `check-circle`, `clock`, `circle`, `chevron-right-small`, `x`.

If you need more system icons, copy the symbol from `node_modules/@workday/canvas-system-icons-web/dist/svg/` into `tenant-icons.svg`.

### Canvas Expressive Icons (sprite, async)

Auto-loaded by `loadExpressiveIcons()`. After it resolves, `<use href="#wd-expressive-{name}">` works for all 411 expressive icons (accounting, analytics, calendar, chart, etc.).

---

## Versioning

Version this kit by tagging commits. Each prototype's README should record the kit version it copied so we can diff later.

---

## Mock tenant + launcher

A multi-page mock Workday tenant lives at `/tenant/{home,inbox,pay,time-off,directory,profile}`. It is **not linked from anywhere** — open it only via the hotkey:

```
Cmd+Shift+E   (Ctrl+Shift+E on Win/Linux)
```

Any prototype can wire this in by adding one line:

```html
<script src="/_tenant-kit/tenant-mock-launcher.js" defer></script>
```

The launcher is also included on every tenant page, so the hotkey toggles in both directions:

- From a non-tenant page → navigates to `/tenant/home`.
- From a tenant page → goes back (history) to wherever you came from, or `/` if there's no history.

Exposes a `window.tenantMock` API: `enter()`, `exit()`, `toggle()`.

To extend the mock tenant — add a page, change the persona, alter the rail — edit `coe-prototypes/tenant/_shared/shell.js` (rail config, persona) and `shell.css` (layout). The `TENANT_NAV` array drives the left rail across all pages.

## Catalogue of prototypes using this kit

See `coe-prototypes/CATALOGUE.md` at the repo root.
