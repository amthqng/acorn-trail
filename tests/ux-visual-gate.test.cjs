'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const workflow=read('.github/workflows/implement-approved.yml');
const capture=read('scripts/capture-visual-qa.cjs');
const ux=read('orchestration/visual-review.ts');
test('visual UX review blocks technical approval and issue PR, not the other way around',()=>{
 for(const text of [
  'node scripts/capture-visual-qa.cjs',
  'orchestration/visual-review.ts',
  'artifacts/implementation/visual-verdict.txt'
 ])assert.ok(workflow.includes(text),text);
 assert.ok(workflow.indexOf('node scripts/capture-visual-qa.cjs')<workflow.indexOf('Record successful automated QA'));
 assert.ok(workflow.indexOf('orchestration/visual-review.ts')<workflow.indexOf('Independent reviewer and UAT document'));
 assert.ok(workflow.indexOf('Independent reviewer and UAT document')<workflow.indexOf('Open draft implementation PR'));
 assert.match(workflow,/UX visual review requested a correction/);
});
test('UX reviewer gets real before/after mobile and desktop screenshots',()=>{
 assert.match(capture,/inputs\/original-index\.html/);
 assert.match(capture,/390,1280/);
 assert.match(capture,/page\.screenshot/);
 assert.match(ux,/input_image/);
 assert.match(ux,/visual-verdict\.txt/);
 assert.match(ux,/UAT-CANDIDATE: #/);
 assert.match(ux,/REVISE/);
});
test('screenshot and UX verdict artifacts are available on failure',()=>{
 assert.match(workflow,/name: Upload UAT and reviewer output[\s\S]*?if: always\(\)/);
 assert.match(workflow,/path: artifacts\/implementation\//);
});
