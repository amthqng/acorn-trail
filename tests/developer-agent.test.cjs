'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildBrief}=require('../scripts/build-developer-brief.cjs');
const {checkChangeSet,isAllowed}=require('../scripts/verify-developer-change.cjs');

const issue={number:83,state:'open',title:'Fall theme',body:'Make autumn the main visual theme of the game.'};
const comments=[
 {user:{login:'github-actions[bot]'},body:'<!-- acorn-tech-lead-gate -->\n## Tech Lead intake: READY\n### Acceptance criteria\nWarm colors across screens, trees and autumn leaves.'},
 {user:{login:'amthqng'},body:'**UAT REJECTED** — one navigation dot color is insufficient. Update palette, scenery and the map.'},
 {user:{login:'amthqng'},body:'<!-- acorn-review-rejected --> inactive CSS must be enabled at runtime.'}
];

test('brief preserves complete approved acceptance, UAT rejection and reviewer follow-up',()=>{
 const brief=buildBrief({issue,comments,repository:'amthqng/acorn-trail'});
 assert.match(brief,/Tech Lead intake: READY/);
 assert.match(brief,/Warm colors across screens/);
 assert.match(brief,/UAT REJECTED/);
 assert.match(brief,/one navigation dot/);
 assert.match(brief,/inactive CSS must be enabled/);
 assert.match(brief,/work in normal gameplay/);
 assert.match(brief,/Do not merge, deploy/);
});
test('brief cannot authorize a closed issue or a missing Tech Lead approval',()=>{
 assert.throws(()=>buildBrief({issue:{...issue,state:'closed'},comments,repository:'amthqng/acorn-trail'}),/not an open feature issue/);
 assert.throws(()=>buildBrief({issue,comments:comments.slice(1),repository:'amthqng/acorn-trail'}),/Missing approved/);
});
const good={tracked:['index.html'],untracked:['tests/feature-83-maple.test.cjs'],diff:'--- a/index.html\n+++ b/index.html\n+  .fall-scene{background:#dd9955}\n',issue:'83'};
test('gate accepts game and new issue-specific tests, but never a documentation-only implementation',()=>{
 assert.deepEqual(checkChangeSet(good),[]);
 assert.ok(checkChangeSet({...good,tracked:[]}).some(e=>/No changes to index.html/.test(e)));
 assert.equal(isAllowed('tests/feature-83-autumn.test.cjs','83',true),true);
 assert.equal(isAllowed('tests/feature-83-autumn.test.cjs','83',false),false);
 assert.equal(isAllowed('tests/feature-83-accessibility.browser.test.cjs','83',true),true);
 assert.equal(isAllowed('tests/feature-83-accessibility.browser.test.cjs','84',true),false);
 assert.equal(isAllowed('tests/feature-83-accessibility.browser.test.cjs','83',false),false);
 assert.equal(isAllowed('tests/feature-83-accessibility.evil.test.cjs','83',true),false);
});
test('gate rejects modified existing tests, unrelated files, and network code',()=>{
 assert.ok(checkChangeSet({...good,tracked:['index.html','tests/game.test.cjs']}).some(e=>/Forbidden change/.test(e)));
 assert.ok(checkChangeSet({...good,untracked:['.github/workflows/release.yml']}).some(e=>/Forbidden untracked/.test(e)));
 assert.ok(checkChangeSet({...good,diff:'+++ b/index.html\n+<script src="https://cdn.example.com/run.js"></script>'}).some(e=>/network dependency/.test(e)));
 assert.ok(checkChangeSet({...good,diff:'+++ b/index.html\n+fetch("/upload")'}).some(e=>/network dependency/.test(e)));
});
test('gate permits the standard SVG namespace without introducing external resources',()=>{
 assert.deepEqual(checkChangeSet({...good,diff:'+++ b/index.html\n+<svg xmlns="http://www.w3.org/2000/svg"></svg>'}),[]);
});

test('gate accepts useful new issue browser tests without expanding edit authority',()=>{
 const browser='tests/feature-83-accessibility.browser.test.cjs';
 assert.deepEqual(checkChangeSet({...good,untracked:[browser]}),[]);
 assert.ok(checkChangeSet({...good,tracked:['index.html',browser],untracked:[]}).some(x=>/Forbidden change to tracked file/.test(x)));
});
