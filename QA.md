# Acorn Trail QA pass, 10 October 2026

Work branch: `qa/offline-gameplay`. Base: `4c4a973ca7c23809499ff11d306f225a40ecdd66`.

## Verified results

The original suite had 15 passes and one failure. That failure was a test assumption: alternate regions intentionally begin with reading. The corrected regression follows each region's configured subject sequence.

The final suite passes all **40 Node regression tests and six complete browser journeys** in GitHub Actions. The browser matrix is Chromium and WebKit at 390×844, 320×568 and 844×390, with real touch interactions. Each journey completes all 84 stops, for **504 browser stop completions** in the final run.

Verified coverage:

- Team addition, editing, deletion, role requirements, persistence, the 20-friend limit, all animal renderers, and recovery from malformed stored rosters. Browser journeys also cover the parent gate, grade selection, protection against disabling every operation, the editor, and the story.
- Every reading-bank entry has distinct choices and an included correct answer. Six ambiguous compound-word distractor sets were corrected, and informal sound-alike spellings were removed from distractors. Math is checked across four difficulty levels and individual operation categories, with another 4,000 generated numeric questions checked against their displayed arithmetic.
- All seven regions, all 84 alternating stops, correct-answer rewards, sticker continuation screens, and the finale. The Node journey verifies exactly one acorn per answer, every sticker unlock, and three finale bonus copies. Browser journeys verify rewards, collection, and replay.
- Math and reading question persistence across reload, wrong-attempt recovery, streak behavior, pending completed answers, boundary transition resume, and invalid save rejection.
- Restart, fresh start, full reset, and team-play reset cancel stale reward work. Existing stickers survive replay and team changes, including stored friends outside the current smaller roster.
- Start, editor, settings, story, map, challenge, sticker, basket and finale layouts are checked for horizontal overflow. Answer-audio and hint taps do not submit answers. Touch controls and scroll reachability are exercised by browser taps, including narrow portrait and landscape sizes.
- Inline HTML assets, script initialization without networking, and no unexpected remote requests during browser gameplay. Browser JavaScript error checks are clean.
- Browser test syntax and Git whitespace checks pass. Representative phone and landscape screenshots were reviewed; screenshots from all six journeys are attached to the successful Actions run.

Passing Actions run: https://github.com/amthqng/acorn-trail/actions/runs/38082917296

## Changes made

Save/resume now preserves wrong attempts and restores region transitions. Reset paths cancel pending reward timers and stale unlock callbacks, and clear question state. Invalid roster, question metadata and sticker counts recover safely; saved questions must contain an answer that can actually be selected. Removing a teammate before the one being edited preserves the intended edit. Team requirement icons render correctly, and answer reveals use the customized helper name.

Mobile fixes wrap the opening team and narrow lantern grids, fit the region toolbar and challenge columns, keep long answer text inside its button, and automatically bring a newly opened character editor into view. Main icon, chip, remove and answer-audio targets are 44 pixels; name inputs use 16-pixel text to avoid iOS input zoom. Safe-area padding, keyboard focus, keyboard character editing and touch-action hints were added. The intro hint now sits below its buttons and is hidden during gameplay, preventing footer overlap.

The game remains a single self-contained HTML file of approximately **373 KB**, with no new runtime dependencies and the same four-choice gameplay. Optional answer explanations add a parent-controlled pause after a correct answer. Playwright is developer-only QA tooling installed by the Actions workflow.

## Practical limits

No failures remain in the automated suite. Physical iPhone hardware, native Safari safe-area rendering, and the sound of OS speech voices were not tested. Read-aloud availability depends on installed browser/OS voices; audio-control behavior was tested.

Chromium runs the saved HTML directly with its browser context offline, including reloads. WebKit's offline emulation rejects navigation before document loading, so its tests supply the identical HTML through an in-memory local route, then switch offline for gameplay; the locally supplied document is reinjected for reload checks. No game asset or backend is fetched externally.

A downloaded HTML has no external runtime asset requirements. Reopening a hosted URL while offline is a separate capability: this repository has no service worker and does not guarantee offline navigation to the hosted page. No hosting or service-worker architecture was introduced.

The stabilization fixes and head-only character artwork are merged into `main`. The learning improvements passed the QA branch checks and are promoted to `main`.

## Learning improvements, 10 October 2026

- Every new question includes a worked math explanation or reading rationale. Help after two wrong choices explains the answer. Older saved questions retain a compatible fallback explanation.
- Parents can enable “Pause to explain answers”. It is off by default, preserving automatic progression. When enabled, Continue advances once, with optional “Hear why” audio. Resets cancel a paused review; resume never awards a completed question again.
- Grown-up Settings contains a local learning summary by subject and skill, with completed puzzles, correct first choices without hints, hint use, and wrong choices on completed puzzles. The record starts with this update and does not infer earlier performance. Replay retains it; parents can clear it separately, or clear everything with Reset progress.
- Sixteen reading entries were added: four each for rhymes, synonyms, antonyms, and short-story understanding. Addition and subtraction stories each have four prompt variations.
- Nine additional regressions cover explanation completeness, worked math, paused rewards, assisted answers across resume, learning persistence and clearing, malformed records, and story variations. The six browser journeys exercise explanation mode on alternating stops, explanation audio, the parent switch and the learning summary after replay, while completing all 84 stops.
- Fixed parent-selected grades remain in place. Adaptive difficulty, new interaction formats, deeper character abilities, child profiles and hosted offline launch await the user's choices.
