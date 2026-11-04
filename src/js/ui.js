// Arayüz yardımcıları: görseller, kartlar, ipucu kutusu, detay penceresi kabuğu.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
root.lang = 'tr';

// Base64 görseli ilk kullanımda Blob'a çevirir: DOM'da megabaytlık öznitelik durmaz, aynı görsel tek kez çözülür.
const picCache = new Map();
function pic(kind, id) {
  const key = kind + id;
  if (picCache.has(key)) return picCache.get(key);
  const e = D.img[kind][id];
  let out = null;
  if (e) {
    const bin = atob(e[0]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    out = { url: URL.createObjectURL(new Blob([bytes], { type: 'image/webp' })), color: e[1] };
    e[0] = null;
  }
  picCache.set(key, out);
  return out;
}
const artistPic = (a) => pic('a', a) || (ARTIST_COVER[a] >= 0 ? pic('l', ARTIST_COVER[a]) : null);
const albumPic = (l) => pic('l', l) || pic('a', LA[l]);
const trackPic = (t) => (TL[t] >= 0 && pic('l', TL[t])) || pic('a', TA[t]);
const showPic = (s) => pic('s', s);

function hashColor(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.codePointAt(0)) | 0;
  return CAT[Math.abs(h) % CAT.length];
}

// Görsel ya da yoksa baş harfli yer tutucu
const visual = (p, name) => (p
  ? `<img src="${p.url}" alt="" loading="lazy" decoding="async" draggable="false">`
  : `<i class="ph" style="--c:${hashColor(name)}">${esc([...String(name)][0] || '?')}</i>`);
const fill = (p) => (p ? `--c:${p.color}` : '');

function tile({ p, name, sub, act, circle, rank, badge, gray, tip }) {
  return `<button class="tile${circle ? ' c' : ''}${gray ? ' gray' : ''}" data-do="${act}"${tip ? ` data-tip="${esc(tip)}"` : ''}>
    <span class="art" style="${fill(p)}">${visual(p, name)}${rank ? `<b class="rk">${rank}</b>` : ''}${badge ? `<b class="bd">${esc(badge)}</b>` : ''}</span>
    <span class="t">${esc(name)}</span>${sub ? `<span class="s">${esc(sub)}</span>` : ''}
  </button>`;
}
const artistTile = (a, opts = {}) => tile({ p: artistPic(a), name: D.ar[a], act: 'ar:' + a, circle: true, ...opts });
const trackTile = (t, opts = {}) => tile({ p: trackPic(t), name: trName(t), act: 'tr:' + t, ...opts });

// İpucu: fare ve klavye aynı kutuyu kullanır
const tipBox = $('#tip');
function showTip(el, x, y) {
  tipBox.textContent = el.dataset.tip;
  tipBox.hidden = false;
  const w = tipBox.offsetWidth, h = tipBox.offsetHeight;
  tipBox.style.left = Math.max(6, Math.min(innerWidth - w - 6, x + 14)) + 'px';
  tipBox.style.top = (y - h - 12 < 4 ? y + 20 : y - h - 12) + 'px';
}
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (el && el.dataset.tip) showTip(el, e.clientX, e.clientY);
  else tipBox.hidden = true;
});
document.addEventListener('focusin', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (el && el.dataset.tip && el.matches(':focus-visible')) {
    const r = el.getBoundingClientRect();
    showTip(el, r.left, r.top);
  } else tipBox.hidden = true;
});
document.addEventListener('scroll', () => { tipBox.hidden = true; }, { passive: true });

// Detay penceresi kabuğu
const dlg = $('#dlg'), dg = $('#dg');
let lastFocus = null;
function showDialog(html) {
  dg.innerHTML = html;
  if (!dlg.open) { lastFocus = document.activeElement; dlg.showModal(); }
  dlg.scrollTop = 0;
  $('.x', dg)?.focus();
}
dlg.addEventListener('close', () => lastFocus?.focus?.());
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
const closeButton = '<button class="x" data-do="close" aria-label="Kapat">×</button>';

// Bir hata tüm sayfayı düşürmesin; d3 yüklenemezse o bölüm boş kalır
function safe(fn, ...args) {
  try { return fn(...args); } catch (err) { console.error(fn.name, err); return undefined; }
}
