#!/usr/bin/env bash
set -euo pipefail
: "${GH_TOKEN:?}"
: "${PROJECT_TOKEN:?}"
: "${CLOUDFLARE_API_TOKEN:?}"
: "${CLOUDFLARE_ACCOUNT_ID:?}"
export PROJECT_OWNER=amthqng PROJECT_NUMBER=2 PROJECT_STATUS=Done
git fetch origin main uat --tags
git checkout -B production-candidate origin/main
baseline="$(git rev-parse HEAD)"
assets=(index.html sw.js manifest.webmanifest icon-192.png icon-512.png icon-maskable-512.png)
manifest="$(mktemp)"
GH_TOKEN="$PROJECT_TOKEN" bash scripts/list-project-status-issues.sh | sort -nu > /tmp/acorn-done-issues
while read -r issue; do
  [[ "$issue" =~ ^[1-9][0-9]*$ ]] || continue
  comments="$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$issue/comments?per_page=100")"
  if jq -e '[.[]|select(.body|contains("<!-- acorn-cloudflare-published -->"))]|length>0' <<< "$comments" >/dev/null; then continue; fi
  prefix="agents/issue-$issue"
  pr="$(gh pr list --repo "$GITHUB_REPOSITORY" --state merged --limit 300 --json number,headRefName,baseRefName,mergeCommit | jq -c --arg prefix "$prefix" '[.[]|select(.baseRefName=="uat")|select(.headRefName==$prefix or (.headRefName|startswith($prefix+"-correction-")))]|sort_by(.number)|last // empty')"
  [ -n "$pr" ] || { echo "::notice::Issue #$issue has no UAT PR; skipping"; continue; }
  sha="$(jq -r '.mergeCommit.oid' <<< "$pr")"
  prnum="$(jq -r '.number' <<< "$pr")"
  [ -n "$sha" ] && [ "$sha" != "null" ] || continue
  if ! jq -e --arg issue "$issue" --arg sha "$sha" --arg pr "$prnum" '[.[]|select(.body|contains("UAT-CANDIDATE: #"+$issue+" "+$sha+" PR #"+$pr))]|length>0' <<< "$comments" >/dev/null; then
    echo "::notice::Issue #$issue missing exact candidate receipt"; continue
  fi
  # Done is the product owner's explicit UAT acceptance on the project board.
  # The exact candidate receipt binds that acceptance to a reviewed UAT change.
  git merge-base --is-ancestor "$sha" origin/uat || { echo "::error::Issue #$issue UAT SHA not on uat"; exit 1; }
  # Apply only deployable game assets from accepted PR; never include unreleased UAT changes.
  patch="$(mktemp)"
  git diff --binary "$sha^1" "$sha" -- "${assets[@]}" > "$patch"
  if [ -s "$patch" ]; then
    git apply --3way "$patch" || { echo "::error::Accepted issue #$issue conflicts with release candidate"; exit 1; }
    git add -- "${assets[@]}"
    git diff --cached --quiet || git commit -m "release: include accepted issue #$issue (PR #$prnum)"
  fi
  echo "#$issue PR #$prnum UAT $sha" >> "$manifest"
done < /tmp/acorn-done-issues
if [ ! -s "$manifest" ]; then echo "No newly accepted features to release."; exit 0; fi
if git diff --quiet "$baseline" HEAD -- "${assets[@]}"; then echo "No deployable asset changes."; exit 0; fi
echo "Release candidate manifest:"
cat "$manifest"
# Full regression occurs ONCE for the frozen bundled candidate, before promotion.
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium webkit
node --test tests/game.test.cjs tests/browser.test.cjs tests/offline.browser.test.cjs
git push origin HEAD:main
candidate="$(git rev-parse HEAD)"
mkdir -p .cloudflare-release/public
for file in "${assets[@]}"; do test -s "$file"; cp "$file" .cloudflare-release/public/; done
sed 's#"directory": "./"#"directory": "./.cloudflare-release/public"#' wrangler.jsonc > wrangler.release.jsonc
grep -Fq '"directory": "./.cloudflare-release/public"' wrangler.release.jsonc
npx --yes wrangler@4 deploy --config wrangler.release.jsonc
tag="release-$GITHUB_RUN_NUMBER"
git tag "$tag" "$candidate"
git push origin "$tag"
gh release create "$tag" --title "Acorn Trail $tag" --notes "$(printf 'Production commit: %s\nFull regression: passed\n\nIncluded accepted issues:\n' "$candidate"; cat "$manifest")" --target "$candidate"
while read -r row; do
  issue="${row%% *}"
  gh issue comment "${issue#\#}" --body "<!-- acorn-cloudflare-published --> Included in $tag, production commit $candidate. Run $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID."
done < "$manifest"
echo "Production release $tag deployed."
