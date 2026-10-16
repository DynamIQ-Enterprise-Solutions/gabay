// The client address as the audit trail stores it (SEC-2 AC-27; db/schema.sql AuditLog.IPAddress: "::ffff: normalised; 45 =
// longest IPv6 text form"). Express hands over `req.ip` of a socket that may be dual-stack, so an IPv4 client can arrive as
// ::ffff:10.0.0.5; the log keeps 10.0.0.5, the form a person searches for.
'use strict';

/** The longest IPv6 text form (and so the column's width). */
const IP_MAX_LENGTH = 45;
/** An IPv4-mapped IPv6 address in dotted form, the prefix in any letter case. */
const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/**
 * @param {unknown} ip  req.ip
 * @returns {string|null} null when there is no address; the dotted IPv4 form of a mapped address; anything else as it is
 *   (the hex form ::ffff:a00:5 included, which is kept on purpose), cut to the column's width
 */
function normaliseIp(ip) {
  if (typeof ip !== 'string' || ip === '') return null;
  const mapped = IPV4_MAPPED.exec(ip);
  return (mapped ? mapped[1] : ip).slice(0, IP_MAX_LENGTH);
}

module.exports = { normaliseIp, IP_MAX_LENGTH };
