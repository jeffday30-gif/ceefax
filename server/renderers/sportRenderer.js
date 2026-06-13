const { Grid } = require('./grid');
const data = require('../data');
const { renderUnavailable, isEmpty } = require('./helpers');

const SECTION = 'G';

function sportFastext(g) {
  g.setFastext([
    { label: 'SPORT',    page: 300 },
    { label: 'FOOTBALL', page: 302 },
    { label: 'WORLD CUP',page: 305 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function bbcFeedFor(name) {
  const sport = data.bbcSport();
  if (!sport) return [];
  return sport[name] || [];
}

// Generic sport-RSS page: title + n headlines with links.
function renderRssPage(g, pageNum, title, feedName) {
  const items = bbcFeedFor(feedName);
  if (isEmpty(items)) return renderUnavailable(pageNum, title);
  g.writeHeaderBand(pageNum, title.slice(0, 12), { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, title, SECTION);
  let row = 4;
  for (const item of items.slice(0, 6)) {
    if (row > 22) break;
    const link = item.link ? { l: item.link } : {};
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, item.title, 'C', 'K', 3, link);
    if (item.summary && row <= 22) {
      row = g.writeWrapped(row, 22, item.summary, 'W', 'K', 3, link);
    }
    row++;
  }
  sportFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title });
}

function renderLocalSport(g) {
  g.writeHeaderBand(390, 'LOCAL', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'REGIONAL SPORT', SECTION);
  g.writeCentered(10, 'COMING SOON', 'R', 'K');
  g.writeCentered(12, 'Local & regional sport coverage', 'W', 'K');
  g.writeCentered(13, 'will be added in a future update.', 'W', 'K');
  sportFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: 390, subPage: 1, totalSubPages: 1, title: 'LOCAL SPORT' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 340 || pageNum === 341) return renderRssPage(g, pageNum, 'CRICKET',      'cricket');
  if (pageNum === 360) return renderRssPage(g, 360, 'FORMULA ONE', 'formula1');
  if (pageNum === 370 || pageNum === 374) return renderRssPage(g, pageNum, 'RUGBY UNION', 'rugbyU');
  if (pageNum === 380) return renderRssPage(g, 380, 'GOLF',         'golf');
  if (pageNum === 390) return renderLocalSport(g);
  return renderLocalSport(g);
}

module.exports = { render };
