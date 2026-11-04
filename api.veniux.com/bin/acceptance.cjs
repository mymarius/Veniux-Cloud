const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),data=fs.mkdtempSync(path.join(root,'.local/license-test-'));
const env={...process.env,LICENSE_ENV:'development',LICENSE_DATA_DIR:data,LICENSE_TEST_FIXTURE:'1'};
const php='C:/xampp/php/php.exe';
function cli(file,input){const r=spawnSync(php,[path.join(__dirname,file)],{env,input:JSON.stringify(input),encoding:'utf8'});assert.equal(r.status,0,'PHP command failed');return r.stdout;}
cli('setup.php',{email:'test@example.invalid',password:crypto.randomBytes(24).toString('hex')});
const issued=JSON.parse(cli('test-fixture.php',{action:'issue'}));
const servers=[39211,39212].map(port=>spawn(php,['-S',`127.0.0.1:${port}`,'-t',path.join(root,'api.veniux.com/public'),path.join(root,'api.veniux.com/public/router.php')],{env,stdio:'ignore'}));
const base='http://127.0.0.1:39211';
async function post(url,body){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
(async()=>{
try{
for(let i=0;i<40;i++){try{if((await fetch(base+'/health')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
const fp='HW-'+ 'A'.repeat(32),other='HW-'+'B'.repeat(32);
const results=await Promise.all([post(base+'/v1/activate',{license_key:issued.key,device_fingerprint:fp,device_name:'TEST-A'}),post('http://127.0.0.1:39212/v1/activate',{license_key:issued.key,device_fingerprint:other,device_name:'TEST-B'})]);
assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===403).length,1);
const winner=results[0].status===200?0:1,credential=results[winner].data.device_token,fingerprint=winner?other:fp;
process.env.VENIUX_LICENSE_AUTHORITY_URL=base+'/v1';process.env.VENIUX_LICENSE_ALLOW_LOCAL_HTTP='1';process.env.VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY=path.join(data,'signing-public.pem');
const central=require('../../backend/src/services/centralLicense');
assert.equal((await central.verify(credential,fingerprint)).valid,true);
assert.equal((await central.verify(credential,winner?fp:other)).valid,false);
cli('test-fixture.php',{action:'alias',id:issued.id,alias:'Merkez Kasa'});
assert.equal((await central.verify(credential,fingerprint)).terminal_name,'Merkez Kasa');
async function gate(){let status=200,called=false;await central.gate({path:'/stock',get:n=>n==='x-device-id'?fingerprint:credential},{status:n=>({json:()=>{status=n;}})},()=>{called=true;});return {status,called};}
assert.equal((await gate()).called,true);
cli('test-fixture.php',{action:'state',id:issued.id,state:'SUSPENDED'});assert.equal((await gate()).status,423);
cli('test-fixture.php',{action:'state',id:issued.id,state:'ACTIVE'});assert.equal((await gate()).called,true);
cli('test-fixture.php',{action:'state',id:issued.id,state:'REVOKED'});assert.equal((await gate()).status,423);
const retry=await post(base+'/v1/activate',{license_key:issued.key,device_fingerprint:fingerprint,device_name:'TEST'});assert.equal(retry.status,403);
servers.forEach(s=>s.kill());await new Promise(r=>setTimeout(r,150));assert.equal((await gate()).status,503);
console.log('PASS: concurrent seat limit (two PHP processes), signed verification, wrong hardware rejection, terminal alias, suspension, reactivation, revocation, revoked activation rejection, offline denial. Isolated SQLite only.');
}finally{servers.forEach(s=>s.kill());}
})().catch(()=>{console.error('FAIL: license acceptance test');process.exitCode=1;});
