// Traffic Signs BD - DOM app. Pure ASCII; Bengali comes from I18N (escaped).
(function () {
  'use strict';
  var L = window.TSBLogic;
  var LS = { lang: 'tsb-lang', learned: 'tsb-learned', best: 'tsb-best', history: 'tsb-history' };

  function loadJSON(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/blocked */ }
  }

  var state = {
    lang: localStorage.getItem(LS.lang) || 'en',
    category: 'all',
    query: '',
    learned: loadJSON(LS.learned, {}),
    best: loadJSON(LS.best, null),
    history: loadJSON(LS.history, []),
    quiz: null, // {questions, idx, score, streak, bestStreak, answered, correctCount, picked}
    modalSignId: null
  };

  function t(key) {
    var pack = I18N[state.lang] || I18N.en;
    return pack[key] || I18N.en[key] || key;
  }
  function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] !== undefined ? vars[k] : '{' + k + '}'; });
  }
  function signName(s) { return state.lang === 'bn' ? s.nameBn : s.nameEn; }
  function signMeaning(s) { return state.lang === 'bn' ? s.meaningBn : s.meaningEn; }
  function signAction(s) { return state.lang === 'bn' ? s.actionBn : s.actionEn; }
  function signById(id) { return SIGNS.find(function (s) { return s.id === id; }); }
  function num(n) { return L.fmtNum(n, state.lang); }

  // ------------------------------------------------------------ i18n apply
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
  }

  // ------------------------------------------------------------ learn tab
  function renderProgress() {
    var stats = L.progressStats(SIGNS, state.learned);
    document.getElementById('progressText').textContent = fill(t('progressDone'), { done: num(stats.done), total: num(stats.total) });
    document.getElementById('progressBar').style.width = stats.pct + '%';
    document.getElementById('progressPct').textContent = num(stats.pct) + '%';
    var wrap = document.getElementById('catProgress');
    wrap.innerHTML = '';
    ['warning', 'regulatory', 'mandatory', 'informative'].forEach(function (c) {
      var b = stats.byCat[c];
      var pct = b.total ? Math.round(b.done / b.total * 100) : 0;
      var row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML = '<span class="cat-name"></span><span class="cat-bar"><span class="cat-fill" style="width:' + pct + '%"></span></span><span class="cat-nums"></span>';
      row.querySelector('.cat-name').textContent = t('cat' + c.charAt(0).toUpperCase() + c.slice(1));
      row.querySelector('.cat-nums').textContent = num(b.done) + '/' + num(b.total);
      wrap.appendChild(row);
    });
  }

  function renderGrid() {
    var list = L.filterSigns(SIGNS, state.category, state.query);
    var grid = document.getElementById('signGrid');
    var empty = document.getElementById('noResults');
    document.getElementById('signsCount').textContent = fill(t('signsCount'), { n: num(list.length) });
    grid.innerHTML = '';
    if (!list.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.forEach(function (s) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'sign-card' + (state.learned[s.id] ? ' learned' : '');
      card.setAttribute('data-sign-id', s.id);
      card.innerHTML = '<span class="sign-art">' + L.signSVG(s, 84) + '</span>' +
        '<span class="sign-name"></span>' +
        '<span class="sign-cat"></span>' +
        (state.learned[s.id] ? '<span class="learned-badge">&#10003; ' + t('learned') + '</span>' : '');
      card.querySelector('.sign-name').textContent = signName(s);
      card.querySelector('.sign-cat').textContent = t('cat' + s.category.charAt(0).toUpperCase() + s.category.slice(1));
      card.addEventListener('click', function () { openModal(s.id); });
      grid.appendChild(card);
    });
  }

  function renderLearn() {
    renderProgress();
    renderGrid();
  }

  // ------------------------------------------------------------ modal
  function openModal(id) {
    var s = signById(id);
    if (!s) return;
    state.modalSignId = id;
    document.getElementById('modalArt').innerHTML = L.signSVG(s, 150);
    document.getElementById('modalName').textContent = signName(s);
    document.getElementById('modalMeaning').textContent = signMeaning(s);
    document.getElementById('modalAction').textContent = signAction(s);
    updateModalLearnBtn();
    document.getElementById('modal').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    state.modalSignId = null;
  }
  function updateModalLearnBtn() {
    var btn = document.getElementById('modalLearnBtn');
    var learned = !!state.learned[state.modalSignId];
    btn.textContent = learned ? t('markUnlearned') : t('markLearned');
    btn.classList.toggle('is-learned', learned);
  }
  function toggleLearned(id) {
    if (state.learned[id]) delete state.learned[id];
    else state.learned[id] = true;
    saveJSON(LS.learned, state.learned);
    renderLearn();
    if (state.modalSignId === id) updateModalLearnBtn();
  }

  // ------------------------------------------------------------ quiz
  function showScreen(name) {
    ['learnScreen', 'quizScreen', 'dataScreen'].forEach(function (id) {
      document.getElementById(id).classList.toggle('hidden', id !== name + 'Screen');
    });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
  }

  function startQuiz() {
    state.quiz = {
      questions: L.buildQuiz(SIGNS, 10),
      idx: 0, score: 0, streak: 0, bestStreak: 0, answered: 0, correctCount: 0, picked: null
    };
    document.getElementById('quizIntro').classList.add('hidden');
    document.getElementById('quizPlay').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    renderQuestion();
  }
  function renderQuestion() {
    var q = state.quiz.questions[state.quiz.idx];
    var sign = signById(q.signId);
    document.getElementById('quizQ').textContent = fill(t('quizQ'), { n: num(state.quiz.idx + 1), total: num(state.quiz.questions.length) });
    document.getElementById('quizScoreLive').textContent = num(state.quiz.score);
    document.getElementById('quizStreakLive').textContent = num(state.quiz.streak);
    document.getElementById('quizPrompt').textContent = q.type === 'meaning' ? t('quizAskMeaning') : t('quizAskSign');
    var ask = document.getElementById('quizAsk');
    var opts = document.getElementById('quizOptions');
    opts.innerHTML = '';
    document.getElementById('quizFeedback').classList.add('hidden');
    document.getElementById('quizNextBtn').classList.add('hidden');
    if (q.type === 'meaning') {
      ask.innerHTML = L.signSVG(sign, 120);
      q.options.forEach(function (oid) {
        var o = signById(oid);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'opt-btn'; b.setAttribute('data-opt-id', oid);
        b.textContent = signMeaning(o);
        b.addEventListener('click', function () { answer(oid); });
        opts.appendChild(b);
      });
    } else {
      var p = document.createElement('p');
      p.className = 'quiz-meaning';
      p.textContent = signMeaning(sign);
      ask.innerHTML = '';
      ask.appendChild(p);
      q.options.forEach(function (oid) {
        var o = signById(oid);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'opt-btn opt-sign'; b.setAttribute('data-opt-id', oid);
        b.innerHTML = L.signSVG(o, 72);
        b.addEventListener('click', function () { answer(oid); });
        opts.appendChild(b);
      });
    }
  }
  function answer(optionId) {
    var qz = state.quiz;
    if (!qz || qz.picked !== null) return;
    var q = qz.questions[qz.idx];
    var correct = optionId === q.answerId;
    var before = qz.score;
    var res = L.scoreAnswer({ score: qz.score, streak: qz.streak, answered: qz.answered, correctCount: qz.correctCount }, correct);
    qz.score = res.score; qz.streak = res.streak; qz.answered = res.answered; qz.correctCount = res.correctCount;
    qz.bestStreak = Math.max(qz.bestStreak, qz.streak);
    qz.picked = optionId;
    document.querySelectorAll('#quizOptions .opt-btn').forEach(function (b) {
      var oid = b.getAttribute('data-opt-id');
      b.disabled = true;
      if (oid === q.answerId) b.classList.add('correct');
      else if (oid === optionId) b.classList.add('wrong');
    });
    var fb = document.getElementById('quizFeedback');
    fb.classList.remove('hidden');
    if (correct) {
      fb.textContent = fill(t('quizCorrectMsg'), { pts: num(qz.score - before) });
      fb.className = 'feedback ok';
    } else {
      fb.textContent = fill(t('quizWrongMsg'), { ans: signMeaning(signById(q.answerId)) });
      fb.className = 'feedback bad';
    }
    document.getElementById('quizScoreLive').textContent = num(qz.score);
    document.getElementById('quizStreakLive').textContent = num(qz.streak);
    var next = document.getElementById('quizNextBtn');
    next.textContent = qz.idx + 1 >= qz.questions.length ? t('quizFinish') : t('quizNext');
    next.classList.remove('hidden');
  }
  function nextQuestion() {
    var qz = state.quiz;
    if (!qz) return;
    if (qz.idx + 1 >= qz.questions.length) { finishQuiz(); return; }
    qz.idx += 1;
    qz.picked = null;
    renderQuestion();
  }
  function finishQuiz() {
    var qz = state.quiz;
    var total = qz.questions.length;
    var acc = Math.round(qz.correctCount / total * 100);
    document.getElementById('quizPlay').classList.add('hidden');
    var res = document.getElementById('quizResults');
    res.classList.remove('hidden');
    document.getElementById('resScore').textContent = num(qz.score);
    document.getElementById('resCorrect').textContent = num(qz.correctCount) + '/' + num(total);
    document.getElementById('resAccuracy').textContent = num(acc) + '%';
    document.getElementById('resStreak').textContent = num(qz.bestStreak);
    document.getElementById('resGrade').textContent = L.grade(acc);
    var isBest = state.best === null || qz.score > state.best;
    document.getElementById('newBestBadge').classList.toggle('hidden', !isBest);
    if (isBest) { state.best = qz.score; saveJSON(LS.best, state.best); }
    document.getElementById('resBest').textContent = num(state.best);
    state.history.unshift({ at: new Date().toISOString(), score: qz.score, correct: qz.correctCount, total: total, acc: acc });
    state.history = state.history.slice(0, 10);
    saveJSON(LS.history, state.history);
    renderHistory();
  }
  function renderHistory() {
    var list = document.getElementById('quizHistoryList');
    var empty = document.getElementById('quizHistoryEmpty');
    list.innerHTML = '';
    if (!state.history.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    state.history.forEach(function (h) {
      var li = document.createElement('li');
      var d = new Date(h.at);
      li.innerHTML = '<span class="h-score"></span><span class="h-meta"></span>';
      li.querySelector('.h-score').textContent = t('quizScore') + ': ' + num(h.score);
      li.querySelector('.h-meta').textContent = num(h.correct) + '/' + num(h.total) + ' - ' + num(h.acc) + '% - ' + d.toLocaleDateString();
      list.appendChild(li);
    });
  }

  // ------------------------------------------------------------ data tab
  function renderData() {
    document.getElementById('exportBox').value = JSON.stringify(L.buildExport({ learned: state.learned, best: state.best, history: state.history }), null, 2);
    document.getElementById('importBox').value = '';
    document.getElementById('importMsg').textContent = '';
    document.getElementById('eraseInput').value = '';
    document.getElementById('eraseMsg').textContent = '';
  }

  // ------------------------------------------------------------ language
  function setLang(lang) {
    state.lang = lang === 'bn' ? 'bn' : 'en';
    localStorage.setItem(LS.lang, state.lang);
    document.getElementById('langEn').classList.toggle('active', state.lang === 'en');
    document.getElementById('langBn').classList.toggle('active', state.lang === 'bn');
    applyI18n();
    renderLearn();
    renderHistory();
    if (state.quiz && !document.getElementById('quizPlay').classList.contains('hidden')) renderQuestion();
    if (state.modalSignId) {
      var s = signById(state.modalSignId);
      document.getElementById('modalName').textContent = signName(s);
      document.getElementById('modalMeaning').textContent = signMeaning(s);
      document.getElementById('modalAction').textContent = signAction(s);
      updateModalLearnBtn();
    }
  }

  // ------------------------------------------------------------ wire up
  function init() {
    document.getElementById('langEn').addEventListener('click', function () { setLang('en'); });
    document.getElementById('langBn').addEventListener('click', function () { setLang('bn'); });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var tab = b.getAttribute('data-tab');
        showScreen(tab);
        if (tab === 'data') renderData();
        if (tab === 'quiz') {
          document.getElementById('quizBestLive').textContent = state.best === null ? '-' : num(state.best);
        }
      });
    });
    document.getElementById('searchInput').addEventListener('input', function (e) {
      state.query = e.target.value;
      renderGrid();
    });
    document.getElementById('clearSearchBtn').addEventListener('click', function () {
      state.query = '';
      document.getElementById('searchInput').value = '';
      state.category = 'all';
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-cat') === 'all'); });
      renderGrid();
    });
    document.querySelectorAll('.filter-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.category = b.getAttribute('data-cat');
        document.querySelectorAll('.filter-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
        renderGrid();
      });
    });
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });
    document.getElementById('modalLearnBtn').addEventListener('click', function () { toggleLearned(state.modalSignId); });
    document.getElementById('quizStartBtn').addEventListener('click', startQuiz);
    document.getElementById('quizNextBtn').addEventListener('click', nextQuestion);
    document.getElementById('quizAgainBtn').addEventListener('click', startQuiz);
    document.getElementById('quizBackBtn').addEventListener('click', function () { showScreen('learn'); });
    document.getElementById('exportBtn').addEventListener('click', function () {
      var blob = new Blob([document.getElementById('exportBox').value], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'traffic-signs-bd-backup.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    document.getElementById('importBtn').addEventListener('click', function () {
      var msg = document.getElementById('importMsg');
      var raw = document.getElementById('importBox').value.trim();
      var data;
      try { data = JSON.parse(raw); } catch (e) { msg.textContent = t('importErr'); msg.className = 'msg bad'; return; }
      var v = L.validateImport(data);
      if (!v.ok) { msg.textContent = t('importErr'); msg.className = 'msg bad'; return; }
      if (data.learned) { state.learned = data.learned; saveJSON(LS.learned, state.learned); }
      if (data.best !== undefined) { state.best = data.best; saveJSON(LS.best, state.best); }
      if (data.history) { state.history = data.history.slice(0, 10); saveJSON(LS.history, state.history); }
      msg.textContent = t('importOk'); msg.className = 'msg ok';
      renderLearn();
      renderHistory();
    });
    document.getElementById('eraseBtn').addEventListener('click', function () {
      var msg = document.getElementById('eraseMsg');
      if (document.getElementById('eraseInput').value.trim() !== 'DELETE') {
        msg.textContent = t('eraseHint'); msg.className = 'msg bad'; return;
      }
      state.learned = {}; state.best = null; state.history = [];
      saveJSON(LS.learned, state.learned); saveJSON(LS.best, state.best); saveJSON(LS.history, state.history);
      renderLearn();
      renderHistory();
      renderData();
      msg.textContent = t('eraseDone'); msg.className = 'msg ok';
    });

    // initial render
    document.getElementById('langEn').classList.toggle('active', state.lang === 'en');
    document.getElementById('langBn').classList.toggle('active', state.lang === 'bn');
    applyI18n();
    renderLearn();
    renderHistory();
    document.getElementById('quizBestLive').textContent = state.best === null ? '-' : num(state.best);
    showScreen('learn');
  }

  document.addEventListener('DOMContentLoaded', init);

  // test hooks
  window.__tsb = {
    state: state, setLang: setLang, startQuiz: startQuiz, answer: answer,
    nextQuestion: nextQuestion, toggleLearned: toggleLearned, openModal: openModal,
    closeModal: closeModal, showScreen: showScreen, signById: signById,
    renderData: renderData, finishQuiz: finishQuiz
  };
})();
