'use strict';
// Run: node --test tests/feature-83-autumn-journey.browser.test.cjs
// Uses the actual file:// game. App state is read to solve questions, never
// changed to unlock regions or enable the theme. Screenshots go outside the repo.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const gameUrl=pathToFileURL(path.join(__dirname,'../index.html')).href;

async function activate(page,locator,touch){
  await locator.scrollIntoViewIfNeeded();
  if(touch)await locator.tap();
  else{await locator.focus();await page.keyboard.press('Enter');}
}
async function settings(page,touch){
  await activate(page,page.locator('.screen.active button[aria-label="Grown-up settings"],.screen.active button[aria-label="Settings"]'),touch);
  const answer=await page.evaluate(()=>gateAnswer);
  await activate(page,page.locator('#gate-choices').getByRole('button',{name:String(answer),exact:true}),touch);
}
async function assertLayout(page){
  const layout=await page.evaluate(()=>{
    const el=document.querySelector('.modal.show .modal-card')||document.querySelector('.screen.active');
    return {id:el.id||el.parentElement.id,width:el.clientWidth,content:el.scrollWidth};
  });
  assert.ok(layout.content<=layout.width+1,JSON.stringify(layout));
}
async function audit(page){
  await assertLayout(page);
  const issues=await page.evaluate(()=>{
    const problems=[];
    const rgb=s=>s.match(/[\d.]+/g).map(Number);
    const luminance=c=>c.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4)
      .reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
    const selectors='.screen.active h1,.screen.active h2,.screen.active p,.screen.active .subtitle,.screen.active .eyebrow,.screen.active .name,.screen.active .lead-tag,.screen.active .lbl,.screen.active .pl,.screen.active .st-name,.screen.active .st-hint,.screen.active .story-text,.screen.active .ch-prompt,.screen.active .ch-sub,.screen.active .host-name,.screen.active .host-kind,.screen.active .host-greeting,.screen.active .ans-txt,.screen.active .ans-speak,.screen.active .feedback,.screen.active .hint-bubble,.screen.active .camp-map-heading,.screen.active .camp-map-heading small,.screen.active .camp-map-caption,.screen.active button,.modal.show h3,.modal.show h4,.modal.show .set-note,.modal.show button';
    for(const el of document.querySelectorAll(selectors)){
      if(!el.getClientRects().length||el.closest('[hidden]')||el.disabled||!el.textContent.trim())continue;
      const style=getComputedStyle(el);
      // Dimmed incorrect answers are disabled visually by existing gameplay.
      if(el.closest('.dim,.used'))continue;
      let backgrounds=[];
      for(let ancestor=el;ancestor;ancestor=ancestor.parentElement){
        const s=getComputedStyle(ancestor);
        if(s.backgroundImage!=='none'){
          backgrounds=[...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m=>rgb(m[0]));
          if(backgrounds.length&&backgrounds.every(c=>c.length===3||c[3]===1))break;
        }
        const color=rgb(s.backgroundColor);
        if(color.length===3||color[3]===1){backgrounds=[color];break;}
      }
      if(!backgrounds.length){problems.push('No opaque surface: '+el.outerHTML.slice(0,130));continue;}
      const foreground=rgb(style.color);
      // Account for the story-skip opacity without lowering the AA threshold.
      const opacity=Number(style.opacity);
      const worst=Math.min(...backgrounds.map(bg=>ratio(foreground.map((c,i)=>i<3?c*opacity+bg[i]*(1-opacity):c),bg)));
      const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
      if(worst<(large?3:4.5))problems.push(`${el.className||el.id}: ${worst.toFixed(2)}:1 (${el.textContent.trim().slice(0,50)})`);
    }
    // SVG labels use a parchment stroke as their immediate background.
    for(const el of document.querySelectorAll('#camp-map-world text')){
      const s=getComputedStyle(el);
      if(s.paintOrder!=='stroke'||parseFloat(s.strokeWidth)<2||ratio(rgb(s.fill),rgb(s.stroke))<4.5)problems.push('map label contrast: '+el.textContent);
    }
    const scenery=document.querySelector('#scenery');
    if(scenery.getAttribute('aria-hidden')!=='true')problems.push('scenery exposed to accessibility tree');
    if(getComputedStyle(scenery).pointerEvents!=='none')problems.push('scenery intercepts input');
    for(const el of document.querySelectorAll('.autumn-decor,.map-tree,.autumn-leaf,.autumn-acorn')){
      if(el.getAttribute('aria-hidden')!=='true'||getComputedStyle(el).pointerEvents!=='none')problems.push('interactive or announced decoration');
      if(el.querySelector('animate,animateMotion,animateTransform,a,button,[tabindex]'))problems.push('animated or focusable decoration');
    }
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){
      if(document.getAnimations().some(a=>a.playState==='running'))problems.push('animation active with reduced motion');
      if(document.querySelector('#camp-map-world animateMotion'))problems.push('map travel active with reduced motion');
    }
    return problems;
  });
  assert.deepEqual(issues,[],'rendered contrast, scenery and reduced motion audit');
}
async function solve(page,touch){
  while(await page.evaluate(()=>current&&!answered)){
    const target=await page.evaluate(()=>{
      if(current.format==='order')return {side:'order',index:current.sequence[current.activityState.done.length]};
      if(current.format==='match'){
        const left=current.pairs.findIndex((_,i)=>!current.activityState.done.includes(i));
        return {side:'right',left,index:current.choices.indexOf(current.pairs[left].right)};
      }
      return {index:current.choices.indexOf(current.answer)};
    });
    if(target.left!==undefined)await activate(page,page.locator(`#activity [data-side="left"][data-index="${target.left}"]`),touch);
    const choice=target.side?page.locator(`#activity [data-side="${target.side}"][data-index="${target.index}"]`):page.locator('.answer').nth(target.index);
    await choice.scrollIntoViewIfNeeded();
    // The speaker is a separate target at the top right of each answer.
    if(touch)await choice.tap({position:{x:12,y:12}});
    else{await choice.focus();await page.keyboard.press('Enter');}
  }
}
async function dismissRewards(page,touch){
  for(let i=0;i<30&&await page.locator('#screen-sticker-unlock').isVisible();i++){
    await audit(page);
    await activate(page,page.locator('#screen-sticker-unlock button'),touch);
  }
}

for(const touch of [true,false]){
  test(`fall theme: ${touch?'iPhone-sized touch':'desktop keyboard'} offline journey, contrast and saved resume`,{timeout:240000},async t=>{
    const browser=await chromium.launch();
    const evidence=fs.mkdtempSync(path.join(os.tmpdir(),'acorn-fall-83-'));
    try{
      const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:800},isMobile:touch,hasTouch:touch,offline:true,reducedMotion:'reduce',colorScheme:touch?'dark':'light'});
      const page=await context.newPage();
      if(!touch){
        const cdp=await context.newCDPSession(page);
        await cdp.send('Emulation.setEmulatedOSTextScale',{scale:1.5});
      }
      const errors=[],remote=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
      await page.clock.install();
      await page.goto(gameUrl);
      await audit(page);
      await settings(page,touch);
      await audit(page);
      assert.match(await page.locator('#settings-modal').ariaSnapshot(),/dialog "Grown-up settings"/i);
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#settings-tab-progress').getAttribute('aria-selected'),'true');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#settings-tab-settings').getAttribute('aria-selected'),'true');
      await activate(page,page.locator('#sw-sound'),touch);
      await activate(page,page.locator('#sw-explanations'),touch);
      // Focus trapping, activation, Escape, and restored focus use real keys.
      await page.locator('#settings-tab-settings').focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Done');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-tab-settings');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#settings-modal').isVisible(),false);
      await activate(page,page.getByRole('button',{name:'Make your team'}),touch);
      await audit(page);
      await activate(page,page.getByRole('button',{name:'Edit Biscuit'}),touch);
      await page.locator('#name-input').fill('Maple');
      await audit(page);
      await activate(page,page.locator('#draft-commit'),touch);
      await activate(page,page.locator('#cc-actions').getByRole('button',{name:/^Start (new )?adventure/}),touch);
      while(await page.locator('#screen-story').isVisible()){
        await audit(page);
        if(touch){
          for(const viewport of [{width:320,height:568},{width:844,height:390},{width:390,height:844}]){
            await page.setViewportSize(viewport);
            await audit(page);
          }
        }
        await activate(page,page.locator('#story-next'),touch);
      }
      const backgrounds=new Set();
      for(let region=0;region<7;region++){
        await page.emulateMedia({colorScheme:region%2?'dark':'light',reducedMotion:'reduce'});
        await audit(page);
        backgrounds.add(await page.locator('#app').evaluate(el=>getComputedStyle(el).backgroundImage));
        assert.equal(await page.locator('#scenery .autumn-decor .map-tree').count(),4);
        assert.equal(await page.locator('#camp-map-world .map-tree').count(),14);
        assert.ok(await page.locator('#camp-map-world .autumn-acorn').count()>0);
        await page.screenshot({path:path.join(evidence,`region-${region+1}.png`)});
        for(let stop=0;stop<12;stop++){
          const start=page.locator('#map-cta-btn');
          await start.scrollIntoViewIfNeeded();
          if(touch){
            const box=await start.boundingBox();assert.ok(box.height>=44&&box.width>=44);
            await start.tap();
          }else{
            await start.focus();
            const outline=await start.evaluate(el=>getComputedStyle(el).outlineWidth);
            assert.ok(parseFloat(outline)>=2,'keyboard focus must remain visible');
            await page.keyboard.press('Enter');
          }
          if(stop<2){
            assert.equal(await page.locator('#feedback').getAttribute('aria-live'),'polite');
            if(touch){
              for(const button of await page.locator('.screen.active .answer,.screen.active .hint-btn,.screen.active .ans-speak').all()){
                const box=await button.boundingBox();
                if(box)assert.ok(box.width>=44&&box.height>=44,'challenge touch targets must remain at least 44px');
              }
            }
            await activate(page,page.locator('.hint-btn:not(#speak-btn)'),touch);
            await audit(page);
            const prompt=await page.locator('#ch-prompt').textContent();
            const saved=await page.evaluate(()=>localStorage.getItem('acorn-trail-progress'));
            await page.reload();
            await activate(page,page.getByRole('button',{name:'Continue trail'}),touch);
            assert.equal(await page.locator('#ch-prompt').textContent(),prompt);
            assert.equal(await page.evaluate(()=>localStorage.getItem('acorn-trail-progress')),saved);
            await audit(page);
          }
          await solve(page,touch);
          await audit(page);
          await activate(page,page.locator('#answer-review').getByRole('button',{name:'Continue',exact:true}),touch);
          await dismissRewards(page,touch);
          assert.equal(await page.evaluate(()=>acorns),region*12+stop+1);
        }
        if(region<6){await audit(page);await activate(page,page.locator('#screen-transition button'),touch);await dismissRewards(page,touch);}
      }
      assert.equal(backgrounds.size,7);
      assert.equal(await page.locator('#screen-finale').isVisible(),true);
      await audit(page);
      assert.deepEqual(await page.evaluate(()=>[learning.math.completed,learning.read.completed]),[42,42]);
      await activate(page,page.getByRole('button',{name:'See my stickers'}),touch);
      await audit(page);
      await activate(page,page.getByRole('button',{name:'Back',exact:true}),touch);
      await activate(page,page.getByRole('button',{name:'Play again',exact:true}),touch);
      assert.equal(await page.evaluate(()=>acorns),0);
      assert.deepEqual(errors,[]);
      assert.deepEqual(remote,[]);
      t.diagnostic(`Screenshots: ${evidence}`);
    }finally{await browser.close();}
  });
}
