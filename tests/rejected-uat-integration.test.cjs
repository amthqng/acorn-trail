'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const fakeGH=[
'#!/usr/bin/env node',
"const fs=require('node:fs');",
"const argv=process.argv.slice(2);",
"fs.appendFileSync(process.env.GH_TRACE,argv.join(' ')+'\\n');",
"const out=x=>process.stdout.write(JSON.stringify(x)+'\\n');",
"const status=process.env.TEST_BOARD_STATUS||'Done';",
"const issueState=process.env.TEST_ISSUE_STATE||'OPEN';",
"const prCreated='2026-10-23T11:00:00Z';",
"if(argv[0]==='pr'&&argv[1]==='list'){",
" const prs=[{number:85,state:'MERGED',headRefName:'agents/issue-83',baseRefName:'uat',createdAt:prCreated}];",
" if(process.env.TEST_CORRECTION==='1')prs.push({number:101,state:'OPEN',headRefName:'agents/issue-83-correction-101',baseRefName:'uat',createdAt:'2026-10-23T20:00:00Z'});",
" out(prs);",
"}else if(argv[0]==='api'&&argv.includes('--paginate')){",
" const list=[",
"  {user:{login:'github-actions[bot]'},created_at:'2026-10-23T12:00:00Z',body:'UAT-CANDIDATE: #83 old PR #85'},",
"  {user:{login:'amthqng'},created_at:'2026-10-23T18:00:00Z',body:'**UAT REJECTED** - incomplete implementation'}",
" ];",
" if(process.env.TEST_NEW_CANDIDATE==='1')list.push({user:{login:'github-actions[bot]'},created_at:'2026-10-23T20:30:00Z',body:'UAT-CANDIDATE: #83 new PR #101'});",
" out(list);",
"}else if(argv[0]==='issue'&&argv[1]==='reopen'){",
" out({state:'open'});",
"}else if(argv[0]==='api'&&argv[1]==='graphql'){",
" const q=(argv.find(a=>a.startsWith('query='))||'').slice(6);",
" if(q.includes('updateProjectV2ItemFieldValue'))out({data:{updateProjectV2ItemFieldValue:{projectV2Item:{id:'ITEM'}}}});",
" else if(q.includes('fieldValueByName(name:'))out({data:{user:{projectV2:{items:{nodes:[{content:{number:83,state:issueState,repository:{nameWithOwner:'amthqng/acorn-trail'}},fieldValueByName:{name:status}}],pageInfo:{hasNextPage:false,endCursor:null}}}}}});",
" else if(q.includes('fields(first:100)'))out({data:{node:{fields:{nodes:[{id:'FIELD',name:'Status',options:[{name:'In Development',id:'OPT_DEV'},{name:'QA & Review',id:'OPT_QA'}]}]}}}});",
" else if(q.includes('items(first:100)'))out({data:{node:{items:{nodes:[{id:'ITEM',content:{url:'https://github.com/amthqng/acorn-trail/issues/83'}}],pageInfo:{hasNextPage:false,endCursor:null}}}}});",
" else if(q.includes('projectV2(number:'))out({data:{user:{projectV2:{id:'PROJECT'}}}});",
" else {console.error('Unknown graphql '+q);process.exitCode=1;}",
"}else {console.error('Unexpected GitHub mock request',argv);process.exitCode=1;}"
].join('\n')+'\n';

function runFixture(options={},scriptName='scripts/enforce-rejected-uat.sh'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acorn-rejected-uat-'));
 try{
  const executable=path.join(dir,'gh');
  const trace=path.join(dir,'calls');
  fs.writeFileSync(executable,fakeGH,{mode:0o755});
  const env={...process.env,
    GH_TOKEN:'FAKE',PROJECT_TOKEN:'FAKE',GITHUB_REPOSITORY:'amthqng/acorn-trail',
    PROJECT_OWNER:'amthqng',PROJECT_NUMBER:'2',
    GH_TRACE:trace,PATH:dir+path.delimiter+process.env.PATH,
    ...options};
  const result=spawnSync('bash',[scriptName],{cwd:root,env,encoding:'utf8',timeout:15000});
  const calls=fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'';
  return {result,calls};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('open issue with incorrect Done card returns to In Development without being reopened',()=>{
 const {result,calls}=runFixture();
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
 assert.match(result.stdout,/Preserving rejected UAT issue #83 at In Development/);
 assert.match(calls,/option=OPT_DEV/);
 assert.doesNotMatch(calls,/issue reopen/);
});
test('closed issue with incorrect Done card reopens and returns to In Development',()=>{
 const {result,calls}=runFixture({TEST_ISSUE_STATE:'CLOSED'});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
 assert.match(calls,/issue reopen 83/);
 assert.match(calls,/option=OPT_DEV/);
});
test('a new correction PR advances from rejected development into QA, not stale UAT',()=>{
 const {result,calls}=runFixture({TEST_CORRECTION:'1'});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
 assert.match(calls,/option=OPT_QA/);
 assert.doesNotMatch(calls,/option=OPT_DEV/);
});
test('new UAT candidate after rejection disables older rejection recovery',()=>{
 const {result,calls}=runFixture({TEST_NEW_CANDIDATE:'1'});
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
 assert.doesNotMatch(calls,/option=OPT_DEV|option=OPT_QA|issue reopen/);
});

test('generic Discovery recovery skips a previously rejected UAT candidate',()=>{
 const {result,calls}=runFixture({TEST_BOARD_STATUS:'Discovery'},'scripts/recover-closed-discovery.sh');
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
 assert.match(result.stdout,/skipping stale UAT promotion/);
 assert.doesNotMatch(calls,/issue reopen|option=OPT_DEV|option=OPT_QA/);
});
test('generic closed-QA recovery leaves rejected work to the owner verdict controller',()=>{
 const {result,calls}=runFixture({TEST_BOARD_STATUS:'QA & Review',TEST_ISSUE_STATE:'CLOSED'},'scripts/recover-closed-discovery.sh');
 assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
 assert.match(result.stdout,/skipping stale UAT promotion/);
 assert.doesNotMatch(calls,/issue reopen|option=OPT_DEV|option=OPT_QA/);
});
