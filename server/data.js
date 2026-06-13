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

module.exports = {
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
  // Status of any data domain, surfaced via /healthz for debugging.
  status() {
    const out = {};
    for (const key of ['news', 'football', 'weather', 'tv']) {
      const entry = cache.get(key);
      out[key] = entry
        ? { source: 'live', ageMs: Date.now() - entry.fetchedAt }
        : { source: 'stub' };
    }
    return out;
  },
};
