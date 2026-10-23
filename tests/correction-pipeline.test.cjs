'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const developer=read('orchestration/implement-issue.ts');
const reviewer=read('orchestration/review-implementation.ts');
const worker=read('.github/workflows/implement-approved.yml');
const pipeline=read('.github/workflows/product-pipeline.yml');

test('developer receives actual owner UAT rejection and tech lead acceptance criteria',()=>{
  assert.match(worker,/inputs\/issue-comments\.json/);
  assert.match(worker,/jq -s 'add'/);
  assert.match(developer,/inputs','issue-comments\.json'/);
  assert.match(developer,/UAT\\s\*REJECTED/);
  assert.match(developer,/MOST RECENT OWNER UAT REJECTION/);
  assert.match(developer,/TECH LEAD ACCEPTANCE CRITERIA/);
});
test('model response is parsed and validated by the application instead of crashing on forced output schema',()=>{
  assert.doesNotMatch(developer,/outputType:Decision/);
  assert.doesNotMatch(reviewer,/outputType:Review/);
  assert.match(developer,/Decision\.parse\(JSON\.parse\(raw\)\)/);
  assert.match(reviewer,/Review\.parse\(JSON\.parse\(raw\)\)/);
  assert.match(developer,/attempt<=3/);
  assert.match(reviewer,/attempt<=3/);
  assert.match(developer,/writeFile\(join\(dir,'status\.txt'\),'BLOCKED'\)/);
});
test('full-theme UAT correction permits bounded nonoverlapping patches but rejects dot-only changes',()=>{
  assert.match(developer,/changes:z\.array\(Change\)\.max\(8\)/);
  assert.match(developer,/patches\.sort/);
  assert.match(developer,/Overlapping patches/);
  assert.match(developer,/source\.indexOf\(c\.before,pos\+1\)/);
  assert.match(developer,/Fall theme correction must change overall colors\/backgrounds AND scenery\/map/);
  assert.match(developer,/total>20000/);
  assert.match(developer,/Network URLs not permitted/);
  assert.match(reviewer,/PRODUCT OWNER UAT REJECTION/);
  assert.match(reviewer,/Reject incomplete implementations/);
  assert.match(reviewer,/only one story-dot color/);
  assert.match(reviewer,/verdict:'REVISE'/);
});
test('correction still uses PR into UAT, with no direct release or automatic owner approval',()=>{
  assert.match(worker,/gh pr create --base uat/);
  assert.doesNotMatch(worker,/gh pr merge/);
  assert.doesNotMatch(worker,/PROJECT_STATUS: Ready for UAT/);
  assert.match(pipeline,/PROJECT_STATUS: Ready for UAT/);
});
