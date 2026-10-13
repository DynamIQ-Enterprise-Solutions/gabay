// Connector rules (spec/OA-1.md r1 AC-6, AC-7; DC-5, DC-7, DC-25; EC-29). What depends on a kind (twoWay only on an
// escalator, d and cars only on an elevator, shape only on stairs and ramps, an escalator's two levels, the ranges
// and defaults per kind) is the schema file's appliesTo and perKind. Here:
//   - stops has one point per entry of levels, and stops[i] lies inside levels[i] (DC-5);
//   - the footprint's centre (x, z) lies inside every level the connector serves (DC-25);
//   - the type code's CostModel is the one the kind names (the schema file's costModelOf; DC-6);
//   - evacuationOnly is never true on a connector that is not walkable (L87, DC-18);
//   - a size with a per-kind lower bound but no per-kind maximum (a ramp's w and len, DC-7) is at most the larger
//     side of the smallest level it serves.
'use strict';

const { indexLocation } = require('./problems');
const geometry = require('./geometry');
const { fieldOf, infosOf, levelRect } = require('./state');

/** The level scopes a connector serves, in order: null for an id that does not name a level. */
function servedScopes(st, levels) {
  return levels.map((id) => {
    const entry = st.ids.get(id);
    return entry && entry.kind === 'level' ? entry.level : null;
  });
}

const outsideMessage = (scope, rect) =>
  `lies outside level ${scope.info.effective.id} (${geometry.describeRectangle(rect)})`;

function checkStops(st, info, served) {
  const { levels, stops } = info.effective;
  if (!Array.isArray(levels) || !Array.isArray(stops)) return;
  if (stops.length !== levels.length) {
    st.problems.add(
      fieldOf(info, 'stops'),
      `has ${stops.length} points; levels names ${levels.length} levels`,
    );
    return;
  }
  stops.forEach((point, i) => {
    const rect = served[i] && levelRect(served[i]);
    if (rect && !geometry.pointInside(point, rect)) {
      st.problems.add(indexLocation(fieldOf(info, 'stops'), i), outsideMessage(served[i], rect));
    }
  });
}

function checkFootprint(st, info, served) {
  for (const field of info.plan.fields) {
    if (field.rule.within !== 'servedLevels') continue;
    const value = info.effective[field.name];
    if (typeof value !== 'number') continue;
    const inside = field.rule.axis === 'x' ? geometry.xInside : geometry.zInside;
    for (const scope of served) {
      const rect = scope && levelRect(scope);
      if (rect && !inside(value, rect)) {
        st.problems.add(fieldOf(info, field.name), outsideMessage(scope, rect));
        break;
      }
    }
  }
}

function checkCostModel(st, info) {
  const { kind, type } = info.effective;
  const rule = info.plan.kind.fields.type;
  if (info.bad.has('kind') || info.bad.has('type') || typeof kind !== 'string') return;
  const entry = st.context.lookups.ConnectorType.get(type);
  const wanted = rule.costModelOf?.[kind];
  if (entry && wanted && entry.costModel !== wanted) {
    st.problems.add(
      fieldOf(info, 'type'),
      `${type} is a ${entry.costModel} type; a ${kind} needs a ${wanted} type`,
    );
  }
}

/** DC-7: a per-kind size with no per-kind maximum is held to the smallest served level's larger side. */
function checkLevelBoundSizes(st, info, served) {
  const { kind } = info.effective;
  if (info.bad.has('kind') || typeof kind !== 'string') return;
  const rects = served.map((scope) => scope && levelRect(scope));
  if (rects.length === 0 || rects.some((rect) => !rect)) return;
  const bound = Math.min(...rects.map((r) => Math.max(r.x1 - r.x0, r.z1 - r.z0)));
  for (const field of info.plan.fields) {
    const per = field.rule.perKind?.[kind];
    const value = info.effective[field.name];
    if (!per || per.max !== undefined || per.minExclusive === undefined) continue;
    if (typeof value === 'number' && geometry.toMm(value) > bound) {
      st.problems.add(
        fieldOf(info, field.name),
        `must be above ${per.minExclusive} and at most ${bound / geometry.MM_PER_M} (the larger side of the smallest level it serves)`,
      );
    }
  }
}

function checkConnectors(st) {
  for (const info of infosOf(st, 'connector')) {
    const { levels, evacuationOnly, walkable } = info.effective;
    const served = Array.isArray(levels) ? servedScopes(st, levels) : [];
    checkStops(st, info, served);
    checkFootprint(st, info, served);
    checkCostModel(st, info);
    checkLevelBoundSizes(st, info, served);
    if (evacuationOnly === true && walkable === false) {
      st.problems.add(
        fieldOf(info, 'evacuationOnly'),
        'cannot be true on a connector that is not walkable',
      );
    }
  }
}

module.exports = { checkConnectors };
