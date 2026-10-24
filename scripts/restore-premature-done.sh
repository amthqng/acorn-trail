#!/usr/bin/env bash
set -euo pipefail
: "${PROJECT_TOKEN:?Missing PROJECTS_TOKEN}"
: "${GH_TOKEN:?Missing GH_TOKEN}"
query='query($login:String!,$number:Int!){user(login:$login){projectV2(number:$number){id field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}} items(first:100){nodes{id content{... on Issue{number state repository{nameWithOwner}}} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}'
data="$(GH_TOKEN="$PROJECT_TOKEN" gh api graphql -f query="$query" -f login=amthqng -F number=2)"
project="$(jq -r '.data.user.projectV2.id' <<< "$data")"
field="$(jq -r '.data.user.projectV2.field.id' <<< "$data")"
qa="$(jq -r '.data.user.projectV2.field.options[]|select(.name=="QA & Review")|.id' <<< "$data")"
test -n "$project" && test -n "$field" && test -n "$qa"
jq -c --arg repo "$GITHUB_REPOSITORY" '.data.user.projectV2.items.nodes[]|select(.content.repository.nameWithOwner==$repo and .fieldValueByName.name=="Done")|{item:.id,number:.content.number}' <<< "$data" | while read -r row; do
  number="$(jq -r '.number' <<< "$row")"
  item="$(jq -r '.item' <<< "$row")"
  comments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$number/comments?per_page=100" | jq -s add)"
  # A rejected UAT candidate belongs in corrective development, not generic QA.
  # Leave it for enforce-rejected-uat.sh, which knows the owner verdict and
  # whether a NEW correction PR exists. Otherwise the two repair scripts fight.
  rejected_index="$(jq -r '[to_entries[] | select(.value.user.login=="amthqng" and ((.value.body // "")|test("UAT[[:space:]]*REJECTED";"i"))) | .key] | last // -1' <<< "$comments")"
  candidate_index="$(jq -r --arg number "$number" '[to_entries[] | select((.value.body // "")|contains("UAT-CANDIDATE: #"+$number+" ")) | .key] | last // -1' <<< "$comments")"
  feedback_at="$(printf '%s\n' "$comments" | bash scripts/latest-uat-feedback.sh "$number" "amthqng")"
  if [ -n "$feedback_at" ] || [ "$rejected_index" -gt "$candidate_index" ]; then
    echo "::notice::Issue #$number has a newer UAT rejection. Dedicated rejection controller will restore In Development; skipping generic QA."
    continue
  fi
  accepted="$(jq -r --arg number "$number" '[.[]|select(.user.login=="amthqng" and (.body|test("UAT-ACCEPTED: #"+$number+"([[:space:]]|$)"))) ]|length' <<< "$comments")"
  [ "$accepted" -eq 0 ] || continue
  echo "::warning::Issue #$number Done without owner UAT acceptance. Restoring QA & Review without reopening issue."
  mutation='mutation($project:ID!,$item:ID!,$field:ID!,$option:String!){updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,value:{singleSelectOptionId:$option}}){projectV2Item{id}}}'
  GH_TOKEN="$PROJECT_TOKEN" gh api graphql -f query="$mutation" -f project="$project" -f item="$item" -f field="$field" -f option="$qa" >/dev/null
done
