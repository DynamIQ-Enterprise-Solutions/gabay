// route-guard-order (R7, L128; SEC-2 spec AC-41 to AC-48, plan step 4): every mounted route runs its guards in the ruled
// order. The router is the one source of truth: there is no second list of routes. Starting at functions/src/routes/api.js
// (mounted at /api, DC-37), the linter follows each `router.use(path, ...middleware, xRoutes(...))` to the file the call
// names (resolved through the file's own `require`), and so down the whole tree (AC-42). A route's effective chain is the
// middleware of every enclosing mount, outermost first, then its own; its last argument is the handler.
//
// The steps must come in this rank order (PH2 section 7 ruling 6, standard §3.4, SEC-1 section 2.2): 1 auth, 2 tenant
// context, 3 role guard, 4 permission guard, 4b venue scope, 5 validate, then the handler. Any middleware not in the table
// is handler-stage: it must come after every ranked step, so nothing unranked runs before `auth`. A ranked step after a
// higher one, an unranked one before a ranked one, and a missing required step are violations. Required on every route:
// auth, tenant context, permission guard and validate; the role guard also on post, put and delete (standard §3.4); the
// venue scope on a route whose full path holds :venueId (and allowed, never required, elsewhere: the venue list).
//
// It fails closed (AC-44): what it cannot read is a violation naming the line. Route methods are get, post, put and delete
// only: a `patch`, `all` or `route()` registration is refused, because the audit trail covers POST, PUT and DELETE and a
// mutating method outside them would write nothing to it (DC-19). So are a registration in a loop, a spread it cannot
// resolve, a variable path, a mounted router it cannot resolve to a file, and a route file no mount reaches.
//
// Two same-file indirections are read, and nothing else (DC-36): a spread of a `const X = [ ... ]` declared once
// (routes/api.js's tenantChain), and a `const Y = <ranked call>` declared once (routes/lookups.js's canRead).
// A ranked name defined in a route file (a local `requirePermission`) is a violation: the guards come from middleware/.
//
// A public or self-service route is marked on the line directly above its mount or registration:
//     // guard-exempt: <reason>        (a reason is required; the mount's whole subtree is exempt)
// Accepted limit: it reads names, not behaviour, so a guard that does nothing passes; review reads every exemption.
//
// In --files mode (pre-commit) it still reads the whole functions/src/routes tree, and reports the violations whose own
// file, or whose chain of mounting files, is among the staged ones; a staged change to this file reports every route (AC-47).
'use strict';

const path = require('node:path');
const { violation } = require('./lib/context');
const { annotation } = require('./lib/sql');
const { withoutComments } = require('./lib/scan');
const {
  maskCode,
  matchClose,
  splitArgs,
  findCalls,
  literalValue,
  lineIndex,
} = require('./lib/jsCalls');

const NAME = 'route-guard-order';
const TAG = 'guard-exempt';
const ROUTES_DIR = 'functions/src/routes/';
const ROOT_FILE = 'functions/src/routes/api.js';
const ROOT_MOUNT = '/api';
const SELF = 'tools/lint/route-guard-order.js';
const IS_ROUTE_FILE = (f) => f.startsWith(ROUTES_DIR) && f.endsWith('.js');

/** The ranks, from SEC-1's middleware as merged (DC-36): the names a route chain uses. The venue scope is rank 4.5 (4b). */
const RANK_TABLE = Object.freeze({
  auth: 1,
  requireAdminUser: 1,
  tenantContext: 2,
  requireRole: 3,
  roleGuard: 3, // routes/api.js builds it as requireRole(ADMIN_ROLE_CODES)
  requirePermission: 4,
  requireVenueInScope: 4.5,
  venueListScope: 4.5,
  validate: 5,
});
const STEP = Object.freeze({
  1: 'auth',
  2: 'tenantContext',
  3: 'a role guard (requireRole)',
  4: 'a permission guard (requirePermission)',
  4.5: 'the venue scope (requireVenueInScope)',
  5: 'validate',
});
const REQUIRED = [1, 2, 4, 5];
/** The venue-scope step a :venueId route must carry; the list scope is allowed, never required. */
const VENUE_SCOPE = 'requireVenueInScope';
const MUTATING = ['post', 'put', 'delete'];
/** The registration methods read; every other method of a router (patch, all, route, head, options, purge, param...) is refused. */
const READ_METHODS = ['use', 'get', 'post', 'put', 'delete'];
/** How a router is made: express.Router(), new express.Router(), Router() destructured from express, require('express').Router(). */
const ROUTER_MADE = String.raw`(?<![\w$])(?:new\s+)?(?:[\w$]+\s*\.\s*|require\s*\([^)]*\)\s*\.\s*)?Router\s*\(`;
const LOOP_CALLS = /\.\s*(?:forEach|map|flatMap|reduce|filter)\s*\(/g;
const LOOP_KEYWORDS = /\b(?:for|while)\s*\(/g;

const ranked = (name) => Object.hasOwn(RANK_TABLE, name);

/** Everything the linter reads from one route file, once. */
function readFile(ctx, rel, cache) {
  if (cache.has(rel)) return cache.get(rel);
  const src = ctx.read(rel);
  const code = maskCode(src);
  const lineOf = lineIndex(src);
  const info = {
    rel,
    src,
    code,
    lineOf,
    routers: new Set(),
    imports: new Map(),
    arrays: new Map(),
    calls: new Map(),
  };

  const declaration = new RegExp(
    String.raw`(?:const|let|var)\s+([\w$]+)\s*=\s*${ROUTER_MADE}`,
    'g',
  );
  for (const m of code.matchAll(declaration)) info.routers.add(m[1]);
  info.routersMade = [...code.matchAll(new RegExp(ROUTER_MADE, 'g'))].length;
  const uncommented = withoutComments(src, 'js');
  const requireFrom = /require\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/;
  for (const m of uncommented.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\([^)]*\)/g)) {
    const from = requireFrom.exec(m[0]);
    if (!from) continue;
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().trim();
      if (name) info.imports.set(name, from[2]);
    }
  }
  for (const m of uncommented.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*require\([^)]*\)/g)) {
    const from = requireFrom.exec(m[0]);
    if (from) info.imports.set(m[1], from[2]);
  }
  // Same-file indirections (DC-36): a name declared once is resolvable; declared twice it is not.
  const declared = new Map();
  for (const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=/g)) {
    declared.set(m[1], (declared.get(m[1]) ?? 0) + 1);
  }
  for (const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*\[/g)) {
    if (declared.get(m[1]) !== 1) continue;
    const open = m.index + m[0].length - 1;
    const close = matchClose(code, open);
    if (close === -1) continue;
    info.arrays.set(
      m[1],
      splitArgs(code, open, close).map((a) => code.slice(a.start, a.end).trim()),
    );
  }
  for (const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*([\w$]+)\s*\(/g)) {
    if (declared.get(m[1]) === 1) info.calls.set(m[1], m[2]);
  }
  cache.set(rel, info);
  return info;
}

/** The text of a masked argument range. */
const argText = (info, a) => info.code.slice(a.start, a.end).trim();
const argSrc = (info, a) => info.src.slice(a.start, a.end).trim();

/** What one argument of a registration is: a ranked step, an unranked (handler-stage) middleware, or something unreadable. */
function classify(info, text) {
  if (text.startsWith('...')) {
    const name = text.slice(3).trim();
    const items = info.arrays.get(name);
    if (!items)
      return {
        kind: 'unreadable',
        why: `the spread ...${name} cannot be resolved (only a const array declared once in this file is read)`,
      };
    return { kind: 'many', items: items.map((t) => classify(info, t)) };
  }
  const call = /^([\w$.]+)\s*\(/.exec(text);
  if (call) {
    return ranked(call[1])
      ? { kind: 'step', name: call[1], rank: RANK_TABLE[call[1]] }
      : { kind: 'unranked', name: call[1], call: call[1] };
  }
  if (/^[\w$]+$/.test(text)) {
    if (ranked(text)) return { kind: 'step', name: text, rank: RANK_TABLE[text] };
    const callee = info.calls.get(text);
    if (callee && ranked(callee)) return { kind: 'step', name: callee, rank: RANK_TABLE[callee] };
    return { kind: 'unranked', name: text };
  }
  return { kind: 'unranked', name: 'a handler' };
}

/** Flattens `many` items. Returns { items, problems }. */
function flatten(classified) {
  const items = [];
  const problems = [];
  for (const c of classified) {
    if (c.kind === 'many') {
      const inner = flatten(c.items);
      items.push(...inner.items);
      problems.push(...inner.problems);
    } else if (c.kind === 'unreadable') problems.push(c.why);
    else items.push(c);
  }
  return { items, problems };
}

/** The ranges of the loop bodies in a file: a registration inside one is refused (AC-44). */
function loopRanges(code) {
  const ranges = [];
  for (const call of findCalls(code, LOOP_CALLS)) {
    if (call.close !== -1) ranges.push([call.open, call.close]);
  }
  for (const call of findCalls(code, LOOP_KEYWORDS)) {
    if (call.close === -1) continue;
    const brace = /^\s*\{/.exec(code.slice(call.close + 1));
    if (!brace) {
      ranges.push([
        call.close,
        Math.min(code.length, code.indexOf(';', call.close) + 1 || code.length),
      ]);
      continue;
    }
    const open = call.close + 1 + brace[0].length - 1;
    const close = matchClose(code, open);
    if (close !== -1) ranges.push([open, close]);
  }
  return ranges;
}

/**
 * What the file does with its routers that the linter cannot read (AC-44, fail closed): a router that is not assigned to a
 * const, and any use of a router's name other than a member CALL (`router.get(...)`, whose method is checked where the
 * registrations are read), its declaration, or `return router`: an alias (`const r = router`), a computed member
 * (`router['post'](...)`), the router passed to a helper, a property read.
 * @returns {Array<{ line: number, message: string }>}
 */
function routerProblems(info) {
  const problems = [];
  if (info.routersMade !== info.routers.size) {
    problems.push({
      line: 1,
      message:
        'a router is made here that is not assigned to a const (const router = express.Router()): its routes cannot be read',
    });
  }
  for (const name of info.routers) {
    const re = new RegExp(
      String.raw`(?<![\w$.])${name.replace(/\$/g, String.raw`\$`)}(?![\w$])`,
      'g',
    );
    for (const m of info.code.matchAll(re)) {
      const before = info.code.slice(0, m.index);
      const after = info.code.slice(m.index + name.length);
      if (/(?:const|let|var)\s+$/.test(before) && /^\s*=/.test(after)) continue; // its declaration
      if (/\breturn\s+$/.test(before) && /^\s*[;}\n]/.test(after)) continue; // return router
      if (/^\s*\.\s*[\w$]+\s*\(/.test(after)) continue; // a member call: the method is checked at the registration
      problems.push({
        line: info.lineOf(m.index),
        message: `${name} is used in a way that cannot be read (an alias, a computed member, passed to a function, a property read): write ${name}.get(...), ${name}.use(...) and so on, and return ${name}`,
      });
    }
  }
  return problems;
}

/** A ranked name defined in the route file itself (EC-35): it would pass as the real guard. */
function localDefinitions(info) {
  const found = [];
  const re =
    /(?:function\s+([\w$]+)\s*\(|(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>))/g;
  for (const m of info.code.matchAll(re)) {
    const name = m[1] ?? m[2];
    if (ranked(name)) found.push({ name, line: info.lineOf(m.index) });
  }
  return found;
}

const joinPath = (...parts) => {
  const joined = parts
    .filter((p) => p && p !== '/')
    .join('/')
    .replace(/\/{2,}/g, '/');
  return joined.startsWith('/') ? joined : `/${joined}`;
};

/** The problems of one route's chain, as text. */
function chainProblems(method, fullPath, steps) {
  const problems = [];
  let max = 0;
  let maxName = '';
  let unranked = null;
  for (const s of steps) {
    if (s.kind === 'unranked') {
      unranked ??= s.name;
      continue;
    }
    if (s.rank < max) problems.push(`${s.name} must come before ${maxName}`);
    else if (unranked !== null)
      problems.push(
        `${s.name} comes after ${unranked}: nothing unranked may run before a ranked step`,
      );
    if (s.rank > max) {
      max = s.rank;
      maxName = s.name;
    }
  }
  const present = new Set(steps.filter((s) => s.kind === 'step').map((s) => s.rank));
  const required = [...REQUIRED];
  if (MUTATING.includes(method)) required.push(3);
  for (const rank of required.sort((a, b) => a - b)) {
    if (!present.has(rank)) problems.push(`missing ${STEP[rank]}`);
  }
  // A route that names a venue needs requireVenueInScope itself: venueListScope only filters a list (AC-41).
  if (fullPath.includes(':venueId') && !steps.some((s) => s.name === VENUE_SCOPE)) {
    problems.push(`missing ${STEP[4.5]}`);
  }
  return problems;
}

function run(ctx) {
  const routeFiles = ctx.repo(IS_ROUTE_FILE);
  if (routeFiles.length === 0) return [];
  const found = [];
  const cache = new Map();
  const reached = new Set();
  const report = (info, line, message, chainFiles) =>
    found.push({
      ...violation(info.rel, line, NAME, message),
      chainFiles: [info.rel, ...chainFiles],
    });

  if (!routeFiles.includes(ROOT_FILE)) {
    found.push({
      ...violation(
        routeFiles[0],
        1,
        NAME,
        `${ROOT_FILE} is missing: the router tree is read from it (DC-37)`,
      ),
      chainFiles: [routeFiles[0]],
    });
  } else {
    const walk = (rel, prefix, inherited, exempt, chainFiles, stack) => {
      if (stack.includes(rel)) {
        report(readFile(ctx, rel, cache), 1, `${rel} mounts itself (a cycle)`, chainFiles);
        return;
      }
      reached.add(rel);
      const info = readFile(ctx, rel, cache);
      for (const p of routerProblems(info)) report(info, p.line, p.message, [...chainFiles, rel]);
      const loops = loopRanges(info.code);
      const running = new Map([...info.routers].map((r) => [r, []]));
      const names = [...info.routers].map((r) => r.replace(/\$/g, '\\$')).join('|');
      if (names === '') {
        if (!exempt) {
          report(
            info,
            1,
            `${rel} is reached by a mount but no router is recognised in it (const router = express.Router()): its routes cannot be read (AC-44)`,
            [...chainFiles, rel],
          );
        }
        return;
      }
      const calls = findCalls(
        info.code,
        new RegExp(`\\b(${names})\\s*\\.\\s*([\\w$]+)\\s*\\(`, 'g'),
      );
      for (const call of calls) {
        const line = info.lineOf(call.index);
        const [, routerName, method] = call.match;
        const here = [...chainFiles, rel];
        if (call.close === -1) {
          report(
            info,
            line,
            `${routerName}.${method}( is not closed: the registration cannot be read`,
            here,
          );
          continue;
        }
        if (loops.some(([a, b]) => call.index > a && call.index < b)) {
          report(
            info,
            line,
            `${routerName}.${method}(...) is registered inside a loop: write each route out so its chain can be read (AC-44)`,
            here,
          );
          continue;
        }
        if (!READ_METHODS.includes(method)) {
          report(
            info,
            line,
            `${routerName}.${method}(...) is not allowed: routes are get, post, put and delete only, because the audit trail covers POST, PUT and DELETE (DC-19)`,
            here,
          );
          continue;
        }
        const note = annotation(info.src, line, TAG);
        if (note && !note.reason) {
          report(info, line, `// ${TAG}: needs a reason after the colon`, here);
          continue;
        }
        const isExempt = exempt || Boolean(note);
        const args = splitArgs(info.code, call.open, call.close);
        let pathArg = null;
        let rest = args;
        const first = args[0] ? literalValue(argSrc(info, args[0])) : null;
        if (method !== 'use' && first === null) {
          report(
            info,
            line,
            `${routerName}.${method}(...): the path is not a string literal, so the route cannot be read`,
            here,
          );
          continue;
        }
        if (first !== null) {
          pathArg = first;
          rest = args.slice(1);
        }
        const chainSoFar = [...inherited, ...(running.get(routerName) ?? [])];

        if (method === 'use') {
          const lastArg = rest[rest.length - 1];
          const lastCall = lastArg ? /^([\w$]+)\s*\(/.exec(argText(info, lastArg)) : null;
          const target = lastCall ? info.imports.get(lastCall[1]) : undefined;
          const middle = flatten(
            (target ? rest.slice(0, -1) : rest).map((a) => classify(info, argText(info, a))),
          );
          if (target) {
            const resolved = path.posix
              .join(path.posix.dirname(rel), target)
              .replace(/(\.js)?$/, '.js');
            if (!ctx.exists(resolved)) {
              if (!isExempt)
                report(
                  info,
                  line,
                  `${lastCall[1]}(...) is required from ${target}, which does not exist`,
                  here,
                );
              continue;
            }
            if (!IS_ROUTE_FILE(resolved)) {
              if (!isExempt)
                report(
                  info,
                  line,
                  `${lastCall[1]}(...) comes from ${resolved}, which is not a route file`,
                  here,
                );
              continue;
            }
            if (!isExempt) for (const p of middle.problems) report(info, line, p, here);
            walk(
              resolved,
              joinPath(prefix, pathArg),
              [...chainSoFar, ...middle.items],
              isExempt,
              here,
              [...stack, rel],
            );
          } else if (!isExempt) {
            const allSteps =
              middle.items.length > 0 && middle.items.every((s) => s.kind === 'step');
            if (!allSteps || middle.problems.length > 0) {
              report(
                info,
                line,
                `${routerName}.use(...): what is mounted cannot be resolved to a route file or a guard; ${middle.problems[0] ?? 'a router held in a variable or returned by a call it cannot follow is not read'}`,
                here,
              );
            } else if (pathArg !== null) {
              report(
                info,
                line,
                `${routerName}.use('${pathArg}', ...): path-scoped middleware is not read; put the guards in the route's own chain or in a mounted router's chain`,
                here,
              );
            } else {
              running.get(routerName).push(...middle.items);
            }
          } else {
            const items = middle.items;
            if (pathArg === null) running.get(routerName).push(...items);
          }
          continue;
        }

        // get / post / put / delete: the last argument is the handler.
        const fullPath = joinPath(prefix, pathArg === '/' ? '' : pathArg);
        const own = flatten(rest.slice(0, -1).map((a) => classify(info, argText(info, a))));
        if (isExempt) continue;
        if (rest.length === 0) {
          report(info, line, `${method.toUpperCase()} ${fullPath}: no handler`, here);
          continue;
        }
        for (const p of own.problems)
          report(info, line, `${method.toUpperCase()} ${fullPath}: ${p}`, here);
        const steps = [...chainSoFar, ...own.items];
        for (const p of chainProblems(method, fullPath, steps)) {
          report(info, line, `${method.toUpperCase()} ${fullPath}: ${p}`, here);
        }
      }
    };
    walk(ROOT_FILE, ROOT_MOUNT, [], false, [], []);
  }

  for (const rel of routeFiles) {
    const info = readFile(ctx, rel, cache);
    if (rel !== ROOT_FILE && !reached.has(rel)) {
      report(
        info,
        1,
        `${rel} is not mounted by any router reached from ${ROOT_FILE}: a route file nothing mounts is unguarded and unreached (AC-44)`,
        [],
      );
    }
    for (const def of localDefinitions(info)) {
      report(
        info,
        def.line,
        `${def.name} is defined in this route file: the guards come from functions/src/middleware, and a local one with the same name would pass as the real guard`,
        [],
      );
    }
  }

  const widen = ctx.touches(SELF);
  const seen = new Set();
  return found
    .filter((v) => widen || v.chainFiles.some((f) => ctx.touches(f)))
    .filter((v) => {
      const key = `${v.file}:${v.line}:${v.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ chainFiles: _chainFiles, ...v }) => v);
}

module.exports = { name: NAME, run, RANK_TABLE };
