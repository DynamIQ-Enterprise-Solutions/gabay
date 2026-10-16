// Test support for DEP-0 (plan/DEP-0.md 1.0 step 2, AC-14, AC-16; not a test file): a fake Cloud SQL connector factory, so the
// connector mode of the database layer is tested with no package, no network and no cloud.
//
// fakeConnector({ target })   gives { factory, state, failWith }
//   factory()   what createDb(config, logger, { connectorFactory }) calls on the first connection; counts the connectors made
//   state       { created, closed, optionCalls, events }: how many connectors were made and closed, every getOptions argument, and
//               the order of 'created', 'closed' (a test adds 'pool-ended')
//   failWith(e) makes getOptions reject with e from now on (null clears it); a function e is called each time
// What getOptions answers is the target pg options (the local test database's host and port), standing in for the connector's
// `{ stream }`, so a real query runs through the "connector" with nothing but the local database behind it.
'use strict';

function fakeConnector({ target } = {}) {
  const state = { created: 0, closed: 0, optionCalls: [], events: [] };
  let failure = null;
  const factory = () => {
    state.created += 1;
    state.events.push('created');
    return {
      async getOptions(options) {
        state.optionCalls.push(options);
        if (failure) throw typeof failure === 'function' ? failure() : failure;
        return { ...target };
      },
      close() {
        state.closed += 1;
        state.events.push('closed');
      },
    };
  };
  return {
    factory,
    state,
    failWith(error) {
      failure = error;
    },
  };
}

/** An error shaped like the connector's own (errors.js of 1.12.1): a name, and a string code that is no SQLSTATE. */
function connectorError(
  code = 'ENOINSTANCEINFO',
  message = 'Cannot find info for instance: my-project:asia-southeast1:db',
) {
  return Object.assign(new Error(message), { name: 'CloudSQLConnectorError', code, errors: [] });
}

module.exports = { fakeConnector, connectorError };
