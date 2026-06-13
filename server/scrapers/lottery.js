// National Lottery results scraper. No public API exists, but the official
// results pages render the numbers in server-side HTML that we can extract
// with simple regexes. We pull Lotto, Thunderball, EuroMillions and Set For
// Life. Updated once per hour - draw days are Wed/Sat (Lotto), Tue/Fri
// (EuroMillions), Tue/Wed/Fri/Sat (Thunderball), Mon/Thu (Set For Life).

const axios = require('axios');
const cache = require('../cache');

const UA = 'Mozilla/5.0 (compatible; CeefaxReborn/0.1; +https://ceefax.onrender.com)';

async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
  });
  return data;
}

// Extract the first occurrence of N ball numbers and a bonus from a chunk of
// HTML. The results pages render balls inside class="game-icon-NN" or as
// "<li>NN</li>". We use a broad regex and post-filter.
function extractBalls(html, count) {
  const matches = Array.from(html.matchAll(/>(\d{1,2})</g));
  const candidates = matches.map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 70);
  if (candidates.length < count) return null;
  return candidates.slice(0, count);
}

function extractDate(html) {
  const m = html.match(/(Sat|Sun|Mon|Tue|Wed|Thu|Fri)\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/);
  return m ? m[0] : null;
}

async function scrapeGame(url, ballCount, bonusCount = 1) {
  try {
    const html = await fetchHtml(url);
    const balls = extractBalls(html, ballCount + bonusCount);
    if (!balls) return null;
    return {
      drawDate: extractDate(html),
      numbers: balls.slice(0, ballCount),
      bonus:   bonusCount === 1 ? balls[ballCount] : balls.slice(ballCount, ballCount + bonusCount),
    };
  } catch (err) {
    console.warn(`lottery: ${url} failed:`, err.message);
    return null;
  }
}

async function run() {
  const [lotto, thunderball, euromillions, setForLife] = await Promise.all([
    scrapeGame('https://www.national-lottery.co.uk/results/lotto/draw-history', 6, 1),
    scrapeGame('https://www.national-lottery.co.uk/results/thunderball/draw-history', 5, 1),
    scrapeGame('https://www.national-lottery.co.uk/results/euromillions/draw-history', 5, 2),
    scrapeGame('https://www.national-lottery.co.uk/results/set-for-life/draw-history', 5, 1),
  ]);

  const got = [lotto, thunderball, euromillions, setForLife].filter(Boolean).length;
  if (got === 0) {
    console.warn('lottery: all four games failed to scrape, leaving cache untouched');
    return;
  }

  cache.set('lottery', {
    fetchedAt: new Date().toISOString(),
    lotto:        lotto        && { drawDate: lotto.drawDate,        numbers: lotto.numbers,        bonus: lotto.bonus },
    thunderball:  thunderball  && { drawDate: thunderball.drawDate,  numbers: thunderball.numbers,  thunderball: thunderball.bonus },
    euromillions: euromillions && { drawDate: euromillions.drawDate, numbers: euromillions.numbers, luckyStars: euromillions.bonus },
    setForLife:   setForLife   && { drawDate: setForLife.drawDate,   numbers: setForLife.numbers,   lifeBall: setForLife.bonus },
  });
  console.log(`lottery: cached ${got}/4 games`);
}

module.exports = {
  schedule: '15 * * * *',  // every hour at :15
  run,
  name: 'lottery',
};
