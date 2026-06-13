const express = require('express');
const data = require('../data');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now(), data: data.status() });
});

module.exports = router;
