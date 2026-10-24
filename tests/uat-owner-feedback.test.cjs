'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const script='scripts/latest-uat-feedback.sh';
const run=comments=>spawnSync('bash',[script,'83','amthqng'],{cwd:root,input:JSON.stringify(comments),encoding:'utf8'});
const candidate={created_at:'2026-10-23T21:35:00Z',user:{login:'github-actions[bot]'},body:'<!-- acorn-uat-candidate --> UAT-CANDIDATE: #83 8f8d1510 PR #106'};
const correction={created_at:'2026-10-23T22:00:00Z',user:{login:'amthqng'},body:'Remove the remaining white UI backgrounds on the home screen and retint them to match the autumn theme.'};
test('plain-language screenshot feedback invalidates the old UAT candidate',()=>{
 const r=run([candidate,correction]);
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),correction.created_at);
});
test('fresh candidate clears prior rejection until owner leaves more feedback',()=>{
 const later={...candidate,created_at:'2026-10-23T23:00:00Z',body:'UAT-CANDIDATE: #83 new sha PR #107'};
 const r=run([candidate,correction,later]);
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'');
});
test('explicit UAT acceptance does not count as correction',()=>{
 const accept={...correction,body:'UAT-ACCEPTED: #83 8f8d1510d158514884ed2e1bda0babf83eb3b2fd'};
 const r=run([candidate,accept]);
 assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),'');
});
test('older owner comments and unrelated authors cannot invalidate candidate',()=>{
 const old={...correction,created_at:'2026-10-23T20:00:00Z'};
 const bot={...correction,user:{login:'some-other-user'}};
 for(const comments of [[old,candidate],[candidate,bot]]){
  const r=run(comments);
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout.trim(),'');
 }
});
test('all stale-candidate repair paths use owner-feedback detection',()=>{
 for(const p of ['scripts/enforce-rejected-uat.sh','scripts/recover-closed-discovery.sh','scripts/restore-premature-done.sh','.github/workflows/product-pipeline.yml']){
  const src=fs.readFileSync(path.join(root,p),'utf8');
  assert.match(src,/scripts\/latest-uat-feedback\.sh/,p);
 }
 for(const p of [script,'scripts/enforce-rejected-uat.sh','scripts/recover-closed-discovery.sh','scripts/restore-premature-done.sh']){
  const r=spawnSync('bash',['-n',p],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,p+': '+r.stderr);
 }
});
