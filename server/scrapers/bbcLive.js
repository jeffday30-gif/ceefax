// BBC Sport scraper for live match data. Fetches scores-fixtures pages for
// the World Cup, Premier League and Championship, then extracts the embedded
// `window.__INITIAL_DATA__` JSON blob (double-encoded - the assignment value
// is a JSON string whose decoded content is itself JSON).
//
// The data store is keyed by Apollo-style cache paths. We walk every store
// entry that looks like a fixtures payload and pull match events from
// `data.eventGroups[].secondaryGroups[].events[]`.

const axios = require('axios');
const cache = require('../cache');

const UA = 'Mozilla/5.0 (compatible; CeefaxReborn/0.1; +https://ceefax.onrender.com)';

const COMPETITIONS = [
  { key: 'worldCup',     slug: 'world-cup' },
  { key: 'premierLeague',slug: 'premier-league' },
  { key: 'championship', slug: 'championship' },
];

function isoDate(daysOffset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

async function fetchPage(slug, start, end) {
  const url = `https://www.bbc.co.uk/sport/football/${slug}/scores-fixtures` +
    (start && end ? `?selectedStartDate=${start}&selectedEndDate=${end}` : '');
  const { data } = await axios.get(url, {
    timeout: 12000,
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  return data;
}

function extractInitialData(html) {
  const m = html.match(/window\.__INITIAL_DATA__\s*=\s*"((?:[^"\\]|\\.)*)"/s);
  if (!m) return null;
  try {
    const outer = JSON.parse('"' + m[1] + '"');
    return JSON.parse(outer);
  } catch {
    return null;
  }
}

// Walk the store finding `eventGroups` arrays. Each entry in that array has
// `secondaryGroups[]` and each of those has `events[]` (the matches).
function findEventGroups(node, found, depth = 0) {
  if (depth > 14 || node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((v) => findEventGroups(v, found, depth + 1)); return; }
  for (const k of Object.keys(node)) {
    if (k === 'eventGroups' && Array.isArray(node[k])) {
      found.push(node[k]);
    } else {
      findEventGroups(node[k], found, depth + 1);
    }
  }
}

function statusLabel(event) {
  const raw = event.status || '';
  if (raw === 'PreEvent') return event.time && event.time.displayTimeUK || '';
  if (raw === 'PostEvent' || raw === 'FullTime' || raw === 'Finished') return 'FT';
  if (raw === 'HalfTime') return 'HT';
  if (raw === 'Postponed') return 'PPD';
  if (raw === 'Cancelled') return 'OFF';
  if (raw === 'Live' || raw === 'InProgress') {
    const min = event.minute || (event.statusComment && event.statusComment.value);
    return min ? String(min).slice(0, 5) : 'LIVE';
  }
  return event.statusComment && event.statusComment.value
    ? String(event.statusComment.value).slice(0, 5)
    : raw.slice(0, 5);
}

function scoreOf(side) {
  if (!side) return null;
  // BBC stores score under different keys depending on cache version.
  if (typeof side.score === 'number') return side.score;
  if (side.score && typeof side.score.value === 'number') return side.score.value;
  if (typeof side.goals === 'number') return side.goals;
  return null;
}

function teamName(side) {
  if (!side) return '';
  if (typeof side.shortName === 'string') return side.shortName;
  if (side.name && typeof side.name.shortName === 'string') return side.name.shortName;
  if (typeof side.fullName === 'string') return side.fullName;
  if (side.name && typeof side.name.fullName === 'string') return side.name.fullName;
  return '';
}

function normaliseEvent(event) {
  const hs = scoreOf(event.home);
  const as = scoreOf(event.away);
  const status = statusLabel(event);
  // Pull the group label out of eventGroupingLabel ("World - FIFA World Cup - Group Stage - Group C") if present.
  const groupMatch = (event.eventGroupingLabel || '').match(/Group [A-Z]$/);
  const stageText = groupMatch ? groupMatch[0] : ((event.stage && event.stage.name) || event.eventGroupingLabel || '');
  return {
    matchId:    event.id || (event.urn && event.urn.split(':').pop()),
    home:       teamName(event.home),
    away:       teamName(event.away),
    homeScore:  hs == null ? null : hs,
    awayScore:  as == null ? null : as,
    status,
    rawStatus:  event.status,
    kickoffISO: event.startDateTime || (event.date && event.date.iso),
    time:       event.time && event.time.displayTimeUK,
    stage:      stageText,
    venue:      event.venue && (event.venue.name || event.venue.shortName) || '',
    bbcUrl:     event.id ? `https://www.bbc.co.uk/sport/football/live/${event.id.replace(/^s-/, '')}` : null,
  };
}

function partitionByOutcome(events) {
  const finished = [];
  const live = [];
  const upcoming = [];
  for (const e of events) {
    const r = e.rawStatus;
    if (r === 'PostEvent' || r === 'FullTime' || r === 'Finished' || r === 'Cancelled' || r === 'Postponed') {
      finished.push(e);
    } else if (r === 'Live' || r === 'InProgress' || r === 'HalfTime') {
      live.push(e);
    } else {
      // PreEvent, Scheduled, PreMatch, etc.
      upcoming.push(e);
    }
  }
  return { finished, live, upcoming };
}

async function fetchCompetition(slug) {
  const today = isoDate(0);
  const yest = isoDate(-1);
  const tomorrow = isoDate(1);

  const [todayHtml, yestHtml] = await Promise.all([
    fetchPage(slug, today, tomorrow).catch(() => null),
    fetchPage(slug, yest, yest).catch(() => null),
  ]);

  const events = [];
  for (const html of [todayHtml, yestHtml]) {
    if (!html) continue;
    const data = extractInitialData(html);
    if (!data) continue;
    const groups = [];
    findEventGroups(data, groups);
    for (const eg of groups) {
      for (const top of eg) {
        const secondary = top.secondaryGroups || [];
        for (const sec of secondary) {
          const evs = sec.events || [];
          for (const e of evs) events.push(normaliseEvent(e));
        }
      }
    }
  }

  // Dedupe by matchId.
  const seen = new Set();
  const deduped = [];
  for (const e of events) {
    const key = e.matchId || (e.home + '|' + e.away + '|' + e.kickoffISO);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }
  return partitionByOutcome(deduped);
}

async function run() {
  const out = { fetchedAt: new Date().toISOString() };
  let anySuccess = false;
  for (const comp of COMPETITIONS) {
    try {
      const buckets = await fetchCompetition(comp.slug);
      const total = buckets.finished.length + buckets.live.length + buckets.upcoming.length;
      if (total > 0) anySuccess = true;
      out[comp.key] = buckets;
      console.log(`bbcLive: ${comp.key} fin=${buckets.finished.length} live=${buckets.live.length} upcoming=${buckets.upcoming.length}`);
    } catch (err) {
      console.warn(`bbcLive: ${comp.key} failed:`, err.message);
    }
  }
  if (!anySuccess) {
    console.warn('bbcLive: all competitions empty, leaving cache untouched');
    return;
  }
  cache.set('bbcLive', out);
}

module.exports = {
  // Every 5 minutes - tight enough for live matches without hammering BBC.
  schedule: '*/5 * * * *',
  run,
  name: 'bbcLive',
};
