(() => {
  const COLOURS = {
    K: '#000000', R: '#FF0000', G: '#00FF00', Y: '#FFFF00',
    B: '#0000FF', M: '#FF00FF', C: '#00FFFF', W: '#FFFFFF',
  };
  const COLS = 40;
  const ROWS = 25;
  const CELL_W = 12;
  const CELL_H = 20;
  const FASTEXT_COLOURS = ['red', 'green', 'yellow', 'cyan'];
  const FALLBACK_FASTEXT = {
    red:    { label: 'NEWS',    page: 101 },
    green:  { label: 'SPORT',   page: 301 },
    yellow: { label: 'WEATHER', page: 400 },
    cyan:   { label: 'TV',      page: 601 },
  };
  const TYPING_TIMEOUT_MS = 3000;
  // Authentic Ceefax sub-page cycle was ~10 seconds, not 8.
  const SUBPAGE_CYCLE_MS = 10000;
  const SWIPE_THRESHOLD_PX = 40;

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'top';
  const statusLine = document.getElementById('status-line');
  const holdBtn = document.getElementById('hold-btn');
  const fastextRow = document.getElementById('fastext-row');
  const fastextBtns = Object.fromEntries(
    FASTEXT_COLOURS.map((c) => [c, fastextRow.querySelector(`[data-fastext="${c}"]`)])
  );
  const subpageRow = document.getElementById('subpage-row');
  const subpageIndicator = document.getElementById('subpage-indicator');
  const hint = document.getElementById('hint');
  const LAST_PAGE_KEY = 'teletext.lastPage';
  const HINT_SEEN_KEY = 'teletext.hintSeen';

  let current = null;
  let currentSub = 1;
  let typedDigits = '';
  let typingExpiry = 0;
  let subCycleTimer = null;
  let holding = false;

  async function loadFont() {
    if (!document.fonts) return;
    try { await document.fonts.load(`${CELL_H}px Bedstead`); } catch {}
  }

  function drawCellBg(row, col, cell) {
    ctx.fillStyle = COLOURS[cell.b] || '#000';
    ctx.fillRect(col * CELL_W, row * CELL_H, CELL_W, CELL_H);
  }

  // SAA5050 mosaic sub-block geometry: the 12x20 cell divides into a 2x3
  // grid of blocks, 6px wide, rows 7/7/6 tall.
  const MOSAIC_BLOCKS = [
    [0, 0, 6, 7],  [6, 0, 6, 7],   // bits 0,1 - top
    [0, 7, 6, 7],  [6, 7, 6, 7],   // bits 2,3 - middle
    [0, 14, 6, 6], [6, 14, 6, 6],  // bits 4,5 - bottom
  ];

  function drawCellFg(row, col, cell) {
    const x = col * CELL_W;
    const y = row * CELL_H;
    if (cell.m) {
      ctx.fillStyle = COLOURS[cell.f] || '#fff';
      for (let bit = 0; bit < 6; bit++) {
        if (cell.m & (1 << bit)) {
          const [bx, by, bw, bh] = MOSAIC_BLOCKS[bit];
          ctx.fillRect(x + bx, y + by, bw, bh);
        }
      }
      return;
    }
    const ch = cell.c;
    const hasChar = ch && ch !== ' ';
    if (hasChar) {
      ctx.fillStyle = COLOURS[cell.f] || '#fff';
      const size = cell.d ? CELL_H * 2 : CELL_H;
      ctx.font = `${size}px "Bedstead", monospace`;
      ctx.fillText(ch, x, y);
    }
    // Underline links, but only under visible characters. External links
    // (l) underline cyan; internal page links (p) underline yellow.
    if (cell.l && hasChar) {
      ctx.fillStyle = COLOURS.C;
      ctx.fillRect(x, y + CELL_H - 1, CELL_W, 1);
    } else if (cell.p && hasChar) {
      ctx.fillStyle = COLOURS.Y;
      ctx.fillRect(x, y + CELL_H - 1, CELL_W, 1);
    }
  }

  function drawCell(row, col, cell) {
    drawCellBg(row, col, cell);
    drawCellFg(row, col, cell);
  }

  // Draw one full row (bg then fg). If the row above contains double-height
  // characters, repaint its fg so the descending halves survive this row's
  // background fill.
  function drawRow(grid, r) {
    for (let c = 0; c < COLS; c++) drawCellBg(r, c, grid[r][c]);
    if (r > 0 && grid[r - 1].some((cell) => cell.d)) {
      for (let c = 0; c < COLS; c++) drawCellFg(r - 1, c, grid[r - 1][c]);
    }
    for (let c = 0; c < COLS; c++) drawCellFg(r, c, grid[r][c]);
  }

  function drawGrid(grid) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) drawCellBg(r, c, grid[r][c]);
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) drawCellFg(r, c, grid[r][c]);
    }
  }

  // Row-reveal: paint the page top-to-bottom over ~250ms, the way a real
  // teletext page filled in as data arrived off the broadcast stream.
  let revealToken = 0;
  function revealGrid(grid) {
    const token = ++revealToken;
    let row = 0;
    function step() {
      if (token !== revealToken) return; // superseded by a newer page
      const until = Math.min(ROWS, row + 3);
      for (; row < until; row++) drawRow(grid, row);
      if (row < ROWS) requestAnimationFrame(step);
    }
    step();
  }

  // Expand the run-length-encoded grid format from ?fmt=rle.
  function decodeRle(gridRle) {
    return gridRle.map((row) => {
      const out = [];
      for (const [count, cell] of row) {
        for (let i = 0; i < count; i++) out.push(cell);
      }
      return out;
    });
  }

  // Cols 16-39 of row 0 hold the authentic Ceefax date+clock segment:
  // "Mon 11 Nov 22:54/17" - day-of-week + day + month in cyan, then clock
  // in yellow with a "/" between minutes and seconds (a real Ceefax quirk).
  // While the user is typing a page number, those cells are replaced with
  // the digit buffer in yellow.
  function paintHeaderRight() {
    if (!current) return;
    const isTyping = typedDigits.length > 0 && Date.now() < typingExpiry;
    if (isTyping) {
      const padded = (typedDigits + '___').slice(0, 3);
      const text = `         PAGE P${padded}  `.padEnd(24, ' ').slice(0, 24);
      for (let i = 0; i < 24; i++) {
        const col = 16 + i;
        const cell = { c: text[i] || ' ', f: 'Y', b: 'K' };
        current.grid[0][col] = cell;
        drawCell(0, col, cell);
      }
      return;
    }
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const dow = days[now.getDay()];
    const mon = months[now.getMonth()];
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const dateStr = `${dow} ${day} ${mon}`.padEnd(13, ' ');
    const clockStr = `${hh}:${mm}/${ss}`;
    // Date in cyan (cols 16-28), clock in yellow (cols 32-39).
    for (let i = 0; i < 13; i++) {
      const col = 16 + i;
      const cell = { c: dateStr[i] || ' ', f: 'C', b: 'K' };
      current.grid[0][col] = cell;
      drawCell(0, col, cell);
    }
    // Gap cells 29-31.
    for (let col = 29; col < 32; col++) {
      const cell = { c: ' ', f: 'W', b: 'K' };
      current.grid[0][col] = cell;
      drawCell(0, col, cell);
    }
    for (let i = 0; i < 8; i++) {
      const col = 32 + i;
      const cell = { c: clockStr[i] || ' ', f: 'Y', b: 'K' };
      current.grid[0][col] = cell;
      drawCell(0, col, cell);
    }
  }

  function setStatus(text) {
    statusLine.textContent = text || '';
  }

  function clearTyping() {
    typedDigits = '';
    typingExpiry = 0;
    setStatus('');
    paintHeaderRight();
  }

  function pushDigit(d) {
    if (!/^\d$/.test(d)) return;
    typedDigits = (typedDigits + d).slice(0, 3);
    typingExpiry = Date.now() + TYPING_TIMEOUT_MS;
    setStatus(`PAGE ${typedDigits.padEnd(3, '_')}`);
    paintHeaderRight();
    if (typedDigits.length === 3) {
      const n = Number(typedDigits);
      typedDigits = '';
      typingExpiry = 0;
      setStatus('');
      navigate(n, 1);
    }
  }

  function popDigit() {
    if (!typedDigits) return;
    typedDigits = typedDigits.slice(0, -1);
    if (typedDigits) {
      typingExpiry = Date.now() + TYPING_TIMEOUT_MS;
      setStatus(`PAGE ${typedDigits.padEnd(3, '_')}`);
    } else {
      typingExpiry = 0;
      setStatus('');
    }
    paintHeaderRight();
  }

  function stopSubCycle() {
    if (subCycleTimer) { clearInterval(subCycleTimer); subCycleTimer = null; }
  }

  function startSubCycle() {
    stopSubCycle();
    if (!current || current.totalSubPages <= 1 || holding) return;
    subCycleTimer = setInterval(() => {
      if (!current || holding) return;
      const next = currentSub >= current.totalSubPages ? 1 : currentSub + 1;
      navigate(current.page, next, false);
    }, SUBPAGE_CYCLE_MS);
  }

  function setHolding(next) {
    holding = next;
    holdBtn.classList.toggle('active', holding);
    if (holding) {
      stopSubCycle();
      setStatus('HOLD');
    } else {
      setStatus('');
      startSubCycle();
    }
  }

  // While a page fetch is in flight the header rolls through page numbers -
  // the authentic Ceefax "searching the carousel" behaviour.
  let rollTimer = null;
  function startHeaderRoll(fromPage) {
    stopHeaderRoll();
    let n = fromPage || 100;
    rollTimer = setInterval(() => {
      n = n >= 899 ? 100 : n + 1;
      const text = `P${String(n).padStart(3, '0')}`;
      for (let i = 0; i < 4; i++) {
        drawCell(0, i, { c: text[i], f: 'W', b: 'K' });
      }
    }, 50);
  }
  function stopHeaderRoll() {
    if (rollTimer) { clearInterval(rollTimer); rollTimer = null; }
  }

  async function navigate(pageNum, sub = 1, push = true, reveal = true) {
    // Show a loading state immediately so the user gets feedback - matters
    // most on Render free's ~30s cold start.
    setLoading(`PLEASE WAIT P${pageNum}`);
    const changingPage = !current || current.page !== Number(pageNum);
    if (changingPage) startHeaderRoll(current ? current.page : Number(pageNum));
    try {
      const url = `/api/page/${pageNum}?fmt=rle${sub > 1 ? `&sub=${sub}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      stopHeaderRoll();
      if (payload.gridRle) {
        payload.grid = decodeRle(payload.gridRle);
        delete payload.gridRle;
      }
      current = payload;
      currentSub = payload.subPage || sub;
      if (reveal && changingPage) revealGrid(payload.grid);
      else drawGrid(payload.grid);
      paintHeaderRight();
      updateFastextButtons();
      updateSubpageRow();
      clearLoading();
      if (push) {
        const target = `/?p=${pageNum}${sub > 1 ? `&s=${sub}` : ''}`;
        history.pushState({ pageNum, sub }, '', target);
      }
      document.title = `P${pageNum} ${payload.title || 'TELETEXT'}`;
      try { localStorage.setItem(LAST_PAGE_KEY, String(pageNum)); } catch {}
      maybeFadeHint();
      startSubCycle();
    } catch (err) {
      console.error('navigate failed', err);
      stopHeaderRoll();
      clearLoading();
      setStatus('FETCH FAILED');
    }
  }

  function setLoading(msg) {
    statusLine.classList.add('loading');
    statusLine.textContent = msg;
  }
  function clearLoading() {
    statusLine.classList.remove('loading');
    statusLine.textContent = '';
  }

  function fastextTarget(colour) {
    const dyn = current && current.fastext && current.fastext[colour];
    return (dyn && dyn.page) || FALLBACK_FASTEXT[colour].page;
  }

  function updateFastextButtons() {
    const fx = (current && current.fastext) || FALLBACK_FASTEXT;
    for (const colour of FASTEXT_COLOURS) {
      const btn = fastextBtns[colour];
      const entry = fx[colour] || FALLBACK_FASTEXT[colour];
      const labelEl = btn.querySelector('.fkey-label');
      labelEl.textContent = (entry && entry.label) ? String(entry.label).toUpperCase() : '';
      btn.dataset.page = String(entry && entry.page || '');
      btn.disabled = !(entry && entry.page);
    }
  }

  function updateSubpageRow() {
    if (!subpageRow) return;
    const total = (current && current.totalSubPages) || 1;
    if (total <= 1) {
      subpageRow.hidden = true;
      return;
    }
    subpageRow.hidden = false;
    subpageIndicator.textContent = `${currentSub}/${total}`;
  }

  function navigateSubPage(direction) {
    if (!current || current.totalSubPages <= 1) return;
    const total = current.totalSubPages;
    let next = currentSub + direction;
    if (next < 1) next = total;
    if (next > total) next = 1;
    // Manual sub-page nav also engages HOLD so the auto-cycle doesn't
    // wrestle the user's choice back.
    if (!holding) setHolding(true);
    navigate(current.page, next, false);
  }

  function maybeFadeHint() {
    if (!hint || hint.classList.contains('fade')) return;
    try {
      if (localStorage.getItem(HINT_SEEN_KEY)) {
        hint.classList.add('fade');
        return;
      }
    } catch {}
  }
  function dismissHint() {
    if (!hint || hint.classList.contains('fade')) return;
    hint.classList.add('fade');
    try { localStorage.setItem(HINT_SEEN_KEY, '1'); } catch {}
  }

  function handleCanvasClick(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    const cell = current && current.grid && current.grid[row] && current.grid[row][col];
    if (!cell) return;
    // Internal page links (yellow underline) navigate in-canvas;
    // external links (cyan underline) open in a new tab.
    if (cell.p) {
      navigate(Number(cell.p));
      return;
    }
    if (cell.l) {
      window.open(cell.l, '_blank', 'noopener');
    }
  }

  // Swipe on the canvas:
  //   vertical    = previous/next page number (current.page +/- 1)
  //   horizontal  = previous/next sub-page (uses navigateSubPage)
  // Dominant axis wins.
  let touchStart = null;
  function onTouchStart(ev) {
    if (ev.touches.length !== 1) return;
    touchStart = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
  }
  function onTouchEnd(ev) {
    if (touchStart == null) return;
    const end = ev.changedTouches[0] || {};
    const dx = (end.clientX || 0) - touchStart.x;
    const dy = (end.clientY || 0) - touchStart.y;
    touchStart = null;
    if (!current) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
      navigateSubPage(dx < 0 ? 1 : -1);
    } else {
      if (Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
      const next = current.page + (dy < 0 ? 1 : -1);
      if (next >= 100 && next <= 999) navigate(next);
    }
  }

  function onKeyDown(ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (/^\d$/.test(ev.key)) { ev.preventDefault(); pushDigit(ev.key); return; }
    if (ev.key === 'Backspace') { ev.preventDefault(); popDigit(); return; }
    if (ev.key === 'Escape') { ev.preventDefault(); clearTyping(); return; }
    if (ev.key === 'ArrowUp' || ev.key === 'PageUp') {
      ev.preventDefault();
      if (current && current.page > 100) navigate(current.page - 1);
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'PageDown') {
      ev.preventDefault();
      if (current && current.page < 999) navigate(current.page + 1);
      return;
    }
    if (ev.key === 'ArrowLeft')  { ev.preventDefault(); navigateSubPage(-1); return; }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); navigateSubPage( 1); return; }
    if (ev.key === 'h' || ev.key === 'H') { ev.preventDefault(); setHolding(!holding); return; }
    if (ev.key === 'r' || ev.key === 'R') { ev.preventDefault(); navigate(fastextTarget('red')); return; }
    if (ev.key === 'g' || ev.key === 'G') { ev.preventDefault(); navigate(fastextTarget('green')); return; }
    if (ev.key === 'y' || ev.key === 'Y') { ev.preventDefault(); navigate(fastextTarget('yellow')); return; }
    if (ev.key === 'b' || ev.key === 'B') { ev.preventDefault(); navigate(fastextTarget('cyan')); return; }
    if (ev.key === 'c' || ev.key === 'C') { ev.preventDefault(); navigate(fastextTarget('cyan')); return; }
  }

  function wireKeypad() {
    document.getElementById('keypad').addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const digit = btn.dataset.digit;
      const action = btn.dataset.action;
      if (digit != null) { pushDigit(digit); return; }
      if (action === 'clear') { clearTyping(); return; }
      if (action === 'hold') { setHolding(!holding); return; }
    });
    fastextRow.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button');
      if (!btn || btn.disabled) return;
      const colour = btn.dataset.fastext;
      const page = fastextTarget(colour);
      if (page) navigate(Number(page));
    });
    const navRow = document.getElementById('nav-row');
    if (navRow) {
      navRow.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button');
        if (!btn) return;
        if (btn.id === 'crt-btn') { toggleCrt(); return; }
        const target = Number(btn.dataset.nav);
        if (target) navigate(target);
      });
    }
    if (subpageRow) {
      subpageRow.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button');
        if (!btn) return;
        navigateSubPage(btn.dataset.sub === 'next' ? 1 : -1);
      });
    }
    // Any tap on the device dismisses the first-launch hint.
    document.addEventListener('click', dismissHint, { once: true, capture: true });
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    // Priority: explicit ?p= in URL, then localStorage "last visited",
    // then home page 100. So an opened-from-bookmark URL always wins,
    // but a fresh launch returns the user to where they were.
    let p = Number(params.get('p'));
    let s = Number(params.get('s')) || 1;
    if (!p) {
      try {
        const stored = Number(localStorage.getItem(LAST_PAGE_KEY));
        if (stored >= 100 && stored <= 999) p = stored;
      } catch {}
    }
    if (!p) p = 100;
    return { p, s };
  }

  window.addEventListener('popstate', () => {
    const { p, s } = readUrl();
    navigate(p, s, false);
  });
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', onTouchStart, { passive: true });
  canvas.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('keydown', onKeyDown);
  wireKeypad();

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('sw register failed', err);
      });
    });
    // When a new SW activates, it posts {type:'sw-updated'} - show the
    // reload banner so the user doesn't have to manually quit/relaunch
    // the PWA to see new code.
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'sw-updated') {
        const banner = document.getElementById('update-banner');
        if (banner) banner.hidden = false;
      }
    });
  }

  const CRT_KEY = 'teletext.crt';
  function applyCrtPref() {
    let on = true;
    try { on = localStorage.getItem(CRT_KEY) !== '0'; } catch {}
    document.body.classList.toggle('crt-off', !on);
  }
  function toggleCrt() {
    const nowOff = !document.body.classList.contains('crt-off');
    document.body.classList.toggle('crt-off', nowOff);
    try { localStorage.setItem(CRT_KEY, nowOff ? '0' : '1'); } catch {}
  }

  function showIosInstallHint() {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isIOS && !isStandalone && hint) {
      hint.innerHTML = 'Tap <strong>Share &rarr; Add to Home Screen</strong> for the full TV';
    }
  }

  (async function start() {
    registerServiceWorker();
    applyCrtPref();
    showIosInstallHint();
    const banner = document.getElementById('update-banner');
    if (banner) banner.addEventListener('click', () => location.reload());
    await loadFont();
    const { p, s } = readUrl();
    await navigate(p, s, false);
    setInterval(paintHeaderRight, 1000);
  })();
})();
