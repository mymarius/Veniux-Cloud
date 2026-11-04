import {readConsent} from './consent-state.mjs';
const types=new Set(['demo','quote','contact','partnership']);
export function createConversionTracker({storage,send,consent=()=>false}){
 const memory=new Set();
 return function track(input){
  if(!consent()||!input||!types.has(input.form_type)||!/^[a-f0-9]{32}$/.test(input.receipt||''))return false;
  const event=input.form_type==='partnership'?'partnership_submit':'generate_lead';
  if(input.event!==event)return false;
  let saved=[];try{saved=JSON.parse(storage?.getItem('veniux-conversions-v1')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
  if(memory.has(input.receipt)||saved.includes(input.receipt))return false;
  // Reserve before sending. Transport uncertainty must not cause double counting.
  memory.add(input.receipt);try{storage?.setItem('veniux-conversions-v1',JSON.stringify([...saved.slice(-63),input.receipt]));}catch{}
  try{send(event,{form_type:input.form_type,page_path:'/',page_location:'https://veniux.com/',page_referrer:''});return true;}catch{return false;}
 };
}
export function bootConversions(win,doc){
 const storage=(()=>{try{return win.localStorage;}catch{return null;}})();
 const granted=()=>{try{return readConsent(storage)?.analytics===true&&win.navigator?.globalPrivacyControl!==true;}catch{return false;}};
 const track=createConversionTracker({storage,consent:()=>granted()&&typeof win.gtag==='function',send:(name,params)=>win.gtag('event',name,params)});
 const consume=()=>doc.querySelectorAll('[data-conversion-receipt]').forEach(el=>{
  // No retroactive collection if consent was absent at the successful response.
  track({receipt:el.dataset.conversionReceipt,event:el.dataset.conversionEvent,form_type:el.dataset.conversionType});el.remove();
 });
 consume();
 const form=doc.querySelector('.contact-form'),field=doc.querySelector('[data-partner-field]');
 const error=doc.querySelector('.form-feedback.error[role="alert"]');
 if(error){error.tabIndex=-1;error.focus({preventScroll:false});}
 if(form&&field){const update=()=>{const active=form.elements.form_type.value==='partnership';field.hidden=!active;form.elements.partner_type.required=active;};form.elements.form_type.addEventListener('change',update);update();}
}
