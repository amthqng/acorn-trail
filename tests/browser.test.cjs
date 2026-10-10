// Developer-only browser QA. Install Playwright, then run: node --test tests/browser.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const fileUrl=pathToFileURL(path.resolve('index.html')).href;
const html=fs.readFileSync('index.html','utf8');
for(const [engineName,engine] of Object.entries({chromium,webkit})){
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  test(`${engineName} offline touch gameplay ${viewport.width}x${viewport.height}`,async()=>{
   const browser=await engine.launch();
   let page;
   try{
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,offline:engineName==='chromium'});
    page=await context.newPage();const errors=[];const remote=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url())&&r.url()!=='http://acorn-trail.test/index.html')remote.push(r.url())});
    await page.clock.install();
    // WebKit's offline network emulation rejects file navigation. Serve the
    // identical single-file bytes through an in-memory route, with no server.
    const url=engineName==='webkit'?'http://acorn-trail.test/index.html':fileUrl;
    if(engineName==='webkit')await context.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:html}));
    await page.goto(url);
    await context.setOffline(true);
    await page.evaluate(()=>{SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.motion=false;saveSettings();setScene(currentScene)});
    await layout();
    assert.equal(await page.evaluate(()=>document.querySelector('.foot-note').getBoundingClientRect().top>=document.getElementById('start-actions').getBoundingClientRect().bottom),true,'intro hint must not cover start buttons');
    await capture('start');
    await page.locator('#screen-start button[aria-label="Grown-up settings"]').tap();await layout();
    const gate=await page.evaluate(()=>gateAnswer);
    await page.locator('#gate-choices').getByRole('button',{name:String(gate),exact:true}).tap();await layout();await capture('settings');
    await page.locator('#seg-math button[data-v="g3"]').tap();
    assert.equal(await page.evaluate(()=>SETTINGS.math),'g3');
    await page.locator('#seg-math button[data-v="g2"]').tap();
    for(const op of ['sub','mul','div','word'])await page.locator(`#ops-row button[data-k="${op}"]`).tap();
    await page.locator('#ops-row button[data-k="add"]').tap();
    assert.equal(await page.evaluate(()=>SETTINGS.ops.add),true);
    for(const op of ['sub','mul','div','word'])await page.locator(`#ops-row button[data-k="${op}"]`).tap();
    await page.locator('#sw-explanations').tap();assert.equal(await page.evaluate(()=>SETTINGS.explanations),true);
    await page.locator('#settings-modal').getByRole('button',{name:'Done',exact:true}).tap();
    await page.getByRole('button',{name:'Make your team'}).tap();await layout();
    await page.getByRole('button',{name:'Edit Biscuit'}).tap();await page.clock.runFor(100);await layout();await capture('team-editor');
    await page.locator('#name-input').fill('Maple');
    await page.locator('#draft-commit').tap();
    await page.locator('#cc-actions').getByRole('button',{name:'Play',exact:false}).tap();
    while(await page.evaluate(()=>currentScreenId==='screen-story')){await layout();await page.locator('#story-next').tap();}
    async function capture(stage){
     fs.mkdirSync('artifacts',{recursive:true});
     await page.screenshot({path:path.join('artifacts',`${engineName}-${viewport.width}x${viewport.height}-${stage}.png`)});
    }
    async function layout(){
     const issue=await page.evaluate(()=>{
      const screen=document.querySelector('.modal.show .modal-card')||document.querySelector('.screen.active');
      return {overflow:screen.scrollWidth>screen.clientWidth+1,active:screen.id||screen.parentElement.id,width:screen.clientWidth,scrollWidth:screen.scrollWidth,outliers:[...screen.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left < -1||r.right>innerWidth+1)}).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:e.getAttribute('class'),rect:e.getBoundingClientRect().toJSON()}))};
     });
     if(issue.active==='screen-challenge')assert.equal(await page.locator('.foot-note').isVisible(),false);
     assert.equal(issue.overflow,false,`horizontal overflow on ${issue.active}: ${JSON.stringify(issue)}`);
    }
    async function dismiss(){
     for(let i=0;i<30&&await page.evaluate(()=>currentScreenId==='screen-sticker-unlock');i++){
      await layout();await page.locator('#screen-sticker-unlock button').tap();
     }
    }
    for(let region=0;region<7;region++){
     for(let stop=0;stop<12;stop++){
      await layout();
      if(stop===0){await page.locator('#screen-map').evaluate(e=>e.scrollTop=0);await capture(`region-${region+1}`);}
      if(region===0&&stop<=1)await page.evaluate(()=>SETTINGS.readAloud=true);
      else await page.evaluate(()=>SETTINGS.readAloud=false);
      await page.evaluate(s=>{SETTINGS.explanations=s%2===0;saveSettings()},stop);
      await page.locator('#map-cta-btn').tap();
      await layout();
      if(region===0&&(stop===0||stop===1)){
       await capture(stop===0?'math-audio':'reading-audio');
       const audio=page.locator('.ans-speak').first();const box=await audio.boundingBox();
       assert.ok(box.width>=44&&box.height>=44);
       await audio.tap();assert.equal(await page.evaluate(()=>answered),false);
       await page.locator('.hint-btn:not(#speak-btn)').tap();assert.equal(await page.evaluate(()=>answered),false);
       const prompt=await page.locator('#ch-prompt').textContent();
       const wrong=await page.evaluate(()=>current.choices.findIndex(c=>c!==current.answer));
       const wrongButton=page.locator('.answer').nth(wrong);const wrongBox=await wrongButton.boundingBox();
       await wrongButton.tap({position:{x:10,y:wrongBox.height/2}});
       if(engineName==='webkit')await context.setOffline(false);
       await page.reload();await context.setOffline(true);await page.clock.runFor(500);
       await page.getByRole('button',{name:'Continue trail'}).tap();
       assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
       assert.equal(await page.evaluate(()=>wrongCount),1);
      }
      const correct=await page.evaluate(()=>current.choices.findIndex(c=>c===current.answer));
      const answerButton=page.locator('.answer').nth(correct);const answerBox=await answerButton.boundingBox();
      await answerButton.tap({position:{x:10,y:answerBox.height/2}});
      await page.clock.runFor(1600);
      if(stop%2===0){
       assert.equal(await page.evaluate(()=>currentScreenId),'screen-challenge');
       assert.ok((await page.locator('#answer-explanation').textContent()).length>20);
       await layout();
       if(region===0&&stop===0){await capture('answer-review');await page.locator('#explanation-audio').tap();assert.equal(await page.evaluate(()=>acorns),1);}
       await page.locator('#answer-review').getByRole('button',{name:'Continue',exact:true}).tap();
      }
      await dismiss();
      assert.equal(await page.evaluate(()=>acorns),region*12+stop+1);
     }
     if(region<6){await page.locator('#screen-transition button').tap();await dismiss()}
    }
    assert.equal(await page.evaluate(()=>currentScreenId),'screen-finale');
    assert.equal(await page.evaluate(()=>STICKERS.every(s=>hasSticker(s.id))),true);
    assert.deepEqual(await page.evaluate(()=>[learning.math.completed,learning.read.completed]),[42,42]);
    await layout();await capture('finale');
    const counts=await page.evaluate(()=>JSON.stringify(stickerCounts));
    await page.getByRole('button',{name:'See my stickers'}).tap();await layout();
    await page.getByRole('button',{name:'Back',exact:true}).tap();
    await page.getByRole('button',{name:'Play again',exact:true}).tap();
    assert.equal(await page.evaluate(()=>acorns),0);
    assert.equal(await page.evaluate(()=>JSON.stringify(stickerCounts)),counts);
    assert.equal(await page.evaluate(()=>current),null);
    await page.locator('#screen-map button[aria-label="Settings"]').tap();
    await page.locator('#gate-choices').getByRole('button',{name:String(await page.evaluate(()=>gateAnswer)),exact:true}).tap();
    await page.locator('#learning-summary').scrollIntoViewIfNeeded();await layout();await capture('learning-summary');
    await page.locator('#learning-summary summary').tap();await layout();
    assert.match(await page.locator('#learning-summary').textContent(),/Math42/);
    await page.locator('#settings-modal').getByRole('button',{name:'Done',exact:true}).tap();
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    await browser.close();
   }catch(e){
    if(page&&!page.isClosed()){try{fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:path.join('artifacts',`${engineName}-${viewport.width}x${viewport.height}-failure.png`)});}catch{}}
    throw e;
   }finally{if(browser.isConnected())await browser.close()}
  });
 }
}

// Desktop screenshots complement the full phone journeys for visual review.
test('desktop illustrated screens fit the browser',async()=>{
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},offline:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(fileUrl);
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
  await page.evaluate(()=>{SETTINGS.motion=false;SETTINGS.sound=false;SETTINGS.readAloud=false;setScene(currentScene)});
  async function capture(name){
   const fits=await page.evaluate(()=>{const e=document.querySelector('.screen.active');return e.scrollWidth<=e.clientWidth+1});
   assert.equal(fits,true,`desktop overflow on ${name}`);
   fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:path.join('artifacts',`desktop-${name}.png`)});
  }
  await capture('start');
  await page.getByRole('button',{name:'Make your team'}).click();await page.getByRole('button',{name:'Edit Biscuit'}).click();await capture('team-editor');
  for(let region=0;region<7;region++){
   await page.evaluate(r=>{themeIndex=r;stopIndex=0;go('screen-map')},region);
   await capture(`region-${region+1}`);
   await page.locator('#map-cta-btn').click();await capture(`challenge-${region+1}`);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
