import { Agent, run } from '@openai/agents';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { execFileSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const Review=z.object({verdict:z.enum(['PASS','REVISE']),reason:z.string(),risks:z.array(z.string()),uat:z.array(z.string())});
async function main(){
 const no=process.env.ISSUE_NUMBER;
 if(!no||!/^\d+$/.test(no))throw Error('Missing issue number');
 const [issue,original,changed,notes,rules,role,commentsRaw,qaEvidence]=await Promise.all([
  readFile(join(root,'inputs','dev-issue.json'),'utf8'),readFile(join(root,'inputs','original-index.html'),'utf8'),
  readFile(join(root,'index.html'),'utf8'),readFile(join(root,'artifacts','implementation','notes.md'),'utf8'),
  readFile(join(root,'AGENTS.md'),'utf8'),readFile(join(root,'agents','reviewer.md'),'utf8'),
  readFile(join(root,'inputs','issue-comments.json'),'utf8'),
  readFile(join(root,'artifacts','implementation','qa-evidence.txt'),'utf8')
 ]);
 if(!qaEvidence.includes('AUTOMATED_QA_RESULT: PASS'))throw Error('Missing trustworthy successful automated QA result; reviewer cannot approve this candidate');
 // Independently review the real unified game diff. A previous reviewer
 // saw only the first changed span and missed most of the feature scope.
 const diff=execFileSync('git',['diff','--unified=3','--','index.html'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
 if(!diff.trim()||original===changed)throw Error('No changed game source to review');
 const snippet=diff.slice(0,90000);
 const comments=JSON.parse(commentsRaw) as Array<{body?:string;user?:{login?:string}}>;
 const owner=process.env.GITHUB_REPOSITORY?.split('/')[0]??'amthqng';
 const rejection=comments.filter(c=>c.user?.login===owner&&/UAT\s*REJECTED/i.test(c.body??'')).at(-1)?.body??'';
 const approved=comments.filter(c=>(c.body??'').includes('<!-- acorn-tech-lead-gate -->')).at(-1)?.body??'';
 const criteria=approved.split('### Acceptance criteria')[1]?.split('### Regression checks')[0]?.slice(0,4000)??'';
 const agent=new Agent({name:'Independent Acorn Trail Code Reviewer',model:process.env.ACORN_AGENT_MODEL||'gpt-4.1',
  instructions:rules+'\n'+role+'\nYou are the independent technical QA REVIEWER, not the product owner accepting UAT. Examine the real code diff and all approved acceptance criteria, including the latest owner UAT rejection. Reject missing functionality, inactive code, regressions or unsafe design even if the automated tests pass. The separately supplied AUTOMATED_QA_RESULT: PASS is emitted by the trusted GitHub Actions workflow AFTER the corresponding tests succeeded; it is real executed-test evidence, not a claim by the Developer. Manual iPhone exploratory testing, human screen-reader testing and final product-owner UAT happen AFTER technical QA approves and the UAT preview is deployed. Do NOT demand proof of the owner\'s future manual UAT to issue a technical PASS, and do not assume UAT acceptance has happened. Identify gaps requiring manual validation as risks and UAT checklist items. You may not merge or deploy. Respond ONLY with valid JSON {verdict:"PASS"|"REVISE",reason:"...",risks:["..."],uat:["..."]}, no prose or markdown fences.',
  modelSettings:{maxTokens:4800}});
 const prompt='Issue #'+no+': '+issue.slice(0,6000)
  +'\nAPPROVED ACCEPTANCE CRITERIA:\n'+criteria
  +'\nPRODUCT OWNER UAT REJECTION (must be completely addressed to PASS):\n'+(rejection||'None')
  +'\nTRUSTED AUTOMATED QA EVIDENCE (written by CI after successful test steps, NOT by Developer):\n'+qaEvidence
  +'\nDeveloper notes (untrusted):\n'+notes
  +'\nREAL UNIFIED CODE DIFF (review all modified regions, not just developer summary):\n'+snippet
  +'\nDecision is READINESS FOR MANUAL UAT, not final owner acceptance. Automated gameplay, feature, mobile, desktop and issue-specific offline-browser tests have passed as recorded in the trusted CI evidence above. No claim of physical-device/manual UAT has been made. Evaluate code correctness and completeness against the original owner rejection. Fail when there is a specific unfixed requirement or code defect; for exploratory manual checks that cannot be done in CI, list precise UAT steps and risks instead of rejecting the handoff. A one-dot-only or inactive-style-only fall theme is REVISE. Do not approve based only on developer notes.';
 let v:z.infer<typeof Review>|undefined;
 const failures:string[]=[];
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const extra=attempt===1?'':'\nEarlier response invalid: '+failures[failures.length-1]+'. Reply with valid JSON only.';
   const result=await run(agent,prompt+extra,{maxTurns:1});
   if(!result.finalOutput)throw Error('Reviewer returned no response');
   let raw=String(result.finalOutput).trim();
   const fenced=raw.match(new RegExp('\\x60{3}(?:json)?\\s*([\\s\\S]*?)\\x60{3}','i'));
   if(fenced)raw=fenced[1].trim();
   if(!raw.startsWith('{')){
    const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
    if(a<0||b<a)throw Error('No JSON object in review');
    raw=raw.slice(a,b+1);
   }
   v=Review.parse(JSON.parse(raw));
   break;
  }catch(e){failures.push(e instanceof Error?e.message:String(e));console.warn('Reviewer response attempt '+attempt+' invalid: '+failures[failures.length-1]);}
 }
 if(!v)v={verdict:'REVISE',reason:'Reviewer could not produce a valid assessment: '+failures.join('; '),risks:['Unverified acceptance criteria'],uat:[]};
 const dir=join(root,'artifacts','implementation');await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'review-verdict.txt'),v.verdict);
 await writeFile(join(dir,'uat.md'),'# UAT for issue #'+no+'\n\n## Implemented\n'+notes+'\n\n## Reviewer verdict: '+v.verdict+'\n'+v.reason+'\n\n## What to test\n'+v.uat.map(x=>'- [ ] '+x).join('\n')+'\n\n## Known risks\n'+v.risks.map(x=>'- '+x).join('\n')+'\n\nThis report does not claim real-child testing or production deployment.\n');

 console.log('Reviewer verdict: '+v.verdict);
}
main().catch(e=>{console.error(e);process.exitCode=1});
