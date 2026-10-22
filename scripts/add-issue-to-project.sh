#!/usr/bin/env bash
set -euo pipefail
issue_url="${1:?Issue URL required}"
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
desired="${PROJECT_STATUS:-Awaiting Approval}"
echo "Synchronizing user project $owner/$number status '$desired' for $issue_url"

# Explicit user lookup avoids gh CLI's 'unknown owner type' resolution failure.
project="$(gh api graphql -f query='query($login:String!,$number:Int!){user(login:$login){projectV2(number:$number){id}}}' -f login="$owner" -F number="$number")"
project_id="$(jq -r '.data.user.projectV2.id // empty' <<< "$project")"
test -n "$project_id" || { echo "Could not retrieve personal Project ID"; exit 1; }

fields="$(gh api graphql -f query='query($id:ID!){node(id:$id){... on ProjectV2{fields(first:100){nodes{... on ProjectV2SingleSelectField{id name options{id name}}}}}}}' -f id="$project_id")"
field="$(jq -c '.data.node.fields.nodes[] | select(.name == "Status")' <<< "$fields" | head -n 1)"
test -n "$field" || { echo "Status field not found"; exit 1; }
field_id="$(jq -r '.id' <<< "$field")"
option_id="$(jq -r --arg v "$desired" '.options[]? | select((.name|ascii_downcase)==($v|ascii_downcase)) | .id' <<< "$field" | head -n 1)"
if [ -z "$option_id" ]; then echo "Status '$desired' not found. Options:"; jq -r '.options[]?.name' <<< "$field"; exit 1; fi

# Query existing cards using the project node ID (rather than resolving owner type).
cursor=""
item_id=""
while :; do
  if [ -n "$cursor" ]; then
    page="$(gh api graphql -f query='query($id:ID!,$after:String){node(id:$id){... on ProjectV2{items(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{id content{... on Issue{url}}}}}}}' -f id="$project_id" -f after="$cursor")"
  else
    page="$(gh api graphql -f query='query($id:ID!){node(id:$id){... on ProjectV2{items(first:100){pageInfo{hasNextPage endCursor} nodes{id content{... on Issue{url}}}}}}}' -f id="$project_id")"
  fi
  item_id="$(jq -r --arg u "$issue_url" '.data.node.items.nodes[]? | select(.content.url == $u) | .id' <<< "$page" | head -n 1)"
  [ -z "$item_id" ] || break
  has_next="$(jq -r '.data.node.items.pageInfo.hasNextPage // false' <<< "$page")"
  [ "$has_next" = "true" ] || break
  cursor="$(jq -r '.data.node.items.pageInfo.endCursor' <<< "$page")"
done
if [ -z "$item_id" ]; then
  issue_number="${issue_url##*/}"
  issue_repo="${issue_url#https://github.com/}"
  issue_repo="${issue_repo%/issues/*}"
  [[ "$issue_number" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid issue URL"; exit 1; }
  content_id="$(gh api "repos/$issue_repo/issues/$issue_number" --jq '.node_id')"
  created="$(gh api graphql -f query='mutation($project:ID!,$content:ID!){addProjectV2ItemById(input:{projectId:$project,contentId:$content}){item{id}}}' -f project="$project_id" -f content="$content_id")"
  item_id="$(jq -r '.data.addProjectV2ItemById.item.id // empty' <<< "$created")"
fi
test -n "$item_id" || { echo "Failed to locate/create project item"; exit 1; }
gh api graphql -f query='mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$option}}){projectV2Item{id}}}' -f project="$project_id" -f item="$item_id" -f field="$field_id" -f option="$option_id" > /dev/null
echo "Moved $issue_url to $desired on personal project $owner/$number"
