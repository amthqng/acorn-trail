'use strict';
/*
 * GitHub parses closing keywords in pull-request titles and descriptions.
 * A workflow-repair PR called "Fix #83..." closed the unfinished feature,
 * and the Project's built-in rule moved its card to Done. Reject ambiguous
 * autoclose references: releases are controlled by release receipts instead.
 */
const CLOSING_REFERENCE=/\b(?:close[sd]?|fix(?:es|ed)?|resolv(?:e[sd]?|ing))\s+(?:(?:[a-zA-Z0-9_.-]+)\/(?:[a-zA-Z0-9_.-]+))?#([1-9][0-9]*)\b/gi;

function closingReferences(text){
  return [...String(text??'').matchAll(CLOSING_REFERENCE)].map(m=>Number(m[1]));
}
function checkPr({title='',body='',base='main'}={}){
  if(base!=='main')return [];
  return [...new Set([...closingReferences(title),...closingReferences(body)])];
}
if(require.main===module){
  const issues=checkPr({title:process.env.PR_TITLE,body:process.env.PR_BODY,base:process.env.PR_BASE});
  if(issues.length){
    console.error('::error::Unsafe PR closing reference(s) to unfinished issues: '+issues.map(n=>'#'+n).join(', ')+'. Do not use Fix/Closes/Resolves #N in a PR targeting main; leave feature issue closure to the release workflow.');
    process.exitCode=1;
  }else{
    console.log('PR title and body contain no automatic issue-closing references.');
  }
}
module.exports={checkPr,closingReferences};
