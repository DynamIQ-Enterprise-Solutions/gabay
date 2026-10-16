// The client address when the platform gives the function no socket (DEP-0 step 7, F3, R3, DC-32; spec/DEP-0.md r2 P-3).
//
// `req.ip` is what the audit trail stores and what both rate limiters key on. Express computes it from the socket address and
// X-Forwarded-For under `trust proxy` (a hop count, TRUST_PROXY_HOPS). The Functions EMULATOR listens on a named pipe, so a request
// has no remote address, and the emulator adds no X-Forwarded-For (firebase-tools functionsRuntimeWorker.js forwards the client's
// headers as they are): `req.ip` is undefined, express-rate-limit logs ERR_ERL_UNDEFINED_IP_ADDRESS and gives every caller one key,
// and every audit row has a NULL address. So, only when `req.ip` is undefined:
//
//   in the emulator (FUNCTIONS_EMULATOR=true, set by firebase-tools)  the loopback address. firebase.json binds the emulator to
//       127.0.0.1, so the only caller is this machine (R3). A forwarded header still wins: Express reads it first, and this runs
//       only when that gave nothing.
//   anywhere else   it stays undefined, and one `warn` per app names TRUST_PROXY_HOPS: on a deployed function the address must come
//       from X-Forwarded-For, and a missing one means the hop count is wrong, which would put every client under one limiter key.
//
// A deployed function behind Google's front end has both a socket address and X-Forwarded-For, so this never changes its answer.
//
// DESIGN CHOICE (plan DC-32 and C1): it is not a new middleware layer but the app's own request prototype (`app.request`, Express's
// extension point for request properties), so the order of the middleware stack that app.test.js pins (standard §3.1) is the order it
// always was. The getter asks Express's own `ip` first, so it takes effect at every reader of req.ip (both rate limiters, the audit
// trail) and before any of them runs. Alternative: a layer right after `trust proxy`, which would add a name to that test's list.
'use strict';

const express = require('express');

const LOOPBACK = '127.0.0.1';
/** Express's own getter for req.ip: the socket address and X-Forwarded-For under `trust proxy`. */
const expressIp = Object.getOwnPropertyDescriptor(express.request, 'ip').get;

/**
 * @param {import('express').Express} app  its request prototype is extended
 * @param {{ config: { functionsEmulator: boolean }, logger: { warn: Function } }} deps
 */
function installClientAddress(app, { config, logger }) {
  let warned = false;
  Object.defineProperty(app.request, 'ip', {
    configurable: true,
    enumerable: true,
    get() {
      const ip = expressIp.call(this);
      if (ip !== undefined) return ip;
      if (config.functionsEmulator) return LOOPBACK;
      if (!warned) {
        warned = true;
        logger.warn(
          'a request arrived with no client address (no socket address, no X-Forwarded-For): check TRUST_PROXY_HOPS; until it is right, audit rows hold no address and every client shares one rate-limit key',
        );
      }
      return undefined;
    },
  });
}

module.exports = { installClientAddress, LOOPBACK };
