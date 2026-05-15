/**
 * CoE Virtual Desktop — Window Manager & App Launcher
 * Audit refactored: accessibility, keyboard nav, boundary constraints,
 * event cleanup, reduced-motion support, configurable app URLs.
 */

/* ── Configuration ──────────────────────────────────────────────────────── */
const CONFIG = {
  // External app URLs (point to coe-prototypes until apps are inlined)
  appBaseUrl: 'https://coe-prototypes.vercel.app',
  zIndex: { base: 10, focused: 100, maximized: 20000, modal: 20000, menubar: 10000 },
  minWindow: { w: 320, h: 200 },
  defaultWindow: { w: 900, h: 640, finderW: 640, finderH: 420 },
  dragOffset: 24,
  dragMaxOffset: 8,
};

const API_BASE = location.origin.includes('localhost') ? 'http://localhost:3001' : '';
let tenant = localStorage.getItem('coe-tenant') || 'dev';
let activeWindow = null;
let windowCounter = 0;
const windows = new Map();
const globalListeners = new Map(); // id -> { mousemove, mouseup }

/* ── App Registry ───────────────────────────────────────────────────────── */
const APPS = {
  finder:  { title: 'Finder',  icon: 'finder-icon',  src: null },
  teams:   { title: 'Teams',   icon: 'teams-icon',   src: `${CONFIG.appBaseUrl}/sandbox/apps/teams` },
  outlook: { title: 'Outlook', icon: 'outlook-icon', src: `${CONFIG.appBaseUrl}/sandbox/apps/outlook` },
  workday: { title: 'Workday', icon: 'workday-icon', src: `${CONFIG.appBaseUrl}/sandbox/apps/workday` },
};

/* ── Clock ──────────────────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const el = document.getElementById('menu-clock');
  if (el) el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

/* ── Toast ──────────────────────────────────────────────────────────────── */
function showToast(message, duration = 3000) {
  let toast = document.getElementById('vd-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'vd-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* ── Tenant ─────────────────────────────────────────────────────────────── */
function setTenant(name) {
  tenant = name.replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'dev';
  localStorage.setItem('coe-tenant', tenant);
  const el = document.getElementById('menu-tenant');
  if (el) el.textContent = tenant;
  let crossOriginCount = 0;
  windows.forEach((win) => {
    const iframe = win.querySelector('iframe');
    if (iframe) {
      try {
        const url = new URL(iframe.src);
        url.searchParams.set('tenant', tenant);
        iframe.src = url.toString();
      } catch {
        // Cross-origin iframe: can't read src, attempt reload
        iframe.src = iframe.src;
        crossOriginCount++;
      }
    }
  });
  if (crossOriginCount > 0) {
    showToast(`Tenant set to "${tenant}". Cross-origin apps may need a manual refresh.`, 4000);
  }
}
setTenant(tenant);

let tenantTrigger = null;
document.getElementById('menu-tenant')?.addEventListener('click', (e) => {
  tenantTrigger = e.currentTarget;
  const input = document.getElementById('tenant-input');
  const modal = document.getElementById('tenant-modal');
  if (input) input.value = tenant;
  if (modal) {
    modal.classList.remove('hidden');
    input?.focus();
  }
});

document.getElementById('tenant-save')?.addEventListener('click', () => {
  const input = document.getElementById('tenant-input');
  if (input) setTenant(input.value);
  closeModal();
});

document.getElementById('tenant-cancel')?.addEventListener('click', () => {
  closeModal();
});

function closeModal() {
  const modal = document.getElementById('tenant-modal');
  if (modal) modal.classList.add('hidden');
  if (tenantTrigger) {
    tenantTrigger.focus();
    tenantTrigger = null;
  }
}

// Close modal on backdrop click
document.getElementById('tenant-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

/* ── Launch App ─────────────────────────────────────────────────────────── */
function launchApp(appKey) {
  const app = APPS[appKey];
  if (!app) return;

  // If app already open and not Finder, focus it
  if (appKey !== 'finder') {
    for (const [id, win] of windows) {
      if (win.dataset.app === appKey && !win.classList.contains('minimized')) {
        focusWindow(id);
        return;
      }
    }
  }

  const id = `win-${++windowCounter}`;
  const win = document.createElement('div');
  win.className = 'window';
  win.dataset.app = appKey;
  win.dataset.id = id;
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', app.title);
  win.setAttribute('tabindex', '-1');

  // Stagger new windows with viewport constraints
  const offset = (windowCounter % CONFIG.dragMaxOffset) * CONFIG.dragOffset;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isFinder = appKey === 'finder';
  const w = isFinder ? CONFIG.defaultWindow.finderW : CONFIG.defaultWindow.w;
  const h = isFinder ? CONFIG.defaultWindow.finderH : CONFIG.defaultWindow.h;

  let left = Math.min(120 + offset, vw - w - 20);
  let top = Math.min(80 + offset, vh - h - 40);
  if (left < 0) left = 20;
  if (top < 28) top = 40;

  win.style.left = `${left}px`;
  win.style.top = `${top}px`;
  win.style.width = `${w}px`;
  win.style.height = `${h}px`;

  const iframeSrc = app.src ? `${app.src}?tenant=${tenant}` : null;
  const stubContent = appStubHtml(app);
  const loaderHtml = iframeSrc
    ? `<div class="iframe-loader" id="loader-${id}"><div class="spinner"></div></div>`
    : '';

  win.innerHTML = `
    <div class="window-titlebar">
      <div class="traffic-lights" role="toolbar" aria-label="Window controls">
        <button type="button" class="traffic-light light-close" data-action="close" aria-label="Close ${app.title}"></button>
        <button type="button" class="traffic-light light-minimize" data-action="minimize" aria-label="Minimize ${app.title}"></button>
        <button type="button" class="traffic-light light-maximize" data-action="maximize" aria-label="Maximize ${app.title}"></button>
      </div>
      <div class="window-title">${app.title}</div>
    </div>
    <div class="window-body">
      ${loaderHtml}
      ${iframeSrc
        ? `<iframe src="${iframeSrc}" allow="fullscreen" loading="lazy" title="${app.title} app" id="frame-${id}"></iframe>`
        : stubContent
      }
    </div>
  `;

  // Hide loader when iframe loads
  if (iframeSrc) {
    const frame = win.querySelector(`#frame-${id}`);
    const loader = win.querySelector(`#loader-${id}`);
    if (frame && loader) {
      frame.addEventListener('load', () => loader.classList.add('hidden'), { once: true });
      // Fallback: hide loader after 8s regardless
      setTimeout(() => loader.classList.add('hidden'), 8000);
    }
  }

  document.getElementById('windows')?.appendChild(win);
  windows.set(id, win);
  focusWindow(id);
  setupWindowDrag(win);
  setupWindowControls(win, id);
  updateDockIndicator(appKey, true);
  updateMenuAppName(app.title);
}

function appStubHtml(app) {
  return `
    <div class="app-stub">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>
      <h3>${app.title}</h3>
      <p>This application is coming soon to the Virtual Desktop.<br>Check the app catalogue for updates.</p>
    </div>
  `;
}

/* ── Window Controls ────────────────────────────────────────────────────── */
function focusWindow(id) {
  windows.forEach((w) => {
    if (w.dataset.maximized !== 'true') w.style.zIndex = CONFIG.zIndex.base;
  });
  const win = windows.get(id);
  if (win) {
    win.style.zIndex = win.dataset.maximized === 'true' ? CONFIG.zIndex.maximized : CONFIG.zIndex.focused;
    activeWindow = id;
    const appTitle = APPS[win.dataset.app]?.title || 'Finder';
    updateMenuAppName(appTitle);
    updateDockIndicator(win.dataset.app, true);
    win.focus();
  }
}

function updateMenuAppName(title) {
  const el = document.getElementById('menu-app-name');
  if (el) el.textContent = title;
}

function closeWindow(id) {
  const win = windows.get(id);
  if (!win) return;
  cleanupWindowListeners(id);
  win.style.transform = 'scale(0.9)';
  win.style.opacity = '0';
  setTimeout(() => {
    win.remove();
    windows.delete(id);
    const appKey = win.dataset.app;
    const hasOpen = [...windows.values()].some(w => w.dataset.app === appKey);
    if (!hasOpen) updateDockIndicator(appKey, false);
    updateDockVisibility();
    if (windows.size === 0) updateMenuAppName('Finder');
  }, 180);
}

function minimizeWindow(id) {
  const win = windows.get(id);
  if (win) {
    win.classList.add('minimized');
    const appKey = win.dataset.app;
    const hasVisible = [...windows.values()].some(w => w.dataset.app === appKey && !w.classList.contains('minimized'));
    if (!hasVisible) updateDockIndicator(appKey, false);
  }
}

function updateDockVisibility() {
  const anyMaximized = [...windows.values()].some(w => w.dataset.maximized === 'true');
  document.getElementById('dock')?.classList.toggle('dock-hidden', anyMaximized);
}

function maximizeWindow(id) {
  const win = windows.get(id);
  if (!win) return;
  const isMax = win.dataset.maximized === 'true';
  if (!isMax) {
    win.dataset.prevLeft = win.style.left;
    win.dataset.prevTop = win.style.top;
    win.dataset.prevWidth = win.style.width;
    win.dataset.prevHeight = win.style.height;
    win.dataset.prevPosition = win.style.position;
    win.dataset.prevZIndex = win.style.zIndex;
    win.style.position = 'fixed';
    win.style.left = '0';
    win.style.top = '28px';
    win.style.width = '100%';
    win.style.height = 'calc(100vh - 28px)';
    win.style.borderRadius = '0';
    win.style.zIndex = String(CONFIG.zIndex.maximized);
    win.dataset.maximized = 'true';
  } else {
    win.style.position = win.dataset.prevPosition || 'absolute';
    win.style.left = win.dataset.prevLeft || '120px';
    win.style.top = win.dataset.prevTop || '80px';
    win.style.width = win.dataset.prevWidth || '900px';
    win.style.height = win.dataset.prevHeight || '640px';
    win.style.borderRadius = '12px';
    win.style.zIndex = win.dataset.prevZIndex || String(CONFIG.zIndex.focused);
    win.dataset.maximized = 'false';
  }
  updateDockVisibility();
}

function setupWindowControls(win, id) {
  win.querySelectorAll('.traffic-light').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'close') closeWindow(id);
      if (action === 'minimize') minimizeWindow(id);
      if (action === 'maximize') maximizeWindow(id);
    });
  });
  win.addEventListener('mousedown', () => focusWindow(id));
}

/* ── Window Drag ────────────────────────────────────────────────────────── */
function setupWindowDrag(win) {
  const titlebar = win.querySelector('.window-titlebar');
  if (!titlebar) return;
  let dragging = false;
  let startX, startY, startLeft, startTop;

  const onMouseMove = (e) => {
    if (!dragging) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = win.getBoundingClientRect();
    const minW = Math.max(rect.width, CONFIG.minWindow.w);
    const minH = Math.max(rect.height, CONFIG.minWindow.h);

    let newLeft = startLeft + e.clientX - startX;
    let newTop = startTop + e.clientY - startY;

    // Boundary constraints: keep at least 60px visible
    newLeft = Math.max(-minW + 60, Math.min(newLeft, vw - 60));
    newTop = Math.max(28, Math.min(newTop, vh - 40));

    win.style.left = `${newLeft}px`;
    win.style.top = `${newTop}px`;
  };

  const onMouseUp = () => {
    if (dragging) {
      dragging = false;
      win.style.transition = '';
    }
  };

  const id = win.dataset.id;
  globalListeners.set(id, { mousemove: onMouseMove, mouseup: onMouseUp });

  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('traffic-light') || e.target.closest('.traffic-light')) return;
    if (win.dataset.maximized === 'true') return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(win.style.left || 0);
    startTop = parseInt(win.style.top || 0);
    win.style.transition = 'none';
  });

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function cleanupWindowListeners(id) {
  const listeners = globalListeners.get(id);
  if (listeners) {
    window.removeEventListener('mousemove', listeners.mousemove);
    window.removeEventListener('mouseup', listeners.mouseup);
    globalListeners.delete(id);
  }
}

/* ── Dock ───────────────────────────────────────────────────────────────── */
function updateDockIndicator(appKey, active) {
  document.querySelectorAll('.dock-app').forEach(el => {
    if (el.dataset.app === appKey) {
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', String(active));
    }
  });
}

function setupDock() {
  document.querySelectorAll('.dock-app').forEach(el => {
    const activate = () => {
      const appKey = el.dataset.app;
      for (const [id, win] of windows) {
        if (win.dataset.app === appKey && win.classList.contains('minimized')) {
          win.classList.remove('minimized');
          focusWindow(id);
          return;
        }
      }
      launchApp(appKey);
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
    // Touch support
    let touchStartTime = 0;
    el.addEventListener('touchstart', () => { touchStartTime = Date.now(); }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (Date.now() - touchStartTime < 300) {
        e.preventDefault();
        activate();
      }
    });
  });
}

/* ── Desktop Icons ──────────────────────────────────────────────────────── */
function setupDesktopIcons() {
  document.querySelectorAll('.desktop-icon').forEach(el => {
    const activate = () => launchApp(el.dataset.app);
    el.addEventListener('dblclick', activate);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
    // Touch support
    let touchStartTime = 0;
    el.addEventListener('touchstart', () => { touchStartTime = Date.now(); }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (Date.now() - touchStartTime < 300) {
        e.preventDefault();
        activate();
      }
    });
  });
}

/* ── Global Keyboard Shortcuts ──────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('tenant-modal');
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      return;
    }
    if (activeWindow) closeWindow(activeWindow);
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
    e.preventDefault();
    if (activeWindow) closeWindow(activeWindow);
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
    e.preventDefault();
    if (activeWindow) minimizeWindow(activeWindow);
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault();
    launchApp('finder');
  }
});

/* ── Init ───────────────────────────────────────────────────────────────── */
setupDock();
setupDesktopIcons();
