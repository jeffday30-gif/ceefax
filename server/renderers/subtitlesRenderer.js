const { Grid } = require('./grid');

function render(_pageNum, _opts = {}) {
  const g = new Grid();
  g.writeHeaderBand(888, 'SUBTITLES', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'PAGE 888 - SUBTITLES', 'W');

  g.writeWrapped(5, 9,
    'Across British TV from 1979 onwards, page 888 carried ' +
    'subtitles for the hearing-impaired. Millions of viewers ' +
    'turned to it every day.',
    'W', 'K', 1);

  g.writeWrapped(11, 15,
    'Ceefax closed on the night of 23 October 2012 when ' +
    'analogue transmissions ended in Northern Ireland. The ' +
    'last page transmitted was 100.',
    'C', 'K', 1);

  g.writeCentered(18, 'A tribute to public-service teletext.', 'Y', 'K');

  g.setFastext([
    { label: 'INDEX',    page: 100 },
    { label: 'A-Z',      page: 199 },
    { label: 'HEADLINE', page: 101 },
    { label: 'PAGES',    page: 152 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: 888, subPage: 1, totalSubPages: 1, title: 'SUBTITLES' });
}

module.exports = { render };
