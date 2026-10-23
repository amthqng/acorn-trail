'use strict';
// Real offline DOM checks. Phone viewports emulate touch; they are not physical
// iPhone/VoiceOver testing. Run alongside QA's full 84-stop browser journey.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');

for(const scenario of [
  {name:'desktop light',viewport:{width:1280,height:800},colorScheme:'light'},
  {name:'phone touch dark',viewport:{width:390,height:844},colorScheme:'dark'},
  {name:'small phone larger text',viewport:{width:320,height:568},colorScheme:'light',largeText:true}
])test('fall theme: '+scenario.name,{timeout:90000},async()=>{
  const browser=await chromium.launch();
  try{
    const mobile=scenario.viewport.width<500;
    const context=await browser.newContext({viewport:scenario.viewport,isMobile:mobile,hasTouch:mobile,offline:true,colorScheme:scenario.colorScheme,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[],remote=[];
    const screenshots=fs.mkdtempSync(path.join(os.tmpdir(),'feature-83-'));
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
    await page.clock.install();
    await page.goto(pathToFileURL(path.resolve('index.html')).href);
    const activate=async locator=>mobile?locator.tap():locator.click();
    async function tabTo(locator){
      for(let i=0;i<120;i++){
        if(await locator.evaluate(el=>el===document.activeElement))return;
        await page.keyboard.press('Tab');
      }
      assert.fail('Control must be reachable with Tab: '+locator);
    }
    async function inspect(stage,selectors){
      if(scenario.largeText)await page.evaluate(()=>{
        for(const el of document.querySelectorAll('.screen.active h1,.screen.active h2,.screen.active button,.screen.active .ch-prompt,.screen.active .ch-sub,.screen.active .story-text')){
          if(el.dataset.fontScaled)continue;
          el.style.fontSize=parseFloat(getComputedStyle(el).fontSize)*1.5+'px';el.dataset.fontScaled='true';
        }
      });
      const report=await page.evaluate(selectors=>{
        const rgb=s=>s.match(/[\d.]+/g).map(Number);
        const lum=c=>{const v=c.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
        const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
        const failures=[];
        for(const selector of selectors)for(const el of document.querySelectorAll(selector)){
          if(!el.getClientRects().length)continue;
          const fg=rgb(getComputedStyle(el).color);let bg=[];
          for(let parent=el;parent&&bg.length===0;parent=parent.parentElement){
            const style=getComputedStyle(parent);
            bg=[...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m=>rgb(m[0]));
            if(!bg.length){const color=rgb(style.backgroundColor);if(color.length===3||color[3]===1)bg=[color];}
          }
          if(bg.length===0||bg.some(color=>ratio(fg,color)<4.5))failures.push({selector,fg,bg});
        }
        const screen=document.querySelector('.screen.active');
        const decor=document.querySelector('.autumn-decor');
        return {failures,overflow:screen.scrollWidth>screen.clientWidth+1,
          hidden:document.querySelector('#scenery').getAttribute('aria-hidden'),
          pointerEvents:getComputedStyle(decor).pointerEvents,
          moving:decor.getAnimations({subtree:true}).length,
          artControls:decor.querySelectorAll('a,button,[tabindex],foreignObject').length};
      },selectors);
      assert.deepEqual(report.failures,[],stage+' computed contrast');
      assert.equal(report.overflow,false,stage+' horizontal overflow');
      assert.equal(report.hidden,'true');assert.equal(report.pointerEvents,'none');
      assert.equal(report.moving,0);assert.equal(report.artControls,0);
      await page.screenshot({path:path.join(screenshots,stage+'.png')});
    }
    await inspect('start',['.title-lockup h1','.title-lockup p','.lead-tag','.foot-note','#start-actions button']);
    await activate(page.locator('#install-game'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#offline-modal').isVisible(),false);
    await activate(page.getByRole('button',{name:'Grown-up settings',exact:true}));
    const factors=(await page.locator('#gate-q').textContent()).match(/\d+/g).map(Number);
    await activate(page.locator('#gate-choices').getByRole('button',{name:String(factors[0]*factors[1]),exact:true}));
    await tabTo(page.locator('#settings-tab-settings'));
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#settings-tab-progress').getAttribute('aria-selected'),'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.locator('#settings-tab-settings').getAttribute('aria-selected'),'true');
    await activate(page.locator('#sw-sound'));await activate(page.locator('#sw-readaloud'));
    await activate(page.locator('#settings-modal').getByRole('button',{name:'Done',exact:true}));
    const team=page.getByRole('button',{name:'Make your team',exact:true});
    await tabTo(team);await page.keyboard.press('Enter');
    await activate(page.getByRole('button',{name:'Edit Biscuit',exact:true}));
    await page.locator('#name-input').fill('Maple');await activate(page.locator('#draft-commit'));
    await activate(page.locator('#cc-actions').getByRole('button',{name:/^Start (new )?adventure/}));
    while(await page.locator('#screen-story').isVisible())await activate(page.locator('#story-next'));
    await inspect('map',['.theme-head h2','.theme-head .eyebrow','.theme-head .subtitle','.camp-map-caption','.lantern .lbl','.kind','#map-cta-btn']);
    await activate(page.locator('#map-cta-btn'));
    const challengeText=['#ch-prompt','#ch-sub','.host-name','#screen-challenge .answer','#screen-challenge .hint-btn'];
    await inspect('math',challengeText);
    for(const selector of ['.answer','.hint-btn:not(#speak-btn)']){
      const rect=await page.locator(selector).first().boundingBox();
      assert.ok(rect.width>=44&&rect.height>=44,'challenge touch targets stay at least 44px');
    }
    const hint=page.locator('.hint-btn:not(#speak-btn)');await tabTo(hint);await page.keyboard.press('Enter');
    assert.equal(await page.locator('#hint-bubble').isVisible(),true);
    const correct=await page.evaluate(()=>current.choices.findIndex(c=>c===current.answer));
    await tabTo(page.locator('.answer').nth(correct));await page.keyboard.press('Enter');
    assert.equal(await page.locator('#feedback').getAttribute('aria-live'),'polite');
    assert.ok((await page.locator('#feedback').textContent()).trim());
    await page.clock.runFor(1600);
    while(await page.locator('#screen-sticker-unlock').isVisible())await activate(page.locator('#screen-sticker-unlock button'));
    await activate(page.locator('#map-cta-btn'));
    await inspect('reading',challengeText);
    const prompt=await page.locator('#ch-prompt').textContent();
    const save=await page.evaluate(()=>localStorage.getItem('acorn-trail-progress'));
    await page.reload();
    await activate(page.getByRole('button',{name:'Continue trail',exact:true}));
    assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
    assert.equal(await page.evaluate(()=>localStorage.getItem('acorn-trail-progress')),save);
    assert.equal(await page.locator('#scenery .autumn-decor').count(),1);
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    console.log(scenario.name+' screenshots: '+screenshots);
  }finally{await browser.close();}
});
