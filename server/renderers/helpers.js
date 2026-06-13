const { Grid } = require('./grid');
const { sectionColourFor } = require('./palette');

// Standard "no live data yet" page in the section's colours.
function renderUnavailable(pageNum, title, message = 'AWAITING NEXT UPDATE') {
  const g = new Grid();
  const colour = sectionColourFor(pageNum);
  g.writeHeaderBand(pageNum, title, { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, title, colour);
  g.writeCentered(9,  'DATA UNAVAILABLE', 'R', 'K');
  g.writeCentered(11, message,            'W', 'K');
  g.writeCentered(13, 'Live feeds run on the server.', 'C', 'K');
  g.writeCentered(14, 'Try again shortly.',            'C', 'K');
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title });
}

function isEmpty(arr) {
  return !arr || (Array.isArray(arr) && arr.length === 0);
}

module.exports = { renderUnavailable, isEmpty };
