#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?Missing repository token}"
: "${PROJECT_TOKEN:?Missing Projects token}"
: "${GITHUB_REPOSITORY:?Missing repository}"
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
# Fetch board once for this orchestration pass. Never infer board state
# from old issue comments.
query='query($login:String!,$number:Int!,$cursor:String){user(login:$login){projectV2(number:$number){items(first:100,after:$cursor){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{number repository{nameWithOwner} state}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
cursor=""
records='[]'
while :; do
  args=(-f query="$query" -f login="$owner" -F number="$number")
  [ -z "$cursor" ] || args+=(-f cursor="$cursor")
  page="$(GH_TOKEN="$PROJECT_TOKEN" gh api graphql "${args[@]}")"
  if [ "$(jq -r '.data.user.projectV2 == null' <<< "$page")" = true ]; then
    echo "::error::GitHub Project #$number could not be read by PROJECTS_TOKEN"; exit 1
  fi
  batch="$(jq -c --arg r "$GITHUB_REPOSITORY" '[.data.user.projectV2.items.nodes[]? | select(.content.repository.nameWithOwner==$r and (.content.state=="OPEN" or (.fieldValueByName.name=="QA & Review") or (.fieldValueByName.name=="Ready for UAT") or (.fieldValueByName.name=="Done"))) | {number:.content.number,status:.fieldValueByName.name}]' <<< "$page")"
  records="$(jq -cn --argjson a "$records" --argjson b "$batch" '$a+$b')"
  [ "$(jq -r '.data.user.projectV2.items.pageInfo.hasNextPage // false' <<< "$page")" = true ] || break
  cursor="$(jq -r '.data.user.projectV2.items.pageInfo.endCursor' <<< "$page")"
  test -n "$cursor"
done
echo "Board status: $records"\n  echo "::notice::Board contains $(jq length <<< "$records") open repository issues"
for stage in 'Discovery' 'Ready for Development' 'In Development' 'QA & Review' 'Ready for UAT' 'Done'; do
  ids="$(jq -cr --arg s "$stage" '[.[]|select(.status==$s)|.number]|unique' <<< "$records")"
  case "$stage" in
    Discovery) key=discovery;;
    'Ready for Development') key=ready;;
    'In Development') key=development;;
    'QA & Review') key=qa;;
    'Ready for UAT') key=uat;;
    Done) key=done;;
  esac
  echo "$key=$ids" >> "$GITHUB_OUTPUT"
done
