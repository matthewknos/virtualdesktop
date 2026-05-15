/**
 * Validates inbound request bodies against entity schemas.
 * Phase 1: required-field checking + basic type coercion.
 * Phase 2+: full JSON Schema validation.
 */

export function validateBody(body, entityDef, operation = 'create') {
  const errors = [];

  if (operation === 'create') {
    const required = entityDef.createRequired ?? [];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push({ field, message: `'${field}' is required.` });
      }
    }
  }

  const schema = entityDef.schema ?? {};
  const props = schema.properties ?? {};
  for (const [field, def] of Object.entries(props)) {
    if (def.readOnly && body[field] !== undefined) {
      // Don't error on read-only — silently strip when writing
    }
    const val = body[field];
    if (val === undefined) continue;
    if (def.type && !checkType(val, def.type)) {
      errors.push({ field, message: `'${field}' must be of type ${JSON.stringify(def.type)}.` });
    }
    if (def.enum && !def.enum.includes(val) && val !== null) {
      errors.push({ field, message: `'${field}' must be one of: ${def.enum.join(', ')}.` });
    }
    if (def.minimum !== undefined && typeof val === 'number' && val < def.minimum) {
      errors.push({ field, message: `'${field}' must be >= ${def.minimum}.` });
    }
    if (def.maximum !== undefined && typeof val === 'number' && val > def.maximum) {
      errors.push({ field, message: `'${field}' must be <= ${def.maximum}.` });
    }
  }

  return errors;
}

function checkType(val, types) {
  const typeList = Array.isArray(types) ? types : [types];
  return typeList.some(t => {
    if (t === 'null') return val === null;
    if (t === 'string') return typeof val === 'string';
    if (t === 'number') return typeof val === 'number';
    if (t === 'integer') return Number.isInteger(val);
    if (t === 'boolean') return typeof val === 'boolean';
    if (t === 'array') return Array.isArray(val);
    if (t === 'object') return typeof val === 'object' && val !== null && !Array.isArray(val);
    return true;
  });
}

export function stripReadOnly(body, entityDef) {
  const schema = entityDef.schema ?? {};
  const props = schema.properties ?? {};
  const out = { ...body };
  for (const [field, def] of Object.entries(props)) {
    if (def.readOnly) delete out[field];
  }
  return out;
}

export function applyDefaults(body, entityDef, operation = 'create') {
  if (operation !== 'create') return body;
  const defaults = entityDef.createDefaults ?? {};
  const result = { ...body };
  for (const [field, val] of Object.entries(defaults)) {
    if (result[field] === undefined) result[field] = val;
  }
  return result;
}
