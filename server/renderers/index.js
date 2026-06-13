const { Grid } = require('./grid');
const indexRenderer = require('./indexRenderer');
const newsRenderer = require('./newsRenderer');
const businessRenderer = require('./businessRenderer');
const footballRenderer = require('./footballRenderer');
const sportRenderer = require('./sportRenderer');
const weatherRenderer = require('./weatherRenderer');
const travelRenderer = require('./travelRenderer');
const entertainmentRenderer = require('./entertainmentRenderer');
const tvRenderer = require('./tvRenderer');
const subtitlesRenderer = require('./subtitlesRenderer');
const worldCupRenderer = require('./worldCupRenderer');

const WC_PAGES = new Set([305, 306, 307, 326, 327, 328, 329]);

function render(pageNum, opts = {}) {
  const n = Number(pageNum);
  if (!Number.isInteger(n) || n < 100 || n > 999) return renderNotFound(pageNum);

  if (n === 100 || n === 199 || n === 152) return indexRenderer.render(n, opts);

  if ((n >= 101 && n <= 119) || n === 150 || n === 160 || n === 170) {
    return newsRenderer.render(n, opts);
  }

  if (n === 200 || n === 201 || n === 220 || n === 230) {
    return businessRenderer.render(n, opts);
  }

  if (WC_PAGES.has(n)) {
    return worldCupRenderer.render(n, opts);
  }

  if ((n >= 300 && n <= 304) || n === 306 || n === 312 || n === 316 ||
      n === 320 || n === 324 || n === 325) {
    return footballRenderer.render(n, opts);
  }

  if (n === 340 || n === 341 || n === 360 ||
      n === 370 || n === 374 || n === 380 || n === 390) {
    return sportRenderer.render(n, opts);
  }

  if ((n >= 400 && n <= 406) || n === 410) {
    return weatherRenderer.render(n, opts);
  }

  if (n === 430 || n === 450) {
    return travelRenderer.render(n, opts);
  }

  if (n === 500 || n === 501 || n === 510 || n === 520 ||
      n === 540 || n === 555 || n === 570) {
    return entertainmentRenderer.render(n, opts);
  }

  if ((n >= 600 && n <= 605) || n === 660 || n === 680) {
    return tvRenderer.render(n, opts);
  }

  if (n === 888) return subtitlesRenderer.render(n, opts);

  return renderUnderConstruction(n, opts);
}

function renderUnderConstruction(pageNum, { subPage = 1 } = {}) {
  const g = new Grid();
  g.writeHeaderBand(pageNum, 'CEEFAX', { subPage, totalSubPages: 1 });
  g.writeSectionTitle(2, 'PAGE NOT YET AVAILABLE', 'R');
  g.writeCentered(10, `P${pageNum} is not in use.`, 'W', 'K');
  g.writeCentered(12, 'Try 100 for the index or 199 for A-Z.', 'C', 'K');
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage, totalSubPages: 1, title: 'CEEFAX' });
}

function renderNotFound(raw) {
  const g = new Grid();
  g.writeHeaderBand(100, 'CEEFAX', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'PAGE NOT FOUND', 'R');
  g.writeCentered(10, `"${String(raw).slice(0, 20)}" is not a valid page`, 'W', 'K');
  g.writeCentered(12, 'Pages are 100 to 999.', 'C', 'K');
  g.writeFastextBar();
  return g.toJSON({ page: 100, subPage: 1, totalSubPages: 1, title: 'CEEFAX' });
}

module.exports = { render };
