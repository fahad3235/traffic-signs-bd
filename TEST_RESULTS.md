# TEST RESULTS — traffic-signs-bd

Date: 2026-11-07 (14:00 slot)
Commands run from `builds/traffic-signs-bd/`:

## Unit tests — 11/11 PASS

`node --test tests/unit.test.js`

- sign data: 30 signs, unique ids, complete fields, 4 categories (10/10/5/5)
- i18n: EN and BN have identical key sets (61 keys), no empty values
- Bengali digits: 0123456789 -> ০১২৩৪৫৬৭৮৯; fmtNum(40,'bn') = ৪০
- signSVG: triangle/circle/octagon/inv-triangle/blue-circle/blue-square/blue-rect frames correct
- signSVG symbols: STOP text, speed "40", P on parking/no-parking, no-entry bar; every sign yields a valid svg with viewBox + aria-label
- filterSigns: category counts, "stop" -> 2 (Stop + Bus stop), "parking" -> 2, no-match -> 0, Bengali search works
- buildQuiz: 10 questions, alternating types, 4 unique options incl. answer, no repeated sign, deterministic with same seed
- scoreAnswer: 10 pts, +5 bonus at streak >= 3 (35 after 3 correct), streak resets on miss
- grade: 90 A+, 80 A, 70 B, 60 C, <60 D
- progressStats: 0/30 = 0%, 5 learned = 17%, per-category counts, 30/30 = 100%
- export/import: round-trip valid; null/string/array/wrong-app/bad-learned/bad-history rejected; minimal valid accepted

## Smoke tests — 63/63 PASS

`node tests/smoke.mjs` (raw CDP, headless_shell-1187, file://)

- Render: title, 30 cards, 30 SVGs, learn screen visible, progress 0%, count 30, footer BRTA disclaimer
- Filter/search: warning -> 10, all -> 30, "parking" -> 2, "zzzz" -> empty state, clear restores 30
- Modal: opens for Stop, name/meaning/STOP svg present; mark learned -> progress 3% (1/30), badge on card, localStorage persists
- Language: BN title + card name "থামুন", progress "৩%", count "৩০"; back to EN; lang persists
- Quiz: 10 questions, 4 options; Q1 correct +10; Q3 streak 3 -> 35 total; Q4 wrong keeps 35, streak 0, feedback names answer; finish 9/10 -> score 115, accuracy 90%, grade A+, new-best badge, best 115 saved, history 1 entry
- Reload: learned + best + history persist
- Data tab: export box contains app id; bad import rejected; good import accepted + applied; erase requires DELETE; DELETE erases learned/best/history
- Mobile: 390px no horizontal overflow
- Errors: 0 page errors, 0 console errors, 0 failed requests

## Repairs made during testing

1. **App bug (validator):** `validateImport` rejected a numeric best score (`best: 80`) — fixed to accept finite numbers.
2. **App bug (erase message):** erase confirmation was wiped because `renderData()` ran after setting the message — fixed by setting the message after re-rendering.
3. Test-side: corrected score expectation (115, not 100, for 9/10 with streak bonuses), corrected "stop" search count (2, not 1 — Bus stop matches too), renamed `const` declarations reused across CDP evals (global scope persists between evaluate calls).

No app-logic bugs remain. All sources pure ASCII (Bengali as \uXXXX escapes / HTML entities); verified by grep.
