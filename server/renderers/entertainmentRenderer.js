const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'M';

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }

function entFastext(g, current) {
  const map = {
    500: [{ label: 'TV HILITE',page: 501 }, { label: 'FILMS',  page: 510 }, { label: 'LOTTERY', page: 555 }, { label: 'INDEX',   page: 100 }],
    501: [{ label: 'FILMS',   page: 510 }, { label: 'MUSIC',   page: 520 }, { label: "WHAT'S ON",page: 540 }, { label: 'TV LIST', page: 600 }],
    510: [{ label: 'TV HILITE',page: 501 }, { label: 'MUSIC',  page: 520 }, { label: "WHAT'S ON",page: 540 }, { label: 'INDEX',   page: 500 }],
    520: [{ label: 'FILMS',   page: 510 }, { label: "WHAT'S ON",page: 540 }, { label: 'TV LIST', page: 600 }, { label: 'INDEX',   page: 500 }],
    540: [{ label: 'TV HILITE',page: 501 }, { label: 'MUSIC',  page: 520 }, { label: 'FILMS',   page: 510 }, { label: 'INDEX',   page: 500 }],
    555: [{ label: 'INDEX',   page: 100 }, { label: 'NEWS',    page: 101 }, { label: 'SPORT',   page: 301 }, { label: 'WEATHER', page: 400 }],
    570: [{ label: 'NEWS',    page: 101 }, { label: 'SPORT',   page: 301 }, { label: 'TV LIST', page: 600 }, { label: 'INDEX',   page: 100 }],
  };
  g.setFastext(map[current] || [
    { label: 'INDEX',    page: 500 },
    { label: 'TV LIST',  page: 600 },
    { label: 'NEWS',     page: 101 },
    { label: 'CEEFAX',   page: 100 },
  ]);
}

function renderIndex(g) {
  g.writeHeaderBand(500, 'ENT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'ENTERTAINMENT', SECTION);
  const items = [
    ['TV highlights',     501, 'C'],
    ['Film reviews',      510, 'Y'],
    ['Music news',        520, 'M'],
    ["What's on",         540, 'G'],
    ['National Lottery',  555, 'R'],
    ['Newsround',         570, 'W'],
    ['TV listings',       600, 'M'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  entFastext(g, 500);
  g.writeFastextBar();
  return g.toJSON({ page: 500, subPage: 1, totalSubPages: 1, title: 'ENTERTAINMENT' });
}

function renderTVHighlights(g) {
  g.writeHeaderBand(501, 'HILITES', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, "TONIGHT'S BEST", SECTION);
  let row = 4;
  for (const h of data.entertainment().tvHighlights) {
    if (row > 22) break;
    g.writeRow(row, h.time,             'Y', 'K', 2);
    g.writeRow(row, pad(h.channel, 5),  'C', 'K', 8);
    g.writeRow(row, pad(h.title, 26),   'W', 'K', 14);
    row++;
    if (h.blurb && row <= 22) {
      row = g.writeWrapped(row, 22, h.blurb, 'G', 'K', 4);
    }
  }
  entFastext(g, 501);
  g.writeFastextBar();
  return g.toJSON({ page: 501, subPage: 1, totalSubPages: 1, title: 'TV HIGHLIGHTS' });
}

function renderFilms(g) {
  g.writeHeaderBand(510, 'FILMS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'FILM REVIEWS', SECTION);
  let row = 4;
  for (const f of data.entertainment().filmReviews) {
    if (row > 22) break;
    const stars = '*'.repeat(f.stars).padEnd(5, '.');
    g.writeRow(row, pad(f.title, 28), 'W', 'K', 2);
    g.writeRow(row, stars,            'Y', 'K', 33);
    row++;
    row = g.writeWrapped(row, 22, f.summary, 'C', 'K', 4);
    row++;
  }
  entFastext(g, 510);
  g.writeFastextBar();
  return g.toJSON({ page: 510, subPage: 1, totalSubPages: 1, title: 'FILM REVIEWS' });
}

function renderMusic(g) {
  g.writeHeaderBand(520, 'MUSIC', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'MUSIC NEWS', SECTION);
  let row = 4;
  for (const n of data.entertainment().musicNews) {
    if (row > 22) break;
    g.writeRow(row, '*', 'M', 'K', 1);
    row = g.writeWrapped(row, 22, n, 'C', 'K', 3);
    row++;
  }
  entFastext(g, 520);
  g.writeFastextBar();
  return g.toJSON({ page: 520, subPage: 1, totalSubPages: 1, title: 'MUSIC NEWS' });
}

function renderWhatsOn(g) {
  g.writeHeaderBand(540, "WHAT'S ON", { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, "WHAT'S ON THIS WEEK", SECTION);
  let row = 4;
  for (const w of data.entertainment().whatsOn) {
    if (row > 22) break;
    g.writeRow(row, pad(w.venue, 22),  'C', 'K', 2);
    g.writeRow(row, pad(w.when, 14),   'Y', 'K', 25);
    row++;
    g.writeRow(row, pad(w.event, 36),  'W', 'K', 4);
    row += 2;
  }
  entFastext(g, 540);
  g.writeFastextBar();
  return g.toJSON({ page: 540, subPage: 1, totalSubPages: 1, title: "WHAT'S ON" });
}

function renderLottery(g) {
  const { lotto, thunderball, euromillions, setForLife } = data.lottery();
  g.writeHeaderBand(555, 'LOTTERY', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NATIONAL LOTTERY', 'R');

  let row = 4;
  g.writeRow(row++, `LOTTO  ${lotto.drawDate}`, 'C', 'K', 2);
  g.writeRow(row++, lotto.numbers.join('  ') + `  Bonus ${lotto.bonus}`, 'Y', 'K', 4);
  g.writeRow(row++, `Jackpot ${lotto.jackpot}  Winners: ${lotto.winners}`, 'W', 'K', 4);
  row++;

  g.writeRow(row++, `THUNDERBALL  ${thunderball.drawDate}`, 'C', 'K', 2);
  g.writeRow(row++, thunderball.numbers.join('  ') + `  TB ${thunderball.thunderball}`, 'Y', 'K', 4);
  g.writeRow(row++, `Jackpot ${thunderball.jackpot}`, 'W', 'K', 4);
  row++;

  g.writeRow(row++, `EUROMILLIONS  ${euromillions.drawDate}`, 'C', 'K', 2);
  g.writeRow(row++, euromillions.numbers.join('  ') + `  Stars ${euromillions.luckyStars.join(' ')}`, 'Y', 'K', 4);
  g.writeRow(row++, `Jackpot ${euromillions.jackpot}`, 'W', 'K', 4);
  row++;

  g.writeRow(row++, `SET FOR LIFE  ${setForLife.drawDate}`, 'C', 'K', 2);
  g.writeRow(row++, setForLife.numbers.join('  ') + `  LB ${setForLife.lifeBall}`, 'Y', 'K', 4);

  entFastext(g, 555);
  g.writeFastextBar();
  return g.toJSON({ page: 555, subPage: 1, totalSubPages: 1, title: 'LOTTERY' });
}

function renderNewsround(g) {
  g.writeHeaderBand(570, 'NEWSROUND', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'CBBC NEWSROUND', SECTION);
  let row = 4;
  for (const item of data.entertainment().newsround) {
    if (row > 22) break;
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, item, 'C', 'K', 3);
    row++;
  }
  entFastext(g, 570);
  g.writeFastextBar();
  return g.toJSON({ page: 570, subPage: 1, totalSubPages: 1, title: 'NEWSROUND' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 500) return renderIndex(g);
  if (pageNum === 501) return renderTVHighlights(g);
  if (pageNum === 510) return renderFilms(g);
  if (pageNum === 520) return renderMusic(g);
  if (pageNum === 540) return renderWhatsOn(g);
  if (pageNum === 555) return renderLottery(g);
  if (pageNum === 570) return renderNewsround(g);
  return renderIndex(g);
}

module.exports = { render };
