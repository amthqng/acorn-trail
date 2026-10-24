import { Agent, run } from '@openai/agents';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const Verdict=z.object({verdict:z.enum(['PASS','REVISE']),reason:z.string(),issues:z.array(z.string())});
async function main(){
 const n=process.env.ISSUE_NUMBER;
 if(!n||!/^\d+$/.test(n))throw Error('Missing issue number');
 const files=join(root,'artifacts/implementation/visual-qa');
 const [raw,commentsRaw,manifestRaw,rules,uxRole]=await Promise.all([
  readFile(join(root,'inputs/dev-issue.json'),'utf8'),
  readFile(join(root,'inputs/issue-comments.json'),'utf8'),
  readFile(join(files,'manifest.json'),'utf8'),
  readFile(join(root,'AGENTS.md'),'utf8'),
  readFile(join(root,'agents/ux-designer.md'),'utf8')
 ]);
 const issue=JSON.parse(raw) as {number:number;title:string;body:string};
 if(issue.number!==Number(n))throw Error('Wrong issue');
 const comments=JSON.parse(commentsRaw) as Array<{body?:string;user?:{login?:string}}>;
 const manifest=JSON.parse(manifestRaw) as {issue:number;screen:string;files:string[]};
 if(manifest.issue!==issue.number||manifest.files.length!==4)throw Error('Missing complete before/after mobile/desktop screenshots');
 const owner=process.env.GITHUB_REPOSITORY?.split('/')[0]??'amthqng';
 const lastAccepted=comments.reduce((index,c,i)=>c.user?.login===owner&&(c.body??'').includes('UAT-ACCEPTED: #'+n+' ')?i:index,-1);
 const feedback=comments.slice(lastAccepted+1).filter(c=>c.user?.login===owner&&!/UAT-ACCEPTED:/i.test(c.body??'')).map(c=>c.body??'').slice(-12).join('\n---\n');
 const textPrompt='Independently review screenshots of this educational game, treating the latest owner feedback as binding design acceptance criteria. This is readiness for owner UAT, not production approval. Compare before vs after at both device sizes. Do not accept visual clutter, borders, white cards, or distractions that the owner explicitly requested to remove. The actual before/after PNG screenshots follow in order. If a requirement concerns a screen not visible in evidence, return REVISE instead of guessing. Issue #'+n+': '+issue.title+'\nOriginal issue:\n'+(issue.body??'').slice(0,5000)+'\nLatest owner corrections:\n'+(feedback||'None')+'\nScreen captured: '+manifest.screen+'. Return PASS only if the requested visual result is truly visible.';
 const content:any[]=[{type:'input_text',text:textPrompt}];
 for(const file of manifest.files){
  const png=await readFile(join(files,file));
  content.push({type:'input_text',text:'Screenshot: '+file});
  content.push({type:'input_image',image:'data:image/png;base64,'+png.toString('base64'),detail:'high'});
 }
 const agent=new Agent({name:'Acorn Trail Independent UX Visual Reviewer',model:process.env.ACORN_AGENT_MODEL||'gpt-4.1',
  outputType:Verdict,instructions:rules+'\n'+uxRole+'\nYou are the AFTER-implementation UX acceptance reviewer. Independently inspect the supplied real browser screenshots. A passing browser/unit test is not visual proof. Reject subjective regressions to a simple explicit visual owner request. Do not override owner feedback or release software. Use concrete visual evidence in your explanation.',modelSettings:{maxTokens:2200}});
 const result=await run(agent,[{role:'user',content}] as any,{maxTurns:1});
 const verdict=result.finalOutput;
 if(!verdict)throw Error('Visual reviewer returned no result');
 await writeFile(join(root,'artifacts/implementation/visual-verdict.txt'),verdict.verdict+'\n');
 await writeFile(join(root,'artifacts/implementation/visual-review.md'),'# Independent UX visual review\n\nVerdict: '+verdict.verdict+'\n\n'+verdict.reason+'\n\n'+verdict.issues.map(x=>'- '+x).join('\n')+'\n');
 console.log('Independent visual verdict: '+verdict.verdict);
 if(verdict.verdict!=='PASS')process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
