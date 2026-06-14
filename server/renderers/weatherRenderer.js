const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'B';

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }
function rpad(s, n) { return String(s).padStart(n, ' ').slice(-n); }

// BBC Weather URL = https://www.bbc.co.uk/weather/{geonames-id}. Geoname IDs
// are stable, BBC has been using them for ~15 years.
const BBC_WEATHER_ID = {
  London: 2643743, Manchester: 2643123, Birmingham: 2655603,
  Leeds: 2644688,  Liverpool: 2644210,  Bristol: 2654675,
  Newcastle: 2641673, Edinburgh: 2650225, Cardiff: 2653822, Belfast: 2655984,
  Paris: 2988507, Madrid: 3117735, Rome: 3169070,
  Berlin: 2950159, 'New York': 5128581, Sydney: 2147714,
};

function bbcWeatherUrl(name) {
  const id = BBC_WEATHER_ID[name];
  return id ? `https://www.bbc.co.uk/weather/${id}` : null;
}

// BBC regional weather hub URLs.
const REGION_URL = {
  england:         'https://www.bbc.co.uk/weather/regions',
  scotland:        'https://www.bbc.co.uk/weather/regions/scotland',
  wales:           'https://www.bbc.co.uk/weather/regions/wales',
  northernIreland: 'https://www.bbc.co.uk/weather/regions/northern-ireland',
};

const REGIONAL_PAGES = {
  403: { title: 'ENGLAND',          field: 'england' },
  404: { title: 'SCOTLAND',         field: 'scotland' },
  405: { title: 'WALES',            field: 'wales' },
  406: { title: 'NORTHERN IRELAND', field: 'northernIreland' },
};

function weatherFastext(g, current) {
  const map = {
    400: [{ label: 'UK MAP',  page: 401 }, { label: '5 DAY',    page: 402 }, { label: 'WORLD',   page: 410 }, { label: 'INDEX',  page: 100 }],
    401: [{ label: '5 DAY',   page: 402 }, { label: 'REGIONAL', page: 403 }, { label: 'WORLD',   page: 410 }, { label: 'INDEX',  page: 400 }],
    402: [{ label: 'UK MAP',  page: 401 }, { label: 'WORLD',    page: 410 }, { label: 'TRAVEL',  page: 430 }, { label: 'INDEX',  page: 400 }],
    410: [{ label: 'UK MAP',  page: 401 }, { label: '5 DAY',    page: 402 }, { label: 'TRAVEL',  page: 430 }, { label: 'INDEX',  page: 400 }],
  };
  g.setFastext(map[current] || [
    { label: 'UK MAP',  page: 401 },
    { label: 'WORLD',   page: 410 },
    { label: 'TRAVEL',  page: 430 },
    { label: 'INDEX',   page: 400 },
  ]);
}

function renderIndex(g) {
  g.writeHeaderBand(400, 'WEATHER', { subPage: 1, totalSubPages: 1 });
  g.writeMasthead(2, 'BBC WEATHER', SECTION);
  const items = [
    ['UK national forecast', 401, 'C'],
    ['5-day UK forecast',    402, 'C'],
    ['England regional',     403, 'Y'],
    ['Scotland',             404, 'Y'],
    ['Wales',                405, 'Y'],
    ['Northern Ireland',     406, 'Y'],
    ['World weather',        410, 'M'],
    ['Travel news',          430, 'G'],
  ];
  let row = 5;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  row += 1;
  g.writeRow(row++, 'OUTLOOK', 'Y', 'K', 1);
  g.writeWrapped(row, 22, data.weather().outlook, 'W', 'K', 1);
  weatherFastext(g, 400);
  g.writeFastextBar();
  return g.toJSON({ page: 400, subPage: 1, totalSubPages: 1, title: 'WEATHER' });
}

function renderNational(g) {
  g.writeHeaderBand(401, 'UK WEATHER', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'UK WEATHER TODAY', SECTION);
  let row = g.writeWrapped(4, 7, data.weather().outlook, 'C', 'K', 0);
  row = Math.max(row + 1, 9);
  g.writeRow(row, 'City',    'C', 'K', 2);
  g.writeRow(row, 'Temp',    'C', 'K', 16);
  g.writeRow(row, 'Outlook', 'C', 'K', 22);
  g.writeRow(row, 'Wind',    'C', 'K', 33);
  row++;
  for (const c of data.weather().cities) {
    if (row > 21) break;
    const url = bbcWeatherUrl(c.name);
    const link = url ? { l: url } : {};
    g.writeRow(row, pad(c.name, 12),               'W', 'K', 2,  link);
    g.writeRow(row, rpad(`${c.tempC}C`, 5),        'Y', 'K', 15, link);
    g.writeRow(row, pad(c.condition, 11),          'C', 'K', 21, link);
    g.writeRow(row, pad(c.wind, 8),                'W', 'K', 32, link);
    row++;
  }
  g.writeRow(23, 'TAP A CITY FOR BBC WEATHER FORECAST', 'C', 'K', 0);
  weatherFastext(g, 401);
  g.writeFastextBar();
  return g.toJSON({ page: 401, subPage: 1, totalSubPages: 1, title: 'UK WEATHER' });
}

function renderFiveDay(g) {
  g.writeHeaderBand(402, '5 DAY', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'UK 5-DAY OUTLOOK', SECTION);
  g.writeRow(4, 'Day',       'C', 'K', 2);
  g.writeRow(4, 'High',      'C', 'K', 14);
  g.writeRow(4, 'Low',       'C', 'K', 22);
  g.writeRow(4, 'Outlook',   'C', 'K', 28);
  let row = 6;
  for (const d of data.weather().fiveDay) {
    if (row > 22) break;
    g.writeRow(row, pad(d.day, 8),         'W', 'K', 2);
    g.writeRow(row, rpad(`${d.high}C`, 4), 'Y', 'K', 13);
    g.writeRow(row, rpad(`${d.low}C`, 4),  'C', 'K', 21);
    g.writeRow(row, pad(d.icon, 10),       'W', 'K', 28);
    row += 2;
  }
  weatherFastext(g, 402);
  g.writeFastextBar();
  return g.toJSON({ page: 402, subPage: 1, totalSubPages: 1, title: '5-DAY FORECAST' });
}

function renderRegional(g, pageNum) {
  const meta = REGIONAL_PAGES[pageNum];
  const summary = data.weather().regions[meta.field] ||
                  data.weather().regions[meta.field.toLowerCase()] ||
                  'Outlook unavailable.';
  g.writeHeaderBand(pageNum, meta.title, { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, meta.title, SECTION);
  const url = REGION_URL[meta.field];
  const link = url ? { l: url } : {};
  g.writeWrapped(4, 14, summary, 'C', 'K', 1, link);
  if (url) g.writeRow(23, 'TAP FOR FULL BBC REGIONAL FORECAST', 'C', 'K', 0);
  weatherFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: 1, totalSubPages: 1, title: meta.title });
}

function renderWorld(g) {
  g.writeHeaderBand(410, 'WORLD', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'WORLD WEATHER', SECTION);
  g.writeRow(4, 'City',      'C', 'K', 2);
  g.writeRow(4, 'Temp',      'C', 'K', 18);
  g.writeRow(4, 'Outlook',   'C', 'K', 28);
  let row = 6;
  for (const w of data.weather().regions.world) {
    if (row > 21) break;
    const url = bbcWeatherUrl(w.city);
    const link = url ? { l: url } : {};
    g.writeRow(row, pad(w.city, 14),         'W', 'K', 2,  link);
    g.writeRow(row, rpad(`${w.tempC}C`, 5),  'Y', 'K', 17, link);
    g.writeRow(row, pad(w.condition, 11),    'C', 'K', 28, link);
    row++;
  }
  g.writeRow(23, 'TAP A CITY FOR BBC WEATHER FORECAST', 'C', 'K', 0);
  weatherFastext(g, 410);
  g.writeFastextBar();
  return g.toJSON({ page: 410, subPage: 1, totalSubPages: 1, title: 'WORLD WEATHER' });
}

function ensureEngland() {
  const w = data.weather();
  if (w && w.regions && !w.regions.england) {
    w.regions.england = 'Warm and sunny in southern and central England with temperatures into the mid-20s. Cooler with cloud near the north-east coast.';
  }
}

function render(pageNum, _opts = {}) {
  ensureEngland();
  const g = new Grid();
  if (pageNum === 400) return renderIndex(g);
  if (pageNum === 401) return renderNational(g);
  if (pageNum === 402) return renderFiveDay(g);
  if (REGIONAL_PAGES[pageNum]) return renderRegional(g, pageNum);
  if (pageNum === 410) return renderWorld(g);
  return renderIndex(g);
}

module.exports = { render };
