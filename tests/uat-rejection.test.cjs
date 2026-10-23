'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(root,'scripts/enforce-rejected-uat.sh'),'utf8');
const controller=fs.readFileSync(path.join(root,'.github/workflows/product-pipeline.yml'),'utf8');

test('UAT rejection reconciliation runs before board snapshot',()=>{
  assert.match(controller,/bash scripts\/enforce-rejected-uat\.sh/);
  assert.ok(controller.indexOf('bash scripts/enforce-rejected-uat.sh')<controller.indexOf('bash scripts/pipeline-board-snapshot.sh'));
  assert.match(controller,/Refusing stale UAT handoff/);
  assert.match(controller,/pr_entry=.*createdAt/);
  const parsed=spawnSync('bash',['-n','scripts/enforce-rejected-uat.sh'],{cwd:root});
  assert.equal(parsed.status,0,parsed.stderr.toString());
});
test('owner rejection is newer than original UAT receipt, so development wins',()=>{
  const comments=[
    {user:{login:'github-actions[bot]'},created_at:'2026-10-23T10:00:00Z',body:'UAT-CANDIDATE: #83 aa22 PR #85'},
    {user:{login:'amthqng'},created_at:'2026-10-23T18:00:00Z',body:'**UAT REJECTED** — incomplete fall theme'}
  ];
  const rejectedExpr='[to_entries[] | select(.value.user.login==$owner and ((.value.body // "")|test("UAT[[:space:]]*REJECTED";"i")))] | last // empty';
  const latestExpr='[to_entries[] | select((.value.body // "")|contains("UAT-CANDIDATE: #"+$issue+" ")) | .key] | last // -1';
  assert.ok(script.includes(rejectedExpr));
  assert.ok(script.includes(latestExpr));
  const rejected=spawnSync('jq',['-c','--arg','owner','amthqng',rejectedExpr],{input:JSON.stringify(comments),encoding:'utf8'});
  const candidate=spawnSync('jq',['-r','--arg','issue','83',latestExpr],{input:JSON.stringify(comments),encoding:'utf8'});
  assert.equal(rejected.status,0,rejected.stderr);
  assert.equal(candidate.status,0,candidate.stderr);
  assert.equal(JSON.parse(rejected.stdout).key,1);
  assert.equal(Number(candidate.stdout),0);
  assert.match(script,/gh issue reopen/);
  assert.match(script,/target="In Development"/);
});
test('new correction PR is recognized without claiming the original is approved',()=>{
  const prs=[
    {headRefName:'agents/issue-83',baseRefName:'uat',state:'MERGED',createdAt:'2026-10-23T10:00:00Z'},
    {headRefName:'agents/issue-83-correction-100',baseRefName:'uat',state:'OPEN',createdAt:'2026-10-23T19:00:00Z'}
  ];
  const expr='[.[] | select(.baseRefName=="uat" and (.headRefName|startswith($prefix)) and (.createdAt>$when) and (.state=="OPEN" or .state=="MERGED"))] | length';
  assert.ok(script.includes(expr));
  const result=spawnSync('jq',['-r','--arg','prefix','agents/issue-83-correction-','--arg','when','2026-10-23T18:00:00Z',expr],{input:JSON.stringify(prs),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(Number(result.stdout),1);
  assert.match(script,/target="QA & Review"/);
});
