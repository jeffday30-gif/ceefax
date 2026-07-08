const path = require('path');
const express = require('express');
const compression = require('compression');

const healthRouter = require('./routes/health');
const pagesRouter = require('./routes/pages');
const scrapers = require('./scrapers');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// Grid JSON is extremely repetitive - gzip cuts a page payload ~95%.
app.use(compression());

app.use('/healthz', healthRouter);
app.use('/api/page', pagesRouter);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'] }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ceefax listening on :${PORT}`);
  scrapers.start();
});
