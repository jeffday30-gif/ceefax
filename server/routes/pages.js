const express = require('express');
const { render } = require('../renderers');

const router = express.Router();

// Run-length encode a grid row. Consecutive identical cells collapse to
// [count, cell]. A typical row is long runs of blank cells, so this cuts
// the JSON payload ~80% before gzip even sees it.
function rleRow(row) {
  const out = [];
  let run = null;
  let count = 0;
  const same = (a, b) =>
    a.c === b.c && a.f === b.f && a.b === b.b &&
    a.d === b.d && a.l === b.l && a.p === b.p && a.m === b.m;
  for (const cell of row) {
    if (run && same(run, cell)) {
      count++;
    } else {
      if (run) out.push([count, run]);
      run = cell;
      count = 1;
    }
  }
  if (run) out.push([count, run]);
  return out;
}

router.get('/:number', (req, res) => {
  const subPage = Math.max(1, Number(req.query.sub) || 1);
  const payload = render(req.params.number, { subPage });
  res.set('Cache-Control', 'no-store');
  // New clients request ?fmt=rle; old cached clients keep the fat format.
  if (req.query.fmt === 'rle') {
    const { grid, ...rest } = payload;
    res.json({ ...rest, gridRle: grid.map(rleRow) });
    return;
  }
  res.json(payload);
});

module.exports = router;
