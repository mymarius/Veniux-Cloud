import {CONSENT_KEY,readConsent,saveConsent} from './consent-state.mjs';
const banner=document.getElementById('cookie-banner'),dialog=document.getElementById('cookie-preferences');
if(banner&&dialog){
 const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
 const toggle=dialog.querySelector('[name="analytics"]'),status=document.getElementById('cookie-status');
 const restricted=navigator.globalPrivacyControl===true;
 let current=readConsent(storage),opener=null;
 const effective=()=>Boolean(current?.analytics)&&!restricted;

 // Ölçüm yalnız onayla yüklenir. Kimlikler banner üzerindeki data-analytics alanından gelir; boş olan hizmet yüklenmez.
 const ids=(()=>{try{return JSON.parse(banner.dataset.analytics||'{}');}catch{return {};}})();
 let loaded=false;
 function loadAnalytics(){
  if(loaded)return;loaded=true;
  if(/^G-[A-Z0-9]{6,12}$/.test(ids.ga||'')){
   window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
   window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   window.gtag('js',new Date());window.gtag('config',ids.ga,{allow_google_signals:false,allow_ad_personalization_signals:false});
   const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(ids.ga);document.head.appendChild(script);
  }
  if(/^[a-z0-9]{8,12}$/.test(ids.clarity||'')){
   window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};
   const script=document.createElement('script');script.async=true;script.src='https://www.clarity.ms/tag/'+ids.clarity;document.head.appendChild(script);
  }
 }
 function revokeAnalytics(){if(!loaded)return;if(window.gtag)window.gtag('consent','update',{analytics_storage:'denied'});if(window.clarity)window.clarity('consent',false);}
 window.addEventListener('veniux:analytics-consent',event=>{if(event.detail?.analytics_storage==='granted')loadAnalytics();else revokeAnalytics();});
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
