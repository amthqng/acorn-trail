# Reliable Acorn Trail controller trigger

The personal GitHub Project #2 is processed by the **existing** `.github/workflows/product-pipeline.yml` controller. GitHub's scheduled run has failed to appear despite successful manual runs. This isolated Cloudflare cron Worker calls the **existing** workflow_dispatch endpoint; it does not run agents or deploy the game.

## One-time setup (repo owner)

1. Create a **fine-grained GitHub personal access token** for only `amthqng/acorn-trail`, with repository **Actions: Read and write** permissions. Do not commit it.
2. In an authenticated Cloudflare environment, run:
   `npx wrangler secret put GITHUB_DISPATCH_TOKEN --config wrangler.controller.jsonc`
   Enter that token when prompted.
3. Deploy this separate scheduled Worker with
   `npx wrangler deploy --config wrangler.controller.jsonc`.
4. Verify its Cron Triggers are enabled and inspect Cloudflare logs for
   `Dispatched Acorn Trail product controller.` GitHub Actions should show
   `workflow_dispatch` runs. Confirm Issue #60 advances normally.
5. Once verified, remove the non-working GitHub `schedule` entry from
   `product-pipeline.yml` to avoid duplicate scheduler signals.

This Worker has **no HTTP endpoint** and does not handle source code or Cloudflare game releases. It uses an isolated Wrangler config and needs only a GitHub Actions dispatch token; the existing GitHub workflow retains board-access and OpenAI secrets.

A GitHub personal Project cannot use the org-scoped Projects v2 item webhook documented by GitHub. This external polling trigger is therefore intentionally small. It is still an **interval** trigger, not instantaneous board-change detection; normal latency is up to one interval plus run time.

## Diagnostics
- Missing token: Worker logs an explicit error.
- API refusal: Worker throws with GitHub response status.
- Successful dispatch: GitHub returns HTTP 204.
- If Github Actions runs but board stage stays unchanged, investigate
  the `board` and relevant stage job instead of modifying Cron.
