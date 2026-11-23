import {connect} from './cdp.mjs';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const N=Number(process.argv[2]||60), SAMPLE=Number(process.argv[3]||20), OUT=process.argv[4]||'run.jsonl', SERVER_PID=Number(process.argv[5]||0);
const OFF_EVERY=Number(process.env.OFF_EVERY||100), OFF_LEN=Number(process.env.OFF_LEN||8), OFF_START=Number(process.env.OFF_START||50), CAT_EVERY=Number(process.env.CAT_EVERY||40);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const c=await connect();
await c.send('Runtime.enable');await c.send('Page.enable');await c.send('Network.enable',{maxTotalBufferSize:0,maxResourceBufferSize:0,maxPostDataSize:0});await c.send('Performance.enable');
const ver=await (await fetch('http://127.0.0.1:9444/json/version')).json();
const bws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>bws.onopen=r);
let bid=0;const bp=new Map();bws.onmessage=e=>{const m=JSON.parse(e.data);if(bp.has(m.id)){bp.get(m.id)(m.result);bp.delete(m.id);}};
const bsend=(method,params={})=>new Promise(r=>{const i=++bid;bp.set(i,r);bws.send(JSON.stringify({id:i,method,params}));});
// Yalnız ölçüm için (üretim koduna dokunmaz): >=10 dk'lık aralıkları 90'a böler (30 dk -> 20 sn), XHR sayacı ve bekleme yardımcıları.
const shim=`(()=>{if(window.__h)return;const si=window.setInterval.bind(window);window.setInterval=(f,ms,...a)=>si(f,ms>=600000?ms/90:ms,...a);
window.__xhr={catalog:0,all:0,fail:0};const op=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){this.__u=String(u);return op.apply(this,arguments)};const sd=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){window.__xhr.all++;if(this.__u.includes('/scanner/pro/catalog'))window.__xhr.catalog++;this.addEventListener('loadend',()=>{if(this.status===0)window.__xhr.fail++});return sd.apply(this,arguments)};
window.__h={t0:0,mark(){this.t0=performance.now()},waitFor(src,timeout=15000){return new Promise(res=>{const st=performance.now();const f=new Function('return ('+src+')')();const tick=()=>{let ok=false;try{ok=f()}catch{}if(ok)return res(performance.now()-this.t0);if(performance.now()-st>timeout)return res(-1);setTimeout(tick,0)};tick()})}};})();`;
await c.send('Page.addScriptToEvaluateOnNewDocument',{source:shim});
await c.send('Page.reload',{ignoreCache:true});await sleep(6000);
const closeDlg=async()=>{for(let k=0;k<3;k++){const open=await c.ev(`(()=>{const d=document.querySelector('[role=dialog]');if(!d)return false;const b=[...d.querySelectorAll('button')].find(b=>!b.innerText.trim())||[...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='Satışa dön');if(b)b.click();return true})()`);if(!open)return;await sleep(250);}};
const rows=()=>c.ev(`document.querySelectorAll('table tbody tr').length`);
const click=t=>c.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim().startsWith(${JSON.stringify(t)}));if(!b)return false;__h.mark();b.click();return true})()`);
const stat=()=>c.ev(`document.querySelector('.pos-status')?.innerText||''`);
async function scan(code,want){
 await c.ev(`(()=>{const i=document.querySelector('input[placeholder^="Barkod"]');i.focus();i.select();})()`);
 await c.send('Input.insertText',{text:code});
 await c.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Ekle');__h.mark();b.click();})()`);
 return c.ev(`__h.waitFor('()=>document.querySelectorAll("table tbody tr").length===${want}',8000)`);
}
async function pay(){
 await c.ev(`window.__prev=document.querySelector('.pos-status')?.innerText||''`);
 await c.ev(`(()=>{const b=document.querySelector('button.pos-pay')||[...document.querySelectorAll('button')].find(b=>b.innerText.trim().startsWith('Ödeme al'));__h.mark();b.click()})()`);
 const t1=await c.ev(`__h.waitFor('()=>!!document.querySelector("[role=dialog]")',5000)`);
 await c.ev(`(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.innerText.includes('Ödemeyi kaydet'));__h.mark();b.click()})()`);
 const ms=await c.ev(`__h.waitFor('()=>{const s=document.querySelector(".pos-status")?.innerText||"";return s!==window.__prev&&/Satış tamamlandı|Çevrimdışı satış kaydedildi/.test(s)}',15000)`);
 return {ms,dlg:t1};
}
async function procs(){
 let info=[];try{info=(await bsend('SystemInfo.getProcessInfo')).processInfo||[];}catch{}
 const ids=info.map(p=>p.id);if(SERVER_PID)ids.push(SERVER_PID);
 let ws={};try{const j=JSON.parse(execFileSync('powershell',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`],{encoding:'utf8'}));for(const p of [].concat(j))ws[p.Id]=[p.WorkingSet64,p.PrivateMemorySize64];}catch{}
 const out={};for(const p of info)out[p.type+':'+p.id]={ws:ws[p.id]?.[0],priv:ws[p.id]?.[1],cpu:p.cpuTime};
 if(SERVER_PID)out.server={ws:ws[SERVER_PID]?.[0],priv:ws[SERVER_PID]?.[1]};return out;
}
async function sample(n,lat){
 const pre=await c.send('Runtime.getHeapUsage');
 await c.send('HeapProfiler.collectGarbage');await sleep(300);
 const post=await c.send('Runtime.getHeapUsage');
 const dom=await c.send('Memory.getDOMCounters');
 const pm=Object.fromEntries((await c.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const extra=JSON.parse(await c.ev(`(async()=>{const e=await navigator.storage.estimate();let dbs=[];try{dbs=(await indexedDB.databases()).map(d=>d.name)}catch{}return JSON.stringify({idb_usage:e.usage,ls:Object.entries(localStorage).reduce((a,[k,v])=>a+k.length+v.length,0),ss:Object.entries(sessionStorage).reduce((a,[k,v])=>a+k.length+v.length,0),xhr:window.__xhr,online:navigator.onLine,rows:document.querySelectorAll('table tbody tr').length,domAll:document.getElementsByTagName('*').length,dbs})})()`));
 const fps=await c.ev(`new Promise(r=>{let n=0;const t=performance.now();const f=()=>{n++;if(performance.now()-t<500)requestAnimationFrame(f);else r(n*2)};requestAnimationFrame(f);setTimeout(()=>r(n*2),1200)})`);
 const rec={fps,vis:await c.ev('document.visibilityState'),n,t:Date.now(),heapPre:pre.usedSize,heapPost:post.usedSize,heapTotal:post.totalSize,docs:dom.documents,nodes:dom.nodes,listeners:dom.jsEventListeners,pm:{JSHeapUsedSize:pm.JSHeapUsedSize,Nodes:pm.Nodes,JSEventListeners:pm.JSEventListeners,LayoutCount:pm.LayoutCount,RecalcStyleCount:pm.RecalcStyleCount,ScriptDuration:pm.ScriptDuration,TaskDuration:pm.TaskDuration},extra,proc:await procs(),lat};
 fs.appendFileSync(OUT,JSON.stringify({kind:'sample',...rec})+'\n');
 console.log(`n=${n} heapPost=${(post.usedSize/1e6).toFixed(1)}MB heapPre=${(pre.usedSize/1e6).toFixed(1)}MB nodes=${dom.nodes} listeners=${dom.jsEventListeners} fps=${fps} scanMed=${lat.scan} payMed=${lat.pay} catalogReq=${extra.xhr.catalog} fails=${lat.fails}`);
}
const med=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return +s[Math.floor(s.length/2)].toFixed(1)};
const rnd=()=>String(8690000000000+1+Math.floor(Math.random()*50000));
fs.writeFileSync(OUT,'');
let win={scan:[],pay:[]};
await sample(0,{scan:null,pay:null});
if(process.env.MODE==='catalog'){
 // N dakika boyunca arka arkaya yenileme: anahtar her 5 sn'de eskitilir, uygulamanın kendi 20 sn'lik (hızlandırılmış) denetimi indirmeyi başlatır; kilit çakışmayı önler.
 const T0=Date.now();let k=0;
 while(Date.now()-T0<N*60000){await c.ev(`localStorage.setItem('veniux:offline-catalog-at-v2','1')`);await sleep(5000);if((Date.now()-T0)>(k+1)*SAMPLE*1000){k++;await sample(k,{scan:null,pay:null,minute:+((Date.now()-T0)/60000).toFixed(1)});}}
 await sample(k+1,{scan:null,pay:null,final:true});console.log('bitti catalog');process.exit(0);
}
let offline=false,fails=0;
const EV=`(()=>{const b=document.activeElement;return 1})()`;
for(let i=1;i<=N;i++){try{
 await closeDlg();
 const shouldOff=i>=OFF_START&&((i-OFF_START)%OFF_EVERY)<OFF_LEN;
 if(shouldOff!==offline){offline=shouldOff;await c.send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:-1,uploadThroughput:-1});await sleep(offline?1500:3000);}
 if(i%CAT_EVERY===0)await c.ev(`localStorage.setItem('veniux:offline-catalog-at-v2','1')`);
 if(i%15===0){await c.ev(`(()=>{const s=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.text==='Peşin müşteri'));if(!s)return 0;const o=[...s.options];const v=o[1+(Math.floor(Math.random()*(o.length-1)))].value;const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;set.call(s,i%30===0?'':v);s.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`);await sleep(100);}
 if(i%10===0){const r=await scan(rnd(),1);if(r<0)fails++;await click('Beklet');await c.ev(`__h.waitFor('()=>document.querySelectorAll("table tbody tr").length===0',3000)`);await sleep(150);}
 if(i%20===0){await click('Bekleyen');await sleep(200);await c.ev(`(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.innerText.trim().startsWith('Sepet'));if(b)b.click();})()`);await sleep(300);await closeDlg();}
 if(i%30===0){await click('Bekleyen');await sleep(200);await c.ev(`(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.innerText.trim()==='Sil');if(b)b.click();})()`);await sleep(200);await closeDlg();await sleep(150);}
 const start=await rows();
 const k=1+(i%3);
 for(let j=0;j<k;j++){const ms=await scan(rnd(),start+j+1);if(ms<0){fails++;console.log('scan -1 i='+i+' j='+j+' want='+(start+j+1)+' '+await c.ev(`JSON.stringify({r:document.querySelectorAll('table tbody tr').length,st:document.querySelector('.pos-status')?.innerText.slice(0,120),v:document.querySelector('input[placeholder^="Barkod"]')?.value,dlg:!!document.querySelector('[role=dialog]')})`));}else win.scan.push(ms);fs.appendFileSync(OUT,JSON.stringify({kind:'scan',i,ms,offline})+'\n');}
 if(await rows()===0){fails++;continue;}
 const p=await pay();if(p.ms<0){fails++;}else win.pay.push(p.ms);
 fs.appendFileSync(OUT,JSON.stringify({kind:'pay',i,ms:p.ms,dlg:p.dlg,offline})+'\n');
 await c.ev(`__h.mark();__h.waitFor('()=>document.querySelectorAll("table tbody tr").length===0',4000)`).then(ms=>fs.appendFileSync(OUT,JSON.stringify({kind:'clear',i,ms})+String.fromCharCode(10)));
 await sleep(500);
 if(i%SAMPLE===0){await sample(i,{scan:med(win.scan),pay:med(win.pay),fails});win={scan:[],pay:[]};}
}catch(e){console.log('HATA i='+i,String(e.message).slice(0,200),await c.ev(`JSON.stringify({rows:document.querySelectorAll('table tbody tr').length,dlg:document.querySelector('[role=dialog]')?.innerText.slice(0,200),st:document.querySelector('.pos-status')?.innerText})`).catch(x=>'ev yok'));fails++;await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});}
}
if(offline){await c.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await sleep(4000);}
await sample(N,{scan:med(win.scan),pay:med(win.pay),fails,final:true});
console.log('bitti fails=',fails);
process.exit(0);
