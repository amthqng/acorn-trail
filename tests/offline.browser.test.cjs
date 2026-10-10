// Real hosted service-worker QA at a repository subpath; no external services.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const original=fs.readFileSync('index.html','utf8');
const files=new Set(['index.html','sw.js','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png']);
for(const [name,engine] of Object.entries({chromium,webkit})){
 test(`${name} hosted cache, offline reopening, recovery and updates`,{timeout:120000},async()=>{
  let content=original,worker=fs.readFileSync('sw.js','utf8'),failNavigation=false,failManifest=false;
  const server=http.createServer((req,res)=>{
   const pathname=new URL(req.url,'http://localhost').pathname;
   let file=pathname.replace(/^\/acorn-trail\//,'');if(!file)file='index.html';
   if(!pathname.startsWith('/acorn-trail/')||!files.has(file)){res.writeHead(404);res.end();return;}
   if((failNavigation&&file==='index.html')||(failManifest&&file==='manifest.webmanifest')){res.writeHead(503);res.end('Unavailable');return;}
   res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.webmanifest')?'application/manifest+json':'image/png');
   res.setHeader('Cache-Control','no-store');res.end(file==='index.html'?content:file==='sw.js'?worker:fs.readFileSync(file));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}/acorn-trail/`;
  const browser=await engine.launch();
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'allow'});
   let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.waitForFunction(()=>offlineReady,{timeout:30000});
   assert.equal(await page.locator('#offline-status').textContent(),'Ready for offline play');
   await page.locator('#install-game').tap();assert.equal(await page.locator('#offline-modal').isVisible(),true);
   assert.match(await page.locator('#offline-modal').textContent(),/Add to Home Screen/);
   fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:path.join('artifacts',`${name}-offline-install-help.png`)});
   await page.locator('#offline-modal').getByRole('button',{name:'Done',exact:true}).tap();
   await page.evaluate(()=>{SETTINGS.sound=false;SETTINGS.readAloud=false;saveSettings();freshStart();go('screen-map');startNextStop();wrongCount=1;saveProgress()});
   const prompt=await page.locator('#ch-prompt').textContent();
   await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url+'?offline=1');await page.waitForFunction(()=>offlineReady,{timeout:15000});
   await page.getByRole('button',{name:'Continue trail'}).tap();assert.equal(await page.locator('#ch-prompt').textContent(),prompt);assert.equal(await page.evaluate(()=>wrongCount),1);
   for(const file of ['manifest.webmanifest','icon-192.png'])assert.equal(await page.evaluate(async f=>(await fetch(f)).status,file),200);
   // A server failure must retain the verified local copy.
   await context.setOffline(false);failNavigation=true;await page.goto(url);await page.waitForFunction(()=>offlineReady,{timeout:15000});assert.equal(await page.title(),'Acorn Trail');
   failNavigation=false;content=original.replace('<title>Acorn Trail</title>','<title>Acorn Trail Updated QA</title>');
   await page.reload();assert.equal(await page.title(),'Acorn Trail Updated QA');await page.waitForFunction(()=>offlineReady);
   await context.setOffline(true);await page.reload();assert.equal(await page.title(),'Acorn Trail Updated QA');await page.waitForFunction(()=>offlineReady);
   await page.getByRole('button',{name:'Continue trail'}).tap();assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
   // A new worker waits during play; an explicit update preserves the save.
   await context.setOffline(false);
   await page.evaluate(async()=>{const other=await caches.open('unrelated-app-qa');await other.put('/unrelated',new Response('keep me'))});
   worker=worker.replace('shell-v1','shell-v2');
   await page.evaluate(()=>offlineRegistration.update());
   await page.waitForFunction(()=>offlineRegistration?.waiting,{timeout:30000});
   assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
   await page.evaluate(()=>go('screen-start'));
   await page.locator('#offline-update').waitFor({state:'visible',timeout:10000});
   await Promise.all([page.waitForEvent('load'),page.locator('#offline-update').tap()]);await page.waitForFunction(()=>offlineReady,{timeout:30000});
   await page.getByRole('button',{name:'Continue trail'}).tap();assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
   assert.equal(await page.evaluate(async()=>(await caches.keys()).includes('unrelated-app-qa')),true);
   // If only cached files are removed, the active worker can repair its shell.
   await page.evaluate(async()=>{for(const key of await caches.keys())if(key.startsWith('acorn-trail:'))await caches.delete(key)});
   await page.goto(url);await page.waitForFunction(()=>offlineReady,{timeout:30000});
   await context.setOffline(true);await page.reload();await page.waitForFunction(()=>offlineReady);
   assert.deepEqual(errors,[]);await context.close();
   // Failed installation cannot claim readiness; reconnecting can retry.
   failManifest=true;content=original;worker=fs.readFileSync('sw.js','utf8');
   const clean=await browser.newContext({serviceWorkers:'allow'});const retry=await clean.newPage();await retry.goto(url);
   await retry.waitForFunction(()=>offlineMessage.includes('unavailable'),{timeout:30000});assert.equal(await retry.evaluate(()=>offlineReady),false);
   failManifest=false;await retry.evaluate(()=>initOffline());await retry.waitForFunction(()=>offlineReady,{timeout:30000});
   await clean.close();
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 });
}
