const { Grid } = require('./grid');
const data = require('../data');
const { renderUnavailable, isEmpty } = require('./helpers');

const SECTION = 'R';

const NEWS_INDEX_ENTRIES = [
  ['News headlines',  101, 'Y'],
  ['News stories',    111, 'Y'],
  ['News in brief',   150, 'Y'],
  ['UK news',         160, 'C'],
  ['World news',      170, 'C'],
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

// First story page. Stories with a fetched body get their own page here -
// tapping a headline on P101 navigates to it (yellow underline = internal).
const STORY_BASE = 111;
const STORY_MAX = 8;

// P101: the authentic Ceefax headline index - a list, each headline linking
// to its in-teletext story page.
function renderHeadlines(g) {
  const stories = data.news().headlines || [];
  if (isEmpty(stories)) return renderUnavailable(101, 'NEWS HEADLINES');
  if (data.isStale('news')) g.markStale();

  g.writeHeaderBand(101, 'NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NEWS HEADLINES', SECTION);

  let row = 4;
  for (let i = 0; i < Math.min(stories.length, STORY_MAX); i++) {
    if (row > 20) break;
    const s = stories[i];
    const pageNum = STORY_BASE + i;
    // Stories with a full body link internally; others link out to BBC.
    const link = s.body ? { p: pageNum } : (s.link ? { l: s.link } : {});
    g.writeRow(row, String(pageNum), 'W', 'K', 1);
    row = g.writeWrapped(row, 20, s.title, i === 0 ? 'Y' : 'C', 'K', 5, link);
    row++;
  }
  g.writeRow(22, 'TAP A HEADLINE TO READ THE STORY', 'W', 'K', 1);
  g.writeRow(23, 'YELLOW LINE=READ HERE CYAN=OPENS BBC', 'C', 'K', 1);
  newsFastext(g, 101);
  g.writeFastextBar();
  return g.toJSON({ page: 101, subPage: 1, totalSubPages: 1, title: 'NEWS HEADLINES' });
}

// P111-118: full article read inside the grid, paginated into sub-pages.
function renderStoryPage(g, pageNum, subPage) {
  const stories = data.news().headlines || [];
  const idx = pageNum - STORY_BASE;
  const story = stories[idx];
  if (!story) return renderUnavailable(pageNum, 'NEWS STORY', 'STORY NO LONGER AVAILABLE');
  if (data.isStale('news')) g.markStale();

  const link = story.link ? { l: story.link } : {};

  // Flow title + body into wrapped 38-char lines, then slice into sub-pages.
  const bodyParas = story.body && story.body.length ? story.body : [story.summary || ''];
  const lines = [];
  for (const para of bodyParas) {
    const words = String(para).split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      if (line && (line.length + 1 + w.length) > 38) {
        lines.push(line);
        line = w;
      } else {
        line = line ? `${line} ${w}` : w;
      }
    }
    if (line) lines.push(line);
    lines.push(''); // paragraph gap
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  // Title occupies rows 4..6ish on every sub-page; body rows 8..21 = 14 lines.
  const PER_PAGE = 14;
  const total = Math.max(1, Math.ceil(lines.length / PER_PAGE));
  const sub = clampSub(subPage, total);

  g.writeHeaderBand(pageNum, 'NEWS', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, (story.category || 'NEWS').toUpperCase() + ' NEWS', SECTION);
  const afterTitle = g.writeWrapped(4, 6, story.title, 'Y', 'K', 1);

  let row = Math.max(afterTitle + 1, 8);
  for (const line of lines.slice((sub - 1) * PER_PAGE, sub * PER_PAGE)) {
    if (row > 21) break;
    g.writeRow(row++, line, 'W', 'K', 1);
  }

  if (sub === total && story.link) {
    g.writeRow(23, 'TAP HERE FOR FULL STORY ON BBC NEWS', 'C', 'K', 1, link);
  } else {
    g.writeRow(23, `MORE - PRESS > OR WAIT (${sub}/${total})`, 'C', 'K', 1);
  }

  const nextStory = stories[idx + 1] && stories[idx + 1].body ? STORY_BASE + idx + 1 : 101;
  g.setFastext([
    { label: 'NEXT STORY', page: nextStory },
    { label: 'HEADLINES',  page: 101 },
    { label: 'NEWS INDEX', page: 102 },
    { label: 'HOME',       page: 100 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: sub, totalSubPages: total, title: story.title.slice(0, 20) });
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
  for (const s of (data.news().headlines || []).slice(0, 3)) {
    if (row > 22) break;
    const link = s.link ? { l: s.link } : {};
    row = g.writeWrapped(row, 22, '* ' + s.title, 'C', 'K', 1, link);
  }
  newsFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'NEWS INDEX' });
}

function renderBrief(g) {
  const brief = data.news().newsInBrief || [];
  if (isEmpty(brief)) return renderUnavailable(150, 'NEWS IN BRIEF');
  g.writeHeaderBand(150, 'BRIEF', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NEWS IN BRIEF', SECTION);
  let row = 4;
  for (const item of brief) {
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
  const stories = (data.news().headlines || []).filter(s => categories.includes(s.category));
  if (isEmpty(stories)) return renderUnavailable(pageNum, title);
  g.writeHeaderBand(pageNum, title, { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, title, SECTION);
  let row = 4;
  for (const s of stories) {
    if (row > 22) break;
    const link = s.link ? { l: s.link } : {};
    row = g.writeWrapped(row, 22, s.title, 'Y', 'K', 2, link);
    row = g.writeWrapped(row, 22, s.summary || '', 'W', 'K', 2, link);
    row++;
  }
  newsFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title });
}

function renderStory(g, pageNum) {
  const stories = data.news().headlines || [];
  if (isEmpty(stories)) return renderUnavailable(pageNum, 'NEWS');
  const idx = (pageNum - 103) % stories.length;
  const story = stories[idx] || stories[0];
  const link = story.link ? { l: story.link } : {};
  g.writeHeaderBand(pageNum, 'NEWS', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'NEWS STORY', SECTION);
  g.writeRow(4, (story.category || '').toUpperCase(), 'C', 'K', 1);
  let row = g.writeWrapped(6, 10, story.title, 'Y', 'K', 1, link);
  row += 1;
  g.writeWrapped(row, 22, story.summary || '', 'W', 'K', 1, link);
  newsFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: 'NEWS' });
}

function render(pageNum, { subPage = 1 } = {}) {
  const g = new Grid();
  if (pageNum === 101) return renderHeadlines(g);
  if (pageNum === 102) return renderIndex(g, pageNum);
  if (pageNum === 150) return renderBrief(g);
  if (pageNum === 160) return renderCategoryList(g, 160, 'UK NEWS', ['UK']);
  if (pageNum === 170) return renderCategoryList(g, 170, 'WORLD NEWS', ['World']);
  if (pageNum >= STORY_BASE && pageNum < STORY_BASE + STORY_MAX) {
    return renderStoryPage(g, pageNum, subPage);
  }
  if (pageNum >= 103 && pageNum <= 119) return renderStory(g, pageNum);
  return renderIndex(g, pageNum);
}

module.exports = { render };
