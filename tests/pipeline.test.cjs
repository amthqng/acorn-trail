'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=(name)=>fs.readFileSync(path.join(__dirname,'..','.github','workflows',name),'utf8');
const implement=workflow('implement-approved.yml');
const controller=workflow('product-pipeline.yml');
const release=workflow('release-cloudflare.yml');
const batch=fs.readFileSync(path.join(__dirname,'..','scripts','batch-release.sh'),'utf8');

test('Developer never merges code or marks its own work Ready for UAT',()=>{
  assert.match(implement,/gh pr create --base uat --head/);
  assert.doesNotMatch(implement,/gh pr merge /);
  assert.doesNotMatch(implement,/PROJECT_STATUS: Ready for UAT/);
  assert.doesNotMatch(implement,/gh pr create --base main/);
});
test('QA review must approve and stage to uat before any UAT handoff',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.ok(qa,'QA handoff job is required');
  assert.match(qa,/Verify reviewed candidate and merge to UAT/);
  assert.match(qa,/UAT-CANDIDATE:/);
  assert.match(qa,/UAT-PREVIEW:/);
  assert.match(qa,/PROJECT_STATUS: Ready for UAT/);
  assert.ok(qa.indexOf('UAT-PREVIEW:')<qa.indexOf('PROJECT_STATUS: Ready for UAT'));
  assert.doesNotMatch(qa,/gh pr merge[^\n]*--base main/);
});
test('Manual releases bundle only Done, unreleased and UAT-attributed game changes',()=>{
  assert.match(release,/workflow_dispatch/);
  assert.doesNotMatch(controller,/^  publish:/m);
  assert.match(batch,/PROJECT_STATUS=Done/);
  assert.match(batch,/acorn-cloudflare-published/);
  assert.match(batch,/UAT-CANDIDATE:/);
  assert.match(batch,/git diff --binary "\$sha\^1" "\$sha"/);
  assert.match(batch,/git apply --3way/);
  assert.match(batch,/gh release create/);
});
test('Routine QA uses native runner with focused Chromium checks',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.doesNotMatch(qa,/container:/);
  assert.match(qa,/npx playwright install chromium/);
  assert.match(qa,/actions\/cache@v4/);
});
test('Controller syncs UAT developer tools without restricted workflow updates',()=>{
  assert.match(controller,/  sync-uat:/);
  if(controller.includes('git restore --source origin/main')){
    assert.match(controller,/git restore --source origin\/main -- (?:\.gitignore )?AGENTS\.md agents orchestration scripts tests/);
  }else{
    assert.match(controller,/git merge --no-edit origin\/main/);
  }
  assert.match(controller,/git push origin HEAD:uat/);
  assert.match(controller,/  board:\n    needs: sync-uat/);
  assert.match(controller,/if: always\(\) &&/);
  assert.doesNotMatch(controller,/git push --force/);
});
test('Routine QA is focused; full browser/offline suite runs before production promotion',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.match(qa,/node --test tests\/qa-smoke\.test\.cjs/);
  assert.doesNotMatch(qa,/--test-name-pattern=/);
  assert.doesNotMatch(qa,/node --test tests\/browser\.test\.cjs tests\/offline\.browser\.test\.cjs/);
  assert.match(batch,/node --test tests\/game\.test\.cjs tests\/browser\.test\.cjs tests\/offline\.browser\.test\.cjs/);
  assert.ok(batch.indexOf('node --test tests/game.test.cjs tests/browser.test.cjs tests/offline.browser.test.cjs')<batch.indexOf('git push origin HEAD:main'));
});
test('Only the release workflow may deploy the production worker',()=>{
  assert.doesNotMatch(implement,/wrangler[^\n]*deploy/);
  assert.doesNotMatch(controller,/wrangler[^\n]*deploy --config wrangler\.release/);
  assert.match(batch,/wrangler@4 deploy --config wrangler\.release\.jsonc/);
});
test('obsolete setup-only workflows were removed',()=>{
  for(const name of ['openai-connection-test.yml','sync-discovery-cards.yml']){
    assert.equal(fs.existsSync(path.join(__dirname,'..','.github','workflows',name)),false);
  }
});

test('Legacy owner UAT acceptance is recognized regardless of trailing newline',()=>{
  const restore=fs.readFileSync(path.join(__dirname,'..','scripts','restore-premature-done.sh'),'utf8');
  assert.match(restore,/test\("UAT-ACCEPTED: #"/);
  assert.match(restore,/\[\[:space:\]\]\|\$/);
  assert.doesNotMatch(restore,/gh issue reopen/);
});
test('Merged UAT work in Discovery is restored to QA/UAT with an open issue',()=>{
  const recovery=fs.readFileSync(path.join(__dirname,'..','scripts','recover-closed-discovery.sh'),'utf8');
  assert.match(recovery,/\.content\.state=="CLOSED"/);
  assert.match(recovery,/\.fieldValueByName\.name=="Discovery"/);
  assert.match(recovery,/\.baseRefName=="uat"/);
  assert.match(recovery,/desired="QA & Review"/);
  assert.match(recovery,/gh issue reopen/);
  assert.match(recovery,/PROJECT_STATUS="\$desired"/);
  assert.match(controller,/bash scripts\/recover-closed-discovery\.sh/);
});

test('Release reconciliation closes only published or explicitly migrated historical work',()=>{
  const script=fs.readFileSync(path.join(__dirname,'..','scripts','reconcile-released-issues.sh'),'utf8');
  assert.match(script,/acorn-cloudflare-published/);
  assert.match(script,/Issue #\$issue is released/);
  assert.match(script,/gh issue close/);
  assert.match(script,/PROJECT_STATUS="Released"/);
  assert.match(script,/\[ "\$issue" = "60" \]/);
  assert.match(script,/UAT-ACCEPTED: #60/);
  assert.match(controller,/bash scripts\/reconcile-released-issues\.sh/);
});
test('UAT reconciliation keeps unaccepted merged issues OPEN until release',()=>{
  const script=fs.readFileSync(path.join(__dirname,'..','scripts','recover-closed-discovery.sh'),'utf8');
  assert.match(script,/gh issue reopen/);
  assert.match(script,/\.baseRefName=="uat"/);
  assert.match(script,/\.content.state=="OPEN"/);
  assert.match(script,/\.content.state=="CLOSED"/);
  assert.match(script,/PROJECT_STATUS="\$desired"/);
  assert.match(script,/UAT-CANDIDATE:/);
  assert.doesNotMatch(script,/PROJECT_STATUS="Done"/);
  assert.doesNotMatch(script,/gh issue close/);
});

test('QA handoff can resume a merged UAT candidate after main/uat sync',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  assert.ok(qa);
  assert.match(qa,/if \[ "\$state" = "MERGED" \]/);
  assert.match(qa,/grep -Fq "UAT-CANDIDATE:/);
  assert.match(qa,/echo "completed=true"/);
  assert.match(qa,/fetch-depth: 0/);
  assert.match(qa,/git merge-base --is-ancestor "\$sha" origin\/uat/);
  assert.match(qa,/fetch --no-tags origin \+refs\/heads\/uat:refs\/remotes\/origin\/uat/);
  assert.match(qa,/PROJECT_STATUS: Ready for UAT/);
});
test('QA smoke is bounded and full gameplay regression stays release-only',()=>{
  const qa=controller.split('  qa-handoff:')[1]?.split('  dispatch:')[0];
  const smoke=fs.readFileSync(path.join(__dirname,'qa-smoke.test.cjs'),'utf8');
  assert.match(qa,/node --test tests\/qa-smoke\.test\.cjs/);
  assert.doesNotMatch(qa,/node --test --test-name-pattern/);
  assert.match(smoke,/offline mobile: team setup, map, and first challenge work/);
  assert.match(smoke,/desktop: opening screen fits/);
  assert.doesNotMatch(smoke,/region<7|stop<12|for\(let region/);
  assert.match(batch,/node --test tests\/game\.test\.cjs tests\/browser\.test\.cjs tests\/offline\.browser\.test\.cjs/);
});
