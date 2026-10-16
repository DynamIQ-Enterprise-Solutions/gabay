// The venue map document's module (spec/OA-1.md r1 sections 3.6 to 3.12; plan/OA-1-map-document.md 1.0 section 3.2):
// its public surface, and the only one (AC-29). One map validator, validateMap, which OA-2's draft save and FF-3
// prime's publish both call; validateExportFile checks an export envelope and passes its map through validateMap.
//
//   validateMap(doc, context)              -> { ok: true, map } | { ok: false, problems, total }   (AC-1 to AC-33)
//   mapProblemBody({ problems, total })    -> { error, problems, total }                           (AC-27)
//   publishable(map)                       -> a copy without any level's backdrop                  (AC-34)
//   elementIndex(map)                      -> { byId: Map(id -> { kind, level }), levels: Map }     (AC-35)
//   keyStatus(key, kind, draft, published) -> 'live' | 'pending' | 'removed' | 'wrongKind'          (AC-42)
//   readMap(stored)                        -> { ok: true, map } | { ok: false, problems }            (AC-36)
//   validateExportFile(envelope, context)  -> { ok: true, file } | { ok: false, problems, total }   (AC-47)
//   shapeCatalog(rows, version)            -> { version, finishes, floorFinishes, types }          (AC-44)
//   shapeMapContext(rows)                  -> the context validateMap takes                         (AC-46)
//   roundTo(x, decimals)                   -> x half away from zero on its decimal text (DC-10), which the
//                                             publish engine stores its costs and lengths with (P0-03 r4
//                                             DC-21; plan/FF-3-prime-A1.md 1.0 DC-A9)
'use strict';

const { validateMap } = require('./validateMap');
const { mapProblemBody } = require('./problems');
const { publishable } = require('./publishable');
const { elementIndex } = require('./elementIndex');
const { keyStatus } = require('./keyStatus');
const { readMap } = require('./readMap');
const { validateExportFile } = require('./exportFile');
const { shapeCatalog } = require('./catalog');
const { shapeMapContext } = require('./context');
const { roundTo } = require('./numbers');

module.exports = {
  validateMap,
  mapProblemBody,
  publishable,
  elementIndex,
  keyStatus,
  readMap,
  validateExportFile,
  shapeCatalog,
  shapeMapContext,
  roundTo,
};
