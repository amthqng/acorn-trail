#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?Missing repository token}"
: "${PROJECT_TOKEN:?Missing Projects token}"
: "${GITHUB_REPOSITORY:?Missing repository}"

owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
query='query($login:String!,$number:Int!,$cursor:String){user(login:$login){projectV2(number:$number){items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{number state repository{nameWithOwner}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
# A merged implementation can close its issue before UAT. GitHub may
# automatically move the card to Done, and an older controller could reopen
# it into Discovery. Recover the card without changing the issue's state.
prs="$(gh pr list --repo "$GITHUB_REPOSITORY" --state merged --limit 500 --json number,headRefName,baseRefName)"
cursor=""
while :; do
  args=(-f query="$query" -f login="$owner" -F number="$number")
  [ -z "$cursor" ] || args+=(-f cursor="$cursor")
  page="$(GH_TOKEN="$PROJECT_TOKEN" gh api graphql "${args[@]}")"
  jq -e '.data.user.projectV2 != null' <<< "$page" >/dev/null || { echo "::error::Cannot read project board"; exit 1; }

  while IFS= read -r issue; do
    [ -n "$issue" ] || continue
    prefix="agents/issue-$issue"
    if ! jq -e --arg prefix "$prefix" '[.[] | select(.baseRefName=="uat") | select(.headRefName==$prefix or (.headRefName|startswith($prefix+"-correction-")))] | length>0' <<< "$prs" >/dev/null; then
      continue
    fi
    echo "::warning::Issue #$issue closed and stuck in Discovery after merged UAT PR. Restoring QA without reopening issue."
    PROJECT_OWNER="$owner" PROJECT_NUMBER="$number" PROJECT_STATUS="QA & Review" GH_TOKEN="$PROJECT_TOKEN" bash scripts/add-issue-to-project.sh "https://github.com/$GITHUB_REPOSITORY/issues/$issue"
  done < <(jq -r --arg repo "$GITHUB_REPOSITORY" '.data.user.projectV2.items.nodes[]? | select(.content.repository.nameWithOwner==$repo and .content.state=="CLOSED" and .fieldValueByName.name=="Discovery") | .content.number' <<< "$page")

  [ "$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage // false' <<< "$page")" = "true" ] || break
  cursor="$(jq -r '.data.user.projectV2.items.pageInfo.endCursor // empty' <<< "$page")"
  [ -n "$cursor" ] || exit 1
done
