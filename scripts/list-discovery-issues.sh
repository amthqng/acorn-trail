#!/usr/bin/env bash
set -euo pipefail
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
repo="${GITHUB_REPOSITORY:?Missing GITHUB_REPOSITORY}"
: "${GH_TOKEN:?PROJECTS_TOKEN must be provided as GH_TOKEN}"
project="$(gh api graphql -f query='query($login:String!,$number:Int!){user(login:$login){projectV2(number:$number){id}}}' -f login="$owner" -F number="$number")"
id="$(jq -r '.data.user.projectV2.id // empty' <<< "$project")"
test -n "$id" || { echo "Cannot find user project $owner/$number"; exit 1; }
cursor=""
while :; do
  if [ -n "$cursor" ]; then
    result="$(gh api graphql -f query='query($id:ID!,$after:String){node(id:$id){... on ProjectV2{items(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{url}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}' -f id="$id" -f after="$cursor")"
  else
    result="$(gh api graphql -f query='query($id:ID!){node(id:$id){... on ProjectV2{items(first:100){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{url}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}' -f id="$id")"
  fi
  jq -r --arg prefix "https://github.com/$repo/issues/" '
    .data.node.items.nodes[]? |
    select(.fieldValueByName.name == "Discovery") |
    .content.url // empty | select(startswith($prefix)) |
    ltrimstr($prefix) | select(test("^[1-9][0-9]*$"))
  ' <<< "$result"
  more="$(jq -r '.data.node.items.pageInfo.hasNextPage // false' <<< "$result")"
  [ "$more" = "true" ] || break
  cursor="$(jq -r '.data.node.items.pageInfo.endCursor // empty' <<< "$result")"
  test -n "$cursor" || { echo "Missing project pagination cursor"; exit 1; }
done
