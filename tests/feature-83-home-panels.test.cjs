'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('index.html','utf8');
const css=source.match(/<style>([\s\S]*?)<\/style>/)?.[1]??'';
const panelColor=/#screen-start\s*\{[^}]*--home-panel:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
const inkColor=/#screen-start\s*\{[^}]*--home-ink:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
function lum(hex){const c=hex.slice(1).match(/.{2}/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('home screen uses a noticeably colored autumn parchment, not nearly white',()=>{
 assert.ok(panelColor,'home panel background token missing');
 const whiteDistance=panelColor.slice(1).match(/.{2}/g).map(x=>255-parseInt(x,16)).reduce((a,b)=>a+b,0);
 assert.ok(whiteDistance>105,'panel must be visibly more colorful than #FFF9ED');
 assert.notEqual(panelColor.toLowerCase(),'#fff9ed');
});
test('home panel copy meets AA text contrast',()=>{
 assert.ok(inkColor,'home text color missing');
 assert.ok(contrast(panelColor,inkColor)>=4.5,'autumn parchment text must meet 4.5:1');
});
test('all five owner-rejected home surfaces use the new palette',()=>{
 const block=css.match(/#screen-start \.title-lockup,([\s\S]*?)\{\s*background:var\(--home-panel\)/)?.[1]??'';
 for(const selector of ['.offline-strip','.companion .name','.companion .lead-tag','.foot-note']){
  assert.ok(block.includes('#screen-start '+selector),'missing warm treatment for '+selector);
 }
 assert.match(css,/#screen-start \.offline-strip \.offline-link\s*\{[^}]*color:var\(--home-ink\)/);
});
test('override is scoped to home screen and preserves the shared cards elsewhere',()=>{
 assert.match(css,/\.title-lockup,\.offline-strip,\.lead-tag,[^{]*\{background:var\(--cream-card\)/);
 assert.match(css,/#screen-start \.foot-note\s*\{[^}]*box-sizing:border-box/);
});
