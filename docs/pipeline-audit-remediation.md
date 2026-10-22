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

## Operational fixes included
- Controller has one production scheduler (the Cloudflare Worker) plus manual workflow dispatch, rather than overlapping GitHub cron and Worker polling.
- Per-issue run names let separate issues develop concurrently; one busy issue no longer blocks unrelated work.
- Recovery uses GitHub Actions failed runs for the current workflow commit, rather than permanent v2/v3 markers embedded in issue comments.
- The Developer failure handler preserves QA & Review when a failure occurs after entering QA.
- A pushed implementation branch with no PR gets an automated PR recovery attempt.
- QA can reuse a completed exact-SHA candidate and immutable preview receipt without rerunning its expensive test suite.
- The Developer and agent PR checks avoid duplicated comprehensive browser tests; QA is the full feature gate.
- Static lifecycle/release tests run on PRs to prevent regression.

## Unresolved blockers — do not treat the system as validated
1. **Git history:** uat was 174 commits behind main and one ahead. Its sole extra commit changes tests.yml. Synchronization PR #79 (main → uat) is open and must be refreshed after PR #78 is merged. Never force-push uat.
2. **Real UAT preview:** A candidate-specific Cloudflare worker deployment is configured, but its first production-equivalent preview has not run successfully, so domain provisioning and offline usability are unverified.
3. **Separate reviewer identity:** REVIEWER_GITHUB_TOKEN has to belong to a second authorized GitHub identity. Its presence and functional permissions have not been verified. Without it, the system fails closed.
4. **Acceptance UX:** The owner must comment `UAT-ACCEPTED: #<issue> <exact-40-character-merge-SHA>` and move the card to Done. Owner-specific board transition audit is not available from the current workflow; this extra receipt is an intentional safety gate, not yet the ideal board-only interaction.
5. **UAT correction flow:** The historical title-based correction PR detection can misidentify work and doesn't fully orchestrate a fresh correction branch. Must replace with issue-linked metadata and a coherent rejected-UAT stage before claiming that recovery path works automatically.
6. **Project built-in automations:** They can close issues or move cards to Done; project automation settings are not verifiable from repo contents. Production is protected by exact-SHA owner acceptance but board status still needs governance validation.
7. **End-to-end proof:** No successful first run with the new changes. PR #78 must pass checks before merge, and first UAT preview and accepted production promotion must be witnessed.

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
