'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=x=>fs.readFileSync(path.resolve(__dirname,'..',x),'utf8');
const workflow=read('.github/workflows/implement-approved.yml');
const reviewer=read('orchestration/review-implementation.ts');
const role=read('agents/reviewer.md');

test('Reviewer gets truthful CI results only after all automated checks succeeded',()=>{
  const flow=[
    'name: Fast syntax and gameplay unit checks',
    'name: Check owner-rejected fall theme in actual offline browser',
    'name: General mobile and desktop QA smoke',
    'name: Record successful automated QA for independent reviewer',
    'name: Independent reviewer and UAT document',
    'name: Open draft implementation PR'
  ];
  let prev=-1;
  for(const item of flow){
    const at=workflow.indexOf(item);
    assert.ok(at>prev,item+' must occur after previous gate');
    prev=at;
  }
  assert.match(workflow,/AUTOMATED_QA_RESULT: PASS/);
  assert.match(workflow,/MANUAL_PRODUCT_OWNER_UAT: NOT YET PERFORMED/);
  assert.match(workflow,/artifacts\/implementation\/qa-evidence\.txt/);
  assert.match(reviewer,/readFile\(join\(root,'artifacts','implementation','qa-evidence\.txt'\)/);
  assert.match(reviewer,/Missing trustworthy successful automated QA result/);
  assert.match(reviewer,/TRUSTED AUTOMATED QA EVIDENCE/);
});
test('Reviewer evaluates readiness for future manual UAT, not owner acceptance itself',()=>{
  assert.match(role,/technical QA gate/);
  assert.match(role,/not\\*\\* the product owner's final UAT acceptance/);
  assert.match(role,/Never reject the candidate \*solely because the user has not yet performed/);
  assert.match(reviewer,/Decision is READINESS FOR MANUAL UAT/);
  assert.match(reviewer,/Do NOT demand proof of the owner/);
  assert.match(reviewer,/Fail when there is a specific unfixed requirement or code defect/);
  assert.match(reviewer,/UAT checklist items/);
  assert.match(workflow,/Independent reviewer and UAT document/);
  assert.match(workflow,/gh pr create --base uat/);
  assert.doesNotMatch(workflow,/gh pr merge /);
});
test('Fall-theme handoff still requires offline browser acceptance and technical reviewer verdict PASS',()=>{
  assert.match(workflow,/if: inputs.issue_number == '83'/);
  assert.match(workflow,/node --test tests\/fall-theme-acceptance\.browser\.test\.cjs/);
  assert.match(workflow,/node --test tests\/qa-smoke\.test\.cjs/);
  assert.match(workflow,/review-verdict\.txt/);
  assert.match(workflow,/= "PASS" \|\|/);
  assert.match(reviewer,/A one-dot-only or inactive-style-only fall theme is REVISE/);
});
