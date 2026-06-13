const COLOURS = {
  K: '#000000',
  R: '#FF0000',
  G: '#00FF00',
  Y: '#FFFF00',
  B: '#0000FF',
  M: '#FF00FF',
  C: '#00FFFF',
  W: '#FFFFFF',
};

function sectionColourFor(pageNum) {
  if (pageNum >= 100 && pageNum < 200) return 'R';
  if (pageNum >= 200 && pageNum < 300) return 'Y';
  if (pageNum >= 300 && pageNum < 400) return 'G';
  if (pageNum >= 400 && pageNum < 500) return 'B';
  if (pageNum >= 500 && pageNum < 600) return 'C';
  if (pageNum >= 600 && pageNum < 700) return 'M';
  return 'W';
}

// Header bands use white text on dark colours and black text on bright ones,
// otherwise the title becomes unreadable.
function headerTextColourFor(bgColour) {
  return (bgColour === 'Y' || bgColour === 'C' || bgColour === 'W') ? 'K' : 'W';
}

module.exports = { COLOURS, sectionColourFor, headerTextColourFor };
