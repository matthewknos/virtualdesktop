/**
 * Projects canonical identity into Graph entities and seeds the store.
 */

import { buildIdentity, buildOrgs } from './identity.js';
import { store } from '../store.js';
import { randomUUID } from 'crypto';

function now() { return new Date().toISOString(); }
function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export async function seedGraph(tenant) {
  if (await store.isSeeded('graph', tenant)) return;

  const people = buildIdentity(tenant);

  // ── Users ──────────────────────────────────────────────────────────────
  const users = people.map(p => ({
    id: p.graphId,
    displayName: p.displayName,
    givenName: p.first,
    surname: p.last,
    mail: p.email,
    userPrincipalName: p.graphUPN,
    jobTitle: p.title,
    department: p.department,
    officeLocation: 'London HQ',
    mobilePhone: null,
    businessPhones: ['+44 20 7946 ' + String(1000 + p.index).slice(1)],
    accountEnabled: true,
    createdDateTime: pastDate(300 + p.index * 20),
    lastModifiedDateTime: pastDate(10 + p.index),
    preferredLanguage: 'en-GB',
    _managerId: p.managerGraphId ?? null,
    usageLocation: 'GB',
    assignedLicenses: [{ skuId: 'efccb6f7-5641-4e0e-bd10-b4976e1bf68e' }],
    proxyAddresses: [`SMTP:${p.email}`],
    onPremisesSyncEnabled: null,
  }));

  await store.bulkSet('graph', tenant, 'user', users);

  // ── Groups ─────────────────────────────────────────────────────────────
  const depts = [...new Set(people.map(p => p.department))];
  const groups = depts.map((dept, i) => ({
    id: randomUUID(),
    displayName: `${dept} Team`,
    description: `Members of the ${dept} department`,
    mailNickname: dept.replace(/\s+/g, '-').toLowerCase(),
    mail: `${dept.replace(/\s+/g, '-').toLowerCase()}@${people[0].domain}`,
    mailEnabled: true,
    securityEnabled: false,
    groupTypes: ['Unified'],
    visibility: 'Private',
    createdDateTime: pastDate(200 + i * 15),
    proxyAddresses: [],
    _memberIds: people.filter(p => p.department === dept).map(p => p.graphId),
  }));

  await store.bulkSet('graph', tenant, 'group', groups);

  // ── Teams ──────────────────────────────────────────────────────────────
  const teamNames = ['All Company', 'Engineering', 'HR & People', 'Finance', 'Product'];
  const teams = teamNames.map((name, i) => {
    const teamId = randomUUID();
    const generalChannelId = randomUUID();
    const announcementsChannelId = randomUUID();

    const channels = [
      {
        id: generalChannelId,
        displayName: 'General',
        description: 'General discussion',
        membershipType: 'standard',
        isArchived: false,
        createdDateTime: pastDate(200 + i * 20),
        webUrl: `https://teams.microsoft.com/mock/channel/${generalChannelId}`,
        email: `general.${name.toLowerCase().replace(/\s+/g,'')}@${people[0].domain}`,
        _teamId: teamId,
      },
      {
        id: announcementsChannelId,
        displayName: 'Announcements',
        description: 'Company-wide announcements',
        membershipType: 'standard',
        isArchived: false,
        createdDateTime: pastDate(200 + i * 20),
        webUrl: `https://teams.microsoft.com/mock/channel/${announcementsChannelId}`,
        email: `announcements.${name.toLowerCase().replace(/\s+/g,'')}@${people[0].domain}`,
        _teamId: teamId,
      },
    ];

    return {
      team: {
        id: teamId,
        displayName: name,
        description: `${name} team`,
        isArchived: false,
        createdDateTime: pastDate(180 + i * 25),
        webUrl: `https://teams.microsoft.com/mock/team/${teamId}`,
        visibility: name === 'All Company' ? 'public' : 'private',
        _channelIds: channels.map(c => c.id),
        _memberIds: people.map(p => p.graphId),
      },
      channels,
    };
  });

  await store.bulkSet('graph', tenant, 'team', teams.map(t => t.team));
  for (const t of teams) {
    await store.bulkSet('graph', tenant, `channel:${t.team.id}`, t.channels);
  }

  // Seed a few sample channel messages
  const sampleMessages = [
    { from: people[9], to: 'General', text: 'Welcome to the team channel! Use this space for general questions.' },
    { from: people[8], to: 'General', text: 'Reminder: please ensure your timesheets are submitted by end of week.' },
    { from: people[7], to: 'General', text: 'Sprint review is on Friday at 2pm — calendar invites sent.' },
  ];
  const channelMessages = sampleMessages.map((m, i) => ({
    id: randomUUID(),
    body: { contentType: 'text', content: m.text },
    from: { user: { id: m.from.graphId, displayName: m.from.displayName } },
    createdDateTime: pastDate(7 - i),
    lastModifiedDateTime: pastDate(7 - i),
    importance: 'normal',
    messageType: 'message',
    mentions: [],
    attachments: [],
    reactions: [],
    subject: null,
    summary: null,
    _channelId: teams[0].channels[0].id,
  }));

  await store.bulkSet('graph', tenant, `chatMessage:channel:${teams[0].channels[0].id}`, channelMessages);

  // ── Presence (one per user) ─────────────────────────────────────────────
  const availabilities = ['Available', 'Busy', 'Away', 'DoNotDisturb', 'BeRightBack'];
  const presences = people.map((p, i) => ({
    id: p.graphId,
    availability: availabilities[i % availabilities.length],
    activity: i % 3 === 0 ? 'InAMeeting' : availabilities[i % availabilities.length],
  }));
  await store.bulkSet('graph', tenant, 'presence', presences);

  // ── Mail folders ───────────────────────────────────────────────────────
  const folderDefs = [
    { id: 'Inbox', displayName: 'Inbox', parentFolderId: null },
    { id: 'SentItems', displayName: 'Sent Items', parentFolderId: null },
    { id: 'Drafts', displayName: 'Drafts', parentFolderId: null },
    { id: 'DeletedItems', displayName: 'Deleted Items', parentFolderId: null },
    { id: 'Archive', displayName: 'Archive', parentFolderId: null },
  ];

  for (const person of people) {
    const folders = folderDefs.map((f, i) => ({
      id: `${person.graphId}:folder:${f.id}`,
      displayName: f.displayName,
      parentFolderId: f.parentFolderId,
      childFolderCount: 0,
      unreadItemCount: f.id === 'Inbox' ? 3 : 0,
      totalItemCount: f.id === 'Inbox' ? 5 : (f.id === 'SentItems' ? 2 : 0),
      isHidden: false,
      _ownerId: person.graphId,
    }));
    await store.bulkSet('graph', tenant, `mailFolder:${person.graphId}`, folders);

    // Seed 2-3 inbox messages per person
    const senderIdx = (person.index + 1) % people.length;
    const sender = people[senderIdx];
    const messages = [
      {
        id: randomUUID(),
        subject: 'Welcome to CoE Demo Platform',
        bodyPreview: 'This is a demo message in your seeded inbox.',
        body: { contentType: 'text', content: 'This is a demo message in your seeded inbox. The mock platform is running correctly.' },
        from: { emailAddress: { name: sender.displayName, address: sender.email } },
        toRecipients: [{ emailAddress: { name: person.displayName, address: person.email } }],
        ccRecipients: [],
        bccRecipients: [],
        isRead: false,
        isDraft: false,
        importance: 'normal',
        hasAttachments: false,
        receivedDateTime: pastDate(3),
        sentDateTime: pastDate(3),
        createdDateTime: pastDate(3),
        lastModifiedDateTime: pastDate(3),
        conversationId: randomUUID(),
        internetMessageId: `<${randomUUID()}@${people[0].domain}>`,
        parentFolderId: `${person.graphId}:folder:Inbox`,
        _ownerId: person.graphId,
      },
      {
        id: randomUUID(),
        subject: 'Timesheet reminder',
        bodyPreview: 'Please remember to submit your timesheet before end of week.',
        body: { contentType: 'text', content: 'Hi — please remember to submit your timesheet before end of week. Thanks, HR.' },
        from: { emailAddress: { name: people[8].displayName, address: people[8].email } },
        toRecipients: [{ emailAddress: { name: person.displayName, address: person.email } }],
        ccRecipients: [],
        bccRecipients: [],
        isRead: false,
        isDraft: false,
        importance: 'normal',
        hasAttachments: false,
        receivedDateTime: pastDate(1),
        sentDateTime: pastDate(1),
        createdDateTime: pastDate(1),
        lastModifiedDateTime: pastDate(1),
        conversationId: randomUUID(),
        internetMessageId: `<${randomUUID()}@${people[0].domain}>`,
        parentFolderId: `${person.graphId}:folder:Inbox`,
        _ownerId: person.graphId,
      },
    ];
    await store.bulkSet('graph', tenant, `message:${person.graphId}`, messages);
  }

  // ── Calendar events ────────────────────────────────────────────────────
  for (const person of people) {
    const events = [
      {
        id: randomUUID(),
        subject: 'Weekly team standup',
        body: { contentType: 'text', content: 'Regular weekly standup.' },
        start: { dateTime: nextWeekday(1, '09:00'), timeZone: 'Europe/London' },
        end:   { dateTime: nextWeekday(1, '09:30'), timeZone: 'Europe/London' },
        location: { displayName: 'Teams' },
        attendees: people.filter(p => p.department === person.department && p.index !== person.index).map(p => ({
          emailAddress: { name: p.displayName, address: p.email }, status: { response: 'accepted', time: now() }, type: 'required',
        })),
        organizer: { emailAddress: { name: person.displayName, address: person.email } },
        isAllDay: false,
        isCancelled: false,
        isOnlineMeeting: true,
        showAs: 'busy',
        sensitivity: 'normal',
        importance: 'normal',
        responseStatus: { response: 'organizer', time: now() },
        recurrence: null,
        createdDateTime: pastDate(14),
        lastModifiedDateTime: pastDate(14),
        iCalUId: randomUUID(),
        webUrl: `https://teams.microsoft.com/mock/meeting/${randomUUID()}`,
        categories: [],
        _ownerId: person.graphId,
      },
    ];
    await store.bulkSet('graph', tenant, `event:${person.graphId}`, events);
  }

  // ── Chats (1:1 per adjacent pair) ──────────────────────────────────────
  const chats = [];
  const chatMessagesMap = {}; // chatId -> messages[]
  for (let i = 0; i < Math.min(people.length - 1, 8); i++) {
    const a = people[i], b = people[i + 1];
    const chatId = randomUUID();
    chats.push({
      id: chatId,
      topic: null,
      chatType: 'oneOnOne',
      createdDateTime: pastDate(30 + i * 3),
      lastUpdatedDateTime: pastDate(i + 1),
      webUrl: `https://teams.microsoft.com/mock/chat/${randomUUID()}`,
      members: [
        { id: a.graphId, displayName: a.displayName },
        { id: b.graphId, displayName: b.displayName },
      ],
      _memberIds: [a.graphId, b.graphId],
    });

    // Seed 2–4 messages per chat
    const msgTexts = [
      'Hey, do you have a minute to chat about the project?',
      'Sure — what\'s up?',
      'The timeline shifted again. We need to replan sprint 3.',
      'No problem, I can pull together a draft by EOD.',
      'Thanks! Let me know if you need any context.',
      'Will do — talk later.',
    ];
    const chatMsgs = [];
    const msgCount = 2 + (i % 3);
    for (let m = 0; m < msgCount; m++) {
      const sender = m % 2 === 0 ? a : b;
      chatMsgs.push({
        id: randomUUID(),
        body: { contentType: 'text', content: msgTexts[(i + m) % msgTexts.length] },
        from: { user: { id: sender.graphId, displayName: sender.displayName } },
        createdDateTime: pastDate(msgCount - m),
        lastModifiedDateTime: pastDate(msgCount - m),
        importance: 'normal',
        messageType: 'message',
        mentions: [],
        attachments: [],
        reactions: [],
        subject: null,
        summary: null,
      });
    }
    chatMessagesMap[chatId] = chatMsgs;
  }
  await store.bulkSet('graph', tenant, 'chat', chats);
  for (const [chatId, msgs] of Object.entries(chatMessagesMap)) {
    await store.bulkSet('graph', tenant, `chatMessage:chat:${chatId}`, msgs);
  }

  await store.markSeeded('graph', tenant);
}

function nextWeekday(dayOfWeek, time) {
  // dayOfWeek: 1=Mon … 5=Fri
  const d = new Date();
  const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  const [h, m] = time.split(':');
  d.setHours(parseInt(h), parseInt(m), 0, 0);
  return d.toISOString().replace('Z', '');
}
