import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categoryIcon,cashierName,registerName,orderedProducts,validCount,latencySummary} from './posPresentation.mjs';
test('category fallback is semantic and supports an explicit category icon',()=>{
 assert.equal(categoryIcon('Manav'),'leaf');assert.equal(categoryIcon('İçecek'),'cup');assert.equal(categoryIcon('Fırın'),'bread');assert.equal(categoryIcon('Bilinmeyen'),'box');assert.equal(categoryIcon('Manav','tag'),'tag');
});
test('cashier presentation never falls back to a generated email or tenant ID',()=>{
 assert.equal(cashierName({full_name:'  Ayşe   Demir ',email:'owner_123@tenant.com'}),'Ayşe Demir');assert.equal(cashierName({email:'owner_123@tenant.com',tenant_id:6}),'Kasiyer');assert.equal(cashierName({full_name:'user_123'}),'Kasiyer');assert.equal(registerName({id:7,name:'Ana kasa'}),'Ana kasa · 07');
});
test('prioritized favorites outside the current page appear once ahead of ordinary products',()=>{
 const rows=[{id:2},{id:3}],pins=[{id:90},{id:2}];assert.deepEqual(orderedProducts(rows,pins,[90,2],true).map(p=>p.id),[90,2,3]);assert.deepEqual(orderedProducts(rows,pins,[90],false),rows);assert.deepEqual(orderedProducts(rows,pins,[],true),rows);
});
test('touch quantity cannot create zero, fractional, scientific or unbounded counts',()=>{
 for(const v of ['1',1,100000])assert.equal(validCount(v),true);for(const v of ['',0,-1,'1.2','1e3',100001,1000000,NaN])assert.equal(validCount(v),false);
});
test('latency percentiles contain only bounded timing values',()=>{
 assert.deepEqual(latencySummary([{total_ms:30},{total_ms:10},{total_ms:20}]),{samples:3,p50_ms:20,p95_ms:30});assert.equal(latencySummary([]).p50_ms,null);
});
