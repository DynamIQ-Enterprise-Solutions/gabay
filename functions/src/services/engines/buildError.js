// A build failure (spec/P0-03.md r4 AC-105, AC-118 (c); EC-92): a fault no finding can describe, such as an edge
// cost that is not finite or is below 0 (a corrupt lookup value). The analysis throws it instead of returning a
// finding, so OA-2's publish ends the version row FAILED with no package and its 500 (OA-2 AC-27), and the checks
// route answers its 500 (AC-121). It is never a warning.
'use strict';

class PublishBuildError extends Error {
  constructor(message) {
    super(`publish engine: ${message}`);
    this.name = 'PublishBuildError';
  }
}

module.exports = { PublishBuildError };
