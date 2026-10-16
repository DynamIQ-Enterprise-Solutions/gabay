// The Cloud SQL connector mode of the database layer (DEP-0 AC-14, E-29; spec/DEP-0.md r2 DC-6, DC-8).
//
// Configured with CLOUD_SQL_INSTANCE (the instance connection name), the pool does not dial a host: it takes the options the
// Cloud SQL Node.js Connector returns for `pg` (`{ stream }`, over the instance's public IP, with the connector's own TLS and
// IAM check) and the process keeps ONE connector for its life. The package is required only here and only in this mode, so a
// local run, a test in host mode and the deploy-time load of index.js never load it (AC-53); the connector object is created on
// the first connection, not at load.
//
// Read from the package's own source and README (1.12.1, plan/DEP-0-step0.md row 1): `new Connector()`; `await
// connector.getOptions({ instanceConnectionName, ipType: 'PUBLIC' })` fetches the instance's metadata and returns `{ stream }`;
// `connector.close()` is synchronous. DEP-1's first deploy shows a real connection through it; if its spike then chooses the
// /cloudsql socket instead, this file and E-29 are removed (AC-2).
'use strict';

/** The connector's IP setting: the plan's choice is the public IP, with no private network (AC-14). */
const IP_TYPE = 'PUBLIC';

/** The real connector, loaded on first use. A test passes its own factory instead. */
function loadConnector() {
  const { Connector } = require('@google-cloud/cloud-sql-connector');
  return new Connector();
}

/**
 * @param {object} options
 * @param {string} options.instance  the instance connection name, <project>:<region>:<instance>
 * @param {() => { getOptions: Function, close: Function }} [options.connectorFactory]
 */
function createConnectorHandle({ instance, connectorFactory = loadConnector }) {
  let connector = null;
  return {
    /** The options for a pg Pool. Creates the connector on the first call; every later call reuses it. */
    async poolOptions() {
      connector ??= connectorFactory();
      return connector.getOptions({ instanceConnectionName: instance, ipType: IP_TYPE });
    },
    /** Closes the connector, once. A connector that was never created is not created to be closed. */
    close() {
      if (connector === null) return;
      const closing = connector;
      connector = null;
      closing.close();
    },
  };
}

module.exports = { createConnectorHandle, IP_TYPE };
