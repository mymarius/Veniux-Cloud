export const CONSENT_KEY='veniux-cookie-preferences-v2';
export const CONSENT_TTL=180*24*60*60*1000;
export function readConsent(storage,now=Date.now()){
 try{
  const v=JSON.parse(storage?.getItem(CONSENT_KEY)||'null');
  if(v?.version!==2||typeof v.analytics!=='boolean'||!Number.isSafeInteger(v.savedAt)||v.savedAt>now||now-v.savedAt>=CONSENT_TTL)return null;
  return v;
 }catch{return null;}
}
export function saveConsent(storage,analytics,now=Date.now()){
 const value={version:2,analytics:analytics===true,savedAt:now};
 try{storage?.setItem(CONSENT_KEY,JSON.stringify(value));}catch{}
 try{storage?.removeItem('veniux-analytics-consent-v1');if(!value.analytics)storage?.removeItem('veniux-conversions-v1');}catch{}
 return value;
}
