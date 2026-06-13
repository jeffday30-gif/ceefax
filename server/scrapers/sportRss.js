// BBC Sport RSS bundle. Pulls each sport sub-feed and stashes them in the
// cache as `bbcSport`. Renderers pull headlines + article URLs from here.
// Free, no API key, content stays current.

const Parser = require('rss-parser');
const cache = require('../cache');

const parser = new Parser({ timeout: 8000 });

const FEEDS = {
  sport:     'https://feeds.bbci.co.uk/sport/rss.xml',
  football:  'https://feeds.bbci.co.uk/sport/football/rss.xml',
  worldCup:  'https://feeds.bbci.co.uk/sport/football/world-cup/rss.xml',
  cricket:   'https://feeds.bbci.co.uk/sport/cricket/rss.xml',
  formula1:  'https://feeds.bbci.co.uk/sport/formula1/rss.xml',
  rugbyU:    'https://feeds.bbci.co.uk/sport/rugby-union/rss.xml',
  rugbyL:    'https://feeds.bbci.co.uk/sport/rugby-league/rss.xml',
  golf:      'https://feeds.bbci.co.uk/sport/golf/rss.xml',
  tennis:    'https://feeds.bbci.co.uk/sport/tennis/rss.xml',
  horseRace: 'https://feeds.bbci.co.uk/sport/horse-racing/rss.xml',
};

const MAX_ITEMS_PER_FEED = 10;

function cleanTitle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function truncate(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : s.slice(0, n - 1) + '...';
}

async function fetchOne(name, url) {
  try {
    const parsed = await parser.parseURL(url);
    return [name, (parsed.items || []).slice(0, MAX_ITEMS_PER_FEED).map((item) => ({
      title:   cleanTitle(item.title),
      summary: truncate(item.contentSnippet || item.content || '', 160),
      link:    item.link,
      publishedAt: item.isoDate || item.pubDate,
    }))];
  } catch (err) {
    console.warn(`sportRss: ${name} (${url}) failed:`, err.message);
    return [name, null];
  }
}

async function run() {
  const entries = Object.entries(FEEDS);
  const results = await Promise.all(entries.map(([name, url]) => fetchOne(name, url)));
  const byCategory = {};
  for (const [name, items] of results) if (items) byCategory[name] = items;

  if (Object.keys(byCategory).length === 0) {
    console.warn('sportRss: every feed failed, leaving cache untouched');
    return;
  }

  cache.set('bbcSport', { fetchedAt: new Date().toISOString(), ...byCategory });
  const summary = Object.entries(byCategory).map(([k, v]) => `${k}:${v.length}`).join(' ');
  console.log(`sportRss: cached ${summary}`);
}

module.exports = {
  schedule: '*/20 * * * *',  // every 20 min
  run,
  name: 'sportRss',
};
