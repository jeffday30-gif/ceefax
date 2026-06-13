const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'R';

const NEWS_INDEX_ENTRIES = [
  ['News headlines',  101, 'Y'],
  ['News stories',    103, 'Y'],
  ['News in brief',   150, 'Y'],
  ['UK news',         160, 'C'],
  ['World news',      170, 'C'],
  ['Politics',        130, 'M'],
  ['Business news',   200, 'G'],
  ['Sport headlines', 301, 'G'],
  ['Weather',         400, 'C'],
];

function clampSub(n, total) {
  return Math.min(Math.max(1, Number(n) || 1), total);
}

function newsFastext(g, current) {
  const map = {
    101: [{ label: 'NEXT',    page: 102 }, { label: 'UK',      page: 160 }, { label: 'WORLD',  page: 170 }, { label: 'BUSINESS', page: 200 }],
    102: [{ label: 'TOP',     page: 101 }, { label: 'BRIEF',   page: 150 }, { label: 'WORLD',  page: 170 }, { label: 'SPORT',    page: 301 }],
    150: [{ label: 'HEADLINE',page: 101 }, { label: 'INDEX',   page: 102 }, { label: 'UK',     page: 160 }, { label: 'WORLD',    page: 170 }],
    160: [{ label: 'WORLD',   page: 170 }, { label: 'BRIEF',   page: 150 }, { label: 'WEATHER',page: 400 }, { label: 'INDEX',    page: 100 }],
    170: [{ label: 'UK',      page: 160 }, { label: 'BRIEF',   page: 150 }, { label: 'WEATHER',page: 410 }, { label: 'INDEX',    page: 100 }],
  };
  g.setFastext(map[current] || [
    { label: 'HEADLINE', page: 101 },
    { label: 'SPORT',    page: 301 },
    { label: 'WEATHER',  page: 400 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function renderHeadlines(g, subPage) {
  const stories = data.news().headlines;
  const total = Math.max(1, stories.length);
  const sub = clampSub(subPage, total);
  const story = stories[sub - 1];

  g.writeHeaderBand(101, 'NEWS', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, 'NEWS HEADLINES', SECTION);
  g.writeRow(4, story.category.toUpperCase(), 'C', 'K', 1);
  let row = g.writeWrapped(6, 10, story.title, 'Y', 'K', 1);
  row += 1;
  g.writeWrapped(row, 22, story.summary, 'W', 'K', 1);
  newsFastext(g, 101);
  g.writeFastextBar();
  return g.toJSON({ page: 101, subPage: sub, totalSubPages: total, title: 'NEWS HEADLINES' });
}

function renderIndex(g, pageNum) {
  g.writeHeaderBand(pageNum, 'NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NEWS INDEX', SECTION);
  let row = 4;
  for (const [label, page, colour] of NEWS_INDEX_ENTRIES) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  row += 1;
  g.writeRow(row++, 'LATEST', 'Y', 'K', 1);
  for (const s of data.news().headlines.slice(0, 3)) {
    if (row > 22) break;
    row = g.writeWrapped(row, 22, '* ' + s.title, 'C', 'K', 1);
  }
  newsFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'NEWS INDEX' });
}

function renderBrief(g) {
  g.writeHeaderBand(150, 'BRIEF', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NEWS IN BRIEF', SECTION);
  let row = 4;
  for (const item of data.news().newsInBrief) {
    if (row > 22) break;
    g.writeRow(row, '*', 'Y', 'K', 1);
    row = g.writeWrapped(row, 22, item, 'W', 'K', 3);
    row++;
  }
  newsFastext(g, 150);
  g.writeFastextBar();
  return g.toJSON({ page: 150, subPage: 1, totalSubPages: 1, title: 'NEWS IN BRIEF' });
}

function renderCategoryList(g, pageNum, title, categories) {
  const stories = data.news().headlines.filter(s => categories.includes(s.category));
  g.writeHeaderBand(pageNum, title, { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, title, SECTION);
  let row = 4;
  for (const s of stories) {
    if (row > 22) break;
    row = g.writeWrapped(row, 22, s.title, 'Y', 'K', 2);
    row = g.writeWrapped(row, 22, s.summary, 'W', 'K', 2);
    row++;
  }
  newsFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title });
}

function renderStory(g, pageNum) {
  const stories = data.news().headlines;
  const idx = (pageNum - 103) % stories.length;
  const story = stories[idx] || stories[0];
  g.writeHeaderBand(pageNum, 'NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NEWS STORY', SECTION);
  g.writeRow(4, story.category.toUpperCase(), 'C', 'K', 1);
  let row = g.writeWrapped(6, 10, story.title, 'Y', 'K', 1);
  row += 1;
  g.writeWrapped(row, 22, story.summary, 'W', 'K', 1);
  newsFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'NEWS' });
}

function render(pageNum, { subPage = 1 } = {}) {
  const g = new Grid();
  if (pageNum === 101) return renderHeadlines(g, subPage);
  if (pageNum === 102) return renderIndex(g, pageNum);
  if (pageNum === 150) return renderBrief(g);
  if (pageNum === 160) return renderCategoryList(g, 160, 'UK NEWS', ['UK']);
  if (pageNum === 170) return renderCategoryList(g, 170, 'WORLD NEWS', ['World']);
  if (pageNum >= 103 && pageNum <= 119) return renderStory(g, pageNum);
  return renderIndex(g, pageNum);
}

module.exports = { render };
