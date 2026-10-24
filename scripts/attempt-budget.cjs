'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const cp=require('node:child_process');
const marker='acorn-attempt-budget';
function policy(issue,comments,owner){
 const accepted=comments.reduce((n,c,i)=>c.user?.login===owner&&new RegExp('UAT-ACCEPTED:\\s*#'+issue.number+'(?:\\s|$)','i').test(c.body||'')?i:n,-1);
 const ownerComments=comments.slice(accepted+1).filter(c=>c.user?.login===owner&&!/(?:UAT-ACCEPTED|acorn-attempt-budget):/i.test(c.body||''));
 const payload=JSON.stringify({number:issue.number,title:issue.title,body:issue.body,requirements:ownerComments.map(c=>c.body||'')});
 const revision=crypto.createHash('sha256').update(payload).digest('hex').slice(0,16);
 const attempts=comments.filter(c=>(c.body||'').includes('<!-- '+marker+':'+revision+' -->')).length;
 const correction=ownerComments.slice(-3).map(c=>c.body||'').join(' ').toLowerCase();
 const requested=(correction||issue.title+' '+(issue.body||'')).toLowerCase();
 // Narrow corrections should not inherit high effort from an old feature title.
 const minor=/\b(border|background|color|colour|text|label|spacing|padding|margin|shadow|font|css|alignment|icon|typo|copy)\b/i.test(requested)
   && !/\b(progress|save|persist|adaptive|curriculum|scoring|question generator|database|migration|security)\b/i.test(requested);
 const complex=/\b(progress|save|persist|adaptive|curriculum|scoring|question generator|migration|security|multi[- ]region|84 stops)\b/i.test(requested);
 const tier=minor?'small':complex?'complex':'normal';
 return {revision,attempts,maxAttempts:2,allow:attempts<2,tier,model:tier==='complex'?'gpt-6.1-sol':'gpt-6-luna',effort:tier==='complex'?'high':tier==='normal'?'medium':'low',requirements:ownerComments.map(c=>c.body||'').filter(Boolean)};
}
function api(endpoint){return JSON.parse(cp.execFileSync('gh',['api','--paginate',endpoint],{encoding:'utf8',maxBuffer:12*1024*1024}));}
if(require.main===module){
 const issueNo=process.argv[2];
 if(!/^[1-9]\d*$/.test(issueNo||''))throw Error('Usage: node scripts/attempt-budget.cjs ISSUE');
 const repo=process.env.GITHUB_REPOSITORY;
 if(!repo)throw Error('GITHUB_REPOSITORY required');
 const issue=api('repos/'+repo+'/issues/'+issueNo);
 const comments=api('repos/'+repo+'/issues/'+issueNo+'/comments?per_page=100');
 const value=policy(issue,comments,repo.split('/')[0]);
 if(process.argv.includes('--github-output')){
  for(const [k,v] of Object.entries(value))if(k!=='requirements')fs.appendFileSync(process.env.GITHUB_OUTPUT,k+'='+v+'\n');
 }
 console.log(JSON.stringify(value));
}
module.exports={policy,marker};
