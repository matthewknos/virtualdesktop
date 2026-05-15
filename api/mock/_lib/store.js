/**
 * KV-backed store with in-memory fallback that persists to disk.
 * Key schema:
 *   mock:{system}:{tenant}:{entityType}:{id}       entity record
 *   mock:{system}:{tenant}:{entityType}:_index      JSON array of IDs
 *   mock:{system}:{tenant}:_meta                    tenant metadata + settings
 *   mock:{system}:{tenant}:_seeded                  '1' when seed has been applied
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const DATA_FILE = resolve(process.cwd(), '.mock-store.json');
const inMemory = new Map();
let kv = null;

function loadFromDisk() {
  if (existsSync(DATA_FILE)) {
    try {
      const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        inMemory.set(k, v);
      }
    } catch { /* ignore corrupt file */ }
  }
}

function saveToDisk() {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(inMemory), null, 2));
  } catch { /* ignore write errors */ }
}

// Hydrate on module load so data survives vercel dev function reloads
loadFromDisk();

async function getKV() {
  if (kv) return kv;
  try {
    const { kv: _kv } = await import('@vercel/kv');
    kv = _kv;
  } catch {
    kv = null;
  }
  return kv;
}

function memKey(key) { return key; }

async function kvGet(key) {
  const store = await getKV();
  if (store) {
    try { return await store.get(key); } catch { /* fall through */ }
  }
  const v = inMemory.get(memKey(key));
  return v === undefined ? null : v;
}

async function kvSet(key, value) {
  const store = await getKV();
  if (store) {
    try { await store.set(key, value); return; } catch { /* fall through */ }
  }
  inMemory.set(memKey(key), value);
  saveToDisk();
}

async function kvDel(key) {
  const store = await getKV();
  if (store) {
    try { await store.del(key); return; } catch { /* fall through */ }
  }
  inMemory.delete(memKey(key));
  saveToDisk();
}

async function kvKeys(pattern) {
  const store = await getKV();
  if (store) {
    try {
      const keys = [];
      let cursor = 0;
      do {
        const [next, batch] = await store.scan(cursor, { match: pattern, count: 200 });
        keys.push(...batch);
        cursor = next;
      } while (cursor !== 0);
      return keys;
    } catch { /* fall through */ }
  }
  const prefix = pattern.replace('*', '');
  return [...inMemory.keys()].filter(k => k.startsWith(prefix));
}

// ── Public API ─────────────────────────────────────────────────────────────

function entityKey(system, tenant, type, id) {
  return `mock:${system}:${tenant}:${type}:${id}`;
}
function indexKey(system, tenant, type) {
  return `mock:${system}:${tenant}:${type}:_index`;
}
function metaKey(system, tenant) {
  return `mock:${system}:${tenant}:_meta`;
}
function seededKey(system, tenant) {
  return `mock:${system}:${tenant}:_seeded`;
}

export const store = {
  async isSeeded(system, tenant) {
    return !!(await kvGet(seededKey(system, tenant)));
  },

  async markSeeded(system, tenant) {
    await kvSet(seededKey(system, tenant), '1');
  },

  async getSettings(system, tenant) {
    const meta = await kvGet(metaKey(system, tenant));
    return meta?.settings ?? {};
  },

  async updateSettings(system, tenant, settings) {
    const meta = (await kvGet(metaKey(system, tenant))) ?? {};
    meta.settings = { ...(meta.settings ?? {}), ...settings };
    await kvSet(metaKey(system, tenant), meta);
  },

  async getEntity(system, tenant, type, id) {
    return kvGet(entityKey(system, tenant, type, id));
  },

  async setEntity(system, tenant, type, id, entity) {
    await kvSet(entityKey(system, tenant, type, id), entity);
    // update index
    const idx = (await kvGet(indexKey(system, tenant, type))) ?? [];
    if (!idx.includes(id)) {
      idx.push(id);
      await kvSet(indexKey(system, tenant, type), idx);
    }
  },

  async deleteEntity(system, tenant, type, id) {
    await kvDel(entityKey(system, tenant, type, id));
    const idx = (await kvGet(indexKey(system, tenant, type))) ?? [];
    const next = idx.filter(i => i !== id);
    await kvSet(indexKey(system, tenant, type), next);
  },

  async listEntities(system, tenant, type) {
    const idx = (await kvGet(indexKey(system, tenant, type))) ?? [];
    if (idx.length === 0) return [];
    const items = await Promise.all(idx.map(id => kvGet(entityKey(system, tenant, type, id))));
    return items.filter(Boolean);
  },

  async bulkSet(system, tenant, type, entities, idField = 'id') {
    const idx = [];
    await Promise.all(entities.map(async (e) => {
      await kvSet(entityKey(system, tenant, type, e[idField]), e);
      idx.push(e[idField]);
    }));
    const existing = (await kvGet(indexKey(system, tenant, type))) ?? [];
    const merged = [...new Set([...existing, ...idx])];
    await kvSet(indexKey(system, tenant, type), merged);
  },

  async resetTenant(system, tenant) {
    const pattern = `mock:${system}:${tenant}:*`;
    const keys = await kvKeys(pattern);
    await Promise.all(keys.map(k => kvDel(k)));
  },

  async exportTenant(system, tenant) {
    const pattern = `mock:${system}:${tenant}:*`;
    const keys = await kvKeys(pattern);
    const entries = await Promise.all(keys.map(async k => [k, await kvGet(k)]));
    return Object.fromEntries(entries);
  },

  async importTenant(system, tenant, data) {
    await store.resetTenant(system, tenant);
    await Promise.all(Object.entries(data).map(([k, v]) => kvSet(k, v)));
  },
};
