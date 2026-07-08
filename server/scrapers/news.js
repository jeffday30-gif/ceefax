// BBC News RSS scraper. Free, no API key, no rate limits, and thematically
// perfect for a BBC Ceefax recreation. Truncates each story to ~80 words to
// fit the 40-column teletext layout. Also fetches full article bodies for
// the top stories so they can be read *inside* the teletext grid (P111+),
// the way real Ceefax worked.

const Parser = require('rss-parser');
const axios = require('axios');
const cache = require('../cache');

const parser = new Parser({ timeout: 8000 });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120 Safari/537.36';

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

// Extract readable paragraphs from a BBC article page. BBC renders article
// copy inside <div data-component="text-block"> wrappers; each contains one
// or more <p> elements. Returns an array of plain-text paragraphs.
const MAX_BODY_WORDS = 550;
const STORY_COUNT = 8;

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&pound;/g, '£')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// BBC article copy lives in <p> elements whose class contains "Paragraph"
// (ssrcss-*-Paragraph) inside the <article> element. Captions, bylines and
// promo text use different class names, so this filter keeps just the story.
function extractBody(html) {
  const artStart = html.indexOf('<article');
  if (artStart === -1) return [];
  const art = html.slice(artStart, html.indexOf('</article>', artStart));
  const paragraphs = [];
  const pRe = /<p\b[^>]*class="[^"]*Paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  let words = 0;
  while ((m = pRe.exec(art)) !== null && words < MAX_BODY_WORDS) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    paragraphs.push(text);
    words += text.split(' ').length;
  }
  return paragraphs;
}

async function fetchBody(link, prevBodies) {
  // Live pages and non-article URLs have no text-block structure - skip.
  if (!link || link.includes('/live/')) return null;
  // Reuse the previously fetched body when the URL is unchanged - articles
  // rarely change after publication, and this keeps us polite to BBC.
  if (prevBodies.has(link)) return prevBodies.get(link);
  try {
    const { data } = await axios.get(link, {
      timeout: 10000,
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      maxContentLength: 3 * 1024 * 1024,
    });
    const body = extractBody(data);
    return body.length >= 2 ? body : null;
  } catch (err) {
    console.warn(`news: body fetch failed for ${link}:`, err.message);
    return null;
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

  // Full article bodies for the top stories (read-in-teletext pages).
  const prev = cache.payload('news');
  const prevBodies = new Map(
    ((prev && prev.headlines) || [])
      .filter((h) => h.link && h.body)
      .map((h) => [h.link, h.body])
  );
  const bodies = await Promise.all(
    headlines.slice(0, STORY_COUNT).map((h) => fetchBody(h.link, prevBodies))
  );
  bodies.forEach((body, i) => {
    if (body) headlines[i].body = body;
  });

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
  const withBody = headlines.filter((h) => h.body).length;
  console.log(`news: cached ${headlines.length} headlines (${withBody} with full body), ${brief.length} brief items`);
}

module.exports = {
  // Every 15 minutes.
  schedule: '*/15 * * * *',
  run,
  name: 'news',
};
