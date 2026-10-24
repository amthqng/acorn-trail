'use strict';
// Run: node --test tests/feature-83-autumn.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const tokens=Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/ig)].map(m=>[m[1],m[2]]));
const scenes=['meadow','orchard','river','pumpkin','woods','bridge','oak'];

function boot(saved={}){
  const data=new Map(Object.entries(saved).map(([k,v])=>[k,JSON.stringify(v)]));
  const elements=new Map();
  function element(id=''){
    if(!elements.has(id)){
      const classes=new Set(),attributes={};
      elements.set(id,{id,style:{},dataset:{},children:[],innerHTML:'',textContent:'',attributes,
        classList:{add(...names){names.forEach(n=>classes.add(n));},remove(n){classes.delete(n);},
          toggle(n,on){if(on??!classes.has(n))classes.add(n);else classes.delete(n);},contains(n){return classes.has(n);}},
        setAttribute(k,v){attributes[k]=String(v);},removeAttribute(k){delete attributes[k];},
        appendChild(child){this.children.push(child);return child;},remove(){},
        querySelector(){return element(id+'-child');},querySelectorAll(){return [];},
        addEventListener(){},focus(){document.activeElement=this;},get offsetWidth(){return 10;}
      });
    }
    return elements.get(id);
  }
  const document={body:element('body'),activeElement:null,getElementById:element,
    createElement:()=>element('new-'+elements.size),querySelector:()=>element('query'),
    querySelectorAll:()=>[],addEventListener(){}};
  const context=vm.createContext({document,window:{addEventListener(){},speechSynthesis:null},
    localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},
    setTimeout:()=>1,clearTimeout(){},confirm:()=>true,console,Math,JSON});
  new vm.Script(source).runInContext(context);
  return {data,element,run:code=>vm.runInContext(code,context),json:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',context))};
}

function luminance(hex){
  const rgb=hex.replace('#','').match(/../g).map(c=>parseInt(c,16)/255)
    .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return rgb.reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}

test('text and control tokens meet AA on parchment and harvest colors',()=>{
  // Conservative: small-text threshold, including the darkest gradient endpoint.
  const surfaces=[tokens['--cream'],tokens['--cream-card'],'#f4e0bc','#f8edd4','#ecc5a7'];
  for(const fg of ['--bark','--rust-dark','--sage-dark'])for(const bg of surfaces){
    assert.ok(contrast(tokens[fg],bg)>=4.5,`${fg} on ${bg}`);
  }
  for(const bg of ['--rust','--rust-dark','--good','--good-dark']){
    assert.ok(contrast(tokens['--cream-card'],tokens[bg])>=4.5,`button label on ${bg}`);
  }
  for(const bg of [tokens['--cream'],tokens['--cream-card'],'#f8edd4']){
    assert.ok(contrast(tokens['--sand-dark'],bg)>=3,`control border on ${bg}`);
  }
  assert.ok(contrast('#4b341f','#efad46')>=4.5,'gold CTA');
  assert.ok(contrast('#734330','#f2c9b9')>=4.5,'wrong answer');
  assert.ok(contrast('#354426','#d7dfa7')>=4.5,'correct/revealed answer');
});

test('every live scene includes static trees and leaves with no focus targets',()=>{
  const b=boot();
  assert.deepEqual(b.json('THEMES.map(t=>t.scene)'),scenes);
  for(const scene of scenes){
    b.run(`setScene(${JSON.stringify(scene)})`);
    const art=b.element('scenery').innerHTML;
    assert.match(art,/class="autumn-decor"[^>]*aria-hidden="true"[^>]*focusable="false"/);
    for(const species of ['oak','maple','birch','pine'])assert.match(art,new RegExp('map-tree-'+species));
    assert.match(art,/class="autumn-leaf" aria-hidden="true"/);
    assert.match(art,/preserveAspectRatio="xMidYMax meet"/,'phone edge trees must not be cropped');
    assert.doesNotMatch(art,/<animate|tabindex|on(?:click|touch|pointer)|<a\b|<button\b|https?:\/\//i);
    b.run('renderAdventureMap()');
    const map=b.element('camp-map-world').innerHTML;
    assert.equal((map.match(/class="map-tree /g)||[]).length,14);
    assert.equal((map.match(/class="camp-node /g)||[]).length,7);
    assert.match(map,/class="trail-path"/);
    assert.match(map,/class="autumn-leaf"/);
  }
  assert.match(css,/#scenery \.scene-depth,#scenery \.autumn-decor,\.map-tree,\.autumn-leaf\{pointer-events:none\}/);
});

test('autumn scenery remains present with reduced motion and settings describe actual state',()=>{
  const b=boot();
  b.run('SETTINGS.motion=false;renderSettings()');
  assert.equal(b.element('sw-motion').attributes['aria-pressed'],'true');
  assert.equal(b.element('sw-motion').classList.contains('on'),true);
  for(const scene of scenes){
    b.run(`setScene(${JSON.stringify(scene)})`);
    assert.match(b.element('app').className,/ calm$/);
    assert.match(b.element('scenery').innerHTML,/autumn-decor/);
    if(scene!=='river')assert.equal(b.element('particles').innerHTML,'');
  }
  b.run("toggleSetting('motion')");
  assert.equal(b.element('sw-motion').attributes['aria-pressed'],'false');
  assert.equal(b.element('sw-motion').classList.contains('on'),false);
  for(const key of ['sound','reveal','readaloud']){
    assert.match(b.element('sw-'+key).attributes['aria-pressed'],/^(true|false)$/);
  }
});

test('existing v3 saves resume unchanged into every autumn region',()=>{
  for(const [themeIndex,scene] of scenes.entries()){
    const kind=themeIndex%2===0?'math':'read';
    const question=kind==='math'
      ?{kind,prompt:'2 + 3',sub:'Add',answer:5,choices:[5,4,6],hint:'Count on.'}
      :{kind,prompt:'What rhymes with leaf?',sub:'Choose a rhyme',answer:'thief',choices:['thief','life','roof'],hint:'Listen to the ending.'};
    const progress={v:3,themeIndex,stopIndex:0,acorns:17,streak:2,wrongCount:1,question,pendingCompletion:false};
    const b=boot({'acorn-trail-progress':progress,'acorn-trail-stickers':{'t-meadow':1},
      'acorn-trail-settings':{math:'g2',reading:'g2',motion:false,sound:false,readAloud:false}});
    const raw=b.data.get('acorn-trail-progress');
    b.run('continueTrail()');
    assert.equal(b.run('currentScreenId'),'screen-challenge');
    assert.equal(b.run('currentScene'),scene);
    assert.equal(b.run('current.prompt'),question.prompt);
    assert.deepEqual(b.json('current.choices'),question.choices);
    assert.equal(b.run('acorns'),17);
    assert.equal(b.run('wrongCount'),1);
    assert.equal(b.run('streak'),2);
    assert.equal(b.data.get('acorn-trail-progress'),raw,'theme must not rewrite saved progress');
    assert.match(b.element('scenery').innerHTML,/autumn-decor/);
  }
});

test('dialog focus wraps, Escape closes, and settings restores its trigger',()=>{
  const b=boot();
  b.run(`
    const first=document.getElementById('first'),last=document.getElementById('last');
    first.tabIndex=last.tabIndex=0;first.getClientRects=last.getClientRects=()=>[{}];
    let prevented=0,closed=0;
    const modal={querySelectorAll:()=>[first,last]};
    first.focus();modalKeys({key:'Tab',shiftKey:true,currentTarget:modal,preventDefault(){prevented++;}},()=>closed++);
  `);
  assert.equal(b.run('document.activeElement.id'),'last');
  b.run("modalKeys({key:'Tab',currentTarget:modal,preventDefault(){prevented++;}},()=>closed++)");
  assert.equal(b.run('document.activeElement.id'),'first');
  b.run("modalKeys({key:'Escape',preventDefault(){prevented++;}},()=>closed++)");
  assert.equal(b.run('closed'),1);
  assert.equal(b.run('prevented'),3);
  b.run('first.focus();openSettings();tryGate(gateAnswer,last);closeSettings()');
  assert.equal(b.run('document.activeElement.id'),'first');
  assert.match(html,/id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"/);
  assert.match(html,/id="feedback" role="status" aria-live="polite"/);
  assert.match(html,/id="camp-map-caption" aria-live="polite"/);
});
