#!/usr/bin/env bash
set -euo pipefail
# Requires GH_TOKEN with Projects write access. Called only on issues created by the discovery workflow.
issue_url="${1:?Issue URL required}"
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
desired="${PROJECT_STATUS:-Awaiting Approval}"
echo "Synchronizing project $owner/$number status '$desired' for $issue_url"
project_json="$(gh project view "$number" --owner "$owner" --format json)"
project_id="$(jq -r '.id // empty' <<< "$project_json")"
echo "Project metadata retrieved"
test -n "$project_id" || { echo "Could not locate project id"; exit 1; }
fields="$(gh project field-list "$number" --owner "$owner" --format json)"
status_field="$(jq -c '.fields[] | select(.name == "Status")' <<< "$fields" | head -n 1)"
test -n "$status_field" || { echo "Project Status field missing"; exit 1; }
field_id="$(jq -r '.id' <<< "$status_field")"
echo "Status options detected:"; jq -r '.options[]?.name' <<< "$status_field"
option_id="$(jq -r --arg desired "$desired" '.options[]? | select((.name|ascii_downcase) == ($desired|ascii_downcase)) | .id' <<< "$status_field" | head -n 1)"
test -n "$option_id" || { echo "Status '$desired' missing from board options. Available:"; jq -r '.options[]?.name' <<< "$status_field"; exit 1; }
# GitHub Projects may auto-add a new issue as Ideas before this script runs.
# Locate an existing project item first; item-add is not necessarily idempotent.
items="$(gh project item-list "$number" --owner "$owner" --format json --limit 1000)"
item_id="$(jq -r --arg url "$issue_url" '.items[]? | select(.content.url == $url) | .id' <<< "$items" | head -n 1)"
if [ -z "$item_id" ]; then
  echo "Project card not yet found; adding it."
  item_json="$(gh project item-add "$number" --owner "$owner" --url "$issue_url" --format json)"
  item_id="$(jq -r '.id // empty' <<< "$item_json")"
else
  echo "Project card already exists; updating its status."
fi
test -n "$item_id" || { echo "Project item not found or added"; exit 1; }
echo "Updating project item status..."
gh project item-edit --id "$item_id" --project-id "$project_id" --field-id "$field_id" --single-select-option-id "$option_id"
echo "Moved $issue_url to $desired on $owner project $number"
