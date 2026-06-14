// TV schedule scraper. BBC channels come from BBC's own server-rendered
// schedule pages (full listings for the day). ITV/Channel 4/Channel 5
// fall back to TVmaze's GB schedule (sparser but free, no key).

const axios = require('axios');
const cache = require('../cache');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120 Safari/537.36';

// PIDs are stable BBC programme identifiers for each channel.
const BBC_CHANNELS = [
  { name: 'BBC One', pid: 'p00fzl6p' },
  { name: 'BBC Two', pid: 'p00fzl68' },
];

const TVMAZE_CHANNELS = {
  'ITV':       ['ITV', 'ITV1'],
  'Channel 4': ['Channel 4'],
  'Channel 5': ['Channel 5'],
};

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Parse BBC's schedule HTML. Each broadcast block has:
//   <h3 class="broadcast__time" ... content="2026-06-14T06:00:00+01:00">
//     <span class="timezone--time">06:00</span>
//   ...
//   <div class="programme programme--tv ..." data-pid="m002xsnv">
//   ...
//   <span class="programme__title delta"><span>Breakfast</span></span>
//
// We pull (time, title, pid) for each broadcast and turn the pid into a
// /programmes/{pid} link.
function parseBbcSchedule(html) {
  const items = [];
  // Anchor on the broadcast__time block - one per programme.
  const re = /<h3 class="broadcast__time[^"]*"[^>]*content="([^"]+)"[^>]*>\s*<span class="timezone--time">([^<]+)<\/span>[\s\S]*?data-pid="([^"]+)"[\s\S]*?programme__title\s+delta[^>]*>\s*<span>([^<]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, , timeText, pid, title] = m;
    items.push({
      time: timeText.trim(),
      title: title.replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim(),
      url: `https://www.bbc.co.uk/programmes/${pid}`,
    });
  }
  return items;
}

async function fetchBbcChannel({ name, pid }) {
  try {
    const { data } = await axios.get(`https://www.bbc.co.uk/schedules/${pid}`, {
      timeout: 12000,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    });
    const items = parseBbcSchedule(data);
    return { name, items };
  } catch (err) {
    console.warn(`tv: ${name} fetch failed:`, err.message);
    return { name, items: [] };
  }
}

function matchTvmazeChannel(networkName) {
  for (const [key, names] of Object.entries(TVMAZE_CHANNELS)) {
    if (names.includes(networkName)) return key;
  }
  return null;
}

async function fetchTvmaze() {
  const buckets = {};
  for (const key of Object.keys(TVMAZE_CHANNELS)) buckets[key] = [];
  try {
    const url = `https://api.tvmaze.com/schedule?country=GB&date=${todayDate()}`;
    const { data: items } = await axios.get(url, { timeout: 10000 });
    if (!Array.isArray(items)) return buckets;
    for (const item of items) {
      const network = item.show && (item.show.network || item.show.webChannel);
      const channelKey = matchTvmazeChannel(network && network.name);
      if (!channelKey) continue;
      if (!item.airtime) continue;
      const showUrl = (item.show && (item.show.officialSite || item.show.url)) || null;
      buckets[channelKey].push({
        time: item.airtime,
        title: (item.show && item.show.name) || item.name || '(no title)',
        url: showUrl,
      });
    }
  } catch (err) {
    console.warn('tv: TVmaze fetch failed:', err.message);
  }
  return buckets;
}

async function run() {
  const channels = {};

  // BBC channels - rich listings
  const bbcResults = await Promise.all(BBC_CHANNELS.map(fetchBbcChannel));
  for (const { name, items } of bbcResults) {
    channels[name] = items.slice(0, 25);
  }

  // Commercial channels - TVmaze fallback
  const tvmaze = await fetchTvmaze();
  for (const [key, items] of Object.entries(tvmaze)) {
    items.sort((a, b) => a.time.localeCompare(b.time));
    channels[key] = items.slice(0, 25);
  }

  const total = Object.values(channels).reduce((n, list) => n + list.length, 0);
  if (total === 0) {
    console.warn('tv: every channel empty, leaving cache untouched');
    return;
  }

  cache.set('tv', {
    fetchedAt: new Date().toISOString(),
    channels,
  });
  console.log(`tv: cached ${total} shows: ` +
    Object.entries(channels).map(([k, v]) => `${k}=${v.length}`).join(' '));
}

module.exports = {
  // Every 2 hours - listings don't change minute-to-minute.
  schedule: '0 */2 * * *',
  run,
  name: 'tv',
};
