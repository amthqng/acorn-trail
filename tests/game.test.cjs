// Offline Acorn Trail developer regression tests. Run: node --test tests/game.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
assert.ok(match,'Embedded game script exists');
const script=new vm.Script(match[1],{filename:'index.html'});
function boot(initial={}){
 const data=new Map(Object.entries(initial).map(([k,v])=>[k,JSON.stringify(v)]));
 const elements=new Map();
 const timers=[];
 const element=(id='')=>{
   if(!elements.has(id))elements.set(id,{
     id,style:{},className:'',textContent:'',innerHTML:'',dataset:{},children:[],
     classList:{add(){},remove(){},toggle(){}},
     appendChild(x){this.children.push(x);return x},remove(){},
     setAttribute(){},removeAttribute(){},querySelector(){return element(id+'-child')},
     querySelectorAll(){return []},addEventListener(){},get offsetWidth(){return 10}
   });
   return elements.get(id);
 };
 const document={
  body:element('body'),getElementById:element,createElement:()=>element('created-'+Math.random()),
  querySelectorAll:()=>[],querySelector:()=>element('query'),addEventListener(){}
 };
 const localStorage={setItem(k,v){data.set(k,String(v))},getItem(k){return data.has(k)?data.get(k):null},removeItem(k){data.delete(k)}};
 const window={addEventListener(){},speechSynthesis:null};
 const ctx=vm.createContext({window,document,localStorage,console,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},confirm:()=>true,Math,JSON});
 script.runInContext(ctx,{timeout:10000});
 return {ctx,data,timers,eval(code){return vm.runInContext(code,ctx,{timeout:10000})}};
}
test('embedded script parses and initializes offline',()=>{const b=boot();assert.equal(b.eval('typeof startNextStop'),'function')});
test('reading banks have distinct choices and correct answers',()=>{
 const b=boot();
 const issues=JSON.parse(b.eval(`JSON.stringify(Object.entries(READING).flatMap(([cat,bank])=>bank.map((d,i)=>({cat,i,q:buildReading(cat,d)}))).filter(x=>!validQuestion(x.q)))`));
 assert.deepEqual(issues,[]);
});
test('math questions are valid across grade levels and enabled operation sets',()=>{
 const b=boot();
 const issues=JSON.parse(b.eval(`JSON.stringify((()=>{const bad=[];for(const ops of [{add:true,sub:true,mul:true,div:true,word:true},{add:true,sub:false,mul:false,div:false,word:false},{add:false,sub:true,mul:false,div:false,word:false},{add:false,sub:false,mul:true,div:false,word:false},{add:false,sub:false,mul:false,div:true,word:false},{add:false,sub:false,mul:false,div:false,word:true}]){SETTINGS.ops=ops;for(let level=1;level<=4;level++)for(let i=0;i<150;i++){const q=genMath({mlevel:level});if(!validQuestion(q))bad.push({ops,level,q});}}return bad;})())`));
 assert.deepEqual(issues,[]);
});
test('saving and resuming retains active question and streak',()=>{
 const b=boot();
 b.eval(`acorns=3;themeIndex=0;stopIndex=1;streak=2;current={kind:'math',prompt:'2 + 3',sub:'Add',answer:5,choices:[5,4,6],hint:'Add'};answered=false;saveProgress()`);
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 assert.equal(c.eval('loadProgress().streak'),2);
 assert.equal(c.eval('loadProgress().question.answer'),5);
 assert.equal(c.eval('loadProgress().stopIndex'),1);
});
test('pending reward cannot be earned twice on resume',()=>{
 const b=boot();
 b.eval(`acorns=7;stopIndex=0;current=null;pendingCompletion=true;saveProgress()`);
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval('continueTrail()');
 assert.equal(c.eval('acorns'),7);
 assert.equal(c.eval('stopIndex'),1);
});
test('sticker collection survives fresh team creation',()=>{
 const b=boot();
 b.eval(`stickerCounts={'friend0':2};saveStickers();`);
 const saved=JSON.parse(b.data.get('acorn-trail-stickers'));
 assert.equal(saved.friend0,2);
 assert.ok(!/stickerCounts\s*=\s*\{\}/.test(b.eval('playTeam.toString()')));
});
test('no remote runtime dependencies',()=>{
 assert.doesNotMatch(html,/<script[^>]+src=/i);
 assert.doesNotMatch(html,/<link[^>]+rel=["']stylesheet/i);
});

test('seven-region camping map tracks current destination and progress',()=>{
 const b=boot();
 assert.equal(b.eval('THEMES.length'),7);
 assert.equal(b.eval('CAMP_MAP_PLACES.length'),7);
 b.eval('themeIndex=4;stopIndex=3;acorns=9;renderMap()');
 const svg=b.eval("document.getElementById('camp-map-world').innerHTML");
 assert.match(svg,/Amber Woods/);
 assert.match(svg,/camp-node current/);
 assert.match(svg,/camp-node done/);
 assert.match(svg,/camp-node locked/);
 assert.match(svg,/9 collected/);
 assert.equal(b.eval("document.getElementById('camp-map-caption').textContent"),'Campsite 5 of 7 · The Amber Woods');
});
test('every theme has twelve alternating math and reading stops',()=>{
 const b=boot();
 const all=JSON.parse(b.eval('JSON.stringify(THEMES.map(t=>t.stops))'));
 assert.equal(all.length,7);
 for(const stops of all){
  assert.equal(stops.length,12);
  for(let i=0;i<stops.length;i++){
   assert.ok(['math','read'].includes(stops[i]));
   if(i)assert.notEqual(stops[i],stops[i-1]);
  }
 }
});
test('each region renders an offline camping scene',()=>{
 const b=boot();
 for(const scene of ['meadow','orchard','river','pumpkin','woods','bridge','oak']){
  b.eval('setScene('+JSON.stringify(scene)+')');
  const art=b.eval("document.getElementById('scenery').innerHTML");
  assert.match(art,/camp-scene-decor/);
  assert.match(art,/<svg/);
  assert.match(art,/<path/);
 }
});
test('camping characters render for every animal and preserve roster flexibility',()=>{
 const b=boot();
 const animals=JSON.parse(b.eval('JSON.stringify(ANIMALS)'));
 for(const animal of animals){
  const svg=b.eval('camperGlyph('+JSON.stringify(animal)+')');
  assert.match(svg,/<svg/);
  assert.match(svg,/viewBox="0 0 120 132"/);
 }
 assert.equal(b.eval('teamValid()'),true);
});
test('fresh starts clear pending completion and active questions',()=>{
 const b=boot();
 b.eval("current={kind:'math'};pendingCompletion=true;freshStart()");
 assert.equal(b.eval('current'),null);
 assert.equal(b.eval('pendingCompletion'),false);
 assert.equal(b.eval('answered'),false);
});

test('both restart paths clear stale answers and used reading history',()=>{
 const b=boot();
 b.eval("answered=true;usedReading['test']=true;freshStart()");
 assert.equal(b.eval('answered'),false);
 assert.equal(b.eval("Object.keys(usedReading).length"),0);
 b.eval("answered=true;usedReading['test']=true;restart()");
 assert.equal(b.eval('answered'),false);
 assert.equal(b.eval("Object.keys(usedReading).length"),0);
 assert.equal(b.eval('stopIndex'),0);
});

test('all 84 stops advance across seven regions to the finale',()=>{
 const b=boot();
 b.eval("SETTINGS.sound=false;pendingUnlocks=[];acorns=0;themeIndex=0;stopIndex=0");
 for(let region=0;region<7;region++){
  assert.equal(b.eval('themeIndex'),region);
  for(let stop=0;stop<12;stop++){
   assert.equal(b.eval('stopIndex'),stop);
   b.eval('startNextStop()');
   assert.equal(b.eval('validQuestion(current)'),true);
   assert.equal(b.eval('current.kind'),b.eval('THEMES[themeIndex].stops[stopIndex]'));
   b.eval('acorns++;proceed()');
  }
  if(region<6){
   assert.equal(b.eval('currentScreenId'),'screen-transition');
   b.eval('advanceTheme()');
  }
 }
 assert.equal(b.eval('finished'),true);
 assert.equal(b.eval('acorns'),84);
 assert.equal(b.eval('loadProgress()'),null);
});
test('resuming a completed answer advances exactly one stop',()=>{
 const b=boot();
 b.eval("SETTINGS.sound=false;acorns=4;themeIndex=1;stopIndex=5;pendingCompletion=true;current=null;saveProgress()");
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval('continueTrail()');
 assert.equal(c.eval('themeIndex'),1);
 assert.equal(c.eval('stopIndex'),6);
 assert.equal(c.eval('acorns'),4);
 assert.equal(c.eval('pendingCompletion'),false);
});

test('corrupted save data cannot access an invalid region or stop',()=>{
 const b=boot();
 const invalid=[{v:b.eval('PVER'),themeIndex:99,stopIndex:0,acorns:1},{v:b.eval('PVER'),themeIndex:0,stopIndex:99,acorns:1},{v:b.eval('PVER'),themeIndex:-1,stopIndex:0,acorns:1},{v:b.eval('PVER'),themeIndex:0,stopIndex:0,acorns:-3}];
 for(const data of invalid){
  b.eval('store.set(PKEY,'+JSON.stringify(data)+')');
  assert.equal(b.eval('loadProgress()'),null);
  b.eval("go('screen-start')");
 }
});


test('wrong attempts survive resume and break a clean streak',()=>{
 const b=boot(); b.eval("SETTINGS.sound=false;streak=2;startNextStop();checkAnswer(document.createElement('button'),'wrong',current.answer)");
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval("SETTINGS.sound=false;continueTrail()"); assert.equal(c.eval('wrongCount'),1);
 c.eval("checkAnswer(document.createElement('button'),current.answer,current.answer)");
 assert.equal(c.eval('streak'),0); assert.equal(c.eval('acorns'),1);
});
test('region boundary resume shows transition instead of an empty map',()=>{
 const b=boot(); b.eval('themeIndex=2;stopIndex=12;acorns=36;saveProgress();continueTrail()');
 assert.equal(b.eval('currentScreenId'),'screen-transition');
});
test('stale reward callbacks cannot advance a restarted trail',()=>{
 for(const reset of ['restart()','freshStart()','confirmReset()','playTeam()']){
  const b=boot(); b.eval("SETTINGS.sound=false;startNextStop();checkAnswer(document.createElement('button'),current.answer,current.answer)");
  b.eval(reset); const screen=b.eval('currentScreenId');
  for(const fn of b.timers)fn();
  assert.equal(b.eval('stopIndex'),0);assert.equal(b.eval('acorns'),0);assert.equal(b.eval('currentScreenId'),screen);
  assert.equal(b.eval('current'),null);
 }
});
test('invalid persisted rosters and disabled operations recover safely',()=>{
 for(const r of [{},[],[null],[{name:'x',animal:'bad',role:'math'}]]){
  const b=boot({'acorn-trail-roster':r});assert.equal(b.eval('teamValid()'),true);
 }
 const b=boot({'acorn-trail-settings':{ops:{add:false,sub:false,mul:false,div:false,word:false}}});
 assert.equal(b.eval('validQuestion(genMath(THEMES[0]))'),true);
});
test('removing a preceding teammate preserves the edited character',()=>{
 const b=boot();b.eval("editChar(2);removeChar(0);typeName('Maple');commitDraft()");
 assert.equal(b.eval('ROSTER[1].name'),'Maple');assert.equal(b.eval('ROSTER[2].name'),'Nutmeg');
});
test('team customization saves all roles and supports the twenty friend limit',()=>{
 const b=boot();b.eval("ROSTER=[]");
 for(const role of ['lead','help','both'])b.eval("startAdd();setDraft('role',"+JSON.stringify(role)+");typeName("+JSON.stringify(role)+");commitDraft()");
 assert.equal(b.eval('teamValid()'),true);
 for(let i=3;i<20;i++)b.eval("startAdd();typeName('Friend"+i+"');commitDraft()");
 b.eval('startAdd()');assert.equal(b.eval('draft'),null);
 b.eval('playTeam()');assert.equal(JSON.parse(b.data.get('acorn-trail-roster')).length,20);
});

test('real answer callbacks award once at every stop and unlock all rewards',()=>{
 const b=boot(); b.eval('SETTINGS.sound=false;SETTINGS.readAloud=false');
 for(let region=0;region<7;region++){
  for(let stop=0;stop<12;stop++){
   b.eval('startNextStop();checkAnswer(document.createElement("button"),current.answer,current.answer)');
   b.eval('checkAnswer(document.createElement("button"),0,0)');
   while(b.timers.length)b.timers.shift()();
   for(let i=0;i<30&&b.eval('currentScreenId')==='screen-sticker-unlock';i++)b.eval('unlockContinue()');
   assert.equal(b.eval('acorns'),region*12+stop+1);
  }
  if(region<6)b.eval('advanceTheme()');
  for(let i=0;i<30&&b.eval('currentScreenId')==='screen-sticker-unlock';i++)b.eval('unlockContinue()');
 }
 assert.equal(b.eval('currentScreenId'),'screen-finale');
 assert.equal(b.eval('STICKERS.every(s=>hasSticker(s.id))'),true);
 assert.equal(b.eval('Object.values(stickerCounts).reduce((a,b)=>a+b,0)'),b.eval('STICKERS.length+3'));
 assert.equal(b.eval('loadProgress()'),null);
});
