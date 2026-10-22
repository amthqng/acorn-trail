# AI orchestration experiment

This directory is reserved for the code that invokes and coordinates AI agents. The current milestone intentionally stores **agent role definitions only** in `../agents/`.

## Proposed initial workflow
1. An execution host reads the current repository and runs the Architecture Analyst in read-only mode.
2. A separate review pass checks the analyst's evidence and recommendation.
3. A deterministic controller either requests one revision or presents both results to the product owner.
4. The product owner decides whether to authorize a separate implementation branch and PR.

## Explicit boundaries
- Markdown agent definitions do not run automatically.
- No GitHub Action, MCP server, model API calls, or scheduled execution is configured yet.
- Do not put API keys in this repository. If a future GitHub Action is approved, use repository secrets, minimal permissions, pinned dependencies, cost limits, and human approval for mutations.
- All analysis should identify inspected commit SHA; never assume the working tree is the release.

## First evaluation
Compare (A) a single architecture analysis against (B) architecture analysis plus independent reviewer on the same commit. Score source-grounded correctness, actionable findings, runtime, and model cost. Only add more agents if measured value justifies them.
