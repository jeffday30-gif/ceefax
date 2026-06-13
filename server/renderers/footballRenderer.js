const { Grid } = require('./grid');
const data = require('../data');
const { renderUnavailable, isEmpty } = require('./helpers');

const SECTION = 'G';
const PER_FIXTURE_PAGE = 8;
const TABLE_PER_PAGE = 18;

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }
function rpad(s, n) { return String(s).padStart(n, ' ').slice(-n); }

function bbcFootballHeadlines() {
  const sport = data.bbcSport();
  if (!sport) return [];
  return Array.isArray(sport.football) ? sport.football : [];
}

function fixturesRow(g, row, fx) {
  g.writeRow(row, pad(fx.home, 14), 'W', 'K', 0);
  g.writeRow(row, `${fx.homeScore}-${fx.awayScore}`, 'Y', 'K', 15);
  g.writeRow(row, pad(fx.away, 14), 'W', 'K', 21);
  g.writeRow(row, pad(fx.status || '', 5), 'C', 'K', 35);
}

function tableHeader(g, row) {
  g.writeRow(row, ' #',    'C', 'K', 0);
  g.writeRow(row, 'Team',  'C', 'K', 3);
  g.writeRow(row, 'P',     'C', 'K', 25);
  g.writeRow(row, 'GD',    'C', 'K', 29);
  g.writeRow(row, 'Pts',   'C', 'K', 35);
}

function tableRow(g, row, entry, tableLen) {
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
  const sport = data.bbcSport();
  const top = (sport && (sport.sport || sport.football)) || [];
  if (isEmpty(top)) return renderUnavailable(301, 'SPORT HEADLINES');
  g.writeHeaderBand(301, 'SPORT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'SPORT HEADLINES', SECTION);
  let row = 4;
  for (const h of top.slice(0, 6)) {
    if (row > 22) break;
    const link = h.link ? { l: h.link } : {};
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, h.title, 'C', 'K', 3, link);
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
  const headlines = bbcFootballHeadlines();
  if (!isEmpty(headlines)) {
    row += 1;
    g.writeRow(row++, 'LATEST', 'Y', 'K', 1);
    for (const h of headlines.slice(0, 3)) {
      if (row > 22) break;
      const link = h.link ? { l: h.link } : {};
      row = g.writeWrapped(row, 22, '* ' + h.title, 'W', 'K', 1, link);
    }
  }
  setFootyFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'FOOTBALL' });
}

function renderLiveScores(g, subPage) {
  const bbc = data.bbcLive();
  let events = [];
  if (bbc && bbc.premierLeague) {
    events = [...bbc.premierLeague.live, ...bbc.premierLeague.finished, ...bbc.premierLeague.upcoming];
  }
  // Fall back to football-data.org payload shape if BBC has nothing.
  if (isEmpty(events)) {
    const pl = data.football();
    const fixtures = (pl && pl.premierLeague && pl.premierLeague.fixtures) || [];
    if (isEmpty(fixtures)) return renderUnavailable(303, 'LIVE SCORES', 'NO PREMIER LEAGUE MATCHES THIS WEEKEND');
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
  // Use BBC live data - same writeMatchPair as WC.
  events.sort((a, b) => {
    const lA = /^\d+|^LIVE|^HT/.test(a.status) ? 0 : (a.status === 'FT' ? 2 : 1);
    const lB = /^\d+|^LIVE|^HT/.test(b.status) ? 0 : (b.status === 'FT' ? 2 : 1);
    if (lA !== lB) return lA - lB;
    return (a.kickoffISO || '').localeCompare(b.kickoffISO || '');
  });
  const perPage = 6;
  const total = Math.max(1, Math.ceil(events.length / perPage));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(303, 'SCORES', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, 'PREMIER LEAGUE - LIVE', SECTION);
  let row = 4;
  for (const e of events.slice((sub - 1) * perPage, sub * perPage)) {
    if (row > 21) break;
    const link = e.bbcUrl ? { l: e.bbcUrl } : {};
    const home = String(e.home || '').slice(0, 11).padEnd(11, ' ');
    const away = String(e.away || '').slice(0, 11).padEnd(11, ' ');
    const scored = typeof e.homeScore === 'number' && typeof e.awayScore === 'number';
    const middle = scored ? `${e.homeScore}-${e.awayScore}` : ' v ';
    const statusColour = /^\d+/.test(e.status) || e.status === 'LIVE' || e.status === 'HT' ? 'R'
                       : e.status === 'FT' ? 'C' : 'W';
    g.writeRow(row, home, 'W', 'K', 1, link);
    g.writeRow(row, middle.padStart(5, ' '), 'Y', 'K', 13, link);
    g.writeRow(row, away, 'W', 'K', 19, link);
    g.writeRow(row, String(e.status || '').slice(0, 6).padStart(6, ' '), statusColour, 'K', 31, link);
    row += 2;
  }
  g.writeRow(23, 'TAP A MATCH FOR BBC LIVE TEXT', 'C', 'K', 0);
  setFootyFastext(g, 303);
  g.writeFastextBar();
  return g.toJSON({ page: 303, subPage: sub, totalSubPages: total, title: 'LIVE SCORES' });
}

function renderUnavailableLower(g, pageNum, title) {
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
  const pl = data.football();
  const fixtures = ((pl && pl.premierLeague && pl.premierLeague.fixtures) || []).slice(0, 10);
  if (isEmpty(fixtures)) return renderUnavailable(306, 'SPORTSBOX');
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
  const headlines = bbcFootballHeadlines();
  if (isEmpty(headlines)) return renderUnavailable(312, 'FOOTBALL NEWS');
  g.writeHeaderBand(312, 'FOOTBALL NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'FOOTBALL NEWS', SECTION);
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
  setFootyFastext(g, 312);
  g.writeFastextBar();
  return g.toJSON({ page: 312, subPage: 1, totalSubPages: 1, title: 'FOOTBALL NEWS' });
}

function renderResults(g, subPage) {
  const f = data.football();
  const pl = (f && f.premierLeague && f.premierLeague.fixtures) || [];
  const ch = (f && f.championship && f.championship.fixtures) || [];
  const all = pl.concat(ch);
  if (isEmpty(all)) return renderUnavailable(316, 'FOOTBALL RESULTS');
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
  if (isEmpty(table)) return renderUnavailable(pageNum, title);
  const total = Math.max(1, Math.ceil(table.length / TABLE_PER_PAGE));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(pageNum, title.slice(0, 12), { subPage: sub, totalSubPages: total });
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
  const f = data.football();
  if (pageNum === 300) return renderSportIndex(g);
  if (pageNum === 301) return renderSportHeadlines(g);
  if (pageNum === 302 || pageNum === 320) return renderFootballIndex(g, pageNum);
  if (pageNum === 303) return renderLiveScores(g, subPage);
  if (pageNum === 304) return renderUnavailableLower(g, 304, 'DIVISION TWO');
  if (pageNum === 306) return renderSportsbox(g);
  if (pageNum === 312) return renderFootballNews(g);
  if (pageNum === 316) return renderResults(g, subPage);
  if (pageNum === 324) return renderTable(g, 324, 'PREMIER LEAGUE', (f && f.premierLeague && f.premierLeague.table) || [], subPage);
  if (pageNum === 325) return renderTable(g, 325, 'CHAMPIONSHIP',   (f && f.championship && f.championship.table) || [], subPage);
  return renderFootballIndex(g, pageNum);
}

module.exports = { render };
