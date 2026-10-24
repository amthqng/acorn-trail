'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

// Palette-level checks complement the rendered contrast audit in the browser
// suite. These do not claim to measure text composited over scenery.
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const palette=Object.fromEntries([...html.matchAll(/(--[\w-]+)\s*:\s*(#[\da-f]{6})\b/gi)]
  .map(([,key,value])=>[key,value]));
function luminance(hex){
  const rgb=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255)
    .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b){
  const values=[luminance(a),luminance(b)].sort((x,y)=>x-y);
  return (values[1]+.05)/(values[0]+.05);
}

test('autumn text and action palette supports AA normal text (4.5:1)',()=>{
  for(const background of ['--cream','--cream-card','--sand','--home-panel']){
    for(const ink of ['--bark','--rust-dark','--sage-dark']){
      const ratio=contrast(palette[ink],palette[background]);
      assert.ok(ratio>=4.5,`${ink} on ${background}: ${ratio.toFixed(2)}:1`);
    }
  }
  for(const background of ['--rust','--rust-dark','--good','--good-dark']){
    const ratio=contrast(palette['--cream-card'],palette[background]);
    assert.ok(ratio>=4.5,`primary action on ${background}: ${ratio.toFixed(2)}:1`);
  }
  assert.ok(contrast(palette['--home-ink'],palette['--home-panel'])>=4.5);
});

test('autumn control boundary and focus colors support 3:1 against parchment',()=>{
  for(const background of ['--cream','--cream-card','--home-panel']){
    for(const ink of ['--sand-dark','--rust-dark','--good-dark']){
      const ratio=contrast(palette[ink],palette[background]);
      assert.ok(ratio>=3,`${ink} on ${background}: ${ratio.toFixed(2)}:1`);
    }
  }
});
