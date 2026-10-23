'use strict';
// Source/VM checks complement live browser QA; they do not certify a device UI.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g,'');
const tokens=Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map(m=>[m[1],m[2]]));
function style(...selectors){
  const result={};
  for(const [,list,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
    if(!list.split(',').some(s=>selectors.includes(s.trim())))continue;
    for(const d of body.split(';')){
      const colon=d.indexOf(':');
      if(colon>0)result[d.slice(0,colon).trim()]=d.slice(colon+1).trim().replace(/var\((--[\w-]+)\)/g,(_,k)=>tokens[k]);
    }
  }
  return result;
}
function colors(value){return value.match(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi)||[];}
function luminance(hex){
  if(hex.length===4)hex='#'+[...hex.slice(1)].map(c=>c+c).join('');
  const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function boot(initial={}){
  const data=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)])),elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{
      style:{},className:'',innerHTML:'',textContent:'',dataset:{},children:[],
      classList:{add(){},remove(){},toggle(){}},setAttribute(){},removeAttribute(){},
      querySelector(){return element(id+'-child');},querySelectorAll(){return [];},
      appendChild(e){this.children.push(e);},remove(){},addEventListener(){},get offsetWidth(){return 10;}
    });
    return elements.get(id);
  }
  const document={body:element('body'),getElementById:element,querySelector:()=>element('query'),querySelectorAll:()=>[],createElement:()=>element('new-'+Math.random()),addEventListener(){}};
  const localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const ctx=vm.createContext({document,localStorage,window:{addEventListener(){},matchMedia:()=>({matches:false})},console,Math,JSON,setTimeout:()=>0,clearTimeout(){},confirm:()=>true});
  script.runInContext(ctx);
  return {data,element,run:code=>vm.runInContext(code,ctx)};
}

test('autumn text and control palettes meet AA at every gradient endpoint',()=>{
  const cases=[
    ['main buttons',style('.btn')],['green buttons',style('.btn','.btn.green')],
    ['outline buttons',style('.btn','.btn.outline')],['selected name chips',style('.chip','.chip.on')],
    ['answers',style('.answer','#screen-challenge .answer')],
    ['correct/revealed answers',style('.answer','#screen-challenge .answer','#screen-challenge .answer.correct')],
    ['wrong answers',style('.answer','#screen-challenge .answer','#screen-challenge .answer.wrong')],
    ['hints',style('.hint-btn','#screen-challenge .hint-btn')],
    ['read aloud',style('.hint-btn','.speak-btn','#screen-challenge .hint-btn','#screen-challenge .speak-btn')],
    ['selected grades',style('.seg button','.seg button.on')],['selected operations',style('.op','.op.on')],
    ['reward badge',style('.earned')],['math badge',style('.kind.math')],['reading badge',style('.kind.read')],
    ['settings notes',{color:tokens['--sage-dark'],background:'#FFF9EB'}],
    ['headings and labels',{color:tokens['--rust-dark'],background:tokens['--cream-card']}],
    ['challenge label',{color:style('#screen-challenge .challenge:before').color,background:'#F4E0BC'}],
    ['challenge subtext',{color:style('#screen-challenge .ch-sub').color,background:'#F4E0BC'}],
    ['map labels',{color:'#503822',background:'#FFF5D6'}],
    ['primary amber buttons',{color:'#4B341F',background:style('#screen-start .start-wrap .btn').background}]
  ];
  for(const [area,s] of cases){
    assert.ok(s.color&&colors(s.background).length,area+' must have a measurable palette');
    for(const bg of colors(s.background))assert.ok(contrast(s.color,bg)>=4.5,`${area}: ${s.color} on ${bg} is ${contrast(s.color,bg).toFixed(2)}:1`);
  }
  const answer=style('#screen-challenge .answer');
  for(const bg of colors(answer.background))assert.ok(contrast(answer['border-color'],bg)>=3,'answer boundary contrast');
  for(const scene of ['meadow','orchard','river','pumpkin','woods','bridge','oak'])assert.ok(style('#app.sky-'+scene).background);
});

test('every scene and map generate static, hidden, non-interactive autumn art',()=>{
  const b=boot();
  for(let region=0;region<7;region++){
    b.run(`themeIndex=${region};go('screen-map')`);
    const art=b.element('scenery').innerHTML,map=b.element('camp-map-world').innerHTML;
    assert.match(art,/class="autumn-decor"[^>]*aria-hidden="true"[^>]*focusable="false"/);
    for(const kind of ['oak','maple','pine','birch'])assert.match(art,new RegExp('map-tree-'+kind));
    assert.doesNotMatch(b.run('autumnDecor(currentScene)'),/on\w+=|tabindex|<animate|<image|<foreignObject/i);
    assert.ok(map.indexOf('map-tree-oak')<map.indexOf('class="trail-path"'),'route must paint above trees');
    assert.ok(map.indexOf('class="trail-path"')<map.indexOf('class="camp-node '),'stops must paint above route');
    assert.match(map,/id="map-ground"[^]*?#F2D393/);
    assert.ok(Buffer.byteLength(art)<22000,'scene artwork stays lightweight');
  }
  assert.equal(style('#scenery')['pointer-events'],'none');
  assert.match(html,/<div id="scenery" aria-hidden="true">/);
  assert.ok(/<div\b[^>]*id="feedback" role="status" aria-live="polite">/.test(html));
});

test('all previous v3 regions resume with the correct autumn scene and unchanged save data',()=>{
  for(let region=0;region<7;region++){
    const kind=region%2===0?'math':'read';
    const question={kind,prompt:kind==='math'?'2 + 3':'Which word rhymes with cat?',sub:'Choose one.',answer:kind==='math'?5:'hat',choices:kind==='math'?[5,4,6]:['hat','sun','dog'],hint:'Take your time.'};
    const progress={v:3,themeIndex:region,stopIndex:0,acorns:region*12,streak:2,wrongCount:1,question,pendingCompletion:false};
    const b=boot({'acorn-trail-progress':progress,'acorn-trail-settings':{sound:false,readAloud:false,motion:false}});
    b.run('continueTrail()');
    assert.equal(b.run('currentScreenId'),'screen-challenge');
    assert.equal(b.run('currentScene'),b.run(`THEMES[${region}].scene`));
    assert.equal(b.run('current.prompt'),question.prompt);
    assert.equal(b.run('wrongCount'),1);
    assert.equal(b.run('streak'),2);
    assert.deepEqual(JSON.parse(b.data.get('acorn-trail-progress')),progress,'theme must not rewrite a prior save');
    b.run('setScene(currentScene)');
    assert.match(b.element('scenery').innerHTML,/autumn-decor/,'calm mode retains seasonal art');
  }
});
