const { Grid } = require('./grid');
const { renderUnavailable } = require('./helpers');

function render(pageNum, _opts = {}) {
  const title = pageNum === 450 ? 'AIRPORTS' : 'TRAVEL NEWS';
  return renderUnavailable(pageNum, title, 'NO FREE TRAVEL FEED. ADD IN A LATER UPDATE.');
}

module.exports = { render };
