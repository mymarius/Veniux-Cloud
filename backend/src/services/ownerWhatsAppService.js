const path=require('path');
const {Client,LocalAuth}=require('whatsapp-web.js');
const QRCode=require('qrcode');
const db=require('../config/database');
const {normalizePhone}=require('./ownerPhone');
const sessions=new Map();
const dataPath=path.join(require('../config/runtimeConfig').paths().storage,'whatsapp-sessions');
function browserPath(){
 const fs=require('fs');return [process.env.WHATSAPP_BROWSER_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(p=>fs.existsSync(p));
}
function status(tenant){
 const session=sessions.get(tenant);
 return {status:session?.status||'disconnected',qr:session?.qr&&session.qrExpires>Date.now()?session.qr:null,qrExpires:session?.qrExpires||null};
}
function connect(tenant){
 if(!Number.isSafeInteger(tenant)||tenant<=0)throw new Error('İşletme gerekli.');
 if(sessions.has(tenant))return status(tenant);
 const client=new Client({authStrategy:new LocalAuth({clientId:`tenant-${tenant}`,dataPath}),puppeteer:{headless:true,executablePath:browserPath()},qrMaxRetries:8,authTimeoutMs:60000});
 const session={client,status:'connecting',qr:null,qrExpires:0,startedAt:Date.now(),recovering:false};sessions.set(tenant,session);
 const stopWatch=()=>clearInterval(session.watch);
 session.watch=setInterval(async()=>{
  if(!['connecting','authenticating'].includes(session.status)||session.recovering)return;
  if(Date.now()-session.startedAt>120000){session.status='error';session.qr=null;stopWatch();return;}
  if(session.status!=='authenticating'||!client.pupPage)return;
  session.recovering=true;
  try{
   // A missed/rejected Web sync callback must not leave a paired phone waiting forever.
   await client.pupPage.evaluate(async()=>{
    const socket=window.require('WAWebSocketModel').Socket;
    if(socket.state==='CONNECTED'&&socket.hasSynced&&typeof window.onAppStateHasSyncedEvent==='function')await window.onAppStateHasSyncedEvent();
   });
  }catch{/* Retry transient Web initialization errors within the bounded window. */}
  finally{session.recovering=false;}
 },10000);
 session.watch.unref?.();
 client.on('qr',async qr=>{
  const version=Date.now();session.qrExpires=version+60000;session.status='awaiting_qr';
  let image;try{image=await QRCode.toDataURL(qr,{width:280,margin:2});}catch{session.status='error';return;}
  if(sessions.get(tenant)===session&&session.qrExpires===version+60000)session.qr=image;
 });
 client.on('authenticated',()=>{if(session.status!=='authenticating')session.startedAt=Date.now();session.status='authenticating';session.qr=null;});
 client.on('ready',()=>{session.status='connected';session.qr=null;stopWatch();});
 client.on('auth_failure',()=>{session.status='error';session.qr=null;stopWatch();});
 client.on('disconnected',()=>{session.status='disconnected';session.qr=null;stopWatch();});
 client.initialize().catch(()=>{session.status='error';session.qr=null;stopWatch();});
 return status(tenant);
}
async function disconnect(tenant){
 const session=sessions.get(tenant);if(!session)return;
 clearInterval(session.watch);
 try{if(session.status==='connected')await session.client.logout();}finally{await session.client.destroy().catch(()=>{});sessions.delete(tenant);}
}
async function send(tenant,message){
 const company=(await db.query('SELECT owner_phone FROM tenants WHERE id=$1',[tenant])).rows[0];
 const phone=normalizePhone(company?.owner_phone);if(!phone)return {status:'invalid_phone'};
 // Restore only an existing linked session; never create unsolicited QR sessions during a job.
 if(!sessions.has(tenant)){
  const fs=require('fs');if(!fs.existsSync(path.join(dataPath,`session-tenant-${tenant}`)))return {status:'not_connected'};
  connect(tenant);
 }
 const session=sessions.get(tenant);
 for(let attempt=0;attempt<100&&['connecting','authenticating'].includes(session.status);attempt++)await new Promise(resolve=>setTimeout(resolve,300));
 if(session.status!=='connected')return {status:'not_connected'};
 let timer;
 try{
  const task=(async()=>{
   const number=await session.client.getNumberId(phone.slice(1));if(!number)return {status:'not_registered'};
   const sent=await session.client.sendMessage(number._serialized,String(message).slice(0,3000));
   if(!sent?.id?._serialized)return {status:'unknown'};
   // WhatsApp serialized IDs contain the recipient number; expose only an app reference.
   return {status:'accepted',message_id:'wa-'+require('node:crypto').randomUUID()};
  })();
  return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'unknown'}),30000);})]);
 }catch{return {status:'unknown'};}finally{clearTimeout(timer);}
}
async function shutdown(){await Promise.allSettled([...sessions.values()].map(s=>{clearInterval(s.watch);return s.client.destroy();}));sessions.clear();}
module.exports={connect,disconnect,status,send,shutdown};
