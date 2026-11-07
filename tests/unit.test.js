// Traffic Signs BD - unit tests. Run: node --test tests/unit.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { SIGNS } = require('../js/signs.js');
const L = require('../js/logic.js');
const { I18N } = require('../js/i18n.js');

// deterministic rng for repeatable tests
function rng(seed) {
  let s = seed;
  return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

test('sign data: 30 signs, unique ids, complete fields, 4 categories', () => {
  assert.equal(SIGNS.length, 30);
  assert.equal(new Set(SIGNS.map(s => s.id)).size, 30);
  const cats = {};
  for (const s of SIGNS) {
    assert.ok(s.id && s.category && s.nameEn && s.nameBn && s.meaningEn && s.meaningBn && s.actionEn && s.actionBn && s.shape && s.symbol, s.id);
    assert.ok(['warning', 'regulatory', 'mandatory', 'informative'].includes(s.category), s.id);
    assert.ok(s.nameBn.length > 1 && s.meaningBn.length > 3, s.id);
    cats[s.category] = (cats[s.category] || 0) + 1;
  }
  assert.deepEqual(cats, { warning: 10, regulatory: 10, mandatory: 5, informative: 5 });
});

test('i18n: EN and BN have identical key sets, no empty values', () => {
  assert.deepEqual(Object.keys(I18N.en).sort(), Object.keys(I18N.bn).sort());
  for (const k of Object.keys(I18N.en)) {
    assert.ok(I18N.en[k].length > 0, 'en:' + k);
    assert.ok(I18N.bn[k].length > 0, 'bn:' + k);
  }
});

test('Bengali digits: 0-9 map correctly', () => {
  assert.equal(L.toBnDigits('0123456789'), '০১২৩৪৫৬৭৮৯');
  assert.equal(L.fmtNum(40, 'bn'), '৪০');
  assert.equal(L.fmtNum(40, 'en'), '40');
  assert.equal(L.fmtNum(0, 'bn'), '০');
});

test('signSVG: each shape renders the right frame', () => {
  const byId = (id) => SIGNS.find(s => s.id === id);
  const tri = L.signSVG(byId('crossroads'));
  assert.ok(tri.includes('<polygon') && tri.includes('fill="#d8232a"'));
  const circ = L.signSVG(byId('no-entry'));
  assert.ok(circ.includes('<circle') && circ.includes('fill="#fff"'));
  const oct = L.signSVG(byId('stop'));
  assert.ok(oct.includes('STOP') && oct.includes('94,30'));
  const inv = L.signSVG(byId('give-way'));
  assert.ok(inv.includes('50,94'));
  const blue = L.signSVG(byId('turn-left'));
  assert.ok(blue.includes('fill="#1d4ed8"'));
  const sq = L.signSVG(byId('hospital'));
  assert.ok(sq.includes('<rect'));
  const rect = L.signSVG(byId('one-way'));
  assert.ok(rect.includes('height="48"'));
});

test('signSVG: symbol content spot checks', () => {
  const byId = (id) => SIGNS.find(s => s.id === id);
  assert.ok(L.signSVG(byId('speed-40')).includes('>40<'));
  assert.ok(L.signSVG(byId('no-parking')).includes('>P<'));
  assert.ok(L.signSVG(byId('parking')).includes('>P<'));
  assert.ok(L.signSVG(byId('no-entry')).includes('<rect x="30" y="44"'));
  assert.ok(L.signSVG(byId('no-horn')).includes('stroke="#d8232a"') || L.signSVG(byId('no-horn')).includes('#d8232a'));
  // every sign produces a non-empty svg with viewBox and aria-label
  for (const s of SIGNS) {
    const svg = L.signSVG(s);
    assert.ok(svg.startsWith('<svg viewBox="0 0 100 100"'), s.id);
    assert.ok(svg.includes('aria-label="' + s.nameEn + '"'), s.id);
    assert.ok(svg.length > 150, s.id);
  }
});

test('filterSigns: category + query', () => {
  assert.equal(L.filterSigns(SIGNS, 'all', '').length, 30);
  assert.equal(L.filterSigns(SIGNS, 'warning', '').length, 10);
  assert.equal(L.filterSigns(SIGNS, 'regulatory', '').length, 10);
  assert.equal(L.filterSigns(SIGNS, 'mandatory', '').length, 5);
  assert.equal(L.filterSigns(SIGNS, 'informative', '').length, 5);
  assert.equal(L.filterSigns(SIGNS, 'all', 'stop').length, 2); // "Stop" + "Bus stop"
  assert.ok(L.filterSigns(SIGNS, 'all', 'parking').length >= 2); // no-parking + parking
  assert.equal(L.filterSigns(SIGNS, 'all', 'zzzz-no-match').length, 0);
  assert.equal(L.filterSigns(SIGNS, 'warning', 'parking').length, 0);
  // Bengali search works
  assert.ok(L.filterSigns(SIGNS, 'all', 'থামুন').length >= 1);
});

test('buildQuiz: 10 questions, alternating types, valid options', () => {
  const q = L.buildQuiz(SIGNS, 10, rng(42));
  assert.equal(q.length, 10);
  q.forEach((item, i) => {
    assert.equal(item.type, i % 2 === 0 ? 'meaning' : 'sign');
    assert.equal(item.options.length, 4);
    assert.equal(new Set(item.options).size, 4);
    assert.ok(item.options.includes(item.answerId));
    assert.ok(SIGNS.some(s => s.id === item.answerId));
  });
  assert.equal(new Set(q.map(x => x.signId)).size, 10); // no repeated sign
  // deterministic with same seed
  const q2 = L.buildQuiz(SIGNS, 10, rng(42));
  assert.deepEqual(q, q2);
  // small request
  assert.equal(L.buildQuiz(SIGNS, 3, rng(7)).length, 3);
});

test('scoreAnswer: 10 pts, streak bonus at 3, streak resets on miss', () => {
  let s = { score: 0, streak: 0, answered: 0, correctCount: 0 };
  s = L.scoreAnswer(s, true); // streak 1 -> +10
  assert.deepEqual([s.score, s.streak, s.correctCount], [10, 1, 1]);
  s = L.scoreAnswer(s, true); // streak 2 -> +10
  assert.deepEqual([s.score, s.streak], [20, 2]);
  s = L.scoreAnswer(s, true); // streak 3 -> +15
  assert.deepEqual([s.score, s.streak], [35, 3]);
  s = L.scoreAnswer(s, false); // miss -> streak 0, no points
  assert.deepEqual([s.score, s.streak, s.answered], [35, 0, 4]);
  s = L.scoreAnswer(s, true); // streak 1 again -> +10
  assert.deepEqual([s.score, s.streak], [45, 1]);
});

test('grade: band boundaries', () => {
  assert.equal(L.grade(100), 'A+');
  assert.equal(L.grade(90), 'A+');
  assert.equal(L.grade(89), 'A');
  assert.equal(L.grade(80), 'A');
  assert.equal(L.grade(70), 'B');
  assert.equal(L.grade(60), 'C');
  assert.equal(L.grade(59), 'D');
  assert.equal(L.grade(0), 'D');
});

test('progressStats: counts and per-category breakdown', () => {
  const empty = L.progressStats(SIGNS, {});
  assert.deepEqual([empty.done, empty.total, empty.pct], [0, 30, 0]);
  const half = L.progressStats(SIGNS, { stop: true, 'give-way': true, 'no-entry': true, crossroads: true, 'ped-ahead': true });
  assert.deepEqual([half.done, half.pct], [5, 17]);
  assert.deepEqual(half.byCat.regulatory, { total: 10, done: 3 });
  assert.deepEqual(half.byCat.warning, { total: 10, done: 2 });
  const all = {};
  SIGNS.forEach(s => { all[s.id] = true; });
  assert.equal(L.progressStats(SIGNS, all).pct, 100);
});

test('export/import: round-trip valid, garbage rejected', () => {
  const exp = L.buildExport({ learned: { stop: true }, best: 80, history: [{ score: 80 }] });
  assert.equal(exp.app, 'traffic-signs-bd');
  assert.equal(exp.version, 1);
  assert.deepEqual(L.validateImport(exp), { ok: true });
  assert.equal(L.validateImport(null).ok, false);
  assert.equal(L.validateImport('nope').ok, false);
  assert.equal(L.validateImport([]).ok, false);
  assert.equal(L.validateImport({ app: 'other-app' }).ok, false);
  assert.equal(L.validateImport({ app: 'traffic-signs-bd', learned: [] }).ok, false);
  assert.equal(L.validateImport({ app: 'traffic-signs-bd', learned: { stop: 'yes' } }).ok, false);
  assert.equal(L.validateImport({ app: 'traffic-signs-bd', history: {} }).ok, false);
  assert.equal(L.validateImport({ app: 'traffic-signs-bd' }).ok, true); // minimal valid
});
