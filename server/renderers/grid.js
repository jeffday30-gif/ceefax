const { sectionColourFor, headerTextColourFor } = require('./palette');

const COLS = 40;
const ROWS = 25;

// Authentic Ceefax fastext: the fourth slot is CYAN, not blue. Confirmed
// across every off-air 1996 capture.
const FASTEXT_COLOURS = ['R', 'G', 'Y', 'C'];

const DEFAULT_FASTEXT = [
  { label: 'NEWS',    page: 101 },
  { label: 'SPORT',   page: 301 },
  { label: 'WEATHER', page: 400 },
  { label: 'TV',      page: 601 },
];

// 3x5 pixel digit font for writeBigText. '#' = set pixel.
const BIG_FONT = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '-': ['...', '...', '###', '...', '...'],
  ' ': ['...', '...', '...', '...', '...'],
};

class Grid {
  constructor() {
    this.rows = ROWS;
    this.cols = COLS;
    this.cells = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ c: ' ', f: 'W', b: 'K' }))
    );
    this.fastext = DEFAULT_FASTEXT;
  }

  setFastext(targets) {
    if (Array.isArray(targets) && targets.length === 4) {
      this.fastext = targets.map((t) => ({
        // Full block on the canvas bar is 10 cols. Pages may use shorter
        // labels but anything ≤10 chars survives the canvas render intact.
        label: String(t.label || '').slice(0, 10).toUpperCase(),
        page: Number(t.page) || 100,
      }));
    }
  }

  set(row, col, char, fg = 'W', bg = 'K', extra = {}) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    const cell = { c: char, f: fg, b: bg };
    if (extra.d) cell.d = 1;
    if (extra.l) cell.l = extra.l;
    if (extra.p) cell.p = extra.p; // internal page link
    this.cells[row][col] = cell;
  }

  writeRow(row, text, fg = 'W', bg = 'K', startCol = 0, extra = {}) {
    const str = String(text);
    for (let i = 0; i < str.length && startCol + i < COLS; i++) {
      this.set(row, startCol + i, str[i], fg, bg, extra);
    }
  }

  writeCentered(row, text, fg = 'W', bg = 'K', extra = {}) {
    const str = String(text).slice(0, COLS);
    const start = Math.max(0, Math.floor((COLS - str.length) / 2));
    this.writeRow(row, str, fg, bg, start, extra);
  }

  fillRow(row, char = ' ', fg = 'W', bg = 'K') {
    for (let c = 0; c < COLS; c++) this.set(row, c, char, fg, bg);
  }

  // Word-wrap `text` into rows [startRow..endRow] inclusive starting at `indent`.
  // Returns the next free row. `extra` cascades to every cell written, so a
  // wrapped headline with `{l: url}` makes the whole headline tappable.
  writeWrapped(startRow, endRow, text, fg = 'W', bg = 'K', indent = 0, extra = {}) {
    const width = COLS - indent;
    if (width <= 0) return startRow;
    const words = String(text).split(/\s+/).filter(Boolean);
    let row = startRow;
    let line = '';
    for (const w of words) {
      if (row > endRow) return row;
      if (!line) {
        line = w.slice(0, width);
      } else if (line.length + 1 + w.length <= width) {
        line += ' ' + w;
      } else {
        this.writeRow(row, line, fg, bg, indent, extra);
        row++;
        if (row > endRow) return row;
        line = w.slice(0, width);
      }
    }
    if (line && row <= endRow) {
      this.writeRow(row, line, fg, bg, indent, extra);
      row++;
    }
    return row;
  }

  // Left-aligned label + right-aligned value on the same row.
  writeLR(row, left, right, leftFg = 'W', rightFg = 'W', bg = 'K') {
    const l = String(left);
    const r = String(right);
    this.writeRow(row, l, leftFg, bg, 0);
    const start = Math.max(l.length + 1, COLS - r.length);
    this.writeRow(row, r, rightFg, bg, start);
  }

  // Row 0: authentic teletext header on BLACK background with coloured text.
  // Format: "P302 TELETEXT     Mon 11 Nov 22:54/17"
  // Colours: page yellow, brand white, date cyan, clock yellow.
  // The client overwrites cols 16-39 each second with the live date and clock.
  // Sub-page indicator lives on the right edge of the section title bar (row 2)
  // - that's the authentic placement and avoids colliding with the clock.
  writeHeaderBand(pageNum, _title, opts = {}) {
    this.fillRow(0, ' ', 'W', 'K');
    const padded = String(pageNum).padStart(3, ' ');
    this.writeRow(0, `P${padded}`, 'Y', 'K', 0);
    this.writeRow(0, 'TELETEXT', 'W', 'K', 5);
    // Stash sub-page info so writeSectionTitle can render the indicator.
    this._subPage = opts.subPage;
    this._totalSubPages = opts.totalSubPages;
    // Seed the right segment with a placeholder. Client redraws every second
    // using local time and the authentic "/" between minutes and seconds.
    const now = new Date();
    const day = String(now.getUTCDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dow = days[now.getUTCDay()];
    const mon = months[now.getUTCMonth()];
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    this.writeRow(0, `${dow} ${day} ${mon}`, 'C', 'K', 16);
    this.writeRow(0, `${hh}:${mm}/${ss}`, 'Y', 'K', 32);
  }

  // A full-width coloured section title bar (the kind that sat just under
  // the header on real Ceefax index pages). One full row, white text on
  // the section background colour. Optionally writes "1/N" on the right
  // edge - authentic placement, mirrors real Ceefax sub-page indicators
  // and avoids colliding with the row-0 clock.
  // Flags the page's data source as stale. writeSectionTitle renders a dot
  // on the left edge of the title bar - the authentic Ceefax "page being
  // updated" convention, repurposed as an honest data-age indicator.
  markStale() {
    this._stale = true;
  }

  writeSectionTitle(row, title, sectionColour) {
    const bg = sectionColour;
    const fg = headerTextColourFor(bg);
    this.fillRow(row, ' ', fg, bg);
    const t = String(title).toUpperCase().slice(0, COLS - 6);
    this.writeRow(row, t, fg, bg, Math.max(1, Math.floor((COLS - t.length) / 2)));
    if (this._totalSubPages && this._totalSubPages > 1) {
      const indicator = `${this._subPage || 1}/${this._totalSubPages}`.slice(0, 5);
      this.writeRow(row, indicator, fg, bg, COLS - indicator.length - 1);
    }
    if (this._stale) {
      this.set(row, 0, '●', 'Y', bg);
    }
  }

  // Larger 2-row banner with double-height title text - used on section
  // index pages so they read like the BBC reference screenshots
  // (e.g. the "BBC FOOTBALL" masthead).
  writeMasthead(row, title, sectionColour) {
    const bg = sectionColour;
    const fg = headerTextColourFor(bg);
    this.fillRow(row, ' ', fg, bg);
    this.fillRow(row + 1, ' ', fg, bg);
    const t = String(title).toUpperCase().slice(0, COLS - 4);
    const start = Math.max(1, Math.floor((COLS - t.length) / 2));
    for (let i = 0; i < t.length; i++) {
      this.set(row, start + i, t[i], fg, bg, { d: 1 });
    }
    if (this._totalSubPages && this._totalSubPages > 1) {
      const indicator = `${this._subPage || 1}/${this._totalSubPages}`.slice(0, 5);
      this.writeRow(row + 1, indicator, fg, bg, COLS - indicator.length - 1);
    }
  }

  // Authentic teletext separator: a row of filled block characters in the
  // requested colour, evoking the mosaic block-graphics dividers Ceefax used
  // instead of horizontal rules.
  writeSeparator(row, colour = 'C') {
    for (let c = 0; c < COLS; c++) this.set(row, c, '█', colour, 'K');
  }

  // --- SAA5050 block mosaics -------------------------------------------
  // A mosaic cell divides the character cell into a 2x3 grid of blocks.
  // `mask` is a 6-bit value: bit0 top-left, bit1 top-right, bit2 mid-left,
  // bit3 mid-right, bit4 bottom-left, bit5 bottom-right (the classic
  // teletext sixel ordering). The client draws the blocks with fillRect -
  // pixel-perfect, no font dependency.
  setMosaic(row, col, mask, fg = 'W', bg = 'K') {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    if (!mask) { this.set(row, col, ' ', fg, bg); return; }
    this.cells[row][col] = { c: ' ', f: fg, b: bg, m: mask & 0x3f };
  }

  // Draw a pixel bitmap in mosaic blocks. `bitmap` is an array of strings;
  // any character other than space/dot is a set pixel. Each grid cell holds
  // 2x3 bitmap pixels, so a 52x51 bitmap covers 26x17 cells.
  drawBitmap(topRow, leftCol, bitmap, fg = 'B', bg = 'K') {
    const px = (x, y) => {
      const line = bitmap[y];
      if (!line || x >= line.length) return 0;
      const ch = line[x];
      return ch !== ' ' && ch !== '.' ? 1 : 0;
    };
    const cellRows = Math.ceil(bitmap.length / 3);
    const width = Math.max(...bitmap.map((l) => l.length));
    const cellCols = Math.ceil(width / 2);
    for (let cr = 0; cr < cellRows; cr++) {
      for (let cc = 0; cc < cellCols; cc++) {
        const x = cc * 2;
        const y = cr * 3;
        const mask =
          (px(x, y)         << 0) | (px(x + 1, y)     << 1) |
          (px(x, y + 1)     << 2) | (px(x + 1, y + 1) << 3) |
          (px(x, y + 2)     << 4) | (px(x + 1, y + 2) << 5);
        if (mask) this.setMosaic(topRow + cr, leftCol + cc, mask, fg, bg);
      }
    }
  }

  // Big block digits: a 3x5 pixel font rendered in mosaics. Each character
  // advances 4 bitmap pixels (2 cells); glyphs are 5px tall (2 cell rows).
  // Used for lottery numbers and other showpiece numerals.
  writeBigText(topRow, leftCol, text, fg = 'W', bg = 'K') {
    const rows = ['', '', '', '', ''];
    for (const ch of String(text)) {
      const glyph = BIG_FONT[ch] || BIG_FONT[' '];
      for (let i = 0; i < 5; i++) rows[i] += glyph[i] + ' ';
    }
    this.drawBitmap(topRow, leftCol, rows, fg, bg);
    return leftCol + Math.ceil((String(text).length * 4) / 2);
  }

  // Historically row 24 held the four coloured fastext blocks. The remote
  // surround now has physical fastext buttons, so the on-canvas duplicate
  // is intentionally a no-op. The fastext targets still ship in the API
  // payload so the remote stays dynamic. Kept as a no-op rather than
  // deleting the call sites - every renderer calls it.
  writeFastextBar() {
    // intentionally empty
  }

  toJSON({ page, subPage = 1, totalSubPages = 1, title = '', sectionColour } = {}) {
    return {
      page,
      subPage,
      totalSubPages,
      title,
      sectionColour: sectionColour || sectionColourFor(page),
      grid: this.cells,
      fastext: {
        red:    this.fastext[0],
        green:  this.fastext[1],
        yellow: this.fastext[2],
        cyan:   this.fastext[3],
      },
      cachedAt: new Date().toISOString(),
    };
  }
}

module.exports = { Grid, COLS, ROWS, DEFAULT_FASTEXT, FASTEXT_COLOURS };
