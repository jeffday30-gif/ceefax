const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'G';
const PER_FIXTURE_PAGE = 8;
const TABLE_PER_PAGE = 18;

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }
function rpad(s, n) { return String(s).padStart(n, ' ').slice(-n); }

function fixturesRow(g, row, fx) {
  // Team names white, score yellow, "FT"/status white.
  g.writeRow(row, pad(fx.home, 14), 'W', 'K', 0);
  g.writeRow(row, `${fx.homeScore}-${fx.awayScore}`, 'Y', 'K', 15);
  g.writeRow(row, pad(fx.away, 14), 'W', 'K', 21);
  g.writeRow(row, pad(fx.status || '', 5), 'C', 'K', 35);
}

function tableHeader(g, row) {
  // Cyan column headers per Ceefax convention.
  g.writeRow(row, ' #',    'C', 'K', 0);
  g.writeRow(row, 'Team',  'C', 'K', 3);
  g.writeRow(row, 'P',     'C', 'K', 25);
  g.writeRow(row, 'GD',    'C', 'K', 29);
  g.writeRow(row, 'Pts',   'C', 'K', 35);
}

function tableRow(g, row, entry, tableLen) {
  // Authentic convention: leader yellow, mid-table white, bottom-3 red.
  let fg = 'W';
  if (entry.pos === 1) fg = 'Y';
  else if (entry.pos > tableLen - 3) fg = 'R';
  g.writeRow(row, rpad(entry.pos, 2),       fg, 'K', 0);
  g.writeRow(row, pad(entry.team, 20),      fg, 'K', 3);
  g.writeRow(row, rpad(entry.p, 3),         fg, 'K', 24);
  const gd = entry.gd > 0 ? `+${entry.gd}` : String(entry.gd);
  g.writeRow(row, rpad(gd, 4),              fg, 'K', 28);
  g.writeRow(row, rpad(entry.pts, 3),       'Y', 'K', 34);
}

function setFootyFastext(g, current) {
  const map = {
    300: [{ label: 'FOOTBALL',  page: 302 }, { label: 'CRICKET',  page: 340 }, { label: 'WORLD CUP', page: 305 }, { label: 'TV SPORT', page: 680 }],
    301: [{ label: 'FOOTBALL',  page: 302 }, { label: 'WORLD CUP',page: 305 }, { label: 'CRICKET',   page: 340 }, { label: 'SPORT',    page: 300 }],
    302: [{ label: 'PL SCORES', page: 303 }, { label: 'PL TABLE', page: 324 }, { label: 'WORLD CUP', page: 305 }, { label: 'SPORT',    page: 300 }],
    303: [{ label: 'CHAMP',     page: 325 }, { label: 'PL TABLE', page: 324 }, { label: 'RESULTS',   page: 316 }, { label: 'FOOTBALL', page: 302 }],
    306: [{ label: 'PL SCORES', page: 303 }, { label: 'WORLD CUP',page: 305 }, { label: 'RESULTS',   page: 316 }, { label: 'FOOTBALL', page: 302 }],
    312: [{ label: 'SCORES',    page: 303 }, { label: 'PL TABLE', page: 324 }, { label: 'WORLD CUP', page: 305 }, { label: 'FOOTBALL', page: 302 }],
    316: [{ label: 'PL TABLE',  page: 324 }, { label: 'CHAMP',    page: 325 }, { label: 'PL SCORES', page: 303 }, { label: 'FOOTBALL', page: 302 }],
    320: [{ label: 'PL SCORES', page: 303 }, { label: 'PL TABLE', page: 324 }, { label: 'WORLD CUP', page: 305 }, { label: 'SPORT',    page: 300 }],
    324: [{ label: 'CHAMP',     page: 325 }, { label: 'PL SCORES',page: 303 }, { label: 'RESULTS',   page: 316 }, { label: 'FOOTBALL', page: 302 }],
    325: [{ label: 'PL TABLE',  page: 324 }, { label: 'PL SCORES',page: 303 }, { label: 'RESULTS',   page: 316 }, { label: 'FOOTBALL', page: 302 }],
  };
  g.setFastext(map[current] || [
    { label: 'FOOTBALL', page: 302 },
    { label: 'WORLD CUP',page: 305 },
    { label: 'WEATHER',  page: 400 },
    { label: 'SPORT',    page: 300 },
  ]);
}

function renderSportIndex(g) {
  g.writeHeaderBand(300, 'SPORT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'BBC SPORT', SECTION);
  const items = [
    ['Sport headlines',   301, 'Y'],
    ['WORLD CUP 2026',    305, 'R'],
    ['Football',          302, 'G'],
    ['Premier League',    324, 'G'],
    ['Championship',      325, 'G'],
    ['Football results',  316, 'G'],
    ['Cricket',           340, 'Y'],
    ['Formula One',       360, 'M'],
    ['Rugby Union',       370, 'C'],
    ['Golf',              380, 'W'],
    ['Horse racing',      660, 'M'],
    ['Sport on TV today', 680, 'C'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  setFootyFastext(g, 300);
  g.writeFastextBar();
  return g.toJSON({ page: 300, subPage: 1, totalSubPages: 1, title: 'SPORT' });
}

function renderSportHeadlines(g) {
  const headlines = data.worldcup().headlines
    .concat(data.sport().headlines)
    .concat(data.football().headlines)
    .slice(0, 7);
  g.writeHeaderBand(301, 'SPORT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'SPORT HEADLINES', SECTION);
  let row = 4;
  for (const h of headlines) {
    if (row > 22) break;
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, h, 'C', 'K', 3);
    row++;
  }
  setFootyFastext(g, 301);
  g.writeFastextBar();
  return g.toJSON({ page: 301, subPage: 1, totalSubPages: 1, title: 'SPORT HEADLINES' });
}

function renderFootballIndex(g, pageNum) {
  g.writeHeaderBand(pageNum, 'FOOTBALL', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'FOOTBALL', SECTION);
  const items = [
    ['WORLD CUP 2026',        305, 'R'],
    ['Premier League scores', 303, 'Y'],
    ['Championship scores',   303, 'Y'],
    ['Sportsbox',             306, 'Y'],
    ['Football news',         312, 'C'],
    ['Football results',      316, 'C'],
    ['Premier League table',  324, 'W'],
    ['Championship table',    325, 'W'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  row += 1;
  g.writeRow(row++, 'TOP STORIES', 'Y', 'K', 1);
  for (const h of data.football().headlines.slice(0, 4)) {
    if (row > 22) break;
    row = g.writeWrapped(row, 22, '* ' + h, 'W', 'K', 1);
  }
  setFootyFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'FOOTBALL' });
}

function renderLiveScores(g, subPage) {
  const fixtures = data.football().premierLeague.fixtures;
  const total = Math.max(1, Math.ceil(fixtures.length / PER_FIXTURE_PAGE));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(303, 'SCORES', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, 'PREMIER LEAGUE - LIVE', SECTION);
  const slice = fixtures.slice((sub - 1) * PER_FIXTURE_PAGE, sub * PER_FIXTURE_PAGE);
  let row = 4;
  for (const fx of slice) {
    if (row > 22) break;
    fixturesRow(g, row, fx);
    row += 2;
  }
  setFootyFastext(g, 303);
  g.writeFastextBar();
  return g.toJSON({ page: 303, subPage: sub, totalSubPages: total, title: 'LIVE SCORES' });
}

function renderUnavailable(g, pageNum, title) {
  g.writeHeaderBand(pageNum, title, { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, title, SECTION);
  g.writeCentered(10, 'DATA UNAVAILABLE', 'R', 'K');
  g.writeCentered(12, 'Lower divisions are not covered', 'W', 'K');
  g.writeCentered(13, 'on the free data tier.', 'W', 'K');
  setFootyFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title });
}

function renderSportsbox(g) {
  const fixtures = data.football().premierLeague.fixtures.slice(0, 10);
  g.writeHeaderBand(306, 'SPORTSBOX', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'LIVE SCORES', SECTION);
  let row = 4;
  for (const fx of fixtures) {
    if (row > 22) break;
    fixturesRow(g, row, fx);
    row++;
  }
  setFootyFastext(g, 306);
  g.writeFastextBar();
  return g.toJSON({ page: 306, subPage: 1, totalSubPages: 1, title: 'SPORTSBOX' });
}

function renderFootballNews(g) {
  g.writeHeaderBand(312, 'NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'FOOTBALL NEWS', SECTION);
  let row = 4;
  for (const h of data.football().headlines) {
    if (row > 14) break;
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 14, h, 'C', 'K', 3);
    row++;
  }
  row = Math.max(row, 15);
  g.writeRow(row++, 'TOP SCORERS', 'Y', 'K', 1);
  for (const s of data.football().topScorers.slice(0, 5)) {
    if (row > 22) break;
    g.writeRow(row, pad(s.player, 14), 'W', 'K', 3);
    g.writeRow(row, pad(s.team, 12),   'C', 'K', 18);
    g.writeRow(row, rpad(s.goals, 2),  'Y', 'K', 36);
    row++;
  }
  setFootyFastext(g, 312);
  g.writeFastextBar();
  return g.toJSON({ page: 312, subPage: 1, totalSubPages: 1, title: 'FOOTBALL NEWS' });
}

function renderResults(g, subPage) {
  const pl = data.football().premierLeague.fixtures;
  const ch = data.football().championship.fixtures;
  const all = pl.concat(ch);
  const total = Math.max(1, Math.ceil(all.length / PER_FIXTURE_PAGE));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(316, 'RESULTS', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, 'FOOTBALL RESULTS', SECTION);
  const slice = all.slice((sub - 1) * PER_FIXTURE_PAGE, sub * PER_FIXTURE_PAGE);
  let row = 4;
  for (const fx of slice) {
    if (row > 22) break;
    fixturesRow(g, row, fx);
    row += 2;
  }
  setFootyFastext(g, 316);
  g.writeFastextBar();
  return g.toJSON({ page: 316, subPage: sub, totalSubPages: total, title: 'RESULTS' });
}

function renderTable(g, pageNum, title, table, subPage) {
  const total = Math.max(1, Math.ceil(table.length / TABLE_PER_PAGE));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(pageNum, title, { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, title, SECTION);
  tableHeader(g, 4);
  const slice = table.slice((sub - 1) * TABLE_PER_PAGE, sub * TABLE_PER_PAGE);
  let row = 5;
  for (const entry of slice) {
    if (row > 22) break;
    tableRow(g, row, entry, table.length);
    row++;
  }
  setFootyFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: sub, totalSubPages: total, title });
}

function render(pageNum, { subPage = 1 } = {}) {
  const g = new Grid();
  if (pageNum === 300) return renderSportIndex(g);
  if (pageNum === 301) return renderSportHeadlines(g);
  if (pageNum === 302 || pageNum === 320) return renderFootballIndex(g, pageNum);
  if (pageNum === 303) return renderLiveScores(g, subPage);
  if (pageNum === 304) return renderUnavailable(g, 304, 'DIVISION TWO');
  if (pageNum === 306) return renderSportsbox(g);
  if (pageNum === 312) return renderFootballNews(g);
  if (pageNum === 316) return renderResults(g, subPage);
  if (pageNum === 324) return renderTable(g, 324, 'PREMIER LEAGUE', data.football().premierLeague.table, subPage);
  if (pageNum === 325) return renderTable(g, 325, 'CHAMPIONSHIP',   data.football().championship.table, subPage);
  return renderFootballIndex(g, pageNum);
}

module.exports = { render };
