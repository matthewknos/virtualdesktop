/*
 * Mock-tenant shell renderer.
 *
 * Each tenant page boots like:
 *
 *     <body>
 *       <div id="tenant-shell"></div>
 *       <main class="tenant-content">...</main>
 *       <script src="../_shared/shell.js" data-active="home"></script>
 *     </body>
 *
 * shell.js reads data-active off its own <script> tag, then injects the
 * Workday header + left rail into #tenant-shell wrapping the existing
 * <main>. This keeps every page a single self-contained HTML file with
 * just its content, while sharing chrome through one script.
 */

const TENANT_PERSONA = {
  name: 'Logan Mclean',
  initials: 'LM',
  role: 'Senior Consultant',
  email: 'logan.mclean@example.com',
  manager: 'Priya Kapoor',
  team: 'Workday Centre of Excellence',
  location: 'Belfast, UK',
};

const TENANT_NAV = [
  { id: 'home',      label: 'Home',      href: '/tenant/home',      icon: 'home' },
  { id: 'inbox',     label: 'Inbox',     href: '/tenant/inbox',     icon: 'inbox', badge: 5 },
  { id: 'pay',       label: 'Pay',       href: '/tenant/pay',       icon: 'pay' },
  { id: 'time-off',  label: 'Time Off',  href: '/tenant/time-off',  icon: 'timeoff' },
  { id: 'directory', label: 'Directory', href: '/tenant/directory', icon: 'team' },
  { id: 'profile',   label: 'Profile',   href: '/tenant/profile',   icon: 'user' },
];

const RAIL_ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5l9-7 9 7V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  pay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/></svg>',
  timeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 20c0-2.3 1.6-4.3 3.7-4.8"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
};

const HEADER_SVG = {
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  inbox: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.7-.9L3 20l1-4.3A8.4 8.4 0 1 1 21 11.5z"/></svg>',
};

function renderTenantShell({ activeId } = {}) {
  const shellHost = document.getElementById('tenant-shell');
  const content = document.querySelector('.tenant-content');
  if (!shellHost || !content) return;

  const headerHTML = `
    <div class="wd-header">
      <a class="wd-logo" href="/tenant/home" aria-label="Workday home">
        <span class="wd-logo-mark">w.</span>
        <span>Workday</span>
      </a>
      <div class="wd-search" role="search">
        <span class="wd-search-icon">${HEADER_SVG.search}</span>
        <input type="text" placeholder="Search Workday" disabled>
      </div>
      <div class="wd-icons">
        <a class="wd-icon-btn" href="#" title="Chat">${HEADER_SVG.chat}</a>
        <a class="wd-icon-btn wd-icon-bell-badge" href="#" title="Notifications">${HEADER_SVG.bell}</a>
        <a class="wd-icon-btn" href="/tenant/inbox" title="Inbox">${HEADER_SVG.inbox}</a>
        <a class="wd-profile-photo" href="/tenant/profile" title="${TENANT_PERSONA.name}">${TENANT_PERSONA.initials}</a>
      </div>
    </div>
  `;

  const railItems = TENANT_NAV.map(item => `
    <a class="wd-rail-item ${item.id === activeId ? 'active' : ''}"
       href="${item.href}"
       title="${item.label}">
      ${RAIL_ICONS[item.icon] || ''}
      <span>${item.label}</span>
    </a>
  `).join('');

  shellHost.innerHTML = `
    ${headerHTML}
    <div class="tenant-body">
      <nav class="wd-rail" aria-label="Primary">
        ${railItems}
        <div class="wd-rail-spacer"></div>
      </nav>
      <div id="tenant-content-mount"></div>
    </div>
  `;

  document.querySelector('.tenant-page')?.classList.add('booted');

  const mount = shellHost.querySelector('#tenant-content-mount');
  mount.appendChild(content);
}

(function boot() {
  const script = document.currentScript;
  const activeId = script?.dataset?.active || 'home';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => renderTenantShell({ activeId }));
  } else {
    renderTenantShell({ activeId });
  }
})();
