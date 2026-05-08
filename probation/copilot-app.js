// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════
const WEEK_ORDER = ['week1', 'week4', 'week8', 't30', 't7', 'reviewDay'];
const WEEK_LABELS = { week1: 'Week 1', week4: 'Week 4', week8: 'Week 8', t30: 'T-30', t7: 'T-7', reviewDay: 'Review Day' };

const state = {
  persona: 'manager',
  workerKey: 'ben',
  week: 'week1',
  tab: 'profile',
  // Per-week overlay applied by user actions in the chat (resets when week changes)
  overlay: { extraGoals: [], extraInbox: [] },
};

// ═══════════════════════════════════════════════════════════════════════════
// SVG icon map — used in WD inbox tasks and empty states
// ═══════════════════════════════════════════════════════════════════════════
const ICONS = {
  task:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12l2 2 4-4"/></svg>`,
  alert:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e67700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  document: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  chat:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};
function getIcon(name) { return ICONS[name] || ICONS.task; }

// ═══════════════════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════════════════
function init() {
  buildWorkerSelect();
  bindEvents();
  applyPersona();
  render();
}

function buildWorkerSelect() {
  const sel = document.getElementById('worker-select');
  Object.entries(WORKERS).forEach(([k, w]) => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${w.name} — ${w.role}`;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', e => { state.workerKey = e.target.value; resetChat(); render(); });
}

function bindEvents() {
  document.getElementById('persona-group').addEventListener('click', e => {
    if (e.target.matches('.persona-btn')) {
      document.querySelectorAll('.persona-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.persona = e.target.dataset.persona;
      applyPersona();
      resetChat();
      render();
    }
  });

  document.getElementById('timeline-track').addEventListener('click', e => {
    if (e.target.matches('.timeline-step')) {
      state.week = e.target.dataset.week;
      updateTimelineActive();
      resetChat();
      render();
    }
  });

  document.querySelectorAll('.wd-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.wd-tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.wd-tab-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('panel-' + t.dataset.tab).classList.add('active');
      state.tab = t.dataset.tab;
    });
  });
}

function applyPersona() {
  const p = PERSONAS[state.persona];
  // Set the worker for fixed-employee personas
  if (!p.allowsWorkerSwitch) {
    state.workerKey = p.defaultWorker;
    document.getElementById('worker-select').style.display = 'none';
  } else {
    document.getElementById('worker-select').style.display = '';
    document.getElementById('worker-select').value = state.workerKey;
  }
  document.getElementById('chat-sub').textContent = `Talking to: ${p.label}`;

  // Welcome banner — greeting matches the logged-in persona
  const firstName = p.label.split(' ')[0];
  document.getElementById('welcome-greeting').textContent = `Welcome, ${firstName}`;
  document.getElementById('welcome-sub').textContent = p.subtitle;
}

function updateTimelineActive() {
  const idx = WEEK_ORDER.indexOf(state.week);
  document.querySelectorAll('.timeline-step').forEach((b, i) => {
    b.classList.remove('active', 'passed');
    if (i === idx) b.classList.add('active');
    else if (i < idx) b.classList.add('passed');
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════════════════════
function render() {
  renderWorkday();
  renderChatOpening();
  updateTimelineActive();
}

function renderWorkday() {
  const w = WORKERS[state.workerKey];
  const baseWd = w.weekData[state.week];
  // Merge fixture data with action-driven overlay (resets on week change)
  const wd = {
    dayInProbation: baseWd.dayInProbation,
    goals:    [...baseWd.goals,    ...state.overlay.extraGoals],
    feedback: [...baseWd.feedback],
    inbox:    [...baseWd.inbox,    ...state.overlay.extraInbox]
  };

  document.getElementById('bc-worker').textContent = w.name;
  document.getElementById('wh-avatar').textContent = w.initials;
  document.getElementById('wh-name').textContent = w.name;
  document.getElementById('wh-role').textContent = w.role;
  document.getElementById('wh-manager').textContent = w.manager;
  document.getElementById('wh-pp').textContent = w.peoplePartner;
  document.getElementById('wh-hire').textContent = w.hireDate;

  document.getElementById('prob-day').textContent = `Day ${wd.dayInProbation}`;
  document.getElementById('prob-total').textContent = w.probationDays;
  document.getElementById('prob-end').textContent = `Ends: ${w.probationEnd}`;
  const pct = Math.min(100, Math.round((wd.dayInProbation / w.probationDays) * 100));
  document.getElementById('prob-bar').style.width = pct + '%';

  // Profile tab
  document.getElementById('profile-job').innerHTML = `
    <div style="display:grid;grid-template-columns:140px 1fr;gap:10px 16px;font-size:13px;">
      <div style="color:#5f6368;">Worker ID</div><div>${w.id}</div>
      <div style="color:#5f6368;">Role</div><div>${w.role}</div>
      <div style="color:#5f6368;">Manager</div><div>${w.manager}</div>
      <div style="color:#5f6368;">People Partner</div><div>${w.peoplePartner}</div>
      <div style="color:#5f6368;">Hire date</div><div>${w.hireDate}</div>
    </div>
  `;
  document.getElementById('profile-prob').innerHTML = `
    <div style="display:grid;grid-template-columns:140px 1fr;gap:10px 16px;font-size:13px;">
      <div style="color:#5f6368;">Probation length</div><div>${w.probationDays} days</div>
      <div style="color:#5f6368;">Day in probation</div><div>${wd.dayInProbation}</div>
      <div style="color:#5f6368;">Probation end</div><div>${w.probationEnd}</div>
      <div style="color:#5f6368;">Status</div><div>${state.week === 'reviewDay' ? 'Closed' : 'Active'}</div>
    </div>
  `;

  // Goals tab
  const goalsEl = document.getElementById('goals-list');
  if (wd.goals.length === 0) {
    goalsEl.innerHTML = `<div class="wd-empty"><div class="icon">${ICONS.task}</div>No goals set yet</div>`;
  } else {
    goalsEl.innerHTML = wd.goals.map(g => `
      <div class="wd-goal">
        <div class="wd-goal-icon status-${g.status.replace(/\s/g, '')}">${g.status === 'Completed' ? '✓' : (g.status === 'In Progress' ? '•' : '–')}</div>
        <div class="wd-goal-body">
          <div class="wd-goal-title">${g.title}</div>
          <div class="wd-goal-meta">${g.status} · Due ${g.due}${g.note ? ' · <em>' + g.note + '</em>' : ''}</div>
        </div>
      </div>
    `).join('');
  }
  setBadge('goals-badge', wd.goals.length);

  // Feedback tab
  const fbEl = document.getElementById('feedback-list');
  if (wd.feedback.length === 0) {
    fbEl.innerHTML = `<div class="wd-empty"><div class="icon">${ICONS.chat}</div>No feedback received yet</div>`;
  } else {
    fbEl.innerHTML = wd.feedback.map(f => `
      <div class="wd-feedback-entry">
        <div class="wd-feedback-head">
          <div class="wd-feedback-from">${f.from}</div>
          ${f.badge ? `<span class="wd-feedback-badge">${f.badge}</span>` : ''}
          <div class="wd-feedback-date">${f.date}</div>
        </div>
        <div class="wd-feedback-comment">${f.comment}</div>
      </div>
    `).join('');
  }
  setBadge('feedback-badge', wd.feedback.length);

  // Inbox tab
  const inEl = document.getElementById('inbox-list');
  if (wd.inbox.length === 0) {
    inEl.innerHTML = `<div class="wd-empty"><div class="icon">${ICONS.document}</div>Inbox clear</div>`;
  } else {
    inEl.innerHTML = wd.inbox.map(t => `
      <div class="wd-inbox-task">
        <div class="wd-inbox-icon">${getIcon(t.icon)}</div>
        <div class="wd-inbox-body">
          <div class="wd-inbox-title">${t.title}</div>
          <div class="wd-inbox-sub">${t.sub}</div>
        </div>
        <button class="wd-inbox-action">Open</button>
      </div>
    `).join('');
  }
  setInboxBadge(wd.inbox.length);
}

function setBadge(id, n) {
  const el = document.getElementById(id);
  if (n > 0) {
    el.style.display = 'inline-block';
    el.style.background = '#1a73e8';
    el.style.color = '#fff';
    el.style.padding = '2px 6px';
    el.style.fontSize = '10px';
    el.style.borderRadius = '10px';
    el.style.marginLeft = '6px';
    el.style.fontWeight = '700';
    el.textContent = n;
  } else {
    el.style.display = 'none';
  }
}

function setInboxBadge(n) {
  const el = document.getElementById('inbox-badge');
  if (n > 0) {
    el.style.display = 'inline-block';
    el.textContent = n;
  } else {
    el.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat — Teams-style adaptive cards with structured action buttons
// ═══════════════════════════════════════════════════════════════════════════
function renderChatOpening() {
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = '';

  const nudge = NUDGES[state.persona]?.[state.workerKey]?.[state.week];
  if (!nudge) {
    appendBotCard({ text: `(No scripted card for ${state.persona} / ${state.workerKey} / ${state.week}.)`, actions: [] });
    return;
  }

  appendBotCard(nudge);
}

function resetChat() {
  state.overlay = { extraGoals: [], extraInbox: [] };
}

// Returns "9:00 AM" style time
function nowTime() {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

function appendBotCard(nudge, opts = {}) {
  const messages = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = 'teams-msg' + (opts.kind === 'confirm' ? ' teams-msg-confirm' : '') + (opts.kind === 'info' ? ' teams-msg-info' : '');

  const avatar = document.createElement('div');
  avatar.className = 'teams-msg-avatar';
  avatar.textContent = 'AI';
  wrap.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'teams-msg-body';

  const head = document.createElement('div');
  head.className = 'teams-msg-head';
  head.innerHTML = `<span class="teams-msg-sender">AI Probation Copilot</span><span class="teams-msg-time">${nowTime()}</span>`;
  body.appendChild(head);

  const bubble = document.createElement('div');
  bubble.className = 'teams-msg-bubble';

  // Body text — paragraphs split on double newlines, **bold** support
  const paragraphs = (nudge.text || '').split('\n\n');
  paragraphs.forEach(p => {
    const el = document.createElement('p');
    el.innerHTML = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    bubble.appendChild(el);
  });

  // Bullets (suggested goals, names, etc.)
  if (nudge.bullets && nudge.bullets.length) {
    const ul = document.createElement('ul');
    ul.className = 'teams-msg-bullets';
    nudge.bullets.forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
    bubble.appendChild(ul);
  }

  // Action buttons
  if (nudge.actions && nudge.actions.length) {
    const actWrap = document.createElement('div');
    actWrap.className = 'teams-actions';
    nudge.actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'teams-action ' + (action.style || 'secondary');
      btn.textContent = action.label;
      btn.addEventListener('click', () => handleAction(action, wrap));
      actWrap.appendChild(btn);
    });
    bubble.appendChild(actWrap);
  }

  body.appendChild(bubble);
  wrap.appendChild(body);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap;
}

function disableActions(cardEl) {
  cardEl.querySelectorAll('.teams-action').forEach(b => b.disabled = true);
}

function handleAction(action, originatingCard) {
  // Disable all buttons on the originating card after a click (one-shot)
  disableActions(originatingCard);

  switch (action.type) {
    case 'addGoals':
      state.overlay.extraGoals.push(...(action.payload || []));
      renderWorkday(); // re-render with new goals visible
      appendBotCard({ text: action.confirm || 'Done.' }, { kind: 'confirm' });
      break;

    case 'sendFeedbackRequests':
      if (action.payload?.task) state.overlay.extraInbox.push(action.payload.task);
      renderWorkday();
      appendBotCard({ text: action.confirm || 'Sent.' }, { kind: 'confirm' });
      break;

    case 'draftExtension':
    case 'draftMessage':
    case 'draftSelfAssessment':
      appendBotCard({ text: action.confirm || 'Drafted.' }, { kind: 'confirm' });
      if (action.draft) appendBotCard({ text: action.draft }, { kind: 'info' });
      break;

    case 'openPack':
      appendBotCard({ text: action.confirm || 'Pack drafted. I\'ve added it to your Workday inbox.' }, { kind: 'confirm' });
      state.overlay.extraInbox.push({ icon: 'document', title: 'Probation review pack ready', sub: 'Drafted by AI Copilot — review and confirm outcome' });
      renderWorkday();
      break;

    case 'info':
      appendBotCard({ text: action.info || '(no info)' }, { kind: 'info' });
      break;

    case 'dismiss':
      appendBotCard({ text: action.confirm || "OK, I'll re-check in 7 days." }, { kind: 'info' });
      break;

    default:
      appendBotCard({ text: '(Unknown action type: ' + action.type + ')' }, { kind: 'info' });
  }
}
