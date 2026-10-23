'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const worker=read('.github/workflows/implement-approved.yml');
const reviewer=read('orchestration/review-implementation.ts');
const controller=read('.github/workflows/product-pipeline.yml');
const brief=read('scripts/build-developer-brief.cjs');
const validator=read('scripts/verify-developer-change.cjs');
const acceptance=read('tests/fall-theme-acceptance.browser.test.cjs');

test('development uses a sandboxed repo-aware coding agent, not brittle JSON patches',()=>{
  assert.match(worker,/openai\/codex-action@v1/);
  assert.match(worker,/permission-profile: ':workspace'/);
  assert.match(worker,/allow-bot-users: 'github-actions\[bot\]'/);
  assert.match(worker,/prompt-file: inputs\/developer-brief\.md/);
  assert.match(worker,/effort: high/);
  assert.doesNotMatch(worker,/implement-issue\.ts/);
  assert.doesNotMatch(worker,/gpt-4\.1-mini/);
  assert.doesNotMatch(worker,/output-schema:/);
});

test('repository write token is unavailable during autonomous code editing',()=>{
  assert.match(worker,/persist-credentials: false/);
  const codex=worker.split('      - name: Run workspace coding agent')[1]?.split('      - name: Independently enforce')[0];
  assert.ok(codex);
  assert.doesNotMatch(codex,/GH_TOKEN|PROJECT_TOKEN|secrets\.PROJECTS_TOKEN/);
  assert.match(worker,/gh auth setup-git/);
  assert.ok(worker.indexOf('      - name: Independently enforce')<worker.indexOf('      - name: Open draft implementation PR'));
});

test('full owner rejection, tech-lead acceptance and reviewer corrections reach Codex',()=>{
  assert.match(worker,/inputs\/issue-comments\.json/);
  assert.match(worker,/node scripts\/build-developer-brief\.cjs/);
  assert.match(brief,/UAT\\s\*REJECTED/);
  assert.match(brief,/acorn-review-rejected/);
  assert.match(brief,/acorn-tech-lead-gate/);
  assert.match(brief,/Approved Tech Lead intake and acceptance criteria/);
  assert.match(brief,/actual checked-out index\.html/);
});

test('independent QA reviews the entire real diff, not first substring',()=>{
  assert.ok(reviewer.includes("execFileSync('git',['diff','--unified=3'"));
  assert.match(reviewer,/REAL UNIFIED CODE DIFF/);
  assert.match(reviewer,/PRODUCT OWNER UAT REJECTION/);
  assert.match(reviewer,/model:process\.env\.ACORN_AGENT_MODEL\|\|'gpt-4\.1'/);
  assert.match(worker,/node --test tests\/game\.test\.cjs/);
  assert.match(worker,/node --test tests\/qa-smoke\.test\.cjs/);
});

test('fall theme requires palette, scene and map differences in visible offline DOM',()=>{
  assert.match(worker,/node --test tests\/fall-theme-acceptance\.browser\.test\.cjs/);
  assert.match(acceptance,/inputs\/original-index\.html/);
  assert.match(acceptance,/changedTokens\.length>=2/);
  assert.match(acceptance,/changedScenes\.length>=2/);
  assert.match(acceptance,/mapChanged/);
  assert.match(acceptance,/offline:true/);
  assert.match(acceptance,/pageerror/);
});

test('deterministic gate blocks unrelated or network-dependent changes',()=>{
  assert.match(worker,/node scripts\/verify-developer-change\.cjs/);
  assert.match(validator,/Forbidden change to tracked file/);
  assert.match(validator,/No changes to index\.html/);
  assert.match(validator,/Added network dependency or network API/);
  assert.match(worker,/gh pr create --base uat --head/);
  assert.doesNotMatch(worker,/gh pr merge/);
  assert.doesNotMatch(worker,/PROJECT_STATUS: Ready for UAT/);
  assert.match(controller,/PROJECT_STATUS: Ready for UAT/);
});

test('reviewer REVISE feeds the next attempt, without self-publishing',()=>{
  assert.match(worker,/acorn-review-rejected/);
  assert.match(worker,/grep -Fxq REVISE/);
  assert.match(worker,/stage="In Development"/);
  assert.doesNotMatch(worker,/wrangler[^\n]*deploy/);
});
