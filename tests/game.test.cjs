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
 const ctx=vm.createContext({window,document,localStorage,console,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,Math,JSON});
 script.runInContext(ctx,{timeout:10000});
 return {ctx,data,eval(code){return vm.runInContext(code,ctx,{timeout:10000})}};
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
