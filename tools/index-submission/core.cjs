'use strict';
const crypto=require('node:crypto');
const ORIGIN='https://veniux.com';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function canonical(value){
 const u=new URL(value);
 if(u.origin!==ORIGIN||u.username||u.password||u.search||u.hash||!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(u.pathname)||/^\/(giris|kayit|indir|dosya|cikis|admin|hesap|account|dashboard|contact-token)(\/|$)/.test(u.pathname))throw Error('Unsafe/noncanonical public URL');
 return u.href;
}
function urlsFromXml(xml){
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>canonical(m[1]));
 if(!urls.length||urls.length>80||new Set(urls).size!==urls.length)throw Error('Invalid/duplicate/bounded sitemap URL list');
 return urls.sort();
}
function fingerprint(html){
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
 if(!main)throw Error('Missing server-rendered main');
 // Forms contain session-specific CSRF values; they are not editorial changes.
 return hash(main.replace(/<form\b[\s\S]*?<\/form>/gi,'').replace(/\bnonce="[^"]*"/gi,'').replace(/\s+/g,' ').trim());
}
function due(previous,digest,now=Date.now()){
 if(previous?.acceptedHash===digest)return false;
 return !(previous?.attemptHash===digest&&now-previous.attemptAt<86400000);
}
function changedPages(baseline,pages,ack={}){
 if(!baseline)return [];
 return pages.filter(p=>(ack[p.url]??baseline[p.url])!==p.hash).map(p=>p.url);
}
function inspectionRow(url,payload){
 const i=payload.inspectionResult?.indexStatusResult;
 if(!i)return {url,status:'UNKNOWN',reason:'Google response has no indexStatusResult'};
 const status=i.verdict==='PASS'?'INDEXED':i.coverageState==='URL is unknown to Google'?'UNKNOWN_TO_GOOGLE':i.verdict==='NEUTRAL'?'NOT_INDEXED':'UNRESOLVED';
 return {url,status,verdict:i.verdict||null,coverageState:i.coverageState||null,reason:i.coverageState||'Google did not provide a reason',indexingState:i.indexingState||null,robotsTxtState:i.robotsTxtState||null,pageFetchState:i.pageFetchState||null,lastCrawlTime:i.lastCrawlTime||null,userCanonical:i.userCanonical||null,googleCanonical:i.googleCanonical||null,referringUrls:i.referringUrls||[],sitemap:i.sitemap||[]};
}
function manualCandidates(rows){
 return rows.filter(r=>['NOT_INDEXED','UNKNOWN_TO_GOOGLE'].includes(r.status)).map(r=>{
  const mismatch=r.googleCanonical&&r.googleCanonical!==r.url;
  const blocked=[r.indexingState,r.robotsTxtState,r.pageFetchState].some(s=>s&&/BLOCKED|ERROR|DENIED|DISALLOWED|NOT_FOUND|SERVER_ERROR|REDIRECT_ERROR/.test(s));
  const route=new URL(r.url).pathname;
  const priority=['/','/stok-yonetimi','/depo-yonetimi','/barkodlu-stok-takibi','/program-indir'].includes(route)?1:/^\/(kullanim|gizlilik|kvkk|cerez)/.test(route)?3:2;
  return {url:r.url,priority,action:mismatch?'Resolve Google canonical mismatch before requesting indexing':blocked?'Resolve reported technical block before requesting indexing':'Review live URL in Search Console, then manually request indexing if eligible'};
 }).sort((a,b)=>a.priority-b.priority||a.url.localeCompare(b.url));
}
async function responseOk(fetcher,url,options={}){
 const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000),...options});
 if(!r.ok)throw Error('Remote HTTP '+r.status);return r;
}
async function submitSitemap(fetcher,token,property){
 if(!['sc-domain:veniux.com',ORIGIN+'/'].includes(property))throw Error('Unexpected Search Console property');
 return responseOk(fetcher,'https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property)+'/sitemaps/'+encodeURIComponent(ORIGIN+'/sitemap.xml'),{method:'PUT',headers:{Authorization:'Bearer '+token}});
}
async function ensureSitemap(fetcher,token,property,digest,previous={},persist=()=>{}){
 if(!['sc-domain:veniux.com',ORIGIN+'/'].includes(property))throw Error('Unexpected Search Console property');
 const endpoint='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property)+'/sitemaps/'+encodeURIComponent(ORIGIN+'/sitemap.xml');
 const r=await fetcher(endpoint,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(30000)});
 const checkedAt=new Date().toISOString();
 if(r.ok){
  const info=await r.json();if(info.path!==ORIGIN+'/sitemap.xml')throw Error('Unexpected sitemap API record');
  return {...previous,status:'ALREADY_PRESENT — NOT_RESUBMITTED',checkedAt,remote:{path:info.path,lastSubmitted:info.lastSubmitted||null,lastDownloaded:info.lastDownloaded||null,isPending:info.isPending??null,errors:info.errors??null,warnings:info.warnings??null}};
 }
 if(r.status!==404)throw Error('Sitemap lookup HTTP '+r.status);
 // An absence must be confirmed remotely; 401/403/429/5xx never trigger PUT.
 if(!due({...previous,acceptedHash:undefined},digest))return {...previous,status:'ABSENT — RETRY_BACKOFF',checkedAt,remote:null};
 const attempt={...previous,attemptHash:digest,attemptAt:Date.now(),status:'ATTEMPT_PENDING',checkedAt,remote:null};
 await persist(attempt);
 try{const submitted=await submitSitemap(fetcher,token,property);return {...attempt,acceptedHash:digest,status:'SUBMISSION_ACCEPTED HTTP '+submitted.status};}
 catch(e){return {...attempt,status:'FAILED '+e.message};}
}
async function inspect(fetcher,token,property,url){
 if(!['sc-domain:veniux.com',ORIGIN+'/'].includes(property))throw Error('Unexpected Search Console property');
 const r=await responseOk(fetcher,'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({inspectionUrl:canonical(url),siteUrl:property,languageCode:'en-US'})});
 return inspectionRow(url,await r.json());
}
async function indexNow(fetcher,key,urls){
 if(!/^[a-f0-9]{64}$/.test(key)||!urls.length||urls.length>80)throw Error('Invalid IndexNow batch');
 urls.forEach(canonical);
 const location=ORIGIN+'/'+key+'.txt';
 const proof=await responseOk(fetcher,location);
 if((await proof.text()).trim()!==key)throw Error('Public IndexNow key does not match');
 const r=await responseOk(fetcher,'https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host:'veniux.com',key,keyLocation:location,urlList:urls})});
 if(![200,202].includes(r.status))throw Error('Unexpected IndexNow HTTP '+r.status);
 return {http:r.status,status:r.status===202?'KEY_VALIDATION_PENDING':'NOTIFICATION_ACCEPTED',indexed:false};
}
module.exports={ORIGIN,hash,canonical,urlsFromXml,fingerprint,due,changedPages,inspectionRow,manualCandidates,responseOk,submitSitemap,ensureSitemap,inspect,indexNow};
