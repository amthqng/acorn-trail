# Acorn Trail product workflow

## Board columns (GitHub Projects)
1. **Ideas**: owner ideas or AI-generated discovery candidates; not approved work.
2. **Discovery**: User Research and Education examine the idea, cite source, risks, grade impact, alternatives, and proposed acceptance criteria.
3. **Awaiting product approval**: product owner chooses approve, reject, or request more evidence.
4. **Ready for development**: specific approved scope and testable acceptance criteria.
5. **In development**: Tech Lead design, Developer implementation on a feature branch and PR.
6. **QA and technical review**: automated regression, independent review, correction loop.
7. **Ready for UAT**: reviewer provides plain-language implementation summary and specific manual test scenarios.
8. **Done**: product owner accepts UAT and release is recorded.

## Gate rules
- Discovery suggestions are **not** approved development.
- AI source analysis is not equivalent to observing children or checking curriculum with an educator.
- Only a clearly identified approved issue may enter development.
- Agents must never expose child data; do not solicit identifiable information about children.
- Do not claim QA passed unless commands/results are attached or linked.
- A reviewer must inspect actual changes, not only the developer's description.
- Any automated merging requires explicit separate authorization and branch protection; approval of a feature is not permission to deploy production.
- Product owner reviews behavior in UAT, not code diffs. Rejected UAT returns to development.

## Feature issue checklist
- Problem and intended child experience
- Grade(s), educational objective and accessibility considerations
- Research and Education findings, with confidence and validation needs
- Alternatives and recommendation
- Product owner decision and date
- Acceptance criteria and regression coverage
- PR and CI evidence
- Reviewer implementation summary, known limitations and UAT steps
- UAT decision and release link

## Where automation lives
GitHub Actions launches jobs; TypeScript in `orchestration/` controls agent order and passes data between agents. Existing architecture, child-review and developer-handoff workflows are pilots, **not** an autonomous issue-to-release pipeline. Board transitions and future auto PR implementation must be added and verified separately.
