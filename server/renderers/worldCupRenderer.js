const { Grid } = require('./grid');
const data = require('../data');
const { renderUnavailable, isEmpty } = require('./helpers');

const SECTION = 'G';
const PER_FIXTURE_PAGE = 6;

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }
function rpad(s, n) { return String(s).padStart(n, ' ').slice(-n); }

function setWCFastext(g, current) {
  const map = {
    305: [{ label: 'FIXTURES', page: 306 }, { label: 'RESULTS', page: 307 }, { label: 'GROUPS', page: 326 }, { label: 'FOOTBALL', page: 302 }],
    306: [{ label: 'RESULTS',  page: 307 }, { label: 'GROUPS',  page: 326 }, { label: 'TOP SCRS', page: 328 }, { label: 'WC INDEX', page: 305 }],
    307: [{ label: 'FIXTURES', page: 306 }, { label: 'GROUPS',  page: 326 }, { label: 'KNOCKOUT', page: 327 }, { label: 'WC INDEX', page: 305 }],
    326: [{ label: 'FIXTURES', page: 306 }, { label: 'KNOCKOUT',page: 327 }, { label: 'TOP SCRS', page: 328 }, { label: 'WC INDEX', page: 305 }],
    327: [{ label: 'GROUPS',   page: 326 }, { label: 'TOP SCRS',page: 328 }, { label: 'WC NEWS',  page: 329 }, { label: 'WC INDEX', page: 305 }],
    328: [{ label: 'GROUPS',   page: 326 }, { label: 'KNOCKOUT',page: 327 }, { label: 'WC NEWS',  page: 329 }, { label: 'WC INDEX', page: 305 }],
    329: [{ label: 'WC INDEX', page: 305 }, { label: 'FIXTURES',page: 306 }, { label: 'GROUPS',   page: 326 }, { label: 'FOOTBALL', page: 302 }],
  };
  g.setFastext(map[current] || [
    { label: 'SPORT',   page: 301 },
    { label: 'WEATHER', page: 400 },
    { label: 'NEWS',    page: 101 },
    { label: 'INDEX',   page: 100 },
  ]);
}

function wcHeadlines() {
  const sport = data.bbcSport();
  if (sport && Array.isArray(sport.worldCup) && sport.worldCup.length) return sport.worldCup;
  if (sport && Array.isArray(sport.football) && sport.football.length) return sport.football;
  return [];
}

function renderIndex(g) {
  const wc = data.worldcup();
  g.writeHeaderBand(305, 'WORLD CUP', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, wc.tournament || 'WORLD CUP 2026', SECTION);
  if (wc.hosts) g.writeCentered(4, wc.hosts.toUpperCase(), 'C', 'K');
  if (wc.dates) g.writeCentered(5, wc.dates, 'Y', 'K');

  const items = [
    ["Today's fixtures",   306],
    ["Yesterday's results",307],
    ['Group tables',       326],
    ['Knockout bracket',   327],
    ['Top scorers',        328],
    ['World Cup news',     329],
    ['Football index',     302],
  ];
  let row = 8;
  for (const [label, page] of items) {
    g.writeRow(row, label, 'C', 'K', 3);
    g.writeRow(row, String(page), 'Y', 'K', 30);
    row++;
  }
  const headlines = wcHeadlines();
  if (!isEmpty(headlines)) {
    row += 1;
    g.writeRow(row++, 'LATEST', 'Y', 'K', 1);
    for (const h of headlines.slice(0, 3)) {
      if (row > 22) break;
      const link = h.link ? { l: h.link } : {};
      row = g.writeWrapped(row, 22, '* ' + h.title, 'W', 'K', 1, link);
    }
  }
  setWCFastext(g, 305);
  g.writeFastextBar();
  return g.toJSON({ page: 305, subPage: 1, totalSubPages: 1, title: 'WORLD CUP' });
}

function renderFixtures(g) {
  const wc = data.worldcup();
  const fixtures = wc.todayFixtures || [];
  if (isEmpty(fixtures)) return renderUnavailable(306, "TODAY'S FIXTURES", 'NO MATCHES TODAY OR DATA NOT YET LOADED');
  g.writeHeaderBand(306, "TODAY'S FIXTURES", { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, "WORLD CUP TODAY", SECTION);
  let row = 4;
  for (const f of fixtures) {
    if (row > 21) break;
    g.writeRow(row, f.time, 'Y', 'K', 1);
    g.writeRow(row, pad(f.stage, 9), 'C', 'K', 7);
    g.writeRow(row, pad(f.home, 10), 'W', 'K', 17);
    g.writeRow(row, ' v ', 'Y', 'K', 28);
    g.writeRow(row, pad(f.away, 10), 'W', 'K', 31);
    row++;
    if (f.venue) g.writeRow(row, pad(f.venue, 30), 'C', 'K', 7);
    row += 2;
  }
  setWCFastext(g, 306);
  g.writeFastextBar();
  return g.toJSON({ page: 306, subPage: 1, totalSubPages: 1, title: "TODAY'S FIXTURES" });
}

function renderResults(g, subPage) {
  const results = data.worldcup().yesterdayResults || [];
  if (isEmpty(results)) return renderUnavailable(307, 'RESULTS', 'NO RESULTS YESTERDAY OR DATA NOT YET LOADED');
  const total = Math.max(1, Math.ceil(results.length / PER_FIXTURE_PAGE));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(307, 'RESULTS', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, "WORLD CUP RESULTS", SECTION);
  let row = 4;
  const slice = results.slice((sub - 1) * PER_FIXTURE_PAGE, sub * PER_FIXTURE_PAGE);
  for (const f of slice) {
    if (row > 21) break;
    g.writeRow(row, pad(f.stage, 9), 'C', 'K', 1);
    g.writeRow(row, pad(f.home, 11), 'W', 'K', 11);
    g.writeRow(row, `${f.homeScore}-${f.awayScore}`, 'Y', 'K', 23);
    g.writeRow(row, pad(f.away, 11), 'W', 'K', 28);
    row++;
    if (f.venue) g.writeRow(row, pad(f.venue, 30), 'C', 'K', 11);
    row += 2;
  }
  setWCFastext(g, 307);
  g.writeFastextBar();
  return g.toJSON({ page: 307, subPage: sub, totalSubPages: total, title: 'RESULTS' });
}

function renderGroupTables(g, subPage) {
  const groups = data.worldcup().groups || [];
  if (isEmpty(groups)) return renderUnavailable(326, 'GROUP TABLES', 'GROUPS NOT YET CONFIRMED');
  const total = groups.length;
  const sub = Math.min(Math.max(1, subPage), total);
  const group = groups[sub - 1];
  g.writeHeaderBand(326, `GROUP ${group.name}`, { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, `WORLD CUP - GROUP ${group.name}`, SECTION);
  g.writeRow(4, 'Team',  'C', 'K', 2);
  g.writeRow(4, 'P',     'C', 'K', 18);
  g.writeRow(4, 'W',     'C', 'K', 21);
  g.writeRow(4, 'D',     'C', 'K', 24);
  g.writeRow(4, 'L',     'C', 'K', 27);
  g.writeRow(4, 'F',     'C', 'K', 30);
  g.writeRow(4, 'A',     'C', 'K', 33);
  g.writeRow(4, 'Pts',   'C', 'K', 36);
  let row = 6;
  for (let i = 0; i < group.table.length; i++) {
    const t = group.table[i];
    const fg = i === 0 ? 'Y' : (i === 1 ? 'W' : 'C');
    g.writeRow(row, pad(t.team, 14),    fg, 'K', 2);
    g.writeRow(row, rpad(t.p, 2),       fg, 'K', 17);
    g.writeRow(row, rpad(t.w, 2),       fg, 'K', 20);
    g.writeRow(row, rpad(t.d, 2),       fg, 'K', 23);
    g.writeRow(row, rpad(t.l, 2),       fg, 'K', 26);
    g.writeRow(row, rpad(t.f, 2),       fg, 'K', 29);
    g.writeRow(row, rpad(t.a, 2),       fg, 'K', 32);
    g.writeRow(row, rpad(t.pts, 3),     fg, 'K', 35);
    row += 2;
  }
  setWCFastext(g, 326);
  g.writeFastextBar();
  return g.toJSON({ page: 326, subPage: sub, totalSubPages: total, title: `GROUP ${group.name}` });
}

function renderKnockout(g) {
  g.writeHeaderBand(327, 'KNOCKOUT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, "WORLD CUP - KNOCKOUT", SECTION);
  g.writeCentered(4, 'ROUND OF 32 - FROM 27 JUN', 'Y', 'K');
  g.writeCentered(6, '48 teams - Group winners and', 'W', 'K');
  g.writeCentered(7, 'runners-up plus 8 best 3rds', 'W', 'K');
  g.writeCentered(8, 'enter the knockout stage.', 'W', 'K');

  g.writeRow(11, 'KEY DATES', 'Y', 'K', 1);
  const dates = [
    ['Group stage ends',      'Wed 24 Jun'],
    ['Round of 32',           'Sat 27 Jun'],
    ['Round of 16',           'Sat  4 Jul'],
    ['Quarter-finals',        'Thu  9 Jul'],
    ['Semi-finals',           'Tue 14 Jul'],
    ['Third-place play-off',  'Sat 18 Jul'],
    ['FINAL',                 'Sun 19 Jul'],
  ];
  let row = 13;
  for (const [label, when] of dates) {
    g.writeRow(row, label, 'C', 'K', 3);
    g.writeRow(row, when,  'W', 'K', 25);
    row++;
  }
  setWCFastext(g, 327);
  g.writeFastextBar();
  return g.toJSON({ page: 327, subPage: 1, totalSubPages: 1, title: 'KNOCKOUT' });
}

function renderTopScorers(g) {
  const scorers = data.worldcup().topScorers || [];
  if (isEmpty(scorers)) return renderUnavailable(328, 'TOP SCORERS');
  g.writeHeaderBand(328, 'TOP SCORERS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, "WORLD CUP - GOLDEN BOOT", SECTION);
  g.writeRow(4, 'Player',    'C', 'K', 2);
  g.writeRow(4, 'Team',      'C', 'K', 20);
  g.writeRow(4, 'Gls',       'C', 'K', 35);
  let row = 6;
  for (let i = 0; i < scorers.length; i++) {
    if (row > 22) break;
    const s = scorers[i];
    const fg = i === 0 ? 'Y' : 'W';
    g.writeRow(row, pad(s.player, 16), fg, 'K', 2);
    g.writeRow(row, pad(s.team,   13), 'C', 'K', 20);
    g.writeRow(row, rpad(s.goals,  3), 'Y', 'K', 35);
    row++;
  }
  setWCFastext(g, 328);
  g.writeFastextBar();
  return g.toJSON({ page: 328, subPage: 1, totalSubPages: 1, title: 'TOP SCORERS' });
}

function renderWCNews(g) {
  const headlines = wcHeadlines();
  if (isEmpty(headlines)) return renderUnavailable(329, 'WORLD CUP NEWS');
  g.writeHeaderBand(329, 'WC NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, "WORLD CUP NEWS", SECTION);
  let row = 4;
  for (const h of headlines.slice(0, 6)) {
    if (row > 22) break;
    const link = h.link ? { l: h.link } : {};
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, h.title, 'C', 'K', 3, link);
    if (h.summary && row <= 22) {
      row = g.writeWrapped(row, 22, h.summary, 'W', 'K', 3, link);
    }
    row++;
  }
  setWCFastext(g, 329);
  g.writeFastextBar();
  return g.toJSON({ page: 329, subPage: 1, totalSubPages: 1, title: 'WORLD CUP NEWS' });
}

function render(pageNum, { subPage = 1 } = {}) {
  const g = new Grid();
  if (pageNum === 305) return renderIndex(g);
  if (pageNum === 306) return renderFixtures(g);
  if (pageNum === 307) return renderResults(g, subPage);
  if (pageNum === 326) return renderGroupTables(g, subPage);
  if (pageNum === 327) return renderKnockout(g);
  if (pageNum === 328) return renderTopScorers(g);
  if (pageNum === 329) return renderWCNews(g);
  return renderIndex(g);
}

module.exports = { render };
