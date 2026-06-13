const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'B';

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }

function statusColour(status) {
  if (status === 'CLEAR' || status === 'On time') return 'G';
  if (status === 'SLOW' || status === 'QUEUES' || status === 'Delays') return 'Y';
  if (status === 'CLOSED') return 'R';
  return 'W';
}

function travelFastext(g, current) {
  const map = {
    430: [{ label: 'AIRPORTS', page: 450 }, { label: 'WEATHER', page: 400 }, { label: 'INDEX',   page: 100 }, { label: 'CEEFAX', page: 100 }],
    450: [{ label: 'ROADS',    page: 430 }, { label: 'WEATHER', page: 400 }, { label: 'INDEX',   page: 100 }, { label: 'CEEFAX', page: 100 }],
  };
  g.setFastext(map[current] || [
    { label: 'TRAVEL', page: 430 },
    { label: 'WEATHER',page: 400 },
    { label: 'NEWS',   page: 101 },
    { label: 'INDEX',  page: 100 },
  ]);
}

function renderTravel(g) {
  g.writeHeaderBand(430, 'TRAVEL', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'ROAD & RAIL', SECTION);
  let row = 4;
  g.writeRow(row++, 'MOTORWAYS', 'Y', 'K', 1);
  for (const r of data.travel().roads) {
    if (row > 15) break;
    g.writeRow(row, pad(r.road, 6),                           'W', 'K', 2);
    g.writeRow(row, pad(r.junction, 14),                      'C', 'K', 9);
    g.writeRow(row, pad(r.status, 7),                         statusColour(r.status), 'K', 24);
    row++;
  }
  row = Math.max(row + 1, 17);
  g.writeRow(row++, 'RAIL', 'Y', 'K', 1);
  for (const line of data.travel().rail) {
    if (row > 22) break;
    row = g.writeWrapped(row, 22, '* ' + line, 'W', 'K', 1);
  }
  travelFastext(g, 430);
  g.writeFastextBar();
  return g.toJSON({ page: 430, subPage: 1, totalSubPages: 1, title: 'TRAVEL NEWS' });
}

function renderAirports(g) {
  g.writeHeaderBand(450, 'AIRPORTS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'AIRPORT STATUS', SECTION);
  g.writeRow(4, 'Airport',  'C', 'K', 2);
  g.writeRow(4, 'Status',   'C', 'K', 18);
  let row = 5;
  for (const a of data.travel().airports) {
    if (row > 22) break;
    g.writeRow(row, pad(a.name, 14),  'W', 'K', 2);
    g.writeRow(row, pad(a.status, 12),statusColour(a.status), 'K', 18);
    row++;
    if (a.delays && row <= 22) {
      row = g.writeWrapped(row, 22, a.delays, 'C', 'K', 4);
    }
  }
  travelFastext(g, 450);
  g.writeFastextBar();
  return g.toJSON({ page: 450, subPage: 1, totalSubPages: 1, title: 'AIRPORTS' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 450) return renderAirports(g);
  return renderTravel(g);
}

module.exports = { render };
