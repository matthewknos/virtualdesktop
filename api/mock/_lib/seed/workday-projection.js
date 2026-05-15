/**
 * Projects canonical identity into Workday entities and seeds the store.
 */

import { buildIdentity, buildOrgs } from './identity.js';
import { store } from '../store.js';
import { randomUUID } from 'crypto';

function today() { return new Date().toISOString().split('T')[0]; }
function pastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}
function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}
function isoNow() { return new Date().toISOString(); }

function deterministicWID(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16).padStart(8, '0').repeat(4).slice(0, 32);
}

const CURRENCIES = [{ id: 'GBP', descriptor: 'British Pound Sterling' }];
const FREQ = { id: 'Annual', descriptor: 'Annual' };
const LEAVE_TYPES = [
  { id: 'ANNUAL_LEAVE', descriptor: 'Annual Leave' },
  { id: 'SICK_LEAVE', descriptor: 'Sick Leave' },
  { id: 'PERSONAL_LEAVE', descriptor: 'Personal Leave' },
];

export async function seedWorkday(tenant) {
  if (await store.isSeeded('workday', tenant)) return;

  const people = buildIdentity(tenant);
  const orgs = buildOrgs(tenant, people);

  await store.bulkSet('workday', tenant, 'supervisoryOrganization', orgs);

  // ── Workers ───────────────────────────────────────────────────────────
  const workers = people.map(p => {
    const org = orgs.find(o => o.descriptor === p.department) ?? orgs[0];
    const manager = p.managerIndex !== null ? people[p.managerIndex] : null;
    return {
      id: p.wid,
      descriptor: p.displayName,
      href: `/ccx/api/v1/workers/${p.wid}`,
      workerType: { id: 'Employee', descriptor: 'Employee' },
      workerStatus: { id: 'Active', descriptor: 'Active' },
      primaryWorkEmail: p.email,
      primaryWorkPhone: `+44 20 7946 ${String(1000 + p.index).slice(1)}`,
      businessTitle: p.title,
      managementLevel: { id: p.title.includes('Director') || p.title.includes('Chief') ? 'Director' : 'Individual Contributor', descriptor: p.title.includes('Director') || p.title.includes('Chief') ? 'Director' : 'Individual Contributor' },
      location: { id: 'LOC_LONDON', descriptor: 'London HQ' },
      supervisoryOrganization: { id: org.id, descriptor: org.descriptor, href: `/ccx/api/v1/supervisoryOrganizations/${org.id}` },
      manager: manager ? { id: manager.wid, descriptor: manager.displayName, href: `/ccx/api/v1/workers/${manager.wid}` } : null,
      hireDate: p.hireDate,
      continuousServiceDate: p.hireDate,
      endDate: null,
      primaryPosition: { id: deterministicWID(`${tenant}:pos:${p.index}`), descriptor: p.title },
      // cross-system link
      _graphId: p.graphId,
    };
  });

  await store.bulkSet('workday', tenant, 'worker', workers);

  // ── Positions ─────────────────────────────────────────────────────────
  for (const p of people) {
    const position = {
      id: deterministicWID(`${tenant}:pos:${p.index}`),
      descriptor: p.title,
      href: `/ccx/api/v1/workers/${p.wid}/positions/${deterministicWID(`${tenant}:pos:${p.index}`)}`,
      jobProfile: { id: p.title.replace(/\s+/g, '_').toUpperCase(), descriptor: p.title },
      jobFamily: { id: p.department.replace(/\s+/g, '_').toUpperCase(), descriptor: p.department },
      businessTitle: p.title,
      location: { id: 'LOC_LONDON', descriptor: 'London HQ' },
      startDate: p.hireDate,
      endDate: null,
      isPrimary: true,
      fullTimeEquivalent: 1.0,
      supervisoryOrganization: { id: deterministicWID(`${tenant}:org:${p.department}`), descriptor: p.department },
      _workerId: p.wid,
    };
    await store.bulkSet('workday', tenant, `position:${p.wid}`, [position]);
  }

  // ── Time entries (last 2 weeks of entries, most submitted) ─────────────
  for (const person of people) {
    const timeEntries = [];
    for (let daysAgo = 14; daysAgo >= 1; daysAgo--) {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      const isSubmitted = daysAgo > 5;
      const entryId = deterministicWID(`${tenant}:te:${person.index}:${daysAgo}`);
      timeEntries.push({
        id: entryId,
        descriptor: `${person.displayName} – ${d.toISOString().split('T')[0]}`,
        href: `/ccx/api/v1/workers/${person.wid}/timeEntries/${entryId}`,
        date: d.toISOString().split('T')[0],
        hours: 8,
        timeType: { id: 'REGULAR_HOURS', descriptor: 'Regular Hours' },
        project: null,
        projectPhase: null,
        comment: null,
        status: isSubmitted ? 'Approved' : 'Draft',
        submittedDateTime: isSubmitted ? new Date(d.getTime() + 9 * 3600 * 1000).toISOString() : null,
        approvedDateTime: isSubmitted ? new Date(d.getTime() + 25 * 3600 * 1000).toISOString() : null,
        lastModifiedDateTime: isoNow(),
        worker: { id: person.wid, descriptor: person.displayName },
        _workerId: person.wid,
      });
    }
    await store.bulkSet('workday', tenant, `timeEntry:${person.wid}`, timeEntries);
  }

  // ── Timesheets (weekly, last 4 weeks) ─────────────────────────────────
  for (const person of people) {
    const timesheets = [];
    for (let weekAgo = 0; weekAgo < 4; weekAgo++) {
      const monday = getMonday(weekAgo);
      const friday = new Date(monday);
      friday.setDate(friday.getDate() + 4);
      const sheetId = deterministicWID(`${tenant}:ts:${person.index}:${weekAgo}`);
      timesheets.push({
        id: sheetId,
        descriptor: `Week of ${monday.toISOString().split('T')[0]}`,
        href: `/ccx/api/v1/workers/${person.wid}/timesheets/${sheetId}`,
        periodStart: monday.toISOString().split('T')[0],
        periodEnd: friday.toISOString().split('T')[0],
        totalHours: weekAgo > 0 ? 40 : 24, // current week partial
        status: weekAgo > 0 ? 'Approved' : 'Open',
        worker: { id: person.wid, descriptor: person.displayName },
        entries: [],
        _workerId: person.wid,
      });
    }
    await store.bulkSet('workday', tenant, `timesheet:${person.wid}`, timesheets);
  }

  // ── Time-off balances ─────────────────────────────────────────────────
  for (const person of people) {
    const balances = [];
    for (const lt of LEAVE_TYPES) {
      const balId = deterministicWID(`${tenant}:bal:${person.index}:${lt.id}`);
      const accrued = lt.id === 'ANNUAL_LEAVE' ? 25 : lt.id === 'SICK_LEAVE' ? 10 : 3;
      const taken   = lt.id === 'ANNUAL_LEAVE' ? (person.index % 5) * 3 : 0;
      balances.push({
        id: balId,
        descriptor: `${lt.descriptor} Balance`,
        href: `/ccx/api/v1/workers/${person.wid}/timeOffBalances/${balId}`,
        type: lt,
        balance: accrued - taken,
        unit: 'Days',
        asOfDate: today(),
        accrued,
        taken,
        pending: 0,
        forfeited: 0,
        _workerId: person.wid,
      });
    }
    await store.bulkSet('workday', tenant, `timeOffBalance:${person.wid}`, balances);
  }

  // ── Absence requests (a few example ones) ────────────────────────────
  for (const person of people.slice(0, 5)) {
    const reqId = deterministicWID(`${tenant}:abs:${person.index}`);
    const absenceRequest = {
      id: reqId,
      descriptor: `Annual Leave – ${person.displayName}`,
      href: `/ccx/api/v1/workers/${person.wid}/absenceRequests/${reqId}`,
      type: LEAVE_TYPES[0],
      status: 'Approved',
      startDate: pastDate(14 - person.index * 2),
      endDate: pastDate(10 - person.index * 2),
      totalDays: 4,
      comment: 'Summer holiday',
      denialReason: null,
      worker: { id: person.wid, descriptor: person.displayName },
      approver: people[person.managerIndex ?? 9] ? { id: people[person.managerIndex ?? 9].wid, descriptor: people[person.managerIndex ?? 9].displayName } : null,
      submittedDateTime: new Date(Date.now() - 20 * 86400000).toISOString(),
      approvedDateTime: new Date(Date.now() - 18 * 86400000).toISOString(),
      createdDateTime: new Date(Date.now() - 21 * 86400000).toISOString(),
      lastModifiedDateTime: isoNow(),
      _workerId: person.wid,
    };
    await store.bulkSet('workday', tenant, `absenceRequest:${person.wid}`, [absenceRequest]);
  }

  // ── Compensation ──────────────────────────────────────────────────────
  for (const p of people) {
    const salary = p.title.includes('Director') ? 120000 : p.title.includes('Chief') ? 180000 : p.title.includes('Manager') ? 80000 : 65000;
    const compId = deterministicWID(`${tenant}:comp:${p.index}`);
    const compensation = {
      id: compId,
      descriptor: `${p.displayName} Compensation`,
      href: `/ccx/api/v1/workers/${p.wid}/compensation`,
      effectiveDate: p.hireDate,
      salary,
      currency: CURRENCIES[0],
      frequency: FREQ,
      grade: { id: `G${5 + (salary > 100000 ? 4 : salary > 75000 ? 2 : 0)}`, descriptor: `Grade ${5 + (salary > 100000 ? 4 : salary > 75000 ? 2 : 0)}` },
      compensationPlan: { id: 'STANDARD_SALARY', descriptor: 'Standard Salary Plan' },
      worker: { id: p.wid, descriptor: p.displayName },
      _workerId: p.wid,
    };
    await store.bulkSet('workday', tenant, `compensation:${p.wid}`, [compensation]);
  }

  await store.markSeeded('workday', tenant);
}

function getMonday(weeksAgo) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust for Sunday
  d.setDate(diff - weeksAgo * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
