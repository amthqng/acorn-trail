// Developer-only browser QA. Install Playwright, then run: node --test tests/browser.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const url=pathToFileURL(path.resolve('index.html')).href;
for(const [engineName,engine] of Object.entries({chromium,webkit})){
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  test(`${engineName} offline touch gameplay ${viewport.width}x${viewport.height}`,async()=>{
   const browser=await engine.launch();
   try{
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,offline:true});
    const page=await context.newPage();const errors=[];const remote=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
    await page.clock.install();
    await page.goto(url);
    await page.evaluate(()=>{SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.motion=false;saveSettings()});
    await page.getByRole('button',{name:'Make your team'}).tap();
    await page.getByRole('button',{name:'Edit Biscuit'}).tap();
    await page.locator('#name-input').fill('Maple');
    await page.locator('#draft-commit').tap();
    await page.locator('#cc-actions').getByRole('button',{name:'Play',exact:false}).tap();
    await page.evaluate(()=>go('screen-map'));
    async function layout(){
     const issue=await page.evaluate(()=>{
      const screen=document.querySelector('.screen.active');
      return {overflow:screen.scrollWidth>screen.clientWidth+1,active:screen.id};
     });
     assert.equal(issue.overflow,false,`horizontal overflow on ${issue.active}`);
    }
    async function dismiss(){
     for(let i=0;i<30&&await page.evaluate(()=>currentScreenId==='screen-sticker-unlock');i++){
      await layout();await page.locator('#screen-sticker-unlock button').tap();
     }
    }
    for(let region=0;region<7;region++){
     for(let stop=0;stop<12;stop++){
      await layout();
      await page.locator('#map-cta-btn').tap();
      await layout();
      if(region===0&&stop===0){
       const prompt=await page.locator('#ch-prompt').textContent();
       const wrong=await page.evaluate(()=>current.choices.findIndex(c=>c!==current.answer));
       await page.locator('.answer').nth(wrong).tap();
       await page.reload();await page.clock.runFor(500);
       await page.getByRole('button',{name:'Continue trail'}).tap();
       assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
       assert.equal(await page.evaluate(()=>wrongCount),1);
      }
      const correct=await page.evaluate(()=>current.choices.findIndex(c=>c===current.answer));
      await page.locator('.answer').nth(correct).tap();
      await page.clock.runFor(1600);await dismiss();
      assert.equal(await page.evaluate(()=>acorns),region*12+stop+1);
     }
     if(region<6){await page.locator('#screen-transition button').tap();await dismiss()}
    }
    assert.equal(await page.evaluate(()=>currentScreenId),'screen-finale');
    assert.equal(await page.evaluate(()=>STICKERS.every(s=>hasSticker(s.id))),true);
    await layout();assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    await browser.close();
   }finally{if(browser.isConnected())await browser.close()}
  });
 }
}
