'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const selectors=[
 '#screen-start .title-lockup',
 '#screen-start .offline-strip',
 '#screen-start .companion .name',
 '#screen-start .companion .lead-tag',
 '#screen-start .foot-note'
];
for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
 test('Issue #83 owner visual acceptance: NO bordered home panels '+viewport.width,{timeout:60000},async()=>{
  const browser=await chromium.launch();
  try{
   const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'});
   await page.goto(pathToFileURL(path.resolve('index.html')).href);
   await page.locator('#screen-start').waitFor({state:'visible'});
   for(const selector of selectors){
    const element=page.locator(selector).first();
    await element.waitFor({state:'visible'});
    const style=await element.evaluate(el=>{
     const s=getComputedStyle(el);
     return {top:s.borderTopWidth,right:s.borderRightWidth,bottom:s.borderBottomWidth,left:s.borderLeftWidth,background:s.backgroundColor};
    });
    for(const side of ['top','right','bottom','left'])assert.equal(parseFloat(style[side]),0,selector+' has a visible '+side+' border');
   }
   fs.mkdirSync('artifacts/implementation/visual-qa',{recursive:true});
   await page.screenshot({path:'artifacts/implementation/visual-qa/home-'+viewport.width+'.png',fullPage:true});
  }finally{await browser.close();}
 });
}
