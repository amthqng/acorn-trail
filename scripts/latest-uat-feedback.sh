#!/usr/bin/env bash
# Read paginated GitHub issue-comments JSON from stdin.
# Print timestamp of the most recent owner correction after the latest
# UAT-CANDIDATE receipt. Empty output means no pending correction.
set -euo pipefail
issue="${1:?issue number required}"
owner="${2:-amthqng}"
jq -r --arg issue "$issue" --arg owner "$owner" '
  (to_entries) as $entries
  | ([$entries[] | select((.value.body // "") | contains("UAT-CANDIDATE: #"+$issue+" ")) | .key] | last // -1) as $candidate
  | if $candidate < 0 then empty
    else
      [$entries[] |
        select(.key > $candidate)
        | select(.value.user.login==$owner)
        | select(((.value.body // "") | test("UAT-ACCEPTED:[[:space:]]*#"+$issue+"([[:space:]]|$)";"i")) | not)
      ] | last | .value.created_at // empty
    end
'
