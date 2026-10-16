// The venue create and edit bodies as zod schemas (R5; SEC-2, spec/SEC-2.md r2 AC-33, AC-34, AC-40; FF-1 plan section 2.3).
//
// The order of the first message is today's (AC-34): a body that is not an object; for an edit, every missing key in the
// form's order; each field's own check in the form's order; then `updatedAt`. The read-only keys a client may echo back
// (id, tenantId, createdAt, createdBy, updatedBy, and updatedAt on a create) pass through untouched, as `unknown`, because
// comparing them needs the request's tenant or the stored record: that stays in the service (standard §3.7; venue.service.js
// refuseIfDifferent, refuseStampsOnCreate, refuseStampsOnEdit). An absent echo key stays absent in the output, so the
// service's "present and different" test keeps its meaning. mapUpDeg, boundary and any other unknown key are ignored.
'use strict';

const { z } = require('zod');
const { jsonObject, presence, requiredText, flag, updatedAt } = require('./fields');

/** Column limits from db/schema.sql (gabay.Venue); venues.schemaMirror.test.js fails if they drift (FF-1 DC-8). */
const CODE_MAX = 40;
const NAME_MAX = 200;

/** The fields a create or an edit writes, with the form's labels, in the order the form shows them. */
const LABELS = Object.freeze({
  code: 'Code',
  name: 'Name',
  isActive: 'Active',
});

const echo = () => z.unknown().optional();

const fields = {
  code: requiredText(LABELS.code, CODE_MAX),
  name: requiredText(LABELS.name, NAME_MAX),
  isActive: flag(LABELS.isActive),
};

/** POST /api/venues. */
const venueCreateBody = jsonObject().pipe(
  z.object({
    ...fields,
    id: echo(),
    tenantId: echo(),
    createdAt: echo(),
    createdBy: echo(),
    updatedAt: echo(),
    updatedBy: echo(),
  }),
);

/** PUT /api/venues/:venueId: an edit sends every field (L164) and the token of the record it loaded. */
const venueEditBody = jsonObject()
  .pipe(presence(Object.entries(LABELS)))
  .pipe(
    z.object({
      ...fields,
      updatedAt: updatedAt(),
      id: echo(),
      tenantId: echo(),
      createdAt: echo(),
      createdBy: echo(),
      updatedBy: echo(),
    }),
  );

module.exports = { venueCreateBody, venueEditBody, CODE_MAX, NAME_MAX };
