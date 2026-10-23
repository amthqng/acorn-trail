'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=(name)=>fs.readFileSync(path.join(__dirname,'..','.github','workflows',name),'utf8');
const implement=workflow('implement-approved.yml');
const controller=workflow('product-pipeline.yml');
const release=workflow('release-cloudflare.yml');

test('Developer never merges code or marks its own work Ready for UAT',()=>{
  assert.match(implement,/gh pr create --base uat --head/);
  assert.doesNotMatch(implement,/gh pr merge /);
  assert.doesNotMatch(implement,/PROJECT_STATUS: Ready for UAT/);
  assert.doesNotMatch(implement,/gh pr create --base main/);
});
test('QA review must approve and stage to uat before any UAT handoff',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.ok(qa,'QA handoff job is required');
  assert.match(qa,/REVIEWER_GITHUB_TOKEN/);
  assert.match(qa,/approved_delta|gh pr review/);
  assert.match(qa,/UAT-CANDIDATE:/);
  assert.match(qa,/UAT-PREVIEW:/);
  assert.match(qa,/PROJECT_STATUS: Ready for UAT/);
  assert.ok(qa.indexOf('UAT-PREVIEW:')<qa.indexOf('PROJECT_STATUS: Ready for UAT'));
  assert.doesNotMatch(qa,/gh pr merge[^\n]*--base main/);
});
test('Production requires owner acceptance of precise candidate and isolated asset diff',()=>{
  assert.match(release,/\.user\.login == "amthqng"/);
  assert.match(release,/UAT-ACCEPTED:/);
  assert.match(release,/UAT-CANDIDATE:/);
  assert.match(release,/\$merged_sha/);
  assert.match(release,/git rev-list --first-parent/);
  assert.match(release,/baseRefName=="uat"/);
  assert.match(release,/UAT game asset change/);
  assert.match(release,/git merge --ff-only origin\/uat/);
});
test('Routine QA uses native runner with focused Chromium checks',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.doesNotMatch(qa,/container:/);
  assert.match(qa,/npx playwright install chromium/);
  assert.match(qa,/actions\/cache@v4/);
});
test('Controller synchronizes main to UAT without force pushes before reading the board',()=>{
  assert.match(controller,/  sync-uat:/);
  assert.match(controller,/git merge --no-edit origin\/main/);
  assert.match(controller,/git push origin HEAD:uat/);
  assert.match(controller,/  board:\n    needs: sync-uat/);
  assert.doesNotMatch(controller,/git push --force/);
});
test('Routine QA is focused; full browser/offline suite runs before production promotion',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.match(qa,/--test-name-pattern=/);
  assert.doesNotMatch(qa,/node --test tests\/browser\.test\.cjs tests\/offline\.browser\.test\.cjs/);
  assert.match(release,/node --test tests\/browser\.test\.cjs tests\/offline\.browser\.test\.cjs/);
  assert.ok(release.indexOf('node --test tests/browser.test.cjs tests/offline.browser.test.cjs')<release.indexOf('git push origin HEAD:main'));
});
test('Only the release workflow may deploy the production worker',()=>{
  assert.doesNotMatch(implement,/wrangler[^\n]*deploy/);
  assert.doesNotMatch(controller,/wrangler[^\n]*deploy --config wrangler\.release/);
  assert.match(release,/wrangler@4 deploy --config wrangler\.release\.jsonc/);
});
test('obsolete setup-only workflows were removed',()=>{
  for(const name of ['openai-connection-test.yml','sync-discovery-cards.yml']){
    assert.equal(fs.existsSync(path.join(__dirname,'..','.github','workflows',name)),false);
  }
});
