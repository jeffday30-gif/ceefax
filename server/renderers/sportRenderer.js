const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'G';

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }
function rpad(s, n) { return String(s).padStart(n, ' ').slice(-n); }

function sportFastext(g) {
  g.setFastext([
    { label: 'SPORT',    page: 300 },
    { label: 'FOOTBALL', page: 302 },
    { label: 'WORLD CUP',page: 305 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function renderCricket(g, pageNum) {
  const { cricket } = data.sport();
  g.writeHeaderBand(pageNum, 'CRICKET', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'CRICKET', SECTION);
  let row = 4;
  row = g.writeWrapped(row, 7, cricket.summary, 'C', 'K', 0);
  row = Math.max(row + 1, 9);
  g.writeRow(row++, 'TOP SCORERS', 'Y', 'K', 1);
  for (const s of cricket.scorecard) {
    if (row > 16) break;
    g.writeRow(row, pad(s.player, 16), 'W', 'K', 2);
    g.writeRow(row, rpad(s.runs, 4),   'Y', 'K', 22);
    g.writeRow(row, rpad(`(${s.balls})`, 6), 'C', 'K', 28);
    row++;
  }
  row = Math.max(row + 1, 18);
  g.writeRow(row, 'NEXT:', 'C', 'K', 1);
  g.writeWrapped(row, 22, cricket.next, 'W', 'K', 7);
  sportFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'CRICKET' });
}

function renderF1(g) {
  const { formula1 } = data.sport();
  g.writeHeaderBand(360, 'F1', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'FORMULA ONE', SECTION);
  let row = 4;
  g.writeRow(row++, 'NEXT RACE', 'Y', 'K', 1);
  row = g.writeWrapped(row, 7, formula1.next, 'W', 'K', 1);
  row = Math.max(row + 1, 9);
  g.writeRow(row++, 'QUALIFYING', 'Y', 'K', 1);
  for (const q of formula1.qualifying) {
    if (row > 22) break;
    g.writeRow(row, rpad(q.pos, 2),     'C', 'K', 2);
    const fg = q.pos === 1 ? 'Y' : 'W';
    g.writeRow(row, pad(q.driver, 12),  fg, 'K', 5);
    g.writeRow(row, pad(q.team, 10),    'C', 'K', 18);
    g.writeRow(row, pad(q.time, 10),    'Y', 'K', 29);
    row++;
  }
  sportFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: 360, subPage: 1, totalSubPages: 1, title: 'FORMULA ONE' });
}

function renderRugby(g, pageNum) {
  g.writeHeaderBand(pageNum, 'RUGBY', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'RUGBY UNION', SECTION);
  let row = 4;
  g.writeRow(row++, 'RESULTS', 'Y', 'K', 1);
  for (const fx of data.sport().rugby.fixtures) {
    if (row > 22) break;
    g.writeRow(row, pad(fx.home, 12),     'W', 'K', 2);
    g.writeRow(row, `${fx.homeScore}-${fx.awayScore}`, 'Y', 'K', 17);
    g.writeRow(row, pad(fx.away, 12),     'W', 'K', 23);
    g.writeRow(row, pad(fx.status || '', 4), 'C', 'K', 36);
    row++;
  }
  sportFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'RUGBY UNION' });
}

function renderGolf(g) {
  const { golf } = data.sport();
  g.writeHeaderBand(380, 'GOLF', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'GOLF', SECTION);
  let row = 4;
  g.writeRow(row++, golf.tournament, 'C', 'K', 1);
  row++;
  g.writeRow(row++, 'LEADERBOARD', 'Y', 'K', 1);
  for (const p of golf.leaderboard) {
    if (row > 22) break;
    g.writeRow(row, rpad(p.pos, 2),    'C', 'K', 2);
    const fg = p.pos === 1 ? 'Y' : 'W';
    g.writeRow(row, pad(p.player, 18), fg, 'K', 5);
    g.writeRow(row, rpad(p.score, 5),  'Y', 'K', 30);
    row++;
  }
  sportFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: 380, subPage: 1, totalSubPages: 1, title: 'GOLF' });
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
  if (pageNum === 340 || pageNum === 341) return renderCricket(g, pageNum);
  if (pageNum === 360) return renderF1(g);
  if (pageNum === 370 || pageNum === 374) return renderRugby(g, pageNum);
  if (pageNum === 380) return renderGolf(g);
  if (pageNum === 390) return renderLocalSport(g);
  return renderLocalSport(g);
}

module.exports = { render };
