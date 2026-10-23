#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?Missing repository token}"
: "${PROJECT_TOKEN:?Missing Projects token}"
: "${GITHUB_REPOSITORY:?Missing repository}"

owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
query='query($login:String!,$number:Int!,$cursor:String){user(login:$login){projectV2(number:$number){items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{number state repository{nameWithOwner}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
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
    if [ "$state" = "CLOSED" ] && [ "$status" = "Released" ]; then continue; fi

    comments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$issue/comments?per_page=100")"
    # Post-deployment evidence is an Actions-issued release receipt. Merely
    # merging to UAT/main or closing a GitHub issue NEVER means Released.
    published="$(jq -r '[.[]|select(.user.login=="github-actions[bot]" and (.body|contains("<!-- acorn-cloudflare-published -->")))]|length' <<< "$comments")"

    if [ "$issue" = "60" ] && [ "$published" -eq 0 ]; then
      # One historical exception: #60 was deployed before the UAT -> production
      # workflow existed, as confirmed by the product owner. No redeployment.
      accepted="$(jq -r '[.[]|select(.user.login=="amthqng" and (.body|test("UAT-ACCEPTED: #60([[:space:]]|$)")))]|length' <<< "$comments")"
      if [ "$accepted" -gt 0 ]; then
        pr="$(gh pr view 74 --repo "$GITHUB_REPOSITORY" --json state,baseRefName --jq '[.state,.baseRefName]|join(":")')"
        [ "$pr" = "MERGED:main" ] && published=1
      fi
    fi
    [ "$published" -gt 0 ] || continue

    # Close the GitHub issue only after evidence of release, and keep its
    # project card in Released even if GitHub auto-sets Done on issue closure.
    if [ "$state" != "CLOSED" ]; then
      gh issue close "$issue" --repo "$GITHUB_REPOSITORY" --reason completed
    fi
    if [ "$status" != "Released" ]; then
      echo "::notice::Issue #$issue is released; syncing card to Released."
      PROJECT_OWNER="$owner" PROJECT_NUMBER="$number" PROJECT_STATUS="Released" GH_TOKEN="$PROJECT_TOKEN" bash scripts/add-issue-to-project.sh "https://github.com/$GITHUB_REPOSITORY/issues/$issue"
    fi
  done < <(jq -c --arg repo "$GITHUB_REPOSITORY" '.data.user.projectV2.items.nodes[]? | select(.content.repository.nameWithOwner==$repo) | select(.content.number==60 or .content.state=="CLOSED" or .fieldValueByName.name=="Done" or .fieldValueByName.name=="Released") | {number:.content.number,state:.content.state,status:.fieldValueByName.name}' <<< "$page")

  [ "$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage // false' <<< "$page")" = "true" ] || break
  cursor="$(jq -r '.data.user.projectV2.items.pageInfo.endCursor // empty' <<< "$page")"
  [ -n "$cursor" ] || exit 1
done
