# Acorn Trail QA pass, 10 October 2026

Base: `4c4a973ca7c23809499ff11d306f225a40ecdd66`. Work branch: `qa/offline-gameplay`.

## Verified locally

The original regression suite had 15 passes and one failure. The failure was a test assumption: alternate regions intentionally begin with reading. The corrected test follows each region's configured subject sequence.

The expanded Node suite passes all 27 tests. Coverage includes:

- Team addition, editing, deletion, role requirements, persistence, the 20-friend limit, all animal renderers, and recovery from malformed stored rosters.
- Every reading-bank entry has distinct answer choices and an included correct answer.
- Math question validity across four difficulty levels and each enabled operation category; 4,000 additional generated numeric questions are checked against their displayed arithmetic.
- All 84 stops across seven regions, using real answer, reward, sticker continuation and finale callbacks in a simulated DOM. Every correct answer awards exactly one acorn, all stickers unlock, and the finale grants three bonus copies.
- Active question and streak persistence, wrong-attempt restoration, pending answer completion, boundary transition resume, invalid region/stop rejection, and optional saved character metadata recovery.
- Restart, fresh start, full reset and team-play reset reject stale reward callbacks. Stickers survive trail replay and team creation.
- All HTML asset references are inline data URLs or fragments. No remote script or stylesheet is required. Embedded JavaScript initializes with no network API.
- Browser test source syntax and Git whitespace checks pass.

## Implementation changes

Wrong-attempt counts now persist, preventing a resumed incorrect answer from becoming a clean streak. Boundary saves resume at the region transition. Reset paths cancel scheduled reward work and clear stale unlock callbacks and question state. Corrupt roster and sticker data recover safely. Removing a teammate before the one being edited keeps the edit attached to the intended character. Team requirement icons render correctly.

Mobile improvements include 44-pixel icon, name-chip and remove-button targets, 16-pixel name input text to avoid iOS input zoom, safe-area padding, visible keyboard focus, keyboard-accessible character editing, and touch-action hints.

The game remains a single self-contained HTML file, approximately 358 KB, with no new runtime dependencies or gameplay redesign.

## Remaining verification

Browser execution is blocked in this environment: Chromium and WebKit are absent, and the browser download returned an invalid archive. Consequently visual layout, scroll reachability, touch hit testing and actual browser file-origin save behavior are **not verified**. Physical iPhone Safari behavior is also not verified.

`tests/browser.test.cjs` contains six browser journeys: Chromium and WebKit at 390×844, 320×568 and 844×390. They use an offline browser context and real touch interactions, cover team editing, math and reading save/resume, all 84 answers, sticker collection, replay, horizontal overflow, JavaScript errors and unexpected remote requests. These tests are configured in GitHub Actions with developer-only Playwright tooling; they have not yet run.

Opening the downloaded HTML requires no external assets. Reopening a hosted URL while offline is a separate capability: this repository has no service worker, so it cannot guarantee offline navigation to the hosted page. Read-aloud availability depends on the browser and installed OS voices.

Publishing the branch was rejected by automatic approval review because it considered a push to the public GitHub repository insufficiently authorized. All changes are committed locally; nothing has been merged or published. Approval to push the QA branch is needed before cloud browser checks can run. This pass remains incomplete until those checks pass and any resulting issues are fixed.
