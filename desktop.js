/**
 * CoE Virtual Desktop — Window Manager & App Launcher
 * v2: Fullscreen apps, working minimize, always-visible dock,
 *     window resize, context menu, menu dropdowns, Finder stub.
 */

/* ── Configuration ──────────────────────────────────────────────────────── */
const CONFIG = {
  appBaseUrl: 'https://coe-prototypes.vercel.app',
  zIndex: { base: 10, focused: 100, maximized: 20000, modal: 20000, menubar: 10000 },
  minWindow: { w: 320, h: 200 },
  finderWindow: { w: 640, h: 420 },
  dragOffset: 24,
  dragMaxOffset: 8,
};

let tenant = localStorage.getItem('coe-tenant') || 'dev';
let activeWindow = null;
let windowCounter = 0;
const windows = new Map();
const globalListeners = new Map();
let tenantTrigger = null;

/* ── App Registry ───────────────────────────────────────────────────────── */
const APPS = {
  finder:  { title: 'Finder',  icon: 'finder-icon',  src: null },
  teams:   { title: 'Teams',   icon: 'teams-icon',   src: `${CONFIG.appBaseUrl}/sandbox/apps/teams` },
  outlook: { title: 'Outlook', icon: 'outlook-icon', src: `${CONFIG.appBaseUrl}/sandbox/apps/outlook` },
  workday: { title: 'Workday', icon: 'workday-icon', src: `${CONFIG.appBaseUrl}/sandbox/apps/workday` },
};

/* ── Clock ──────────────────────────────────────────────────────────────── */
function updateClock() {
  const el = document.getElementById('menu-clock');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

/* ── Tenant Modal ───────────────────────────────────────────────────────── */
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

function openModal() {
  const input = document.getElementById('tenant-input');
  const modal = document.getElementById('tenant-modal');
  if (input) input.value = tenant;
  if (modal) {
    modal.classList.remove('hidden');
    input?.focus();
  }
}

function closeModal() {
  const modal = document.getElementById('tenant-modal');
  if (modal) modal.classList.add('hidden');
  if (tenantTrigger) {
    tenantTrigger.focus();
    tenantTrigger = null;
  }
}

document.getElementById('menu-tenant')?.addEventListener('click', (e) => {
  tenantTrigger = e.currentTarget;
  openModal();
});

document.getElementById('tenant-save')?.addEventListener('click', () => {
  const input = document.getElementById('tenant-input');
  if (input) setTenant(input.value);
  closeModal();
});

document.getElementById('tenant-cancel')?.addEventListener('click', closeModal);
document.getElementById('tenant-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

/* ── Launch App ─────────────────────────────────────────────────────────── */
function launchApp(appKey) {
  const app = APPS[appKey];
  if (!app) return;

  // If non-Finder app already open, focus it
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

  // All apps open fullscreen instantly
  win.style.position = 'fixed';
  win.style.left = '0';
  win.style.top = '28px';
  win.style.width = '100%';
  win.style.height = 'calc(100vh - 28px)';
  win.style.borderRadius = '0';
  win.style.zIndex = String(CONFIG.zIndex.focused);
  win.dataset.maximized = 'true';

  const iframeSrc = app.src ? `${app.src}?tenant=${tenant}` : null;
  const loaderHtml = iframeSrc ? `<div class="iframe-loader" id="loader-${id}"><div class="spinner"></div></div>` : '';

  win.innerHTML = `
    <div class="window-titlebar">
      <div class="traffic-lights" role="toolbar" aria-label="Window controls">
        <button type="button" class="traffic-light light-close" data-action="close" aria-label="Close ${app.title}"></button>
        <button type="button" class="traffic-light light-minimize" data-action="minimize" aria-label="Minimize ${app.title}"></button>
        <button type="button" class="traffic-light light-maximize" data-action="maximize" aria-label="Restore ${app.title}"></button>
      </div>
      <div class="window-title">${app.title}</div>
    </div>
    <div class="window-body">
      ${loaderHtml}
      ${iframeSrc
        ? `<iframe src="${iframeSrc}" allow="fullscreen" loading="lazy" title="${app.title} app" id="frame-${id}"></iframe>`
        : finderStubHtml()
      }
    </div>
    <div class="resize-handle resize-n" aria-hidden="true"></div>
    <div class="resize-handle resize-e" aria-hidden="true"></div>
    <div class="resize-handle resize-s" aria-hidden="true"></div>
    <div class="resize-handle resize-w" aria-hidden="true"></div>
    <div class="resize-handle resize-ne" aria-hidden="true"></div>
    <div class="resize-handle resize-se" aria-hidden="true"></div>
    <div class="resize-handle resize-sw" aria-hidden="true"></div>
    <div class="resize-handle resize-nw" aria-hidden="true"></div>
  `;

  document.getElementById('windows')?.appendChild(win);
  windows.set(id, win);
  focusWindow(id);
  setupWindowDrag(win);
  setupWindowResize(win, id);
  setupWindowControls(win, id);
  updateDockIndicator(appKey, true);
  updateMenuAppName(app.title);

  if (iframeSrc) {
    const frame = win.querySelector(`#frame-${id}`);
    const loader = win.querySelector(`#loader-${id}`);
    if (frame && loader) {
      frame.addEventListener('load', () => loader.classList.add('hidden'), { once: true });
      setTimeout(() => loader.classList.add('hidden'), 8000);
    }
  }
}

function finderStubHtml() {
  return `
    <div class="finder-stub">
      <div class="finder-sidebar">
        <div class="finder-section">
          <h4>Favorites</h4>
          <div class="finder-item active"><span>🏠</span> Desktop</div>
          <div class="finder-item"><span>📄</span> Documents</div>
          <div class="finder-item"><span>⬇️</span> Downloads</div>
        </div>
        <div class="finder-section">
          <h4>Locations</h4>
          <div class="finder-item"><span>💻</span> Macintosh HD</div>
          <div class="finder-item"><span>☁️</span> iCloud Drive</div>
        </div>
      </div>
      <div class="finder-main">
        <div class="finder-toolbar">
          <span>Desktop</span>
          <span class="finder-count">4 items</span>
        </div>
        <div class="finder-grid">
          <div class="finder-file"><span class="file-icon">📁</span><span class="file-name">Projects</span></div>
          <div class="finder-file"><span class="file-icon">📁</span><span class="file-name">Designs</span></div>
          <div class="finder-file"><span class="file-icon">📄</span><span class="file-name">README.md</span></div>
          <div class="finder-file"><span class="file-icon">🖼️</span><span class="file-name">background.jpg</span></div>
        </div>
      </div>
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
  win.style.transform = 'scale(0.92)';
  win.style.opacity = '0';
  setTimeout(() => {
    win.remove();
    windows.delete(id);
    const appKey = win.dataset.app;
    const hasOpen = [...windows.values()].some(w => w.dataset.app === appKey);
    if (!hasOpen) updateDockIndicator(appKey, false);
    if (windows.size === 0) updateMenuAppName('Finder');
    activeWindow = null;
  }, 180);
}

function minimizeWindow(id) {
  const win = windows.get(id);
  if (!win) return;
  win.classList.add('minimized');
  // Update active window to next available
  const remaining = [...windows.entries()].filter(([_, w]) => !w.classList.contains('minimized'));
  if (remaining.length > 0) {
    focusWindow(remaining[0][0]);
  } else {
    activeWindow = null;
    updateMenuAppName('Finder');
  }
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

  const wid = win.dataset.id;
  globalListeners.set(wid, { mousemove: onMouseMove, mouseup: onMouseUp });

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

/* ── Window Resize ──────────────────────────────────────────────────────── */
function setupWindowResize(win, id) {
  if (win.dataset.maximized === 'true') return;
  const handles = win.querySelectorAll('.resize-handle');
  handles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      if (win.dataset.maximized === 'true') return;
      const direction = Array.from(handle.classList).find(c => c.startsWith('resize-') && c !== 'resize-handle');
      if (!direction) return;
      startResize(e, win, direction.replace('resize-', ''));
    });
  });
}

function startResize(e, win, dir) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startLeft = win.offsetLeft;
  const startTop = win.offsetTop;
  const startWidth = win.offsetWidth;
  const startHeight = win.offsetHeight;
  const minW = CONFIG.minWindow.w;
  const minH = CONFIG.minWindow.h;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    if (dir.includes('e')) {
      win.style.width = `${Math.max(minW, startWidth + dx)}px`;
    }
    if (dir.includes('s')) {
      win.style.height = `${Math.max(minH, startHeight + dy)}px`;
    }
    if (dir.includes('w')) {
      const newW = Math.max(minW, startWidth - dx);
      win.style.width = `${newW}px`;
      win.style.left = `${startLeft + (startWidth - newW)}px`;
    }
    if (dir.includes('n')) {
      const newH = Math.max(minH, startHeight - dy);
      win.style.height = `${newH}px`;
      win.style.top = `${startTop + (startHeight - newH)}px`;
    }
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
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
      // Restore minimized window
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

/* ── Context Menu ───────────────────────────────────────────────────────── */
function setupContextMenu() {
  const desktop = document.getElementById('desktop');
  let menu = document.getElementById('desktop-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'desktop-context-menu';
    menu.className = 'context-menu';
    menu.innerHTML = `
      <div class="context-item" data-action="new-finder">New Finder Window</div>
      <div class="context-item" data-action="change-tenant">Change Tenant</div>
      <div class="context-divider"></div>
      <div class="context-item" data-action="refresh">Refresh Desktop</div>
    `;
    document.body.appendChild(menu);
    menu.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        if (action === 'new-finder') launchApp('finder');
        if (action === 'change-tenant') { tenantTrigger = document.getElementById('menu-tenant'); openModal(); }
        if (action === 'refresh') location.reload();
        menu.classList.remove('show');
      });
    });
  }

  desktop?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('show');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) menu.classList.remove('show');
  });
}

/* ── Menu Dropdowns ─────────────────────────────────────────────────────── */
function setupMenuDropdowns() {
  const menus = {
    File: ['New Window', 'Close Window', null, 'Get Info'],
    Edit: ['Undo', 'Cut', 'Copy', 'Paste'],
    View: ['as Icons', 'as List', 'as Columns'],
    Window: ['Minimize', 'Zoom', null, 'Bring All to Front'],
    Help: ['Virtual Desktop Help', 'Keyboard Shortcuts'],
  };

  document.querySelectorAll('.menu-btn').forEach(btn => {
    const name = btn.dataset.menu;
    const items = menus[name] || [];

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any open dropdown
      document.querySelectorAll('.menu-dropdown').forEach(d => d.remove());

      const dropdown = document.createElement('div');
      dropdown.className = 'menu-dropdown';
      dropdown.style.top = '28px';
      dropdown.style.left = `${btn.offsetLeft}px`;

      items.forEach(item => {
        if (item === null) {
          dropdown.appendChild(document.createElement('div')).className = 'menu-dropdown-divider';
        } else {
          const div = document.createElement('div');
          div.className = 'menu-dropdown-item';
          div.textContent = item;
          div.addEventListener('click', () => {
            if (item === 'New Window') launchApp('finder');
            if (item === 'Close Window' && activeWindow) closeWindow(activeWindow);
            if (item === 'Minimize' && activeWindow) minimizeWindow(activeWindow);
            if (item === 'Zoom' && activeWindow) maximizeWindow(activeWindow);
            if (item === 'Keyboard Shortcuts') showToast('Esc: close, Cmd+W: close win, Cmd+M: minimize, Cmd+N: new Finder', 5000);
            dropdown.remove();
          });
          dropdown.appendChild(div);
        }
      });

      btn.parentElement.appendChild(dropdown);
    });
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.menu-dropdown').forEach(d => d.remove());
  });
}

/* ── Global Keyboard Shortcuts ──────────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('tenant-modal');
    if (modal && !modal.classList.contains('hidden')) {
      closeModal();
      return;
    }
    const anyDropdown = document.querySelector('.menu-dropdown');
    if (anyDropdown) {
      anyDropdown.remove();
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
setupContextMenu();
setupMenuDropdowns();
