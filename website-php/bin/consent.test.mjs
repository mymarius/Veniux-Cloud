import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSENT_KEY,CONSENT_TTL,readConsent,saveConsent} from '../assets/consent-state.mjs';
import {bootConversions} from '../assets/conversion.mjs';
function fixture(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('missing, legacy, malformed, expired and future choices fail closed',()=>{
 const s=fixture();assert.equal(readConsent(s),null);s.setItem('veniux-analytics-consent-v1','granted');assert.equal(readConsent(s),null);
 for(const v of ['bad','null',JSON.stringify({version:2,analytics:'true',savedAt:1}),JSON.stringify({version:1,analytics:true,savedAt:1})]){s.setItem(CONSENT_KEY,v);assert.equal(readConsent(s),null);}
 saveConsent(s,true,1000);assert.equal(readConsent(s,1000+CONSENT_TTL-1).analytics,true);assert.equal(readConsent(s,1000+CONSENT_TTL),null);assert.equal(readConsent(s,999),null);
});
test('reject persists, removes legacy consent and clears conversion receipts',()=>{
 const s=fixture();s.setItem('veniux-analytics-consent-v1','granted');s.setItem('veniux-conversions-v1','["old"]');saveConsent(s,false,1000);
 assert.equal(readConsent(s,1001).analytics,false);assert.equal(s.getItem('veniux-conversions-v1'),null);assert.equal(s.getItem('veniux-analytics-consent-v1'),null);
 assert.deepEqual(Object.keys(JSON.parse(s.getItem(CONSENT_KEY))),['version','analytics','savedAt']);
});
test('blocked storage does not throw and cannot produce a persisted grant',()=>{
 const s={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};assert.equal(saveConsent(s,true).analytics,true);assert.equal(readConsent(s),null);
});
function run(storage,navigator={}){
 const calls=[];const doc={querySelectorAll:selector=>selector==='[data-conversion-receipt]'?[{dataset:{conversionReceipt:'a'.repeat(32),conversionEvent:'generate_lead',conversionType:'demo'},remove(){}}]:[],querySelector:()=>null};
 bootConversions({localStorage:storage,navigator,gtag:(...args)=>calls.push(args)},doc);return calls;
}
test('conversion transport requires current explicit consent and respects GPC',()=>{
 const s=fixture();s.setItem('veniux-analytics-consent-v1','granted');assert.equal(run(s).length,0);saveConsent(s,false);assert.equal(run(s).length,0);saveConsent(s,true);assert.equal(run(s,{globalPrivacyControl:true}).length,0);assert.equal(run(s).length,1);
 saveConsent(s,false);assert.equal(run(s).length,0);saveConsent(s,true,Date.now()-CONSENT_TTL);assert.equal(run(s).length,0);
});
