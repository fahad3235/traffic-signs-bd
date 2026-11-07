// Traffic Signs BD smoke tests - headless-Chrome QA harness.
// Raw CDP over the stock Playwright headless_shell binary.
// Run: node tests/smoke.mjs
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PORT = 9342;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file://' + path.resolve(DIR, '..', 'index.html');

const proc = spawn(BIN, [
  '--headless', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT, '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

async function waitForVersion(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (r.ok) return await r.json();
    } catch (e) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('CDP did not come up');
}

let seq = 0;
const pending = new Map();
let ws;
const pageErrors = [];
const consoleErrors = [];
const failedRequests = [];

function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 15000);
  });
}
async function ev(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error('page eval threw: ' + JSON.stringify(res.exceptionDetails));
  return res.result.value;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let passed = 0;
function check(name, cond, extra = '') {
  if (!cond) throw new Error('FAIL: ' + name + ' ' + extra);
  passed++;
  console.log('ok - ' + name);
}

try {
  await waitForVersion();
  const t = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(PAGE), { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await once(ws, 'open');
  ws.addEventListener('message', (evt) => {
    const m = JSON.parse(evt.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(JSON.stringify(m.params.args).slice(0, 300));
    } else if (m.method === 'Network.loadingFailed') {
      failedRequests.push(JSON.stringify(m.params).slice(0, 200));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await sleep(1200);

  // ---------------------------------------------------------- render
  check('title', (await ev(`document.title`)) === 'Traffic Signs BD');
  check('30 sign cards render', (await ev(`document.querySelectorAll('.sign-card').length`)) === 30);
  check('30 SVGs render', (await ev(`document.querySelectorAll('.sign-card svg').length`)) === 30);
  check('learn screen visible', (await ev(`!document.getElementById('learnScreen').classList.contains('hidden')`)) === true);
  check('progress starts 0%', (await ev(`document.getElementById('progressPct').textContent`)) === '0%');
  check('signs count 30', (await ev(`document.getElementById('signsCount').textContent`)).includes('30'));
  check('footer disclaimer', (await ev(`document.querySelector('footer').textContent`)).includes('not an official BRTA'));

  // ---------------------------------------------------------- filter + search
  await ev(`document.querySelector('[data-cat="warning"]').click()`);
  check('warning filter shows 10', (await ev(`document.querySelectorAll('.sign-card').length`)) === 10);
  await ev(`document.querySelector('[data-cat="all"]').click()`);
  check('all filter restores 30', (await ev(`document.querySelectorAll('.sign-card').length`)) === 30);
  await ev(`const i = document.getElementById('searchInput'); i.value = 'parking'; i.dispatchEvent(new Event('input', {bubbles:true}))`);
  check('search parking finds 2', (await ev(`document.querySelectorAll('.sign-card').length`)) === 2);
  await ev(`const i2 = document.getElementById('searchInput'); i2.value = 'zzzz'; i2.dispatchEvent(new Event('input', {bubbles:true}))`);
  check('no-results empty state shows', (await ev(`!document.getElementById('noResults').classList.contains('hidden')`)) === true);
  await ev(`document.getElementById('clearSearchBtn').click()`);
  check('clear search restores 30', (await ev(`document.querySelectorAll('.sign-card').length`)) === 30);

  // ---------------------------------------------------------- modal + learned
  await ev(`document.querySelector('[data-sign-id="stop"]').click()`);
  check('modal opens', (await ev(`!document.getElementById('modal').classList.contains('hidden')`)) === true);
  check('modal name Stop', (await ev(`document.getElementById('modalName').textContent`)) === 'Stop');
  check('modal meaning present', (await ev(`document.getElementById('modalMeaning').textContent`)).includes('complete stop'));
  check('modal has STOP svg', (await ev(`document.getElementById('modalArt').innerHTML`)).includes('STOP'));
  await ev(`document.getElementById('modalLearnBtn').click()`);
  check('stop marked learned', (await ev(`window.__tsb.state.learned['stop']`)) === true);
  check('progress 1/30 = 3%', (await ev(`document.getElementById('progressPct').textContent`)) === '3%');
  await ev(`document.getElementById('modalClose').click()`);
  check('modal closes', (await ev(`document.getElementById('modal').classList.contains('hidden')`)) === true);
  check('learned badge on card', (await ev(`document.querySelector('[data-sign-id="stop"] .learned-badge') !== null`)) === true);
  check('learned persists in localStorage', (await ev(`JSON.parse(localStorage.getItem('tsb-learned'))['stop']`)) === true);

  // ---------------------------------------------------------- language
  await ev(`window.__tsb.setLang('bn')`);
  await sleep(200);
  check('BN title renders', (await ev(`document.getElementById('appTitle').textContent`)).includes('ট্রাফিক'));
  check('BN card name', (await ev(`document.querySelector('[data-sign-id="stop"] .sign-name').textContent`)) === 'থামুন');
  check('BN progress digits', (await ev(`document.getElementById('progressPct').textContent`)) === '৩%');
  check('BN signs count digits', (await ev(`document.getElementById('signsCount').textContent`)).includes('৩০'));
  await ev(`window.__tsb.setLang('en')`);
  await sleep(200);
  check('back to EN', (await ev(`document.getElementById('appTitle').textContent`)) === 'Traffic Signs BD');
  check('lang persists', (await ev(`localStorage.getItem('tsb-lang')`)) === 'en');

  // ---------------------------------------------------------- quiz
  await ev(`document.querySelector('[data-tab="quiz"]').click()`);
  check('quiz screen visible', (await ev(`!document.getElementById('quizScreen').classList.contains('hidden')`)) === true);
  check('quiz intro visible', (await ev(`!document.getElementById('quizIntro').classList.contains('hidden')`)) === true);
  await ev(`window.__tsb.startQuiz()`);
  check('quiz playing', (await ev(`window.__tsb.state.quiz.questions.length`)) === 10);
  check('question 1 of 10', (await ev(`document.getElementById('quizQ').textContent`)).includes('1 of 10'));
  check('4 options', (await ev(`document.querySelectorAll('#quizOptions .opt-btn').length`)) === 4);
  // answer Q1 correctly
  await ev(`const q2 = window.__tsb.state.quiz.questions[0]; document.querySelector('[data-opt-id="' + q2.answerId + '"]').click()`);
  check('correct answer scores 10', (await ev(`window.__tsb.state.quiz.score`)) === 10);
  check('feedback ok shown', (await ev(`document.getElementById('quizFeedback').textContent`)).includes('Correct'));
  check('next button visible', (await ev(`!document.getElementById('quizNextBtn').classList.contains('hidden')`)) === true);
  // Q2 + Q3 correct -> streak 3 -> bonus
  await ev(`window.__tsb.nextQuestion()`);
  await ev(`const q3 = window.__tsb.state.quiz.questions[1]; document.querySelector('[data-opt-id="' + q3.answerId + '"]').click()`);
  await ev(`window.__tsb.nextQuestion()`);
  await ev(`const q4 = window.__tsb.state.quiz.questions[2]; document.querySelector('[data-opt-id="' + q4.answerId + '"]').click()`);
  check('streak 3 scores 10+10+15=35', (await ev(`window.__tsb.state.quiz.score`)) === 35);
  check('streak 3 in HUD', (await ev(`document.getElementById('quizStreakLive').textContent`)) === '3');
  // Q4 wrong -> streak resets
  await ev(`window.__tsb.nextQuestion()`);
  await ev(`const q5 = window.__tsb.state.quiz.questions[3]; const wrong = q5.options.find(o => o !== q5.answerId); document.querySelector('[data-opt-id="' + wrong + '"]').click()`);
  check('wrong answer keeps score', (await ev(`window.__tsb.state.quiz.score`)) === 35);
  check('streak resets to 0', (await ev(`window.__tsb.state.quiz.streak`)) === 0);
  check('wrong feedback names answer', (await ev(`document.getElementById('quizFeedback').textContent`)).includes('answer is'));
  // finish remaining 6 correctly via hooks
  for (let i = 0; i < 6; i++) {
    await ev(`window.__tsb.nextQuestion()`);
    await ev(`document.querySelector('[data-opt-id="' + window.__tsb.state.quiz.questions[window.__tsb.state.quiz.idx].answerId + '"]').click()`);
  }
  await ev(`window.__tsb.nextQuestion()`);
  check('results screen visible', (await ev(`!document.getElementById('quizResults').classList.contains('hidden')`)) === true);
  check('final score 9 correct = 115', (await ev(`document.getElementById('resScore').textContent`)) === '115');
  check('correct 9/10', (await ev(`document.getElementById('resCorrect').textContent`)) === '9/10');
  check('accuracy 90%', (await ev(`document.getElementById('resAccuracy').textContent`)) === '90%');
  check('grade A+', (await ev(`document.getElementById('resGrade').textContent`)) === 'A+');
  check('new best badge', (await ev(`!document.getElementById('newBestBadge').classList.contains('hidden')`)) === true);
  check('best saved 115', (await ev(`JSON.parse(localStorage.getItem('tsb-best'))`)) === 115);
  check('history has 1 entry', (await ev(`document.querySelectorAll('#quizHistoryList li').length`)) === 1);

  // reload: learned + best + history persist
  await send('Page.reload', { ignoreCache: true });
  await sleep(1200);
  check('learned persists after reload', (await ev(`JSON.parse(localStorage.getItem('tsb-learned'))['stop']`)) === true);
  check('best persists after reload', (await ev(`JSON.parse(localStorage.getItem('tsb-best'))`)) === 115);
  check('history persists after reload', (await ev(`document.querySelectorAll('#quizHistoryList li').length`)) === 1);

  // ---------------------------------------------------------- data tab: import validation + erase
  await ev(`document.querySelector('[data-tab="data"]').click()`);
  check('export box has JSON', (await ev(`document.getElementById('exportBox').value`)).includes('traffic-signs-bd'));
  await ev(`document.getElementById('importBox').value = '{"app":"other"}'; document.getElementById('importBtn').click()`);
  check('bad import rejected', (await ev(`document.getElementById('importMsg').textContent`)).includes('not valid'));
  await ev(`document.getElementById('importBox').value = JSON.stringify({app:'traffic-signs-bd', version:1, learned:{'speed-40':true}, best:50, history:[]}); document.getElementById('importBtn').click()`);
  check('good import accepted', (await ev(`document.getElementById('importMsg').textContent`)).includes('complete'));
  check('import applied learned', (await ev(`window.__tsb.state.learned['speed-40']`)) === true);
  await ev(`document.getElementById('eraseInput').value = 'nope'; document.getElementById('eraseBtn').click()`);
  check('erase needs DELETE', (await ev(`document.getElementById('eraseMsg').textContent`)).includes('DELETE'));
  await ev(`document.getElementById('eraseInput').value = 'DELETE'; document.getElementById('eraseBtn').click()`);
  check('erase done', (await ev(`document.getElementById('eraseMsg').textContent`)).includes('erased'));
  check('learned cleared', (await ev(`Object.keys(window.__tsb.state.learned).length`)) === 0);
  check('best cleared', (await ev(`window.__tsb.state.best`)) === null);

  // ---------------------------------------------------------- mobile
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  check('390px no horizontal overflow', (await ev(`document.documentElement.scrollWidth <= 390`)) === true);

  // ---------------------------------------------------------- errors
  check('0 page errors', pageErrors.length === 0, JSON.stringify(pageErrors));
  check('0 console errors', consoleErrors.length === 0, JSON.stringify(consoleErrors));
  check('0 failed requests', failedRequests.length === 0, JSON.stringify(failedRequests));

  console.log('\nSMOKE: ' + passed + '/' + passed + ' PASS');
} catch (err) {
  console.error('\nSMOKE FAILED: ' + err.message);
  console.error('pageErrors:', JSON.stringify(pageErrors));
  console.error('consoleErrors:', JSON.stringify(consoleErrors));
  process.exitCode = 1;
} finally {
  try { proc.kill(); } catch (e) { /* already dead */ }
}
