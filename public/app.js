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

  function drawCell(row, col, cell) {
    const x = col * CELL_W;
    const y = row * CELL_H;
    ctx.fillStyle = COLOURS[cell.b] || '#000';
    ctx.fillRect(x, y, CELL_W, CELL_H);
    const ch = cell.c;
    if (ch && ch !== ' ') {
      ctx.fillStyle = COLOURS[cell.f] || '#fff';
      const size = cell.d ? CELL_H * 2 : CELL_H;
      ctx.font = `${size}px "Bedstead", monospace`;
      ctx.fillText(ch, x, y);
    }
    // Linked cells get a 1px cyan underline at the bottom of the cell.
    if (cell.l) {
      ctx.fillStyle = COLOURS.C;
      ctx.fillRect(x, y + CELL_H - 1, CELL_W, 1);
    }
  }

  function drawGrid(grid) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) drawCell(r, c, grid[r][c]);
    }
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

  async function navigate(pageNum, sub = 1, push = true) {
    // Show a loading state immediately so the user gets feedback - matters
    // most on Render free's ~30s cold start.
    setLoading(`PLEASE WAIT P${pageNum}`);
    try {
      const url = `/api/page/${pageNum}${sub > 1 ? `?sub=${sub}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      current = payload;
      currentSub = payload.subPage || sub;
      drawGrid(payload.grid);
      paintHeaderRight();
      updateFastextButtons();
      clearLoading();
      if (push) {
        const target = `/?p=${pageNum}${sub > 1 ? `&s=${sub}` : ''}`;
        history.pushState({ pageNum, sub }, '', target);
      }
      document.title = `P${pageNum} ${payload.title || 'TELETEXT'}`;
      startSubCycle();
    } catch (err) {
      console.error('navigate failed', err);
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

  function handleCanvasClick(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    if (row === 24) {
      const block = Math.floor(col / 10);
      const colour = FASTEXT_COLOURS[block];
      const page = fastextTarget(colour);
      if (page) navigate(page);
      return;
    }
    if (current && current.grid && current.grid[row] && current.grid[row][col] && current.grid[row][col].l) {
      window.open(current.grid[row][col].l, '_blank', 'noopener');
    }
  }

  // Vertical swipe on the canvas = previous/next page number.
  let touchStartY = null;
  function onTouchStart(ev) {
    if (ev.touches.length !== 1) return;
    touchStartY = ev.touches[0].clientY;
  }
  function onTouchEnd(ev) {
    if (touchStartY == null) return;
    const endY = (ev.changedTouches[0] || {}).clientY;
    const dy = endY - touchStartY;
    touchStartY = null;
    if (!current || Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
    const next = current.page + (dy < 0 ? 1 : -1);
    if (next >= 100 && next <= 999) navigate(next);
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
        const target = Number(btn.dataset.nav);
        if (target) navigate(target);
      });
    }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    const p = Number(params.get('p')) || 100;
    const s = Number(params.get('s')) || 1;
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
  }

  (async function start() {
    registerServiceWorker();
    await loadFont();
    const { p, s } = readUrl();
    await navigate(p, s, false);
    setInterval(paintHeaderRight, 1000);
  })();
})();
