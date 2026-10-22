# Acorn Trail: One board-driven pipeline

## The product owner's only gates
1. Move an issue to **Discovery** for UX/user research or straight to **Ready for Development** for a small approved change.
2. Test the generated UAT candidate once technical review and browser QA pass.
3. Move the issue from **Ready for UAT** to **Done** to explicitly authorize merge and Cloudflare production publishing.

## Active execution architecture

**Acorn Trail product pipeline** is the *only scheduled controller* (every 15 minutes).
It takes one read of Project #2 and coordinates Discovery, UX → Tech Lead intake,
implementation dispatch, and approved Done-item publishing. GitHub Projects is
authoritative. Issues are never considered approved merely because of an old
comment. Separate worker workflows exist only to handle different permissions
and production-environment approvals:

- **Implement approved feature**: accepts only a Ready for Development issue,
  moves the card to In Development, makes bounded source changes, moves it to QA &
  Review, runs Chromium/WebKit game and offline tests, and gets an independent
  AI technical-review verdict. The implementation PR is then submitted to a
  *separate GitHub reviewer identity* for an actual APPROVED review.
  Only after this approval does the worker upload the UAT HTML/assets package
  and move the issue to Ready for UAT.
- **Release accepted UAT to Cloudflare**: runs under the protected production
  environment only for Done cards. Checks that an issue-specific implementation
  PR has an actual APPROVED GitHub review from a non-Actions-bot identity,
  merges the approved PR if necessary, verifies the merged SHA is the current
  main HEAD, and deploys only the six public game assets. Posts a receipt to the issue.

**Proactive feature discovery** is owner-triggered, not scheduled.
**Sync existing discovery cards** remains manual emergency repair.

## Failure behavior

- Developer/test/review failure comments a link to the failed Actions run and
  returns the card to Ready for Development, not a false UAT state.
- The controller permits at most **two automatic dispatch attempts**. Exhausted
  attempts are visible as workflow warnings and issue comments. Human technical
  recovery is then needed; product owners need not inspect code.
- A missing independent reviewer token leaves the issue out of Ready for UAT.
- Production failure leaves a Done card without a publication receipt; the
  publisher retries on the next controller pass.
- Product Done status never bypasses PR review, merge protections, or an exact
  commit check. Concurrent merges can cause a safe stop, not an accidental
  release of unrelated changes.

## Setup required

- `OPENAI_API_KEY`: OpenAI agents.
- `PROJECTS_TOKEN`: GitHub Project v2 read/write token.
- `REVIEWER_GITHUB_TOKEN`: token from a distinct GitHub identity authorized
  to approve repository PRs. The same Actions bot cannot approve its own PR.
  GitHub branch protections should require the separate approval and QA.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`: Workers deployment credentials.
- GitHub **production** environment with desired deployment protection/reviewers.
  Do not disable environment protection to work around blocked deploys.

## Known limitations to validate before production

- The Developer is still a single-small-patch pilot; complex feature requests
  can return BLOCKED. A bounded correction loop beyond two attempts is not yet
  implemented.
- The UAT package is a GitHub Actions artifact, not a live Cloudflare preview
  deployment. The owner can download it and open the offline HTML, but a proper
  live preview/staging environment remains preferable.
- The first end-to-end run, PR approval, and Cloudflare publish are **not**
  verified yet. Validate on issue #41 before claiming production readiness.
- The current design treats *Done* as explicit publication authorization.
  Rejected UAT should return the card to Ready for Development, not Done.
- The automated development worker is subject to GitHub token/PR permission
  settings. Reviewers must inspect real code, not only agent narration.
