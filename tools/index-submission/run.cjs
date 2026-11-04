'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const c=require('./core.cjs'),{authorize}=require('./oauth.cjs');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'.local/index-submission'),stateFile=path.join(dir,'state.json');
fs.mkdirSync(dir,{recursive:true});
const read=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
function save(file,value){const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}
function xmlValidate(xml){
 execFileSync(process.env.VENIUX_PHP||'C:/xampp/php/php.exe',['-r',"$d=new DOMDocument();libxml_use_internal_errors(true);$s=stream_get_contents(STDIN);if(!$d->loadXML($s,LIBXML_NONET)||$d->documentElement->namespaceURI!=='http://www.sitemaps.org/schemas/sitemap/0.9')exit(1);"],{input:xml,stdio:['pipe','pipe','pipe']});
 return c.urlsFromXml(xml);
}
async function prepare(state){
 const php="$_SERVER['REQUEST_URI']='/sitemap.xml';$_SERVER['REQUEST_METHOD']='GET';$_SERVER['REMOTE_ADDR']='127.0.0.1';require 'website-php/index.php';";
 const xml=execFileSync(process.env.VENIUX_PHP||'C:/xampp/php/php.exe',['-r',php],{cwd:root,encoding:'utf8',env:{...process.env,VENIUX_CONTACT_NOTIFY:'0',VENIUX_CONTACT_MAIL_ENABLED:'0',VENIUX_SITE_URL:c.ORIGIN,VENIUX_SITE_INDEXABLE:'1',VENIUX_CONTACT_STORAGE:path.join(dir,'private/contact')}});
 const local=xmlValidate(xml),liveXml=await (await c.responseOk(fetch,c.ORIGIN+'/sitemap.xml')).text(),live=xmlValidate(liveXml);
 fs.writeFileSync(path.join(dir,'sitemap-local.xml'),xml);fs.writeFileSync(path.join(dir,'sitemap-live.xml'),liveXml);
 const pages=[];
 for(const url of live){
  const r=await c.responseOk(fetch,url),html=await r.text();
  if(r.status!==200||/noindex/i.test(r.headers.get('x-robots-tag')||'')||!html.includes('rel="canonical" href="'+url+'"')||/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html))throw Error('Page no longer eligible: '+url);
  pages.push({url,hash:c.fingerprint(html)});
 }
 const snapshot={at:new Date().toISOString(),urls:live,localUrls:local,matches:JSON.stringify(local)===JSON.stringify(live),sitemapHash:c.hash(liveXml),localSitemapHash:c.hash(xml),pages};
 snapshot.changed=c.changedPages(state.baseline,pages,state.indexnow?.ack);
 save(path.join(dir,'snapshot.json'),snapshot);return snapshot;
}
function report(state,snapshot){
 const file=path.join(root,'docs/audits/VENIUX_INDEX_SUBMISSION_REPORT.md');
 const rows=snapshot.urls.map(url=>{
  const row=state.inspections?.[url];
  const current=row?.at?row.status:'UNKNOWN';
  const reason=(row?.reason||'Search Console hesabı/yetkisi yok; sorgulanmadı').replaceAll('|','/').replace(/[\r\n]/g,' ');
  return `| ${url} | ${current} | ${reason} | ${row?.at||'—'} |`;
 });
 const generated=`<!-- submission-results:start -->\nSon hazırlık: ${snapshot.at}. Kaynak: canlı sitemap ve canonical HTML; Google indeks verisi yalnız API yanıtı varsa gösterilir.\n\nYerel/canlı URL kümesi: ${snapshot.matches?'AYNI':'FARKLI — gönderim engellenir'}. Yerel XML/live XML SHA-256: \`${snapshot.localSitemapHash}\` / \`${snapshot.sitemapHash}\`.\n\nGoogle sitemap son denemesi: ${state.google?.status||'BLOCKED: yetki yok, gönderilmedi'}. HTTP kabulü indeks başarısı değildir.\n\nIndexNow: ${state.indexnow?.status||'NOT SENT: sahiplik dosyası yayımlanmadı'}. Baseline: ${state.baseline?'mevcut':'yok; ilk görüntü değişiklik sayılmaz'}. Bildirilmeyi bekleyen değişen canonical URL: ${snapshot.changed.length}. Google indekslemesini doğrudan tetiklemez.\n\n| URL | Google indeks durumu | Neden / API kapsam durumu | Sorgu zamanı (UTC) |\n|---|---|---|---|\n${rows.join('\n')}\n\nUNKNOWN sonuçları indekslenmedi veya beklemede olarak sayılmadı. Google'ın bilip bilmediği de erişim olmadan belirlenemez.\n<!-- submission-results:end -->`;
 const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'# Veniux indeksleme gönderim raporu\n\n';
 const candidates=c.manualCandidates(snapshot.urls.map(url=>state.inspections?.[url]).filter(Boolean));
 const extras='\n\nMülk erişim kontrolü: '+(state.property?`${state.property.property}; ${state.property.permissionLevel}; ${state.property.checkedAt}`:'YAPILMADI — OAuth istemcisi/yetkisi bekleniyor')+'. Bu kontrol yeni DNS sahipliği doğrulaması oluşturmaz.\n\nGoogle sitemap kaydı: '+(state.google?.remote?JSON.stringify(state.google.remote):'SORGULANMADI veya kayıt alınamadı; yokluğu varsayılmaz')+'.\n\nManuel indeksleme adayları (yalnız gerçek API sonuçlarına göre):\n'+(candidates.length?candidates.map(r=>`- P${r.priority}: ${r.url} — ${r.action}`).join('\n'):'Gerçek indeks verisi olmadan aday listesi çıkarılmadı; bilinmeyen URL’ler indekslenmedi sayılmadı.');
 const complete=generated.replace('<!-- submission-results:end -->',extras+'\n<!-- submission-results:end -->');
 fs.writeFileSync(file,old.includes('<!-- submission-results:start -->')?old.replace(/<!-- submission-results:start -->[\s\S]*?<!-- submission-results:end -->/,()=>complete):old+'\n'+complete+'\n');
}
async function main(){
 const command=process.argv[2]||'prepare';
 if(!['prepare','report','baseline','init-indexnow','google','indexnow'].includes(command))throw Error('Commands: prepare | report | baseline | init-indexnow | google --authorize | indexnow');
 const lock=path.join(dir,'run.lock');let fd;
 try{
  fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,String(process.pid));
  const state=read(stateFile,{}),snapshot=['init-indexnow','report'].includes(command)?read(path.join(dir,'snapshot.json'),null):await prepare(state);
  if(!snapshot)throw Error('Run prepare before initializing IndexNow');
  if(command==='baseline'){
   if(state.baseline)throw Error('Baseline already exists; it must not be silently reset');
   state.baseline=Object.fromEntries(snapshot.pages.map(p=>[p.url,p.hash]));save(stateFile,state);
  }
  if(command==='init-indexnow'){
   const keyFile=path.join(dir,'indexnow-key.json');let key=read(keyFile,null)?.key;
   if(!key){key=crypto.randomBytes(32).toString('hex');save(keyFile,{key});}
   const pub=path.join(dir,'indexnow-public');fs.mkdirSync(pub,{recursive:true});fs.writeFileSync(path.join(pub,key+'.txt'),key);
   console.log('Key proof prepared locally. Owner deployment approval required; see .local/index-submission/indexnow-public.');
  }
  if(command==='google'){
   if(!process.argv.includes('--authorize'))throw Error('Owner permission and --authorize required');
   if(!snapshot.matches)throw Error('Local/live sitemap URL mismatch; stop before submission');
   const property=process.env.VENIUX_GSC_PROPERTY||'sc-domain:veniux.com';
   if(!['sc-domain:veniux.com',c.ORIGIN+'/'].includes(property))throw Error('Invalid property');
   const targets=snapshot.urls.filter(url=>!state.inspections?.[url]?.at||Date.now()-Date.parse(state.inspections[url].at)>=86400000);
   {
    const token=await authorize(process.env.VENIUX_GOOGLE_OAUTH_FILE);
    const site=await c.responseOk(fetch,'https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property),{headers:{Authorization:'Bearer '+token}});
    const access=await site.json();if(!['siteOwner','siteFullUser'].includes(access.permissionLevel))throw Error('Property owner/full-user access required');
    state.property={property,permissionLevel:access.permissionLevel,checkedAt:new Date().toISOString()};save(stateFile,state);
    try{state.google=await c.ensureSitemap(fetch,token,property,snapshot.sitemapHash,state.google,attempt=>{state.google=attempt;save(stateFile,state);});}
    catch(e){state.google={...state.google,status:'FAILED '+e.message,checkedAt:new Date().toISOString()};}
    save(stateFile,state);
    state.inspections||={};
    for(const url of targets){
     const at=new Date().toISOString();
     try{state.inspections[url]={...await c.inspect(fetch,token,property,url),at};}
     catch(e){state.inspections[url]={url,status:'UNKNOWN',reason:'API query failed: '+e.message,at};}
     save(stateFile,state);
    }
   }
  }
  if(command==='indexnow'){
   if(!snapshot.matches||!state.baseline)throw Error('Matching sitemap and an explicit initial baseline required');
   const key=read(path.join(dir,'indexnow-key.json'),null)?.key;
   const hashes=Object.fromEntries(snapshot.pages.filter(p=>snapshot.changed.includes(p.url)).map(p=>[p.url,p.hash]));
   const digest=c.hash(JSON.stringify(hashes));
   if(snapshot.changed.length&&c.due(state.indexnow,digest)){
    state.indexnow={...state.indexnow,attemptHash:digest,attemptAt:Date.now(),status:'ATTEMPT_PENDING'};save(stateFile,state);
    try{
     const result=await c.indexNow(fetch,key,snapshot.changed);
     state.indexnow={...state.indexnow,status:result.status+' HTTP '+result.http,acceptedHash:digest};
     // 202 is pending key validation. Do not acknowledge until a later 200.
     if(result.http===200)state.indexnow.ack={...state.indexnow.ack,...hashes};
     else delete state.indexnow.acceptedHash;
    }catch(e){state.indexnow.status='FAILED '+e.message;}
    save(stateFile,state);
   }
  }
  report(state,snapshot);
  if(command==='google'&&(state.google?.status?.startsWith('FAILED')||Object.values(state.inspections||{}).some(r=>r.reason?.startsWith('API query failed')))||command==='indexnow'&&state.indexnow?.status?.startsWith('FAILED'))process.exitCode=1;
  console.log(JSON.stringify({command,urls:snapshot.urls.length,urlSetsMatch:snapshot.matches,changed:snapshot.changed.length,google:state.google?.status||'NOT_AUTHORIZED',indexnow:state.indexnow?.status||'NOT_SENT'},null,2));
 }finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}
}
main().catch(()=>{console.error('Submission command failed safely. Check configuration, property permissions, network, XML and lock. Credentials and remote response bodies are intentionally not logged.');process.exitCode=1;});
