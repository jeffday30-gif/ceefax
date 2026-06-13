// Generates PWA icons as flat-coloured PNGs without any image library.
// The icon design is a stylised Ceefax page: red top band, coloured "lines of
// text" in the middle, and a red/green/yellow/blue Fastext stripe at the bottom.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter: None
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function fillRect(pixels, size, x0, y0, w, h, r, g, b) {
  const xEnd = Math.min(size, x0 + w);
  const yEnd = Math.min(size, y0 + h);
  for (let y = Math.max(0, y0); y < yEnd; y++) {
    for (let x = Math.max(0, x0); x < xEnd; x++) {
      const i = (y * size + x) * 4;
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = 255;
    }
  }
}

function ceefaxIcon(size, opts = {}) {
  const { padding = 0 } = opts;
  const pixels = Buffer.alloc(size * size * 4, 0);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;

  const inner = size - padding * 2;
  const ox = padding;
  const oy = padding;

  // Top red band.
  fillRect(pixels, size, ox, oy, inner, Math.floor(inner * 0.15), 0xFF, 0x00, 0x00);

  // Bottom fastext stripes.
  const botH = Math.floor(inner * 0.13);
  const stripeW = Math.floor(inner / 4);
  const stripes = [
    [0xFF, 0x00, 0x00],
    [0x00, 0xFF, 0x00],
    [0xFF, 0xFF, 0x00],
    [0x00, 0x00, 0xFF],
  ];
  for (let s = 0; s < 4; s++) {
    const x = ox + s * stripeW;
    const w = s === 3 ? inner - stripeW * 3 : stripeW;
    fillRect(pixels, size, x, oy + inner - botH, w, botH, ...stripes[s]);
  }

  // Mid-area "lines of text" - varying width/colour bars to evoke a Ceefax page.
  const bars = [
    { wPct: 0.20, colour: [0xFF, 0xFF, 0x00] },
    { wPct: 0.55, colour: [0x00, 0xFF, 0xFF] },
    { wPct: 0.45, colour: [0xFF, 0xFF, 0xFF] },
    { wPct: 0.65, colour: [0xFF, 0xFF, 0xFF] },
    { wPct: 0.30, colour: [0xFF, 0xFF, 0x00] },
    { wPct: 0.50, colour: [0x00, 0xFF, 0xFF] },
  ];
  const barH = Math.max(4, Math.floor(inner * 0.045));
  const barGap = Math.max(4, Math.floor(inner * 0.04));
  const midTop = oy + Math.floor(inner * 0.22);
  const midBottom = oy + inner - botH - Math.floor(inner * 0.06);
  const totalBarH = bars.length * barH + (bars.length - 1) * barGap;
  let by = midTop + Math.floor(((midBottom - midTop) - totalBarH) / 2);
  for (const bar of bars) {
    const w = Math.floor(inner * bar.wPct);
    fillRect(pixels, size, ox + Math.floor(inner * 0.10), by, w, barH, ...bar.colour);
    by += barH + barGap;
  }

  return encodePng(size, size, pixels);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Standard square icons.
fs.writeFileSync(path.join(outDir, 'icon-192.png'), ceefaxIcon(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), ceefaxIcon(512));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), ceefaxIcon(180));
// Maskable icon needs ~20% safe-zone padding so the OS can mask the corners.
fs.writeFileSync(path.join(outDir, 'icon-maskable.png'), ceefaxIcon(512, { padding: 64 }));

console.log('icons written to', outDir);
