const { Grid } = require('./grid');

const SECTION = 'W';

function render(pageNum, _opts = {}) {
  const g = new Grid();
  g.writeHeaderBand(198, 'ABOUT', { subPage: 1, totalSubPages: 1 });
  g.writeSectionTitle(2, 'ABOUT TELETEXT REBORN', SECTION);

  g.writeCentered(4, 'TELETEXT REBORN', 'Y', 'K');
  g.writeCentered(5, 'An affectionate fan tribute',  'C', 'K');
  g.writeCentered(6, 'to BBC Ceefax 1974 - 2012',   'C', 'K');

  g.writeRow(9,  'DISCLAIMER', 'Y', 'K', 1);
  g.writeWrapped(10, 13,
    "This is a fan project. Not affiliated " +
    "with the BBC. Ceefax is a BBC trademark. " +
    "News and sport feeds belong to their " +
    "respective publishers.",
    'W', 'K', 1);

  g.writeRow(15, 'CONTACT', 'Y', 'K', 1);
  g.writeRow(16, 'mail@teletextreborn.app', 'C', 'K', 3,
    { l: 'mailto:mail@teletextreborn.app' });

  g.writeRow(18, 'SOURCE', 'Y', 'K', 1);
  g.writeRow(19, 'github.com/jeffday30-gif/ceefax', 'C', 'K', 3,
    { l: 'https://github.com/jeffday30-gif/ceefax' });

  g.writeRow(21, 'VERSION', 'Y', 'K', 1);
  g.writeRow(22, '-',       'W', 'K', 3);

  g.setFastext([
    { label: 'INDEX', page: 100 },
    { label: 'A-Z',   page: 199 },
    { label: 'PAGES', page: 152 },
    { label: 'HOME',  page: 100 },
  ]);
  g.writeFastextBar();
  return g.toJSON({ page: 198, subPage: 1, totalSubPages: 1, title: 'ABOUT' });
}

module.exports = { render };
