// TVmaze schedule scraper. Free, no API key required.
// Pulls today's GB schedule and groups by the five terrestrial channels.

const axios = require('axios');
const cache = require('../cache');

const CHANNELS = {
  'BBC One':   ['BBC One'],
  'BBC Two':   ['BBC Two'],
  'ITV':       ['ITV', 'ITV1'],
  'Channel 4': ['Channel 4'],
  'Channel 5': ['Channel 5'],
};

function matchChannel(networkName) {
  for (const [key, names] of Object.entries(CHANNELS)) {
    if (names.includes(networkName)) return key;
  }
  return null;
}

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function run() {
  const url = `https://api.tvmaze.com/schedule?country=GB&date=${todayDate()}`;
  let items;
  try {
    const res = await axios.get(url, { timeout: 10000 });
    items = res.data;
  } catch (err) {
    console.warn('tv: TVmaze fetch failed:', err.message);
    return;
  }
  if (!Array.isArray(items)) {
    console.warn('tv: unexpected TVmaze payload shape');
    return;
  }

  const buckets = {};
  for (const key of Object.keys(CHANNELS)) buckets[key] = [];

  for (const item of items) {
    const network = item.show && (item.show.network || item.show.webChannel);
    const channelKey = matchChannel(network && network.name);
    if (!channelKey) continue;
    if (!item.airtime) continue;
    // BBC programmes page is the better landing for users (iPlayer link
    // on top), TVmaze show page is the fallback.
    const showUrl = (item.show && (item.show.officialSite || item.show.url)) || null;
    buckets[channelKey].push({
      time: item.airtime,
      title: (item.show && item.show.name) || item.name || '(no title)',
      url: showUrl,
    });
  }

  // Sort each channel chronologically and cap to 25 entries.
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => a.time.localeCompare(b.time));
    buckets[key] = buckets[key].slice(0, 25);
  }

  const total = Object.values(buckets).reduce((n, list) => n + list.length, 0);
  if (total === 0) {
    console.warn('tv: TVmaze returned 0 matching shows, leaving cache untouched');
    return;
  }

  cache.set('tv', {
    fetchedAt: new Date().toISOString(),
    channels: buckets,
  });
  console.log(`tv: cached ${total} shows across ${Object.keys(buckets).length} channels`);
}

module.exports = {
  // Every 2 hours - listings don't change minute-to-minute.
  schedule: '0 */2 * * *',
  run,
  name: 'tv',
};
