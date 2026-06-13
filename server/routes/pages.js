const express = require('express');
const { render } = require('../renderers');

const router = express.Router();

router.get('/:number', (req, res) => {
  const subPage = Math.max(1, Number(req.query.sub) || 1);
  const payload = render(req.params.number, { subPage });
  res.set('Cache-Control', 'no-store');
  res.json(payload);
});

module.exports = router;
