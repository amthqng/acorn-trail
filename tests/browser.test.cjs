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
   const adaptiveMode=viewport.width!==320;
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
    assert.equal(await page.evaluate(()=>SETTINGS.adaptive),false);
    if(adaptiveMode){await page.locator('#sw-adaptive').tap();assert.equal(await page.locator('#sw-adaptive').getAttribute('aria-pressed'),'true');await layout();await capture('adaptive-settings');}
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
    const readingSeen=new Set();
    for(let region=0;region<7;region++){
     for(let stop=0;stop<12;stop++){
      await layout();
      if(stop===0){await page.locator('#screen-map').evaluate(e=>e.scrollTop=0);await capture(`region-${region+1}`);}
      if(region===0&&stop<=1)await page.evaluate(()=>SETTINGS.readAloud=true);
      else await page.evaluate(()=>SETTINGS.readAloud=false);
      await page.evaluate(s=>{SETTINGS.explanations=s%2===0;saveSettings()},stop);
      await page.locator('#map-cta-btn').tap();
      await layout();
      assert.equal(await page.locator('#ch-host svg').getAttribute('data-expression'),'ready');
      assert.ok((await page.locator('.host-greeting').textContent()).length>10);
      if(region===0&&(stop===0||stop===1)){
       await capture(stop===0?'math-audio':'reading-audio');
       const audio=page.locator('.ans-speak').first();const box=await audio.boundingBox();
       assert.ok(box.width>=44&&box.height>=44);
       await audio.tap();assert.equal(await page.evaluate(()=>answered),false);
       await page.locator('.hint-btn:not(#speak-btn)').tap();assert.equal(await page.evaluate(()=>answered),false);
       assert.equal(await page.locator('#ch-host svg').getAttribute('data-expression'),'thoughtful');
       assert.equal(await page.locator('#hint-emoji svg').getAttribute('data-expression'),'thoughtful');
       await layout();await capture('character-hint');
       const prompt=await page.locator('#ch-prompt').textContent();
       const wrong=await page.evaluate(()=>current.choices.findIndex(c=>c!==current.answer));
       const wrongButton=page.locator('.answer').nth(wrong);const wrongBox=await wrongButton.boundingBox();
       await wrongButton.tap({position:{x:10,y:wrongBox.height/2}});
       assert.equal(await page.locator('#ch-host svg').getAttribute('data-expression'),'encouraging');
       assert.match(await page.locator('#feedback').textContent(),new RegExp(await page.evaluate(()=>current.hostChar.name)));
       const greeting=await page.locator('.host-greeting').textContent();
       await layout();await capture('character-encouragement');
       const savedHistory=await page.evaluate(()=>JSON.stringify(loadVariety()));
       if(engineName==='webkit')await context.setOffline(false);
       await page.reload();await context.setOffline(true);await page.clock.runFor(500);
       await page.getByRole('button',{name:'Continue trail'}).tap();
       assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
       assert.equal(await page.evaluate(()=>wrongCount),1);
       assert.equal(await page.locator('#ch-host svg').getAttribute('data-expression'),'encouraging');
       assert.equal(await page.locator('.host-greeting').textContent(),greeting);
       assert.equal(await page.evaluate(()=>JSON.stringify(variety)),savedHistory,'resume must not draw a replacement question');
      }
      if(adaptiveMode&&((region===0&&(stop===2||stop===3))||(region===1&&stop<4)))await page.locator('.hint-btn:not(#speak-btn)').tap();
      if(adaptiveMode&&region===1&&stop===4)assert.equal(await page.evaluate(()=>READING_TIERS[0].includes(current.skill)),true,'gentler reading must use the preceding tier');
      if(adaptiveMode&&region===1&&stop===5)assert.equal(await page.evaluate(()=>['addition','subtraction','multiplication'].includes(current.skill)),true,'gentler math must use level one skills');
      const readingId=await page.evaluate(()=>current.kind==='read'?current.readingId:null);
      if(readingId){assert.equal(readingSeen.has(readingId),false,'reading entries should vary across this trail');readingSeen.add(readingId);}
      const format=await page.evaluate(()=>current.format||null);
      if(format){
       if(region===0)await capture('activity-'+format);
       while(await page.evaluate(()=>!!current&&!answered)){
        const target=await page.evaluate(()=>{
         if(current.format==='order')return {side:'order',index:current.sequence[current.activityState.done.length]};
         return {side:'right',left:current.pairs.findIndex((_,i)=>!current.activityState.done.includes(i)),index:0};
        });
        if(format==='match'){
         await page.locator(`#activity [data-side="left"][data-index="${target.left}"]`).tap();
         target.index=await page.evaluate(()=>current.choices.indexOf(current.pairs[current.activityState.selected].right));
        }
        await page.locator(`#activity [data-side="${target.side}"][data-index="${target.index}"]`).tap();
        await layout();
       }
      }else{
       const correct=await page.evaluate(()=>current.choices.findIndex(c=>c===current.answer));
       const answerButton=page.locator('.answer').nth(correct);const answerBox=await answerButton.boundingBox();
       await answerButton.tap({position:{x:10,y:answerBox.height/2}});
      }
      assert.equal(await page.locator('#ch-host svg').getAttribute('data-expression'),'happy');
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
      if(adaptiveMode&&region<=1){
       const subject=await page.evaluate(s=>THEMES[themeIndex].stops[s],stop);
       if(stop===2)assert.equal(await page.evaluate(k=>adaptive[k].offset,subject),-1);
       if(stop===3){
        assert.equal(await page.evaluate(k=>adaptive[k].offset,subject),-1);
        await page.locator('#screen-map button[aria-label="Settings"]').tap();
        await page.locator('#gate-choices').getByRole('button',{name:String(await page.evaluate(()=>gateAnswer)),exact:true}).tap();
        await page.locator('#adaptive-status').scrollIntoViewIfNeeded();await layout();await capture(`adaptive-gentler-region-${region+1}`);
        assert.match(await page.locator('#adaptive-status').textContent(),/Math: gentler practice. Reading: gentler practice/);
        await page.locator('#settings-modal').getByRole('button',{name:'Done',exact:true}).tap();
       }
       if(stop===10||stop===11)assert.equal(await page.evaluate(k=>adaptive[k].offset,subject),0);
      }
     }
     if(region<6){await page.locator('#screen-transition button').tap();await dismiss()}
    }
    assert.equal(await page.evaluate(()=>currentScreenId),'screen-finale');
    assert.equal(await page.evaluate(()=>STICKERS.every(s=>hasSticker(s.id))),true);
    assert.deepEqual(await page.evaluate(()=>[learning.math.completed,learning.read.completed]),[42,42]);
    await layout();await capture('finale');
    const counts=await page.evaluate(()=>JSON.stringify(stickerCounts));
    const questionHistory=await page.evaluate(()=>JSON.stringify(variety));
    await page.getByRole('button',{name:'See my stickers'}).tap();await layout();
    await page.getByRole('button',{name:'Back',exact:true}).tap();
    await page.getByRole('button',{name:'Play again',exact:true}).tap();
    assert.equal(await page.evaluate(()=>acorns),0);
    assert.equal(await page.evaluate(()=>JSON.stringify(stickerCounts)),counts);
    assert.equal(await page.evaluate(()=>JSON.stringify(variety)),questionHistory,'replay must retain question variety history');
    assert.equal(await page.evaluate(()=>current),null);
    await page.locator('#screen-map button[aria-label="Settings"]').tap();
    await page.locator('#gate-choices').getByRole('button',{name:String(await page.evaluate(()=>gateAnswer)),exact:true}).tap();
    await page.locator('#learning-summary').scrollIntoViewIfNeeded();await layout();await capture('learning-summary');
    await page.locator('#learning-summary summary').tap();await layout();
    assert.match(await page.locator('#learning-summary').textContent(),/Math42/);
    if(adaptiveMode){await page.locator('#sw-adaptive').tap();assert.equal(await page.locator('#sw-adaptive').getAttribute('aria-pressed'),'false');assert.deepEqual(await page.evaluate(()=>[adaptive.math.offset,adaptive.read.offset]),[0,0]);}
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
  await page.evaluate(()=>{
   const gallery=document.createElement('div');gallery.id='character-gallery';
   gallery.style.cssText='position:fixed;inset:0;z-index:9999;background:#fff7e8;padding:16px;overflow:auto;display:grid;grid-template-columns:repeat(6,1fr);gap:10px;align-content:start';
   gallery.innerHTML=ANIMALS.map(animal=>`<div style="text-align:center;font:14px sans-serif">${esc(animal)}<div style="display:flex">${['ready','happy','thoughtful','encouraging'].map(m=>`<div style="width:25%">${camperGlyph(animal,m)}</div>`).join('')}</div></div>`).join('');
   document.body.appendChild(gallery);
  });
  await page.screenshot({path:path.join('artifacts','desktop-character-expressions.png')});
  assert.equal(await page.locator('#character-gallery svg').count(),await page.evaluate(()=>ANIMALS.length*4));
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});

for(const [engineName,engine] of Object.entries({chromium,webkit})){
 test(`${engineName} tap activities preserve partial progress and guided touch controls`,async()=>{
  const browser=await engine.launch();
  try{
   const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,offline:engineName==='chromium'});
   const page=await context.newPage();const errors=[];const remote=[];
   const url=engineName==='webkit'?'http://acorn-trail.test/index.html':fileUrl;
   if(engineName==='webkit')await context.route(url,r=>r.fulfill({status:200,contentType:'text/html',body:html}));
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&r.url()!==url)remote.push(r.url())});
   await page.clock.install();await page.goto(url);await context.setOffline(true);
   for(const format of ['order','match']){
    await page.evaluate(f=>{
     restart();SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.motion=false;SETTINGS.explanations=true;SETTINGS.reveal=true;SETTINGS.math='g3';saveSettings();
     themeIndex=0;stopIndex=f==='order'?4:5;
     if(f==='order'){SETTINGS.ops={add:true,sub:false,mul:false,div:false,word:false};startNextStop();}
     else{const q=buildReading('rhyme',READING.rhyme[0]);q.readingId='rhyme:0';current=makeTrailActivity(q,THEMES[0],5);current.hostChar=ROSTER[1];current.helper=ROSTER[3];loadChallenge(current);saveProgress();go('screen-challenge');}
    },format);
    assert.equal(await page.evaluate(()=>current.format),format);
    async function fits(){assert.equal(await page.locator('#screen-challenge').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);for(const b of await page.locator('#activity button:visible').all()){const box=await b.boundingBox();assert.ok(box.width>=44&&box.height>=44);}}
    await fits();
    if(format==='match'){
     const first=page.locator('#activity [data-side="left"][data-index="0"]');await first.focus();await page.keyboard.press('Enter');
     assert.equal(await page.evaluate(()=>document.activeElement.dataset.side),'left','selecting a card must retain keyboard focus');
    }
    const wrong=await page.evaluate(()=>current.format==='order'?current.sequence[1]:current.choices.indexOf(current.pairs[1].right));
    const side=format==='order'?'order':'right';
    await page.locator(`#activity [data-side="${side}"][data-index="${wrong}"]`).tap();await page.clock.runFor(450);
    await page.locator(`#activity [data-side="${side}"][data-index="${wrong}"]`).tap();await page.clock.runFor(450);
    assert.equal(await page.evaluate(()=>wrongCount),2);assert.equal(await page.evaluate(()=>acorns),0);
    assert.equal(await page.locator('#activity .reveal').count(),1);
    const first=await page.evaluate(()=>current.format==='order'?current.sequence[0]:current.choices.indexOf(current.pairs[0].right));
    await page.locator(`#activity [data-side="${side}"][data-index="${first}"]`).tap();
    assert.equal(await page.evaluate(()=>acorns),0);assert.equal(await page.evaluate(()=>current.activityState.done.length),1);
    if(format==='order'){
     await page.locator('.activity-undo').focus();await page.keyboard.press('Enter');
     assert.equal(await page.evaluate(()=>current.activityState.done.length),0);
     await page.locator(`#activity [data-side="order"][data-index="${first}"]`).tap();
    }
    const snapshot=await page.evaluate(()=>JSON.stringify({choices:current.choices,state:current.activityState,prompt:current.prompt}));
    if(engineName==='webkit')await context.setOffline(false);
    await page.reload();await context.setOffline(true);await page.getByRole('button',{name:'Continue trail'}).tap();
    assert.equal(await page.evaluate(()=>JSON.stringify({choices:current.choices,state:current.activityState,prompt:current.prompt})),snapshot);
    assert.equal(await page.evaluate(()=>wrongCount),2);await fits();
    fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:path.join('artifacts',`${engineName}-320x568-${format}-resumed.png`)});
    while(await page.evaluate(()=>!!current&&!answered)){
     const left=await page.evaluate(()=>current.format==='match'?current.pairs.findIndex((_,i)=>!current.activityState.done.includes(i)):null);
     if(left!==null&&await page.evaluate(()=>current.activityState.selected)!==left)await page.locator(`#activity [data-side="left"][data-index="${left}"]`).tap();
     const next=await page.evaluate(()=>current.format==='order'?current.sequence[current.activityState.done.length]:current.choices.indexOf(current.pairs[current.activityState.selected].right));
     await page.locator(`#activity [data-side="${side}"][data-index="${next}"]`).tap();
    }
    assert.equal(await page.evaluate(()=>acorns),1);assert.equal(await page.locator('#answer-review').isVisible(),true);await fits();
    await page.evaluate(()=>answerActivity(null,0));assert.equal(await page.evaluate(()=>acorns),1);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  }finally{await browser.close()}
 });
}
