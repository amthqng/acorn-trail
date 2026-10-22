# Acorn Trail pipeline: audit remediation record
Date: 2026-10-22

## Required lifecycle
Ideas → Discovery → Awaiting Approval → Ready for Development → In Development → QA & Review → Ready for UAT → Done → main / Cloudflare.

Owner approves discovery and UAT. Automation handles the rest. Never use Done alone as authority for a release.

## Implemented on this branch
- Developer workflow can create its feature PR targeting uat but cannot merge it or set Ready for UAT.
- Central QA validates the browser/offline suite, requires independent GitHub approval with REVIEWER_GITHUB_TOKEN, merges into uat, records the exact candidate merge SHA, publishes a separate Cloudflare UAT preview, and only afterward sets Ready for UAT.
- Production release requires an issue-specific candidate receipt and owner acceptance naming the exact candidate SHA, in addition to Done, matching PR, a serial one-feature promotion gate, and safe fast-forward promotion with deploy-retry support.
- Removed temporary OpenAI connection smoke test and manual discovery-card synchronization.
- Retained proactive discovery as optional; retaining it does not affect normal pipeline operation.

## Unresolved blockers — do not treat the system as validated
1. **Git history:** uat was 174 commits behind main and one ahead (GitHub compare on 2026-10-22). The UAT-only commit modifies .github/workflows/tests.yml. The baseline-preserving synchronization PR #79 (main → uat) is open; it must be verified and merged after this remediation PR. Never force-push uat.
2. **UAT preview:** Per-issue and per-commit immutable Cloudflare worker preview config is added, but successful workers.dev provisioning, URL extraction, service-worker behavior, and availability have not been verified. The workflow fails closed if it cannot obtain a URL.
3. **Reviewer token:** REVIEWER_GITHUB_TOKEN must belong to an authorized separate identity and its permissions must actually work. Unverified.
4. **Real acceptance:** The owner must comment `UAT-ACCEPTED: #<issue> <exact-40-character-merge-SHA>` and put the card in Done. The comment is an interim fail-closed release authorization; this is not yet the desired single board action.
5. **Test deduplication:** For agent implementation PRs, the comprehensive browser suite now runs only in QA; Developer runs fast unit checks and tests.yml skips its browser job for agent PRs. General-purpose PRs continue using tests.yml. Confirm timing and required branch-protection contexts.
6. **Retries:** The recovery controller now creates a missing PR for a pushed implementation branch. Bounded Developer retries can still exhaust without an automatic code-repair escalation, and board exceptions are not yet a reliable self-healing loop.
7. **Proactive discovery:** opportunity-discovery.yml intentionally retained as a manually invoked optional feature generator; decide separately whether this feature is wanted.
8. **No live end-to-end validation completed.** Do not merge as if production safety and usability have already been proved.

## Safety invariants to validate before end-to-end test
- A PR targeting main is never auto-merged by Developer or QA.
- An unapproved UAT candidate never reaches main or Cloudflare production.
- A rejected feature remains out of Done and can be fixed without moving backward through product approval.
- Preview URL loads the candidate, including offline behavior on a mobile browser.
- Distinct owner acceptance binds the exact candidate SHA.
- The publisher cannot deploy other unaccepted UAT changes.
- Restarting a failed job is idempotent and doesn't falsely move cards to Ready for UAT.

## Change request ordering
1. PR #78 must pass GitHub checks before merge to main.
2. PR #79 must then refresh main → uat and pass checks before merging to preserve the original UAT-only workflow change.
3. Verify the first isolated preview build and first owner-accepted promotion using a new test feature. Treat status updates alone as insufficient proof.
