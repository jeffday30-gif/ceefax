const { Grid } = require('./grid');

const HOMEPAGE_SECTIONS = [
  { label: 'News headlines',   page: 101, colour: 'Y' },
  { label: 'News in brief',    page: 150, colour: 'Y' },
  { label: 'UK news',          page: 160, colour: 'Y' },
  { label: 'World news',       page: 170, colour: 'Y' },
  { label: 'Business',         page: 200, colour: 'C' },
  { label: 'LIVE SCORES',      page: 318, colour: 'R' },
  { label: 'WORLD CUP 2026',   page: 305, colour: 'G' },
  { label: 'Sport',            page: 300, colour: 'G' },
  { label: 'Football',         page: 302, colour: 'G' },
  { label: 'Cricket',          page: 340, colour: 'G' },
  { label: 'Weather',          page: 400, colour: 'C' },
  { label: 'Entertainment',    page: 500, colour: 'M' },
  { label: 'TV listings',      page: 600, colour: 'M' },
  { label: 'Lottery results',  page: 555, colour: 'R' },
  { label: 'A-Z index',        page: 199, colour: 'W' },
  { label: 'Pages from Ceefax',page: 152, colour: 'W' },
];

const AZ_ENTRIES = [
  ['About',            198],
  ['Airports',         450],
  ['Argentina at WC',  326],
  ['Athletics',        390],
  ['BBC One',          601],
  ['BBC Two',          602],
  ['Brazil at WC',     326],
  ['Business',         200],
  ['Channel 4',        604],
  ['Channel 5',        605],
  ['Championship',     325],
  ['City news',        201],
  ['Cricket',          340],
  ['Cricket scores',   341],
  ['Currency rates',   230],
  ['Division One',     303],
  ['Division Two',     304],
  ['England at WC',    329],
  ['Entertainment',    500],
  ['EuroMillions',     555],
  ['Film reviews',     510],
  ['Football',         302],
  ['Football news',    312],
  ['Football results', 316],
  ['Formula One',      360],
  ['FTSE 100',         220],
  ['Golf',             380],
  ['Group tables WC',  326],
  ['Headlines',        101],
  ['Horse racing',     660],
  ['ITV',              603],
  ['Knockout WC',      327],
  ['Lottery',          555],
  ['Main index',       100],
  ['Music news',       520],
  ['Newsround',        570],
  ['News in brief',    150],
  ['Pages from Ceefax',152],
  ['Premier League',   324],
  ['Roads',            430],
  ['Rugby',            370],
  ['Rugby results',    374],
  ['Share prices',     220],
  ['Sport',            300],
  ['Sport headlines',  301],
  ['Sport on TV',      680],
  ['Subtitles',        888],
  ['Top scorers WC',   328],
  ['Travel',           430],
  ['TV highlights',    501],
  ['TV listings',      600],
  ['UK news',          160],
  ['UK weather',       401],
  ['Weather',          400],
  ['Weather 5-day',    402],
  ['Weather world',    410],
  ["What's on",        540],
  ['World Cup 2026',   305],
  ['World news',       170],
];

function renderHome(g, pageNum, subPage) {
  g.writeHeaderBand(pageNum, 'TELETEXT', { subPage, totalSubPages: 1 });
  g.writeMasthead(2, 'TELETEXT', 'R');
  g.writeCentered(5, 'TELETEXT REBORN', 'C', 'K');

  let row = 7;
  for (const { label, page, colour } of HOMEPAGE_SECTIONS) {
    if (row > 21) break;
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  g.writeRow(22, 'About', 'W', 'K', 3);
  g.writeRow(22, '198',   'W', 'K', 30);
  g.setFastext([
    { label: 'HEADLINE', page: 101 },
    { label: 'FOOTBALL', page: 302 },
    { label: 'WEATHER',  page: 400 },
    { label: 'A-Z',      page: 199 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage, totalSubPages: 1, title: 'TELETEXT' });
}

function renderAZ(g, pageNum, subPage) {
  const perPage = 18;
  const total = Math.max(1, Math.ceil(AZ_ENTRIES.length / perPage));
  const sub = Math.min(Math.max(1, subPage), total);
  g.writeHeaderBand(pageNum, 'A-Z INDEX', { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, 'A - Z INDEX', 'C');

  const start = (sub - 1) * perPage;
  const slice = AZ_ENTRIES.slice(start, start + perPage);

  let row = 4;
  for (const [label, page] of slice) {
    if (row > 22) break;
    g.writeRow(row, label, 'C', 'K', 2);
    g.writeRow(row, String(page), 'Y', 'K', 30);
    row++;
  }
  g.setFastext([
    { label: 'INDEX',    page: 100 },
    { label: 'FOOTBALL', page: 302 },
    { label: 'WEATHER',  page: 400 },
    { label: 'TV',       page: 600 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: sub, totalSubPages: total, title: 'A-Z INDEX' });
}

function renderPagesFromCeefax(g) {
  g.writeHeaderBand(152, 'PAGES', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'PAGES FROM THE PAST', 'M');
  g.writeWrapped(5, 9,
    "BBC Ceefax (1974-2012) was the United Kingdom's " +
    "teletext service - 24 hours of rolling news, sport " +
    "and weather delivered as text-only pages.",
    'W', 'K', 1);
  g.writeWrapped(11, 15,
    "This is an affectionate fan tribute. We are not " +
    "affiliated with the BBC and 'Ceefax' remains a " +
    "BBC trademark.",
    'C', 'K', 1);
  g.writeCentered(17, "1974 - 2012", 'Y', 'K');
  g.writeCentered(19, "Press 100 to return to the index", 'W', 'K');
  g.setFastext([
    { label: 'INDEX',    page: 100 },
    { label: 'A-Z',      page: 199 },
    { label: 'ABOUT',    page: 198 },
    { label: 'SUBTITLE', page: 888 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: 152, subPage: 1, totalSubPages: 1, title: 'PAGES FROM THE PAST' });
}

function render(pageNum, { subPage = 1 } = {}) {
  const g = new Grid();
  if (pageNum === 199) return renderAZ(g, pageNum, subPage);
  if (pageNum === 152) return renderPagesFromCeefax(g);
  return renderHome(g, pageNum, subPage);
}

module.exports = { render };
