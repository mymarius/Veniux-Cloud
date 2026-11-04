import {saveConsent} from '../assets/consent-state.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversionTracker,bootConversions} from '../assets/conversion.mjs';
const fixture=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('each successful form maps to one allowlisted event without personal data',()=>{
 const calls=[],storage=fixture(),send=(...args)=>calls.push(args),track=createConversionTracker({storage,send,consent:()=>true});
 for(const [i,form_type] of ['demo','quote','contact','partnership'].entries()){
  const event=form_type==='partnership'?'partnership_submit':'generate_lead',input={event,form_type,receipt:String(i).repeat(32),email:'private@example.invalid',name:'PRIVATE',page_path:'/?email=PRIVATE'};
  assert.equal(track(input),true);assert.equal(track(input),false);
  assert.equal(createConversionTracker({storage,send,consent:()=>true})(input),false);
 }
 assert.equal(calls.length,4);for(const [,p]of calls){assert.deepEqual(Object.keys(p),['form_type','page_path','page_location','page_referrer']);assert.equal(p.page_path,'/');assert.equal(p.page_location,'https://veniux.com/');assert.equal(p.page_referrer,'');}assert(!JSON.stringify(calls).includes('PRIVATE'));
});
test('no consent, unsuccessful response and spoofed event do not send or store',()=>{
 let calls=0;const storage=fixture(),track=createConversionTracker({storage,consent:()=>false,send:()=>calls++});
 assert.equal(track({form_type:'demo',receipt:'a'.repeat(32),event:'generate_lead'}),false);assert.equal(storage.getItem('veniux-conversions-v1'),null);
 const accepted=createConversionTracker({storage,consent:()=>true,send:()=>calls++});
 for(const input of [null,{event:'generate_lead',form_type:'demo'},{event:'purchase',form_type:'demo',receipt:'a'.repeat(32)},{event:'generate_lead',form_type:'private@email',receipt:'a'.repeat(32)}])assert.equal(accepted(input),false);
 assert.equal(calls,0);
});
test('revoking consent stops new events and uncertain transport is not replayed',()=>{
 let consent=true,calls=0;const track=createConversionTracker({storage:fixture(),consent:()=>consent,send:()=>{calls++;throw Error('uncertain');}}),input={event:'generate_lead',form_type:'demo',receipt:'f'.repeat(32)};
 assert.equal(track(input),false);assert.equal(track(input),false);assert.equal(calls,1);consent=false;assert.equal(track({...input,receipt:'e'.repeat(32)}),false);assert.equal(calls,1);
});
test('no GA4 account adapter means no transport, even after consent',()=>{
 const storage=fixture();saveConsent(storage,true);let removed=0;
 const element={dataset:{conversionReceipt:'b'.repeat(32),conversionEvent:'generate_lead',conversionType:'demo'},remove:()=>removed++};
 const doc={querySelectorAll:selector=>selector==='[data-conversion-receipt]'?[element]:[],getElementById:()=>null,querySelector:()=>null};
 bootConversions({localStorage:storage},doc);assert.equal(removed,1);assert.equal(storage.getItem('veniux-conversions-v1'),null);
});
