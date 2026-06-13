const { Grid } = require('./grid');
const data = require('../data');
const { renderUnavailable, isEmpty } = require('./helpers');

const SECTION = 'M';

function entFastext(g, current) {
  const map = {
    500: [{ label: 'TV LIST',  page: 600 }, { label: 'LOTTERY', page: 555 }, { label: 'NEWS',    page: 101 }, { label: 'INDEX',  page: 100 }],
    555: [{ label: 'INDEX',    page: 100 }, { label: 'NEWS',    page: 101 }, { label: 'SPORT',   page: 301 }, { label: 'WEATHER',page: 400 }],
    570: [{ label: 'NEWS',     page: 101 }, { label: 'SPORT',   page: 301 }, { label: 'TV LIST', page: 600 }, { label: 'INDEX',  page: 100 }],
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
    ['National Lottery',  555, 'R'],
    ['TV listings',       600, 'M'],
    ['News',              101, 'Y'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  row += 2;
  g.writeWrapped(row, row + 5,
    'Film reviews, music charts and entertainment listings ' +
    'need editorial APIs that have no free tier. For now we ' +
    'route to TV listings and the lottery.',
    'C', 'K', 1);
  entFastext(g, 500);
  g.writeFastextBar();
  return g.toJSON({ page: 500, subPage: 1, totalSubPages: 1, title: 'ENTERTAINMENT' });
}

function fmtNumbers(arr) {
  return (arr || []).map(n => String(n).padStart(2, ' ')).join('  ');
}

function renderLottery(g) {
  const lot = data.lottery();
  if (!lot || (!lot.lotto && !lot.thunderball && !lot.euromillions && !lot.setForLife)) {
    return renderUnavailable(555, 'LOTTERY');
  }
  g.writeHeaderBand(555, 'LOTTERY', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NATIONAL LOTTERY', 'R');
  let row = 4;
  if (lot.lotto) {
    g.writeRow(row++, `LOTTO  ${lot.lotto.drawDate || ''}`, 'Y', 'K', 2);
    g.writeRow(row++, fmtNumbers(lot.lotto.numbers) + `  Bonus ${lot.lotto.bonus}`, 'W', 'K', 4);
    row++;
  }
  if (lot.thunderball) {
    g.writeRow(row++, `THUNDERBALL  ${lot.thunderball.drawDate || ''}`, 'Y', 'K', 2);
    g.writeRow(row++, fmtNumbers(lot.thunderball.numbers) + `  TB ${lot.thunderball.thunderball}`, 'W', 'K', 4);
    row++;
  }
  if (lot.euromillions) {
    g.writeRow(row++, `EUROMILLIONS  ${lot.euromillions.drawDate || ''}`, 'Y', 'K', 2);
    const stars = Array.isArray(lot.euromillions.luckyStars) ? lot.euromillions.luckyStars.join(' ') : '';
    g.writeRow(row++, fmtNumbers(lot.euromillions.numbers) + `  Stars ${stars}`, 'W', 'K', 4);
    row++;
  }
  if (lot.setForLife) {
    g.writeRow(row++, `SET FOR LIFE  ${lot.setForLife.drawDate || ''}`, 'Y', 'K', 2);
    g.writeRow(row++, fmtNumbers(lot.setForLife.numbers) + `  LB ${lot.setForLife.lifeBall}`, 'W', 'K', 4);
  }
  entFastext(g, 555);
  g.writeFastextBar();
  return g.toJSON({ page: 555, subPage: 1, totalSubPages: 1, title: 'LOTTERY' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 500) return renderIndex(g);
  if (pageNum === 555) return renderLottery(g);
  if (pageNum === 501 || pageNum === 510 || pageNum === 520 || pageNum === 540 || pageNum === 570) {
    return renderUnavailable(pageNum, ({
      501: 'TV HIGHLIGHTS',
      510: 'FILM REVIEWS',
      520: 'MUSIC NEWS',
      540: "WHAT'S ON",
      570: 'NEWSROUND',
    })[pageNum]);
  }
  return renderIndex(g);
}

module.exports = { render };
