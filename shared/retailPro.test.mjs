import test from 'node:test';import assert from 'node:assert/strict';
import {quantity,scaleReading,keypad,safeImage} from './retailPro.mjs';
import {ScaleAdapter} from './scaleAdapter.mjs';
import {cacheCatalog,readCatalog,cacheKey} from './retailCatalogCache.mjs';
import {saveCountDraft,readCountDraft} from './countDraft.mjs';
test('kg/gram quantities preserve decimal precision and reject malformed/negative inputs',()=>{
 assert.equal(quantity('1250','g'),1.25);assert.equal(quantity('0,125','kg'),.125);assert.equal(quantity('0.001','g'),.000001);
 for(const v of [0,-1,'1e3','NaN',true,'1.0000001','1000001'])assert.throws(()=>quantity(v));
 assert.throws(()=>quantity('.0001','g'));
});
test('stable scale values require a recent timestamp and explicit supported unit',()=>{
 assert.equal(scaleReading({stable:true,timestamp:1000,weight:'250',unit:'g'},{now:1100}).quantity,.25);
 for(const frame of [{stable:false,timestamp:1000,weight:'1',unit:'kg'},{stable:true,timestamp:1,weight:'1',unit:'kg'},{stable:true,timestamp:2000,weight:'1',unit:'kg'},{stable:true,timestamp:1000,weight:'1',unit:'lb'}])assert.throws(()=>scaleReading(frame,{now:1500,maxAgeMs:1000}));
});
test('serial/TCP adapter contract validates data and fails on timeout without reusing stale weight',async()=>{
 for(const connection of ['serial','tcp']){
  const a=new ScaleAdapter({profile:{connection},transport:{read:async()=>({stable:true,timestamp:100,weight:'1.25',unit:'kg'})},decode:v=>v,clock:()=>200});assert.equal((await a.read()).quantity,1.25);
 }
 const a=new ScaleAdapter({profile:{connection:'serial'},transport:{read:()=>new Promise(()=>{})},decode:v=>v,timeoutMs:100});await assert.rejects(()=>a.read(),/yanıt/);
});
test('touch keypad cannot insert scripts/second decimals; images stay on local uploads',()=>{
 assert.equal(keypad('1.2','.'),'1.2');assert.equal(keypad('12','⌫'),'1');assert.equal(keypad('12','C'),'');assert.equal(keypad('12','x'),'12');
 assert.equal(safeImage('https://tracker.invalid/x.png'),null);assert.equal(safeImage('/uploads/../private.png'),null);assert.equal(safeImage('/uploads/product-1.webp'),'/uploads/product-1.webp');
});
test('catalog cache is bounded, expires and is separated by user and company',()=>{
 const values=new Map(),s={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)},key=cacheKey(1,2);
 cacheCatalog(s,key,Array.from({length:300},(_,id)=>({id,name:'Test',purchase_price:99})),1000);
 assert.equal(readCatalog(s,key,1001).length,250);assert.equal(readCatalog(s,cacheKey(2,2),1001).length,0);assert.equal(readCatalog(s,key,86401001).length,0);assert(!values.get(key).includes('purchase_price'));
});
test('offline count draft preserves its original baseline rather than accepting a fresh stock snapshot',()=>{
 const m=new Map(),s={setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)};
 saveCountDraft(s,'tenant:user:warehouse',[{location_id:1,product_id:2,lot_id:null,baseline_token:'original-token'}],{'1:2:none':'3'},1000);
 assert.equal(readCountDraft(s,'tenant:user:warehouse',1001).rows[0].baseline_token,'original-token');assert.equal(readCountDraft(s,'other',1001),null);assert.equal(readCountDraft(s,'tenant:user:warehouse',1000+8*3600000),null);
});
