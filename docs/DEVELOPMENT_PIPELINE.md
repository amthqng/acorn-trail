# Automated development pipeline (guarded pilot)

GitHub Projects board: https://github.com/users/amthqng/projects/2

1. Move a clear, scoped issue into **Ready for Development**. That is permission to attempt implementing *that issue only*.
2. The existing **Ready for Development intake** workflow runs the Tech Lead and comments `## Tech Lead intake: READY` or `NEEDS_CLARIFICATION`. Only READY may proceed.
3. **Dispatch approved implementations** checks the board, avoids repeated dispatch and starts **Implement approved feature** for READY issues.
4. The Developer Agent makes at most one uniquely matching, small, source-grounded change to `index.html` on a dedicated feature branch.
5. Browser regression tests execute using Playwright Chromium and WebKit on the modified game.
6. The independent Reviewer examines the actual changed source and prepares a plain-language UAT checklist.
7. Only passing work opens a **draft PR**, linked to its issue. Failing tests, BLOCKED implementations and rejected reviews do not produce a PR.

## Human and deployment gates

**No automated merges, deployment, or production release.** The PR is intentionally a draft. The product owner is not required to review code; UAT should take place against a safe preview or release candidate, once that separate workflow is available. The draft PR contains UAT notes and reviewer comments, but is not proof that a deployed build has passed UAT.

## Known limitations

- This is a deliberately small-change pilot, not a reliable autonomous developer for large features. It supports one exact-string replacement per issue and deliberately blocks uncertain or broad work.
- The review agent verdict is not an independent GitHub branch-protection approval; it is an automated textual review, not a security certification.
- No automated correction loop yet. Failed work requires triage or a rerun.
- The issue remains in Ready for Development until a later release-candidate workflow is added. It does not move to Ready for UAT because nothing has been merged or previewed for UAT.
- Scheduled workflows may be delayed.
- The implementation-dispatch marker prevents duplicate runs; reset of a failed dispatch requires explicit operator action.
- The base Playwright suite can take time and might require modifications to the runner before it passes. Validate the full flow on a low-risk issue before use.
