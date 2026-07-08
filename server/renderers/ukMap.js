// UK silhouette for the Ceefax-style weather map (P401), as a 52x51 pixel
// bitmap rendered in 2x3 block mosaics (26x17 character cells).
//
// The shape is defined as land spans per bitmap row, derived from a simple
// equirectangular projection (lon -7.5..+2 => x 0..52, lat 58.7..49.9 =>
// y 0..51). Crude, but at this resolution reads unmistakably as the UK -
// exactly like the original Ceefax map.

// Great Britain: [xStart, xEnd] land span per row y = 0..50.
const GB = [
  /* y0  */ [14, 25],
  /* y1  */ [13, 26],
  /* y2  */ [13, 27],
  /* y3  */ [12, 28],
  /* y4  */ [12, 28],
  /* y5  */ [13, 29],
  /* y6  */ [13, 30],
  /* y7  */ [14, 30],
  /* y8  */ [14, 30],
  /* y9  */ [14, 30],
  /* y10 */ [15, 30],
  /* y11 */ [15, 29],
  /* y12 */ [15, 29],
  /* y13 */ [16, 28],
  /* y14 */ [16, 27],
  /* y15 */ [15, 26],
  /* y16 */ [14, 31],
  /* y17 */ [14, 31],
  /* y18 */ [13, 31],
  /* y19 */ [14, 31],
  /* y20 */ [16, 32],
  /* y21 */ [18, 33],
  /* y22 */ [20, 33],
  /* y23 */ [19, 33],
  /* y24 */ [19, 34],
  /* y25 */ [20, 34],
  /* y26 */ [20, 35],
  /* y27 */ [21, 36],
  /* y28 */ [21, 38],
  /* y29 */ [20, 39],
  /* y30 */ [18, 39],
  /* y31 */ [15, 40],
  /* y32 */ [15, 41],
  /* y33 */ [16, 44],
  /* y34 */ [16, 50],
  /* y35 */ [17, 50],
  /* y36 */ [18, 49],
  /* y37 */ [17, 47],
  /* y38 */ [15, 45],
  /* y39 */ [13, 44],
  /* y40 */ [12, 45],
  /* y41 */ [[13, 17], [23, 46]], // Bristol Channel notch
  /* y42 */ [22, 47],
  /* y43 */ [20, 48],
  /* y44 */ [18, 48],
  /* y45 */ [14, 42],
  /* y46 */ [12, 38],
  /* y47 */ [10, 30],
  /* y48 */ [9, 20],
  /* y49 */ [9, 14],
  /* y50 */ null,
];

// Northern Ireland: separate landmass, rows y20-28.
const NI = {
  20: [4, 10],
  21: [2, 11],
  22: [1, 11],
  23: [0, 11],
  24: [0, 10],
  25: [0, 10],
  26: [1, 9],
  27: [2, 8],
  28: [3, 6],
};

const WIDTH = 52;

function paint(line, span) {
  for (let x = span[0]; x <= span[1] && x < WIDTH; x++) line[x] = '#';
}

function buildBitmap() {
  const rows = [];
  for (let y = 0; y <= 50; y++) {
    const line = new Array(WIDTH).fill('.');
    const gb = GB[y];
    if (gb) {
      const spans = Array.isArray(gb[0]) ? gb : [gb];
      for (const s of spans) paint(line, s);
    }
    const ni = NI[y];
    if (ni) paint(line, ni);
    rows.push(line.join(''));
  }
  return rows;
}

const BITMAP = buildBitmap();

// City temperature positions in CELL coordinates relative to the map's
// top-left cell (map is 26 cells wide, 17 tall). Chosen so 2-character
// temperatures sit on the right landmass without colliding.
const CITY_CELLS = {
  Belfast:    { col: 4,  row: 7 },
  Edinburgh:  { col: 12, row: 5 },
  Newcastle:  { col: 16, row: 7 },
  Manchester: { col: 14, row: 10 },
  Birmingham: { col: 15, row: 12 },
  Cardiff:    { col: 11, row: 13 },
  London:     { col: 20, row: 14 },
};

module.exports = { BITMAP, CITY_CELLS };
