# Acorn Trail QA pass, 10 October 2026

Work branch: `qa/offline-gameplay`. Base: `4c4a973ca7c23809499ff11d306f225a40ecdd66`.

## Verified results

The original suite had 15 passes and one failure. That failure was a test assumption: alternate regions intentionally begin with reading. The corrected regression follows each region's configured subject sequence.

The gameplay stabilization suite passed **40 Node regression tests and six complete browser journeys** in GitHub Actions. Hosted offline coverage brought this to **43 Node tests and nine browser checks**; adaptive practice brought the Node suite to **52 tests**, and question variety below expands it to **60 tests**. The browser matrix is Chromium and WebKit at 390×844, 320×568 and 844×390, with real touch interactions. Each journey completes all 84 stops, for **504 browser stop completions** in the final run.

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

The game remains a single self-contained HTML file of approximately **384 KB**, with no new runtime dependencies and the same four-choice gameplay. Optional answer explanations add a parent-controlled pause after a correct answer. Playwright is developer-only QA tooling installed by the Actions workflow.

## Practical limits

No failures remain in the automated suite. Physical iPhone hardware, native Safari safe-area rendering, and the sound of OS speech voices were not tested. Read-aloud availability depends on installed browser/OS voices; audio-control behavior was tested.

Chromium runs the saved HTML directly with its browser context offline, including reloads. WebKit's offline emulation rejects navigation before document loading, so its tests supply the identical HTML through an in-memory local route, then switch offline for gameplay; the locally supplied document is reinjected for reload checks. No game asset or backend is fetched externally.

A downloaded HTML has no external runtime asset requirements. Hosted offline reopening now uses the small service worker described below.

The stabilization fixes and head-only character artwork are merged into `main`. The learning improvements passed the QA branch checks and are merged into `main`.

## Learning improvements, 10 October 2026

- Every new question includes a worked math explanation or reading rationale. Help after two wrong choices explains the answer. Older saved questions retain a compatible fallback explanation.
- Parents can enable “Pause to explain answers”. It is off by default, preserving automatic progression. When enabled, Continue advances once, with optional “Hear why” audio. Resets cancel a paused review; resume never awards a completed question again.
- Grown-up Settings contains a local learning summary by subject and skill, with completed puzzles, correct first choices without hints, hint use, and wrong choices on completed puzzles. The record starts with this update and does not infer earlier performance. Replay retains it; parents can clear it separately, or clear everything with Reset progress.
- Sixteen reading entries were added: four each for rhymes, synonyms, antonyms, and short-story understanding. Addition and subtraction stories each have four prompt variations.
- Nine additional regressions cover explanation completeness, worked math, paused rewards, assisted answers across resume, learning persistence and clearing, malformed records, and story variations. The six browser journeys exercise explanation mode on alternating stops, explanation audio, the parent switch and the learning summary after replay, while completing all 84 stops.
- Fixed parent-selected grades remain in place. New interaction formats, deeper character abilities, and child profiles await the user's choices. Optional adaptive practice is implemented below. Hosted offline launch is implemented below.

## Illustrated depth refresh, 10 October 2026

The visual refresh adds shaded paper and wood-like surfaces, inset highlights, softer contact shadows, warm sky lighting and a subtle background grain. Each region has lightweight foreground SVG details: flowers and apples, river stones and ripples, a ribbed pumpkin, spotted mushrooms, or night reflections. The campsite has firelight and tent seams. The map adds tree shadows and highlights, river-bank shading, a recessed trail and raised destination markers; its collection count is separated from the Meadow label.

The animal artwork stays head-only. Gameplay, question formats and saves are unchanged. White text on the new orange, green and purple button gradients uses darker tones for readability. New decoration is static, has no pointer interactions and is hidden from assistive technology. Everything remains inline, with no new runtime dependencies.

Validation includes all 40 Node regressions, six complete offline touch journeys, and a desktop browser layout/screenshot check covering all seven regions and their challenge screens. Representative phone, desktop, map, team-editor and answer-review screenshots were inspected. The desktop QA harness uses mouse clicks and freezes animation for stable screenshots.

Visual-refresh checks: https://github.com/amthqng/acorn-trail/actions/runs/38084762574


## Visible offline access and Home Screen installation, 10 October 2026

The opening screen now shows “Ready for offline play” only after the hosted worker confirms that the HTML, manifest and three install icons are cached. The visible “Install / offline help” button opens iPhone/iPad Home Screen instructions; browsers with a supported installation prompt use it. The panel fits narrow portrait and landscape screens, scrolls when needed and supports keyboard focus, Escape and touch. Downloaded HTML retains its embedded assets and displays “Downloaded game · plays offline”.

Gameplay remains in one approximately **391 KB HTML file**. Hosting adds a roughly 2.6 KB worker and 0.5 KB manifest, using the existing icon files and no runtime dependencies. The worker is scoped to this repository's path. Navigations try the network, with a four-second timeout and cached fallback; successful HTML updates refresh the saved copy. Worker updates wait for the visible Update game button, which checkpoints progress before reloading. Cache repair can restore missing files online, failed installation cannot claim readiness, and activation leaves other apps' caches intact. Browser/installed-app saves stay local to the environment being used; the installation help explains reopening online after website data is cleared.

Validation: **43 Node regressions and nine browser checks**. The six phone journeys still complete all 84 stops each (504 completions); desktop layout checks cover all seven regions. Two additional hosted checks exercise real service workers at a repository subpath, initial readiness, offline reopening in a new tab, saved-question and wrong-attempt resume, cached icons/manifest, server failure fallback, new HTML retained offline, deliberate worker activation during saved gameplay, cache repair, unrelated cache preservation, failed initial download and successful retry. Installation help is checked with touch at 390×844, 320×568 and 844×390, with screenshots after animations settle.

Chromium uses Playwright's actual offline browser setting for hosted navigation. Playwright WebKit reports an internal navigation error with that setting before service-worker interception; its hosted check instead destroys server connections without sending any response bytes. The new tab must therefore obtain its document from the worker cache, and the test verifies that the unavailable server was contacted. This is distinct from the older in-memory document route used by the gameplay-only WebKit journeys. Physical iPhone Home Screen installation and Safari hardware remain unverified.

Maintenance: bump the worker's `shell-v1` cache name when changing the shell resources or caching strategy. HTML-only updates refresh through navigation; do not force worker activation while a child is playing. The cache prefix includes the app path so activation cannot clear another GitHub Pages app's cache.

Hosted-offline checks: https://github.com/amthqng/acorn-trail/actions/runs/38086379489


## Optional adaptive practice, 10 October 2026

Grown-up Settings now includes an accessible “Adaptive practice” switch, off by default, and a separate current status for math and reading. Switching it on starts both subjects at the existing grade/region challenge. Two consecutive completed puzzles in one subject with a hint or wrong choice select gentler practice; four consecutive first-try completions without hints restore the usual challenge. Interleaved puzzles in the other subject do not interrupt those runs. No timing or reading-audio use is treated as failure, and rewards, stickers and the 84-stop trail are unchanged.

The supported band lowers the existing math level or reading tier by one, clamped to the content floor; it never raises the existing grade/region ceiling. Smaller arithmetic and story quantities provide support at the lowest math level, and division uses smaller factors. Reading at its lowest tier retains the existing simplest bank. Selected math operations still apply. This is a practice-support rule, not a curriculum placement test or a claim of measured learning effectiveness.

Adjustments and partial subject runs persist locally across reload and replay. New questions carry the grade and adjustment revision they were generated with. Changing a grade resets only that subject; changing math operations resets math; switching the mode or clearing the learning record resets both. An existing question remains unchanged and is excluded from adaptation if its configuration was reset. A full progress reset also restores usual adaptive practice. Old saved questions without adaptation metadata still resume, but cannot retroactively train the model.

Nine new regressions cover opt-in behavior, completed-puzzle thresholds, separate subjects, interrupted runs, return to usual practice, grade bounds and generated question validity, selected operations, saved assisted answers, duplicate/pending completion recovery, stale questions after setting changes, replay, selective and full resets, and corrupted records. The six complete phone journeys retain two fixed-mode narrow-phone journeys and add four adaptive journeys in Chromium/WebKit portrait and landscape. These use real hint taps, resume assisted questions, observe both subjects entering gentler practice and independently returning to usual practice in the first two regions, verify the lower reading bank and math skill level in the Orchard, check the parent status and toggle, and finish all 84 stops. Total coverage remains nine browser checks, including desktop and both hosted offline/update checks.

Validation: **52 Node tests and nine browser checks**, with **504 stop completions** across the phone matrix. Gameplay remains a single HTML of approximately **395 KB**, with no new runtime dependency or shell change. Physical iPhone testing remains outside the automated coverage.

Adaptive checks: https://github.com/amthqng/acorn-trail/actions/runs/38087281916


## Persistent question variety, 10 October 2026

Eligible math skills and reading categories now come from shuffled selections, using each eligible skill before refilling. This reduces chance clusters while retaining the same grade, adaptive level, selected math operations, alternating subjects and 84-stop structure. Addition and subtraction are separate selections. Answer positions continue to shuffle independently.

Reading selections remember shown entries per category through reload, new trails, team changes and replay. A category uses every entry before recycling, and the cycle boundary avoids its previous entry. The active saved question is restored unchanged, without consuming another selection. Math remembers the latest 20 distinct mathematical question keys, treating swapped addition or multiplication operands as equivalent. Up to 16 candidate attempts avoid recent equivalents; for a tiny or exhausted pool, the oldest candidate encountered can be reused so selection always finishes. No backend, remote seed or new dependency is involved. Full Reset progress clears variety history; clearing the learning record retains it.

Twenty reading entries were appended, preserving existing bank indices: four each for rhymes, baby-animal names, word meanings, sentence completion and short-story comprehension. Every added entry has a checked explanation. Addition and subtraction stories now each have eight wording variants, and two-step math has four. These use the same generated quantities and correct arithmetic as before.

The content-bound checks also exposed and fixed an adaptive ceiling case: when Grade 3 was already beyond the highest available tier before clamping, the previous support offset could be cancelled out by that clamp. Support now lowers the already-clamped usual level, with tests requiring the full one-level reduction whenever a lower level exists.

Eight additional seeded regressions cover shuffled skill coverage, reading-bank exhaustion and cycle boundaries, persistence across reload/replay, math equivalence and recent-repeat avoidance, small pools and an unchanging RNG, malformed history recovery, recent math persistence, and reading cycle boundaries after selection-cache trimming. Existing regressions verify all new reading choices/explanations, arithmetic, grades and adaptive bounds. The six complete phone journeys also check reading uniqueness across a trail, exact question/history preservation on resume, and retained history after replay. Desktop layout and both hosted worker/offline/update checks remain in the suite.

Validation: **60 Node tests and nine browser checks**, including **504 phone stop completions**. Gameplay remains in one approximately **402 KB HTML file**, with no runtime dependency or service-worker change. Physical iPhone coverage remains unverified.

Question-variety checks: https://github.com/amthqng/acorn-trail/actions/runs/38089319834

## Character expressions and personalities, 11 October 2026

The existing head-only SVG artwork now supports happy, thoughtful and encouraging expressions for all 18 selectable animals. Correct answers and the finale show happy faces; hints and answer reveals show thoughtful faces; wrong choices show encouragement. Expressions are static, so they remain available with motion disabled without adding animation, images, fonts or network dependencies.

Biscuit's dog voice is enthusiastic, Aster's cat voice curious, Tansy's mouse voice adventurous and Nutmeg's pig voice reassuring. Other animals use their chosen role to select a voice. Challenge greetings, success and retry feedback, helper introductions and the leader's story greeting use these voices and respect customized names. Hints retain the original puzzle clue and answer reveals retain the worked explanation. Grades, question selection, rewards and adaptive rules are unchanged.

The active question saves its greeting and reaction. Resume restores them without generating a replacement puzzle or awarding progress; new puzzles begin with the usual expression. Older saves acquire a greeting, invalid expression metadata recovers, and displayed character text is escaped. Happy reward expressions are transient and never saved as an unanswered puzzle.

Validation: **64 Node regressions and nine browser checks passed**, including **504 stop completions** across Chromium and WebKit at 390×844, 320×568 and 844×390. New assertions cover reaction changes, customized dialogue, exact greeting/reaction restoration, one-time rewards and reset behavior. Existing checks cover team editing, all seven regions, learning records, stickers, adaptive difficulty and hosted offline/update recovery. Reviewed the all-animal expression sheet, portrait hint and success screens, and narrow-phone encouragement screenshot. Narrow screens scroll vertically to keep controls reachable; no horizontal overflow was detected. Physical iPhone/Home Screen testing remains unverified.

Gameplay remains one approximately **406 KB HTML file**, with no service-worker or runtime dependency change. Accessories, friendship progression and role-specific hint mechanics are future work.

Character checks: https://github.com/amthqng/acorn-trail/actions/runs/38115858874

## Tap matching and ordering activities, 11 October 2026

The fifth and sixth stops of each region can now introduce a short tap activity while retaining the alternating subjects, 84-stop trail, grade settings and one-acorn-per-stop rewards. Other stops keep the existing answer format. Number activities use two equation cards at the lowest supported math level and three at later levels. Children solve the cards and tap them from the smallest result to the largest; each card uses the original question's enabled operation and grade/adaptive level. Word stories retain their existing format. Bounded generation falls back to the existing question if distinct suitable cards cannot be generated. Every displayed equation is included in recent-question history.

Reading activities match animal/baby names, rhymes, similar meanings, plurals, opposites, contractions or word beginnings within the selected tier. Children choose a left card and its partner on the right, in any pair order. Easier tiers use two pairs; later tiers use three. Duplicate answers, shared rhyme families and interchangeable synonym groups are excluded. Additional displayed reading entries are remembered in the variety history. Sentence, compound-word and comprehension questions retain their original format, avoiding ambiguous or overly long matching boards.

The seven regions supply context for the activity prompts: meadow flower tags, orchard basket labels, riverside stepping stones, pumpkin lanterns, woodland leaves, bridge lanterns and gathering tables at the Great Oak. No dragging, time limit, external asset or runtime dependency is required. Native buttons support touch and keyboard; selection has an accessible pressed state, completed cards have check marks, feedback is announced, and keyboard focus remains on the activity board after rendering. Ordering includes Undo last card.

A partial activity saves its exact cards, completed pairs/order, current selection and cumulative wrong choices. Resume restores this state without replacing the puzzle or awarding progress. Only final completion records one learning result, trains adaptive support once and grants one acorn. Hints retain the category clue; guided answers highlight and explain the next card while requiring the child to tap it. Invalid formats, impossible progress, duplicate cards and incorrect saved equation values are rejected. Older multiple-choice saves remain supported.

Validation: **71 Node regressions and 11 browser checks passed**, including **504 stop completions** in the six Chromium/WebKit touch journeys at 390×844, 320×568 and 844×390. Both engines have additional narrow-phone checks for partial matching/ordering resume, incorrect choices, guided reveals, ordering undo, keyboard operation, minimum 44-pixel touch controls, offline operation and one-time rewards. Existing hosted cache, recovery and update checks also passed. Reviewed ordering, resumed guided matching and ordering, and landscape matching screenshots; no horizontal overflow was detected. Physical iPhone/Home Screen testing remains unverified.

Gameplay remains one approximately **419 KB HTML file**, with no service-worker or runtime dependency change. Cooperative character puzzles, campsite choices and more region-specific story content remain future work.

Tap activity checks: https://github.com/amthqng/acorn-trail/actions/runs/38117161693
