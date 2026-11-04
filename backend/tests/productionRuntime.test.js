const fs=require('fs'),os=require('os'),path=require('path'),{spawn}=require('child_process'),net=require('net');
const service=require('../src/services/deploymentService');
const script=path.resolve(__dirname,'../scripts/startProduction.js');let root,child;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-runtime-'));});
afterEach(async()=>{if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}child=null;if(root.startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});});
async function launch(data){let output='';child=spawn(process.execPath,[script,'--data-dir',data],{env:{...process.env,NODE_ENV:'production',VENIUX_DISABLE_BACKGROUND_JOBS:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);return()=>output;}
async function port(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const value=server.address().port;await new Promise(r=>server.close(r));return value;}
test('managed production boot serves UI and non-secret database/migration health; authenticated stop waits for process exit',async()=>{
 const data=path.join(root,'data');await service.initialize(data,{email:'runtime@test.invalid',companyName:'Runtime',phone:'+905554443322',password:'RuntimeTest2026!'});const number=await port();const file=path.join(data,'install.env');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('PORT=3000','PORT='+number));const output=await launch(data);let response;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output());try{response=await fetch('http://127.0.0.1:'+number+'/health',{signal:AbortSignal.timeout(500)});if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}expect(response?.status).toBe(200);const body=await response.json();expect(body).toMatchObject({status:'ok',database:'sqlite',migrations:{status:'current',applied:expect.any(Number),expected:expect.any(Number)}});expect(body.migrations.applied).toBe(new (require('../src/database/migrator'))(null).catalog().length);expect(body.migrations.applied).toBe(body.migrations.expected);expect(JSON.stringify(body)).not.toMatch(/JWT|PRIVATE|secret|password|data-dir/i);expect((await fetch('http://127.0.0.1:'+number+'/')).status).toBe(200);expect((await fetch('http://127.0.0.1:'+number+'/api/local-runtime/shutdown',{method:'POST',headers:{'x-runtime-token':'invalid'}})).status).toBe(403);expect(()=>service.check(data)).not.toThrow();await expect(service.update(data)).rejects.toThrow('API çalışıyor');const running=JSON.parse(fs.readFileSync(path.join(data,'server.json'),'utf8'));const exited=new Promise(r=>child.once('exit',r));expect((await fetch('http://127.0.0.1:'+number+'/api/local-runtime/shutdown',{method:'POST',headers:{'x-runtime-token':running.token}})).status).toBe(200);await exited;expect(child.exitCode).toBe(0);expect(fs.existsSync(path.join(data,'server.json'))).toBe(false);expect(service.check(data).status).toBe('current');
},25000);
test('missing configuration exits without binding or creating users',async()=>{const data=path.join(root,'data');fs.mkdirSync(data);const output=await launch(data);await new Promise(r=>child.once('exit',r));expect(child.exitCode).toBe(1);expect(output()).toMatch('API başlatılamadı');expect(fs.existsSync(path.join(data,'stok_takip.db'))).toBe(false);},10000);

test('real isolated production server masks malformed credentials, rejects developer origin and exposes no private files',async()=>{
 const data=path.join(root,'data');await service.initialize(data,{email:'security@test.invalid',companyName:'Security',phone:'+905554443322',password:'SecurityRuntime2026!'});
 const number=await port(),file=path.join(data,'install.env');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('PORT=3000','PORT='+number));const output=await launch(data),base='http://127.0.0.1:'+number;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Isolated server stopped');try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const malformed=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"private-malformed-marker"'});
 expect(malformed.status).toBe(400);expect(await malformed.text()).not.toContain('private-malformed-marker');expect(output()).not.toContain('private-malformed-marker');
 const origin=await fetch(base+'/api/auth/me',{headers:{Origin:'http://localhost:5173'}});expect(origin.status).toBe(403);
 const panel=await fetch(base+'/');const policy=panel.headers.get('content-security-policy');
 expect(policy).toContain("object-src 'none'");expect(policy).toContain("script-src 'self'");expect(policy).toContain("script-src-attr 'none'");expect(policy).toContain("form-action 'self'");
 expect(policy).not.toMatch(/script-src[^;]*(unsafe-inline|unsafe-eval|https:|\*)/);
 expect((await fetch(base+'/api/backups')).status).toBe(401);
 for(const name of ['/api/.env','/api/updates/../install.env','/api/updates/private.pem']){
  const r=await fetch(base+name);expect(r.status).toBe(name==='/api/.env'?403:404);expect(await r.text()).not.toMatch(/BEGIN PRIVATE KEY|JWT_SECRET=/);
 }
},25000);

