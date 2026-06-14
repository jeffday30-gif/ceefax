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
const liveScoresRenderer = require('./liveScoresRenderer');
const aboutRenderer = require('./aboutRenderer');

const WC_PAGES = new Set([305, 306, 307, 326, 327, 328, 329]);

function render(pageNum, opts = {}) {
  const n = Number(pageNum);
  if (!Number.isInteger(n) || n < 100 || n > 999) return renderNotFound(pageNum);

  if (n === 100 || n === 199 || n === 152) return indexRenderer.render(n, opts);
  if (n === 198) return aboutRenderer.render(n, opts);

  if ((n >= 101 && n <= 119) || n === 150 || n === 160 || n === 170) {
    return newsRenderer.render(n, opts);
  }

  if (n === 200 || n === 201 || n === 220 || n === 230) {
    return businessRenderer.render(n, opts);
  }

  if (WC_PAGES.has(n)) {
    return worldCupRenderer.render(n, opts);
  }

  if (n === 318) return liveScoresRenderer.render(n, opts);

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
  g.writeHeaderBand(pageNum, 'TELETEXT', { subPage, totalSubPages: 1 });
  g.writeSectionTitle(2, 'PAGE NOT YET AVAILABLE', 'R');
  g.writeCentered(5, `P${pageNum} is not in use`, 'W', 'K');
  const suggestions = nearestValid(pageNum, 3);
  g.writeRow(9, 'NEAREST PAGES IN USE:', 'Y', 'K', 4);
  let row = 11;
  for (const p of suggestions) {
    g.writeRow(row, `P${p}`, 'C', 'K', 8);
    row += 2;
  }
  g.writeCentered(20, 'or press 100 for the index', 'W', 'K');
  g.setFastext([
    { label: 'INDEX', page: 100 },
    { label: 'A-Z',   page: 199 },
    { label: 'NEWS',  page: 101 },
    { label: 'ABOUT', page: 198 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage, totalSubPages: 1, title: 'NOT IN USE' });
}

// Every page number that has a renderer dispatched above. Used to suggest
// nearby pages when the user types one that isn't in use.
const VALID_PAGES = (() => {
  const set = new Set([100, 152, 198, 199, 318, 555, 888]);
  for (let n = 101; n <= 119; n++) set.add(n);
  for (const n of [150, 160, 170, 200, 201, 220, 230]) set.add(n);
  for (const n of [300, 301, 302, 303, 304, 305, 306, 307, 312, 316, 320, 324, 325, 326, 327, 328, 329]) set.add(n);
  for (const n of [340, 341, 360, 370, 374, 380, 390]) set.add(n);
  for (let n = 400; n <= 406; n++) set.add(n);
  set.add(410);
  for (const n of [430, 450, 500, 501, 510, 520, 540, 570]) set.add(n);
  for (let n = 600; n <= 605; n++) set.add(n);
  for (const n of [660, 680]) set.add(n);
  return [...set].sort((a, b) => a - b);
})();

function nearestValid(target, count = 3) {
  const n = Number(target);
  if (!Number.isFinite(n)) return VALID_PAGES.slice(0, count);
  return [...VALID_PAGES]
    .map((p) => [p, Math.abs(p - n)])
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .slice(0, count)
    .map(([p]) => p);
}

function renderNotFound(raw) {
  const g = new Grid();
  g.writeHeaderBand(100, 'TELETEXT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'PAGE NOT FOUND', 'R');
  g.writeCentered(5, `P${String(raw).slice(0, 3)} is not in use`, 'W', 'K');

  const suggestions = nearestValid(raw, 3);
  g.writeRow(9, 'NEAREST PAGES IN USE:', 'Y', 'K', 4);
  let row = 11;
  for (const p of suggestions) {
    g.writeRow(row, `P${p}`, 'C', 'K', 8);
    row += 2;
  }
  g.writeCentered(20, 'or press 100 for the index', 'W', 'K');
  g.setFastext([
    { label: 'INDEX', page: 100 },
    { label: 'A-Z',   page: 199 },
    { label: 'NEWS',  page: 101 },
    { label: 'ABOUT', page: 198 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: 100, subPage: 1, totalSubPages: 1, title: 'NOT FOUND' });
}

module.exports = { render };
