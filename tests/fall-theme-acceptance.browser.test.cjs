'use strict';
// Acceptance owned by QA, independent of generated source. #83 has to visibly
// change the palette, scenes and map in the ACTUAL live offline DOM.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function snapshot(browser,html){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,offline:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 const errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/i.test(r.url()))remote.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.resolve(html)).href);
  await page.locator('#screen-start').waitFor({state:'visible'});
  const result=await page.evaluate(()=>{
    const app=document.querySelector('#app');
    const root=getComputedStyle(document.documentElement);
    const tokens=Object.fromEntries(['--cream','--peach','--rust','--rust-dark','--sage','--sage-dark','--sand-dark','--honey'].map(k=>[k,root.getPropertyValue(k).trim()]));
    const scenes={};
    for(const name of ['meadow','orchard','woods']){
      setScene(name);
      scenes[name]=getComputedStyle(app).backgroundImage;
    }
    go('screen-map');
    const map=document.querySelector('#camp-map-world svg');
    const mapMarkup=map?.innerHTML??'';
    const ground=map?.querySelector('#map-ground');
    const gradients=ground?.outerHTML??'';
    const canopy=Array.from(map?.querySelectorAll('.map-tree-oak,.map-tree-maple,.map-tree-birch')??[]).slice(0,6)
      .map(el=>el.outerHTML.slice(0,360)).join('');
    return {tokens,scenes,gradients,canopy,mapPresent:!!map,mapMarkupSize:mapMarkup.length,
      mapBackground:getComputedStyle(document.querySelector('.camp-map-world')).backgroundColor,
      mapWidth:document.querySelector('#screen-map').scrollWidth,
      viewportWidth:document.querySelector('#screen-map').clientWidth};
  });
  assert.ok(result.mapPresent,'map must render offline');
  assert.ok(result.mapMarkupSize>500,'map must retain full vector artwork');
  assert.deepEqual(errors,[],'browser must have no script errors');
  assert.deepEqual(remote,[],'no network dependencies are permitted');
  return result;
 }finally{await context.close();}
}
test('Fall theme is visible across the game, not just one navigation dot or inactive CSS', {timeout:90000},async()=>{
 const browser=await chromium.launch();
 try{
  const [before,after]=await Promise.all([
   snapshot(browser,'inputs/original-index.html'),
   snapshot(browser,'index.html')
  ]);
  const changedTokens=Object.keys(before.tokens).filter(k=>before.tokens[k]!==after.tokens[k]);
  const changedScenes=Object.keys(before.scenes).filter(k=>before.scenes[k]!==after.scenes[k]);
  const mapChanged=before.gradients!==after.gradients||before.canopy!==after.canopy||before.mapBackground!==after.mapBackground;
  assert.ok(changedTokens.length>=2,'Fall theme must modify at least two actual global palette tokens; changed: '+changedTokens.join(', '));
  assert.ok(changedScenes.length>=2,'Fall scenery must visibly update at least two distinct region backgrounds; changed: '+changedScenes.join(', '));
  assert.ok(mapChanged,'Fall theme must modify actual displayed map trees, ground or canvas');
  assert.ok(after.viewportWidth>=before.viewportWidth-1,'Fall theme must not introduce horizontal map overflow');
 }finally{await browser.close();}
});
