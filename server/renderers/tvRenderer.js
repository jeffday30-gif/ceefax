const { Grid } = require('./grid');
const data = require('../data');

const SECTION = 'M';

function pad(s, n) { return String(s).padEnd(n, ' ').slice(0, n); }

const CHANNEL_PAGES = {
  601: 'BBC One',
  602: 'BBC Two',
  603: 'ITV',
  604: 'Channel 4',
  605: 'Channel 5',
};

const CHANNEL_PAGE_LIST = [601, 602, 603, 604, 605];

function tvFastext(g, current) {
  const idx = CHANNEL_PAGE_LIST.indexOf(current);
  if (idx >= 0) {
    // Authentic Ceefax did "BBC2 / ITV / C4 / Now" style cycling.
    const others = CHANNEL_PAGE_LIST.filter((_, i) => i !== idx).slice(0, 3);
    g.setFastext([
      { label: CHANNEL_PAGES[others[0]].toUpperCase(), page: others[0] },
      { label: CHANNEL_PAGES[others[1]].toUpperCase(), page: others[1] },
      { label: CHANNEL_PAGES[others[2]].toUpperCase(), page: others[2] },
      { label: 'INDEX',   page: 600 },
    ]);
    return;
  }
  g.setFastext([
    { label: 'BBC1',     page: 601 },
    { label: 'BBC2',     page: 602 },
    { label: 'ITV',      page: 603 },
    { label: 'INDEX',    page: 100 },
  ]);
}

function renderIndex(g) {
  g.writeHeaderBand(600, 'TV', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'TV LISTINGS', SECTION);
  const items = [
    ['BBC One today',     601, 'M'],
    ['BBC Two today',     602, 'M'],
    ['ITV today',         603, 'C'],
    ['Channel 4 today',   604, 'C'],
    ['Channel 5 today',   605, 'C'],
    ['Sport on TV today', 680, 'G'],
    ['Horse racing',      660, 'Y'],
    ['TV highlights',     501, 'W'],
  ];
  let row = 4;
  for (const [label, page, colour] of items) {
    g.writeRow(row, label, colour, 'K', 3);
    g.writeRow(row, String(page), 'W', 'K', 30);
    row++;
  }
  tvFastext(g, 600);
  g.writeFastextBar();
  return g.toJSON({ page: 600, subPage: 1, totalSubPages: 1, title: 'TV LISTINGS' });
}

function renderChannel(g, pageNum) {
  const channelName = CHANNEL_PAGES[pageNum];
  const schedule = data.tv().channels[channelName] || [];
  const perPage = 18;
  const total = Math.max(1, Math.ceil(schedule.length / perPage));
  const sub = 1;

  g.writeHeaderBand(pageNum, channelName.toUpperCase(), { subPage: sub, totalSubPages: total });
  g.writeSectionTitle(2, `${channelName.toUpperCase()} TODAY`, SECTION);
  let row = 4;
  for (const item of schedule.slice(0, perPage)) {
    if (row > 22) break;
    g.writeRow(row, item.time, 'Y', 'K', 2);
    g.writeRow(row, pad(item.title, 32), 'W', 'K', 8);
    row++;
  }
  tvFastext(g, pageNum);
  g.writeFastextBar();
  return g.toJSON({ page: pageNum, subPage: sub, totalSubPages: total, title: channelName.toUpperCase() });
}

function renderHorseRacing(g) {
  g.writeHeaderBand(660, 'RACING', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'HORSE RACING ON TV', SECTION);
  const items = [
    { time: '13:30', meeting: 'Ascot',     race: 'King Edward VII Stakes' },
    { time: '14:05', meeting: 'Ascot',     race: 'Queen Mary Stakes' },
    { time: '14:40', meeting: 'Ascot',     race: 'Prince of Wales Stakes' },
    { time: '15:15', meeting: 'York',      race: 'John Smiths Cup' },
    { time: '15:45', meeting: 'York',      race: 'Sky Bet Handicap' },
    { time: '16:20', meeting: 'Newmarket', race: 'Princess of Wales Stakes' },
  ];
  let row = 4;
  for (const r of items) {
    if (row > 22) break;
    g.writeRow(row, r.time, 'Y', 'K', 2);
    g.writeRow(row, pad(r.meeting, 10), 'C', 'K', 8);
    g.writeRow(row, pad(r.race, 22),    'W', 'K', 18);
    row++;
  }
  tvFastext(g, 660);
  g.writeFastextBar();
  return g.toJSON({ page: 660, subPage: 1, totalSubPages: 1, title: 'HORSE RACING' });
}

function renderSportOnTv(g) {
  g.writeHeaderBand(680, 'SPORT TV', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'SPORT ON TV TODAY', SECTION);
  const items = [
    { time: '12:00', channel: 'BBC1', event: 'Football Focus' },
    { time: '14:00', channel: 'ITV',  event: 'Live: F1 British GP' },
    { time: '15:00', channel: 'BBC1', event: 'Live: WC Group A' },
    { time: '17:30', channel: 'BBC1', event: 'WC Highlights' },
    { time: '19:00', channel: 'C4',   event: 'Live: T20 Cricket' },
    { time: '20:00', channel: 'ITV',  event: 'Live: WC Group D' },
    { time: '21:20', channel: 'BBC1', event: 'World Cup Round-Up' },
    { time: '22:30', channel: 'BBC1', event: 'Match of the Day WC' },
  ];
  let row = 4;
  for (const i of items) {
    if (row > 22) break;
    g.writeRow(row, i.time, 'Y', 'K', 2);
    g.writeRow(row, pad(i.channel, 5), 'C', 'K', 8);
    g.writeRow(row, pad(i.event, 26),  'W', 'K', 14);
    row++;
  }
  tvFastext(g, 680);
  g.writeFastextBar();
  return g.toJSON({ page: 680, subPage: 1, totalSubPages: 1, title: 'SPORT ON TV' });
}

function render(pageNum, _opts = {}) {
  const g = new Grid();
  if (pageNum === 600) return renderIndex(g);
  if (CHANNEL_PAGES[pageNum]) return renderChannel(g, pageNum);
  if (pageNum === 660) return renderHorseRacing(g);
  if (pageNum === 680) return renderSportOnTv(g);
  return renderIndex(g);
}

module.exports = { render };
