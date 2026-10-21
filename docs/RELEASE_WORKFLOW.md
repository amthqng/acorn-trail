# Acorn Trail: Kanban to Cloudflare release

## Active workflows

- **Kanban discovery watcher**: Discovery → Awaiting Approval.
- **Proactive feature discovery**: optional owner-triggered product ideas.
- **Ready for Development intake**: UX and Tech Lead assessments, no owner escalation for routine decorative choices.
- **Dispatch approved implementations**: runs implementation for latest READY issue.
- **Implement approved feature**: moves issue to In Development, attempts small code change, runs browser tests and independent review, creates draft PR on success.
- **Release accepted UAT to Cloudflare**: polls Done cards and attempts production publish only after a merged PR tied to the issue.

**Sync existing discovery cards** remains as a manual repair utility. The original architecture, child review, developer-proposal and manually triggered feature-discovery workflows are retired in this change.

## UAT and release contract

The product owner may signal UAT acceptance by moving a card to **Done**, but that alone cannot publish arbitrary code. The release job additionally requires:
1. Issue's implementation PR originates from `agents/issue-N` and has been merged.
2. The merged PR's commit is exactly `main` HEAD. This deliberately blocks release if other changes have arrived since acceptance.
3. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub Actions secrets are configured, with least-privilege Cloudflare Workers edit permissions.
4. GitHub `production` environment has been configured with any desired reviewer approval rules and environment protections.

The job packages **only** `index.html`, `sw.js`, `manifest.webmanifest`, and the three icon files into a temporary directory; it never uploads GitHub workflows, source scripts, secrets or tests as static assets. A successful release posts a receipt comment to the issue, preventing repeats.

**Important unfinished work:** current implementation produces a draft PR, not a deployed UAT candidate. A separate preview/merge gate is needed before the user can test the exact release candidate. Do not mark items Done until that candidate has been verified. The release job is configured on a schedule but will not deploy unmerged issue PRs.

## Recovery

If a dispatch previously wrote `<!-- acorn-implementation-dispatched -->` and failed before branch creation, the dispatcher will skip retries. Recovery must be addressed before relying on fully unattended work. Likewise, the release job blocks on a new HEAD after acceptance; review and re-accept the intended release instead of bypassing its guard.

## Planned simplification

Consolidate intake and dispatch into a single event/scheduled controller with durable attempt states, bounded retry/backoff, one authoritative card-status transition service, a preview/UAT workflow and production deployment receipt.
