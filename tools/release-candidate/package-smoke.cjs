const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'.local/release-candidate-1'),resources=path.join(base,'windows-unsigned/win-unpacked/resources');
const data=fs.mkdtempSync(path.join(base,'package-smoke-')),keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
fs.writeFileSync(path.join(data,'private.pem'),keys.privateKey);fs.writeFileSync(path.join(data,'public.pem'),keys.publicKey);
const env={...process.env,NODE_ENV:'test',VENIUX_HARDWARE_LAB:'1',VENIUX_DATA_DIR:data,TEST_SQLITE_PATH:path.join(data,'test.sqlite'),DB_ENGINE:'sqlite',VENIUX_MYSQL_TEST:'0',VENIUX_CLOUD_SERVICE:'0',VENIUX_DISABLE_BACKGROUND_JOBS:'1',LICENSE_PRIVATE_KEY_PATH:path.join(data,'private.pem'),LICENSE_PUBLIC_KEY_PATH:path.join(data,'public.pem'),JWT_SECRET:crypto.randomBytes(48).toString('hex'),VENIUX_RC_RESOURCES:resources};
for(const k of Object.keys(env))if(/^(DB_(HOST|PORT|NAME|USER|PASSWORD)|VENIUX_LICENSE_AUTHORITY_|SMTP_|NVIDIA_|GEMINI_|OPENAI_|ANTHROPIC_)/.test(k))delete env[k];
async function smoke(){
 const path=require('node:path'),assert=require('node:assert/strict'),resources=process.env.VENIUX_RC_RESOURCES;
 const app=require(path.join(resources,'backend/src/index.js')),db=require(path.join(resources,'backend/src/config/database.js'));await db.ready;
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,body,token,key)=>{const r=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 try{
  assert.equal((await fetch(base+'/health')).status,200);const password=require('node:crypto').randomBytes(20).toString('hex')+'aA1!';
  const registered=await call('auth/register',{email:'rc-package@example.invalid',phone:'05551234567',password,role:'admin'});assert.equal(registered.status,201);const tenant=registered.data.user.tenant_id;
  await db.query("INSERT INTO licenses(license_key,tenant_id,plan_id,status,max_users,max_warehouses,max_devices,expires_at) VALUES('RC-LOCAL-TEST',$1,'ENTERPRISE_ANNUAL','ACTIVE',10,10,10,datetime('now','+1 year'))",[tenant]);
  const login=await call('auth/login',{email:'rc-package@example.invalid',password});assert.equal(login.status,200);const token=login.data.token;
  const wh=(await db.query("INSERT INTO warehouses(tenant_id,name,type) VALUES($1,'RC package fixture','MAIN') RETURNING id",[tenant])).rows[0];
  const p=(await db.query("INSERT INTO products(tenant_id,sku,barcode,name,unit,sale_price,kdv_orani,module_type) VALUES($1,'RC-PACKAGE','RC-PACKAGE','RC package product','adet',1.25,20,'NORMAL') RETURNING id",[tenant])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,5)',[tenant,wh.id,p.id]);
  assert.equal((await call('scanner/shifts/open',{warehouse_id:wh.id,opening_cash:0},token,'rc-open')).status,201);
  const body={warehouse_id:wh.id,payment_method:'cash',items:[{barcode:'RC-PACKAGE',count:1}]},sale=await call('scanner/sale',body,token,'rc-sale');assert.equal(sale.status,201);assert.equal(sale.data.total,1.25);assert.equal((await call('scanner/sale',body,token,'rc-sale')).data.sale_id,sale.data.sale_id);
  for(const width of [58,80]){const r=await fetch(base+'/api/scanner/sales/'+sale.data.sale_id+'/receipt?width='+width,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);assert((await r.text()).includes('1,25 TL'));}
  assert.equal((await call('scanner/sales/'+sale.data.sale_id+'/cancel',{reason:'RC package isolated cancellation'},token,'rc-cancel')).status,200);
  assert.equal(Number((await db.query('SELECT quantity FROM stock_records WHERE warehouse_id=$1 AND product_id=$2',[wh.id,p.id])).rows[0].quantity),5);
  require(path.join(resources,'backend/src/services/backupService.js'));
  console.log('RC_SMOKE_RESULT '+JSON.stringify({status:'PASS',packaged_node:process.version,health:200,registration_login:true,local_test_license:true,sale_replay_receipt_cancel:true,stock_restored:5,central_license_activation:'NOT TESTED',installer_gui:'NOT TESTED'}));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}
}
let r;try{r=spawnSync(path.join(resources,'local-server/node.exe'),['--require',path.join(root,'tools/hardware-lab/network-guard.cjs'),'-e','('+smoke.toString()+')().catch(e=>{console.error("RC smoke failure",e.code||e.name);process.exitCode=1;});'],{cwd:root,env,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(base,'package-smoke.log'),(r.stdout||'')+'\n'+(r.stderr||''));const line=(r.stdout||'').split('\n').find(s=>s.startsWith('RC_SMOKE_RESULT '));fs.writeFileSync(path.join(base,'package-smoke.json'),JSON.stringify({exit:r.status,error:r.error?.code,result:line?JSON.parse(line.slice(16)):null},null,2));console.log('packaged API smoke',r.status);}
finally{if(path.dirname(data)===base&&path.basename(data).startsWith('package-smoke-'))fs.rmSync(data,{recursive:true,force:true,maxRetries:20,retryDelay:100});}
if(r?.status!==0)process.exitCode=1;
