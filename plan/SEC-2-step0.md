Step 0 of plan/SEC-2.md 1.0 (spec/SEC-2.md r2): the doc checks of plan section 0, run on 2026-10-15 on branch `sec-2` (from origin/main 606a5d0) under Node 22 (fnm). Baseline before any change: `npm run api:test` gave 1078 tests, 1078 pass, 0 fail (76 s).

# SEC-2 step 0: findings

## (a) express-rate-limit 8.7.1 (source-checked: `functions/node_modules/express-rate-limit/dist/index.cjs`, `index.d.ts`)

`package.json` reads version 8.7.1. Lines read this session:

- **Headers.** cjs 805-806: `let standardHeaders = notUndefinedOptions.standardHeaders ?? false; if (standardHeaders === true) standardHeaders = "draft-6";`. So `true` is `'draft-6'` (`RateLimit-Policy`, `-Limit`, `-Remaining`, `-Reset`). The plan sets `'draft-6'` outright and `legacyHeaders: false`.
- **Retry-After.** cjs 1052-1060 (after the hit is counted): `if (totalHits > limit) { if (config.legacyHeaders || config.standardHeaders) { ... const retrieveRetryAfter = typeof config.retryAfter === "function" ? config.retryAfter(request, response) : config.retryAfter; ... setRetryAfterHeader(response, info, config.windowMs, retryAfter); } config.handler(request, response, next, options); return; }`. cjs 300-303: `const resetSeconds = retryAfter ?? getResetSeconds(windowMs, info.resetTime); response.setHeader("Retry-After", resetSeconds.toString());`. So `Retry-After` is set before `handler` runs, only when a header family is on, and an explicit `retryAfter` (number or function, d.ts 421) wins.
- **Reset seconds.** cjs 242-251: `Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1e3))`. Zero is possible at the very end of a window, which is why DC-41 supplies `retryAfter` with a floor of 1.
- **Give-back.** cjs 1001-1050: `decrementKey` returns without decrementing when `resetTime && Date.now() >= resetTime.getTime()`. With `skipSuccessfulRequests` the hit is given back on `finish` when `requestWasSuccessful` is true. The `close` listener (cjs 914) is created only when `config.skipFailedRequests` is true: `const closePromise = config.skipFailedRequests && new Promise(... response.once("close" ...))`. So under `skipSuccessfulRequests` an aborted request is never given back by the library, and AC-8 needs the limiter's own `close` listener (DC-30).
- **Request property.** d.ts 533-539: `RateLimitInfo = { limit, used, remaining, resetTime: Date | undefined, key }`, set on `request[requestPropertyName]` (d.ts 427).
- **Logger.** d.ts 172-181: `Logger = { error: LoggerFn, warn: LoggerFn }`, `LoggerFn = (error: unknown, message?: string) => void`. cjs 788: `const logger = passedOptions.logger ?? ConsoleLogger;`. The console fallback reverses its arguments (cjs 224-231), so the library calls its logger pino-style (the object or error first, then the text). The plan's limiter hands it the app's logger.
- **Store.** `MemoryStore` is exported (d.ts 555) with `decrement(key)` (d.ts 616). The default store is a new `MemoryStore` per `rateLimit()` call, so the two limiters never share a counter.

## (b) zod 4.6.5 (run in `scratchpad/zodcheck.js` and `zod2.js` under Node 22; output pasted)

```
strip {"a":"x"}                                  z.object strips unknown keys
absentOptional false                             an absent optional key stays absent (Object.hasOwn false)
issueOrder [["invalid_type","A must be text",["a"]],["invalid_type","B must be number",["b"]]]
                                                 issues follow the shape's key order; the `error` parameter sets the message; an issue has code, message, path
pipeShort [["custom","must be object"]]         .pipe() runs its second schema only when the first passes (the 5 never reached z.object)
addIssue [["custom","boom",["a"]]]              ctx.addIssue in a refinement is returned by safeParse, never thrown
typeIssue [["invalid_type","Invalid input: expected string, received number"]]
                                                 a built-in issue's default message is zod's own text
catch {}                                         .catch(undefined) makes a bad value absent
nonobj [["invalid_type","Invalid input: expected object, received array"]]
absent keys [["custom","Code bad",["code"]],["custom","Name bad",["name"]]]
                                                 z.unknown().transform(...) runs for an ABSENT key, so a field reader written this way sees `undefined`
order ["Code bad","Name bad"]                    first issue = first key in the SHAPE's order, not the input's
echo absent false / echo null {"id":null}        z.unknown().optional(): absent stays absent, null is kept
jo undefined [["custom","must be json object"]] z.custom(...) refuses undefined with its own message
bigissues 2 (0.03 ms) for a 10,000-key object   unknown keys are never walked
protoKeep ["code","name"]                       a "__proto__" key in the input never reaches the output
throws "x"                                       a transform that throws is NOT caught by safeParse: the field readers never throw
```

**Consequence for DC-34 (only a `custom` issue's message reaches a client).** A message set with the `error` parameter on `z.string(...)` still has code `invalid_type`, so by DC-34 it would be replaced by the fallback. The field schemas are therefore written as `z.unknown().transform((value, ctx) => ...)` readers that push a `custom` issue with the message (the old reader's logic and text, moved: C2). A built-in issue (a type error nobody wrote a message for) gets the fixed fallback and one `warn`.

## (c) Node 22 `http.ServerResponse` (run in `scratchpad/node3.js`; output pasted)

```
["finish","/api/x/5?a=1",... "wf=true"]    a normal response: finish, writableFinished true
["close","/api/x/5?a=1","wf=true","als={\"user\":1}"]   close comes after finish
["close","/api/slow/7","wf=false","als=null"]   client aborted: ONLY close fired, writableFinished false
```

So `finish` does not fire when the socket closes first; `close` fires in both cases; `writableFinished` is true only after `finish`. The aborted request's `close` listener ran with **no** AsyncLocalStorage store (`als=null`), which confirms DC-42: the audit reads identity from `req` at finish and close, never from the context getters.

## (d) Express 5.2.1 (same script)

```
["inmount","url=/x/5?a=1","path=/x/5","orig=/api/x/5?a=1"]   inside a mounted router req.url and req.path are relative, req.originalUrl is not
["finish",..."params={\"id\":\"5\"}","ip=8.8.8.8",... "slotParams={}"]   at finish req.params holds the matched route's params; at the slot it was {}
```

`X-Forwarded-For: 9.9.9.9, 8.8.8.8` with `trust proxy` 1 gives `req.ip` 8.8.8.8, the address the one trusted hop appended. So the audit takes the path from `req.originalUrl` at the slot, takes `params` at finish, and the client key is `req.ip`.

## (e) pino 10.4.0 (same script)

```
pino bare Error keys [ 'level','time','pid','hostname','err','msg' ] Error string msg
pino {err} [ 'level','time','pid','hostname','err','msg' ] string
```

A bare `Error` as the first argument is logged as `err` with its stack, as is `{ err }`. Both go to the log, never to a response.

## (f) Fetch standard: `Retry-After` is not CORS-safelisted

RECALLED, not fetched (no web tool in this run). The safelisted response headers are `Cache-Control`, `Content-Language`, `Content-Length`, `Content-Type`, `Expires`, `Last-Modified` and `Pragma`. The plan exposes `Retry-After` regardless, and the AC-3 test asserts the `Access-Control-Expose-Headers` list.

## Still RECALLED (not checkable on this machine without a deploy or the emulator)

- Cloud Functions' post-response CPU (EC-39): DEP-1's staging check, and the runbook line (AC-59).
- The Functions emulator's own `X-Forwarded-For` hop: SEC2.3 records what it sees; AC-6's API test is the proof.
