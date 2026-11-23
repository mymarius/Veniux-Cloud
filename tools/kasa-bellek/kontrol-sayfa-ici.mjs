// Kontrol: satış döngüsü sayfanın İÇİNDE çalışır (satış başına CDP çağrısı yok); yalnız her 100 satışta örnek alınır.
// Amaç: harness'in kendi (CDP/DevTools) yükünün renderer özel belleğini şişirip şişirmediğini ayırmak.
import {connect} from './cdp.mjs';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const N=Number(process.argv[2]||500), OUT=process.argv[3]||'control.jsonl', SERVER_PID=Number(process.argv[4]||0);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const c=await connect();
await c.send('Runtime.enable');await c.send('Page.enable');await c.send('Performance.enable');
const ver=await (await fetch('http://127.0.0.1:9444/json/version')).json();
const bws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>bws.onopen=r);
let bid=0;const bp=new Map();bws.onmessage=e=>{const m=JSON.parse(e.data);if(bp.has(m.id)){bp.get(m.id)(m.result);bp.delete(m.id);}};
const bsend=(method,params={})=>new Promise(r=>{const i=++bid;bp.set(i,r);bws.send(JSON.stringify({id:i,method,params}));});
await c.send('Page.reload',{ignoreCache:true});await sleep(6000);
async function sample(n){
 const info=(await bsend('SystemInfo.getProcessInfo')).processInfo||[];const ids=info.map(p=>p.id);if(SERVER_PID)ids.push(SERVER_PID);
 const j=JSON.parse(execFileSync('powershell',['-NoProfile','-Command',`Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,PrivateMemorySize64 | ConvertTo-Json -Compress`],{encoding:'utf8'}));
 const priv={};for(const p of [].concat(j))priv[p.Id]=p.PrivateMemorySize64;
 const rend=info.filter(p=>p.type==='renderer').map(p=>priv[p.id]).sort((a,b)=>b-a)[0];
 await c.send('HeapProfiler.collectGarbage');const h=await c.send('Runtime.getHeapUsage');const d=await c.send('Memory.getDOMCounters');
 const rec={n,heap:h.usedSize,nodes:d.nodes,listeners:d.jsEventListeners,rendererPriv:rend,serverPriv:priv[SERVER_PID]};
 fs.appendFileSync(OUT,JSON.stringify(rec)+'\n');console.log(JSON.stringify(rec));
}
fs.writeFileSync(OUT,'');
const loop=`window.__ctl={done:0,fail:0,ms:[],stop:false};(async()=>{
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async(f,t)=>{const s=performance.now();while(performance.now()-s<t){if(f())return performance.now()-s;await sleep(2);}return -1;};
 const rows=()=>document.querySelectorAll('table tbody tr').length;
 const setv=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));};
 const btn=t=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim().startsWith(t));
 while(!window.__ctl.stop){
  const k=1+(window.__ctl.done%3);
  for(let j=0;j<k;j++){
   const i=document.querySelector('input[placeholder^="Barkod"]');i.focus();setv(i,String(8690000000001+Math.floor(Math.random()*50000)));await sleep(20);
   const want=rows()+1;btn('Ekle').click();const r=await until(()=>rows()===want,3000);if(r<0){window.__ctl.fail++;await sleep(300);}
  }
  if(rows()===0){await sleep(300);continue;}
  await sleep(250);
  window.__ctl.prev=document.querySelector('.pos-status')?.innerText||'';
  (document.querySelector('button.pos-pay')||btn('Ödeme al')).click();
  await until(()=>!!document.querySelector('[role=dialog]'),3000);
  const ok=[...document.querySelectorAll('[role=dialog] button')].find(b=>b.innerText.includes('Ödemeyi kaydet'));
  if(!ok){window.__ctl.fail++;const d=document.querySelector('[role=dialog] button');if(d)d.click();await sleep(500);continue;}
  const t0=performance.now();ok.click();
  const r=await until(()=>{const s=document.querySelector('.pos-status')?.innerText||'';return s!==window.__ctl.prev&&/Satış tamamlandı|Çevrimdışı satış kaydedildi/.test(s)},15000);
  if(r<0)window.__ctl.fail++;else window.__ctl.ms.push(performance.now()-t0);
  await until(()=>rows()===0,4000);await sleep(500);
  window.__ctl.done++;
 }})();1`;
await sample(0);
await c.ev(loop);
let next=100;
for(;;){await sleep(5000);const s=JSON.parse(await c.ev(`JSON.stringify({d:window.__ctl.done,f:window.__ctl.fail})`));
 if(s.d>=next){await sample(s.d);next+=100;}
 if(s.d>=N){await c.ev(`window.__ctl.stop=true`);break;}}
await sleep(1500);await sample(N);
console.log(await c.ev(`JSON.stringify({done:__ctl.done,fail:__ctl.fail,payMed:[...__ctl.ms].sort((a,b)=>a-b)[Math.floor(__ctl.ms.length/2)]})`));
console.log('bitti');process.exit(0);
