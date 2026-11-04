import {CONSENT_KEY,readConsent,saveConsent} from './consent-state.mjs';
const banner=document.getElementById('cookie-banner'),dialog=document.getElementById('cookie-preferences');
if(banner&&dialog){
 const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
 const toggle=dialog.querySelector('[name="analytics"]'),status=document.getElementById('cookie-status');
 const restricted=navigator.globalPrivacyControl===true;
 let current=readConsent(storage),opener=null;
 const effective=()=>Boolean(current?.analytics)&&!restricted;
 function announce(){window.dispatchEvent(new CustomEvent('veniux:analytics-consent',{detail:{analytics_storage:effective()?'granted':'denied'}}));}
 function sync(){banner.hidden=Boolean(current);toggle.checked=effective();toggle.disabled=restricted;document.getElementById('cookie-gpc').hidden=!restricted;}
 function close(){dialog.close();if(opener?.isConnected&&!opener.closest('[hidden]'))opener.focus();}
 function commit(analytics){current=saveConsent(storage,analytics&&!restricted);sync();announce();status.textContent=effective()?'İstatistik tercihiniz kabul olarak kaydedildi.':'İsteğe bağlı istatistikler reddedildi.';if(dialog.open)close();document.querySelector('[data-cookie-open]')?.focus({preventScroll:true});}
 document.querySelectorAll('[data-cookie-open]').forEach(button=>button.addEventListener('click',()=>{opener=button;sync();dialog.showModal();}));
 document.querySelectorAll('[data-cookie-choice]').forEach(button=>button.addEventListener('click',()=>commit(button.dataset.cookieChoice==='accept')));
 dialog.querySelector('[data-cookie-save]').addEventListener('click',()=>commit(toggle.checked));
 dialog.querySelector('[data-cookie-close]').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 window.addEventListener('storage',event=>{if(event.key===CONSENT_KEY||event.key===null){current=readConsent(storage);sync();announce();}});
 window.addEventListener('pageshow',()=>{current=readConsent(storage);sync();});
 sync();announce();
}
