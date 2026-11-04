// Veri katmanının sağlaması: JavaScript hesapları, Python'un ayrı yoldan bulduğu değerlerle aynı mı?
// Kullanım: python build.py && node check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const here = new URL('.', import.meta.url);
const html = fs.readFileSync(new URL('index.html', here), 'utf8');
const open = 'type="application/json">';
const start = html.indexOf(open) + open.length;
const D = JSON.parse(html.slice(start, html.indexOf('</script>', start)).replaceAll('<\\/', '</'));

const ctx = vm.createContext({ D, console });
vm.runInContext(fs.readFileSync(new URL('src/js/core.js', here), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);
const ref = D.meta.check;

assert.equal(run('ALL.ms'), D.meta.totalMs, 'toplam süre');
assert.equal(run('ALL.rows'), D.meta.rows, 'satır sayısı');

for (const [year, ms] of Object.entries(ref.years)) {
  assert.equal(run(`agg(...yearRange(${year})).ms`), ms, `${year} süresi`);
}
assert.equal(run('YEARS.reduce((s,y)=>s+YA[y].ms,0)'), D.meta.totalMs, 'yıllar toplamı arşive eşit');
assert.equal(run('D.ar[argmax(ALL.A)]'), ref.topArtist[0], 'en çok sanatçı');
assert.equal(run('ALL.A[argmax(ALL.A)]'), ref.topArtist[1], 'en çok sanatçı süresi');

// Python şarkıları yalnızca ada göre sayıyor; aynı adlı şarkıları olabilir, bu yüzden en az o kadar olmalı
assert.ok(run('ALL.TP[argmax(ALL.TP)]') <= ref.topTrack[1], 'en çok şarkı dinleme sayısı');
assert.equal(run('trName(argmax(ALL.TP))'), ref.topTrack[0], 'en çok şarkı');

assert.equal(run('ALL.flow.reduce((s,v)=>s+v,0)'), D.meta.rows, 'başlangıç-bitiş matrisi tüm satırları kapsar');
assert.equal(run('[...ALL.hr].reduce((s,v)=>s+v,0)'), D.meta.totalMs, 'saat dağılımı toplamı');
assert.equal(run('[...ALL.mon].reduce((s,v)=>s+v,0)'), D.meta.totalMs, 'ay dağılımı toplamı');

assert.equal(run('dur(0)'), '0 sn');
assert.equal(run('dur(90*6e4)'), '1 sa 30 dk');
assert.equal(run('dur(278*36e5)'), '278 sa');
assert.equal(run('pct(1,4)'), '%25');
assert.equal(run('fold("Şehinşah")'), 'sehinsah');
assert.equal(run('gapText(365+60)'), '1 yıl 2 ay');
assert.equal(run('lb(-1)'), 0);
assert.equal(run('lb(2e9)'), D.meta.rows);
assert.equal(run('agg(5,5).ms'), 0, 'boş aralık');

const stories = run('computeStories()');
assert.ok(stories.obsess[0].n >= stories.obsess[5].n, 'takıntılar sıralı');
assert.ok(stories.miles.length >= 3, 'kilometre taşları');

console.log('check.mjs: tüm kontroller geçti');
