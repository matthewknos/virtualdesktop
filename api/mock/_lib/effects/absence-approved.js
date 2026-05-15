import { store } from '../store.js';
import { seedGraph } from '../seed/graph-projection.js';
import { randomUUID } from 'crypto';

async function findGraphUserByEmail(tenant, email) {
  if (!email) return null;
  const users = await store.listEntities('graph', tenant, 'user');
  return users.find(u => u.mail === email || u.userPrincipalName === email) ?? null;
}

async function deliverMail(tenant, fromGraphUser, toGraphUser, subject, bodyText) {
  if (!toGraphUser) return;
  const now = new Date().toISOString();
  const msg = {
    id: randomUUID(),
    subject,
    bodyPreview: bodyText.slice(0, 255),
    body: { contentType: 'text', content: bodyText },
    from: { emailAddress: { name: fromGraphUser?.displayName ?? 'System', address: fromGraphUser?.mail ?? 'system@mock.local' } },
    toRecipients: [{ emailAddress: { name: toGraphUser.displayName, address: toGraphUser.mail } }],
    ccRecipients: [],
    bccRecipients: [],
    isRead: false,
    isDraft: false,
    importance: 'normal',
    hasAttachments: false,
    receivedDateTime: now,
    sentDateTime: now,
    createdDateTime: now,
    lastModifiedDateTime: now,
    conversationId: randomUUID(),
    internetMessageId: `<${randomUUID()}@mock.local>`,
    parentFolderId: `${toGraphUser.id}:folder:Inbox`,
    _ownerId: toGraphUser.id,
  };
  await store.setEntity('graph', tenant, `message:${toGraphUser.id}`, msg.id, msg);
}

export async function onAbsenceApproved(tenant, worker, absenceRequest) {
  await seedGraph(tenant);
  const graphUserId = worker._graphId;
  if (!graphUserId) return;

  const now = new Date().toISOString();

  // 1. Create OOF calendar event in Graph
  const event = {
    id: randomUUID(),
    subject: `Out of Office — ${absenceRequest.type?.descriptor ?? 'Leave'}`,
    body: { contentType: 'text', content: `Auto-generated OOF for approved absence (${absenceRequest.startDate} → ${absenceRequest.endDate}).` },
    start: { dateTime: `${absenceRequest.startDate}T00:00:00`, timeZone: 'Europe/London' },
    end:   { dateTime: `${absenceRequest.endDate}T23:59:59`, timeZone: 'Europe/London' },
    location: { displayName: 'Out of Office' },
    attendees: [],
    organizer: { emailAddress: { name: worker.descriptor, address: worker.primaryWorkEmail } },
    isAllDay: true,
    isCancelled: false,
    isOnlineMeeting: false,
    showAs: 'oof',
    sensitivity: 'normal',
    importance: 'normal',
    responseStatus: { response: 'organizer', time: now },
    recurrence: null,
    createdDateTime: now,
    lastModifiedDateTime: now,
    iCalUId: randomUUID(),
    webUrl: `https://teams.microsoft.com/mock/meeting/${randomUUID()}`,
    categories: [],
    _ownerId: graphUserId,
  };

  await store.setEntity('graph', tenant, `event:${graphUserId}`, event.id, event);

  // 2. Send notification emails
  const workerGraph = await findGraphUserByEmail(tenant, worker.primaryWorkEmail);
  const mgrWorker = worker.manager
    ? await store.getEntity('workday', tenant, 'worker', worker.manager.id)
    : null;
  const mgrGraph = mgrWorker ? await findGraphUserByEmail(tenant, mgrWorker.primaryWorkEmail) : null;

  if (workerGraph) {
    await deliverMail(
      tenant,
      mgrGraph ?? workerGraph,
      workerGraph,
      `Your ${absenceRequest.type?.descriptor ?? 'leave'} request has been approved`,
      `Hi ${workerGraph.givenName ?? worker.descriptor},\n\nYour ${absenceRequest.type?.descriptor ?? 'leave'} request from ${absenceRequest.startDate} to ${absenceRequest.endDate} has been approved.\n\nAn out-of-office event has been added to your calendar.\n\nHR Bot`
    );
  }

  if (mgrGraph) {
    await deliverMail(
      tenant,
      workerGraph ?? mgrGraph,
      mgrGraph,
      `${worker.descriptor}'s ${absenceRequest.type?.descriptor ?? 'leave'} request approved`,
      `Hi ${mgrGraph.givenName ?? mgrWorker.descriptor},\n\n${worker.descriptor}'s ${absenceRequest.type?.descriptor ?? 'leave'} request from ${absenceRequest.startDate} to ${absenceRequest.endDate} has been approved.\n\nHR Bot`
    );
  }
}
