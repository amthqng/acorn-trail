#!/usr/bin/env bash
set -euo pipefail
# Requires GH_TOKEN with Projects write access. Called only on issues created by the discovery workflow.
issue_url="${1:?Issue URL required}"
owner="${PROJECT_OWNER:-amthqng}"
number="${PROJECT_NUMBER:-2}"
desired="${PROJECT_STATUS:-Awaiting Approval}"
project_json="$(gh project view "$number" --owner "$owner" --format json)"
project_id="$(jq -r '.id // empty' <<< "$project_json")"
test -n "$project_id" || { echo "Could not locate project id"; exit 1; }
fields="$(gh project field-list "$number" --owner "$owner" --format json)"
status_field="$(jq -c '.fields[] | select(.name == "Status")' <<< "$fields" | head -n 1)"
test -n "$status_field" || { echo "Project Status field missing"; exit 1; }
field_id="$(jq -r '.id' <<< "$status_field")"
option_id="$(jq -r --arg desired "$desired" '.options[]? | select((.name|ascii_downcase) == ($desired|ascii_downcase)) | .id' <<< "$status_field" | head -n 1)"
test -n "$option_id" || { echo "Status '$desired' missing from board options. Available:"; jq -r '.options[]?.name' <<< "$status_field"; exit 1; }
item_json="$(gh project item-add "$number" --owner "$owner" --url "$issue_url" --format json)"
item_id="$(jq -r '.id // empty' <<< "$item_json")"
test -n "$item_id" || { echo "Project item was not added"; exit 1; }
gh project item-edit --id "$item_id" --project-id "$project_id" --field-id "$field_id" --single-select-option-id "$option_id"
echo "Moved $issue_url to $desired on $owner project $number"
