# Traffic Signs BD

An offline, bilingual (English / বাংলা) web app for learning Bangladesh road signs — with a 10-question quiz, per-sign progress tracking, and local backup/restore. Built for learner drivers preparing for the BRTA written test and for anyone who wants to read the road correctly.

## Problem

New drivers in Bangladesh meet dozens of road signs but have no small, offline, Bangla-friendly way to learn them. Existing guides are PDFs or scattered web pages; this app turns the 30 most common signs into an interactive learn-and-quiz tool that works with zero network access.

## Features

- **Learn gallery** — 30 standard signs drawn as inline SVG (no images, no network), in 4 categories: Warning (10), Regulatory (10), Mandatory (5), Informative (5)
- **Search + category filters** — find a sign by name or meaning, with a clear empty state
- **Sign detail view** — tap any sign for its meaning and what to do, in English or Bangla
- **Learned tracking** — mark signs as learned; overall + per-category progress bars, persisted in localStorage
- **Quiz mode** — 10 questions, two types (identify the meaning / pick the sign), 4 options each; 10 points per correct answer, +5 streak bonus from 3 in a row; instant feedback, grade (A+–D), best score, and last-10 session history
- **Bilingual UI** — EN/বাংলা toggle persisted, Bengali digits throughout
- **Data tools** — export/import JSON backup with strict validation, typed-DELETE erase-all
- **Offline-first** — zero network requests; responsive down to 390px

## Stack

- Plain HTML + CSS + vanilla JavaScript (no build step, no dependencies)
- `js/signs.js` — sign data (30 signs, EN/BN names, meanings, actions)
- `js/logic.js` — pure logic: SVG rendering, filtering, quiz generation/scoring, progress, import validation
- `js/i18n.js` — UI strings (EN/BN)
- `js/app.js` — DOM rendering and state (localStorage)
- Tests: `node --test` (unit) + raw-CDP headless-Chrome smoke tests

## Prerequisites

Any modern browser. For tests: Node.js 18+ and the Playwright `headless_shell` binary used by `tests/smoke.mjs` (`~/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell`).

## Install / run

```bash
# no install step — open directly
open index.html
# or serve locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Dev commands

```bash
node --test tests/unit.test.js   # 11 unit tests
node tests/smoke.mjs             # 63 headless-Chrome smoke checks
```

## Environment

No environment variables, no API keys, no backend. All data stays in the browser's localStorage (`tsb-lang`, `tsb-learned`, `tsb-best`, `tsb-history`).

## Testing

- Unit: 11/11 PASS — sign data integrity, i18n key parity, Bengali digits, SVG frames/symbols, filtering, quiz generation (deterministic seed), scoring/grades, progress stats, export/import validation.
- Smoke: 63/63 PASS (raw CDP, headless_shell, `file://`) — render, filters, search empty state, modal, learned tracking + persistence, BN toggle + digits, full quiz play-through (score 115 for 9/10 with streak bonuses, grade A+), reload persistence, import rejection/acceptance, typed-DELETE erase, 390px no-overflow, 0 page/console errors, 0 failed requests.
- Repairs during testing: 1 real app bug (erase confirmation message was wiped by a re-render — fixed by setting the message after re-rendering) and 1 validator bug (numeric best score rejected — fixed to accept finite numbers); the rest were test-side fixes (score expectations, `const` redeclaration across CDP evals).

## Deployment

Static site — deploy the repo root to GitHub Pages (main branch, root). No build step.

## Limitations

- **Learning aid, not an official BRTA publication.** Sign shapes and meanings follow the standard Vienna-Convention-style signs used in Bangladesh; the actual sign on the road and the official BRTA learner handbook are authoritative.
- Sign drawings are simplified vector recreations, not photographs of official signs.
- Speed-limit sign shows 40 km/h as the example; real limits vary by road.
- Quiz distractors are drawn from the same category where possible; with only 30 signs, repeated quizzes will reuse questions.
- Data lives in one browser's localStorage; use export to back it up.

## Status

Complete MVP. All tests pass; no known bugs.
