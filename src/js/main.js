// Uygulama durumu, olaylar ve açılış.

let P;
function setPeriod(key) {
  if (key === 'all') {
    P = { key, a: 0, b: N, title: 'Tüm zamanlar', color: ALL_COLOR, tag: BY + ' — ' + monY(MONS - 1) };
  } else if (key[0] === 'y') {
    const y = +key.slice(1), [a, b] = yearRange(y);
    P = { key, y, a, b, title: String(y), color: YEAR_COLOR[y], tag: String(y) };
  } else {
    const m = +key.slice(1), [a, b] = monRange(m), y = monY(m);
    P = { key, y, m, a, b, title: monL(m), color: YEAR_COLOR[y], tag: MS[monM(m)] + ' ' + y };
  }
  render();
}

function render() {
  const r = agg(P.a, P.b);
  root.style.setProperty('--tape', P.color);
  root.style.setProperty('--tape-ink', inkOn(P.color));
  root.style.setProperty('--heat', P.key === 'all' ? HEAT_ALL : P.color);
  const active = P.m !== undefined ? 'y' + P.y : P.key;
  $$('.spine').forEach((s) => s.setAttribute('aria-pressed', s.dataset.k === active));
  const chip = $('#chip');
  chip.hidden = P.m === undefined;
  if (P.m !== undefined) chip.textContent = monL(P.m) + ' ✕';
  for (const [fn, ...args] of [[updateTape, r], [renderCover, r], [renderYears], [renderBubbles], [renderAlbums], [renderTop], [updateStream], [renderMonths], [renderCal], [renderClock, r], [updateRidge], [renderHabits, r]]) safe(fn, ...args);
}

const ACTIONS = {
  period: (k) => setPeriod(k),
  clearMonth: () => setPeriod('y' + P.y),
  months: (v) => { monthMode = v; renderMonths(); },
  story: (v) => { storyKey = v; renderStory(); },
  tab: (v) => { TOP.tab = v; TOP.limit = 24; renderTop(); },
  metric: (v) => { TOP.metric = v; TOP.limit = 24; renderTop(); },
  more: () => { TOP.limit += 24; renderTop(); },
  ar: (v) => openDetail('ar', +v), tr: (v) => openDetail('tr', +v), al: (v) => openDetail('al', +v), sh: (v) => openDetail('sh', +v),
  day: (v) => openDay(+v),
  close: () => dlg.close(),
  randomDay: () => { const days = [...ALL.days.keys()]; openDay(days[Math.floor(Math.random() * days.length)]); },
  bestDay: () => { const r = agg(P.a, P.b); if (r.best[1]) openDay(r.best[0]); },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-do]');
  if (!el || !el.dataset.do) return;
  const s = el.dataset.do, c = s.indexOf(':');
  ACTIONS[c < 0 ? s : s.slice(0, c)]?.(c < 0 ? undefined : s.slice(c + 1));
});

function boot() {
  ST = computeStories();
  for (const fn of [initHero, initStream, initBump, initRidge, initOnThisDay, initMilestones, initDiscovery, initBehavior, initDevices, initBackstage, initMethod, renderStory]) safe(fn);

  const pick = $('#daypick');
  pick.min = dDate(DAY[0]).toISOString().slice(0, 10);
  pick.max = dDate(DAY[N - 1]).toISOString().slice(0, 10);
  pick.addEventListener('change', () => { if (pick.value) openDay(Math.floor(Date.parse(pick.value) / 864e5)); });
  $('#q').addEventListener('input', (e) => { TOP.q = e.target.value; TOP.limit = 24; renderTop(); });

  setPeriod('all');

  // Sahneler genişliğe göre yerleşir; yalnızca genişlik değişince yeniden hesapla
  let lastWidth = $('#bubbles').clientWidth, frame = 0;
  new ResizeObserver(() => {
    const w = $('#bubbles').clientWidth;
    if (w === lastWidth) return;
    lastWidth = w;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { safe(renderBubbles); safe(renderAlbums); });
  }).observe($('#bubbles'));
}
boot();
