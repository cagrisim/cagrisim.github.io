'use strict';
// Veri katmanı: çözme, toplama, hikâye hesapları. DOM'a dokunmaz, check.mjs bunu Node'da da çalıştırır.

const MO = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WD = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const WD_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const CAT = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#2f9a3a', '#9085e9', '#e66767']; // validate_palette.js'ten geçti
const ALL_COLOR = '#e9dcc0';
const HEAT_ALL = '#e8a33d'; // ısı haritalarında krem griye dönüyor, tüm zamanlar için kehribar
const MUTED_SERIES = '#3d4488';

const nf = (n) => Math.round(n).toLocaleString('tr-TR');
const nf1 = (n) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => '%' + (b ? (a / b * 100).toLocaleString('tr-TR', { maximumFractionDigits: a / b < 0.1 ? 1 : 0 }) : 0);
const fold = (s) => String(s).toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
const locSuffix = (n) => ["'de", "'de", "'de", "'te", "'te", "'te", "'da", "'de", "'de", "'da"][n % 10];

function dur(ms) {
  const min = Math.round(ms / 6e4);
  if (min < 1) return Math.round(ms / 1000) + ' sn';
  if (min < 60) return min + ' dk';
  const H = Math.floor(min / 60), m = min % 60;
  return H >= 100 || !m ? nf(min / 60) + ' sa' : H + ' sa ' + m + ' dk';
}
const durShort = (ms) => (ms < 36e5 ? dur(ms) : nf(ms / 36e5) + ' sa');

// Renk üzerinde okunur yazı rengi
function inkOn(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05) > (L + 0.05) / 0.0576 ? '#ffffff' : '#14162e';
}

const dDate = (d) => new Date(d * 864e5);
const fmtD = (d) => { const x = dDate(d); return x.getUTCDate() + ' ' + MO[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); };
const fmtDs = (d) => { const x = dDate(d); return x.getUTCDate() + ' ' + MS[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); };
const fmtMY = (d) => { const x = dDate(d); return MS[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); };
const hh = (h) => String(h).padStart(2, '0') + ':00';
const weekdayOf = (d) => (dDate(d).getUTCDay() + 6) % 7;

// Satır sütunlarını çöz. Saatler zaten Türkiye saati; Date'in UTC alanlarıyla okunur ki tarayıcının saat dilimi karışmasın.
const N = D.k.length;
const T = new Int32Array(N), K = Int32Array.from(D.k), M = Int32Array.from(D.m), F = Int32Array.from(D.f);
const DAY = new Int32Array(N), MON = new Int16Array(N), HR = new Int8Array(N), DOW = new Int8Array(N);
const BASE = new Date(D.t0 * 1000), BY = BASE.getUTCFullYear(), BM = BASE.getUTCMonth();
{
  let c = D.t0, lastDay = -1, mon = 0, dw = 0;
  for (let i = 0; i < N; i++) {
    c += D.t[i];
    T[i] = c;
    const d = Math.floor(c / 86400);
    if (d !== lastDay) {
      const x = dDate(d);
      mon = (x.getUTCFullYear() - BY) * 12 + x.getUTCMonth() - BM;
      dw = (x.getUTCDay() + 6) % 7;
      lastDay = d;
    }
    DAY[i] = d; MON[i] = mon; DOW[i] = dw;
    HR[i] = Math.floor((c % 86400) / 3600);
  }
}
D.t = D.k = D.m = D.f = null;

const MONS = MON[N - 1] + 1;
const monY = (i) => BY + Math.floor((BM + i) / 12);
const monM = (i) => (BM + i) % 12;
const monL = (i) => MO[monM(i)] + ' ' + monY(i);
const YEARS = [];
for (let y = BY; y <= monY(MONS - 1); y++) YEARS.push(y);
const YEAR_COLOR = Object.fromEntries(YEARS.map((y, i) => [y, CAT[i % CAT.length]]));

// Sıralı T üzerinde ilk t'yi bul
const lb = (t) => { let a = 0, b = N; while (a < b) { const m = (a + b) >> 1; if (T[m] < t) a = m + 1; else b = m; } return a; };
const yearRange = (y) => [lb(Date.UTC(y, 0, 1) / 1000), lb(Date.UTC(y + 1, 0, 1) / 1000)];
const monRange = (i) => [lb(Date.UTC(monY(i), monM(i), 1) / 1000), lb(Date.UTC(monY(i), monM(i) + 1, 1) / 1000)];
const dayRange = (d) => [lb(d * 86400), lb((d + 1) * 86400)];

const nA = D.ar.length, nT = D.tr.length, nL = D.al.length, nS = D.sh.length, nV = D.v.length, nE = D.ep.length;
const VT = new Int32Array(nV), VL = new Int32Array(nV), TA = new Int32Array(nT), LA = new Int32Array(nL), ES = new Int32Array(nE);
const TL = new Int32Array(nT).fill(-1); // şarkının kapağı olan albümü
const hasCover = (l) => !!(D.img && D.img.l[l]);
D.v.forEach((v, i) => {
  VT[i] = v[0]; VL[i] = v[1];
  const t = v[0];
  if (TL[t] < 0 || (!hasCover(TL[t]) && hasCover(v[1]))) TL[t] = v[1]; // v sıklığa göre sıralı
});
D.tr.forEach((t, i) => { TA[i] = t[1]; });
D.al.forEach((a, i) => { LA[i] = a[1]; });
D.ep.forEach((e, i) => { ES[i] = e[1]; });

const trName = (t) => D.tr[t][0];
const trArtist = (t) => D.ar[TA[t]];
const trackUri = (t) => { for (let v = 0; v < nV; v++) if (VT[v] === t) return D.v[v][2]; return ''; };

const topIdx = (arr, n) => {
  const o = [];
  for (let i = 0; i < arr.length; i++) if (arr[i] > 0) o.push(i);
  o.sort((x, y) => arr[y] - arr[x]);
  return n ? o.slice(0, n) : o;
};
const argmax = (a) => { let b = -1, v = 0; for (let i = 0; i < a.length; i++) if (a[i] > v) { v = a[i]; b = i; } return b; };

const IS_SKIP = 1, IS_SHUFFLE = 2, IS_OFFLINE = 4, IS_INCOGNITO = 8, IS_VIDEO = 16;
const reasonStart = (f) => (f >> 5) & 15, reasonEnd = (f) => (f >> 9) & 15, deviceOf = (f) => (f >> 13) & 15, countryOf = (f) => f >> 17;

// Bir satır aralığının tüm toplamları. Aynı aralık tekrar istenirse hazırdan döner.
const aggCache = new Map();
function agg(a, b) {
  const key = a + ':' + b;
  if (aggCache.has(key)) return aggCache.get(key);
  const r = {
    a, b, ms: 0, mus: 0, pod: 0, vid: 0, rows: 0, plays: 0, skip: 0, shuf: 0, off: 0, inc: 0,
    A: new Float64Array(nA), AP: new Int32Array(nA), TM: new Float64Array(nT), TP: new Int32Array(nT), TS: new Int32Array(nT), TN: new Int32Array(nT),
    L: new Float64Array(nL), LP: new Int32Array(nL), S: new Float64Array(nS), SP: new Int32Array(nS),
    hm: new Float64Array(168), hr: new Float64Array(24), mon: new Float64Array(MONS), dev: new Float64Array(D.dev.length), cc: new Float64Array(D.cc.length),
    flow: new Int32Array(D.rs.length * D.re.length), days: new Map(),
  };
  let ses = 0, sesStart = a, best = { ms: 0, a, b: a }, end = 0;
  for (let i = a; i < b; i++) {
    const k = K[i], m = M[i], f = F[i], p = m >= 30000 ? 1 : 0;
    r.ms += m; r.rows++; r.plays += p;
    if (f & IS_SKIP) r.skip++;
    if (f & IS_SHUFFLE) r.shuf++;
    if (f & IS_OFFLINE) r.off++;
    if (f & IS_INCOGNITO) r.inc++;
    if (k >= 0) {
      const t = VT[k], ar = TA[t], al = VL[k];
      r.mus += m;
      if (f & IS_VIDEO) r.vid += m;
      r.A[ar] += m; r.AP[ar] += p;
      r.TM[t] += m; r.TP[t] += p; r.TN[t]++;
      if (f & IS_SKIP) r.TS[t]++;
      r.L[al] += m; r.LP[al] += p;
    } else {
      const s = ES[-k - 1];
      r.pod += m; r.S[s] += m; r.SP[s] += p;
    }
    r.hm[DOW[i] * 24 + HR[i]] += m;
    r.hr[HR[i]] += m;
    r.mon[MON[i]] += m;
    r.dev[deviceOf(f)] += m;
    r.cc[countryOf(f)] += m;
    r.flow[reasonStart(f) * D.re.length + reasonEnd(f)]++;
    const d = DAY[i];
    r.days.set(d, (r.days.get(d) || 0) + m);
    if (i > a && T[i] - end > 900) { // 15 dakikadan uzun boşluk yeni oturum
      if (ses > best.ms) best = { ms: ses, a: sesStart, b: i };
      ses = 0; sesStart = i;
    }
    ses += m;
    end = Math.max(end, T[i] + m / 1000);
  }
  if (ses > best.ms) best = { ms: ses, a: sesStart, b };
  r.session = best;

  const active = [...r.days.entries()].filter((e) => e[1] >= 30000).sort((x, y) => x[0] - y[0]);
  r.active = active.length;
  let run = 0, prev = -9;
  r.streak = 0; r.streakEnd = 0;
  for (const [d] of active) {
    run = d === prev + 1 ? run + 1 : 1;
    if (run > r.streak) { r.streak = run; r.streakEnd = d; }
    prev = d;
  }
  r.best = active.reduce((x, e) => (e[1] > x[1] ? e : x), [0, 0]);
  r.nA = r.AP.reduce((s, v) => s + (v > 0), 0);
  r.nT = r.TP.reduce((s, v) => s + (v > 0), 0);
  r.nL = r.LP.reduce((s, v) => s + (v > 0), 0);
  r.span = b > a ? DAY[b - 1] - DAY[a] + 1 : 0;
  aggCache.set(key, r);
  return r;
}

const ALL = agg(0, N);
const YA = Object.fromEntries(YEARS.map((y) => [y, agg(...yearRange(y))]));
const TOP8 = topIdx(ALL.A, 8);
const ARTIST_COLOR = new Map(TOP8.map((id, i) => [id, CAT[i]]));

// Fotoğrafı olmayan sanatçının yedeği: en çok dinlenen, kapağı olan albümü
const ARTIST_COVER = new Int32Array(nA).fill(-1);
for (const l of topIdx(ALL.L)) if (ARTIST_COVER[LA[l]] < 0 && hasCover(l)) ARTIST_COVER[LA[l]] = l;

// Satır aralığını gruba böl, her grubun süresini ve en çok sanatçı/şarkısını bul
function bucketTop(a, b, n, bucketOf) {
  const out = Array.from({ length: n }, () => ({ ms: 0, A: new Float64Array(nA), TP: new Int32Array(nT) }));
  for (let i = a; i < b; i++) {
    const o = out[bucketOf(i)], k = K[i];
    o.ms += M[i];
    if (k >= 0) {
      const t = VT[k];
      o.A[TA[t]] += M[i];
      if (M[i] >= 30000) o.TP[t]++;
    }
  }
  return out.map((o) => ({ ms: o.ms, a: argmax(o.A), t: argmax(o.TP) }));
}

// Her gruba en özgü sanatçı: grup içindeki payı genel payını en çok aşan. En çok dinlenen her dilimde aynı kişi çıkardı.
function bucketSignature(r, n, bucketOf) {
  const pool = topIdx(r.A, 40), slot = new Map(pool.map((a, i) => [a, i]));
  const out = Array.from({ length: n }, () => ({ ms: 0, A: new Float64Array(pool.length) }));
  for (let i = r.a; i < r.b; i++) {
    const o = out[bucketOf(i)], k = K[i];
    o.ms += M[i];
    if (k >= 0) {
      const p = slot.get(TA[VT[k]]);
      if (p !== undefined) o.A[p] += M[i];
    }
  }
  const used = new Set();
  return out.map((o) => {
    let best = -1, score = 0;
    o.A.forEach((v, p) => {
      if (!v || used.has(pool[p])) return;
      const s = (v / o.ms) / (r.A[pool[p]] / r.ms) * Math.sqrt(v);
      if (s > score) { score = s; best = pool[p]; }
    });
    if (best >= 0) used.add(best);
    return { ms: o.ms, a: best };
  });
}

// Her ayın en çok dinlenen sanatçısı ve albümü
const MONTH_TOP = Array.from({ length: MONS }, (_, i) => {
  const r = agg(...monRange(i)), a = argmax(r.A), l = argmax(r.L);
  return { ms: r.ms, a, aMs: a >= 0 ? r.A[a] : 0, l, lMs: l >= 0 ? r.L[l] : 0 };
});

function gapText(days) {
  const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30);
  return (y ? y + ' yıl ' : '') + (m || !y ? m + ' ay' : '');
}

// Tüm arşivi tek geçişte tarayıp hikâyeleri çıkarır
function computeStories() {
  const plays = new Int32Array(nT), lastDay = new Int32Array(nT), artistFirst = new Int32Array(nA).fill(-1);
  const seenTrack = new Uint8Array(nT), newTracks = new Float64Array(MONS), newArtists = new Float64Array(MONS);
  const dayCount = new Map(), trackDays = new Map();
  const artistMonths = new Map(topIdx(ALL.A, 400).map((id) => [id, new Float64Array(MONS)]));
  const miles = [];
  let cum = 0, nextMile = 1000 * 36e5, firstMusic = -1, lastMusic = -1;
  for (let i = 0; i < N; i++) {
    cum += M[i];
    if (cum >= nextMile) { miles.push({ i, label: nf(nextMile / 36e5) + '. saat' }); nextMile += 1000 * 36e5; }
    const k = K[i];
    if (k < 0) continue;
    const t = VT[k], ar = TA[t], d = DAY[i];
    const months = artistMonths.get(ar);
    if (months) months[MON[i]] += M[i];
    if (M[i] < 30000) continue;
    if (firstMusic < 0) firstMusic = i;
    lastMusic = i;
    if (!seenTrack[t]) { seenTrack[t] = 1; newTracks[MON[i]]++; }
    plays[t]++;
    lastDay[t] = d;
    if (artistFirst[ar] < 0) { artistFirst[ar] = d; newArtists[MON[i]]++; }
    const key = t * 20000 + (d - DAY[0]);
    dayCount.set(key, (dayCount.get(key) || 0) + 1);
    if (ALL.TP[t] >= 8) {
      let days = trackDays.get(t);
      if (!days) trackDays.set(t, (days = []));
      days.push(d);
    }
  }
  const endDay = DAY[N - 1];
  const sliced = (arr) => arr.slice(0, 6);

  const obsess = [...dayCount.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6)
    .map(([key, n]) => ({ t: Math.floor(key / 20000), d: (key % 20000) + DAY[0], n }));

  const lost = [];
  for (let t = 0; t < nT; t++) if (plays[t] >= 30 && lastDay[t] < endDay - 365) lost.push(t);
  lost.sort((x, y) => plays[y] - plays[x]);

  const back = [];
  for (const [t, days] of trackDays) {
    let bestGap = 0, at = 0;
    for (let i = 5; i < days.length - 2; i++) { // öncesinde ve sonrasında yeterince dinleme olsun
      const gap = days[i] - days[i - 1];
      if (gap > bestGap) { bestGap = gap; at = days[i]; }
    }
    if (bestGap >= 180) back.push({ t, gap: bestGap, d: at });
  }
  back.sort((x, y) => y.gap - x.gap);

  const loyal = [...artistMonths.entries()].map(([a, m]) => ({ a, n: m.reduce((s, v) => s + (v >= 18e5), 0) })).sort((x, y) => y.n - x.n);

  const fresh = [];
  for (let a = 0; a < nA; a++) if (artistFirst[a] >= endDay - 548 && ALL.A[a] > 0) fresh.push(a);
  fresh.sort((x, y) => ALL.A[y] - ALL.A[x]);

  const skipRate = (t) => ALL.TS[t] / ALL.TN[t];
  const skipped = [];
  for (let t = 0; t < nT; t++) if (ALL.TN[t] >= 30) skipped.push(t);
  skipped.sort((x, y) => skipRate(y) - skipRate(x));

  const bigDays = [...ALL.days.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([d, ms]) => {
    const [a, b] = dayRange(d), top = bucketTop(a, b, 1, () => 0)[0];
    return { d, ms, a: top.a };
  });

  const avg = (arr) => [...arr].slice(1).reduce((s, v) => s + v, 0) / (MONS - 1); // ilk ay arşivin başlangıcı, her şey "yeni" sayılır
  return {
    obsess, plays,
    lost: sliced(lost), lastDay,
    back: sliced(back),
    loyal: sliced(loyal),
    fresh: sliced(fresh), artistFirst,
    skipped: sliced(skipped),
    bigDays,
    miles: [{ i: firstMusic, label: 'İlk şarkı' }, ...miles, { i: lastMusic, label: 'Son şarkı' }],
    discovery: { newTracks, newArtists, avgTracks: avg(newTracks), avgArtists: avg(newArtists) },
  };
}
