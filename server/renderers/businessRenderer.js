const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'C';

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }
function rpad(s, n) { return String(s).padStart(n, ' ').slice(-n); }

function bizFastext(g, current) {
  const map = {
    200: [{ label: 'SHARES',   page: 220 }, { label: 'CURRENCY', page: 230 }, { label: 'CITY NEWS',page: 201 }, { label: 'INDEX', page: 100 }],
    201: [{ label: 'SHARES',   page: 220 }, { label: 'CURRENCY', page: 230 }, { label: 'NEWS',     page: 101 }, { label: 'INDEX', page: 200 }],
    220: [{ label: 'CURRENCY', page: 230 }, { label: 'CITY NEWS',page: 201 }, { label: 'INDEX',    page: 200 }, { label: 'CEEFAX',page: 100 }],
    230: [{ label: 'SHARES',   page: 220 }, { label: 'CITY NEWS',page: 201 }, { label: 'INDEX',    page: 200 }, { label: 'CEEFAX',page: 100 }],
  };
  g.setFastext(map[current] || [
    { label: 'HEADLINE', page: 101 },
    { label: 'SPORT',    page: 301 },
    { label: 'WEATHER',  page: 400 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function renderIndex(g) {
  g.writeHeaderBand(200, 'BUSINESS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'BUSINESS', SECTION);
  const items = [
    ['City news',         201, 'Y'],
    ['Share prices',      220, 'C'],
    ['Currency rates',    230, 'G'],
    ['Business news',     101, 'R'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  row += 1;
  g.writeRow(row++, 'MARKETS TODAY', 'Y', 'K', 1);
  for (const idx of data.business().indices.slice(0, 5)) {
    if (row > 22) break;
    g.writeRow(row, pad(idx.name, 12), 'W', 'K', 2);
    g.writeRow(row, rpad(idx.value.toFixed(1), 10), 'C', 'K', 15);
    const sign = idx.change >= 0 ? '+' : '';
    g.writeRow(row, rpad(`${sign}${idx.change.toFixed(2)}`, 8), idx.change >= 0 ? 'G' : 'R', 'K', 27);
    const pct = `${sign}${idx.percent.toFixed(2)}%`;
    g.writeRow(row, rpad(pct, 7), idx.percent >= 0 ? 'G' : 'R', 'K', 33);
    row++;
  }
  bizFastext(g, 200);
  g.writeFastextBar();
  return g.toJSON({ page: 200, subPage: 1, totalSubPages: 1, title: 'BUSINESS' });
}

function renderCity(g) {
  g.writeHeaderBand(201, 'CITY NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'CITY NEWS', SECTION);
  let row = 4;
  for (const h of data.business().headlines) {
    if (row > 22) break;
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, h, 'C', 'K', 3);
    row++;
  }
  bizFastext(g, 201);
  g.writeFastextBar();
  return g.toJSON({ page: 201, subPage: 1, totalSubPages: 1, title: 'CITY NEWS' });
}

function renderShares(g) {
  g.writeHeaderBand(220, 'SHARES', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'SHARE PRICES', SECTION);
  g.writeRow(4, 'Index',  'C', 'K', 2);
  g.writeRow(4, 'Value',  'C', 'K', 17);
  g.writeRow(4, 'Change', 'C', 'K', 30);
  let row = 5;
  for (const idx of data.business().indices) {
    if (row > 11) break;
    g.writeRow(row, pad(idx.name, 12), 'W', 'K', 2);
    g.writeRow(row, rpad(idx.value.toFixed(1), 10), 'C', 'K', 15);
    const sign = idx.change >= 0 ? '+' : '';
    g.writeRow(row, rpad(`${sign}${idx.change.toFixed(2)}`, 9), idx.change >= 0 ? 'G' : 'R', 'K', 28);
    row++;
  }
  row = Math.max(row + 1, 13);
  g.writeRow(row++, 'TOP SHARES', 'Y', 'K', 1);
  g.writeRow(row, 'Stock',  'C', 'K', 2);
  g.writeRow(row, 'Price',  'C', 'K', 22);
  g.writeRow(row, 'Chg',    'C', 'K', 33);
  row++;
  for (const s of data.business().topShares) {
    if (row > 22) break;
    g.writeRow(row, pad(s.name, 18), 'W', 'K', 2);
    g.writeRow(row, rpad(s.price.toFixed(1), 9), 'C', 'K', 22);
    const sign = s.change >= 0 ? '+' : '';
    g.writeRow(row, rpad(`${sign}${s.change.toFixed(1)}`, 6), s.change >= 0 ? 'G' : 'R', 'K', 32);
    row++;
  }
  bizFastext(g, 220);
  g.writeFastextBar();
  return g.toJSON({ page: 220, subPage: 1, totalSubPages: 1, title: 'SHARE PRICES' });
}

function renderCurrencies(g) {
  g.writeHeaderBand(230, 'CURRENCY', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'CURRENCY RATES', SECTION);
  g.writeRow(4, 'Pair',   'C', 'K', 2);
  g.writeRow(4, 'Rate',   'C', 'K', 18);
  g.writeRow(4, 'Change', 'C', 'K', 30);
  let row = 5;
  for (const c of data.business().currencies) {
    if (row > 22) break;
    g.writeRow(row, pad(c.pair, 10),                  'W', 'K', 2);
    g.writeRow(row, rpad(c.rate.toFixed(4), 10),      'C', 'K', 15);
    const sign = c.change >= 0 ? '+' : '';
    g.writeRow(row, rpad(`${sign}${c.change.toFixed(4)}`, 9), c.change >= 0 ? 'G' : 'R', 'K', 28);
    row++;
  }
  bizFastext(g, 230);
  g.writeFastextBar();
  return g.toJSON({ page: 230, subPage: 1, totalSubPages: 1, title: 'CURRENCY' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 200) return renderIndex(g);
  if (pageNum === 201) return renderCity(g);
  if (pageNum === 220) return renderShares(g);
  if (pageNum === 230) return renderCurrencies(g);
  return renderIndex(g);
}

module.exports = { render };
