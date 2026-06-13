// BBC News RSS scraper. Free, no API key, no rate limits, and thematically
// perfect for a BBC Ceefax recreation. Truncates each story to ~80 words to
// fit the 40-column teletext layout.

const Parser = require('rss-parser');
const cache = require('../cache');

const parser = new Parser({ timeout: 8000 });

const FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/rss.xml',          category: 'UK' },
  { url: 'https://feeds.bbci.co.uk/news/uk/rss.xml',       category: 'UK' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',    category: 'World' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'Business' },
];

const MAX_HEADLINES = 12;
const MAX_BRIEF = 8;
const SUMMARY_WORDS = 80;

function truncateWords(text, max) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ');
  if (words.length <= max) return words.join(' ');
  return words.slice(0, max).join(' ') + '...';
}

function cleanTitle(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

async function fetchFeed(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return (parsed.items || []).map((item) => ({
      title: cleanTitle(item.title),
      summary: truncateWords(item.contentSnippet || item.content || item.title, SUMMARY_WORDS),
      category: feed.category,
      link: item.link,
      publishedAt: item.isoDate || item.pubDate,
    }));
  } catch (err) {
    console.warn(`news: feed ${feed.url} failed:`, err.message);
    return [];
  }
}

async function run() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = results.flat();
  if (all.length === 0) {
    console.warn('news: every BBC feed failed, leaving cache untouched');
    return;
  }
  // Dedupe by title (BBC main feed overlaps with UK + World).
  const seen = new Set();
  const headlines = [];
  for (const item of all) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    headlines.push(item);
    if (headlines.length >= MAX_HEADLINES) break;
  }

  // News-in-brief: short one-liners from the main feed.
  const brief = all
    .filter((i) => i.category === 'UK')
    .slice(0, MAX_BRIEF)
    .map((i) => truncateWords(i.title, 14));

  cache.set('news', {
    fetchedAt: new Date().toISOString(),
    headlines,
    newsInBrief: brief,
  });
  console.log(`news: cached ${headlines.length} headlines, ${brief.length} brief items`);
}

module.exports = {
  // Every 15 minutes.
  schedule: '*/15 * * * *',
  run,
  name: 'news',
};
