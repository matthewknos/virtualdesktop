// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════
const WEEK_ORDER = ['week1', 'week4', 'week8', 't30', 't7', 'reviewDay'];

const state = {
  persona: 'manager',
  workerKey: 'ben',
  week: 'week8',
  tab: 'profile',
  conversationHistory: [], // [{role: 'assistant'|'user', content: '...'}]
};

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
  const wd = w.weekData[state.week];

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
    goalsEl.innerHTML = `<div class="wd-empty"><div class="icon">📭</div>No goals set yet</div>`;
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
    fbEl.innerHTML = `<div class="wd-empty"><div class="icon">💬</div>No feedback received yet</div>`;
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
    inEl.innerHTML = `<div class="wd-empty"><div class="icon">✉️</div>Inbox clear</div>`;
  } else {
    inEl.innerHTML = wd.inbox.map(t => `
      <div class="wd-inbox-task">
        <div class="wd-inbox-icon">${t.icon}</div>
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
// Chat — scripted nudges + suggested chips + live LLM
// ═══════════════════════════════════════════════════════════════════════════
function renderChatOpening() {
  const nudge = NUDGES[state.persona]?.[state.workerKey]?.[state.week];
  const messages = document.getElementById('chat-messages');
  const chips    = document.getElementById('suggested-replies');
  messages.innerHTML = '';
  chips.innerHTML = '';

  if (!nudge) {
    appendMessage('ai', `(No scripted nudge for ${state.persona} / ${state.workerKey} / ${state.week} — try typing a question.)`);
    return;
  }

  appendMessage('ai', nudge.text);
  state.conversationHistory = [{ role: 'assistant', content: nudge.text }];

  (nudge.chips || []).forEach(label => {
    const chip = document.createElement('button');
    chip.className = 'reply-chip';
    chip.textContent = label;
    chip.addEventListener('click', () => sendUserMessage(label));
    chips.appendChild(chip);
  });
}

function resetChat() {
  state.conversationHistory = [];
}

function appendMessage(role, text) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  // very light markdown: **bold**
  div.innerHTML = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function clearChips() {
  document.getElementById('suggested-replies').innerHTML = '';
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await sendUserMessage(text);
}

async function sendUserMessage(text) {
  clearChips();
  appendMessage('user', text);
  state.conversationHistory.push({ role: 'user', content: text });

  const thinkingEl = appendMessage('thinking', 'Thinking…');
  document.getElementById('send-btn').disabled = true;

  try {
    const reply = await callLLM();
    thinkingEl.remove();
    appendMessage('ai', reply);
    state.conversationHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    thinkingEl.remove();
    appendMessage('ai', '(Error reaching the copilot: ' + err.message + ')');
  } finally {
    document.getElementById('send-btn').disabled = false;
  }
}

function buildSystemContext() {
  const w = WORKERS[state.workerKey];
  const wd = w.weekData[state.week];
  const persona = PERSONAS[state.persona];

  const goalsBlock = wd.goals.length === 0
    ? 'No goals set yet.'
    : wd.goals.map(g => `- ${g.title} | ${g.status} | due ${g.due}${g.note ? ' (' + g.note + ')' : ''}`).join('\n');

  const fbBlock = wd.feedback.length === 0
    ? 'No feedback received yet.'
    : wd.feedback.map(f => `- [${f.date}] ${f.from}${f.badge ? ' [' + f.badge + ']' : ''}: ${f.comment}`).join('\n');

  const inboxBlock = wd.inbox.length === 0
    ? 'Inbox clear.'
    : wd.inbox.map(t => `- ${t.title} — ${t.sub}`).join('\n');

  return `You are an AI Probation Copilot inside a Workday HR tenant. You help managers, employees, and people partners run probation reviews proactively.

CURRENT USER: ${persona.label}
CURRENT EMPLOYEE BEING DISCUSSED: ${w.name} (${w.role}, manager: ${w.manager}, people partner: ${w.peoplePartner})
TIMELINE POINT: ${state.week} — Day ${wd.dayInProbation} of ${w.probationDays} probation
PROBATION END DATE: ${w.probationEnd}

WHAT YOU CAN SEE:
GOALS:
${goalsBlock}

FEEDBACK:
${fbBlock}

INBOX TASKS:
${inboxBlock}

GUIDELINES:
- Be concise (2-4 sentences max per reply).
- Be proactive — suggest concrete next actions, not vague advice.
- Stay grounded in the Workday data shown above. Don't invent data.
- For managers: focus on action ("draft this", "schedule that", "consider extension").
- For employees: be supportive and specific. Help them take the next small step.
- For people partners: focus on patterns, risk, escalation, oversight.
- This is a demo — keep replies confident and professional.`;
}

async function callLLM() {
  const pw = sessionStorage.getItem(PW_KEY);
  if (!pw) throw new Error('Not authenticated');

  const system = buildSystemContext();
  const history = state.conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Copilot'}: ${m.content}`).join('\n\n');

  const prompt = `${system}\n\n--- CONVERSATION ---\n${history}\n\nCopilot:`;

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pw}` },
    body: JSON.stringify({ prompt, max_tokens: 400 }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data.text || data.content?.[0]?.text || '(empty reply)').trim();
}
