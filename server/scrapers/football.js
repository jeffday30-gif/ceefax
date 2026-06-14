// football-data.org scraper. Free tier requires registration for an API key.
// Set FOOTBALL_API_KEY in the environment. Without it, the scraper is a
// no-op and renderers fall back to the stub.
//
// Free-tier coverage relevant to us:
//   - Premier League (PL)      - standings + fixtures
//   - Championship (ELC)       - standings + fixtures
//   - FIFA World Cup (WC)      - matches + scorers
//
// Rate limit: 10 requests/minute. We make ~6 per run and run every 15 min
// during typical match hours.

const axios = require('axios');
const cache = require('../cache');

const BASE = 'https://api.football-data.org/v4';
const TIMEOUT = 10000;

function client() {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return null;
  return axios.create({
    baseURL: BASE,
    timeout: TIMEOUT,
    headers: { 'X-Auth-Token': key },
  });
}

const TEAM_ALIASES = new Map([
  ['United States',       'USA'],
  ['United States Of America', 'USA'],
  ['South Korea',         'S Korea'],
  ['Korea Republic',      'S Korea'],
  ['North Korea',         'N Korea'],
  ['Saudi Arabia',        'Saudi'],
  ['Bosnia-Herzegovina',  'Bosnia'],
  ['Czech Republic',      'Czechia'],
  ['New Zealand',         'NZ'],
  ['Republic of Ireland', 'Ireland'],
  ['Northern Ireland',    'N Ireland'],
  ['Switzerland',         'Swiss'],
  ['Netherlands',         'Holland'],
  ['Brighton & Hove Albion', 'Brighton'],
  ['Brighton Hove',       'Brighton'],
  ['Tottenham Hotspur',   'Tottenham'],
  ['Wolverhampton Wanderers', 'Wolves'],
  ['Nottingham Forest',   'Forest'],
  ['Sheffield United',    'Sheff Utd'],
  ['Sheffield Wednesday', 'Sheff Wed'],
  ['West Ham United',     'West Ham'],
  ['Leeds United',        'Leeds'],
  ['Newcastle United',    'Newcastle'],
  ['Crystal Palace',      'Crystal Pal'],
]);

function shortenTeam(name) {
  if (!name) return '';
  const trimmed = name.trim();
  if (TEAM_ALIASES.has(trimmed)) return TEAM_ALIASES.get(trimmed);
  return trimmed
    .replace(/\bFootball Club\b/gi, '')
    .replace(/\bFC\b/g, '')
    .replace(/\bAFC\b/g, '')
    .replace(/\bUnited\b/g, 'Utd')
    .replace(/Manchester/g, 'Man')
    .replace(/\s+/g, ' ')
    .trim();
}

const STAGE_LABELS = new Map([
  ['GROUP_STAGE',       'Group'],
  ['LAST_16',           'R16'],
  ['ROUND_OF_16',       'R16'],
  ['ROUND_OF_32',       'R32'],
  ['QUARTER_FINALS',    'QF'],
  ['SEMI_FINALS',       'SF'],
  ['THIRD_PLACE',       '3rd Pl'],
  ['FINAL',             'Final'],
  ['PRELIMINARY_ROUND', 'Prelim'],
]);

function stageLabel(stage, group) {
  if (group) return `Group ${group.replace(/^GROUP_/, '')}`;
  if (!stage) return '';
  return STAGE_LABELS.get(stage) || stage.replace(/_/g, ' ');
}

function statusOf(match) {
  if (match.status === 'FINISHED') return 'FT';
  if (match.status === 'IN_PLAY') return 'LIVE';
  if (match.status === 'PAUSED') return 'HT';
  if (match.status === 'POSTPONED') return 'PPD';
  if (match.status === 'SCHEDULED' || match.status === 'TIMED') {
    const t = match.utcDate ? new Date(match.utcDate) : null;
    if (t) {
      const hh = String(t.getUTCHours()).padStart(2, '0');
      const mm = String(t.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return '';
  }
  return match.status || '';
}

async function fetchCompetition(http, code) {
  const [tableRes, matchesRes] = await Promise.allSettled([
    http.get(`/competitions/${code}/standings`),
    http.get(`/competitions/${code}/matches`),
  ]);

  let table = [];
  if (tableRes.status === 'fulfilled') {
    const standings = tableRes.value.data.standings || [];
    const main = standings.find((s) => s.type === 'TOTAL') || standings[0];
    if (main) {
      table = main.table.map((row) => ({
        pos: row.position,
        team: shortenTeam(row.team && row.team.shortName) || shortenTeam(row.team && row.team.name),
        p: row.playedGames,
        gd: row.goalDifference,
        pts: row.points,
      }));
    }
  } else {
    console.warn(`football: standings ${code} failed:`, tableRes.reason && tableRes.reason.message);
  }

  let fixtures = [];
  if (matchesRes.status === 'fulfilled') {
    const matches = matchesRes.value.data.matches || [];
    // Most-recent finished plus next scheduled, capped at 16.
    const finished = matches
      .filter((m) => m.status === 'FINISHED')
      .sort((a, b) => (b.utcDate || '').localeCompare(a.utcDate || ''))
      .slice(0, 12);
    const upcoming = matches
      .filter((m) => m.status === 'SCHEDULED' || m.status === 'TIMED')
      .sort((a, b) => (a.utcDate || '').localeCompare(b.utcDate || ''))
      .slice(0, 4);
    fixtures = finished.concat(upcoming).slice(0, 16).map((m) => {
      const ft = m.score && m.score.fullTime;
      const played = m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED';
      return {
        home: shortenTeam(m.homeTeam && (m.homeTeam.shortName || m.homeTeam.name)),
        away: shortenTeam(m.awayTeam && (m.awayTeam.shortName || m.awayTeam.name)),
        homeScore: played && ft && ft.home != null ? ft.home : null,
        awayScore: played && ft && ft.away != null ? ft.away : null,
        status: statusOf(m),
      };
    });
  } else {
    console.warn(`football: matches ${code} failed:`, matchesRes.reason && matchesRes.reason.message);
  }

  return { table, fixtures };
}

async function fetchWorldCup(http) {
  const [matchesRes, scorersRes, standingsRes] = await Promise.allSettled([
    http.get('/competitions/WC/matches'),
    http.get('/competitions/WC/scorers?limit=10'),
    http.get('/competitions/WC/standings'),
  ]);

  const result = {};

  if (standingsRes.status === 'fulfilled') {
    const standings = standingsRes.value.data.standings || [];
    const groups = standings
      .filter((s) => s.group && (s.type === 'TOTAL' || !s.type))
      .map((s) => ({
        name: (s.group || '').replace(/^GROUP_/, ''),
        table: (s.table || []).map((row) => ({
          team: shortenTeam(row.team && (row.team.shortName || row.team.name)),
          p: row.playedGames,
          w: row.won,
          d: row.draw,
          l: row.lost,
          f: row.goalsFor,
          a: row.goalsAgainst,
          pts: row.points,
        })),
      }))
      .filter((g) => g.name && g.table.length);
    if (groups.length) result.groups = groups;
  } else {
    console.warn('football: WC standings failed:', standingsRes.reason && standingsRes.reason.message);
  }

  if (matchesRes.status === 'fulfilled') {
    const matches = matchesRes.value.data.matches || [];
    const today = new Date();
    const isSameDay = (a, b) => a.toDateString() === b.toDateString();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    // The complete tournament fixture list, sorted by kickoff. Used by
    // P306 so the user can paginate through every match.
    const allMatches = matches
      .filter((m) => m.utcDate)
      .sort((a, b) => a.utcDate.localeCompare(b.utcDate))
      .map((m) => {
        const t = new Date(m.utcDate);
        const ft = m.score && m.score.fullTime;
        const played = m.status === 'FINISHED';
        return {
          date: `${t.toLocaleDateString('en-GB', { weekday: 'short' })} ${t.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][t.getUTCMonth()]}`,
          time: `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`,
          venue: m.venue || '',
          home: shortenTeam(m.homeTeam && m.homeTeam.name),
          away: shortenTeam(m.awayTeam && m.awayTeam.name),
          homeScore: played && ft && ft.home != null ? ft.home : null,
          awayScore: played && ft && ft.away != null ? ft.away : null,
          status: played ? 'FT' : (m.status === 'IN_PLAY' ? 'LIVE' : (m.status === 'PAUSED' ? 'HT' : '')),
          stage: stageLabel(m.stage, m.group),
        };
      });

    const todayMatches = allMatches.filter((f, i) => {
      const m = matches[i];
      return m.utcDate && isSameDay(new Date(m.utcDate), today);
    });
    const yesterdayResults = matches
      .filter((m) => m.status === 'FINISHED' && m.utcDate && isSameDay(new Date(m.utcDate), yesterday))
      .map((m) => {
        const ft = m.score && m.score.fullTime;
        return {
          home: shortenTeam(m.homeTeam && m.homeTeam.name),
          away: shortenTeam(m.awayTeam && m.awayTeam.name),
          homeScore: ft && ft.home != null ? ft.home : null,
          awayScore: ft && ft.away != null ? ft.away : null,
          stage: stageLabel(m.stage, m.group),
          venue: m.venue || '',
        };
      });
    if (allMatches.length) result.allMatches = allMatches;
    if (todayMatches.length) result.todayFixtures = todayMatches;
    if (yesterdayResults.length) result.yesterdayResults = yesterdayResults;
  } else {
    console.warn('football: WC matches failed:', matchesRes.reason && matchesRes.reason.message);
  }

  if (scorersRes.status === 'fulfilled') {
    result.topScorers = (scorersRes.value.data.scorers || []).map((s) => ({
      player: (s.player && s.player.name) || '',
      team: shortenTeam(s.team && s.team.name),
      goals: s.goals || 0,
    }));
  }

  return result;
}

async function run() {
  const http = client();
  if (!http) {
    console.log('football: FOOTBALL_API_KEY not set, skipping scraper (using stub)');
    return;
  }

  try {
    // Sequence the competitions to stay under the 10-req/min cap.
    const pl = await fetchCompetition(http, 'PL');
    const ch = await fetchCompetition(http, 'ELC');
    const wc = await fetchWorldCup(http);

    const existing = cache.payload('football') || {};
    cache.set('football', {
      fetchedAt: new Date().toISOString(),
      headlines: existing.headlines || [
        'Premier League and Championship live',
        'Live tables and fixtures updated every 15 minutes',
      ],
      premierLeague: pl,
      championship: ch,
      topScorers: wc.topScorers && wc.topScorers.length
        ? wc.topScorers.slice(0, 5).map((s) => ({ player: s.player, team: s.team, goals: s.goals }))
        : (existing.topScorers || []),
    });

    if (wc.todayFixtures || wc.yesterdayResults || wc.topScorers || wc.groups || wc.allMatches) {
      const wcCache = cache.payload('worldcup') || {};
      cache.set('worldcup', {
        ...wcCache,
        fetchedAt: new Date().toISOString(),
        todayFixtures:     wc.todayFixtures     || wcCache.todayFixtures,
        yesterdayResults:  wc.yesterdayResults  || wcCache.yesterdayResults,
        topScorers:        wc.topScorers        || wcCache.topScorers,
        groups:            wc.groups            || wcCache.groups,
        allMatches:        wc.allMatches        || wcCache.allMatches,
      });
    }

    console.log(`football: cached PL (${pl.table.length} teams), ELC (${ch.table.length} teams), WC top scorers (${(wc.topScorers||[]).length})`);
  } catch (err) {
    console.warn('football: scraper failed:', err.message);
  }
}

module.exports = {
  // Every 15 minutes - balances freshness against the 10 req/min cap.
  schedule: '*/15 * * * *',
  run,
  name: 'football',
};
