# Kanban-driven feature discovery

The product owner can create an issue in **Ideas**, then move it to **Discovery** in the [Acorn Trail board](https://github.com/users/amthqng/projects/2).

The scheduled **Kanban discovery watcher** checks the personal GitHub Project approximately every five minutes (GitHub schedules may be delayed). It reads issues currently in Discovery, runs User Research then Education using the existing read-only `discover-issue.ts` orchestrator, posts the report as an issue comment, and moves the card to **Awaiting Approval**. A manual Run workflow trigger also permits immediate processing.

Requires repository Actions secrets `PROJECTS_TOKEN` (user-project access) and `OPENAI_API_KEY`. No new webhook service is required.

## Gates and failure behavior
- Only open issues in `amthqng/acorn-trail` currently in **Discovery** are considered.
- A previously posted `<!-- acorn-feature-discovery -->` comment prevents re-running research; if moving the card fails, the next scan retries the status change.
- The watcher is serialized via GitHub Actions concurrency.
- The watcher's report does **not** authorize development.
- If a run fails before its report is posted, the issue remains in Discovery for a later retry. Inspect GitHub Actions logs for an underlying failure.
- Proactively generated feature issues already have research and should be placed into Awaiting Approval by their own workflow, not by the watcher.

## Current limit
This is polling, not instant event delivery. Scheduled runs may be delayed or disabled by GitHub policy. The workflow processes all matching issues sequentially; high backlog volumes may require a bounded queue and retry policy later.
