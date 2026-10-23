'use strict';
// Treat generated code as untrusted. Only allow game changes and NEW issue tests.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
function git(args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})}
function files(z){return z.split('\0').filter(Boolean)}
function isAllowed(file,issue,isNew){
  return file==='index.html'||(isNew&&new RegExp('^tests/feature-'+issue+'-[a-z0-9-]+(?:\\.browser)?\\.test\\.cjs).test(file));
}
function checkChangeSet({tracked,untracked,diff,issue}){
  const errors=[];
  if(!/^[1-9][0-9]*$/.test(issue))errors.push('Invalid issue number');
  const changed=new Set([...tracked,...untracked]);
  if(!tracked.includes('index.html'))errors.push('No changes to index.html');
  for(const file of tracked)if(!isAllowed(file,issue,false))errors.push('Forbidden change to tracked file '+file);
  for(const file of untracked)if(!isAllowed(file,issue,true))errors.push('Forbidden untracked file '+file);
  if(changed.size>8)errors.push('Too many changed files ('+changed.size+')');
  if(diff.length>140000)errors.push('Game diff exceeds review limit (140000 characters)');
  const added=diff.split('\n').filter(x=>x.startsWith('+')&&!x.startsWith('+++')).map(x=>x.slice(1)).join('\n');
  // Allow the standard SVG namespace URL that is already part of inline artwork.
  const sanitized=added.replace(/https?:\/\/www\.w3\.org\/2000\/svg/g,'');
  if(/https?:\/\//i.test(sanitized)||/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(added)||/@import\b/.test(added))
    errors.push('Added network dependency or network API');
  if(!changed.size)errors.push('Developer made no changes');
  return errors;
}
function main(){
  const issue=process.env.ISSUE_NUMBER??'';
  const tracked=files(git(['diff','--name-only','-z','--']));
  const untracked=files(git(['ls-files','--others','--exclude-standard','-z','--']));
  const diff=git(['diff','--unified=3','--','index.html']);
  const errors=checkChangeSet({tracked,untracked,diff,issue});
  const dir=path.join(root,'artifacts','implementation');
  fs.mkdirSync(dir,{recursive:true});
  const notes=path.join(dir,'notes.md');
  if(errors.length){
    fs.writeFileSync(path.join(dir,'status.txt'),'BLOCKED\n');
    fs.appendFileSync(notes,'\n\n## Deterministic change safety gate: BLOCKED\n'+errors.map(x=>'- '+x).join('\n')+'\n');
    console.error(errors.join('\n'));
    process.exitCode=1;
    return;
  }
  fs.writeFileSync(path.join(dir,'status.txt'),'IMPLEMENTED\n');
  fs.appendFileSync(notes,'\n\n## Deterministic change safety gate: PASS\nGame source changed. New tests: '+untracked.length+'. Runtime/acceptance checks still required.\n');
  console.log('Verified implementation scope for #'+issue+': '+[...tracked,...untracked].join(', '));
}
if(require.main===module)main();
module.exports={checkChangeSet,isAllowed};
).test(file));
}
function checkChangeSet({tracked,untracked,diff,issue}){
  const errors=[];
  if(!/^[1-9][0-9]*$/.test(issue))errors.push('Invalid issue number');
  const changed=new Set([...tracked,...untracked]);
  if(!tracked.includes('index.html'))errors.push('No changes to index.html');
  for(const file of tracked)if(!isAllowed(file,issue,false))errors.push('Forbidden change to tracked file '+file);
  for(const file of untracked)if(!isAllowed(file,issue,true))errors.push('Forbidden untracked file '+file);
  if(changed.size>8)errors.push('Too many changed files ('+changed.size+')');
  if(diff.length>140000)errors.push('Game diff exceeds review limit (140000 characters)');
  const added=diff.split('\n').filter(x=>x.startsWith('+')&&!x.startsWith('+++')).map(x=>x.slice(1)).join('\n');
  // Allow the standard SVG namespace URL that is already part of inline artwork.
  const sanitized=added.replace(/https?:\/\/www\.w3\.org\/2000\/svg/g,'');
  if(/https?:\/\//i.test(sanitized)||/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(added)||/@import\b/.test(added))
    errors.push('Added network dependency or network API');
  if(!changed.size)errors.push('Developer made no changes');
  return errors;
}
function main(){
  const issue=process.env.ISSUE_NUMBER??'';
  const tracked=files(git(['diff','--name-only','-z','--']));
  const untracked=files(git(['ls-files','--others','--exclude-standard','-z','--']));
  const diff=git(['diff','--unified=3','--','index.html']);
  const errors=checkChangeSet({tracked,untracked,diff,issue});
  const dir=path.join(root,'artifacts','implementation');
  fs.mkdirSync(dir,{recursive:true});
  const notes=path.join(dir,'notes.md');
  if(errors.length){
    fs.writeFileSync(path.join(dir,'status.txt'),'BLOCKED\n');
    fs.appendFileSync(notes,'\n\n## Deterministic change safety gate: BLOCKED\n'+errors.map(x=>'- '+x).join('\n')+'\n');
    console.error(errors.join('\n'));
    process.exitCode=1;
    return;
  }
  fs.writeFileSync(path.join(dir,'status.txt'),'IMPLEMENTED\n');
  fs.appendFileSync(notes,'\n\n## Deterministic change safety gate: PASS\nGame source changed. New tests: '+untracked.length+'. Runtime/acceptance checks still required.\n');
  console.log('Verified implementation scope for #'+issue+': '+[...tracked,...untracked].join(', '));
}
if(require.main===module)main();
module.exports={checkChangeSet,isAllowed};
