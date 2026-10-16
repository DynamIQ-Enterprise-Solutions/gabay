// Test support for DEP-0 (plan/DEP-0.md 1.0 step 7, DC-28; not a test file): a PLATFORM-SHAPED HOST, so the Functions path of a
// request is exercised without the Functions emulator. It reproduces what the platform does before it calls the function, as the
// Functions emulator's runtime does (firebase-tools 15.32.1 functionsEmulatorRuntime.js; plan/DEP-0-step0.md section 0.1):
//
//   - it listens on a NAMED PIPE (Windows) or a UNIX SOCKET: a request has no remote address, and no X-Forwarded-For is added
//   - it reads every body first with body-parser's json, text, urlencoded and raw ("*/*") parsers at 32 MB, keeping the bytes as
//     `req.rawBody`; a body it cannot parse is answered by its own final handler (an HTML 400) and the function never runs
//   - only then does it call the function, with the request and response
//   - `trust proxy` is on, as in the runtime's app. It sends no X-Powered-By (the framework disables it; the emulator's own hub adds
//     one outside the function), so any such header in a test's answer would be the function's
// The in-process app is the one `createApp` makes; the same app answers both paths, which is what makes the comparison fair.
//
//   startFunctionsHost(handler)  -> { calls, request(method, path, { headers, bytes }), close() }
//        `calls` counts how many requests reached the function (a parse failure never does)
'use strict';

const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const bodyParser = require('body-parser');

const PLATFORM_LIMIT = '32mb';
let counter = 0;

function socketPathFor() {
  counter += 1;
  const name = `gabay-functions-host-${process.pid}-${counter}`;
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\${name}`
    : path.join(os.tmpdir(), `${name}.sock`);
}

/** @param {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => void} handler  the function */
async function startFunctionsHost(handler) {
  const state = { calls: 0 };
  const host = express();
  host.enable('trust proxy');
  host.disable('x-powered-by');
  const saveRaw = (req, res, buf) => {
    req.rawBody = buf;
  };
  host.use(bodyParser.json({ limit: PLATFORM_LIMIT, verify: saveRaw }));
  host.use(bodyParser.text({ limit: PLATFORM_LIMIT, verify: saveRaw }));
  host.use(bodyParser.urlencoded({ extended: true, limit: PLATFORM_LIMIT, verify: saveRaw }));
  host.use(bodyParser.raw({ type: '*/*', limit: PLATFORM_LIMIT, verify: saveRaw }));
  host.all('/{*splat}', (req, res) => {
    state.calls += 1;
    handler(req, res);
  });
  const server = http.createServer(host);
  const socketPath = socketPathFor();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, resolve);
  });

  /** One request over the pipe or socket. `bytes` is the whole body (a Buffer) or undefined. */
  function request(method, requestPath, { headers = {}, bytes } = {}) {
    return new Promise((resolve, reject) => {
      const sent = { ...headers };
      if (bytes !== undefined) sent['content-length'] = String(bytes.length);
      const req = http.request({ socketPath, method, path: requestPath, headers: sent }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            bytes: body,
            text: body.toString('utf8'),
          });
        });
      });
      req.on('error', reject);
      req.end(bytes);
    });
  }

  return {
    get calls() {
      return state.calls;
    },
    request,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startFunctionsHost, PLATFORM_LIMIT };
