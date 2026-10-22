#!/usr/bin/env bash
set -euo pipefail
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
repo="${GITHUB_REPOSITORY:?Missing repository}"
status="${PROJECT_STATUS:?Missing PROJECT_STATUS}"
project="$(gh api graphql -f query='query($login:String!,$number:Int!){user(login:$login){projectV2(number:$number){id}}}' -f login="$owner" -F number="$number")"
id="$(jq -r '.data.user.projectV2.id // empty' <<< "$project")"
test -n "$id" || { echo "Project lookup failed"; exit 1; }
cursor=""
while :; do
  if [ -n "$cursor" ]; then
    page="$(gh api graphql -f query='query($id:ID!,$after:String){node(id:$id){... on ProjectV2{items(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{url}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}' -f id="$id" -f after="$cursor")"
  else
    page="$(gh api graphql -f query='query($id:ID!){node(id:$id){... on ProjectV2{items(first:100){pageInfo{hasNextPage endCursor} nodes{content{... on Issue{url}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}' -f id="$id")"
  fi
  jq -r --arg s "$status" --arg prefix "https://github.com/$repo/issues/" '.data.node.items.nodes[]? | select(.fieldValueByName.name == $s) | .content.url // empty | select(startswith($prefix)) | ltrimstr($prefix) | select(test("^[1-9][0-9]*$"))' <<< "$page"
  more="$(jq -r '.data.node.items.pageInfo.hasNextPage // false' <<< "$page")"
  [ "$more" = "true" ] || break
  cursor="$(jq -r '.data.node.items.pageInfo.endCursor // empty' <<< "$page")"
  test -n "$cursor" || exit 1
done
