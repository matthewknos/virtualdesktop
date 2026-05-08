// ═══════════════════════════════════════════════════════════════════════════
// Workers — fictional fixtures, no PII
// Each worker has weekData per timeline point: dayInProbation, goals, feedback, inbox
// ═══════════════════════════════════════════════════════════════════════════
const WORKERS = {
  alice: {
    id: 'W001',
    name: 'Alice Johnson',
    initials: 'AJ',
    role: 'Junior Consultant',
    manager: 'Dave Owen',
    peoplePartner: 'Priya Patel',
    hireDate: '2025-02-10',
    probationDays: 90,
    probationEnd: '2025-05-11',
    weekData: {
      week1: {
        dayInProbation: 5,
        goals: [],
        feedback: [],
        inbox: [
          { icon: '📋', title: 'Set probation goals for Alice Johnson', sub: 'Due in 3 weeks — Workday will auto-flag if missed' }
        ]
      },
      week4: {
        dayInProbation: 28,
        goals: [
          { title: 'Complete onboarding training modules', status: 'Completed', due: '2025-03-01' },
          { title: 'Shadow three client discovery calls', status: 'In Progress', due: '2025-04-15' },
          { title: 'Deliver first solo sprint planning session', status: 'Not Started', due: '2025-05-01' }
        ],
        feedback: [
          { date: '2025-03-05', from: 'Priya Patel (People Partner)', comment: 'Alice has settled in well. Picking up the internal tools quickly and asks good questions.' }
        ],
        inbox: []
      },
      week8: {
        dayInProbation: 56,
        goals: [
          { title: 'Complete onboarding training modules', status: 'Completed', due: '2025-03-01' },
          { title: 'Shadow three client discovery calls', status: 'In Progress', due: '2025-04-15', note: '2/3 completed' },
          { title: 'Deliver first solo sprint planning session', status: 'In Progress', due: '2025-05-01' }
        ],
        feedback: [
          { date: '2025-03-05', from: 'Priya Patel (People Partner)', comment: 'Alice has settled in well. Picking up the internal tools quickly and asks good questions.' },
          { date: '2025-03-22', from: 'Dave Owen (Line Manager)', comment: 'Alice delivered the onboarding training modules ahead of schedule. Good initiative on the second client call where she prepared questions in advance.', badge: 'Great Initiative' }
        ],
        inbox: []
      },
      t30: {
        dayInProbation: 60,
        goals: [
          { title: 'Complete onboarding training modules', status: 'Completed', due: '2025-03-01' },
          { title: 'Shadow three client discovery calls', status: 'In Progress', due: '2025-04-15', note: '2/3 completed' },
          { title: 'Deliver first solo sprint planning session', status: 'In Progress', due: '2025-05-01' }
        ],
        feedback: [
          { date: '2025-03-05', from: 'Priya Patel (People Partner)', comment: 'Alice has settled in well. Picking up the internal tools quickly and asks good questions.' },
          { date: '2025-03-22', from: 'Dave Owen (Line Manager)', comment: 'Alice delivered the onboarding training modules ahead of schedule. Good initiative on the second client call where she prepared questions in advance.', badge: 'Great Initiative' },
          { date: '2025-04-08', from: 'Marcus Lee (Project Lead)', comment: 'Alice has been a strong addition to the discovery workstream. She picks up context fast and is comfortable asking when things are unclear.' }
        ],
        inbox: [
          { icon: '📋', title: 'T-30 probation kick-off', sub: 'Confirm goals, schedule review meeting' }
        ]
      },
      t7: {
        dayInProbation: 83,
        goals: [
          { title: 'Complete onboarding training modules', status: 'Completed', due: '2025-03-01' },
          { title: 'Shadow three client discovery calls', status: 'Completed', due: '2025-04-15', note: '3/3 completed' },
          { title: 'Deliver first solo sprint planning session', status: 'In Progress', due: '2025-05-01', note: 'Scheduled for next Tuesday' }
        ],
        feedback: [
          { date: '2025-03-05', from: 'Priya Patel (People Partner)', comment: 'Alice has settled in well. Picking up the internal tools quickly and asks good questions.' },
          { date: '2025-03-22', from: 'Dave Owen (Line Manager)', comment: 'Alice delivered the onboarding training modules ahead of schedule.', badge: 'Great Initiative' },
          { date: '2025-04-08', from: 'Marcus Lee (Project Lead)', comment: 'Alice has been a strong addition to the discovery workstream.' },
          { date: '2025-04-25', from: 'Self-assessment (Alice)', comment: 'I feel I have met my onboarding goals on time and built strong relationships across the team. Areas to grow: confidence in client-facing meetings.' }
        ],
        inbox: [
          { icon: '📝', title: 'Probation review pack ready', sub: 'Draft compiled by AI Copilot — review and confirm outcome' }
        ]
      },
      reviewDay: {
        dayInProbation: 90,
        goals: [
          { title: 'Complete onboarding training modules', status: 'Completed', due: '2025-03-01' },
          { title: 'Shadow three client discovery calls', status: 'Completed', due: '2025-04-15' },
          { title: 'Deliver first solo sprint planning session', status: 'Completed', due: '2025-05-01' }
        ],
        feedback: [
          { date: '2025-04-25', from: 'Self-assessment (Alice)', comment: 'I feel I have met my onboarding goals on time and built strong relationships across the team.' },
          { date: '2025-05-10', from: 'Outcome (PASS)', comment: 'Probation passed. Alice transitions to full team member status.', badge: 'PASS' }
        ],
        inbox: []
      }
    }
  },

  ben: {
    id: 'W002',
    name: 'Ben Carter',
    initials: 'BC',
    role: 'Junior Consultant',
    manager: 'Dave Owen',
    peoplePartner: 'Priya Patel',
    hireDate: '2025-02-10',
    probationDays: 90,
    probationEnd: '2025-05-11',
    weekData: {
      week1: {
        dayInProbation: 5,
        goals: [],
        feedback: [],
        inbox: [
          { icon: '📋', title: 'Set probation goals for Ben Carter', sub: 'Due in 3 weeks — Workday will auto-flag if missed' }
        ]
      },
      week4: {
        dayInProbation: 28,
        goals: [],
        feedback: [
          { date: '2025-03-04', from: 'Dave Owen (Line Manager)', comment: 'Ben has missed two stand-ups in week 3. We have not had time to set goals yet — I need to find a slot.' }
        ],
        inbox: [
          { icon: '⚠️', title: 'No goals set — overdue', sub: 'Goals were due in week 3. Workday has auto-flagged this.' }
        ]
      },
      week8: {
        dayInProbation: 56,
        goals: [
          { title: 'Complete security awareness training', status: 'Not Started', due: '2025-04-30' },
          { title: 'Attend daily stand-ups consistently', status: 'In Progress', due: '2025-05-01' }
        ],
        feedback: [
          { date: '2025-03-04', from: 'Dave Owen (Line Manager)', comment: 'Ben has missed two stand-ups in week 3. We have not had time to set goals yet.' },
          { date: '2025-03-30', from: 'Dave Owen (Line Manager)', comment: 'Goals finally set this week. Ben says he was unsure what was expected. We agreed two basic goals to get started.' }
        ],
        inbox: [
          { icon: '⚠️', title: 'Halfway point — feedback gap', sub: 'No peer feedback collected for Ben yet' }
        ]
      },
      t30: {
        dayInProbation: 60,
        goals: [
          { title: 'Complete security awareness training', status: 'Not Started', due: '2025-04-30' },
          { title: 'Attend daily stand-ups consistently', status: 'In Progress', due: '2025-05-01', note: 'Mixed — 60% attendance' }
        ],
        feedback: [
          { date: '2025-03-04', from: 'Dave Owen (Line Manager)', comment: 'Ben has missed two stand-ups in week 3.' },
          { date: '2025-03-30', from: 'Dave Owen (Line Manager)', comment: 'Goals finally set this week.' },
          { date: '2025-04-10', from: 'Priya Patel (People Partner)', comment: 'Concern raised: Ben\'s manager flagged that goals were set late and progress is slow. Asked Dave to consider whether extension is appropriate.' }
        ],
        inbox: [
          { icon: '📋', title: 'T-30 probation kick-off', sub: 'Concerns flagged — review case with People Partner' }
        ]
      },
      t7: {
        dayInProbation: 83,
        goals: [
          { title: 'Complete security awareness training', status: 'Not Started', due: '2025-04-30', note: 'Overdue' },
          { title: 'Attend daily stand-ups consistently', status: 'In Progress', due: '2025-05-01', note: 'Mixed — 60% attendance' }
        ],
        feedback: [
          { date: '2025-03-04', from: 'Dave Owen (Line Manager)', comment: 'Ben has missed two stand-ups in week 3.' },
          { date: '2025-03-30', from: 'Dave Owen (Line Manager)', comment: 'Goals finally set this week.' },
          { date: '2025-04-10', from: 'Priya Patel (People Partner)', comment: 'Concern raised: goals set late, progress slow.' },
          { date: '2025-04-28', from: 'Self-assessment (Ben)', comment: 'I have struggled to find clarity on what is expected. The team moves fast and I have not been given a clear project to anchor to.' }
        ],
        inbox: [
          { icon: '📝', title: 'Probation review pack ready', sub: 'Draft compiled — recommended outcome: EXTEND' }
        ]
      },
      reviewDay: {
        dayInProbation: 90,
        goals: [
          { title: 'Complete security awareness training', status: 'Not Started', due: '2025-04-30', note: 'Overdue' },
          { title: 'Attend daily stand-ups consistently', status: 'In Progress', due: '2025-05-01' }
        ],
        feedback: [
          { date: '2025-04-28', from: 'Self-assessment (Ben)', comment: 'I have struggled to find clarity on what is expected.' },
          { date: '2025-05-10', from: 'Outcome (EXTEND)', comment: 'Probation extended by 30 days with new clear targets and weekly check-ins.', badge: 'EXTEND' }
        ],
        inbox: []
      }
    }
  },

  carol: {
    id: 'W003',
    name: 'Carol Reyes',
    initials: 'CR',
    role: 'Associate Designer',
    manager: 'Dave Owen',
    peoplePartner: 'Priya Patel',
    hireDate: '2025-04-25',
    probationDays: 90,
    probationEnd: '2025-07-24',
    weekData: {
      week1: { dayInProbation: 5, goals: [], feedback: [], inbox: [{ icon: '📋', title: 'Set probation goals for Carol Reyes', sub: 'Due in 3 weeks' }] },
      week4: { dayInProbation: 28, goals: [{ title: 'Complete security awareness training', status: 'In Progress', due: '2025-06-01' }], feedback: [{ date: '2025-05-15', from: 'Dave Owen (Line Manager)', comment: 'Carol is very early in her role. No concerns yet — will review at 4 weeks.' }], inbox: [] },
      week8: { dayInProbation: 56, goals: [{ title: 'Complete security awareness training', status: 'Completed', due: '2025-06-01' }], feedback: [{ date: '2025-05-15', from: 'Dave Owen (Line Manager)', comment: 'Carol is very early in her role.' }], inbox: [] },
      t30: { dayInProbation: 60, goals: [{ title: 'Complete security awareness training', status: 'Completed', due: '2025-06-01' }], feedback: [], inbox: [] },
      t7: { dayInProbation: 83, goals: [{ title: 'Complete security awareness training', status: 'Completed', due: '2025-06-01' }], feedback: [], inbox: [] },
      reviewDay: { dayInProbation: 90, goals: [], feedback: [], inbox: [] }
    }
  },

  david: {
    id: 'W004',
    name: 'David Park',
    initials: 'DP',
    role: 'Senior Engineer',
    manager: 'Dave Owen',
    peoplePartner: 'Priya Patel',
    hireDate: '2025-02-03',
    probationDays: 90,
    probationEnd: '2025-05-04',
    weekData: {
      week1: { dayInProbation: 5, goals: [], feedback: [], inbox: [] },
      week4: { dayInProbation: 28, goals: [], feedback: [], inbox: [] },
      week8: { dayInProbation: 56, goals: [], feedback: [], inbox: [] },
      t30: { dayInProbation: 60, goals: [], feedback: [], inbox: [] },
      t7: { dayInProbation: 83, goals: [], feedback: [], inbox: [] },
      reviewDay: { dayInProbation: 95, goals: [{ title: 'Lead first sprint as engineer', status: 'Completed', due: '2025-04-15' }], feedback: [{ date: '2025-05-04', from: 'Outcome (PASS)', comment: 'Probation passed. David transitions to full team member status.', badge: 'PASS' }], inbox: [] }
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Personas — who's logged in, and how the chat addresses them
// ═══════════════════════════════════════════════════════════════════════════
const PERSONAS = {
  manager:   { label: 'Dave Owen (Manager)',      subtitle: 'You are managing 4 workers in probation.', allowsWorkerSwitch: true,  defaultWorker: 'ben'   },
  employeeA: { label: 'Alice Johnson (Employee)', subtitle: 'You are tracking your own probation.',     allowsWorkerSwitch: false, defaultWorker: 'alice' },
  employeeB: { label: 'Ben Carter (Employee)',    subtitle: 'You are tracking your own probation.',     allowsWorkerSwitch: false, defaultWorker: 'ben'   }
};

// ═══════════════════════════════════════════════════════════════════════════
// Scripted opening nudges per persona × worker × week
// Each is { text, chips } — chips are quick-reply buttons that send pre-canned text
// ═══════════════════════════════════════════════════════════════════════════
const NUDGES = {
  manager: {
    alice: {
      week1: { text: "Alice Johnson starts today. Probation runs 90 days, ending May 11. I'll track her goals, feedback, and self-assessment automatically.\n\nWant me to draft 3 starter goals for a Junior Consultant?", chips: ['Yes, draft them', "I'll do it myself", 'Tell me about Alice'] },
      week4: { text: "Alice is 4 weeks in and her 3 goals are on track. She finished onboarding training and is shadowing client calls.\n\nWant me to schedule a 4-week check-in for next week?", chips: ['Schedule check-in', 'Show me her recent feedback', 'Looks fine, no action'] },
      week8: { text: "Halfway point — Alice has good momentum. Goal 2 is at 2/3. Priya has shared positive feedback.\n\nWant me to ask Marcus on the same project for input too?", chips: ['Yes, ask Marcus', "Show me Priya's feedback", 'Not now'] },
      t30:   { text: "30 days until end. Alice's goals: 1 complete, 2 in progress on track. All signals point to PASS.\n\nWant me to start drafting the review pack now to save time later?", chips: ['Yes, draft pack', "Show me what's missing", 'Wait until T-7'] },
      t7:    { text: "Probation review due in 7 days. The draft pack is ready — 5 sections, all goals + feedback compiled.\n\n**Recommended outcome: PASS.** Want to review?", chips: ['Open draft pack', 'Send self-assessment to Alice', 'Schedule review meeting'] },
      reviewDay: { text: "Review day! You confirmed PASS yesterday. I've written the outcome back to Workday and closed the BP.\n\nAnything else for Alice?", chips: ['Set new development goals', 'No, all done', 'Show me the next case'] }
    },
    ben: {
      week1: { text: "Ben Carter starts today. Same setup as Alice — I'll track goals, feedback, and self-assessment.\n\nWant starter goals drafted for his role?", chips: ['Yes, draft them', "I'll do it myself", 'Tell me about Ben'] },
      week4: { text: "**Ben has been here 4 weeks but no goals are set yet.** This is the #1 indicator of probation risk.\n\nHere are 3 goal suggestions based on his role — want me to add them and let Ben know?", chips: ['Add these goals', 'Show me alternatives', "I'll set them in Friday's 1:1"] },
      week8: { text: "Halfway point — Ben's goals were just set last week and have no progress yet. Priya flagged a concern about attendance.\n\nWant to schedule a 1:1 with Ben to address it?", chips: ['Schedule 1:1', 'Add a stretch goal to refocus him', 'Tell me what Priya said'] },
      t30:   { text: "30 days until end. **Ben's goals haven't progressed and there are 2 concerning feedback entries.** He hasn't been staffed on a billable project.\n\nHave you considered extending probation? I can draft the manager note.", chips: ['Draft extension note', 'Show me his feedback', "What's the alternative to extending?"] },
      t7:    { text: "Probation review in 7 days. Draft pack: goals not met, attendance concerns, no billable work.\n\n**Recommended outcome: EXTEND** (30 days) with clear targets. Want to review?", chips: ['Open extension plan', 'Recommend ESCALATE instead', 'Send self-assessment to Ben'] },
      reviewDay: { text: "Review day. You confirmed EXTEND with new 30-day targets. I've written it back to Workday and notified Ben + Priya.\n\nWant me to set up weekly check-ins for the extension period?", chips: ['Yes, weekly check-ins', 'Just T-15 and T-5', 'No automation needed'] }
    },
    carol: {
      week1: { text: "Carol Reyes starts today. Want starter goals drafted for an Associate Designer?", chips: ['Yes, draft them', "I'll do it myself"] },
      week4: { text: "Carol is 4 weeks in — security training in progress. No concerns. Standard track.", chips: ['Schedule check-in', 'No action'] },
      week8: { text: "Carol at halfway — security training complete. No feedback yet. Want me to ask peers for input?", chips: ['Yes, ask peers', 'Not yet'] },
      t30:   { text: "Carol at T-30. Limited feedback collected. Want me to chase peer feedback before review?", chips: ['Chase feedback', 'Move ahead with what we have'] },
      t7:    { text: "Carol's review in 7 days. Limited data — recommend a longer 1:1 to gather context.", chips: ['Schedule longer 1:1', 'Open draft pack'] },
      reviewDay: { text: "Carol's review day. Pending your input on outcome.", chips: ['Mark PASS', 'Mark EXTEND'] }
    },
    david: {
      week1: { text: "David Park starts today. Senior Engineer hire — different goal template?", chips: ['Yes, senior template', 'Use standard template'] },
      week4: { text: "David at 4 weeks — leading sprint planning already. Strong start.", chips: ['No action', 'Add stretch goals'] },
      week8: { text: "David at halfway. Goals on track. Multiple positive feedback entries.", chips: ['Show feedback', 'No action'] },
      t30:   { text: "David at T-30. Strong PASS trajectory. Want to draft pack early?", chips: ['Yes, draft pack', 'Wait until T-7'] },
      t7:    { text: "David's review in 7 days. Recommended: PASS. Pack ready.", chips: ['Open pack', 'Schedule review'] },
      reviewDay: { text: "David — outcome PASS confirmed. Closed cleanly.", chips: ['Set development goals', 'No, all done'] }
    }
  },

  employeeA: {
    alice: {
      week1: { text: "Welcome to the team, Alice! 🎉 I'm your probation copilot. I'll help you stay on top of goals, feedback, and your self-assessment.\n\nWant me to walk you through what to expect over the next 90 days?", chips: ['Yes, walk me through it', 'I know the basics', 'Show me my goals'] },
      week4: { text: "You're 4 weeks in and your goals look great. You completed the onboarding training — nice work.\n\nWant me to suggest who you could ask for feedback?", chips: ['Yes, suggest people', "I'll think about it", 'Show my goals'] },
      week8: { text: "Halfway point! You've shadowed 2 of 3 client calls. Goal for next week: get the third one in.\n\nWant me to send a quick check-in message to Dave?", chips: ['Yes, draft it', "I'll talk to him face to face", 'Show my feedback'] },
      t30:   { text: "30 days until probation end. You're on track.\n\nWant help drafting your self-assessment now? It'll save time later.", chips: ['Start self-assessment', 'Send a feedback request', 'Not yet'] },
      t7:    { text: "Your probation review is in a week. Have you submitted your self-assessment yet?\n\nIf not, I can draft a starting point from your goal updates.", chips: ['Draft my self-assessment', 'Submit what I have', 'Schedule prep meeting'] },
      reviewDay: { text: "Probation review day! Dave confirmed PASS. Congratulations 🎉\n\nWant help setting your post-probation development goals?", chips: ['Set new goals', 'Take a break first', 'What changes now?'] }
    }
  },

  employeeB: {
    ben: {
      week1: { text: "Welcome, Ben! I'm your probation copilot. I'll help you stay on top of goals, feedback, and your self-assessment.\n\nWant me to walk you through what to expect?", chips: ['Yes, walk me through', "I'm fine", 'Show me my probation timeline'] },
      week4: { text: "You're 4 weeks in and **no goals are set yet**. This usually happens when the manager hasn't found time.\n\nWant me to draft a goal-setting message to send to Dave?", chips: ['Draft message to Dave', 'Tell me what good goals look like', "I'll mention it tomorrow"] },
      week8: { text: "Halfway through probation. Your goals are still being defined and there's no recent feedback.\n\nWant help asking 2 colleagues you've worked with for input?", chips: ['Yes, draft request', 'Who would you suggest?', 'Not comfortable doing that'] },
      t30:   { text: "30 days until probation end. Your goals haven't moved in 3 weeks.\n\nTell me what you've actually been doing day-to-day and I'll update your goals for you.", chips: ["Tell you what I've done", "Show me what's missing", 'Send a check-in to Dave'] },
      t7:    { text: "Probation review next week. Have you completed your self-assessment?\n\nIf not, I can draft a starting point and we'll polish it together.", chips: ['Draft my self-assessment', 'What happens at the review?', "I'm worried about the outcome"] },
      reviewDay: { text: "Review day. Your probation has been **extended by 30 days** with clear targets. This is a chance to demonstrate progress, not a failure.\n\nWant help building a plan for the next 30 days?", chips: ['Build extension plan', 'Talk to Dave first', 'What does this mean for me?'] }
    }
  }
};
