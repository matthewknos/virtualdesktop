/**
 * Canonical people & org chart. Deterministic — same tenant name → same people.
 * No external dependencies. All IDs are derived from tenant + person index.
 */

import { randomUUID } from 'crypto';

// Seed of realistic names, roles, departments
const PEOPLE_TEMPLATES = [
  { first: 'Alice',   last: 'Harrington', title: 'HR Business Partner',      dept: 'Human Resources',   mgr: 9 },
  { first: 'Ben',     last: 'Carter',     title: 'Software Engineer',         dept: 'Engineering',       mgr: 8 },
  { first: 'Clara',   last: 'Osei',       title: 'Product Manager',           dept: 'Product',           mgr: 7 },
  { first: 'Daniel',  last: 'Walsh',      title: 'Data Analyst',              dept: 'Data & Analytics',  mgr: 9 },
  { first: 'Emma',    last: 'Singh',      title: 'Finance Manager',           dept: 'Finance',           mgr: 10 },
  { first: 'Finn',    last: 'Doyle',      title: 'Senior Software Engineer',  dept: 'Engineering',       mgr: 8 },
  { first: 'Grace',   last: 'Ng',         title: 'UX Designer',               dept: 'Product',           mgr: 7 },
  { first: 'Harry',   last: 'Evans',      title: 'Engineering Director',      dept: 'Engineering',       mgr: 10 },
  { first: 'Isabel',  last: 'Patel',      title: 'HR Director',               dept: 'Human Resources',   mgr: 10 },
  { first: 'James',   last: 'McCormick',  title: 'Chief Executive Officer',   dept: 'Executive',         mgr: null },
  { first: 'Kate',    last: 'Bergman',    title: 'Recruiter',                 dept: 'Human Resources',   mgr: 9 },
  { first: 'Liam',    last: 'Okafor',     title: 'DevOps Engineer',           dept: 'Engineering',       mgr: 8 },
  { first: 'Maya',    last: 'Chen',       title: 'Finance Analyst',           dept: 'Finance',           mgr: 5 },
  { first: 'Noah',    last: 'Johansson',  title: 'Software Engineer',         dept: 'Engineering',       mgr: 8 },
  { first: 'Olivia',  last: 'Murphy',     title: 'Marketing Manager',         dept: 'Marketing',         mgr: 10 },
];

function deterministicUUID(seed) {
  // Simple deterministic ID from a seed string (not crypto-secure, just stable)
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = (4294967296 * (2097151 & h2) + (h1 >>> 0));
  // Format as UUID
  const s = n.toString(16).padStart(12, '0').slice(0, 12);
  const s2 = (n ^ 0xabcdef12).toString(16).padStart(12, '0').slice(0, 12);
  return `${s.slice(0,8)}-${s.slice(0,4)}-4${s.slice(1,4)}-a${s2.slice(0,3)}-${s2.slice(0,12)}`;
}

function deterministicWID(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0').repeat(4).slice(0, 32);
}

function hireDateFor(tenant, idx) {
  // Spread hire dates over last 5 years
  const base = new Date('2021-01-15');
  base.setDate(base.getDate() + idx * 83 + (tenant.charCodeAt(0) || 0) * 7);
  return base.toISOString().split('T')[0];
}

export function buildIdentity(tenant) {
  const people = PEOPLE_TEMPLATES.map((tmpl, idx) => {
    const domain = `${tenant.replace(/[^a-z0-9]/gi, '').toLowerCase()}.test`;
    const email = `${tmpl.first.toLowerCase()}.${tmpl.last.toLowerCase()}@${domain}`;
    const graphId = deterministicUUID(`${tenant}:user:${idx}`);
    const wid = deterministicWID(`${tenant}:worker:${idx}`);
    const hireDate = hireDateFor(tenant, idx);
    return {
      index: idx,
      // core identity
      first: tmpl.first,
      last: tmpl.last,
      displayName: `${tmpl.first} ${tmpl.last}`,
      email,
      domain,
      title: tmpl.title,
      department: tmpl.dept,
      managerIndex: tmpl.mgr !== null ? tmpl.mgr - 1 : null, // mgr is 1-based in template
      hireDate,
      // system IDs
      graphId,
      wid,
      graphUPN: email,
    };
  });

  // Resolve manager references
  people.forEach(p => {
    if (p.managerIndex !== null && people[p.managerIndex]) {
      p.managerGraphId = people[p.managerIndex].graphId;
      p.managerWid = people[p.managerIndex].wid;
      p.managerDisplayName = people[p.managerIndex].displayName;
    }
  });

  return people;
}

export function buildOrgs(tenant, people) {
  const depts = [...new Set(people.map(p => p.department))];
  return depts.map((dept, i) => {
    const manager = people.find(p => p.department === dept && p.managerIndex !== null
      && (people[p.managerIndex]?.department !== dept || p.title.toLowerCase().includes('director') || p.title.toLowerCase().includes('chief')));
    return {
      id: deterministicWID(`${tenant}:org:${dept}`),
      descriptor: dept,
      name: dept,
      code: dept.replace(/\s+/g, '_').toUpperCase().slice(0, 12),
      primaryPosition: manager ? { id: deterministicWID(`${tenant}:pos:${manager.index}`), descriptor: manager.title } : null,
      superiorOrganization: null,
      inactive: false,
    };
  });
}
