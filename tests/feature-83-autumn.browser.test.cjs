'use strict';
// Requires the existing developer Playwright installation and Chromium.
// Run: node --test tests/feature-83-autumn.browser.test.cjs
// Screenshots go to the system temp directory, never into the playable file.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve('index.html')).href;
const shots=path.join(os.tmpdir(),'acorn-trail-feature-83');

async function activate(page,locator,keyboard=false){
  if(!keyboard){await locator.tap();return;}
  // Reach the control through the real tab order rather than invoking game code.
  for(let i=0;i<150;i++){
    if(await locator.evaluate(el=>el===document.activeElement)){
      await page.keyboard.press('Enter');return;
    }
    await page.keyboard.press('Tab');
  }
  assert.fail('Control is unreachable through Tab: '+await locator.textContent());
}

async function settings(page,keyboard){
  await activate(page,page.locator('.screen.active button[data-icon="gear"]'),keyboard);
  const numbers=(await page.locator('#gate-q').textContent()).match(/\d+/g).map(Number);
  await activate(page,page.locator('#gate-choices').getByRole('button',{name:String(numbers[0]*numbers[1]),exact:true}),keyboard);
  assert.equal(await page.locator('#settings-tab-settings').evaluate(el=>el===document.activeElement),true);
}

async function configure(page,keyboard){
  await settings(page,keyboard);
  for(const id of ['sw-sound','sw-readaloud']){
    if(await page.locator('#'+id).getAttribute('aria-pressed')==='true')await activate(page,page.locator('#'+id),keyboard);
  }
  await activate(page,page.locator('#sw-explanations'),keyboard);
  await activate(page,page.locator('#sw-motion'),keyboard);
  assert.equal(await page.locator('#sw-motion').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#app').evaluate(el=>el.classList.contains('calm')),true);
  await activate(page,page.locator('#settings-modal').getByRole('button',{name:'Done',exact:true}),keyboard);
}

async function fitAndContrast(page,label){
  const result=await page.evaluate(()=>{
    const root=document.querySelector('.modal.show .modal-card')||document.querySelector('.screen.active');
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
    const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
      .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{const l=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (l[0]+.05)/(l[1]+.05);};
    const failures=[];
    let checked=0;
    for(const el of root.querySelectorAll('*')){
      if(el.closest('svg,#particles,.burst,.streak-badge,.answer.used,.answer.dim,[disabled]')||!el.getClientRects().length)continue;
      if(![...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&/[\p{L}\p{N}]/u.test(n.textContent)))continue;
      const style=getComputedStyle(el);
      if(style.visibility!=='visible'||Number(style.opacity)===0)continue;
      const foreground=rgb(style.color);
      // Opaque card/gradient endpoints give a conservative contrast bound.
      // Scenery is deliberately excluded: UI text must have its own surface.
      let backgrounds=[];
      for(let ancestor=el;ancestor&&ancestor.id!=='app';ancestor=ancestor.parentElement){
        const s=getComputedStyle(ancestor);
        const stops=(s.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(rgb);
        if(stops.length&&stops.every(c=>c.length===3||c[3]===1)){backgrounds=stops;break;}
        const color=rgb(s.backgroundColor);
        if(color.length===3||color[3]===1){backgrounds=[color];break;}
      }
      if(!backgrounds.length){failures.push({text:el.textContent.slice(0,60),reason:'no opaque text surface'});continue;}
      checked++;
      for(const bg of backgrounds){
        const value=ratio(foreground,bg);
        const required=parseFloat(style.fontSize)>=24||parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700?3:4.5;
        if(value+.01<required)failures.push({text:el.textContent.slice(0,60),ratio:value,required});
      }
    }
    return {fits:root.scrollWidth<=root.clientWidth+1,checked,failures};
  });
  assert.equal(result.fits,true,label+' horizontal overflow');
  assert.ok(result.checked>0,label+' must check rendered text');
  assert.deepEqual(result.failures,[],label+' text contrast');
  for(const control of await page.locator('.screen.active .icon-btn,.screen.active .answer,.screen.active .activity-card,.screen.active .hint-btn').all()){
    if(!await control.isVisible())continue;
    const box=await control.boundingBox();
    assert.ok(box.width>=44&&box.height>=44,label+' touch target: '+await control.getAttribute('class'));
  }
}

async function decorationAudit(page){
  assert.equal(await page.locator('#scenery').getAttribute('aria-hidden'),'true');
  assert.equal(await page.locator('#particles').getAttribute('aria-hidden'),'true');
  assert.equal(await page.locator('#scenery button,#scenery a,#scenery [tabindex],#scenery [role="button"]').count(),0);
  const trees=await page.locator('#scenery .autumn-decor .map-tree').evaluateAll(nodes=>nodes.map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {visible:r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight,events:s.pointerEvents,animation:s.animationName};
  }));
  assert.equal(trees.length,4);
  assert.ok(trees.every(t=>t.visible&&t.events==='none'&&t.animation==='none'),'all four edge trees must fit and remain static/non-interactive');
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0,'reduced motion must stop running animations');
}

async function screenshot(page,name){
  fs.mkdirSync(shots,{recursive:true});
  await page.screenshot({path:path.join(shots,name+'.png')});
}

async function solve(page,keyboard){
  const format=await page.evaluate(()=>current.format||null);
  if(!format){
    const answer=await page.evaluate(()=>String(current.answer));
    const index=await page.locator('.answer').evaluateAll((buttons,answer)=>buttons.findIndex(b=>b.dataset.val===answer),answer);
    await activate(page,page.locator('.answer').nth(index),keyboard);
    return;
  }
  while(await page.evaluate(()=>!!current&&!answered)){
    if(format==='order'){
      const next=await page.evaluate(()=>current.sequence[current.activityState.done.length]);
      await activate(page,page.locator(`#activity [data-side="order"][data-index="${next}"]`),keyboard);
    }else{
      const left=await page.evaluate(()=>current.pairs.findIndex((_,i)=>!current.activityState.done.includes(i)));
      await activate(page,page.locator(`#activity [data-side="left"][data-index="${left}"]`),keyboard);
      const right=await page.evaluate(()=>current.choices.indexOf(current.pairs[current.activityState.selected].right));
      await activate(page,page.locator(`#activity [data-side="right"][data-index="${right}"]`),keyboard);
    }
  }
}

for(const config of [
  {name:'desktop-light-keyboard',viewport:{width:1280,height:800},keyboard:true,colorScheme:'light'},
  {name:'iphone-size-dark-touch',viewport:{width:390,height:844},keyboard:false,colorScheme:'dark'}
]){
  test(config.name+': offline team, all 84 stops, rewards and reload/resume',{timeout:240000},async()=>{
    const browser=await chromium.launch();
    try{
      const context=await browser.newContext({viewport:config.viewport,isMobile:!config.keyboard,hasTouch:true,offline:true,
        reducedMotion:'reduce',colorScheme:config.colorScheme});
      const page=await context.newPage(),errors=[],remote=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
      await page.clock.install();
      await page.goto(url);
      await fitAndContrast(page,'start');await decorationAudit(page);
      await screenshot(page,config.name+'-start');
      await configure(page,config.keyboard);
      await activate(page,page.getByRole('button',{name:'Make your team'}),config.keyboard);
      await fitAndContrast(page,'team');
      await activate(page,page.getByRole('button',{name:'Edit Biscuit'}),config.keyboard);
      await page.locator('#name-input').fill('Maple');
      await fitAndContrast(page,'friend');
      await activate(page,page.locator('#draft-commit'),config.keyboard);
      await activate(page,page.locator('#cc-actions').getByRole('button',{name:/^Start (new )?adventure/}),config.keyboard);
      while(await page.locator('#screen-story').isVisible()){
        await fitAndContrast(page,'story');
        await activate(page,page.locator('#story-next'),config.keyboard);
      }
      for(let region=0;region<7;region++){
        for(let stop=0;stop<12;stop++){
          assert.equal(await page.locator('#screen-map').isVisible(),true);
          if(stop===0){
            await fitAndContrast(page,'map-'+region);await decorationAudit(page);
            await screenshot(page,config.name+'-map-'+region);
          }
          await activate(page,page.locator('#map-cta-btn'),config.keyboard);
          await fitAndContrast(page,'challenge-'+region+'-'+stop);
          if(stop===0)await screenshot(page,config.name+'-challenge-'+region);
          if(region===0&&stop<2){
            await activate(page,page.locator('.hint-btn:not(#speak-btn)'),config.keyboard);
            await fitAndContrast(page,'hint');
            const wrong=await page.evaluate(()=>current.choices.findIndex(c=>c!==current.answer));
            await activate(page,page.locator('.answer').nth(wrong),config.keyboard);
            assert.equal(await page.locator('#feedback').getAttribute('aria-live'),'polite');
            const before=await page.evaluate(()=>JSON.stringify({question:current,acorns,themeIndex,stopIndex,wrongCount,streak,roster:ROSTER,stickers:stickerCounts}));
            await page.reload();
            await activate(page,page.getByRole('button',{name:'Continue trail'}),config.keyboard);
            assert.equal(await page.evaluate(()=>JSON.stringify({question:current,acorns,themeIndex,stopIndex,wrongCount,streak,roster:ROSTER,stickers:stickerCounts})),before,'reload must retain the exact question, customized team and progress');
            await decorationAudit(page);
          }
          await solve(page,config.keyboard);
          await page.clock.runFor(1500);
          assert.equal(await page.locator('#answer-review').isVisible(),true);
          await fitAndContrast(page,'answer-review');
          await activate(page,page.locator('#answer-review').getByRole('button',{name:'Continue',exact:true}),config.keyboard);
          while(await page.locator('#screen-sticker-unlock').isVisible()){
            await fitAndContrast(page,'sticker reward');
            await activate(page,page.locator('#screen-sticker-unlock button'),config.keyboard);
          }
        }
        if(region<6){
          await fitAndContrast(page,'transition');
          await activate(page,page.locator('#screen-transition button'),config.keyboard);
          while(await page.locator('#screen-sticker-unlock').isVisible())await activate(page,page.locator('#screen-sticker-unlock button'),config.keyboard);
        }
      }
      assert.equal(await page.locator('#screen-finale').isVisible(),true);
      assert.equal(await page.locator('#finale-acorns').textContent(),'84');
      await fitAndContrast(page,'finale');await screenshot(page,config.name+'-finale');
      await activate(page,page.locator('#screen-finale button[data-icon="basket"]'),config.keyboard);
      await fitAndContrast(page,'basket');
      assert.ok(await page.locator('.sticker.unlocked').count()>0);
      assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
      await context.close();
    }finally{await browser.close();}
  });
}

test('small phone: larger text, dialog tab/arrow/Escape keys, switches and restart preserve the save',{timeout:90000},async()=>{
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,offline:true,colorScheme:'light',reducedMotion:'reduce'});
    const page=await context.newPage();await page.goto(url);
    // Browser text-size adjustment emulates larger mobile text without removing
    // styles, decorations or controls from the application under test.
    await page.addStyleTag({content:'html{-webkit-text-size-adjust:150%;text-size-adjust:150%}'});
    await fitAndContrast(page,'larger mobile start');
    await activate(page,page.getByRole('button',{name:'Start the Trail'}),true);
    await activate(page,page.locator('.story-skip'),true);
    await activate(page,page.locator('#map-cta-btn'),true);
    const saved=await page.evaluate(()=>localStorage.getItem('acorn-trail-progress'));
    await page.reload();
    await activate(page,page.getByRole('button',{name:'Continue trail'}),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('acorn-trail-progress')),saved);
    await page.reload();
    await settings(page,true);
    await fitAndContrast(page,'settings');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#settings-tab-progress').getAttribute('aria-selected'),'true');
    assert.match(await page.locator('#settings-modal').ariaSnapshot(),/tab "Progress" \[selected\]/);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#settings-tab-settings').getAttribute('aria-selected'),'true');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#settings-modal').getByRole('button',{name:'Done',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#settings-tab-settings').evaluate(el=>el===document.activeElement),true);
    for(const id of ['sw-sound','sw-readaloud','sw-reveal','sw-explanations','sw-adaptive','sw-motion']){
      const toggle=page.locator('#'+id),before=await toggle.getAttribute('aria-pressed');
      await activate(page,toggle,true);
      assert.equal(await toggle.getAttribute('aria-pressed'),String(before!=='true'));
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settings-modal').isVisible(),false);
    assert.equal(await page.locator('#screen-start button[data-icon="gear"]').evaluate(el=>el===document.activeElement),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('acorn-trail-progress')),saved);
    // A fresh run provides the normal map UI for restart/cancel checks.
    await activate(page,page.getByRole('button',{name:'Start over',exact:true}),true);
    await activate(page,page.locator('.story-skip'),true);
    await activate(page,page.locator('#map-cta-btn'),true);
    await page.reload();await activate(page,page.getByRole('button',{name:'Continue trail'}),true);
    // Complete the first question normally to reach the map again.
    await solve(page,true);
    await activate(page,page.locator('#answer-review').getByRole('button',{name:'Continue',exact:true}),true);
    while(await page.locator('#screen-sticker-unlock').isVisible())await activate(page,page.locator('#screen-sticker-unlock button'),true);
    const checkpoint=await page.evaluate(()=>localStorage.getItem('acorn-trail-progress'));
    await activate(page,page.locator('#screen-map button[data-icon="restart"]'),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#restart-modal').isVisible(),false);
    assert.equal(await page.evaluate(()=>localStorage.getItem('acorn-trail-progress')),checkpoint);
    await activate(page,page.locator('#screen-map button[data-icon="restart"]'),true);
    await activate(page,page.locator('#restart-modal').getByRole('button',{name:'Start over',exact:true}),true);
    assert.equal(await page.locator('#acorn-num').textContent(),'0');
    await fitAndContrast(page,'restarted map');
    await screenshot(page,'small-phone-settings-and-restart');
  }finally{await browser.close();}
});
