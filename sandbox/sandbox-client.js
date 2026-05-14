/**
 * Sandbox API client — thin wrapper around the CoE Sandbox REST API.
 *
 * Usage:
 *   const sandbox = new SandboxClient();
 *   const { scenarios } = await sandbox.listScenarios();
 *   const state = await sandbox.getState('timesheet-chaser');
 *   await sandbox.postMessage('timesheet-chaser', { from: 'consultant', text: 'I submitted my timesheet' });
 *   const msgs = await sandbox.pollMessages('timesheet-chaser', Date.now() - 60000);
 */

class SandboxClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async _fetch(path, opts = {}) {
    const url = `${this.baseUrl}/api/sandbox${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  listScenarios() {
    return this._fetch('/scenarios');
  }

  getScenario(id) {
    return this._fetch(`/scenarios/${id}`);
  }

  getState(id) {
    return this._fetch(`/scenarios/${id}/state`);
  }

  updateState(id, updates) {
    return this._fetch(`/scenarios/${id}/state`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  resetState(id) {
    return this._fetch(`/scenarios/${id}/state`, { method: 'DELETE' });
  }

  getMessages(id, since = null) {
    const qs = since ? `?since=${since}` : '';
    return this._fetch(`/scenarios/${id}/messages${qs}`);
  }

  postMessage(id, { from, to, text, actions }) {
    return this._fetch(`/scenarios/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ from, to, text, actions }),
    });
  }

  async webhook({ scenarioId, agentName, to, text, actions, stateUpdates }) {
    return this._fetch('/webhook', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, agentName, to, text, actions, stateUpdates }),
    });
  }
}

// Expose globally for inline scripts
window.SandboxClient = SandboxClient;
