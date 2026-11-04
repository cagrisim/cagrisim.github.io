// Grafikler. Her biri veri alır, HTML döndürür ya da verilen kutuya çizer; uygulama durumunu bilmez.

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function table(head, rows) {
  return `<table><thead><tr>${head.map((h, i) => `<th${i ? ' class="r"' : ''}>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
const tableView = (body) => `<details class="tb"><summary>Tablo</summary><div class="scroll-x">${body}</div></details>`;

function niceTop(mx) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((s) => mx / s <= 4) || Math.ceil(mx / 4);
  return { step, top: Math.ceil(mx / step) * step || step };
}

// Tek baseline'dan kolonlar
function columns({ vals, unit = 1, tip, color, act, h = 230, labels = [] }) {
  const v = [...vals].map((x) => x / unit), { step, top } = niceTop(Math.max(...v, 1));
  let grid = '';
  for (let t = 0; t <= top; t += step) grid += `<div class="gl" style="bottom:${t / top * 100}%"><span>${nf(t)}</span></div>`;
  const bars = v.map((x, i) => {
    const attrs = `data-tip="${esc(tip(i))}"`, bar = `<i style="height:${x / top * 100}%;--c:${color(i)}"></i>`;
    return act ? `<button class="col" data-do="${act(i)}" ${attrs} aria-label="${esc(tip(i).replace('\n', ': '))}">${bar}</button>` : `<span class="col" ${attrs}>${bar}</span>`;
  }).join('');
  const x = labels.map((l) => `<span style="flex:${l[1]} 1 0">${l[0]}</span>`).join('');
  return `<div class="cols" style="--h:${h}px"><div class="cols-plot">${grid}${bars}</div><div class="cols-x">${x}</div></div>`;
}
const yearLabels = () => YEARS.map((y) => {
  let n = 0;
  for (let i = 0; i < MONS; i++) if (monY(i) === y) n++;
  return [n > 2 ? y : '', n];
});

// Kutuları anahtarla yerinde tutar; düzen değişince yeni konuma akarlar
function placeBoxes(box, nodes, make) {
  const map = box._nodes || (box._nodes = new Map()), live = new Set();
  for (const n of nodes) {
    let el = map.get(n.key);
    const pos = { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px', height: n.h + 'px' };
    if (!el) {
      el = make(n);
      Object.assign(el.style, pos);
      map.set(n.key, el);
      box.append(el);
    } else Object.assign(el.style, pos);
    el.classList.remove('gone');
    el.tabIndex = 0;
    el.dataset.tip = n.tip;
    el.setAttribute('aria-label', n.tip.replace(/\n/g, ', '));
    n.after?.(el);
    live.add(n.key);
  }
  map.forEach((el, key) => { if (!live.has(key)) { el.classList.add('gone'); el.tabIndex = -1; } });
}

// Daire paketleme dikdörtgeni dolduramaz; çarpışmalı yerleşim geniş ekranı bulut gibi kaplar
function bubbleLayout(items, W, H, previous) {
  const sum = d3.sum(items, (d) => d.v), maxV = d3.max(items, (d) => d.v);
  const k = Math.min(Math.sqrt(0.62 * W * H / (Math.PI * sum)), 0.46 * H / Math.sqrt(maxV)), pad = Math.max(1.5, W / 620);
  const nodes = items.map((d, i) => {
    const r = Math.sqrt(d.v) * k, old = previous?.get(d.key), angle = i * 2.399963, spread = 6 + i * 8;
    return { ...d, r, x: old ? old.x : W / 2 + Math.cos(angle) * spread * (W / H), y: old ? old.y : H / 2 + Math.sin(angle) * spread };
  });
  const sim = d3.forceSimulation(nodes)
    .force('hit', d3.forceCollide((d) => d.r + pad).iterations(3))
    .force('x', d3.forceX(W / 2).strength(0.01 + 0.03 * H / W))
    .force('y', d3.forceY(H / 2).strength(0.07))
    .stop();
  for (let t = 0; t < 280; t++) {
    sim.tick();
    for (const n of nodes) { n.x = clamp(n.x, n.r, W - n.r); n.y = clamp(n.y, n.r, H - n.r); }
  }
  return nodes;
}

// Akış grafiği: her bant bir sanatçı, kalınlığı o ayki süresi
function streamChart(box, xBox, keys, rows, colorOf) {
  const series = d3.stack().keys(keys).offset(d3.stackOffsetSilhouette).order(d3.stackOrderInsideOut)(rows);
  const lo = d3.min(series, (s) => d3.min(s, (d) => d[0])), hi = d3.max(series, (s) => d3.max(s, (d) => d[1]));
  const n = rows.length, W = 1000, H = 400;
  const x = (i) => i / (n - 1) * W, y = (v) => H - (v - lo) / (hi - lo) * H;
  const area = d3.area().x((d, i) => x(i)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(d3.curveBasis);
  const paths = series.map((s) => `<path d="${area(s)}" fill="${colorOf(s.key)}" data-a="${s.key}"></path>`).join('');
  const avatars = series.map((s) => {
    let peak = 0;
    s.forEach((d, i) => { if (d[1] - d[0] > s[peak][1] - s[peak][0]) peak = i; });
    const a = +s.key, p = artistPic(a);
    return `<button class="sav" style="left:${clamp(x(peak) / W * 100, 2, 98)}%;top:${y((s[peak][0] + s[peak][1]) / 2) / H * 100}%;${fill(p)}" data-do="ar:${a}" data-tip="${esc(D.ar[a])}\nZirve: ${monL(peak)}, ${dur(s[peak][1] - s[peak][0])}" aria-label="${esc(D.ar[a])}">${visual(p, D.ar[a])}</button>`;
  }).join('');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg><div class="shade" id="sh-l"></div><div class="shade" id="sh-r"></div>${avatars}`;

  const ticks = [];
  for (let i = 0; i < n; i++) if (monM(i) === 0) ticks.push(`<span style="left:${x(i) / W * 100}%">${monY(i)}</span>`);
  xBox.innerHTML = ticks.join('');

  // Tek dinleyici: fare konumundan ay ve bant bulunur. İpucu ve tıklama hedefi kutunun üzerine yazılır.
  const pathOf = new Map($$('path', box).map((p) => [p.dataset.a, p]));
  box.addEventListener('mousemove', (e) => {
    const r = box.getBoundingClientRect(), m = clamp(Math.round((e.clientX - r.left) / r.width * (n - 1)), 0, n - 1);
    const val = lo + (1 - (e.clientY - r.top) / r.height) * (hi - lo);
    const s = series.find((b) => b[m][0] <= val && val <= b[m][1]);
    box.dataset.do = 'period:m' + m;
    box.dataset.tip = s ? `${monL(m)}\n${D.ar[s.key]}: ${dur(s[m][1] - s[m][0])}` : monL(m);
    box.classList.toggle('hov', !!s);
    pathOf.forEach((p) => p.classList.remove('on'));
    if (s) pathOf.get(String(s.key)).classList.add('on');
  });
  box.addEventListener('mouseleave', () => {
    box.classList.remove('hov');
    pathOf.forEach((p) => p.classList.remove('on'));
    delete box.dataset.tip;
  });
}

// Yıllara göre sıralama: düğümler fotoğraf, çizgiler aynı sanatçıyı bağlar
function bumpChart(box, years, ranks, colorOf, tipOf) {
  const n = years.length, depth = ranks[0].length ? Math.max(...ranks.map((r) => r.length)) : 0;
  const X = (c) => (c + 0.5) / n * 100, Y = (r) => (r + 0.5) / depth * 100;
  let paths = '', nodes = '';
  ranks.forEach((list, c) => {
    list.forEach((a, r) => {
      const color = colorOf(a), p = artistPic(a);
      nodes += `<button class="bn" style="left:${X(c)}%;top:${Y(r)}%;--c:${color}" data-a="${a}" data-do="ar:${a}" data-tip="${esc(tipOf(a, c, r))}" aria-label="${esc(tipOf(a, c, r).replace(/\n/g, ', '))}">${visual(p, D.ar[a])}</button>`;
      const next = c < n - 1 ? ranks[c + 1].indexOf(a) : -1;
      if (next >= 0) {
        const x1 = X(c), x2 = X(c + 1), mid = (x1 + x2) / 2, y1 = Y(r), y2 = Y(next);
        paths += `<path data-a="${a}" stroke="${color}" d="M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}"></path>`;
      }
    });
  });
  box.innerHTML = `<div class="yrs" style="--n:${n}">${years.map((y) => `<span>${y}</span>`).join('')}</div><div class="bump"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${nodes}</div>`;
  const plot = $('.bump', box);
  const mark = (id) => {
    plot.classList.toggle('hov', id !== null);
    $$('.on', plot).forEach((e) => e.classList.remove('on'));
    if (id !== null) $$(`[data-a="${id}"]`, plot).forEach((e) => e.classList.add('on'));
  };
  plot.addEventListener('mouseover', (e) => mark(e.target.closest('.bn')?.dataset.a ?? null));
  plot.addEventListener('mouseleave', () => mark(null));
  plot.addEventListener('focusin', (e) => mark(e.target.closest('.bn')?.dataset.a ?? null));
}

// Plak: 24 dilim, 7 halka. Dış halka Pazartesi.
function recordChart(hm, peakLabel, tipOf) {
  const mx = Math.max(...hm, 1), inner = 92, ring = 26.5, gap = 0.006, arc = d3.arc();
  let paths = '', labels = '';
  for (let d = 0; d < 7; d++) {
    const r0 = inner + (6 - d) * ring;
    for (let h = 0; h < 24; h++) {
      const v = hm[d * 24 + h];
      const shape = arc({ innerRadius: r0, outerRadius: r0 + ring - 1.5, startAngle: h / 24 * TAU + gap, endAngle: (h + 1) / 24 * TAU - gap });
      paths += `<path d="${shape}" style="--p:${v ? Math.round(4 + (v / mx) ** 1.7 * 96) : 0}%" data-tip="${esc(tipOf(d, h, v))}"></path>`;
    }
  }
  const R = inner + 7 * ring + 16;
  for (let h = 0; h < 24; h += 3) {
    const a = h / 24 * TAU;
    labels += `<text x="${(Math.sin(a) * R).toFixed(1)}" y="${(-Math.cos(a) * R + 5).toFixed(1)}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  }
  return `<svg viewBox="-320 -320 640 640" role="img" aria-label="Haftanın günlerine ve saatlerine göre dinleme">${paths}${labels}
    <circle r="86" fill="#f1e8d3"></circle><circle r="6" fill="#0b0e27" cy="38"></circle>
    <text class="lbl" text-anchor="middle" y="4">${peakLabel}</text><text class="lbl2" text-anchor="middle" y="-34">zirve</text></svg>`;
}

// Sırt sırta dağlar: her yılın 24 saatlik dağılımı
function ridgelineChart(box, years, shares, colorOf) {
  // Paylar hep sıfırın epey üstünde; biçim görünsün diye ölçek en düşük değerden başlar
  const flat = shares.flat(), lo = Math.min(...flat), mx = Math.max(...flat), n = years.length, W = 240, H = 100, step = H / (n + 2.6), amp = step * 3.5;
  const line = d3.line().x((d, i) => i / 23 * W).y((d) => d[1]).curve(d3.curveCatmullRom.alpha(0.5));
  let body = '', labels = '';
  years.forEach((y, i) => {
    const base = (i + 3.5) * step, pts = shares[i].map((v, h) => [h, base - (v - lo) / (mx - lo) * amp]), d = line(pts);
    body += `<g data-y="${y}"><path d="${d}L${W} ${base}L0 ${base}Z" fill="var(--bg)" stroke="none"></path><path d="${d}" fill="none" stroke="${colorOf(y)}" stroke-width="2.5"></path></g>`;
    labels += `<span data-y="${y}" style="top:${base}%">${y}</span>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>${labels}`;
}

function ringChart(share, value, label) {
  const r = 52, c = TAU * r;
  return `<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tr" cx="60" cy="60" r="${r}"></circle><circle class="fi" cx="60" cy="60" r="${r}" stroke-dasharray="${clamp(share, 0.002, 1) * c} ${c}"></circle></svg><b>${value}</b><span>${label}</span></div>`;
}

function lineChart(series, labels, xLabels) {
  const n = labels.length, xp = (i) => (n > 1 ? i / (n - 1) * 100 : 50);
  const top = Math.ceil(Math.max(...series.flatMap((s) => s.vals)) / 10) * 10 || 10, yp = (v) => 100 - v / top * 100;
  let grid = '';
  for (let t = 0; t <= top; t += top > 50 ? 20 : 10) grid += `<div class="gl" style="bottom:${t / top * 100}%"><span>%${t}</span></div>`;
  const lines = series.map((s) => `<polyline stroke="${s.color}" points="${s.vals.map((v, i) => xp(i).toFixed(2) + ',' + yp(v).toFixed(2)).join(' ')}"></polyline>`).join('');
  const ends = series.map((s) => `<span class="lc-end" style="top:${yp(s.vals[n - 1])}%"><i class="dot" style="--c:${s.color}"></i>${s.name}</span>`).join('');
  const hit = labels.map((l, i) => `<i data-tip="${l}\n${series.map((s) => s.name + ': %' + nf1(s.vals[i])).join('\n')}"></i>`).join('');
  return `<div class="lc">${grid}<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg><div class="lc-hit">${hit}</div>${ends}</div><div class="lc-x">${xLabels.map(([i, l]) => `<span style="left:${xp(i)}%">${l}</span>`).join('')}</div>`;
}

function segBar(parts, total) {
  return `<div class="segbar" role="img" aria-label="${esc(parts.map((p) => p.label + ' ' + pct(p.v, total)).join(', '))}">${parts.map((p) => {
    const w = p.v / total * 100;
    return `<i style="flex:${w} 1 0;background:${p.color};color:${inkOn(p.color)}" data-tip="${esc(p.label)}\n${esc(p.text || nf(p.v))} · ${pct(p.v, total)}">${w > 9 ? pct(p.v, total) : ''}</i>`;
  }).join('')}</div><div class="legend" style="margin-top:8px">${parts.map((p) => `<span><i class="dot" style="--c:${p.color}"></i>${esc(p.label)}</span>`).join('')}</div>`;
}

// İki sütunlu akış: soldaki grubun kayıtları sağdaki gruba nasıl dağılıyor
function alluvialChart(left, right, matrix, total) {
  const H = 320, W = 1000, gap = 8, barW = 12;
  const stack = (groups) => {
    const live = groups.filter((g) => g.v > 0), s = (H - gap * (live.length - 1)) / total;
    let y = 0;
    live.forEach((g) => { g.y = y; g.h = g.v * s; g.cur = y; y += g.h + gap; });
    return { live, s };
  };
  const L = stack(left), R = stack(right);
  let ribbons = '';
  L.live.forEach((a) => {
    R.live.forEach((b) => {
      const c = matrix[a.i][b.i];
      if (!c) return;
      const t0 = c * L.s, t1 = c * R.s, y0 = a.cur, y1 = b.cur, x0 = barW, x1 = W - barW, m = W / 2;
      ribbons += `<path d="M${x0} ${y0}C${m} ${y0} ${m} ${y1} ${x1} ${y1}L${x1} ${y1 + t1}C${m} ${y1 + t1} ${m} ${y0 + t0} ${x0} ${y0 + t0}Z" fill="${a.color}" data-tip="${esc(a.label)} → ${esc(b.label)}\n${nf(c)} · ${pct(c, total)}"></path>`;
      a.cur += t0; b.cur += t1;
    });
  });
  const bars = [...L.live.map((g) => `<rect x="0" y="${g.y}" width="${barW}" height="${g.h}" fill="${g.color}"></rect>`), ...R.live.map((g) => `<rect x="${W - barW}" y="${g.y}" width="${barW}" height="${g.h}" fill="#f1e8d3"></rect>`)].join('');
  const labels = (live, cls) => {
    const minGap = 6.5, tops = [];
    live.forEach((g, i) => { const want = (g.y + g.h / 2) / H * 100; tops[i] = i ? Math.max(want, tops[i - 1] + minGap) : want; });
    if (tops[tops.length - 1] > 97) {
      tops[tops.length - 1] = 97;
      for (let i = tops.length - 2; i >= 0; i--) tops[i] = Math.min(tops[i], tops[i + 1] - minGap);
    }
    return `<div class="al-l ${cls}">${live.map((g, i) => `<span style="top:${tops[i]}%">${esc(g.label)} <small>${pct(g.v, total)}</small></span>`).join('')}</div>`;
  };
  return `<div class="alluvial">${labels(L.live, '')}<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Şarkıların başlama ve bitme biçimleri">${ribbons}${bars}</svg>${labels(R.live, 'r')}</div>`;
}
