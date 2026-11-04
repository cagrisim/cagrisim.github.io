// Bölümler: veriyi grafiklere bağlar. Seçili dönem P, main.js'te tutulur.

const inPeriod = (m) => (P.m !== undefined ? m === P.m : P.y !== undefined ? monY(m) === P.y : true);

/* ---------- Hero ---------- */
function initHero() {
  const hours = ALL.ms / 36e5, days = Math.floor(hours / 24);
  const first = dDate(DAY[0]), last = dDate(DAY[N - 1]);
  $('#h-range').textContent = `${MO[first.getUTCMonth()]} ${first.getUTCFullYear()} — ${MO[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
  $('#h-stats').innerHTML = [[nf(hours), 'saat'], [nf(days), 'gün kesintisiz'], [nf(ALL.nA), 'sanatçı'], [nf(ALL.nT), 'şarkı']]
    .map(([v, l]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join('');

  // En çok dinlenen albümler; sıralama belli olmasın diye sabit tohumla karıştırılır
  const covers = topIdx(ALL.L).filter((l) => D.img.l[l]).slice(0, 108);
  const mixed = covers.map((l, i) => [l, (i * 7919) % 109]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  $('#wall').innerHTML = mixed.map((l) => `<img src="${albumPic(l).url}" alt="" decoding="async" draggable="false">`).join('');

  $('#t-stripes').innerHTML = YEARS.map((y, i) => `<rect x="38" y="${138 + i * 19}" width="564" height="19" fill="${YEAR_COLOR[y]}"></rect>`).join('');
  $('#hubs').innerHTML = [235, 405].map((x) => `<g class="hub"><circle cx="${x}" cy="204" r="21" fill="#f1e8d3"></circle><circle cx="${x}" cy="204" r="11" fill="#0b0e26"></circle>${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="${x - 2.5}" y="${204 - 16}" width="5" height="7" fill="#0b0e26" transform="rotate(${a} ${x} 204)"></rect>`).join('')}</g>`).join('');

  const maxYear = Math.max(...YEARS.map((y) => YA[y].ms));
  const spine = (k, label, ms, color, h) => `<button class="spine" style="--c:${color};--cink:${inkOn(color)};--h:${h}px" data-do="period:${k}" data-k="${k}" data-tip="${label}\n${dur(ms)}" aria-pressed="false">${label}</button>`;
  $('#spines').innerHTML = spine('all', 'Hepsi', ALL.ms, ALL_COLOR, 56) + YEARS.map((y) => spine('y' + y, String(y), YA[y].ms, YEAR_COLOR[y], Math.round(26 + 30 * YA[y].ms / maxYear))).join('');
}

function updateTape(r) {
  const played = P.key === 'all' ? 1 : agg(0, P.b).ms / ALL.ms, radius = (p) => 24 + Math.sqrt(p) * 34;
  $('#r1').setAttribute('r', radius(1 - played + 0.001));
  $('#r2').setAttribute('r', radius(played));
  $('#t-year').textContent = P.tag;
  $('#t-len').textContent = 'C-' + nf(r.ms / 6e4);
}

/* ---------- Kapak ---------- */
function renderCover(r) {
  const a = argmax(r.A), p = a >= 0 ? artistPic(a) : null, name = a >= 0 ? D.ar[a] : '—';
  root.style.setProperty('--amb', p ? p.color : P.color);
  const box = $('#cv-pic');
  box.innerHTML = visual(p, name);
  box.dataset.do = a >= 0 ? 'ar:' + a : '';
  box.setAttribute('aria-label', name);
  $('#cv-period').textContent = P.title;
  $('#cv-share').textContent = a >= 0 ? `1 numara · ${dur(r.A[a])} · ${pct(r.A[a], r.ms)}` : '';
  $('#cv-name').textContent = name;
  $('#cv-stats').innerHTML = [[dur(r.ms), 'süre'], [nf(r.plays), 'dinleme'], [nf(r.nA), 'sanatçı'], [nf(r.nT), 'şarkı']]
    .map(([v, l]) => `<div><b>${v}</b><span class="k">${l}</span></div>`).join('');
  $('#cv-mini').innerHTML = [
    ['Günde', dur(r.ms / (r.span || 1))],
    ['En uzun seri', r.streak + ' gün'],
    ['En yoğun gün', r.best[1] ? `<button data-do="day:${r.best[0]}" data-tip="${dur(r.best[1])}">${fmtDs(r.best[0])}</button>` : '—'],
    ['En uzun oturum', dur(r.session.ms)],
  ].map(([l, v]) => `<div><span class="k">${l}</span><b>${v}</b></div>`).join('');
  $('#cv-tracks').innerHTML = topIdx(r.TM, 6).map((t, i) => trackTile(t, { rank: i + 1, sub: durShort(r.TM[t]), tip: `${trName(t)}\n${trArtist(t)}\n${dur(r.TM[t])} · ${nf(r.TP[t])} kez` })).join('');
  $('#cv-artists').innerHTML = topIdx(r.A, 7).slice(1).map((id, i) => artistTile(id, { rank: i + 2, sub: durShort(r.A[id]) })).join('');
}

/* ---------- Fotoğraflı yıl sütunları ---------- */
function renderYears() {
  const mx = Math.max(...YEARS.map((y) => YA[y].ms));
  $('#ybars').innerHTML = YEARS.map((y) => {
    const r = YA[y], a = argmax(r.A), p = artistPic(a), share = r.ms / mx;
    const tip = `${y}: ${dur(r.ms)}\n1 numara: ${D.ar[a]}`;
    return `<button class="ybar${P.y === y ? '' : P.y ? ' dim' : ''}" style="--c:${YEAR_COLOR[y]}" data-do="period:y${y}" data-tip="${esc(tip)}" aria-label="${esc(tip)}">
      <span class="yv">${nf(r.ms / 36e5)}</span><span class="yi" style="height:max(6px, calc((100% - 78px) * ${share.toFixed(4)}))">${visual(p, D.ar[a])}</span><b class="yy">${y}</b></button>`;
  }).join('');
}

/* ---------- Sanatçı evreni ---------- */
function renderBubbles() {
  const box = $('#bubbles'), W = box.clientWidth;
  if (!W || !window.d3) return;
  const r = agg(P.a, P.b), small = W < 640, H = Math.round(clamp(W * 0.56, 380, 680));
  box.style.height = H + 'px';
  const ids = topIdx(r.A, small ? 28 : 56);
  $('#bub-k').textContent = `${nf(r.nA)} sanatçıdan ilk ${ids.length}`;
  const nodes = bubbleLayout(ids.map((id) => ({ key: id, v: r.A[id] })), W, H, box._pos);
  box._pos = new Map(nodes.map((n) => [n.key, n]));
  placeBoxes(box, nodes.map((n) => ({
    key: n.key, x: n.x - n.r, y: n.y - n.r, w: n.r * 2, h: n.r * 2,
    tip: `${D.ar[n.key]}\n${dur(r.A[n.key])} · ${nf(r.AP[n.key])} kez`,
    after: (el) => { el.querySelector('.n').hidden = n.r < 44; },
  })), (n) => {
    const el = document.createElement('button'), p = artistPic(n.key);
    el.className = 'bub';
    el.dataset.do = 'ar:' + n.key;
    if (p) el.style.setProperty('--c', p.color);
    el.innerHTML = visual(p, D.ar[n.key]) + `<span class="n">${esc(D.ar[n.key])}</span>`;
    return el;
  });
}

/* ---------- Albüm duvarı ---------- */
function renderAlbums() {
  const box = $('#albums'), W = box.clientWidth;
  if (!W || !window.d3) return;
  const r = agg(P.a, P.b), small = W < 640, H = Math.round(clamp(W * 0.5, 320, 620));
  box.style.height = H + 'px';
  const ids = topIdx(r.L, small ? 16 : 34);
  $('#alb-k').textContent = `${nf(r.nL)} albümden ilk ${ids.length}`;
  const tree = d3.hierarchy({ children: ids.map((id) => ({ id, v: r.L[id] })) }).sum((d) => d.v || 0).sort((a, b) => b.value - a.value);
  d3.treemap().tile(d3.treemapSquarify.ratio(1)).size([W, H]).paddingInner(3)(tree);
  placeBoxes(box, tree.leaves().map((n) => {
    const id = n.data.id;
    return { key: id, x: n.x0, y: n.y0, w: n.x1 - n.x0, h: n.y1 - n.y0, tip: `${D.al[id][0]}\n${D.ar[LA[id]]}\n${dur(r.L[id])}` };
  }), (n) => {
    const el = document.createElement('button'), p = albumPic(n.key);
    el.className = 'alb';
    el.dataset.do = 'al:' + n.key;
    if (p) el.style.setProperty('--c', p.color);
    el.innerHTML = visual(p, D.al[n.key][0]);
    return el;
  });
}

/* ---------- En çoklar ---------- */
const TOP = { tab: 'ar', metric: 'ms', q: '', limit: 24 };
const foldCache = {};
function renderTop() {
  const r = agg(P.a, P.b), { tab, metric, limit } = TOP;
  ['ar', 'tr', 'al', 'sh'].forEach((t) => $('#tab-' + t).setAttribute('aria-pressed', t === tab));
  ['ms', 'n'].forEach((t) => $('#me-' + t).setAttribute('aria-pressed', t === metric));
  const times = { ar: r.A, tr: r.TM, al: r.L, sh: r.S }[tab], counts = { ar: r.AP, tr: r.TP, al: r.LP, sh: r.SP }[tab], order = metric === 'ms' ? times : counts;
  const nameOf = { ar: (i) => D.ar[i], tr: trName, al: (i) => D.al[i][0], sh: (i) => D.sh[i] }[tab];
  const byOf = { tr: trArtist, al: (i) => D.ar[LA[i]] }[tab];
  let ids = topIdx(order).filter((i) => counts[i] > 0);
  const rankOf = new Map(ids.map((id, i) => [id, i + 1])), q = fold(TOP.q.trim()), total = ids.length;
  if (q) {
    const cache = foldCache[tab] || (foldCache[tab] = []);
    ids = ids.filter((i) => (cache[i] ?? (cache[i] = fold(nameOf(i) + ' ' + (byOf ? byOf(i) : '')))).includes(q));
  }
  $('#top-k').textContent = q ? `${nf(ids.length)} sonuç` : `${nf(total)} kayıt`;
  $('#grid').innerHTML = ids.slice(0, limit).map((id) => {
    const value = metric === 'ms' ? durShort(times[id]) : nf(counts[id]) + ' kez';
    const tip = `${nameOf(id)}${byOf ? '\n' + byOf(id) : ''}\n${dur(times[id])} · ${nf(counts[id])} kez`;
    const opts = { rank: rankOf.get(id), sub: value, tip };
    if (tab === 'ar') return artistTile(id, opts);
    if (tab === 'tr') return trackTile(id, opts);
    if (tab === 'al') return tile({ p: albumPic(id), name: nameOf(id), act: 'al:' + id, ...opts });
    return tile({ p: showPic(id), name: nameOf(id), act: 'sh:' + id, ...opts });
  }).join('') || '<p class="empty">Eşleşme yok.</p>';
  $('#more').parentElement.hidden = ids.length <= limit;
}

/* ---------- Hikâyeler ---------- */
let ST, storyKey = 'obsess';
const STORY_TABS = {
  obsess: ['Takıntılar', () => ST.obsess.map((o) => trackTile(o.t, { badge: nf(o.n) + '×', sub: fmtDs(o.d), act: 'day:' + o.d, tip: `${trName(o.t)}\nBir günde ${nf(o.n)} kez, ${fmtD(o.d)}` }))],
  lost: ['Ayrılıklar', () => ST.lost.map((t) => trackTile(t, { gray: true, badge: nf(ST.plays[t]) + '×', sub: 'son: ' + fmtMY(ST.lastDay[t]), tip: `${trName(t)}\n${nf(ST.plays[t])} kez dinleyip bir yıldır açmadın` }))],
  back: ['Geri dönüşler', () => ST.back.map((b) => trackTile(b.t, { badge: gapText(b.gap), sub: 'dönüş: ' + fmtMY(b.d), tip: `${trName(b.t)}\n${gapText(b.gap)} aradan sonra döndün` }))],
  loyal: ['Sadıklar', () => ST.loyal.map((l) => artistTile(l.a, { badge: l.n + ' ay', tip: `${D.ar[l.a]}\n${MONS} ayın ${l.n} tanesinde en az 30 dakika` }))],
  fresh: ['Yeni aşklar', () => ST.fresh.map((a) => artistTile(a, { badge: durShort(ALL.A[a]), sub: 'ilk: ' + fmtMY(ST.artistFirst[a]), tip: `${D.ar[a]}\nSon 18 ayda tanıştın` }))],
  skipped: ['En çok atlanan', () => ST.skipped.map((t) => trackTile(t, { badge: pct(ALL.TS[t], ALL.TN[t]), sub: trArtist(t), tip: `${trName(t)}\n${nf(ALL.TN[t])} kayıtta ${pct(ALL.TS[t], ALL.TN[t])} atlama` }))],
  days: ['En uzun günler', () => ST.bigDays.map((x) => tile({ p: x.a >= 0 ? artistPic(x.a) : null, name: fmtD(x.d), badge: durShort(x.ms), sub: x.a >= 0 ? D.ar[x.a] : '', act: 'day:' + x.d, tip: `${fmtD(x.d)}\n${dur(x.ms)}` }))],
};
function renderStory() {
  $('#story-tabs').innerHTML = Object.entries(STORY_TABS).map(([k, [label]]) => `<button class="btn" data-do="story:${k}" aria-pressed="${k === storyKey}">${label}</button>`).join('');
  $('#story').innerHTML = STORY_TABS[storyKey][1]().join('');
}

/* ---------- Zaman nehri ---------- */
function initStream() {
  if (!window.d3) return;
  const rows = Array.from({ length: MONS }, () => Object.fromEntries(TOP8.map((a) => [a, 0])));
  for (let i = 0; i < N; i++) {
    if (K[i] < 0) continue;
    const a = TA[VT[K[i]]];
    if (ARTIST_COLOR.has(a)) rows[MON[i]][a] += M[i];
  }
  streamChart($('#stream'), $('#stream-x'), TOP8, rows, (a) => ARTIST_COLOR.get(+a));
  $('#stream-leg').innerHTML = TOP8.map((a) => {
    const p = artistPic(a);
    return `<button data-do="ar:${a}"><span class="lg-av" style="--c:${ARTIST_COLOR.get(a)}">${visual(p, D.ar[a])}</span>${esc(D.ar[a])}</button>`;
  }).join('');
}
function updateStream() {
  const l = $('#sh-l'), r = $('#sh-r');
  if (!l) return;
  if (P.key === 'all') { l.hidden = r.hidden = true; return; }
  let from = MONS, to = -1;
  for (let i = 0; i < MONS; i++) if (inPeriod(i)) { from = Math.min(from, i); to = Math.max(to, i); }
  const x = (i) => clamp(i / (MONS - 1) * 100, 0, 100);
  l.hidden = r.hidden = false;
  l.style.cssText = `left:0;width:${x(from - 0.5)}%`;
  r.style.cssText = `right:0;width:${100 - x(to + 0.5)}%`;
}

/* ---------- Ayın kapağı ---------- */
let monthMode = 'l';
function renderMonths() {
  $('#mo-l').setAttribute('aria-pressed', monthMode === 'l');
  $('#mo-a').setAttribute('aria-pressed', monthMode === 'a');
  let h = '<span></span>' + MS.map((m) => `<span>${m[0]}</span>`).join('');
  for (const y of YEARS) {
    h += `<b>${y}</b>`;
    for (let m = 0; m < 12; m++) {
      const i = (y - BY) * 12 + m - BM, e = i >= 0 && i < MONS ? MONTH_TOP[i] : null;
      if (!e || e.a < 0) { h += '<span class="mc none"></span>'; continue; }
      const artistMode = monthMode === 'a', p = artistMode ? artistPic(e.a) : albumPic(e.l), name = artistMode ? D.ar[e.a] : D.al[e.l][0], ms = artistMode ? e.aMs : e.lMs;
      const tip = `${monL(i)}\n${name}${artistMode ? '' : '\n' + D.ar[LA[e.l]]}\n${dur(ms)} · ayın ${pct(ms, e.ms)} kadarı`;
      h += `<button class="mc${artistMode ? ' round' : ''}${inPeriod(i) ? '' : ' dim'}" style="${fill(p)}" data-do="period:m${i}" data-tip="${esc(tip)}" aria-label="${esc(tip.replace(/\n/g, ', '))}">${visual(p, name)}</button>`;
    }
  }
  $('#months').innerHTML = h;
}

/* ---------- Yıldan yıla ---------- */
function initBump() {
  const ranks = YEARS.map((y) => topIdx(YA[y].A, 8));
  bumpChart($('#bump'), YEARS, ranks, (a) => ARTIST_COLOR.get(a) || MUTED_SERIES, (a, c, r) => `${D.ar[a]}\n${YEARS[c]}: ${r + 1}. sıra, ${dur(YA[YEARS[c]].A[a])}`);
}

/* ---------- Takvim ---------- */
const CAL_LEVELS = [[15 * 6e4, 22], [36e5, 38], [2 * 36e5, 55], [4 * 36e5, 72], [8 * 36e5, 88], [Infinity, 100]];
const calLevel = (ms) => CAL_LEVELS.find((l) => ms < l[0])[1];
function calYear(y) {
  const r = YA[y], from = Date.UTC(y, 0, 1) / 864e5, to = Date.UTC(y + 1, 0, 1) / 864e5, pad = weekdayOf(from), first = DAY[0], last = DAY[N - 1];
  const pa = DAY[P.a], pb = DAY[P.b - 1];
  let h = '<i class="d e"></i>'.repeat(pad);
  for (let d = from; d < to; d++) {
    if (d < first || d > last) { h += '<i class="d e"></i>'; continue; }
    const ms = r.days.get(d) || 0, off = d < pa || d > pb ? ' off' : '', label = `${fmtD(d)}\n${ms ? dur(ms) : 'Dinleme yok'}`;
    h += `<button class="d${ms ? '' : ' z'}${off}" ${ms ? `style="--p:${calLevel(ms)}%"` : ''} data-do="day:${d}" data-tip="${label}" aria-label="${label.replace('\n', ': ')}"></button>`;
  }
  return `<div class="calrow"><div class="calyr">${y}</div><div class="calg" style="--c:${YEAR_COLOR[y]}">${h}</div></div>`;
}
let calKey = '';
function renderCal() {
  if (P.key === calKey) return;
  calKey = P.key;
  const ys = P.y ? [P.y] : YEARS, y0 = ys[0], start = Date.UTC(y0, 0, 1) / 864e5, pad = weekdayOf(start);
  const months = MS.map((m, i) => `<span style="left:${Math.floor((Date.UTC(y0, i, 1) / 864e5 - start + pad) / 7) / 53.2 * 100}%">${m}</span>`).join('');
  $('#cal').innerHTML = `<div class="cal-mo">${months}</div>${ys.map(calYear).join('')}`;
  $('#cal-scale').innerHTML = 'Az ' + CAL_LEVELS.map((l) => `<i style="background:color-mix(in oklab,${P.color} ${l[1]}%,var(--bg))"></i>`).join('') + ' Çok';
}
function initOnThisDay() {
  const now = new Date(), m = now.getMonth(), d = now.getDate();
  const cards = [];
  for (const y of YEARS.slice().reverse()) {
    const day = Date.UTC(y, m, d) / 864e5, [a, b] = dayRange(day);
    if (a >= b) continue;
    const top = bucketTop(a, b, 1, () => 0)[0], t = top.t;
    if (t >= 0) cards.push(trackTile(t, { sub: String(y), act: 'day:' + day, tip: `${fmtD(day)}\n${trName(t)}\nO gün ${dur(top.ms)}` }));
  }
  $('#otd').innerHTML = cards.length ? `<div class="otd-h">Geçmiş yıllarda<br>${d} ${MO[m]}</div>${cards.join('')}` : '';
}

/* ---------- Saatler ---------- */
function renderClock(r) {
  if (window.d3) {
    $('#clock').innerHTML = recordChart(r.hm, hh(argmax(r.hr)), (d, h, v) => `${WD[d]} ${hh(h)}\n${dur(v)}`);
  }
  $('#clock-table').innerHTML = tableView(table(['Saat', 'Süre', 'Pay'], [...r.hr].map((v, i) => [hh(i), dur(v), pct(v, r.ms)])));
  const names = ['Gece', 'Sabah', 'Öğle', 'Akşam'], B = bucketSignature(r, 4, (i) => Math.floor(HR[i] / 6));
  $('#parts').innerHTML = B.map((x, i) => {
    const p = x.a >= 0 ? artistPic(x.a) : null, name = x.a >= 0 ? D.ar[x.a] : '—';
    return `<button class="part" style="${fill(p)}" ${x.a >= 0 ? `data-do="ar:${x.a}"` : ''} data-tip="${names[i]}: ${dur(x.ms)}\nBu saatlere en özgü: ${esc(name)}">${visual(p, name)}<span><b>${names[i]} ${pct(x.ms, r.ms)}</b><small>${esc(name)}</small></span></button>`;
  }).join('');
  const W = bucketSignature(r, 7, (i) => DOW[i]), mx = Math.max(...W.map((x) => x.ms), 1);
  $('#week').innerHTML = W.map((x, i) => {
    const p = x.a >= 0 ? artistPic(x.a) : null, name = x.a >= 0 ? D.ar[x.a] : '—';
    return `<button class="wkb" ${x.a >= 0 ? `data-do="ar:${x.a}"` : ''} data-tip="${WD[i]}: ${dur(x.ms)}\nBu güne en özgü: ${esc(name)}" aria-label="${WD[i]}: ${dur(x.ms)}"><span class="av">${visual(p, name)}</span><i style="height:calc((100% - 66px) * ${(x.ms / mx).toFixed(4)})"></i><small>${WD_SHORT[i]}</small></button>`;
  }).join('');
}

function initRidge() {
  if (!window.d3) return;
  const ys = YEARS.filter((y) => y > YEARS[0]); // ilk yıl yalnızca birkaç hafta, ölçeği bozar
  ridgelineChart($('#ridge'), ys, ys.map((y) => [...YA[y].hr].map((v) => v / YA[y].ms)), (y) => YEAR_COLOR[y]);
  $('#ridge-x').innerHTML = [0, 6, 12, 18].map((h) => `<span style="left:${h / 23 * 100}%">${hh(h)}</span>`).join('') + `<span style="left:100%;transform:translateX(-100%)">23:00</span>`;
}
function updateRidge() {
  $$('#ridge [data-y]').forEach((el) => {
    const off = P.y && +el.dataset.y !== P.y;
    el.classList.toggle('dim', !!off);
  });
}

/* ---------- Kilometre taşları ve keşif ---------- */
function initMilestones() {
  $('#miles').innerHTML = ST.miles.map((m) => {
    const k = K[m.i], name = k >= 0 ? trName(VT[k]) : D.ep[-k - 1][0], by = k >= 0 ? trArtist(VT[k]) : D.sh[ES[-k - 1]], p = k >= 0 ? trackPic(VT[k]) : showPic(ES[-k - 1]);
    return `<button class="mile" data-do="day:${DAY[m.i]}" data-tip="${esc(name)}\n${esc(by)}\n${fmtD(DAY[m.i])}"><span class="art" style="${fill(p)}">${visual(p, name)}</span><span class="mark"><b>${m.label}</b><small>${fmtMY(DAY[m.i])}</small></span></button>`;
  }).join('');
}
function initDiscovery() {
  const d = ST.discovery;
  $('#disc-n').innerHTML = `<div><b>${nf(d.avgTracks)}</b><span class="k">yeni şarkı / ay</span></div><div><b>${nf(d.avgArtists)}</b><span class="k">yeni sanatçı / ay</span></div>`;
  $('#disc').innerHTML = columns({ vals: d.newTracks, tip: (i) => `${monL(i)}\n${nf(d.newTracks[i])} yeni şarkı, ${nf(d.newArtists[i])} yeni sanatçı`, color: (i) => YEAR_COLOR[monY(i)], act: (i) => 'period:m' + i, h: 210, labels: yearLabels() });
}

/* ---------- Alışkanlıklar ---------- */
const START_NAMES = { trackdone: 'Önceki bitti', fwdbtn: 'İleri tuşu', clickrow: 'Listeden', playbtn: 'Oynat tuşu', appload: 'Uygulama' };
const END_NAMES = { trackdone: 'Şarkı bitti', endplay: 'Çalma durdu', fwdbtn: 'İleri tuşu', logout: 'Kapandı', backbtn: 'Geri tuşu' };
function renderHabits(r) {
  const night = r.hr.slice(0, 6).reduce((s, v) => s + v, 0) / (r.ms || 1);
  $('#rings').innerHTML = [
    ringChart(r.skip / (r.rows || 1), pct(r.skip, r.rows), 'Atlama'),
    ringChart(r.shuf / (r.rows || 1), pct(r.shuf, r.rows), 'Karışık çalma'),
    ringChart(night, pct(night, 1), 'Gece 00–06'),
    ringChart(r.active / (r.span || 1), pct(r.active, r.span), 'Aktif gün'),
  ].join('');

  const group = (names, dict) => {
    const keys = Object.keys(dict);
    return names.map((n) => { const i = keys.indexOf(n); return i < 0 ? keys.length : i; });
  };
  const sg = group(D.rs, START_NAMES), eg = group(D.re, END_NAMES);
  const startKeys = Object.values(START_NAMES), endKeys = Object.values(END_NAMES);
  const mat = Array.from({ length: startKeys.length + 1 }, () => new Array(endKeys.length + 1).fill(0));
  D.rs.forEach((_, s) => D.re.forEach((__, e) => { mat[sg[s]][eg[e]] += r.flow[s * D.re.length + e]; }));
  const left = [...startKeys, 'Diğer'].map((label, i) => ({ i, label, v: mat[i].reduce((a, b) => a + b, 0), color: i < startKeys.length ? CAT[i] : MUTED_SERIES }));
  const right = [...endKeys, 'Diğer'].map((label, i) => ({ i, label, v: mat.reduce((a, row) => a + row[i], 0) }));
  $('#flow').innerHTML = r.rows ? alluvialChart(left, right, mat, r.rows) : '';

  const ids = topIdx(r.cc), mx = r.cc[ids[0]] || 1;
  $('#cc').innerHTML = ids.slice(0, 6).map((i) => `<div class="barl" data-tip="${esc(D.cc[i])}\n${dur(r.cc[i])}"><span>${esc(D.cc[i])}</span><span><i style="width:${r.cc[i] / mx * 100}%"></i></span><span>${durShort(r.cc[i])}</span></div>`).join('');
  const parts = [{ label: 'Müzik', v: r.mus - r.vid, color: CAT[0] }, { label: 'Müzik videosu', v: r.vid, color: CAT[1] }, { label: 'Podcast', v: r.pod, color: CAT[2] }].filter((p) => p.v > 0).map((p) => ({ ...p, text: dur(p.v) }));
  $('#med').innerHTML = segBar(parts, r.ms);
}
function initBehavior() {
  const q = [];
  for (let i = 0; i < MONS; i += 3) q.push([i, Math.min(i + 3, MONS)]);
  const rows = q.map(([m1, m2]) => {
    const r = agg(monRange(m1)[0], monRange(m2 - 1)[1]);
    return { l: `${MS[monM(m1)]}–${MS[monM(m2 - 1)]} ${monY(m2 - 1)}`, skip: r.skip / r.rows * 100, shuf: r.shuf / r.rows * 100, y: monY(m1) };
  });
  const xl = [];
  rows.forEach((r, i) => { if (i && rows[i - 1].y !== r.y) xl.push([i, r.y]); });
  $('#beh').innerHTML = lineChart([{ name: 'Atlama', color: CAT[1], vals: rows.map((r) => r.skip) }, { name: 'Karışık', color: CAT[0], vals: rows.map((r) => r.shuf) }], rows.map((r) => r.l), xl)
    + tableView(table(['Dönem', 'Atlama', 'Karışık'], rows.map((r) => [r.l, '%' + nf1(r.skip), '%' + nf1(r.shuf)])));
}
function initDevices() {
  const m = D.dev.map(() => new Float64Array(MONS));
  for (let i = 0; i < N; i++) m[deviceOf(F[i])][MON[i]] += M[i];
  const order = D.dev.map((_, i) => i).filter((i) => ALL.dev[i] >= 36e5).sort((x, y) => m[x].findIndex((v) => v > 0) - m[y].findIndex((v) => v > 0));
  const mx = Math.max(...m.flatMap((a) => [...a]));
  $('#devs').innerHTML = order.map((i) => `<span>${esc(D.dev[i])}</span><div class="st">${[...m[i]].map((v, j) => `<i style="--p:${v ? Math.round(18 + Math.sqrt(v / mx) * 82) : 0}%" data-tip="${esc(D.dev[i])}\n${monL(j)}: ${dur(v)}"></i>`).join('')}</div><span class="v">${nf(ALL.dev[i] / 36e5)} sa</span>`).join('');
}

/* ---------- Perde arkası ---------- */
function initBackstage() {
  const x = D.x, iso = (s) => { const [y, m, d] = s.split('-').map(Number); return `${d} ${MS[m - 1]} ${y}`; };
  $('#bs-k').textContent = `${iso(x.from)} – ${iso(x.to)}`;
  const thumbs = (list) => `<div class="thumbs">${list.map(([k, tip]) => {
    const t = VT[k], p = trackPic(t);
    return `<button data-do="tr:${t}" data-tip="${esc(trName(t))}\n${esc(trArtist(t))}${tip ? '\n' + esc(tip) : ''}" aria-label="${esc(trName(t))}"><span class="art" style="${fill(p)}">${visual(p, trName(t))}</span></button>`;
  }).join('')}</div>`;
  const b = (title, body, span) => `<div class="b${span ? ' w' + span : ''}"><h4>${title}</h4>${body}</div>`;
  const big = (v, sub) => `<div class="big">${v}</div>${sub ? `<small>${sub}</small>` : ''}`;
  const maxTerm = x.terms[0][1];
  const cloud = x.terms.map(([t, n]) => `<span style="font-size:${16 + n / maxTerm * 40}px;opacity:${0.55 + n / maxTerm * 0.45}" data-tip="${esc(t)}: ${n} Daylist">${esc(t)}</span>`).join('');
  const seen = new Set();
  const saved = x.saved.filter((s) => { const t = VT[s[1]]; if (seen.has(t)) return false; seen.add(t); return true; });
  const routeTotal = x.route.reduce((s, r) => s + r[1], 0), bitrateTotal = x.bitrate.reduce((s, r) => s + r[1], 0);
  const funnel = [['Ulaşan', x.push[0]], ['Görünen', x.push[1]], ['Dokunulan', x.push[2]]];
  $('#bs').innerHTML = [
    b('Spotify sana ne dedi', `<div class="cloud">${cloud}</div><small>${x.daylist.length} Daylist başlığı</small>`, 2),
    b('Jam', big(x.jam.created, `oturum açıldı, ${x.jam.joined} kez katıldın`)),
    b('Release Radar', ringChart(x.rr.played / x.rr.unique, pct(x.rr.played, x.rr.unique), `${x.rr.unique} öneriden ${x.rr.played} dinleme`)),
    b('Tekrardan çıkmayanlar', thumbs(x.repeat.map((r) => [r[0], `${r[1]} kayıtta`])), 2),
    b('Sözüne baktıkların', thumbs(x.lyrics.map((l) => [l[0], `${l[1]} kez`])), 2),
    b('Ses nereden çıkıyor', segBar(x.route.map((r, i) => ({ label: r[0], v: r[1], color: CAT[i % CAT.length] })), routeTotal), 2),
    b('Son kaydettiklerin', thumbs(saved.slice(0, 8).map((s) => [s[1], iso(s[0])])), 2),
    b('Bildirimler', `<div class="fun">${funnel.map(([l, v]) => `<div><span>${l}</span><span><i style="width:${v / funnel[0][1] * 100}%"></i></span><b>${nf(v)}</b></div>`).join('')}</div>`),
    b('Ses seviyesi', x.vol ? ringChart(x.vol[0] / 100, '%' + x.vol[0], 'medyan') : ''),
    b('Ses kalitesi', big(x.bitrate[0][0] / 1000 + ' kbps', `kayıtların ${pct(x.bitrate[0][1], bitrateTotal)} kadarı`)),
    b('İndirilen veri', big(nf1(x.gb.wifi + x.gb.carrier) + ' GB', `${nf1(x.gb.carrier)} GB mobil veri`)),
    b('Arama kutusuna yazdıkların', `<div class="typed">${x.searches.map((s) => `<span>${esc(s[0])}</span>`).join('')}</div>`, 4),
  ].join('');
}

function initMethod() {
  const m = D.meta, shownA = Object.keys(D.img.a).length, shownL = Object.keys(D.img.l).length;
  $('#method').innerHTML = [
    `Kaynak: Spotify'ın Extended Streaming History dışa aktarımındaki ${m.files} dosya (${nf(m.raw)} satır) ve Technical Log Information klasörü.`,
    `Tamamen aynı ${nf(m.dups)} tekrar ve boş ${nf(m.empty)} satır çıkarıldı. Kalan ${nf(m.rows)} kayıt tüm sayımların temeli.`,
    `Dinleme: en az 30 saniye çalan kayıt. Süreler kısa kayıtları da kapsar.`,
    `Saatler Türkiye saatine (UTC+3) çevrildi. Çevrimdışı dinlemelerde ${nf(m.fixed)} kaydın saati gerçek başlangıca çekildi.`,
    `Atlama: ileri veya geri tuşuyla geçilen kayıt. Spotify'ın kendi işareti Ekim 2022'den önce boş olduğu için bu tanım kullanıldı.`,
    `Oturum: arasında 15 dakikadan uzun boşluk olmayan kayıtlar. Sanatçı: Spotify'ın albüm sanatçısı alanı.`,
    `Görseller Spotify'ın herkese açık uçlarından alındı: ${nf(shownA)} sanatçı, ${nf(shownL)} albüm. Görseli olmayanlarda baş harf gösterilir.`,
    `IP adresleri, e-posta, cihaz kimlikleri ve Bluetooth adresleri bu sayfaya aktarılmadı.`,
  ].map((s) => `<li>${s}</li>`).join('');
}

/* ---------- Detay pencereleri ---------- */
const lrow = ({ p, name, by, value, act, short }) => `<${act ? `button data-do="${act}"` : 'div'} class="lrow${short ? ' short' : ''}"><span class="art" style="${fill(p)}">${visual(p, name)}</span><span><b>${esc(name)}</b>${by ? `<small>${esc(by)}</small>` : ''}</span><span class="v">${esc(value)}</span></${act ? 'button' : 'div'}>`;

function openDetail(kind, id) {
  const match = { ar: (k) => k >= 0 && TA[VT[k]] === id, tr: (k) => k >= 0 && VT[k] === id, al: (k) => k >= 0 && VL[k] === id, sh: (k) => k < 0 && ES[-k - 1] === id }[kind];
  const mon = new Float64Array(MONS), hr = new Float64Array(24), tracks = new Map(), albums = new Map(), episodes = new Map(), days = new Map();
  let ms = 0, plays = 0, rows = 0, skip = 0, first = -1, last = -1, uri = '';
  for (let i = 0; i < N; i++) {
    const k = K[i];
    if (!match(k)) continue;
    const m = M[i];
    ms += m; rows++;
    if (F[i] & IS_SKIP) skip++;
    if (m >= 30000) { plays++; if (first < 0) first = DAY[i]; last = DAY[i]; }
    mon[MON[i]] += m; hr[HR[i]] += m;
    days.set(DAY[i], (days.get(DAY[i]) || 0) + m);
    if (k >= 0) {
      const t = VT[k], x = tracks.get(t) || [0, 0];
      x[0] += m; x[1] += m >= 30000;
      tracks.set(t, x);
      albums.set(VL[k], (albums.get(VL[k]) || 0) + m);
      if (!uri) uri = D.v[k][2];
    } else {
      const e = -k - 1, x = episodes.get(e) || [0, 0];
      x[0] += m; x[1] += m >= 30000;
      episodes.set(e, x);
    }
  }
  const name = { ar: () => D.ar[id], tr: () => trName(id), al: () => D.al[id][0], sh: () => D.sh[id] }[kind]();
  const p = { ar: () => artistPic(id), tr: () => trackPic(id), al: () => albumPic(id), sh: () => showPic(id) }[kind]();
  const by = kind === 'tr' ? `<button data-do="ar:${TA[id]}">${esc(D.ar[TA[id]])}</button>` : kind === 'al' ? `<button data-do="ar:${LA[id]}">${esc(D.ar[LA[id]])}</button>` : { ar: 'Sanatçı', sh: 'Podcast' }[kind];
  const peak = argmax(mon), bestDay = [...days.entries()].sort((a, b) => b[1] - a[1])[0];
  const stats = [
    ['Süre', dur(ms)], ['Dinleme', nf(plays)],
    first >= 0 ? ['İlk', fmtDs(first)] : null, first >= 0 ? ['Son', fmtDs(last)] : null,
    peak >= 0 ? ['Zirve', monL(peak)] : null, kind === 'sh' ? null : ['Atlama', pct(skip, rows)],
  ].filter(Boolean);
  const link = kind === 'tr' && uri ? `https://open.spotify.com/track/${uri}` : `https://open.spotify.com/search/${encodeURIComponent(name)}`;
  const topTracks = [...tracks.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, kind === 'ar' ? 10 : 30);
  const topAlbums = kind === 'ar' ? [...albums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4) : [];
  const topEpisodes = [...episodes.entries()].sort((a, b) => b[1][0] - a[1][0]).slice(0, 15);
  let h = `<div class="dg-hero" style="--amb:${p ? p.color : 'var(--s2)'}"><span class="art${kind === 'ar' ? ' c' : ''}" style="${fill(p)}">${visual(p, name)}</span><div><p>${by}</p><h3>${esc(name)}</h3></div>${closeButton}</div>
    <div class="dgstats">${stats.map((s) => `<div><label>${s[0]}</label><strong>${s[1]}</strong></div>`).join('')}</div>
    <div><h4>Aylara göre (saat)</h4>${columns({ vals: mon, unit: 36e5, tip: (i) => monL(i) + '\n' + dur(mon[i]), color: (i) => YEAR_COLOR[monY(i)], h: 120, labels: yearLabels() })}</div>
    <div><h4>Saatlere göre</h4>${columns({ vals: hr, unit: 36e5, tip: (i) => hh(i) + '\n' + dur(hr[i]), color: () => 'var(--tape)', h: 70, labels: [['00', 6], ['06', 6], ['12', 6], ['18', 6]] })}</div>`;
  if (kind !== 'tr' && topTracks.length) h += `<div><h4>Şarkılar</h4>${topTracks.map(([t, a]) => lrow({ p: trackPic(t), name: trName(t), value: `${durShort(a[0])} · ${nf(a[1])} kez`, act: 'tr:' + t })).join('')}</div>`;
  if (topAlbums.length) h += `<div><h4>Albümler</h4><div class="strip">${topAlbums.map(([l, m]) => tile({ p: albumPic(l), name: D.al[l][0], sub: durShort(m), act: 'al:' + l })).join('')}</div></div>`;
  if (topEpisodes.length) h += `<div><h4>Bölümler</h4>${topEpisodes.map(([e, a]) => lrow({ p, name: D.ep[e][0], value: durShort(a[0]) })).join('')}</div>`;
  h += '<div class="tools">' + (bestDay ? `<button class="btn" data-do="day:${bestDay[0]}">En yoğun gün: ${fmtDs(bestDay[0])}</button>` : '') + `<a class="btn" href="${link}" target="_blank" rel="noopener">Spotify'da aç ↗</a></div>`;
  showDialog(h);
}

function openDay(d) {
  const [a, b] = dayRange(d), first = DAY[0], last = DAY[N - 1];
  let total = 0, plays = 0;
  const list = [];
  for (let i = a; i < b; i++) {
    total += M[i];
    plays += M[i] >= 30000;
    const k = K[i], t = T[i] % 86400, time = String(Math.floor(t / 3600)).padStart(2, '0') + ':' + String(Math.floor(t % 3600 / 60)).padStart(2, '0');
    list.push(k >= 0
      ? lrow({ p: trackPic(VT[k]), name: trName(VT[k]), by: `${time} · ${trArtist(VT[k])}`, value: dur(M[i]), act: 'tr:' + VT[k], short: M[i] < 30000 })
      : lrow({ p: showPic(ES[-k - 1]), name: D.ep[-k - 1][0], by: `${time} · ${D.sh[ES[-k - 1]]}`, value: dur(M[i]), act: 'sh:' + ES[-k - 1], short: M[i] < 30000 }));
  }
  const top = a < b ? bucketTop(a, b, 1, () => 0)[0] : null, p = top && top.a >= 0 ? artistPic(top.a) : null;
  showDialog(`<div class="dg-hero" style="--amb:${p ? p.color : 'var(--s2)'}"><span class="art c" style="${fill(p)}">${visual(p, top && top.a >= 0 ? D.ar[top.a] : '—')}</span><div><p>${WD[weekdayOf(d)]}</p><h3>${fmtD(d)}</h3></div>${closeButton}</div>
    <div class="tools"><button class="btn" data-do="day:${d - 1}" ${d <= first ? 'disabled' : ''}>← Önceki</button><button class="btn" data-do="day:${d + 1}" ${d >= last ? 'disabled' : ''}>Sonraki →</button></div>
    ${a < b ? `<div class="dgstats"><div><label>Süre</label><strong>${dur(total)}</strong></div><div><label>Dinleme</label><strong>${plays}</strong></div>${top.a >= 0 ? `<div><label>En çok</label><strong>${esc(D.ar[top.a])}</strong></div>` : ''}</div><div>${list.join('')}</div>` : '<p class="empty">Bu gün dinleme yok.</p>'}`);
}
