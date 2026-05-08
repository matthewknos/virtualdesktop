/**
 * CoE Tenant Kit — runtime helpers.
 * Drop-in script for prototypes built on the Workday tenant + Teams kit.
 *
 *   - initSplitDrag()      Enables the .wd-divider drag handle and persists the
 *                          chosen split in sessionStorage under wd_split_pct.
 *                          Also wires arrow-key nudges on the divider for a11y.
 *
 *   - loadExpressiveIcons() Async-loads Workday Canvas Expressive Icons sprite
 *                          and injects it into the DOM. After this resolves,
 *                          <use href="#wd-expressive-{name}"> works for any
 *                          icon in the pack (411 icons).
 *
 *   - bindHeaderPersonaPhoto(personaInitial) Optional helper to set the
 *                          header avatar text (top-right of the WD nav bar)
 *                          based on the logged-in persona.
 */

function initSplitDrag(opts = {}) {
  const dividerSelector = opts.divider || '#wd-divider';
  const mainSelector = opts.main || '.main';
  const minPct = opts.min ?? 25;
  const maxPct = opts.max ?? 80;
  const saveKey = opts.saveKey || 'wd_split_pct';

  const divider = document.querySelector(dividerSelector);
  const main = document.querySelector(mainSelector);
  if (!divider || !main) return;

  const saved = parseFloat(sessionStorage.getItem(saveKey));
  if (!isNaN(saved)) main.style.setProperty('--wd-split', saved + '%');

  const onMove = (e) => {
    const rect = main.getBoundingClientRect();
    const raw = ((e.clientX - rect.left) / rect.width) * 100;
    const pct = Math.max(minPct, Math.min(maxPct, raw));
    main.style.setProperty('--wd-split', pct + '%');
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('wd-dragging');
    divider.classList.remove('dragging');
    const m = main.style.getPropertyValue('--wd-split');
    if (m) sessionStorage.setItem(saveKey, parseFloat(m));
  };
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('wd-dragging');
    divider.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  divider.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cur = parseFloat(getComputedStyle(main).getPropertyValue('--wd-split')) || 60;
    const next = Math.max(minPct, Math.min(maxPct, cur + (e.key === 'ArrowLeft' ? -2 : 2)));
    main.style.setProperty('--wd-split', next + '%');
    sessionStorage.setItem(saveKey, next);
    e.preventDefault();
  });
}

function loadExpressiveIcons(version = '1.0.1') {
  const url = `https://cdn.jsdelivr.net/npm/@workday/canvas-expressive-icons-web@${version}/dist/sprite/wd-expressive-icon-sprite.svg`;
  return fetch(url)
    .then(r => r.ok ? r.text() : '')
    .then(svg => {
      if (!svg) return;
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      d.setAttribute('aria-hidden', 'true');
      d.innerHTML = svg;
      document.body.appendChild(d);
    })
    .catch(() => {});
}

function bindHeaderPersonaPhoto(initial, selector = '#wd-header-photo') {
  const el = document.querySelector(selector);
  if (!el) return;
  el.textContent = (initial || '?').toString().trim()[0]?.toUpperCase() || '?';
}
