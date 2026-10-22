# Acorn Trail — post-PR #81 pipeline audit
2026-10-22

## Assessment
**Conditional / not end-to-end validated.** The main safety architecture is substantially improved: Developer PR to uat, QA tests and independently approves, isolated candidate preview, owner SHA-specific UAT acceptance, then gated promotion to main and Cloudflare. Product owner should not have to move cards except approve scope, reject UAT, and accept UAT.

## Critical defects addressed by PR #82
1. Main and uat diverged again (uat three ahead, main two ahead at audit), blocking fast-forward production promotion. Controller now merges latest main into uat before it reads the board or dispatches workers. Conflicts fail closed. Never force pushes.
2. PR #81 ran comprehensive QA inside an image that had previously produced a WebKit offline cache regression during CI. It also used gh CLI without installing it in that image. QA now uses the native GitHub runner with cached Playwright binaries and full Chromium/WebKit/offline coverage; GitHub CLI is supplied by the runner.
3. Added workflow invariant tests for both regressions.

## Workflow inventory / simplification
- product-pipeline.yml — keep: board controller, intake/discovery, recovery, QA/UAT handoff, publish dispatch, branch-baseline sync.
- implement-approved.yml — keep: AI Developer, fast checks and feature PR to uat; cannot merge to main.
- tests.yml — keep: fast checks for every PR, full browser tests only for game/browser-test changes; full QA still before UAT.
- release-cloudflare.yml — keep: requires exact owner acceptance, candidate/PR and independent approval, then promotes main and deploys production.
- opportunity-discovery.yml — optional, manual feature suggestions. Can be deleted if this feature is no longer desired.
- Cloudflare board-trigger Worker — keep as sole recurring board trigger; GitHub schedule intentionally removed.
- Obsolete OpenAI connection smoke test and manual discovery sync workflows were already removed.

## Remaining risk / validation still required
1. **No successful complete UAT-to-production trial** observed. Verify an actual feature implementation, QA approval, real preview URL and offline behavior, SHA-matched owner UAT acceptance, main promotion, Cloudflare deployment and receipt.
2. **Reviewer secret and identity** must be tested in a live QA job; a separate account token is required; AI approval alone is not the same as independent human judgment.
3. **Approval UX** currently requires both Done and an owner comment containing `UAT-ACCEPTED: #<issue> <exact candidate SHA>`; the board alone is not sufficient. Simplifying this needs reliable audit of the actor moving the card.
4. **Feature isolation** production checks issue-associated UAT game assets but workflow/configuration changes can also be carried by a UAT fast-forward. Consider separate production PR from an immutable tested artifact rather than fast-forwarding all UAT history if stronger isolation is required.
5. **Recovery and source control** bound retries can exhaust, and some PR lookups only consider the last 100–200 items; implement a per-issue durable failure state and targeted API lookup if scaling.
6. **Cloudflare workers.dev availability** and first preview URL extraction are untested. Preview deployment fails closed until a usable URL is produced.
7. **Project built-in status automations** are outside repository code; check that Done cannot be set/closed by automation without UAT. Exact owner acceptance blocks unintended production release.
8. **QA performance** native browser installation can take time on a cold runner; browser cache should improve warm runs. Do not trade offline coverage for speed.

## Release readiness gate
Do not call pipeline production-validated until a brand-new issue travels all board states and production serves exactly the version accepted in UAT. Never merge a failed or unchecked fix solely to advance status.
