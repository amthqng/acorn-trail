'use strict';
// Fast technical QA. Full 84-stop browser regression runs at release time.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

const gameUrl=pathToFileURL(path.resolve('index.html')).href;

test('offline mobile: team setup, map, and first challenge work', {timeout:90000}, async()=>{
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,offline:true});
    const page=await context.newPage();
    const errors=[];
    const network=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url())});
    await page.goto(gameUrl);
    await page.evaluate(()=>{SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.motion=false;saveSettings();});
    assert.equal(await page.locator('#screen-start').isVisible(),true);
    await page.getByRole('button',{name:'Make your team'}).tap();
    await page.getByRole('button',{name:'Edit Biscuit'}).tap();
    await page.locator('#name-input').fill('Maple');
    await page.locator('#draft-commit').tap();
    await page.locator('#cc-actions').getByRole('button',{name:/^Start (new )?adventure/}).tap();
    for(let n=0;n<12&&await page.evaluate(()=>currentScreenId==='screen-story');n++){
      await page.locator('#story-next').tap();
    }
    assert.equal(await page.evaluate(()=>currentScreenId),'screen-map');
    assert.equal(await page.locator('#map-cta-btn').isVisible(),true);
    assert.ok((await page.locator('#camp-map-world svg').count())>0,'map should render offline');
    await page.locator('#map-cta-btn').tap();
    assert.equal(await page.evaluate(()=>currentScreenId),'screen-challenge');
    assert.ok((await page.locator('#ch-prompt').textContent()).trim().length>0,'first question should render');
    assert.deepEqual(errors,[],'game must not raise browser errors');
    assert.deepEqual(network,[],'game must not depend on remote requests');
  }finally{await browser.close();}
});

test('desktop: opening screen fits and renders offline', {timeout:60000}, async()=>{
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext({viewport:{width:1280,height:800},offline:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(gameUrl);
    assert.equal(await page.locator('#screen-start h1').textContent(),'Acorn Trail');
    assert.equal(await page.evaluate(()=>{
      const screen=document.querySelector('.screen.active');
      return screen.scrollWidth<=screen.clientWidth+1;
    }),true,'desktop start screen should not overflow');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
