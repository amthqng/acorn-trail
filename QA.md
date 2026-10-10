# Acorn Trail QA pass, 10 October 2026

Work branch: `qa/offline-gameplay`. Base: `4c4a973ca7c23809499ff11d306f225a40ecdd66`.

## Verified results

The original suite had 15 passes and one failure. That failure was a test assumption: alternate regions intentionally begin with reading. The corrected regression follows each region's configured subject sequence.

The final suite passes all **31 Node regression tests and six complete browser journeys** in GitHub Actions. The browser matrix is Chromium and WebKit at 390×844, 320×568 and 844×390, with real touch interactions. Each journey completes all 84 stops, for **504 browser stop completions** in the final run.

Verified coverage:

- Team addition, editing, deletion, role requirements, persistence, the 20-friend limit, all animal renderers, and recovery from malformed stored rosters. Browser journeys also cover the parent gate, grade selection, protection against disabling every operation, the editor, and the story.
- Every reading-bank entry has distinct choices and an included correct answer. Three ambiguous compound-word distractor sets were corrected. Math is checked across four difficulty levels and individual operation categories, with another 4,000 generated numeric questions checked against their displayed arithmetic.
- All seven regions, all 84 alternating stops, correct-answer rewards, sticker continuation screens, and the finale. The Node journey verifies exactly one acorn per answer, every sticker unlock, and three finale bonus copies. Browser journeys verify rewards, collection, and replay.
- Math and reading question persistence across reload, wrong-attempt recovery, streak behavior, pending completed answers, boundary transition resume, and invalid save rejection.
- Restart, fresh start, full reset, and team-play reset cancel stale reward work. Existing stickers survive replay and team changes, including stored friends outside the current smaller roster.
- Start, editor, settings, story, map, challenge, sticker, basket and finale layouts are checked for horizontal overflow. Answer-audio and hint taps do not submit answers. Touch controls and scroll reachability are exercised by browser taps, including narrow portrait and landscape sizes.
- Inline HTML assets, script initialization without networking, and no unexpected remote requests during browser gameplay. Browser JavaScript error checks are clean.
- Browser test syntax and Git whitespace checks pass. Representative phone and landscape screenshots were reviewed; screenshots from all six journeys are attached to the successful Actions run.

Passing Actions run: https://github.com/amthqng/acorn-trail/actions/runs/38073978641

## Changes made

Save/resume now preserves wrong attempts and restores region transitions. Reset paths cancel pending reward timers and stale unlock callbacks, and clear question state. Invalid roster, question metadata and sticker counts recover safely; saved questions must contain an answer that can actually be selected. Removing a teammate before the one being edited preserves the intended edit. Team requirement icons render correctly, and answer reveals use the customized helper name.

Mobile fixes wrap the opening team and narrow lantern grids, fit the region toolbar and challenge columns, keep long answer text inside its button, and automatically bring a newly opened character editor into view. Main icon, chip, remove and answer-audio targets are 44 pixels; name inputs use 16-pixel text to avoid iOS input zoom. Safe-area padding, keyboard focus, keyboard character editing and touch-action hints were added. The intro hint now sits below its buttons and is hidden during gameplay, preventing footer overlap.

The game remains a single self-contained HTML file of approximately **360 KB**, with no new runtime dependencies and no gameplay redesign. Playwright is developer-only QA tooling installed by the Actions workflow.

## Practical limits

No failures remain in the automated suite. Physical iPhone hardware, native Safari safe-area rendering, and the sound of OS speech voices were not tested. Read-aloud availability depends on installed browser/OS voices; audio-control behavior was tested.

Chromium runs the saved HTML directly with its browser context offline, including reloads. WebKit's offline emulation rejects navigation before document loading, so its tests supply the identical HTML through an in-memory local route, then switch offline for gameplay; the locally supplied document is reinjected for reload checks. No game asset or backend is fetched externally.

A downloaded HTML has no external runtime asset requirements. Reopening a hosted URL while offline is a separate capability: this repository has no service worker and does not guarantee offline navigation to the hosted page. No hosting or service-worker architecture was introduced.

All work is committed and published on the QA branch for review. It has not been merged into `main`.
