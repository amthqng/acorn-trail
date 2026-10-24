'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const issue=JSON.parse(fs.readFileSync(path.join(root,'inputs/dev-issue.json'),'utf8'));
const comments=JSON.parse(fs.readFileSync(path.join(root,'inputs/issue-comments.json'),'utf8'));
const owner=process.env.GITHUB_REPOSITORY?.split('/')[0]||'amthqng';
const lastCandidate=comments.reduce((i,c,n)=>(c.body||'').includes('UAT-CANDIDATE: #'+issue.number+' ')?n:i,-1);
const feedback=comments.slice(Math.max(0,lastCandidate+1)).filter(c=>c.user?.login===owner).map(c=>c.body||'').join('\n');
const scope=[issue.title||'',issue.body||'',feedback].join(' ').toLowerCase();
const screen=issue.number===83?'screen-start':/\b(map|tree|scenery|region|trail)\b/.test(scope)&&!/\b(home|start screen|title card|offline status|bottom instruction|border)\b/.test(feedback)?'screen-map'
 :/\b(team|friend|character|roster|setup)\b/.test(scope)&&!/\b(home|start screen|title card|offline status|bottom instruction|border)\b/.test(feedback)?'screen-characters':'screen-start';
const directory=path.join(root,'artifacts/implementation/visual-qa');
async function run(){
 fs.mkdirSync(directory,{recursive:true});
 const browser=await chromium.launch();
 const manifest={issue:issue.number,screen,files:[]};
 try{
  for(const [stage,html] of [['before','inputs/original-index.html'],['after','index.html']]){
   for(const width of [390,1280]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:800},deviceScaleFactor:1,reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root,html)).href);
    await page.locator('#screen-start').waitFor({state:'visible'});
    if(screen!=='screen-start')await page.evaluate(id=>go(id),screen);
    await page.locator('#'+screen).waitFor({state:'visible'});
    const file=stage+'-'+width+'.png';
    await page.screenshot({path:path.join(directory,file),fullPage:false});
    if(errors.length)throw Error(stage+'/'+width+': '+errors.join('; '));
    manifest.files.push(file);
    await page.close();
   }
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log('Independent UX evidence: '+manifest.files.join(', '));
}
run().catch(e=>{console.error(e);process.exitCode=1});
