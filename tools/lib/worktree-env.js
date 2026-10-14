// The .env of a working copy (plan/PH1-worktrees.md 1.1, WT-5): the main .env with PGDATABASE changed and, since
// plan/PH4-lane-ports.md, EMULATOR_PORT_OFFSET and FIREBASE_AUTH_EMULATOR_HOST set for the copy's lane. It works on the
// text, line by line, so every other byte (comments, spacing, quotes, line ends) stays as it was, and it never prints a
// value. Plain CommonJS, no dependencies beyond tools/lib, any Node >= 22.
'use strict';

const { parseEnv } = require('node:util');
const { lanePorts } = require('./emulator-lane');

/** A line that sets PGDATABASE: optional spaces, optional `export`, the key, `=`, then the value up to the line end. */
const PGDATABASE_LINE = /^([ \t]*(?:export[ \t]+)?PGDATABASE[ \t]*=[ \t]*)[^\r\n]*?([ \t]*)$/;

/**
 * `text` with the value of every PGDATABASE line set to `database`. A line break (LF or CRLF) and a missing final
 * newline are kept; spaces after the value are kept. Throws when there is no PGDATABASE line.
 */
function withDatabase(text, database) {
  let found = false;
  const lines = text.split('\n').map((raw) => {
    const crlf = raw.endsWith('\r');
    const line = crlf ? raw.slice(0, -1) : raw;
    const match = PGDATABASE_LINE.exec(line);
    if (!match) return raw;
    found = true;
    return `${match[1]}${database}${match[2]}${crlf ? '\r' : ''}`;
  });
  if (!found) throw new Error('The main .env has no PGDATABASE line: add one (see .env.example).');
  return lines.join('\n');
}

/** A line that sets EMULATOR_PORT_OFFSET (the same shape as PGDATABASE_LINE). */
const OFFSET_LINE = /^([ \t]*(?:export[ \t]+)?EMULATOR_PORT_OFFSET[ \t]*=[ \t]*)[^\r\n]*?([ \t]*)$/;

/**
 * `text` with EMULATOR_PORT_OFFSET=<offset> (plan/PH4-lane-ports.md): the value of a line that is already there is
 * set; otherwise a new line goes right after the PGDATABASE line, with that line's own line end. Every other byte
 * stays. Throws when there is no PGDATABASE line (the same rule as withDatabase).
 */
function withOffset(text, offset) {
  let found = false;
  const lines = text.split('\n').map((raw) => {
    const crlf = raw.endsWith('\r');
    const match = OFFSET_LINE.exec(crlf ? raw.slice(0, -1) : raw);
    if (!match) return raw;
    found = true;
    return `${match[1]}${offset}${match[2]}${crlf ? '\r' : ''}`;
  });
  if (found) return lines.join('\n');
  const at = lines.findIndex((raw) => PGDATABASE_LINE.test(raw.replace(/\r$/, '')));
  if (at === -1)
    throw new Error('The main .env has no PGDATABASE line: add one (see .env.example).');
  const crlf = lines[at].endsWith('\r') ? '\r' : '';
  lines.splice(at + 1, 0, `EMULATOR_PORT_OFFSET=${offset}${crlf}`);
  return lines.join('\n');
}

/** A line that sets FIREBASE_AUTH_EMULATOR_HOST (the same shape as PGDATABASE_LINE). */
const AUTH_HOST_LINE =
  /^([ \t]*(?:export[ \t]+)?FIREBASE_AUTH_EMULATOR_HOST[ \t]*=[ \t]*)[^\r\n]*?([ \t]*)$/;

/**
 * `text` with FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:<9099 + offset>, the copy's own Auth emulator (plan/PH4-lane-ports.md):
 * the value of a line that is already there (the main .env has 9099) is set; otherwise a new line goes right after the
 * EMULATOR_PORT_OFFSET line (so call withOffset first), with that line's own line end. Every other byte stays.
 */
function withAuthEmulatorHost(text, offset) {
  const value = `127.0.0.1:${lanePorts(offset).auth}`;
  let found = false;
  const lines = text.split('\n').map((raw) => {
    const crlf = raw.endsWith('\r');
    const match = AUTH_HOST_LINE.exec(crlf ? raw.slice(0, -1) : raw);
    if (!match) return raw;
    found = true;
    return `${match[1]}${value}${match[2]}${crlf ? '\r' : ''}`;
  });
  if (found) return lines.join('\n');
  const at = lines.findIndex((raw) => OFFSET_LINE.test(raw.replace(/\r$/, '')));
  if (at === -1)
    throw new Error('The .env has no EMULATOR_PORT_OFFSET line: run withOffset first.');
  const crlf = lines[at].endsWith('\r') ? '\r' : '';
  lines.splice(at + 1, 0, `FIREBASE_AUTH_EMULATOR_HOST=${value}${crlf}`);
  return lines.join('\n');
}

/** The PG connection values of an .env text, for the code that connects. Never log what this returns. */
function connectionFrom(text) {
  const env = parseEnv(text);
  const missing = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`The main .env is missing ${missing.join(', ')} (see .env.example).`);
  }
  return {
    host: env.PGHOST,
    port: Number(env.PGPORT),
    user: env.PGUSER,
    password: env.PGPASSWORD,
  };
}

module.exports = { withDatabase, withOffset, withAuthEmulatorHost, connectionFrom };
