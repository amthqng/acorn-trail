#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?Missing repository token}"
: "${PROJECT_TOKEN:?Missing Projects token}"
: "${GITHUB_REPOSITORY:?Missing repository}"

owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
query='query($login:String!,$number:Int!,$cursor:String){user(login:$login){projectV2(number:$number){items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{number state repository{nameWithOwner}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
prs="$(gh pr list --repo "$GITHUB_REPOSITORY" --state merged --limit 500 --json number,headRefName,baseRefName,mergeCommit)"
cursor=""
while :; do
  args=(-f query="$query" -f login="$owner" -F number="$number")
  [ -z "$cursor" ] || args+=(-f cursor="$cursor")
  page="$(GH_TOKEN="$PROJECT_TOKEN" gh api graphql "${args[@]}")"
  jq -e '.data.user.projectV2 != null' <<< "$page" >/dev/null || { echo "::error::Cannot read project board"; exit 1; }

  while IFS= read -r row; do
    [ -n "$row" ] || continue
    issue="$(jq -r '.number' <<< "$row")"
    state="$(jq -r '.state' <<< "$row")"
    status="$(jq -r '.status // empty' <<< "$row")"
    prefix="agents/issue-$issue"
    pr="$(jq -c --arg prefix "$prefix" '[.[] | select(.baseRefName=="uat") | select(.headRefName==$prefix or (.headRefName|startswith($prefix+"-correction-")))] | sort_by(.number) | last // empty' <<< "$prs")"
    [ -n "$pr" ] || continue

    # A merged, *rejected* candidate is never an authority to restore UAT.
    # The dedicated owner-rejection controller handles this card later in the
    # same board job, without bouncing Discovery -> UAT -> In Development.
    issue_comments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$issue/comments?per_page=100" | jq -s add)"
    rejected_index="$(jq -r --arg owner "$owner" '[to_entries[] | select(.value.user.login==$owner and ((.value.body // "")|test("UAT[[:space:]]*REJECTED";"i"))) | .key] | last // -1' <<< "$issue_comments")"
    candidate_index="$(jq -r --arg issue "$issue" '[to_entries[] | select((.value.body // "")|contains("UAT-CANDIDATE: #"+$issue+" ")) | .key] | last // -1' <<< "$issue_comments")"
    if [ "$rejected_index" -gt "$candidate_index" ]; then
      echo "::notice::Issue #$issue has a rejected UAT candidate. Leaving its recovery to enforce-rejected-uat.sh; skipping stale UAT promotion."
      continue
    fi

    desired="$status"
    if [ "$status" = "Discovery" ]; then
      desired="QA & Review"
      # A post-reopen Project automation may reset an issue from UAT to
      # Discovery. Restore Ready for UAT only with the exact QA receipt.
      sha="$(jq -r '.mergeCommit.oid // empty' <<< "$pr")"
      prnum="$(jq -r '.number' <<< "$pr")"
      if [ -n "$sha" ]; then
        comments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$issue/comments?per_page=100" --jq '.[].body')"
        if grep -Fq "UAT-CANDIDATE: #$issue $sha PR #$prnum" <<< "$comments" && grep -Fq "acorn-trail-uat-$issue-${sha:0:12}" <<< "$comments"; then
          desired="Ready for UAT"
        fi
      fi
    fi

    # An issue merged into UAT is not complete. Keep it OPEN during QA/UAT.
    # GitHub's automatic 'Item reopened -> Discovery' project rule can fire
    # asynchronously, so Discovery is also repaired on subsequent passes.
    if [ "$state" = "CLOSED" ]; then
      echo "::notice::Reopening unreleased issue #$issue with merged UAT candidate (card $status)."
      gh issue reopen "$issue" --repo "$GITHUB_REPOSITORY"
    fi
    if [ "$desired" != "$status" ] || [ "$state" = "CLOSED" ]; then
      echo "::notice::Restoring #$issue to $desired; not Done or Released."
      PROJECT_OWNER="$owner" PROJECT_NUMBER="$number" PROJECT_STATUS="$desired" GH_TOKEN="$PROJECT_TOKEN" bash scripts/add-issue-to-project.sh "https://github.com/$GITHUB_REPOSITORY/issues/$issue"
    fi
  done < <(jq -c --arg repo "$GITHUB_REPOSITORY" '.data.user.projectV2.items.nodes[]? | select(.content.repository.nameWithOwner==$repo) | select((.content.state=="CLOSED" and (.fieldValueByName.name=="Discovery" or .fieldValueByName.name=="QA & Review" or .fieldValueByName.name=="Ready for UAT")) or (.content.state=="OPEN" and .fieldValueByName.name=="Discovery")) | {number:.content.number,state:.content.state,status:.fieldValueByName.name}' <<< "$page")

  [ "$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage // false' <<< "$page")" = "true" ] || break
  cursor="$(jq -r '.data.user.projectV2.items.pageInfo.endCursor // empty' <<< "$page")"
  [ -n "$cursor" ] || exit 1
done
