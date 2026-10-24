'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {policy}=require('../scripts/attempt-budget.cjs');
test('small changes select Luna low',()=>{const v=policy({number:83,title:'Fix panel border',body:'Remove border'},[],'amthqng');assert.equal(v.model,'gpt-6-luna');assert.equal(v.effort,'low');});

const {parseCodexUsage}=require('../scripts/agent-usage-report.cjs');
test('reports Codex token count',()=>{const x=parseCodexUsage('2026-10-24T02:11:48.423Z tokens used\n2026-10-24T02:11:48.424Z 193,763\n2026-10-24T02:11:48.425Z model: gpt-6.1-sol');assert.equal(x.tokens,193763);});
