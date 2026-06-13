const cron = require('node-cron');

const scrapers = [
  require('./news'),
  require('./sportRss'),
  require('./weather'),
  require('./tv'),
  require('./football'),
  require('./lottery'),
];

async function runOne(scraper) {
  const t0 = Date.now();
  try {
    await scraper.run();
    console.log(`scraper ${scraper.name}: completed in ${Date.now() - t0}ms`);
  } catch (err) {
    console.warn(`scraper ${scraper.name}: threw:`, err.message);
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

module.exports = { start, scrapers };
