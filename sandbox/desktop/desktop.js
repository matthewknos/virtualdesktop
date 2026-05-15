/**
 * CoE Virtual Desktop — Window Manager & App Launcher
 */

const API_BASE = location.origin.includes('localhost') ? 'http://localhost:3001' : '';
let tenant = localStorage.getItem('coe-tenant') || 'dev';
let activeWindow = null;
let windowCounter = 0;
const windows = new Map();

/* ── Clock ──────────────────────────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  document.getElementById('menu-clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

/* ── Tenant ─────────────────────────────────────────────────────────────── */
function setTenant(name) {
  tenant = name.replace(/[^a-z0-9-_]/gi, '').toLowerCase() || 'dev';
  localStorage.setItem('coe-tenant', tenant);
  document.getElementById('menu-tenant').textContent = tenant;
  // Reload all open app iframes so they pick up the new tenant
  windows.forEach((win, id) => {
    const iframe = win.querySelector('iframe');
    if (iframe) iframe.src = iframe.src;
  });
}
setTenant(tenant);

document.getElementById('menu-tenant').addEventListener('click', () => {
  document.getElementById('tenant-input').value = tenant;
  document.getElementById('tenant-modal').classList.remove('hidden');
});
document.getElementById('tenant-save').addEventListener('click', () => {
  setTenant(document.getElementById('tenant-input').value);
  document.getElementById('tenant-modal').classList.add('hidden');
});
document.getElementById('tenant-cancel').addEventListener('click', () => {
  document.getElementById('tenant-modal').classList.add('hidden');
});

/* ── App Registry ───────────────────────────────────────────────────────── */
const APPS = {
  finder: { title: 'Finder', icon: 'finder-icon', src: null },
  teams:  { title: 'Teams',  icon: 'teams-icon',  src: '../apps/teams' },
  outlook:{ title: 'Outlook',icon: 'outlook-icon',src: '../apps/outlook' },
  workday:{ title: 'Workday',icon: 'workday-icon',src: '../apps/workday' },
};

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

  // Stagger new windows
  const offset = (windowCounter % 8) * 24;
  win.style.left = `${120 + offset}px`;
  win.style.top = `${80 + offset}px`;
  win.style.width = appKey === 'finder' ? '640px' : '900px';
  win.style.height = appKey === 'finder' ? '420px' : '640px';

  win.innerHTML = `
    <div class="window-titlebar">
      <div class="traffic-lights">
        <div class="traffic-light light-close" data-action="close"></div>
        <div class="traffic-light light-minimize" data-action="minimize"></div>
        <div class="traffic-light light-maximize" data-action="maximize"></div>
      </div>
      <div class="window-title">${app.title}</div>
    </div>
    <div class="window-body">
      ${app.src
        ? `<iframe src="${app.src}?tenant=${tenant}" allow="fullscreen"></iframe>`
        : `<div style="padding:40px;text-align:center;opacity:0.6;font-size:14px;">Finder — File browser coming soon</div>`
      }
    </div>
  `;

  document.getElementById('windows').appendChild(win);
  windows.set(id, win);
  focusWindow(id);
  setupWindowDrag(win);
  setupWindowControls(win, id);
  updateDockIndicator(appKey, true);
}

/* ── Window Controls ────────────────────────────────────────────────────── */
function focusWindow(id) {
  windows.forEach((w) => { w.style.zIndex = 10; });
  const win = windows.get(id);
  if (win) {
    win.style.zIndex = 100;
    activeWindow = id;
    document.querySelector('.app-name').textContent = APPS[win.dataset.app]?.title || 'Finder';
    updateDockIndicator(win.dataset.app, true);
  }
}

function closeWindow(id) {
  const win = windows.get(id);
  if (!win) return;
  win.style.transform = 'scale(0.9)';
  win.style.opacity = '0';
  setTimeout(() => {
    win.remove();
    windows.delete(id);
    // Check if any window of this app type remains
    const appKey = win.dataset.app;
    const hasOpen = [...windows.values()].some(w => w.dataset.app === appKey);
    if (!hasOpen) updateDockIndicator(appKey, false);
  }, 180);
}

function minimizeWindow(id) {
  const win = windows.get(id);
  if (win) win.classList.add('minimized');
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
    win.style.left = '0';
    win.style.top = '28px';
    win.style.width = '100%';
    win.style.height = 'calc(100vh - 28px)';
    win.style.borderRadius = '0';
    win.dataset.maximized = 'true';
  } else {
    win.style.left = win.dataset.prevLeft || '120px';
    win.style.top = win.dataset.prevTop || '80px';
    win.style.width = win.dataset.prevWidth || '900px';
    win.style.height = win.dataset.prevHeight || '640px';
    win.style.borderRadius = '12px';
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
  let dragging = false;
  let startX, startY, startLeft, startTop;

  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('traffic-light')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(win.style.left || 0);
    startTop = parseInt(win.style.top || 0);
    win.style.transition = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    win.style.left = `${startLeft + e.clientX - startX}px`;
    win.style.top = `${startTop + e.clientY - startY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      win.style.transition = '';
    }
  });
}

/* ── Dock ───────────────────────────────────────────────────────────────── */
function updateDockIndicator(appKey, active) {
  document.querySelectorAll('.dock-app').forEach(el => {
    if (el.dataset.app === appKey) {
      el.classList.toggle('active', active);
    }
  });
}

function setupDock() {
  document.querySelectorAll('.dock-app').forEach(el => {
    el.addEventListener('click', () => {
      const appKey = el.dataset.app;
      // If minimized, restore
      for (const [id, win] of windows) {
        if (win.dataset.app === appKey && win.classList.contains('minimized')) {
          win.classList.remove('minimized');
          focusWindow(id);
          return;
        }
      }
      launchApp(appKey);
    });
  });
}

/* ── Desktop Icons ──────────────────────────────────────────────────────── */
function setupDesktopIcons() {
  document.querySelectorAll('.desktop-icon').forEach(el => {
    el.addEventListener('dblclick', () => launchApp(el.dataset.app));
  });
}

/* ── Init ───────────────────────────────────────────────────────────────── */
setupDock();
setupDesktopIcons();
