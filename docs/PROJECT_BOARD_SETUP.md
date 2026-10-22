# GitHub Projects status integration

Board: https://github.com/users/amthqng/projects/2

**Current capability:** The proactive discovery Action creates separate Issues and adds each to the board with Status = **Awaiting Approval**, assuming a Projects credential is configured. This does not auto-approve development, change older issues, or move items on manual approval/UAT.

## One-time setup
1. In GitHub personal settings, create a classic PAT with `project` scope (and repository access appropriate for your account), or use an equivalent GitHub App credential authorized to update this user-owned Project. Never put credentials in files or issues.
2. In `amthqng/acorn-trail` → Settings → Secrets and variables → Actions, add repository secret **PROJECTS_TOKEN** containing the token.
3. Confirm your board has a single-select **Status** field with an **Awaiting Approval** option. If it is instead named something else, rename the option in your board or update `PROJECT_STATUS` in the workflow.
4. Merge the PR and run **Proactive feature discovery** on `main`.

The workflow retains the default `GITHUB_TOKEN` solely to create Issues. Only the helper command receives PROJECTS_TOKEN through its `GH_TOKEN` environment variable. If the secret is missing or insufficient, each issue is still created, with a GitHub Actions warning about the unsynced project card. The project helper expects GitHub CLI and jq on the Ubuntu Actions runner.

## Safety
- Agent suggestions are unapproved discovery candidates.
- Board synchronization does not trigger coding or deployment.
- Product owner approval for development and UAT acceptance are future explicit, auditable automation gates.
