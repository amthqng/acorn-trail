#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?Missing GH_TOKEN}"
: "${PROJECT_TOKEN:?Missing PROJECT_TOKEN}"
: "${GITHUB_REPOSITORY:?Missing GITHUB_REPOSITORY}"
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
query='query($login:String!,$number:Int!,$cursor:String){user(login:$login){projectV2(number:$number){items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{number state repository{nameWithOwner}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
prs="$(gh pr list --repo "$GITHUB_REPOSITORY" --state all --limit 300 --json number,state,headRefName,baseRefName,createdAt)"
cursor=""
while :; do
  args=(-f query="$query" -f login="$owner" -F number="$number")
  [ -z "$cursor" ] || args+=(-f cursor="$cursor")
  page="$(GH_TOKEN="$PROJECT_TOKEN" gh api graphql "${args[@]}")"
  jq -e '.data.user.projectV2 != null' <<< "$page" >/dev/null || { echo "::error::Unable to read project board"; exit 1; }
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    issue="$(jq -r '.number' <<< "$row")"
    state="$(jq -r '.state' <<< "$row")"
    status="$(jq -r '.status // empty' <<< "$row")"
    comments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$issue/comments?per_page=100" | jq -s add)"
    rejected="$(jq -c --arg owner "$owner" '[to_entries[] | select(.value.user.login==$owner and ((.value.body // "")|test("UAT[[:space:]]*REJECTED";"i")))] | last // empty' <<< "$comments")"
    [ -n "$rejected" ] || continue
    rejected_at="$(jq -r '.value.created_at' <<< "$rejected")"
    reject_index="$(jq -r '.key' <<< "$rejected")"
    # A fresh UAT receipt after the latest rejection is a new candidate, not
    # the old rejected build. Leave its stage to the normal QA/UAT workflow.
    latest_candidate="$(jq -r --arg issue "$issue" '[to_entries[] | select((.value.body // "")|contains("UAT-CANDIDATE: #"+$issue+" ")) | .key] | last // -1' <<< "$comments")"
    [ "$latest_candidate" -le "$reject_index" ] || continue
    prefix="agents/issue-$issue-correction-"
    has_correction="$(jq -r --arg prefix "$prefix" --arg when "$rejected_at" '[.[] | select(.baseRefName=="uat" and (.headRefName|startswith($prefix)) and (.createdAt>$when) and (.state=="OPEN" or .state=="MERGED"))] | length' <<< "$prs")"
    target="In Development"
    if [ "$has_correction" -gt 0 ]; then target="QA & Review"; fi
    if [ "$state" = "CLOSED" ]; then
      echo "::warning::Reopening #$issue: owner rejected its latest UAT candidate; issue is not complete."
      gh issue reopen "$issue" --repo "$GITHUB_REPOSITORY"
    fi
    if [ "$status" != "$target" ] || [ "$state" = "CLOSED" ]; then
      echo "::notice::Preserving rejected UAT issue #$issue at $target."
      PROJECT_OWNER="$owner" PROJECT_NUMBER="$number" PROJECT_STATUS="$target" GH_TOKEN="$PROJECT_TOKEN" bash scripts/add-issue-to-project.sh "https://github.com/$GITHUB_REPOSITORY/issues/$issue"
    fi
  done < <(jq -c --arg repo "$GITHUB_REPOSITORY" '.data.user.projectV2.items.nodes[]? | select(.content.repository.nameWithOwner==$repo) | select(.fieldValueByName.name!="Released") | {number:.content.number,state:.content.state,status:.fieldValueByName.name}' <<< "$page")
  [ "$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage // false' <<< "$page")" = true ] || break
  cursor="$(jq -r '.data.user.projectV2.items.pageInfo.endCursor // empty' <<< "$page")"
  test -n "$cursor"
done
