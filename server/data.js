// Thin accessor layer: renderers ask for data through here. If a scraper
// has populated the cache we return that; otherwise we fall back to the
// hand-crafted stub. This keeps renderers unaware of fetch state.

const cache = require('./cache');
const stubs = require('./stubs');

// Merge cached fields over the stub. Scrapers don't always cover every field
// the stub has (e.g. World Cup hosts/groups are static metadata; only the
// fixtures/results/scorers come from the live API), so a plain "cached OR
// stub" would lose those fields on first scrape.
function fromCacheOrStub(key) {
  const cached = cache.payload(key);
  const stub = stubs[key];
  if (!cached) return stub;
  if (!stub)   return cached;
  return { ...stub, ...cached };
}

// A source is "stale" when its cache entry is much older than its refresh
// cadence - i.e. the scraper has been failing. Thresholds are ~3x the cron
// interval so a single missed run doesn't flag.
const STALE_AFTER_MS = {
  news:     45 * 60 * 1000,
  bbcSport: 60 * 60 * 1000,
  bbcLive:  10 * 60 * 1000,
  weather:  90 * 60 * 1000,
  tv:       6 * 60 * 60 * 1000,
  football: 45 * 60 * 1000,
  lottery:  26 * 60 * 60 * 1000,
};

function isStale(key) {
  const entry = cache.get(key);
  if (!entry) return true; // stub data is by definition stale
  const threshold = STALE_AFTER_MS[key] || 60 * 60 * 1000;
  return Date.now() - entry.fetchedAt > threshold;
}

module.exports = {
  isStale,
  news: () => fromCacheOrStub('news'),
  football: () => fromCacheOrStub('football'),
  weather: () => fromCacheOrStub('weather'),
  tv: () => fromCacheOrStub('tv'),
  business: () => fromCacheOrStub('business'),
  entertainment: () => fromCacheOrStub('entertainment'),
  sport: () => fromCacheOrStub('sport'),
  lottery: () => fromCacheOrStub('lottery'),
  travel: () => fromCacheOrStub('travel'),
  worldcup: () => fromCacheOrStub('worldcup'),
  bbcSport: () => cache.payload('bbcSport') || null,
  bbcLive:  () => cache.payload('bbcLive')  || null,
  // Status of any data domain, surfaced via /healthz for debugging.
  status() {
    const out = {};
    for (const key of ['news', 'football', 'weather', 'tv', 'bbcSport', 'bbcLive', 'lottery']) {
      const entry = cache.get(key);
      out[key] = entry
        ? { source: 'live', ageMs: Date.now() - entry.fetchedAt }
        : { source: 'stub' };
    }
    return out;
  },
};
