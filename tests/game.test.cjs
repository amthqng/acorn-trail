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
test('animal heads render for every animal and preserve roster flexibility',()=>{
 const b=boot();
 const animals=JSON.parse(b.eval('JSON.stringify(ANIMALS)'));
 for(const animal of animals){
  const svg=b.eval('camperGlyph('+JSON.stringify(animal)+')');
  assert.match(svg,/<svg/);
  assert.match(svg,/viewBox="0 0 100 100"/);
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
   b.eval(`startNextStop();if(current.format){while(current&&!answered){if(current.format==='match'){if(current.activityState.selected===null)selectMatch(current.pairs.findIndex((_,i)=>!current.activityState.done.includes(i)));answerActivity(document.createElement('button'),current.choices.indexOf(current.pairs[current.activityState.selected].right));}else answerActivity(document.createElement('button'),current.sequence[current.activityState.done.length]);}}else checkAnswer(document.createElement('button'),current.answer,current.answer)`);
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

test('malformed sticker counts recover and cannot corrupt reward arithmetic',()=>{
 const b=boot({'acorn-trail-stickers':{friend0:'two',friend1:-1,friend2:2,friend19:3,unknown:5}});
 assert.equal(b.eval('stickerCount("friend0")'),0);assert.equal(b.eval('stickerCount("friend2")'),2);assert.equal(b.eval('stickerCount("friend19")'),3);
 b.eval('acorns=84;refreshStickers()');assert.equal(b.eval('stickerCount("friend0")'),1);
});
test('saved question restores safely with malformed optional character metadata',()=>{
 const b=boot();b.eval("startNextStop();current.hostChar={};current.helper={};saveProgress();continueTrail()");
 assert.equal(b.eval('currentScreenId'),'screen-challenge');assert.equal(b.eval('validQuestion(current)'),true);
});
test('generated numeric math answers satisfy the displayed arithmetic',()=>{
 const b=boot();
 assert.equal(b.eval(`(()=>{for(let level=1;level<=4;level++)for(let i=0;i<1000;i++){
  const q=genMath({mlevel:level});const m=q.prompt.match(/^(\\d+) ([+−×÷]) (\\d+)$/);
  if(m){const a=Number(m[1]),c=Number(m[3]);const ans={'+':a+c,'−':a-c,'×':a*c,'÷':a/c}[m[2]];if(q.answer!==ans)return false;}
 }return true})()`),true);
});
test('single HTML asset references are self contained',()=>{
 const urls=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]);
 assert.ok(urls.length>0);assert.ok(urls.every(u=>u.startsWith('data:')||u.startsWith('#')));
});

test('compound reading distractors do not form other common valid answers',()=>{
 const b=boot();const known=new Set(['treehouse','treetop','raincoat','raindrop','raincloud','rainboot','starfish','starlight','stardust','starshine','buttercup','snowmelt','footstep','footpath']);
 const bank=JSON.parse(b.eval('JSON.stringify(READING.compound)'));
 for(const d of bank){assert.equal(d.p+d.a,d.word);for(const o of d.o)assert.equal(known.has(d.p+o),false,`${d.p}+${o} is another valid answer`);}
});

test('saved question validity requires a selectable primitive answer',()=>{
 const b=boot();
 for(const q of [{kind:'math',prompt:'2+3',answer:5,choices:['5','4']},{kind:'read',prompt:'Word',answer:{word:'cat'},choices:[{word:'cat'},'dog']}])assert.equal(b.eval('validQuestion('+JSON.stringify(q)+')'),false);
});

test('intro footer is hidden during gameplay instead of covering answers',()=>{
 const b=boot();b.eval("go('screen-challenge')");assert.equal(b.eval("document.querySelector('.foot-note').style.display"),'none');
 b.eval("go('screen-start')");assert.equal(b.eval("document.querySelector('.foot-note').style.display"),'block');
});

test('answer reveal uses the customized helper name',()=>{
 const b=boot();b.eval("SETTINGS.readAloud=false;startNextStop();current.helper.name='Clover';revealAnswer(current.answer)");
 assert.match(b.eval("document.getElementById('feedback').textContent"),/^Clover points to the answer/);
});


test('all reading questions explain their answer without missing content',()=>{
 const b=boot();
 const questions=JSON.parse(b.eval('JSON.stringify(Object.entries(READING).flatMap(([cat,bank])=>bank.map(d=>buildReading(cat,d))))'));
 for(const q of questions){assert.ok(q.skill);assert.ok(q.explanation.length>20);assert.doesNotMatch(q.explanation,/undefined|NaN/);assert.ok(q.explanation.toLowerCase().replace(/[’]/g,"'").includes(String(q.answer).toLowerCase()));}
});
test('worked math explanations use correct intermediate and final values',()=>{
 const b=boot();
 assert.match(b.eval("mathExplanation('+',28,17,45)"),/28 \+ 10 = 38.*38 \+ 7 = 45/);
 assert.match(b.eval("mathExplanation('−',52,28,24)"),/52 − 20 = 32.*32 − 8 = 24/);
 assert.match(b.eval("mathExplanation('÷',24,6,4)"),/4 × 6 = 24/);
 const questions=JSON.parse(b.eval('JSON.stringify(Array.from({length:1000},()=>genMath({mlevel:4})))'));
 for(const q of questions){assert.ok(q.skill);assert.ok(q.explanation.includes(String(q.answer)));assert.doesNotMatch(q.explanation,/undefined|NaN/);}
});
test('answer review waits for Continue and never awards twice',()=>{
 const b=boot();b.eval("SETTINGS.explanations=true;SETTINGS.sound=false;startNextStop();checkAnswer(document.getElementById('test-answer'),current.answer,current.answer)");
 assert.equal(b.eval('acorns'),1);assert.equal(b.eval('learning.math.completed'),1);assert.equal(b.eval('stopIndex'),0);
 assert.equal(b.eval("document.getElementById('answer-review').hidden"),false);assert.equal(b.eval('rewardTimer'),null);
 assert.ok(b.eval("document.getElementById('answer-explanation').textContent.length")>20);
 b.eval('pendingUnlocks=[];continueAfterReview();continueAfterReview()');
 assert.equal(b.eval('stopIndex'),1);assert.equal(b.eval('acorns'),1);assert.equal(b.eval('learning.math.completed'),1);
});
test('learning totals separate subjects, hints and wrong choices across resume',()=>{
 const b=boot();b.eval("SETTINGS.sound=false;SETTINGS.readAloud=false;startNextStop();showHint();wrongCount=1;saveProgress()");
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval("SETTINGS.sound=false;continueTrail();checkAnswer(document.getElementById('test-answer'),current.answer,current.answer)");
 assert.equal(c.eval('learning.math.completed'),1);assert.equal(c.eval('learning.math.independent'),0);assert.equal(c.eval('learning.math.hinted'),1);assert.equal(c.eval('learning.math.wrong'),1);assert.equal(c.eval('learning.read.completed'),0);
 const d=boot(Object.fromEntries([...c.data].map(([k,v])=>[k,JSON.parse(v)])));
 d.eval('continueTrail()');assert.equal(d.eval('learning.math.completed'),1);
});
test('reveal explains the answer and records it as assisted',()=>{
 const b=boot();b.eval("SETTINGS.sound=false;SETTINGS.readAloud=false;startNextStop();revealAnswer(current.answer)");
 assert.equal(b.eval("document.getElementById('hint-bubble').textContent"),b.eval('questionExplanation(current)'));
 assert.equal(b.eval('current.hintUsed'),true);
 b.eval("checkAnswer(document.getElementById('test-answer'),current.answer,current.answer)");assert.equal(b.eval('learning.math.independent'),0);
});
test('learning record persists on replay and clears separately from trail rewards',()=>{
 const b=boot();b.eval("SETTINGS.sound=false;startNextStop();checkAnswer(document.getElementById('test-answer'),current.answer,current.answer);restart()");
 assert.equal(b.eval('learning.math.completed'),1);
 b.eval("acorns=5;stickerCounts={friend0:2};clearLearningProgress()");
 assert.equal(b.eval('learning.math.completed'),0);assert.equal(b.eval('acorns'),5);assert.equal(b.eval('stickerCounts.friend0'),2);
 b.eval("learning.math.completed=3;store.set(LKEY,learning);confirmReset()");assert.equal(b.eval('learning.math.completed'),0);assert.equal(b.eval('acorns'),0);
});
test('corrupt learning records recover without displaying injected labels',()=>{
 const b=boot({'acorn-trail-learning':{math:{completed:4,independent:10,hinted:-2,wrong:'oops'},read:null,skills:{addition:{completed:2},'<img src=x>':{completed:8}}}});
 assert.equal(b.eval('learning.math.independent'),4);assert.equal(b.eval('learning.math.hinted'),0);assert.equal(b.eval('learning.math.wrong'),0);
 b.eval('renderLearning()');assert.doesNotMatch(b.eval("document.getElementById('learning-summary').innerHTML"),/<img/);
});
test('older saved questions can explain answers and reset cancels paused review',()=>{
 const b=boot();assert.match(b.eval("questionExplanation({kind:'math',prompt:'12 + 5',answer:17})"),/12 \+ 5 = 17/);
 b.eval("SETTINGS.explanations=true;SETTINGS.sound=false;startNextStop();checkAnswer(document.getElementById('test-answer'),current.answer,current.answer);restart();continueAfterReview()");
 assert.equal(b.eval('stopIndex'),0);assert.equal(b.eval('acorns'),0);assert.equal(b.eval('learning.math.completed'),1);
});


test('math story variations preserve the stated operation and quantities',()=>{
 const b=boot();
 for(const takeAway of [false,true]){
  const prompts=JSON.parse(b.eval('JSON.stringify(Array.from({length:100},()=>mathStory("Clover",24,8,"apples",'+takeAway+')))'));
  assert.equal(new Set(prompts).size,8);for(const p of prompts){assert.match(p,/24/);assert.match(p,/8/);assert.match(p,/apples/);}
 }
});


test('downloaded HTML reports its offline mode without a hosted worker',()=>{
 const b=boot();assert.equal(b.eval('offlineReady'),true);assert.match(b.eval("document.getElementById('offline-status').textContent"),/Downloaded game/);
 assert.equal(b.eval('offlineRegistration'),null);assert.equal(b.eval('acorns'),0);
});
test('offline help does not change the active question or progress',()=>{
 const b=boot();b.eval('startNextStop();openOfflineHelp();closeOfflineHelp()');assert.equal(b.eval('validQuestion(current)'),true);assert.equal(b.eval('acorns'),0);
});
test('hosted manifest keeps installation scoped to this game',()=>{
 const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
 assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons)assert.ok(fs.existsSync(icon.src));
});

// Complete actual questions; each call represents another visit to that subject.
function practice(b,kind,{hint=false,wrong=0}={}){
 b.eval(`SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.explanations=true;themeIndex=${kind==='math'?0:1};stopIndex=0;pendingCompletion=false;startNextStop();current.hintUsed=${hint};wrongCount=${wrong};checkAnswer(document.getElementById('test-answer'),current.answer,current.answer)`);
}
test('adaptive practice is opt-in and fixed questions do not train it',()=>{
 const b=boot();assert.equal(b.eval('SETTINGS.adaptive'),false);
 practice(b,'math',{wrong:2});practice(b,'math',{hint:true});
 assert.equal(b.eval('adaptive.math.offset'),0);assert.equal(b.eval('adaptive.math.support'),0);
 const corrupt=boot({'acorn-trail-settings':{adaptive:'true'}});assert.equal(corrupt.eval('SETTINGS.adaptive'),false);
});
test('two assisted completions ease only that subject; hints and wrong taps alone do not',()=>{
 const b=boot();b.eval("toggleSetting('adaptive');SETTINGS.readAloud=false;startNextStop();showHint();wrongCount=3;saveProgress()");
 assert.equal(b.eval('adaptive.math.support'),0);assert.equal(b.eval('adaptive.math.offset'),0);
 practice(b,'math',{hint:true});assert.equal(b.eval('adaptive.math.offset'),0);
 practice(b,'read');practice(b,'math',{wrong:1});
 assert.equal(b.eval('adaptive.math.offset'),-1);assert.equal(b.eval('adaptive.read.offset'),0);
 practice(b,'read',{wrong:1});practice(b,'read',{hint:true});assert.equal(b.eval('adaptive.read.offset'),-1);
});
test('four consecutive independent answers restore usual difficulty without exceeding it',()=>{
 const b=boot();b.eval("toggleSetting('adaptive')");practice(b,'math',{hint:true});practice(b,'math',{hint:true});
 for(let i=0;i<3;i++)practice(b,'math');assert.equal(b.eval('adaptive.math.offset'),-1);
 practice(b,'math',{wrong:1});for(let i=0;i<3;i++)practice(b,'math');assert.equal(b.eval('adaptive.math.offset'),-1);
 practice(b,'math');assert.equal(b.eval('adaptive.math.offset'),0);
 for(let i=0;i<8;i++)practice(b,'math');assert.equal(b.eval('adaptive.math.offset'),0);
});
test('mixed performance interrupts consecutive assisted answers',()=>{
 const b=boot();b.eval("toggleSetting('adaptive')");practice(b,'read',{hint:true});practice(b,'read');practice(b,'read',{wrong:1});
 assert.equal(b.eval('adaptive.read.offset'),0);assert.equal(b.eval('adaptive.read.support'),1);
});
test('adaptive generation respects grade ceilings, reading banks and selected operations',()=>{
 const b=boot();
 for(const grade of ['g1','g2','g3'])for(const offset of [0,-1]){
  b.eval(`SETTINGS.math='${grade}';SETTINGS.reading='${grade}';SETTINGS.adaptive=true;adaptive.math.grade='${grade}';adaptive.read.grade='${grade}';adaptive.math.offset=${offset};adaptive.read.offset=${offset}`);
  for(let region=0;region<7;region++){
   const levels=JSON.parse(b.eval(`JSON.stringify([mathLevel(THEMES[${region}]),clamp(THEMES[${region}].mlevel+mathOffset(),1,4),readingTier(THEMES[${region}]),clamp(THEMES[${region}].rtier+readingOffset(),0,6)])`));
   assert.ok(levels[0]>=1&&levels[0]<=levels[1]);assert.ok(levels[2]>=0&&levels[2]<=levels[3]);
   if(offset===-1){assert.equal(levels[0],Math.max(1,levels[1]-1));assert.equal(levels[2],Math.max(0,levels[3]-1));}
   const issues=JSON.parse(b.eval(`JSON.stringify(Array.from({length:40},()=>[genMath(THEMES[${region}]),pickReading(THEMES[${region}])]).flat().filter(q=>!validQuestion(q)))`));assert.deepEqual(issues,[]);
  }
 }
 b.eval("SETTINGS.math='g1';adaptive.math.grade='g1';adaptive.math.offset=-1;SETTINGS.ops={add:true,sub:false,mul:false,div:false,word:false}");
 const questions=JSON.parse(b.eval('JSON.stringify(Array.from({length:100},()=>genMath(THEMES[0])))'));
 for(const q of questions){assert.equal(q.skill,'addition');assert.ok(q.answer<=20);assert.ok(q.answer>=3);}
 b.eval("SETTINGS.adaptive=false");assert.equal(b.eval('mathLevel(THEMES[6])'),3);
});
test('saved assisted question resumes once, and pending reward cannot train twice',()=>{
 const b=boot();b.eval("toggleSetting('adaptive')");practice(b,'math',{hint:true});
 b.eval('pendingCompletion=false;startNextStop();showHint();wrongCount=1;saveProgress()');
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval("SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.explanations=true;continueTrail();checkAnswer(document.getElementById('test-answer'),current.answer,current.answer);checkAnswer(document.getElementById('test-answer'),0,0)");
 assert.equal(c.eval('adaptive.math.offset'),-1);assert.equal(c.eval('adaptive.math.support'),0);
 const d=boot(Object.fromEntries([...c.data].map(([k,v])=>[k,JSON.parse(v)])));d.eval('continueTrail()');
 assert.equal(d.eval('adaptive.math.offset'),-1);assert.equal(d.eval('adaptive.math.support'),0);
});
test('grade and mode changes preserve the active puzzle but exclude stale performance',()=>{
 const b=boot();b.eval("toggleSetting('adaptive');startNextStop();const originalPrompt=current.prompt;setSubjectGrade('math','g3')");
 assert.equal(b.eval('current.prompt===originalPrompt'),true);
 b.eval('wrongCount=1;recordAdaptive(current)');assert.equal(b.eval('adaptive.math.support'),0);
 b.eval("startNextStop();toggleSetting('adaptive');toggleSetting('adaptive');wrongCount=1;recordAdaptive(current)");assert.equal(b.eval('adaptive.math.support'),0);
 // Questions generated before opting in have no performance context.
 b.eval("toggleSetting('adaptive');startNextStop();toggleSetting('adaptive');recordAdaptive(current)");assert.equal(b.eval('adaptive.math.support'),0);
});
test('replay keeps support, changing one grade resets only that subject, and clearing resets both',()=>{
 const b=boot();b.eval("toggleSetting('adaptive')");for(const kind of ['math','read']){practice(b,kind,{hint:true});practice(b,kind,{hint:true});}
 b.eval('restart()');assert.equal(b.eval('adaptive.math.offset'),-1);assert.equal(b.eval('adaptive.read.offset'),-1);
 b.eval("setSubjectGrade('math','g3')");assert.equal(b.eval('adaptive.math.offset'),0);assert.equal(b.eval('adaptive.read.offset'),-1);
 b.eval('acorns=8;stickerCounts={friend0:2};clearLearningProgress()');assert.equal(b.eval('adaptive.read.offset'),0);assert.equal(b.eval('acorns'),8);assert.equal(b.eval('stickerCounts.friend0'),2);
 practice(b,'math',{hint:true});practice(b,'math',{hint:true});b.eval('confirmReset()');assert.equal(b.eval('adaptive.math.offset'),0);assert.equal(b.eval('acorns'),0);
});
test('malformed or outdated adaptive saves recover safely',()=>{
 for(const raw of [null,'broken',{v:99,math:{offset:-1}},{v:1,math:{grade:'g2',offset:-99,clean:8,support:9,revision:4},read:{grade:'g1',offset:-1,clean:0,support:0,revision:2}}]){
  const b=boot({'acorn-trail-settings':{adaptive:true},'acorn-trail-adaptive':raw});
  assert.equal(b.eval('adaptive.math.offset'),0);assert.equal(b.eval('adaptive.read.offset'),0);b.eval('renderSettings()');
 }
 const b=boot({'acorn-trail-settings':{adaptive:true},'acorn-trail-adaptive':{v:1,math:{grade:'g2',offset:-1,clean:3,support:0,revision:8},read:{grade:'g2',offset:0,clean:0,support:1,revision:9}}});
 assert.equal(b.eval('adaptive.math.offset'),-1);assert.equal(b.eval('adaptive.math.clean'),3);assert.equal(b.eval('adaptive.read.support'),1);
});

function seeded(b,seed=123456){
 b.ctx.Math=Object.create(Math);b.ctx.Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
}
test('reading skill cycles cover the eligible skills without clustering',()=>{
 const b=boot();seeded(b);
 const skills=JSON.parse(b.eval('JSON.stringify(Array.from({length:30},()=>pickReading(THEMES[0]).skill))'));
 for(let i=0;i<skills.length;i+=3)assert.equal(new Set(skills.slice(i,i+3)).size,3);
 for(let i=1;i<skills.length;i++)assert.notEqual(skills[i],skills[i-1]);
});
test('every reading entry is used before its bank repeats, including cycle boundaries',()=>{
 const b=boot();seeded(b,928);
 const sizes=JSON.parse(b.eval('JSON.stringify(Object.fromEntries(Object.entries(READING).map(([cat,bank])=>[cat,bank.length])))'));
 const questions=JSON.parse(b.eval('JSON.stringify(Array.from({length:150},()=>pickReading(THEMES[0])))'));
 const seen={},last={};
 for(const q of questions){
  const cat=q.skill;seen[cat]??=new Set();if(seen[cat].size===sizes[cat])seen[cat].clear();
  assert.equal(seen[cat].has(q.readingId),false);assert.notEqual(q.readingId,last[cat]);seen[cat].add(q.readingId);last[cat]=q.readingId;
 }
});
test('question history and shuffled selection survive reload and replay',()=>{
 const b=boot();seeded(b);
 const before=JSON.parse(b.eval('JSON.stringify(Array.from({length:12},()=>pickReading(THEMES[0]).readingId))'));
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));seeded(c,999);
 c.eval('freshStart()');const after=JSON.parse(c.eval('JSON.stringify(Array.from({length:6},()=>pickReading(THEMES[0]).readingId))'));
 assert.equal(new Set([...before,...after]).size,18);
 c.eval('restart()');assert.ok(c.eval('Object.keys(variety.reading).length')>0);
 c.eval('confirmReset()');assert.equal(c.eval('Object.keys(variety.reading).length'),0);assert.equal(c.data.has('acorn-trail-variety'),false);
});
test('math skills use shuffled coverage and equivalent recent equations are avoided',()=>{
 const b=boot();seeded(b,19);
 const q=JSON.parse(b.eval('JSON.stringify(Array.from({length:120},()=>genMath(THEMES[6])))'));
 for(let i=0;i<q.length;i+=6)assert.equal(new Set(q.slice(i,i+6).map(x=>x.skill)).size,6);
 const keys=q.map(x=>b.eval('mathQuestionKey('+JSON.stringify(x)+')'));
 for(let i=0;i<keys.length;i++)assert.equal(keys.slice(Math.max(0,i-20),i).includes(keys[i]),false);
 assert.equal(b.eval("mathQuestionKey({skill:'addition',prompt:'3 + 7',answer:10})"),b.eval("mathQuestionKey({skill:'addition',prompt:'7 + 3',answer:10})"));
});
test('small math pools and an unchanging random source cannot hang',()=>{
 const b=boot();b.ctx.Math=Object.create(Math);b.ctx.Math.random=()=>0;
 b.eval("SETTINGS.ops={add:false,sub:false,mul:true,div:false,word:false};SETTINGS.adaptive=true;adaptive.math.offset=-1");
 const q=JSON.parse(b.eval('JSON.stringify(Array.from({length:40},()=>genMath(THEMES[0])))'));
 for(const x of q){assert.equal(x.skill,'multiplication');assert.equal(b.eval('validQuestion('+JSON.stringify(x)+')'),true);}
 assert.ok(b.eval('variety.recentMath.length')<=20);
 // Reading selection must likewise avoid rejection loops on a fixed RNG.
 assert.equal(b.eval('Array.from({length:100},()=>pickReading(THEMES[0])).every(validQuestion)'),true);
});
test('malformed variety history cannot add skills or invalid reading entries',()=>{
 const b=boot({'acorn-trail-variety':{v:1,bags:{'read:rhyme|baby|fillblank':['alien','rhyme','rhyme',99]},last:{'read:previous':'alien'},reading:{rhyme:[-1,999,'2',0,0],alien:[0]},recentMath:['x'.repeat(1000),null,7]}});seeded(b);
 assert.equal(b.eval('variety.reading.rhyme.length'),1);assert.equal(b.eval('variety.recentMath.length'),0);
 const questions=JSON.parse(b.eval('JSON.stringify(Array.from({length:30},()=>pickReading(THEMES[0])))'));
 for(const q of questions){assert.ok(['rhyme','baby','fillblank'].includes(q.skill));assert.equal(b.eval('validQuestion('+JSON.stringify(q)+')'),true);}
});
test('recent math questions remain remembered after reload and replay',()=>{
 const b=boot();seeded(b,481);const keys=JSON.parse(b.eval('JSON.stringify(Array.from({length:12},()=>mathQuestionKey(genMath(THEMES[4]))))'));
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));seeded(c,22);c.eval('restart()');
 const next=JSON.parse(c.eval('JSON.stringify(Array.from({length:8},()=>mathQuestionKey(genMath(THEMES[4]))))'));
 assert.equal(new Set([...keys,...next]).size,20);
});

test('reading cycle boundaries avoid the last entry even after selection-cache eviction',()=>{
 const b=boot();seeded(b,77);
 b.eval("const cat='rhyme';variety.reading[cat]=READING[cat].map((_,i)=>i);variety.reading[cat].splice(1,1);variety.reading[cat].push(1);delete variety.last['entry:'+cat];delete variety.bags['entry:'+cat];variety.bags['read:rhyme|baby|fillblank']=['rhyme'];");
 b.ctx.Math=Object.create(Math);b.ctx.Math.random=()=>0;
 const id=b.eval('pickReading(THEMES[0]).readingId');assert.notEqual(id,'rhyme:1');
});

test('all animal expressions preserve head art and expose accessible states',()=>{
 const b=boot();
 for(const animal of JSON.parse(b.eval('JSON.stringify(ANIMALS)'))){
  for(const mood of ['ready','happy','thoughtful','encouraging']){
   const svg=b.eval(`camperGlyph(${JSON.stringify(animal)},${JSON.stringify(mood)})`);
   assert.match(svg,/viewBox="0 0 100 100"/);
   assert.match(svg,new RegExp(`data-expression="${mood}"`));
   assert.match(svg,/role="img" aria-label="[^"]+"/);
   assert.doesNotMatch(svg,/undefined|NaN|<script/);
   if(mood!=='ready')assert.match(svg,/character-smile/);
  }
 }
 assert.equal(b.eval("camperGlyph('dog','invalid')===camperGlyph('dog')"),true);
});
test('personalities stay distinct and custom animals follow their roles',()=>{
 const b=boot();
 assert.deepEqual(JSON.parse(b.eval('JSON.stringify(DEFAULT_ROSTER.map(characterVoice))')),['eager','curious','adventurous','gentle']);
 for(const [role,voice] of Object.entries({math:'eager',read:'curious',lead:'adventurous',help:'gentle',both:'curious'}))
  assert.equal(b.eval(`characterVoice({animal:'fox',role:'${role}'})`),voice);
});
test('character reactions survive resume without altering questions or awarding hints',()=>{
 const b=boot();b.eval("SETTINGS.readAloud=false;SETTINGS.reveal=false;startNextStop();current.hostChar.name='Maple';current.helper.name='Clover';loadChallenge(current);showHint()");
 assert.equal(b.eval('acorns'),0);
 assert.equal(b.eval('current.characterMood'),'thoughtful');
 assert.match(b.eval("document.getElementById('hint-bubble').textContent"),/^Clover says:/);
 assert.ok(b.eval("document.getElementById('hint-bubble').textContent.endsWith(current.hint)"));
 b.eval("checkAnswer(document.createElement('button'),current.choices.find(x=>x!==current.answer),current.answer)");
 assert.equal(b.eval('current.characterMood'),'encouraging');
 assert.match(b.eval("document.getElementById('feedback').textContent"),/^Maple says:/);
 const before=JSON.parse(b.eval('JSON.stringify(current)'));
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval('continueTrail()');
 assert.equal(c.eval('current.prompt'),before.prompt);
 assert.equal(c.eval('current.characterIntro'),before.characterIntro);
 assert.equal(c.eval('current.characterMood'),'encouraging');
 assert.equal(c.eval('wrongCount'),1);
 c.eval("SETTINGS.explanations=true;checkAnswer(document.createElement('button'),current.answer,current.answer)");
 assert.match(c.eval("document.getElementById('ch-host').innerHTML"),/data-expression="happy"/);
 assert.equal(c.eval('acorns'),1);
 c.eval('restart();startNextStop()');assert.equal(c.eval('current.characterMood'),'ready');
});
test('older saves gain a greeting and malformed expression metadata recovers safely',()=>{
 const b=boot();b.eval("startNextStop();delete current.characterIntro;current.characterMood='happy';loadChallenge(current)");
 assert.equal(b.eval('current.characterMood'),'ready');
 assert.ok(b.eval('current.characterIntro.length>10'));
 b.eval("current.characterIntro='<img src=x onerror=alert(1)>';loadChallenge(current)");
 assert.doesNotMatch(b.eval("document.getElementById('ch-host').innerHTML"),/<img/);
});

test('tap activities stay within scheduled stops, grades and enabled operations',()=>{
 const b=boot();
 const issues=JSON.parse(b.eval(`JSON.stringify((()=>{const errors=[];for(const grade of ['g1','g2','g3']){SETTINGS.math=grade;SETTINGS.reading=grade;for(const ops of [{add:true,sub:false,mul:false,div:false,word:false},{add:false,sub:true,mul:false,div:false,word:false},{add:false,sub:false,mul:true,div:false,word:false},{add:false,sub:false,mul:false,div:true,word:false},{add:false,sub:false,mul:false,div:false,word:true}]){SETTINGS.ops=ops;for(const theme of THEMES)for(let i=0;i<20;i++){const base=genMath(theme),q=makeTrailActivity(base,theme,4);if(!validQuestion(q)||q.skill!==base.skill)errors.push(q);if(q.format&&q.choices.some(c=>!Number.isFinite(cardValue(c))))errors.push(q);if(makeTrailActivity(base,theme,3)!==base)errors.push(base);}}for(const theme of THEMES)for(let i=0;i<40;i++){const base=pickReading(theme),q=makeTrailActivity(base,theme,5);if(!validQuestion(q)||q.skill!==base.skill||!READING_TIERS[readingTier(theme)].includes(q.skill))errors.push(q);}}return errors;})())`));
 assert.deepEqual(issues,[]);
});
function activityBoot(format){
 const b=boot();b.eval("SETTINGS.sound=false;SETTINGS.readAloud=false;SETTINGS.explanations=true;SETTINGS.reveal=false");
 if(format==='order')b.eval("themeIndex=0;stopIndex=4;SETTINGS.ops={add:true,sub:false,mul:false,div:false,word:false};startNextStop()");
 else b.eval("themeIndex=0;stopIndex=5;const q=buildReading('rhyme',READING.rhyme[0]);q.readingId='rhyme:0';current=makeTrailActivity(q,THEMES[0],5);current.hostChar=ROSTER[1];current.helper=ROSTER[3];loadChallenge(current);saveProgress()");
 return b;
}
function solveActivity(b){
 b.eval(`while(current&&!answered){if(current.format==='match'){if(current.activityState.selected===null)selectMatch(current.pairs.findIndex((_,i)=>!current.activityState.done.includes(i)));answerActivity(document.createElement('button'),current.choices.indexOf(current.pairs[current.activityState.selected].right));}else answerActivity(document.createElement('button'),current.sequence[current.activityState.done.length]);}`);
}
test('partial ordering saves exact cards, supports undo and awards only once at completion',()=>{
 const b=activityBoot('order');
 b.eval("answerActivity(document.createElement('button'),current.sequence[1])");
 assert.equal(b.eval('wrongCount'),1);assert.equal(b.eval('current.activityState.done.length'),0);
 b.eval("answerActivity(document.createElement('button'),current.sequence[0])");
 assert.equal(b.eval('acorns'),0);assert.equal(b.eval('learning.math.completed'),0);
 const before=JSON.parse(b.eval('JSON.stringify(current)'));
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));c.eval('continueTrail()');
 assert.deepEqual(JSON.parse(c.eval('JSON.stringify(current.choices)')),before.choices);
 assert.deepEqual(JSON.parse(c.eval('JSON.stringify(current.activityState)')),before.activityState);
 assert.equal(c.eval('wrongCount'),1);
 c.eval('SETTINGS.explanations=true;undoOrder()');assert.equal(c.eval('current.activityState.done.length'),0);
 solveActivity(c);c.eval("answerActivity(document.createElement('button'),0);continueAfterReview()");
 for(let i=0;i<30&&c.eval('currentScreenId')==='screen-sticker-unlock';i++)c.eval('unlockContinue()');
 assert.equal(c.eval('acorns'),1);assert.equal(c.eval('learning.math.completed'),1);assert.equal(c.eval('learning.math.wrong'),1);assert.equal(c.eval('stopIndex'),5);
});
test('matching requires both cards, retains solved pairs and selection on resume',()=>{
 const b=activityBoot('match');
 b.eval("answerActivity(document.createElement('button'),0)");assert.equal(b.eval('wrongCount'),0);
 b.eval("selectMatch(0);answerActivity(document.createElement('button'),current.choices.indexOf(current.pairs[1].right))");
 assert.equal(b.eval('wrongCount'),1);assert.equal(b.eval('current.activityState.done.length'),0);
 b.eval("answerActivity(document.createElement('button'),current.choices.indexOf(current.pairs[0].right));selectMatch(1)");
 assert.equal(b.eval('acorns'),0);assert.equal(b.eval('learning.read.completed'),0);
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));c.eval('continueTrail()');
 assert.deepEqual(JSON.parse(c.eval('JSON.stringify(current.activityState)')),{done:[0],selected:1});
 solveActivity(c);assert.equal(c.eval('acorns'),1);assert.equal(c.eval('learning.read.completed'),1);
});
test('guided activities reveal only the next card and still require taps to finish',()=>{
 for(const format of ['order','match']){
  const b=activityBoot(format);b.eval('revealActivity()');
  assert.equal(b.eval('current.hintUsed'),true);assert.equal(b.eval('acorns'),0);assert.equal(b.eval('current.activityState.done.length'),0);
  solveActivity(b);assert.equal(b.eval(`learning.${format==='order'?'math':'read'}.hinted`),1);
  assert.equal(b.eval('acorns'),1);
 }
});
test('malformed saved activities cannot resume impossible progress or unsafe cards',()=>{
 for(const format of ['order','match']){
  const b=activityBoot(format);const q=JSON.parse(b.eval('JSON.stringify(current)'));
  for(const patch of [{format:'other'},{activityState:{done:[0,0],selected:null}},{activityState:{done:[99],selected:null}},{activityState:{done:[0,1,2],selected:null}},{choices:['same','same']}]){
   assert.equal(b.eval('validQuestion('+JSON.stringify({...q,...patch})+')'),false);
  }
  if(format==='order'){
   assert.equal(b.eval('validQuestion('+JSON.stringify({...q,cardValues:q.cardValues.map(v=>v+1)})+')'),false);
   assert.equal(b.eval('validQuestion('+JSON.stringify({...q,activityState:{done:[q.sequence[1]],selected:null}})+')'),false);
  }else assert.equal(b.eval('validQuestion('+JSON.stringify({...q,activityState:{done:[],selected:99}})+')'),false);
 }
});
test('matching cards avoid shared answers and interchangeable rhyme or synonym groups',()=>{
 const b=boot();
 const bad=JSON.parse(b.eval(`JSON.stringify((()=>{const bad=[];for(const cat of Object.keys(MATCH_INSTRUCTIONS))for(let i=0;i<READING[cat].length;i++){const q=buildReading(cat,READING[cat][i]);q.readingId=cat+':'+i;const a=makeTrailActivity(q,THEMES[0],5);if(a.format){const entries=a.readingIds.map(id=>READING[cat][Number(id.split(':')[1])]);if(new Set(entries.map(d=>matchingGroup(cat,d))).size!==entries.length)bad.push(a);}}return bad;})())`));
 assert.deepEqual(bad,[]);
});

test('ordering remembers every displayed equation and bounded retries tolerate constant randomness',()=>{
 const b=activityBoot('order');
 assert.equal(b.eval("current.choices.every((prompt,i)=>variety.recentMath.includes(mathQuestionKey({skill:current.skill,prompt,answer:current.cardValues[i]})))"),true);
 b.eval('const savedRandom=Math.random;Math.random=()=>0.5');
 assert.equal(b.eval("validQuestion(makeTrailActivity(genMath(THEMES[0]),THEMES[0],4))"),true);
 b.eval('Math.random=savedRandom');
});

test('focused friend editing cancels safely and persists saved jobs',()=>{
 const b=boot();b.eval("openCharacters();editChar(0);typeName('Maple');cancelEditor()");
 assert.equal(b.eval('ROSTER[0].name'),'Biscuit');
 b.eval("editChar(0);typeName('Maple');setDraft('role','both');commitDraft()");
 assert.equal(b.eval('currentScreenId'),'screen-characters');
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval('openCharacters()');assert.equal(c.eval('ROSTER[0].name'),'Maple');assert.equal(c.eval('ROSTER[0].role'),'both');
});
test('incomplete team drafts survive reload without breaking the home screen',()=>{
 const b=boot();b.eval('openCharacters();while(ROSTER.length)removeChar(0);leaveCharacters()');
 assert.equal(b.eval('ROSTER.length'),4);
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 c.eval('openCharacters()');assert.equal(c.eval('ROSTER.length'),0);assert.equal(c.eval('teamValid()'),false);
 c.eval('playTeam()');assert.equal(c.eval('currentScreenId'),'screen-characters');
 c.eval('leaveCharacters()');assert.equal(c.eval('currentScreenId'),'screen-start');
});
test('intro speakers are the customized travel guide and helper',()=>{
 const b=boot();b.eval("ROSTER=[{animal:'dog',name:'Maple',role:'lead'},{animal:'cat',name:'Clover',role:'help'},{animal:'pig',name:'Pip',role:'both'}]");
 assert.deepEqual(JSON.parse(b.eval('JSON.stringify([...new Set(buildStory().map(s=>s.char.name))])')),['Maple','Clover']);
 assert.equal(b.eval('teamValid()'),true);
});

test('two friends can cover guide and helper plus math and reading and survive reload',()=>{
 const b=boot();b.eval("ROSTER=[{animal:'dog',name:'Maple',role:'guidehelp'},{animal:'cat',name:'Clover',role:'both'}];persistTeam()");
 assert.equal(b.eval('teamValid()'),true);assert.equal(b.eval('validRoster(ROSTER)'),true);
 assert.equal(b.eval('leadPrimary().name'),'Maple');assert.equal(b.eval('pickHelper().name'),'Maple');
 assert.equal(b.eval("buildStory().every(s=>s.char.name==='Maple')"),true);
 const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
 assert.equal(c.eval('ROSTER.length'),2);assert.equal(c.eval('teamValid()'),true);
 c.eval("go('screen-story');playTeam()");assert.equal(c.eval('currentScreenId'),'screen-story');
});

test('incomplete teams explain missing jobs when starting and preserve progress',()=>{
 const b=boot();b.eval("ROSTER=ROSTER.filter(c=>c.role!=='help');renderCharacters();acorns=7;playTeam()");
 assert.equal(b.eval('acorns'),7);
 assert.equal(b.eval("missingTeamJobs().join(', ')"),'Helper');
 assert.ok(b.eval("document.getElementById('cc-actions').innerHTML.includes('Your team still needs: Helper.')"));
 assert.ok(!b.eval("document.getElementById('cc-actions').innerHTML.includes('team-start\" disabled')"));
 b.eval("ROSTER.push({animal:'cat',name:'Pip',role:'help'});renderCharacters()");
 assert.equal(b.eval('missingTeamJobs().length'),0);
 assert.ok(b.eval("document.getElementById('cc-actions').innerHTML.includes('All jobs covered.')"));
});

test('new animal friends support saved teams and all expressions',()=>{
 for(const animal of ['axolotl','capybara','otter','raccoon','turtle']){
  const b=boot();b.eval(`ROSTER[0].animal=${JSON.stringify(animal)};persistTeam()`);
  const c=boot(Object.fromEntries([...b.data].map(([k,v])=>[k,JSON.parse(v)])));
  assert.equal(c.eval('ROSTER[0].animal'),animal);
  for(const mood of ['ready','happy','thoughtful','encouraging'])assert.match(c.eval(`camperGlyph(${JSON.stringify(animal)},${JSON.stringify(mood)})`),new RegExp('data-expression="'+mood+'"'));
 }
});
