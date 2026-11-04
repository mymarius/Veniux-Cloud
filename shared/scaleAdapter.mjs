import {scaleReading} from './retailPro.mjs';
// Serial and TCP transports are injected by a trusted device integration, never
// by a browser-provided IP/port. No vendor protocol is guessed here.
export class ScaleAdapter{
 constructor({transport,decode,profile,clock=Date.now,timeoutMs=2000}){
  if(!transport||typeof transport.read!=='function'||typeof decode!=='function'||!profile||!['serial','tcp'].includes(profile.connection))throw Error('Terazi protokolü ve güvenilir taşıma adaptörü gerekli.');
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)throw Error('Geçersiz terazi zaman aşımı.');
  Object.assign(this,{transport,decode,profile,clock,timeoutMs});
 }
 async read(){
  const controller=new AbortController();let timer;
  try{const raw=await Promise.race([this.transport.read({signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Terazi yanıt vermedi.'));},this.timeoutMs);})]);return scaleReading(this.decode(raw),{now:this.clock(),maxAgeMs:this.timeoutMs});}
  finally{clearTimeout(timer);controller.abort();}
 }
 async close(){await this.transport.close?.();}
}
