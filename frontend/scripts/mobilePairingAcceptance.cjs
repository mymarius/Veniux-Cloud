const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
class Storage{constructor(){this.values=new Map();}getItem(k){return this.values.get(k)||null;}setItem(k,v){this.values.set(k,String(v));}removeItem(k){this.values.delete(k);}}
(async()=>{let ticket='a'.repeat(64),requests=0;const local=new Storage(),session=new Storage();const fp='HW-'+'B'.repeat(32);
const api={defaults:{headers:{common:{}}},post:async()=>{requests++;return {data:{token:'fixture.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+600})).toString('base64url')+'.fixture',user:{id:7,email:'fixture@example.invalid'},license:{payload:{device_token:'c'.repeat(64),device_fingerprint:fp}},tenant_context:null}};}};
const context=vm.createContext({window:{veniuxMobile:{},VeniuxAndroid:{pairingTicket:()=>ticket}},localStorage:local,sessionStorage:session,Date,atob,JSON});
const source=fs.readFileSync(path.join(__dirname,'../src/lib/mobilePairing.js'),'utf8');const module=new vm.SourceTextModule(source,{context});
await module.link(async name=>{const stub=new vm.SyntheticModule(name.includes('browserDevice')?['browserDeviceInfo']:['default'],function(){if(name.includes('browserDevice'))this.setExport('browserDeviceInfo',()=>({fingerprint:fp}));else this.setExport('default',api);},{context});return stub;});await module.evaluate();
await module.namespace.mobilePairing();assert.equal(requests,1);assert.equal(api.defaults.headers.common['x-veniux-device-token'],'c'.repeat(64));assert.equal(api.defaults.headers.common['x-device-id'],fp);assert.equal(JSON.parse(local.getItem('user')).id,7);
api.defaults.headers.common={};await module.namespace.mobilePairing();assert.equal(requests,1);assert.equal(api.defaults.headers.common['x-device-id'],fp);
ticket='d'.repeat(64);await module.namespace.mobilePairing();assert.equal(requests,2);assert.equal(local.getItem('veniux_claimed_ticket'),ticket);
console.log('PASS: mobile identity bootstrap, licence headers before first protected request, cached restart without ticket replay, fresh QR claim.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
