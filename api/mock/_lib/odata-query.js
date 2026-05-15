/**
 * OData query engine for Graph mock.
 * Supports: $filter (eq, ne, gt, ge, lt, le, and, or, not, contains, startswith, endswith)
 *           $select, $top, $skip, $orderby, $count, $search
 */

// ── $filter parser ─────────────────────────────────────────────────────────

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }
    if (expr[i] === "'") {
      let j = i + 1;
      while (j < expr.length && !(expr[j] === "'" && expr[j+1] !== "'")) j++;
      tokens.push({ type: 'string', value: expr.slice(i+1, j).replace(/''/g, "'") });
      i = j + 1;
      continue;
    }
    if (expr[i] === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (expr[i] === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (expr[i] === ',') { tokens.push({ type: 'comma' }); i++; continue; }
    // number
    const numMatch = expr.slice(i).match(/^-?\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push({ type: 'number', value: parseFloat(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    // word/keyword
    const wordMatch = expr.slice(i).match(/^[\w./@*/]+/);
    if (wordMatch) {
      tokens.push({ type: 'word', value: wordMatch[0] });
      i += wordMatch[0].length;
      continue;
    }
    i++;
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }
  function word() { return peek()?.type === 'word' ? consume().value : null; }

  function parseOr() {
    let left = parseAnd();
    while (peek()?.type === 'word' && peek().value.toLowerCase() === 'or') {
      consume();
      const right = parseAnd();
      left = { op: 'or', left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek()?.type === 'word' && peek().value.toLowerCase() === 'and') {
      consume();
      const right = parseNot();
      left = { op: 'and', left, right };
    }
    return left;
  }

  function parseNot() {
    if (peek()?.type === 'word' && peek().value.toLowerCase() === 'not') {
      consume();
      return { op: 'not', operand: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) return null;
    if (t.type === 'lparen') {
      consume();
      const expr = parseOr();
      if (peek()?.type === 'rparen') consume();
      return expr;
    }
    // function call: contains(field,'x'), startswith, endswith
    if (t.type === 'word') {
      const fn = t.value.toLowerCase();
      if (['contains','startswith','endswith'].includes(fn)) {
        consume();
        if (peek()?.type === 'lparen') consume();
        const field = consume().value;
        if (peek()?.type === 'comma') consume();
        const val = consume().value;
        if (peek()?.type === 'rparen') consume();
        return { op: fn, field, value: val };
      }
      // comparison: field op value
      const field = consume().value;
      const op = word()?.toLowerCase();
      const valToken = consume();
      let value = valToken?.value;
      if (valToken?.value === 'true') value = true;
      else if (valToken?.value === 'false') value = false;
      else if (valToken?.value === 'null') value = null;
      return { op, field, value };
    }
    return null;
  }

  return parseOr();
}

function getField(item, path) {
  return path.split('/').reduce((obj, key) => (obj != null ? obj[key] : undefined), item);
}

function evalNode(node, item) {
  if (!node) return true;
  const { op } = node;

  if (op === 'and') return evalNode(node.left, item) && evalNode(node.right, item);
  if (op === 'or')  return evalNode(node.left, item) || evalNode(node.right, item);
  if (op === 'not') return !evalNode(node.operand, item);

  const itemVal = getField(item, node.field);
  const cmpVal  = node.value;

  if (op === 'eq') return String(itemVal).toLowerCase() === String(cmpVal).toLowerCase() || itemVal == cmpVal;
  if (op === 'ne') return itemVal != cmpVal;
  if (op === 'gt') return itemVal > cmpVal;
  if (op === 'ge') return itemVal >= cmpVal;
  if (op === 'lt') return itemVal < cmpVal;
  if (op === 'le') return itemVal <= cmpVal;
  if (op === 'contains')   return String(itemVal ?? '').toLowerCase().includes(String(cmpVal).toLowerCase());
  if (op === 'startswith') return String(itemVal ?? '').toLowerCase().startsWith(String(cmpVal).toLowerCase());
  if (op === 'endswith')   return String(itemVal ?? '').toLowerCase().endsWith(String(cmpVal).toLowerCase());
  return true;
}

export function applyFilter(items, filterExpr) {
  if (!filterExpr) return items;
  let tree;
  try { tree = parse(tokenize(filterExpr)); } catch { return items; }
  return items.filter(item => evalNode(tree, item));
}

// ── $search ────────────────────────────────────────────────────────────────

export function applySearch(items, searchExpr, searchableFields = []) {
  if (!searchExpr) return items;
  const q = searchExpr.replace(/^"|"$/g, '').toLowerCase();
  if (!q) return items;
  return items.filter(item =>
    searchableFields.some(f => String(getField(item, f) ?? '').toLowerCase().includes(q))
  );
}

// ── $select ────────────────────────────────────────────────────────────────

export function applySelect(items, selectExpr) {
  if (!selectExpr) return items;
  const fields = selectExpr.split(',').map(f => f.trim());
  return items.map(item => {
    const out = {};
    for (const f of fields) if (f in item) out[f] = item[f];
    // always include id-like fields
    if (!out.id && item.id) out.id = item.id;
    return out;
  });
}

// ── $orderby ───────────────────────────────────────────────────────────────

export function applyOrderBy(items, orderByExpr) {
  if (!orderByExpr) return items;
  const parts = orderByExpr.split(',').map(s => {
    const [field, dir = 'asc'] = s.trim().split(/\s+/);
    return { field, desc: dir.toLowerCase() === 'desc' };
  });
  return [...items].sort((a, b) => {
    for (const { field, desc } of parts) {
      const av = getField(a, field) ?? '';
      const bv = getField(b, field) ?? '';
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
    }
    return 0;
  });
}

// ── $top / $skip ───────────────────────────────────────────────────────────

export function applyPaging(items, top, skip) {
  const s = Math.max(0, parseInt(skip) || 0);
  const t = Math.min(999, Math.max(1, parseInt(top) || 100));
  return { page: items.slice(s, s + t), total: items.length, skip: s, top: t };
}

// ── Main apply function ────────────────────────────────────────────────────

export function applyODataQuery(items, params, entityDef = {}) {
  let result = [...items];

  if (params.$search) {
    result = applySearch(result, params.$search, entityDef.searchableFields ?? []);
  }
  if (params.$filter) {
    result = applyFilter(result, params.$filter);
  }
  if (params.$orderby) {
    result = applyOrderBy(result, params.$orderby);
  } else if (entityDef.defaultOrderBy) {
    result = applyOrderBy(result, entityDef.defaultOrderBy);
  }

  const count = result.length;
  const { page, total, skip, top } = applyPaging(result, params.$top, params.$skip);

  let nextLink = null;
  if (skip + top < total) {
    nextLink = { skip: skip + top, top };
  }

  let page2 = page;
  if (params.$select) page2 = applySelect(page, params.$select);

  return { items: page2, count, nextLink };
}

// ── Workday query helper ───────────────────────────────────────────────────

export function applyWorkdayQuery(items, params, entityDef = {}) {
  let result = [...items];

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(item =>
      Object.values(item).some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }

  // Date range filters (fromDate/toDate on a dateField)
  const dateField = entityDef.dateField;
  if (dateField) {
    if (params.fromDate) result = result.filter(i => (getField(i, dateField) ?? '') >= params.fromDate);
    if (params.toDate)   result = result.filter(i => (getField(i, dateField) ?? '') <= params.toDate);
  }

  // Status filter
  if (params.status) {
    result = result.filter(i => i.status === params.status || i.workerStatus?.descriptor === params.status);
  }

  const total = result.length;
  const offset = Math.max(0, parseInt(params.offset) || 0);
  const limit  = Math.min(100, Math.max(1, parseInt(params.limit) || 100));
  const page   = result.slice(offset, offset + limit);

  return { items: page, total, hasMore: offset + limit < total };
}
