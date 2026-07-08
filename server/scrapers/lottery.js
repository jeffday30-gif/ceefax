// UK National Lottery results scraper.
//
// Primary source: the official national-lottery.co.uk draw-history download
// endpoint, which returns structured XML (despite the /csv path) - draw
// date, balls, bonus balls and next estimated jackpot. No JS rendering.
//
// Fallback: lottery.co.uk's AMP results pages (server-rendered HTML).
// lottery.co.uk times out from datacenter IPs (Render), which is why the
// official endpoint is primary.

const axios = require('axios');
const cache = require('../cache');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
           'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-GB,en;q=0.9',
};

const lastErrors = [];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function friendlyDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function friendlyJackpot(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/every month/i.test(s)) return '£10K/MONTH';
  return s.startsWith('£') ? s : `£${s}`;
}

// --- Primary: official XML ------------------------------------------------

async function fetchOfficial(game, bonusCount) {
  const url = `https://www.national-lottery.co.uk/results/${game}/draw-history/csv`;
  const { data } = await axios.get(url, { timeout: 12000, headers: HEADERS });
  const xml = String(data);

  const dateM = xml.match(/<draw-date>([\d-]+)<\/draw-date>/);
  // Lotto publishes two ball sets per draw night (round 1 and round 2);
  // the first <balls> block is the main draw.
  const ballsBlockM = xml.match(/<balls>([\s\S]*?)<\/balls>/);
  if (!ballsBlockM) throw new Error(`${game}: no balls in XML`);
  const block = ballsBlockM[1];
  const numbers = [...block.matchAll(/<ball number="\d+">(\d+)<\/ball>/g)].map((m) => Number(m[1]));
  const bonuses = [...block.matchAll(/<bonus-ball[^>]*>(\d+)<\/bonus-ball>/g)].map((m) => Number(m[1]));
  if (!numbers.length) throw new Error(`${game}: no main balls parsed`);
  const jackpotM = xml.match(/<next-estimated-jackpot>([^<]+)<\/next-estimated-jackpot>/);

  return {
    drawDate: dateM ? friendlyDate(dateM[1]) : null,
    numbers,
    bonus: bonusCount === 1 ? bonuses[0] : bonuses.slice(0, bonusCount),
    jackpot: friendlyJackpot(jackpotM && jackpotM[1]),
  };
}

// --- Fallback: lottery.co.uk AMP pages -------------------------------------

function extractFirstBlock(html, count) {
  const re = /<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>\s*(\d{1,2})\s*<\/div>/gi;
  const nums = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    nums.push(Number(m[1]));
    if (nums.length >= count) break;
  }
  return nums.length >= count ? nums : null;
}

function extractDate(html) {
  const m = html.match(/(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)[^<]*<[^>]*>\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (!m) return null;
  return `${m[1].slice(0, 3)} ${m[2]} ${m[3].slice(0, 3)}`;
}

function extractJackpot(html) {
  const m1 = html.match(/class="resultJackpot"[^>]*>\s*(?:&pound;|£)?\s*([\d,]+(?:\.\d+)?\s*(?:Million|Thousand)?)/i);
  if (m1) return '£' + m1[1].replace(/\s+/g, ' ').trim();
  return null;
}

async function fetchFallback(slug, ballCount, bonusCount) {
  const url = `https://www.lottery.co.uk/amp/${slug}/results`;
  const { data } = await axios.get(url, { timeout: 12000, headers: HEADERS });
  const balls = extractFirstBlock(data, ballCount + bonusCount);
  if (!balls) throw new Error(`${slug}: fallback parse failed`);
  return {
    drawDate: extractDate(data),
    numbers: balls.slice(0, ballCount),
    bonus: bonusCount === 1 ? balls[ballCount] : balls.slice(ballCount, ballCount + bonusCount),
    jackpot: extractJackpot(data),
  };
}

// --- Orchestration ----------------------------------------------------------

async function scrapeGame(official, fallbackSlug, ballCount, bonusCount) {
  try {
    return await fetchOfficial(official, bonusCount);
  } catch (err) {
    lastErrors.push(`${official} (official): ${err.message}`);
  }
  try {
    return await fetchFallback(fallbackSlug, ballCount, bonusCount);
  } catch (err) {
    lastErrors.push(`${fallbackSlug} (fallback): ${err.message}`);
    return null;
  }
}

async function run() {
  lastErrors.length = 0;
  const [lotto, thunderball, euromillions, setForLife] = await Promise.all([
    scrapeGame('lotto',        'lotto',        6, 1),
    scrapeGame('thunderball',  'thunderball',  5, 1),
    scrapeGame('euromillions', 'euromillions', 5, 2),
    scrapeGame('set-for-life', 'set-for-life', 5, 1),
  ]);

  const got = [lotto, thunderball, euromillions, setForLife].filter(Boolean).length;
  if (got === 0) {
    throw new Error(`all four games failed: ${lastErrors[0] || 'unknown'}`);
  }

  cache.set('lottery', {
    fetchedAt: new Date().toISOString(),
    lotto:        lotto        && { drawDate: lotto.drawDate,        numbers: lotto.numbers,        bonus: lotto.bonus,                jackpot: lotto.jackpot },
    thunderball:  thunderball  && { drawDate: thunderball.drawDate,  numbers: thunderball.numbers,  thunderball: thunderball.bonus,    jackpot: thunderball.jackpot },
    euromillions: euromillions && { drawDate: euromillions.drawDate, numbers: euromillions.numbers, luckyStars: euromillions.bonus,    jackpot: euromillions.jackpot },
    setForLife:   setForLife   && { drawDate: setForLife.drawDate,   numbers: setForLife.numbers,   lifeBall: setForLife.bonus,        jackpot: setForLife.jackpot },
  });
  console.log(`lottery: cached ${got}/4 games (${lastErrors.length ? 'errors: ' + lastErrors.join('; ') : 'all primary'})`);
}

module.exports = {
  schedule: '15 * * * *',  // every hour at :15
  run,
  name: 'lottery',
};
