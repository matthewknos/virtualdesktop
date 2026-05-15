/**
 * Loads compact tier1.json specs and builds an entity + path registry.
 * Cached in module scope — parsed once per warm function instance.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

let _graphSpec = null;
let _workdaySpec = null;

function load(system) {
  const path = join(__dir, '..', '_specs', system, 'tier1.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to load ${system} spec: ${e.message}`);
  }
}

export function getGraphSpec() {
  if (!_graphSpec) _graphSpec = load('graph');
  return _graphSpec;
}

export function getWorkdaySpec() {
  if (!_workdaySpec) _workdaySpec = load('workday');
  return _workdaySpec;
}

/**
 * Build a lookup map from URL path template → { entityName, entityDef, relation, params, methods }.
 * Params are path segment names, e.g. { userId: 'user', messageId: 'message' }.
 */
function buildPathRegistry(spec) {
  const registry = [];

  const entities = spec.entities ?? {};
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const templates = entityDef.pathTemplates ?? [];
    for (const tmpl of templates) {
      registry.push({
        entityName,
        entityDef,
        pattern: tmpl.path,
        methods: tmpl.methods,
        relation: tmpl.relation,
        params: tmpl.params ?? {},
        ownerEntity: tmpl.ownerEntity ?? null,
        parentParam: tmpl.parentParam ?? null,
        parentEntity: tmpl.parentEntity ?? null,
        regex: pathToRegex(tmpl.path),
      });
    }

    // navigation properties as paths
    const navProps = entityDef.navigationProperties ?? {};
    for (const [navName, navDef] of Object.entries(navProps)) {
      registry.push({
        entityName: navDef.entity,
        entityDef: entities[navDef.entity] ?? { idField: 'id' },
        pattern: navDef.path,
        methods: ['GET'],
        relation: navDef.cardinality,
        params: {},
        navigationFor: entityName,
        navigationName: navName,
        regex: pathToRegex(navDef.path),
      });
    }

    // inline actions
    const actions = entityDef.actions ?? [];
    for (const action of actions) {
      registry.push({
        entityName,
        entityDef,
        pattern: action.path,
        methods: [action.method],
        relation: 'action',
        actionHandler: action.handler,
        regex: pathToRegex(action.path),
      });
    }
  }

  // standalone actions (e.g. sendMail)
  const standaloneActions = spec.standaloneActions ?? [];
  for (const action of standaloneActions) {
    registry.push({
      entityName: null,
      entityDef: null,
      pattern: action.path,
      methods: [action.method],
      relation: 'action',
      actionHandler: action.handler,
      regex: pathToRegex(action.path),
    });
  }

  // Sort most-specific first so /v1.0/me/messages beats /v1.0/me.
  registry.sort((a, b) => pathSpecificity(b.pattern) - pathSpecificity(a.pattern));
  return registry;
}

function templateToEscaped(template) {
  // Build regex-safe string from a path template like /v1.0/users/{userId}.
  // Order: replace params with placeholder → escape regex chars → restore placeholder as capture group.
  return template
    .replace(/\{[^}]+\}/g, '\x00')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\x00/g, '([^/?]+)');
}

function pathToRegex(template) {
  // Exact match: no trailing path segments allowed (only optional query string).
  return new RegExp(`^${templateToEscaped(template)}(?:\\?.*)?$`);
}

function pathSpecificity(template) {
  // More path segments = higher specificity; fewer wildcards = higher specificity.
  const segments = template.split('/').length;
  const wildcards = (template.match(/\{[^}]+\}/g) ?? []).length;
  return segments * 10 - wildcards;
}

export function extractPathParams(template, path) {
  const paramNames = [...template.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
  if (paramNames.length === 0) return {};
  const m = path.match(new RegExp(`^${templateToEscaped(template)}(?:\\?.*)?$`));
  if (!m) return {};
  const result = {};
  paramNames.forEach((name, i) => { result[name] = m[i + 1]; });
  return result;
}

let _graphRegistry = null;
let _workdayRegistry = null;

export function getGraphRegistry() {
  if (!_graphRegistry) _graphRegistry = buildPathRegistry(getGraphSpec());
  return _graphRegistry;
}

export function getWorkdayRegistry() {
  if (!_workdayRegistry) _workdayRegistry = buildPathRegistry(getWorkdaySpec());
  return _workdayRegistry;
}

export function matchPath(registry, path, method) {
  for (const entry of registry) {
    if (!entry.methods.includes(method.toUpperCase())) continue;
    if (entry.regex.test(path)) {
      const pathParams = extractPathParams(entry.pattern, path);
      return { ...entry, pathParams };
    }
  }
  return null;
}

export function getRaasReports() {
  const spec = getWorkdaySpec();
  return spec.raasReports ?? [];
}
