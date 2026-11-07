// Traffic Signs BD - pure logic (no DOM). Testable in Node.
// Signs data lives in js/signs.js (SIGNS). This file is pure ASCII.
(function (root) {
  'use strict';

  var BN_DIGITS = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function fmtNum(n, lang) {
    return lang === 'bn' ? toBnDigits(n) : String(n);
  }

  // ---------------------------------------------------------------- SVG symbols
  // All symbols drawn in a 100x100 box. Black strokes on light signs,
  // white strokes on blue signs.
  function arrow(x1, y1, x2, y2, color, w) {
    // straight arrow with a simple triangular head
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;
    var hx = x2 - ux * 12, hy = y2 - uy * 12;
    var px = -uy * 6, py = ux * 6;
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + hx + '" y2="' + hy +
      '" stroke="' + color + '" stroke-width="' + (w || 7) + '" stroke-linecap="round"/>' +
      '<polygon points="' + x2 + ',' + y2 + ' ' + (hx + px) + ',' + (hy + py) + ' ' + (hx - px) + ',' + (hy - py) +
      '" fill="' + color + '"/>';
  }
  function person(cx, cy, s, color) {
    // simple walking figure: head + body + legs, scaled by s around (cx, cy)
    return '<g stroke="' + color + '" stroke-width="' + (5 * s) + '" stroke-linecap="round" fill="none">' +
      '<circle cx="' + cx + '" cy="' + (cy - 14 * s) + '" r="' + (5.5 * s) + '" fill="' + color + '" stroke="none"/>' +
      '<line x1="' + cx + '" y1="' + (cy - 8 * s) + '" x2="' + cx + '" y2="' + (cy + 6 * s) + '"/>' +
      '<line x1="' + cx + '" y1="' + (cy + 6 * s) + '" x2="' + (cx - 7 * s) + '" y2="' + (cy + 18 * s) + '"/>' +
      '<line x1="' + cx + '" y1="' + (cy + 6 * s) + '" x2="' + (cx + 7 * s) + '" y2="' + (cy + 16 * s) + '"/>' +
      '<line x1="' + cx + '" y1="' + (cy - 4 * s) + '" x2="' + (cx - 8 * s) + '" y2="' + (cy + 2 * s) + '"/>' +
      '<line x1="' + cx + '" y1="' + (cy - 4 * s) + '" x2="' + (cx + 8 * s) + '" y2="' + (cy - 8 * s) + '"/>' +
      '</g>';
  }
  function car(cx, cy, color, scale) {
    var s = scale || 1;
    return '<g fill="' + color + '">' +
      '<rect x="' + (cx - 20 * s) + '" y="' + (cy - 6 * s) + '" width="' + (40 * s) + '" height="' + (12 * s) + '" rx="' + (3 * s) + '"/>' +
      '<rect x="' + (cx - 13 * s) + '" y="' + (cy - 14 * s) + '" width="' + (22 * s) + '" height="' + (10 * s) + '" rx="' + (3 * s) + '"/>' +
      '<circle cx="' + (cx - 11 * s) + '" cy="' + (cy + 8 * s) + '" r="' + (4.5 * s) + '"/>' +
      '<circle cx="' + (cx + 11 * s) + '" cy="' + (cy + 8 * s) + '" r="' + (4.5 * s) + '"/>' +
      '</g>';
  }
  function slash(color) {
    return '<line x1="24" y1="76" x2="76" y2="24" stroke="' + color + '" stroke-width="7" stroke-linecap="round"/>';
  }

  var SYMBOLS = {
    crossroads: function () {
      return '<g stroke="#111" stroke-width="6" stroke-linecap="round" fill="none">' +
        '<line x1="32" y1="32" x2="68" y2="68"/><line x1="68" y1="32" x2="32" y2="68"/></g>' +
        '<polygon points="68,68 58,64 62,56" fill="#111"/><polygon points="32,68 42,64 38,56" fill="#111"/>';
    },
    ped: function () { return person(50, 52, 1.5, '#111'); },
    school: function () { return person(38, 56, 1.1, '#111') + person(62, 58, 0.85, '#111'); },
    bend: function () {
      return '<path d="M32 78 C32 48 44 44 56 40 C66 37 68 30 68 22" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<polygon points="68,14 62,26 74,26" fill="#111"/>';
    },
    slippery: function () {
      return car(50, 46, '#111', 0.9) +
        '<path d="M28 72 q6 -6 12 0 t12 0 t12 0 t12 0" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round"/>';
    },
    narrows: function () {
      return '<g stroke="#111" stroke-width="6" stroke-linecap="round">' +
        '<line x1="28" y1="80" x2="44" y2="24"/><line x1="72" y1="80" x2="56" y2="24"/></g>' +
        '<polygon points="44,16 38,28 50,28" fill="#111"/><polygon points="56,16 50,28 62,28" fill="#111"/>';
    },
    hump: function () {
      return '<path d="M24 72 L38 72 Q50 48 62 72 L76 72" stroke="#111" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<line x1="24" y1="80" x2="76" y2="80" stroke="#111" stroke-width="4" stroke-linecap="round"/>';
    },
    rail: function () {
      return '<g stroke="#111" stroke-width="6" stroke-linecap="round">' +
        '<line x1="34" y1="30" x2="66" y2="70"/><line x1="66" y1="30" x2="34" y2="70"/></g>' +
        '<line x1="28" y1="80" x2="72" y2="80" stroke="#111" stroke-width="4" stroke-linecap="round"/>';
    },
    works: function () {
      return person(44, 50, 1.1, '#111') +
        '<line x1="56" y1="62" x2="72" y2="78" stroke="#111" stroke-width="5" stroke-linecap="round"/>' +
        '<polygon points="72,78 64,76 68,68" fill="#111"/>';
    },
    twoway: function () { return arrow(38, 76, 38, 26, '#111', 6) + arrow(62, 24, 62, 74, '#111', 6); },
    stop: function () {
      return '<text x="50" y="58" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="bold" fill="#fff">STOP</text>';
    },
    giveway: function () { return ''; },
    noentry: function () {
      return '<rect x="30" y="44" width="40" height="12" fill="#fff"/>';
    },
    speed40: function () {
      return '<text x="50" y="63" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="bold" fill="#111">40</text>';
    },
    nopark: function () {
      return '<text x="50" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" font-weight="bold" fill="#fff">P</text>' + slash('#d8232a');
    },
    noover: function () {
      return car(40, 48, '#d8232a', 0.8) + car(62, 56, '#111', 0.8) + slash('#d8232a');
    },
    nohorn: function () {
      return '<path d="M30 44 h12 l16 -12 v36 l-16 -12 h-12 z" fill="#111"/>' +
        '<path d="M66 40 q8 10 0 20 M72 34 q12 16 0 32" stroke="#111" stroke-width="4" fill="none" stroke-linecap="round"/>' + slash('#d8232a');
    },
    nouturn: function () {
      return '<path d="M66 70 V48 Q66 30 50 30 Q34 30 34 48 V58" stroke="#111" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<polygon points="34,50 28,62 40,62" fill="#111"/>' + slash('#d8232a');
    },
    noleft: function () { return arrow(72, 50, 30, 50, '#111', 7) + slash('#d8232a'); },
    noright: function () { return arrow(28, 50, 70, 50, '#111', 7) + slash('#d8232a'); },
    left: function () { return arrow(72, 50, 30, 50, '#fff', 7); },
    right: function () { return arrow(28, 50, 70, 50, '#fff', 7); },
    straight: function () { return arrow(50, 74, 50, 26, '#fff', 7); },
    keepleft: function () {
      return '<line x1="62" y1="26" x2="38" y2="74" stroke="#fff" stroke-width="7" stroke-linecap="round"/>' + arrow(58, 30, 34, 66, '#fff', 6);
    },
    roundabout: function () {
      return '<path d="M50 28 A22 22 0 1 1 30 40" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<polygon points="30,28 26,44 40,40" fill="#fff"/>';
    },
    hospital: function () {
      return '<rect x="42" y="26" width="16" height="48" fill="#fff"/><rect x="26" y="42" width="48" height="16" fill="#fff"/>';
    },
    parking: function () {
      return '<text x="50" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="#fff">P</text>';
    },
    pedcross: function () {
      return '<g fill="#fff"><rect x="26" y="34" width="48" height="7"/><rect x="26" y="48" width="48" height="7"/><rect x="26" y="62" width="48" height="7"/></g>' +
        person(50, 46, 0.9, '#fff');
    },
    oneway: function () { return arrow(16, 50, 84, 50, '#fff', 8); },
    busstop: function () {
      return '<g fill="#fff"><rect x="28" y="28" width="44" height="34" rx="5"/>' +
        '<rect x="33" y="34" width="12" height="10" fill="#1d4ed8"/><rect x="55" y="34" width="12" height="10" fill="#1d4ed8"/>' +
        '<circle cx="38" cy="66" r="5"/><circle cx="62" cy="66" r="5"/></g>';
    }
  };

  // ---------------------------------------------------------------- SVG render
  function signSVG(sign, size) {
    var s = size || 96;
    var inner = SYMBOLS[sign.symbol] ? SYMBOLS[sign.symbol]() : '';
    var svg = '';
    if (sign.shape === 'triangle') {
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<polygon points="50,4 97,92 3,92" fill="#d8232a"/>' +
        '<polygon points="50,20 84,84 16,84" fill="#fff"/>' +
        '<g transform="translate(0,4) scale(0.82) translate(11,10)">' + inner + '</g></svg>';
    } else if (sign.shape === 'circle') {
      var blueBg = sign.symbol === 'nopark';
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<circle cx="50" cy="50" r="48" fill="#d8232a"/>' +
        '<circle cx="50" cy="50" r="37" fill="' + (blueBg ? '#1d4ed8' : '#fff') + '"/>' + inner + '</svg>';
    } else if (sign.shape === 'octagon') {
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<polygon points="30,6 70,6 94,30 94,70 70,94 30,94 6,70 6,30" fill="#d8232a"/>' +
        '<polygon points="33,12 67,12 88,33 88,67 67,88 33,88 12,67 12,33" fill="none" stroke="#fff" stroke-width="2"/>' + inner + '</svg>';
    } else if (sign.shape === 'inv-triangle') {
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<polygon points="6,8 94,8 50,94" fill="#d8232a"/>' +
        '<polygon points="16,16 84,16 50,80" fill="#fff"/>' + inner + '</svg>';
    } else if (sign.shape === 'blue-circle') {
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<circle cx="50" cy="50" r="48" fill="#1d4ed8"/>' +
        '<circle cx="50" cy="50" r="44" fill="none" stroke="#fff" stroke-width="2"/>' + inner + '</svg>';
    } else if (sign.shape === 'blue-square') {
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<rect x="4" y="4" width="92" height="92" rx="8" fill="#1d4ed8"/>' + inner + '</svg>';
    } else if (sign.shape === 'blue-rect') {
      svg = '<svg viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="' + sign.nameEn + '">' +
        '<rect x="2" y="26" width="96" height="48" rx="6" fill="#1d4ed8"/>' + inner + '</svg>';
    }
    return svg;
  }

  // ---------------------------------------------------------------- filtering
  function filterSigns(signs, category, query) {
    var q = (query || '').trim().toLowerCase();
    return signs.filter(function (s) {
      if (category && category !== 'all' && s.category !== category) return false;
      if (!q) return true;
      return (s.nameEn + ' ' + s.nameBn + ' ' + s.meaningEn).toLowerCase().indexOf(q) !== -1;
    });
  }

  // ---------------------------------------------------------------- quiz
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pickN(arr, n, rng) {
    return shuffle(arr, rng).slice(0, n);
  }
  // Build a quiz of n questions. Two types, alternating:
  //  - 'meaning': show the sign, pick the correct meaning.
  //  - 'sign': show a meaning, pick the correct sign.
  // Distractors come from the same category when possible.
  function buildQuiz(signs, n, rng) {
    var rand = rng || Math.random;
    var chosen = pickN(signs, Math.min(n, signs.length), rand);
    return chosen.map(function (sign, idx) {
      var type = idx % 2 === 0 ? 'meaning' : 'sign';
      var pool = signs.filter(function (s) { return s.id !== sign.id && s.category === sign.category; });
      if (pool.length < 3) pool = signs.filter(function (s) { return s.id !== sign.id; });
      var distractors = pickN(pool, 3, rand);
      var options = shuffle([sign].concat(distractors), rand).map(function (s) { return s.id; });
      return { type: type, signId: sign.id, options: options, answerId: sign.id };
    });
  }
  function scoreAnswer(state, correct) {
    // state: {score, streak, answered, correctCount}
    var s = { score: state.score, streak: state.streak, answered: state.answered + 1, correctCount: state.correctCount };
    if (correct) {
      s.streak = state.streak + 1;
      s.correctCount = state.correctCount + 1;
      s.score = state.score + 10 + (s.streak >= 3 ? 5 : 0);
    } else {
      s.streak = 0;
    }
    return s;
  }
  function grade(accuracyPct) {
    if (accuracyPct >= 90) return 'A+';
    if (accuracyPct >= 80) return 'A';
    if (accuracyPct >= 70) return 'B';
    if (accuracyPct >= 60) return 'C';
    return 'D';
  }

  // ---------------------------------------------------------------- progress
  function progressStats(signs, learnedIds) {
    var learned = learnedIds || {};
    var total = signs.length;
    var done = signs.filter(function (s) { return !!learned[s.id]; }).length;
    var byCat = {};
    ['warning', 'regulatory', 'mandatory', 'informative'].forEach(function (c) {
      var inCat = signs.filter(function (s) { return s.category === c; });
      var inDone = inCat.filter(function (s) { return !!learned[s.id]; }).length;
      byCat[c] = { total: inCat.length, done: inDone };
    });
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0, byCat: byCat };
  }

  // ---------------------------------------------------------------- export/import
  function buildExport(state) {
    return {
      app: 'traffic-signs-bd', version: 1,
      exportedAt: new Date().toISOString(),
      learned: state.learned || {},
      best: state.best || null,
      history: state.history || []
    };
  }
  function validateImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'not-an-object' };
    if (data.app !== 'traffic-signs-bd') return { ok: false, error: 'wrong-app' };
    if (data.learned !== undefined && (typeof data.learned !== 'object' || Array.isArray(data.learned))) return { ok: false, error: 'bad-learned' };
    if (data.learned) {
      var bad = Object.keys(data.learned).filter(function (k) { return typeof data.learned[k] !== 'boolean'; });
      if (bad.length) return { ok: false, error: 'bad-learned' };
    }
    if (data.best !== undefined && data.best !== null && (typeof data.best !== 'number' || !Number.isFinite(data.best))) return { ok: false, error: 'bad-best' };
    if (data.history !== undefined && !Array.isArray(data.history)) return { ok: false, error: 'bad-history' };
    return { ok: true };
  }

  var api = {
    toBnDigits: toBnDigits, fmtNum: fmtNum,
    signSVG: signSVG, filterSigns: filterSigns,
    shuffle: shuffle, pickN: pickN, buildQuiz: buildQuiz,
    scoreAnswer: scoreAnswer, grade: grade,
    progressStats: progressStats,
    buildExport: buildExport, validateImport: validateImport
  };
  if (typeof module !== 'undefined') module.exports = api;
  root.TSBLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
