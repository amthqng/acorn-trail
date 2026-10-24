'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildBrief}=require('../scripts/build-developer-brief.cjs');
test('latest ordinary owner corrections are mandatory developer requirements',()=>{
 const issue={number:83,title:'Fall theme',body:'Make it autumn',state:'open'};
 const bot={login:'github-actions[bot]'},owner={login:'amthqng'};
 const comments=[
  {user:bot,body:'<!-- acorn-tech-lead-gate --> Tech Lead intake: READY'},
  {user:bot,body:'UAT-CANDIDATE: #83 deadbeef PR #108'},
  {user:owner,body:'The white box is gone but the border is still there and looks ugly.'},
  {user:bot,body:'<!-- acorn-development-recovery-v3 --> retry'}
 ];
 const brief=buildBrief({issue,comments,repository:'amthqng/acorn-trail'});
 assert.match(brief,/border is still there/);
 assert.match(brief,/Do not replace a rejected white background/);
 assert.doesNotMatch(brief,/None: first implementation/);
});
test('already-accepted UAT is not presented as an owner rejection',()=>{
 const issue={number:83,title:'Fall theme',body:'Fall',state:'open'};
 const comments=[{user:{login:'github-actions[bot]'},body:'<!-- acorn-tech-lead-gate --> Tech Lead intake: READY'},
 {user:{login:'github-actions[bot]'},body:'UAT-CANDIDATE: #83 new PR #109'},
 {user:{login:'amthqng'},body:'UAT-ACCEPTED: #83 newsha'}];
 assert.match(buildBrief({issue,comments,repository:'amthqng/acorn-trail'}),/None: first implementation/);
});

test('new UAT receipt does not erase unresolved earlier owner feedback',()=>{
 const issue={number:83,title:'Fall',body:'Colors',state:'open'};
 const bot={login:'github-actions[bot]'},owner={login:'amthqng'};
 const comments=[
  {user:bot,body:'<!-- acorn-tech-lead-gate --> Tech Lead intake: READY'},
  {user:owner,body:'Remove tan background rectangles, not just their borders'},
  {user:bot,body:'UAT-CANDIDATE: #83 abc PR #114'}
 ];
 assert.match(buildBrief({issue,comments,repository:'amthqng/acorn-trail'}),/Remove tan background rectangles/);
});
