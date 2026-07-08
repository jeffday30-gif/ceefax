const cron = require('node-cron');

const scrapers = [
  require('./news'),
  require('./sportRss'),
  require('./bbcLive'),
  require('./weather'),
  require('./tv'),
  require('./football'),
  require('./lottery'),
];

// Last outcome per scraper, surfaced via /healthz so production failures
// (e.g. a source blocking Render's IP range) are diagnosable without SSH.
const status = {};

async function runOne(scraper) {
  const t0 = Date.now();
  try {
    await scraper.run();
    console.log(`scraper ${scraper.name}: completed in ${Date.now() - t0}ms`);
    status[scraper.name] = { lastRunAt: Date.now(), ok: true };
  } catch (err) {
    console.warn(`scraper ${scraper.name}: threw:`, err.message);
    status[scraper.name] = { lastRunAt: Date.now(), ok: false, error: String(err.message).slice(0, 200) };
  }
}

function start() {
  // Fire all scrapers immediately so the first user request gets live data
  // even on a Render cold start. Run them in parallel; each handles its own
  // failure mode without blocking the others.
  console.log(`scrapers: priming ${scrapers.length} data sources on startup...`);
  for (const s of scrapers) runOne(s);

  for (const s of scrapers) {
    if (!cron.validate(s.schedule)) {
      console.warn(`scraper ${s.name}: invalid cron expression "${s.schedule}", skipping schedule`);
      continue;
    }
    cron.schedule(s.schedule, () => runOne(s));
    console.log(`scraper ${s.name}: scheduled "${s.schedule}"`);
  }
}

module.exports = { start, scrapers, status };
