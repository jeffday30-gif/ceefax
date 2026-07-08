const express = require('express');
const data = require('../data');

const router = express.Router();

router.get('/', (_req, res) => {
  // Lazy require avoids a circular import (scrapers -> cache -> ... at boot).
  const { status: scraperStatus } = require('../scrapers');
  res.json({
    status: 'ok',
    ts: Date.now(),
    data: data.status(),
    scrapers: scraperStatus,
  });
});

module.exports = router;
