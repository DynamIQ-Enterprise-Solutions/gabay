// keyStatus(key, expectedKind, draftIndex, publishedIndex) (spec/OA-1.md r1 AC-41, AC-42; office section 6.3): what a
// relational row's element key (a store's unit, a beacon's level, a closure's connector) points at. The key pattern
// is the id pattern (the schema file's ELEMENT_KEY is its ID). The indexes are elementIndex results; with no
// published version, publishedIndex is null or undefined.
//   live       the published layout holds the key as the expected kind
//   pending    only the draft does
//   wrongKind  a layout holds the key, but as another kind (a store keyed to a wall)
//   removed    neither layout holds it
'use strict';

const holdsAs = (index, key, kind) => index?.byId.get(key)?.kind === kind;
const holds = (index, key) => index?.byId.has(key) === true;

function keyStatus(key, expectedKind, draftIndex, publishedIndex) {
  if (holdsAs(publishedIndex, key, expectedKind)) return 'live';
  if (holdsAs(draftIndex, key, expectedKind)) return 'pending';
  if (holds(publishedIndex, key) || holds(draftIndex, key)) return 'wrongKind';
  return 'removed';
}

module.exports = { keyStatus };
