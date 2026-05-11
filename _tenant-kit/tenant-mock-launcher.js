/*
 * Tenant Mock Launcher — Cmd+Shift+E (Ctrl+Shift+E on Win/Linux)
 *
 *   <script src="/_tenant-kit/tenant-mock-launcher.js" defer></script>
 *
 * Drop this script into any prototype to gain a global Cmd/Ctrl+Shift+E
 * hotkey that navigates to the mock Workday tenant.
 *
 *   • From any non-tenant page → navigates to /tenant/home.
 *   • From a tenant page (path starts with /tenant/) → navigates back
 *     to the gallery (history.back if there's prior history, else /).
 *
 * The mock tenant lives at /tenant/{home,inbox,pay,time-off,directory,
 * profile}. Each tenant page also includes this script, so the hotkey
 * is bound everywhere — there is no manual exit affordance to add.
 *
 * Designed to be additive — any prototype that doesn't include this
 * script behaves as before.
 */
(function () {
  if (window.__tenantMockLauncherBound) return;
  window.__tenantMockLauncherBound = true;

  const TENANT_HOME = '/tenant/home';
  const TENANT_PREFIX = '/tenant/';

  function isInTenant() {
    return location.pathname.startsWith(TENANT_PREFIX);
  }

  function enterTenant() {
    if (isInTenant()) return;
    location.href = TENANT_HOME;
  }

  function exitTenant() {
    if (!isInTenant()) return;
    if (history.length > 1) history.back();
    else location.href = '/';
  }

  function toggle() {
    if (isInTenant()) exitTenant();
    else enterTenant();
  }

  document.addEventListener('keydown', (e) => {
    const isMod = e.metaKey || e.ctrlKey;
    if (isMod && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      e.preventDefault();
      toggle();
    }
  });

  window.tenantMock = { enter: enterTenant, exit: exitTenant, toggle };
})();
