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
  assert.match(release,/approved_delta/);
  assert.match(release,/pending_delta/);
  assert.match(release,/git merge --ff-only origin\/uat/);
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
