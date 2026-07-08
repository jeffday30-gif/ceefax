const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'G';

function setFastext(g) {
  g.setFastext([
    { label: 'WORLD CUP',page: 305 },
    { label: 'FOOTBALL', page: 302 },
    { label: 'SPORT',    page: 300 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function formatScorers(arr) {
  if (!Array.isArray(arr) || !arr.length) return '';
  return arr.map((s) => {
    const t = (s.times && s.times.length) ? ` ${s.times.join(',')}` : '';
    return `${s.player}${t}`;
  }).join(', ');
}

function writeMatchPair(g, row, e) {
  const home = String(e.home || '').slice(0, 11).padEnd(11, ' ');
  const away = String(e.away || '').slice(0, 11).padEnd(11, ' ');
  const link = e.bbcUrl ? { l: e.bbcUrl } : {};
  const scored = typeof e.homeScore === 'number' && typeof e.awayScore === 'number';
  const middle = scored ? `${e.homeScore}-${e.awayScore}` : ' v ';
  const isLive = /^\d+/.test(e.status) || e.status === 'LIVE' || e.status === 'HT';
  const statusColour = isLive ? 'R' : (e.status === 'FT' ? 'C' : 'W');
  g.writeRow(row, home, isLive ? 'Y' : 'W', 'K', 1, link);
  g.writeRow(row, middle.padStart(5, ' '), 'Y', 'K', 13);
  g.writeRow(row, away, isLive ? 'Y' : 'W', 'K', 19, link);
  g.writeRow(row, String(e.status || '').slice(0, 6).padStart(6, ' '), statusColour, 'K', 31, link);
  const homeS = formatScorers(e.homeScorers);
  const awayS = formatScorers(e.awayScorers);
  if (homeS || awayS) {
    const line = `${homeS}${homeS && awayS ? ' / ' : ''}${awayS}`.slice(0, 38);
    g.writeRow(row + 1, line, 'G', 'K', 1, link);
  } else if (e.competition) {
    g.writeRow(row + 1, String(e.competition).slice(0, 38), 'C', 'K', 1, link);
  }
}

function gatherEvents() {
  const bbc = data.bbcLive();
  if (!bbc) return { live: [], upcoming: [], finished: [] };
  // Merge across every competition bucket we have (all + per-comp), then dedupe.
  const live = [], upcoming = [], finished = [];
  const seen = new Set();
  for (const k of Object.keys(bbc)) {
    const b = bbc[k];
    if (!b || typeof b !== 'object' || !b.live) continue;
    for (const e of b.live)     { const id = e.matchId || `${e.home}|${e.away}|${e.kickoffISO}`; if (!seen.has(id)) { seen.add(id); live.push(e); } }
    for (const e of b.upcoming) { const id = e.matchId || `${e.home}|${e.away}|${e.kickoffISO}`; if (!seen.has(id)) { seen.add(id); upcoming.push(e); } }
    for (const e of b.finished) { const id = e.matchId || `${e.home}|${e.away}|${e.kickoffISO}`; if (!seen.has(id)) { seen.add(id); finished.push(e); } }
  }
  upcoming.sort((a, b) => (a.kickoffISO || '').localeCompare(b.kickoffISO || ''));
  finished.sort((a, b) => (b.kickoffISO || '').localeCompare(a.kickoffISO || ''));
  return { live, upcoming, finished };
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  const { live, upcoming, finished } = gatherEvents();

  if (data.isStale('bbcLive')) g.markStale();
  g.writeHeaderBand(318, 'LIVE SCORES', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'LIVE FOOTBALL SCORES', SECTION);

  let row = 4;

  if (live.length === 0 && upcoming.length === 0 && finished.length === 0) {
    g.writeCentered(10, 'NO MATCHES TRACKED', 'R', 'K');
    g.writeCentered(12, 'No live BBC football data right now.', 'W', 'K');
    setFastext(g);
    g.writeFastextBar();
    return g.toJSON({ page: 318, subPage: 1, totalSubPages: 1, title: 'LIVE SCORES' });
  }

  if (live.length > 0) {
    g.writeRow(row++, 'IN PLAY', 'Y', 'K', 1);
    for (const e of live.slice(0, 3)) {
      if (row > 13) break;
      writeMatchPair(g, row, e);
      row += 3;
    }
    row++;
  } else {
    g.writeCentered(row++, 'NO MATCHES CURRENTLY IN PLAY', 'C', 'K');
    row++;
  }

  if (finished.length > 0 && row < 18) {
    g.writeRow(row++, 'JUST FINISHED', 'Y', 'K', 1);
    for (const e of finished.slice(0, 2)) {
      if (row > 19) break;
      writeMatchPair(g, row, e);
      row += 3;
    }
  }

  if (upcoming.length > 0 && row < 22) {
    g.writeRow(row++, 'COMING UP', 'Y', 'K', 1);
    for (const e of upcoming.slice(0, 1)) {
      if (row > 22) break;
      writeMatchPair(g, row, e);
      row += 3;
    }
  }

  g.writeRow(23, 'TAP A MATCH FOR BBC LIVE TEXT', 'C', 'K', 0);
  setFastext(g);
  g.writeFastextBar();
  return g.toJSON({ page: 318, subPage: 1, totalSubPages: 1, title: 'LIVE SCORES' });
}

module.exports = { render };
