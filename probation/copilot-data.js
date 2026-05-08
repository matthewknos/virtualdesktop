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
          { icon: 'task', title: 'Set probation goals for Alice Johnson', sub: 'Due in 3 weeks — Workday will auto-flag if missed' }
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
          { icon: 'task', title: 'T-30 probation kick-off', sub: 'Confirm goals, schedule review meeting' }
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
          { icon: 'document', title: 'Probation review pack ready', sub: 'Draft compiled by AI Copilot — review and confirm outcome' }
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
          { icon: 'task', title: 'Set probation goals for Ben Carter', sub: 'Due in 3 weeks — Workday will auto-flag if missed' }
        ]
      },
      week4: {
        dayInProbation: 28,
        goals: [],
        feedback: [
          { date: '2025-03-04', from: 'Dave Owen (Line Manager)', comment: 'Ben has missed two stand-ups in week 3. We have not had time to set goals yet — I need to find a slot.' }
        ],
        inbox: [
          { icon: 'alert', title: 'No goals set — overdue', sub: 'Goals were due in week 3. Workday has auto-flagged this.' }
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
          { icon: 'alert', title: 'Halfway point — feedback gap', sub: 'No peer feedback collected for Ben yet' }
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
          { icon: 'task', title: 'T-30 probation kick-off', sub: 'Concerns flagged — review case with People Partner' }
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
          { icon: 'document', title: 'Probation review pack ready', sub: 'Draft compiled — recommended outcome: EXTEND' }
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
// Scripted Teams adaptive cards per persona × worker × week
// Each card: { text, bullets?, actions: [{ label, style, type, payload?, confirm?, info? }] }
// Action types:
//   - addGoals             — appends goals to Workday Goals tab; bot confirms
//   - sendFeedbackRequests — adds inbox tasks for outstanding feedback; bot confirms
//   - draftExtension       — bot replies with extension note draft inline
//   - draftMessage         — bot replies with drafted Teams message inline
//   - draftSelfAssessment  — bot replies with self-assessment draft inline
//   - openPack             — bot opens the review pack inline
//   - dismiss              — bot says "OK, I'll re-check in 7 days"
//   - info                 — bot shows a placeholder note (e.g., "would let you edit each goal")
// ═══════════════════════════════════════════════════════════════════════════
const NUDGES = {
  // ═══════════ MANAGER (Dave) ═══════════
  manager: {
    alice: {
      week1: {
        text: "Hey Dave, Alice Johnson starts today. Probation runs 90 days, ending May 11. I'll track her goals, feedback, and self-assessment automatically.\n\nWant me to draft 3 starter goals for a Junior Consultant?",
        actions: [
          { label: 'Draft starter goals', style: 'primary', type: 'addGoals',
            payload: [
              { title: 'Complete onboarding training modules', status: 'Not Started', due: '2025-03-31' },
              { title: 'Shadow 3 client discovery calls',      status: 'Not Started', due: '2025-04-30' },
              { title: 'Deliver first solo sprint planning session', status: 'Not Started', due: '2025-05-15' }
            ],
            confirm: "Done. I've added 3 starter goals to Alice's Workday record and notified her on Teams." },
          { label: "I'll do it myself", style: 'tertiary', type: 'dismiss',
            confirm: "OK — I'll re-check at week 4 and nudge if goals are still missing." }
        ]
      },
      week4: {
        text: "Hey Dave, Alice is 4 weeks in and all 3 goals are on track. She's finished onboarding and is shadowing client calls.\n\nNo action needed from you — just an FYI.",
        actions: [
          { label: 'Acknowledge', style: 'primary', type: 'dismiss', confirm: "Got it — I'll check back at week 8." },
          { label: 'Show me her feedback', style: 'secondary', type: 'info',
            info: "Priya Patel (People Partner) on 5 Mar: \"Alice has settled in well. Picking up internal tools quickly and asks good questions.\"" }
        ]
      },
      week8: {
        text: "Hey Dave, Alice is at the halfway point. Goal 2 is 2/3 done and she's making good progress.\n\nOnly 1 piece of feedback collected so far. Want me to send Alice a nudge to ask Marcus Lee for input on her discovery work?",
        actions: [
          { label: 'Nudge Alice to ask Marcus', style: 'primary', type: 'draftMessage',
            confirm: "Message drafted and ready to send to Alice on Teams.",
            draft: "Hi Alice, you're halfway through probation and doing well. It would be great to have some feedback from Marcus on the discovery work before your review — could you drop him a quick message this week? I'll keep an eye on the Workday record. Cheers, Dave." },
          { label: 'Skip', style: 'tertiary', type: 'dismiss', confirm: "OK, no nudges on this one." }
        ]
      },
      t30: {
        text: "Hey Dave, Alice is 30 days from probation end. Goals: 1 complete, 2 in progress on track. All signals point to PASS.\n\nWant me to start drafting the review pack now to save time at T-7?",
        actions: [
          { label: 'Draft review pack', style: 'primary', type: 'openPack',
            confirm: "Pack drafted. 5 sections compiled from goals + feedback. Recommended outcome: PASS. I've added it to your Workday inbox." },
          { label: 'Wait until T-7', style: 'tertiary', type: 'dismiss', confirm: "OK — I'll draft it 7 days before the review." }
        ]
      },
      t7: {
        text: "Hey Dave, Alice's probation review is in 7 days. The draft pack is ready in your Workday inbox.\n\nRecommended outcome: PASS. Want to send Alice's self-assessment request now?",
        actions: [
          { label: 'Send self-assessment to Alice', style: 'primary', type: 'sendFeedbackRequests',
            payload: { task: { icon: 'document', title: 'Self-assessment requested from Alice', sub: 'Due 3 days before review' } },
            confirm: "Sent. Alice will see the form in her Workday inbox + a Teams ping from me." },
          { label: 'Open the pack', style: 'secondary', type: 'info',
            info: "(Demo placeholder) Opens the full review pack — 5 sections, recommended outcome PASS, ready for your sign-off." }
        ]
      },
      reviewDay: {
        text: "Review day. You confirmed PASS yesterday. I've written the outcome back to Workday and closed the business process.",
        actions: [
          { label: 'Set post-probation goals', style: 'primary', type: 'info',
            info: "(Demo placeholder) Would open a goal-setting flow for Alice's first quarter as a confirmed team member." },
          { label: 'All done', style: 'tertiary', type: 'dismiss', confirm: "All wrapped up. See you at the next probation case." }
        ]
      }
    },

    ben: {
      week1: {
        text: "Hey Dave, Ben Carter starts today. Probation runs 90 days, ending May 11. I'll track goals, feedback, and self-assessment automatically.",
        actions: [
          { label: 'Draft starter goals', style: 'primary', type: 'addGoals',
            payload: [
              { title: 'Complete onboarding training modules', status: 'Not Started', due: '2025-03-31' },
              { title: 'Shadow 3 client discovery calls',      status: 'Not Started', due: '2025-04-30' },
              { title: 'Deliver first solo sprint planning session', status: 'Not Started', due: '2025-05-15' }
            ],
            confirm: "Done. 3 starter goals added to Ben's Workday record. I've notified Ben on Teams." },
          { label: "I'll set them in our 1:1", style: 'tertiary', type: 'dismiss',
            confirm: "OK — I'll re-check at week 4 and nudge if goals are still missing." }
        ]
      },
      week4: {
        text: "Hey Dave, Ben has been here 4 weeks and has no goals in Workday. Here are 3 that might suit his role (Junior Consultant, Workday Financials team, first 6 months):",
        bullets: [
          'Complete onboarding training modules — due 31 Mar',
          'Shadow 3 client discovery calls — due 30 Apr',
          'Deliver first solo sprint planning session — due 15 May'
        ],
        actions: [
          { label: 'Add all to Workday', style: 'primary', type: 'addGoals',
            payload: [
              { title: 'Complete onboarding training modules', status: 'Not Started', due: '2025-03-31' },
              { title: 'Shadow 3 client discovery calls',      status: 'Not Started', due: '2025-04-30' },
              { title: 'Deliver first solo sprint planning session', status: 'Not Started', due: '2025-05-15' }
            ],
            confirm: "Done. 3 goals added to Ben's Workday record. I've notified Ben on Teams." },
          { label: 'Edit list', style: 'secondary', type: 'info',
            info: "(Demo placeholder) An inline editor would let you tweak each goal title and due date before adding to Workday." },
          { label: 'Dismiss', style: 'tertiary', type: 'dismiss',
            confirm: "OK — I'll re-check in 7 days and nudge again if goals are still missing." }
        ]
      },
      week8: {
        text: "Hey Dave, Ben is at the halfway point and there's no peer feedback on his record yet.\n\nPeer feedback needs to be requested by Ben — want me to draft a Teams message you can send him, nudging him to ask Sarah Malik and Marcus Lee?",
        actions: [
          { label: 'Draft nudge to Ben', style: 'primary', type: 'draftMessage',
            confirm: "Drafted. Review and send to Ben when ready.",
            draft: "Hi Ben, we're halfway through your probation. One thing that would really help your review is some peer feedback. Could you reach out to Sarah Malik and Marcus Lee this week? Even 2–3 sentences from each would make a difference. Let me know if you'd like help drafting the ask. Cheers, Dave." },
          { label: 'Dismiss', style: 'tertiary', type: 'dismiss',
            confirm: "OK — I'll re-check in 7 days." }
        ]
      },
      t30: {
        text: "Hey Dave, Ben is 30 days from probation end and his signals are concerning. Goals haven't progressed in 3 weeks, 2 negative feedback entries from his manager and people partner, and he hasn't been staffed on a billable project.\n\nHave you started the conversation about extending probation?",
        actions: [
          { label: 'Draft extension note', style: 'primary', type: 'draftExtension',
            confirm: "Drafted. Read the note below — review and send when ready.",
            draft: "**Probation extension recommendation — Ben Carter**\n\nBen has been with us 60 days. Goals were set 3 weeks late and have not progressed. Feedback from manager and people partner flags attendance and engagement concerns. Ben has not been allocated to a billable project.\n\nRecommendation: extend probation by 30 days with the following targets:\n• Ben to be staffed on a delivery project within 7 days\n• Goals reset with 4-week milestones\n• Weekly 1:1 with Dave + monthly check-in with People Partner\n\nIf clear improvement against these targets, confirm PASS at end of extension. Otherwise, escalate." },
          { label: 'Schedule call with Priya', style: 'secondary', type: 'info',
            info: "(Demo placeholder) Would open Outlook with a slot picker for a 30-min meeting with Priya Patel." },
          { label: 'Dismiss', style: 'tertiary', type: 'dismiss',
            confirm: "OK — but I'll nudge again at T-14 if nothing changes." }
        ]
      },
      t7: {
        text: "Hey Dave, Ben's probation review is in 7 days. Goals not met, attendance concerns, no billable work logged.\n\nRecommended outcome: **EXTEND** (30 days) with clear targets. The pack is in your Workday inbox.",
        actions: [
          { label: 'Open pack', style: 'primary', type: 'info',
            info: "(Demo placeholder) Opens the full review pack — recommended outcome EXTEND with 30-day targets, ready for your sign-off." },
          { label: 'Send self-assessment to Ben', style: 'secondary', type: 'sendFeedbackRequests',
            payload: { task: { icon: 'document', title: 'Self-assessment requested from Ben', sub: 'Due 3 days before review' } },
            confirm: "Sent to Ben on Teams + Workday inbox." }
        ]
      },
      reviewDay: {
        text: "Review day. You confirmed EXTEND with new 30-day targets. I've written the outcome back to Workday and notified Ben + Priya.",
        actions: [
          { label: 'Set up weekly check-ins', style: 'primary', type: 'info',
            info: "(Demo placeholder) Would create 4 weekly 1:1 calendar invites + reminders for milestone check-ins at T-15 and T-5 of the extension period." },
          { label: 'Done', style: 'tertiary', type: 'dismiss', confirm: "Logged. I'll continue tracking through the extension." }
        ]
      }
    }
  },

  // ═══════════ EMPLOYEE A — Alice (going well) ═══════════
  employeeA: {
    alice: {
      week1: {
        text: "Hi Alice, welcome to the team! 🎉 I'm your AI Probation Copilot. I'll help you stay on top of goals, feedback, and your self-assessment over the next 90 days.\n\nWant a quick walkthrough of what to expect?",
        actions: [
          { label: 'Show me the timeline', style: 'primary', type: 'info',
            info: "Probation in 4 beats:\n• Week 1–4: get goals set, complete onboarding\n• Week 4–8: build feedback, make progress on goals\n• Week 8–12: gather peer feedback, prep self-assessment\n• Week 12: review meeting with Dave" },
          { label: 'I know the basics', style: 'tertiary', type: 'dismiss', confirm: "Cool — I'll check back at week 4." }
        ]
      },
      week4: {
        text: "Hi Alice, you're 4 weeks in and your goals look great. You've completed onboarding training — nice work.\n\nHave you asked any colleagues for feedback yet? It's easier to ask early than at the end.",
        actions: [
          { label: 'Suggest who to ask', style: 'primary', type: 'info',
            info: "Based on your project work I'd suggest: Marcus Lee (your project lead) and Priya Patel (people partner). I can draft the request." },
          { label: 'Draft the request now', style: 'secondary', type: 'draftMessage',
            confirm: "Drafted. Review the message below before I send it.",
            draft: "Hi Marcus, I'm 4 weeks into my probation at Kainos and I'd love your honest feedback on how I'm settling into the team. Anything I'm doing well? Anything I should change? No need to write a lot — even a couple of bullets would help. Thanks, Alice." },
          { label: 'Not yet', style: 'tertiary', type: 'dismiss', confirm: "OK — I'll re-check at week 6." }
        ]
      },
      week8: {
        text: "Hi Alice, halfway point! You've shadowed 2 of 3 client calls. One more to go.\n\nDave hasn't logged a 1:1 with you in 3 weeks — want me to draft a quick check-in message for him?",
        actions: [
          { label: 'Draft check-in to Dave', style: 'primary', type: 'draftMessage',
            confirm: "Drafted. Review and send when ready.",
            draft: "Hi Dave, just looking ahead to the back half of probation — could we grab 20 mins this week or next? I'd love a steer on whether I'm on track and what to focus on for the rest of the 90 days. Cheers, Alice." },
          { label: "I'll talk to him in person", style: 'tertiary', type: 'dismiss', confirm: "Sounds good." }
        ]
      },
      t30: {
        text: "Hi Alice, you're 30 days from probation end and on track for a PASS.\n\nWant me to start drafting your self-assessment? I'll pre-fill it from your goal updates and you can polish it.",
        actions: [
          { label: 'Draft self-assessment', style: 'primary', type: 'draftSelfAssessment',
            confirm: "Drafted from your goals + the feedback you've collected. Read the draft below.",
            draft: "**My probation self-assessment**\n\n**Goals**: I've completed all 3 of my probation goals on time. Onboarding training was finished early, I've shadowed 3 client calls (and contributed to 2 of them), and the sprint planning goal is on track for next week.\n\n**What's gone well**: I've built relationships across the team quickly. The feedback from Marcus and Priya has been encouraging.\n\n**Areas I want to grow**: Confidence in client-facing meetings — I'd like to lead one before end of Q2.\n\n**Recommendation**: I'd like to confirm PASS." },
          { label: 'Not yet', style: 'tertiary', type: 'dismiss', confirm: "OK — I'll re-check at T-14." }
        ]
      },
      t7: {
        text: "Hi Alice, your probation review is in a week. Have you submitted your self-assessment?",
        actions: [
          { label: 'Submit it now', style: 'primary', type: 'info',
            info: "(Demo placeholder) Submits your self-assessment to Workday + lets Dave know it's ready to review." },
          { label: 'I need to edit it first', style: 'tertiary', type: 'dismiss', confirm: "OK — I'll re-check tomorrow." }
        ]
      },
      reviewDay: {
        text: "Probation review day! Dave confirmed PASS. Congratulations 🎉\n\nWant help setting your post-probation development goals?",
        actions: [
          { label: 'Set development goals', style: 'primary', type: 'info', info: "(Demo placeholder) Would open a goal-setting flow." },
          { label: 'Take a break first', style: 'tertiary', type: 'dismiss', confirm: "Enjoy it 🍻" }
        ]
      }
    }
  },

  // ═══════════ EMPLOYEE B — Ben (struggling) ═══════════
  employeeB: {
    ben: {
      week1: {
        text: "Hi Ben, welcome to the team! I'm your AI Probation Copilot. I'll help you stay on top of goals, feedback, and your self-assessment.\n\nWant a quick walkthrough?",
        actions: [
          { label: 'Show me the timeline', style: 'primary', type: 'info',
            info: "Probation in 4 beats:\n• Week 1–4: get goals set, complete onboarding\n• Week 4–8: build feedback, make progress on goals\n• Week 8–12: gather peer feedback, prep self-assessment\n• Week 12: review meeting with Dave" },
          { label: "I'm fine", style: 'tertiary', type: 'dismiss', confirm: "Cool — I'll check back at week 4." }
        ]
      },
      week4: {
        text: "Hi Ben, you're 4 weeks in and your manager hasn't set probation goals with you yet. This is the most common reason probation reviews go badly — not because the work isn't there, but because it's not written down.\n\nWant me to draft a polite message to Dave asking to schedule a goal-setting session?",
        actions: [
          { label: 'Draft message to Dave', style: 'primary', type: 'draftMessage',
            confirm: "Drafted. Read it below — send when ready.",
            draft: "Hi Dave, I'm 4 weeks in and would love to lock in my probation goals so I know what good looks like over the next 8 weeks. Could we grab 20 mins this week to set them together? Thanks, Ben." },
          { label: 'Tell me what good goals look like', style: 'secondary', type: 'info',
            info: "Good probation goals are: 1) specific (not 'do good work'), 2) achievable in 90 days, 3) measurable (so the review is easy), and 4) aligned to the role. For your role: complete onboarding, shadow client work, and deliver one solo task." },
          { label: "I'll mention it tomorrow", style: 'tertiary', type: 'dismiss', confirm: "OK — I'll re-check in 7 days." }
        ]
      },
      week8: {
        text: "Hi Ben, halfway through probation. Your goals were set late and there's no peer feedback for you yet.\n\nGetting feedback early gives Dave evidence in your favour at the review. Want me to help you ask 2 colleagues?",
        actions: [
          { label: 'Draft a feedback request', style: 'primary', type: 'draftMessage',
            confirm: "Drafted. Read the message below.",
            draft: "Hi, I'm halfway through my probation and I'd love your honest feedback. We worked together on [project] in weeks 2–5. Anything I did well? Anything to change? Even 2–3 bullets would really help. Cheers, Ben." },
          { label: 'Who would you suggest?', style: 'secondary', type: 'info',
            info: "Based on your project history I'd suggest Sarah Malik and Marcus Lee. They've both worked with you long enough to give meaningful input." },
          { label: 'Not comfortable doing that', style: 'tertiary', type: 'dismiss', confirm: "OK — but I'll nudge again at T-30. Feedback now is much easier than feedback at the review." }
        ]
      },
      t30: {
        text: "Hi Ben, you're 30 days from probation end and your goals haven't been updated in 3 weeks.\n\nThis is fixable. Tell me what you've actually been doing day-to-day and I'll update your goal records for you.",
        actions: [
          { label: "I'll tell you", style: 'primary', type: 'info',
            info: "(Demo placeholder) Would open an inline form where you describe what you've worked on, and I'd map it to your existing goals + suggest updates." },
          { label: "Show me what's missing", style: 'secondary', type: 'info',
            info: "Goal 1 (security training): not started — needs a status update or completion. Goal 2 (stand-ups): in progress, last update 18 days ago. Want to add a quick note?" },
          { label: 'Send a check-in to Dave', style: 'tertiary', type: 'draftMessage',
            confirm: "Drafted. Read it below.",
            draft: "Hi Dave, with 30 days to go I want to make sure we're aligned on probation. Could we have a 20-min review of where I am vs. the goals so I can course-correct anything you'd like to see different? Cheers, Ben." }
        ]
      },
      t7: {
        text: "Hi Ben, your probation review is next week. Have you completed your self-assessment?",
        actions: [
          { label: 'Help me draft it', style: 'primary', type: 'draftSelfAssessment',
            confirm: "Drafted. Read the starting point below — edit it to be in your own words.",
            draft: "**My probation self-assessment**\n\n**Goals**: My probation goals were set in week 5 and I've made partial progress. I want to acknowledge the slow start and own that.\n\n**What I've learned**: That I needed to ask earlier and louder when I wasn't clear on expectations. I'm doing that better now.\n\n**What I'd like**: A clear set of 30-day targets so I can demonstrate progress, with weekly check-ins so we don't end up in the same spot at the next review." },
          { label: "I'm worried about the outcome", style: 'tertiary', type: 'info',
            info: "Honest take: the data isn't strong, but extension with clear targets is more likely than escalation. Engaging actively in the review (which the self-assessment shows) helps a lot. Drafting it makes a real difference." }
        ]
      },
      reviewDay: {
        text: "Hi Ben — your probation has been extended by 30 days with new targets. This is a chance to demonstrate progress, not a failure.\n\nWant help building a plan for the next 30 days?",
        actions: [
          { label: 'Build extension plan', style: 'primary', type: 'info',
            info: "(Demo placeholder) Would walk you through the new targets and create a weekly check-in cadence." },
          { label: 'Talk to Dave first', style: 'tertiary', type: 'dismiss', confirm: "Sensible. I'll be here when you're ready." }
        ]
      }
    }
  }
};
