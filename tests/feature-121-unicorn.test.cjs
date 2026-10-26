// Feature 121: unicorn art and animal-picker accessibility.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const match=html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
assert.ok(match,'embedded game script exists');
const script=new vm.Script(match[1],{filename:'index.html'});

function boot(){
  const elements=new Map();
  const element=(id='')=>{
    if(!elements.has(id))elements.set(id,{
      id,style:{},className:'',textContent:'',innerHTML:'',dataset:{},children:[],
      classList:{add(){},remove(){},toggle(){}},appendChild(x){this.children.push(x);return x},remove(){},
      setAttribute(){},removeAttribute(){},querySelector(){return element(id+'-child')},querySelectorAll(){return []},
      addEventListener(){},get offsetWidth(){return 10}
    });
    return elements.get(id);
  };
  const document={body:element('body'),getElementById:element,createElement:()=>element('created'),querySelectorAll:()=>[],querySelector:()=>element('query'),addEventListener(){}};
  const localStorage={setItem(){},getItem(){return null},removeItem(){}};
  const window={addEventListener(){},speechSynthesis:null};
  const ctx=vm.createContext({window,document,localStorage,console,setTimeout:()=>1,clearTimeout(){},confirm:()=>true,Math,JSON});
  script.runInContext(ctx,{timeout:10000});
  return {ctx,elements,eval(code){return vm.runInContext(code,ctx,{timeout:10000})}};
}

test('unicorn is an inline animal glyph with the shared character expressions',()=>{
  const b=boot();
  assert.equal(b.eval("ANIMALS.at(-1)"),'unicorn');
  const art=b.eval("animalGlyph('unicorn')");
  assert.match(art,/<svg viewBox="0 0 100 100">/);
  assert.match(art,/fill="#E7B25A"/,'the unicorn has an inline horn in the existing palette');
  for(const mood of ['ready','happy','thoughtful','encouraging']){
    const svg=b.eval(`camperGlyph('unicorn',${JSON.stringify(mood)})`);
    assert.match(svg,new RegExp(`data-expression="${mood}"`));
    assert.match(svg,/role="img" aria-label=/);
  }
});

test('friend editor renders a named unicorn button in the animal list order',()=>{
  const b=boot();
  b.eval("draft={animal:'unicorn',name:'Clover',role:'math'};editIndex=-1;renderEditor()");
  const editor=b.elements.get('editor-holder').innerHTML;
  const labels=[...editor.matchAll(/<button class="[^"]*" aria-label="([^"]+)" aria-pressed="([^"]+)"/g)];
  assert.ok(labels.length>0);
  assert.equal(labels.at(-1)[1],'unicorn','unicorn follows the existing thematic animal order');
  assert.equal(labels.at(-1)[2],'true','the selected unicorn exposes its pressed state');
  assert.match(editor,/role="group" aria-label="Choose an animal" tabindex="0"/);
  assert.match(editor,/<button class="on" aria-label="unicorn" aria-pressed="true"[^>]*><svg[\s\S]*?<span>Unicorn<\/span><\/button>/);
});
