// Deneme lisansı ucu kabul testi: geçici yerel lisans merkezi, gerçek PHP sunucusu.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),data=fs.mkdtempSync(path.join(root,'.local/license-trial-test-'));
const env={...process.env,LICENSE_ENV:'development',LICENSE_DATA_DIR:data};
const php='C:/xampp/php/php.exe';
assert.equal(spawnSync(php,[path.join(__dirname,'setup.php')],{env,input:JSON.stringify({email:'test@example.invalid',password:crypto.randomBytes(24).toString('hex')}),encoding:'utf8'}).status,0);
const server=spawn(php,['-S','127.0.0.1:39213','-t',path.join(root,'api.veniux.com/public'),path.join(root,'api.veniux.com/public/router.php')],{env,stdio:'ignore'});
const base='http://127.0.0.1:39213';
const post=async(p,body)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json().catch(()=>null)};};
(async()=>{try{
 for(let i=0;i<40;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const key=crypto.randomBytes(32).toString('hex');
 assert.equal((await post('/v1/trial',{service_key:key,company:'X'})).status,404,'anahtar dosyası yokken kapalı olmalı');
 fs.writeFileSync(path.join(data,'trial-service.sha256'),crypto.createHash('sha256').update(key).digest('hex'));
 assert.equal((await post('/v1/trial',{service_key:'y'.repeat(64),company:'X'})).status,403,'yanlış anahtar reddedilmeli');
 const first=await post('/v1/trial',{service_key:key,company:'Örnek Market'});
 assert.equal(first.status,200);assert.equal(first.data.ok,true);assert.match(first.data.license_key,/^VNX-[A-F0-9]{48}$/);assert.equal(first.data.seats,2);
 const act=await post('/v1/activate',{license_key:first.data.license_key,device_fingerprint:'HW-'+'C'.repeat(32),device_name:'DENEME'});
 assert.equal(act.status,200,'deneme anahtarı etkinleşmeli');
 for(let i=1;i<20;i++)assert.equal((await post('/v1/trial',{service_key:key,company:'M'+i})).data.ok,true);
 const over=await post('/v1/trial',{service_key:key,company:'Fazla'});
 assert.deepEqual(over.data,{ok:false,code:'DAILY_QUOTA'});
 console.log('DENEME LİSANSI KABUL TESTİ GEÇTİ');
}catch(e){console.error(e);process.exitCode=1;}finally{server.kill();setTimeout(()=>fs.rmSync(data,{recursive:true,force:true}),500);}})();
