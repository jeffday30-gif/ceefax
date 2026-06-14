// UK National Lottery results scraper. Uses lottery.co.uk because it is
// fully server-rendered (national-lottery.co.uk is a React SPA and returns
// an empty shell to a curl-style fetch). Updated hourly - draw days are
// Wed/Sat (Lotto), Tue/Fri (EuroMillions), Tue/Wed/Fri/Sat (Thunderball),
// Mon/Thu (Set For Life).

const axios = require('axios');
const cache = require('../cache');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
           'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

async function fetchHtml(url) {
  const { data } = await axios.get(url, {
    timeout: 12000,
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
  });
  return data;
}

// lottery.co.uk AMP results wraps each ball as
//   <div class="result medium {game}-ball-..."]>NN</div>
// followed by a single bonus div with class containing "bonus-ball".
// We grab the first block (the latest draw), main balls + bonus.
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
  // The AMP page formats it as "Saturday<span>13th June 2026</span>".
  const m = html.match(/(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)[^<]*<[^>]*>\s*(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
  if (!m) return null;
  return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}

// Extract the "Next Estimated Jackpot" amount from the AMP page. lottery.co.uk
// renders it as `<span class="resultJackpot">&pound;3,681,650</span>` or
// similar. Falls back to a free-form £xx Million pattern for some games.
function extractJackpot(html) {
  const m1 = html.match(/class="resultJackpot"[^>]*>\s*(?:&pound;|£)?\s*([\d,]+(?:\.\d+)?\s*(?:Million|Thousand)?)/i);
  if (m1) return '£' + m1[1].replace(/\s+/g, ' ').trim();
  const m2 = html.match(/(?:&pound;|£)\s*([\d,]+(?:\.\d+)?\s*Million)/i);
  if (m2) return '£' + m2[1].trim();
  return null;
}

async function scrapeGame(label, url, ballCount, bonusCount) {
  try {
    const html = await fetchHtml(url);
    const balls = extractFirstBlock(html, ballCount + bonusCount);
    if (!balls) {
      console.warn(`lottery: ${label} parse failed (no balls found)`);
      return null;
    }
    return {
      drawDate: extractDate(html),
      numbers:  balls.slice(0, ballCount),
      bonus:    bonusCount === 1 ? balls[ballCount] : balls.slice(ballCount, ballCount + bonusCount),
      jackpot:  extractJackpot(html),
    };
  } catch (err) {
    console.warn(`lottery: ${label} fetch failed:`, err.message);
    return null;
  }
}

async function run() {
  const [lotto, thunderball, euromillions, setForLife] = await Promise.all([
    scrapeGame('lotto',        'https://www.lottery.co.uk/amp/lotto/results',        6, 1),
    scrapeGame('thunderball',  'https://www.lottery.co.uk/amp/thunderball/results',  5, 1),
    scrapeGame('euromillions', 'https://www.lottery.co.uk/amp/euromillions/results', 5, 2),
    scrapeGame('set-for-life', 'https://www.lottery.co.uk/amp/set-for-life/results', 5, 1),
  ]);

  const got = [lotto, thunderball, euromillions, setForLife].filter(Boolean).length;
  if (got === 0) {
    console.warn('lottery: all four games failed to scrape, leaving cache untouched');
    return;
  }

  cache.set('lottery', {
    fetchedAt: new Date().toISOString(),
    lotto:        lotto        && { drawDate: lotto.drawDate,        numbers: lotto.numbers,        bonus: lotto.bonus,                jackpot: lotto.jackpot },
    thunderball:  thunderball  && { drawDate: thunderball.drawDate,  numbers: thunderball.numbers,  thunderball: thunderball.bonus,    jackpot: thunderball.jackpot },
    euromillions: euromillions && { drawDate: euromillions.drawDate, numbers: euromillions.numbers, luckyStars: euromillions.bonus,    jackpot: euromillions.jackpot },
    setForLife:   setForLife   && { drawDate: setForLife.drawDate,   numbers: setForLife.numbers,   lifeBall: setForLife.bonus,        jackpot: setForLife.jackpot },
  });
  console.log(`lottery: cached ${got}/4 games`);
}

module.exports = {
  schedule: '15 * * * *',  // every hour at :15
  run,
  name: 'lottery',
};
