'use strict';
const cp=require('node:child_process');
const fs=require('node:fs');
function parseCodexUsage(log){
 const plain=String(log||'').replace(/\x1b\[[0-9;]*m/g,'');
 const starts=[...plain.matchAll(/tokens used/g)].map(m=>m.index);
 const values=[];
 for(const start of starts){
  const block=plain.slice(start,start+1400);
  const line=block.split('\n').slice(1,20).find(s=>/^\S+\s+\d{1,3}(?:,\d{3})+(?:\s|$)/.test(s));
  const match=line?.match(/\s(\d{1,3}(?:,\d{3})+)\s*$/);
  if(match)values.push(Number(match[1].replace(/,/g,'')));
 }
 const models=[...plain.matchAll(/\bmodel:\s*([a-z][\w.-]+)/gi)].map(m=>m[1]);
 return {tokens:values.length?values.at(-1):null,model:models.at(-1)||null};
}
function gh(args){
 return cp.execFileSync('gh',['api',...args],{encoding:'utf8',maxBuffer:22*1024*1024});
}
function main(){
 const run=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).workflow_run;
 const title=run.display_title||run.name||'';
 const issue=title.match(/Implement issue #(\d+)/)?.[1];
 if(!issue){console.log('No issue in run title; skip');return;}
 const repo=process.env.GITHUB_REPOSITORY;
 const jobs=JSON.parse(gh(['repos/'+repo+'/actions/runs/'+run.id+'/jobs?per_page=100'])).jobs||[];
 const coding=jobs.find(j=>j.steps?.some(s=>s.name==='Run workspace coding agent against real source files'));
 if(!coding){console.log('No coding job found');return;}
 const log=gh(['repos/'+repo+'/actions/jobs/'+coding.id+'/logs']);
 const usage=parseCodexUsage(log);
 const prior=gh(['repos/'+repo+'/issues/'+issue+'/comments?per_page=100']);
 const marker='<!-- acorn-cost-report:'+run.id+' -->';
 if(JSON.parse(prior).some(c=>(c.body||'').includes(marker)))return;
 const body=[marker,'AI development run report for #'+issue,
  '- Run: '+run.html_url,
  '- Outcome: '+run.conclusion,
  '- Coding model: '+(usage.model||'not reported'),
  '- Codex reported total tokens: '+(usage.tokens??'not available (coding step may not have started)'),
  '- Actual API charge: not available from job logs; see OpenAI API Usage for billed input/output and cache breakdown.',
  '- Retry cap is enforced by requirements revision, not controller commit.'].join('\n');
 gh(['-X','POST','repos/'+repo+'/issues/'+issue+'/comments','-f','body='+body]);
 console.log(body);
}
if(require.main===module){try{main()}catch(e){console.error('Usage report unavailable: '+e.message);process.exitCode=0;}}
module.exports={parseCodexUsage};
