'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {checkPr}=require('../scripts/check-pr-autoclose.cjs');
const root=path.join(__dirname,'..');
const ci=fs.readFileSync(path.join(root,'.github/workflows/tests.yml'),'utf8');
const controller=fs.readFileSync(path.join(root,'.github/workflows/product-pipeline.yml'),'utf8');
const restore=fs.readFileSync(path.join(root,'scripts/restore-premature-done.sh'),'utf8');

test('Github auto-closing PR title is rejected even when feature was not implemented',()=>{
  assert.deepEqual(checkPr({title:'Fix #83 developer workflow',base:'main'}),[83]);
  assert.deepEqual(checkPr({title:'Resolve #83 status issue',base:'main'}),[83]);
  assert.deepEqual(checkPr({title:'Closes amthqng/acorn-trail#83',base:'main'}),[83]);
  assert.deepEqual(checkPr({title:'Implements issue #83',body:'fixes #83',base:'main'}),[83]);
  assert.deepEqual(checkPr({title:'Fix #83 developer workflow',base:'uat'}),[]);
});
test('safe descriptive PR text and issue references do not auto-close',()=>{
  assert.deepEqual(checkPr({title:'Prevent workflow from closing issue #83',body:'QA correction for #83',base:'main'}),[]);
  assert.deepEqual(checkPr({title:'Repair QA staging',body:'A regression previously occurred in issue #83.',base:'main'}),[]);
});
test('CI checks every main-targeted PR for automatic closure language',()=>{
  assert.match(ci,/node scripts\/check-pr-autoclose\.cjs/);
  assert.match(ci,/github\.event\.pull_request\.title/);
  assert.match(ci,/github\.event\.pull_request\.body/);
});
test('board controller recovers on main push, without waiting only for external cron',()=>{
  assert.match(controller,/on:\n  push:\n    branches: \[main\]/);
  assert.match(controller,/  workflow_dispatch:/);
  assert.match(controller,/bash scripts\/enforce-rejected-uat\.sh/);
});
test('generic Done recovery defers to rejected UAT authority instead of moving rejected story to QA',()=>{
  assert.match(restore,/rejected_index=/);
  assert.match(restore,/candidate_index=/);
  assert.match(restore,/if \[ "\$rejected_index" -gt "\$candidate_index" \]/);
  assert.match(restore,/skipping generic QA/);
});
