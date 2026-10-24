'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {policy}=require('../scripts/attempt-budget.cjs');
test('small changes select Luna low',()=>{const v=policy({number:83,title:'Fix panel border',body:'Remove border'},[],'amthqng');assert.equal(v.model,'gpt-6-luna');assert.equal(v.effort,'low');});
