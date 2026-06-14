const { Grid } = require('./grid');
const data = require('../data');
const { renderUnavailable, isEmpty } = require('./helpers');

const SECTION = 'C';

function bizFastext(g, current) {
  const map = {
    200: [{ label: 'BIZ NEWS', page: 201 }, { label: 'NEWS',    page: 101 }, { label: 'SPORT',   page: 301 }, { label: 'INDEX', page: 100 }],
    201: [{ label: 'INDEX',    page: 200 }, { label: 'NEWS',    page: 101 }, { label: 'SPORT',   page: 301 }, { label: 'TELETEXT', page: 100 }],
  };
  g.setFastext(map[current] || [
    { label: 'NEWS',     page: 101 },
    { label: 'SPORT',    page: 301 },
    { label: 'WEATHER',  page: 400 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function getBusinessNews() {
  const news = data.news().headlines || [];
  return news.filter(s => s.category === 'Business');
}

function renderIndex(g) {
  g.writeHeaderBand(200, 'BUSINESS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'BUSINESS', SECTION);
  const items = [
    ['Business news',     201, 'Y'],
    ['BBC News business', 101, 'R'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  row += 1;
  g.writeCentered(row++, 'LIVE MARKET DATA', 'Y', 'K');
  g.writeCentered(row++, '- - - - - - - - -', 'C', 'K');
  row++;
  g.writeWrapped(row, row + 4,
    'Live indices, shares and currency feeds need a paid market-data API. ' +
    'For now, business headlines via BBC News - tap the page below.',
    'W', 'K', 1);
  bizFastext(g, 200);
  g.writeFastextBar();
  return g.toJSON({ page: 200, subPage: 1, totalSubPages: 1, title: 'BUSINESS' });
}

function renderCity(g) {
  const stories = getBusinessNews();
  if (isEmpty(stories)) return renderUnavailable(201, 'CITY NEWS');
  g.writeHeaderBand(201, 'CITY', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'CITY NEWS', SECTION);
  let row = 4;
  for (const s of stories.slice(0, 6)) {
    if (row > 22) break;
    const link = s.link ? { l: s.link } : {};
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, s.title, 'C', 'K', 3, link);
    if (s.summary && row <= 22) {
      row = g.writeWrapped(row, 22, s.summary, 'W', 'K', 3, link);
    }
    row++;
  }
  bizFastext(g, 201);
  g.writeFastextBar();
  return g.toJSON({ page: 201, subPage: 1, totalSubPages: 1, title: 'CITY NEWS' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 200) return renderIndex(g);
  if (pageNum === 201) return renderCity(g);
  if (pageNum === 220 || pageNum === 230) return renderUnavailable(pageNum, pageNum === 220 ? 'SHARE PRICES' : 'CURRENCY', 'NO FREE LIVE MARKET FEED');
  return renderIndex(g);
}

module.exports = { render };
