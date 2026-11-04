const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{fork}=require('node:child_process');
if(process.env.NODE_ENV!=='test')throw Error('Test only');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'.local/release-candidate-1'),out=[];fs.mkdirSync(base,{recursive:true});
(async()=>{for(const point of ['before-commit','after-commit']){
 const data=fs.mkdtempSync(path.join(base,'crash-')),keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 fs.writeFileSync(path.join(data,'private.pem'),keys.privateKey);fs.writeFileSync(path.join(data,'public.pem'),keys.publicKey);
 const env={...process.env,NODE_ENV:'test',VENIUX_RC_CRASH:'1',VENIUX_RC_CRASH_POINT:point,VENIUX_HARDWARE_LAB:'1',VENIUX_DATA_DIR:data,TEST_SQLITE_PATH:path.join(data,'test.sqlite'),DB_ENGINE:'sqlite',VENIUX_MYSQL_TEST:'0',VENIUX_DISABLE_BACKGROUND_JOBS:'1',VENIUX_CLOUD_SERVICE:'0',LICENSE_PRIVATE_KEY_PATH:path.join(data,'private.pem'),LICENSE_PUBLIC_KEY_PATH:path.join(data,'public.pem'),JWT_SECRET:crypto.randomBytes(48).toString('hex')};
 for(const k of Object.keys(env))if(/^(DB_(HOST|PORT|NAME|USER|PASSWORD)|VENIUX_LICENSE_AUTHORITY_|SMTP_|NVIDIA_|OPENAI_|ANTHROPIC_)/.test(k))delete env[k];
 let child,raw;try{
  child=fork(path.join(__dirname,'crash-worker.cjs'),[],{env,execArgv:['--require',path.join(root,'tools/hardware-lab/network-guard.cjs')],stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture boundary timed out')),30000);child.once('message',m=>{clearTimeout(timer);m.point===point?resolve():reject(Error('Fixture boundary error: '+JSON.stringify(m)));});child.once('exit',()=>{clearTimeout(timer);reject(Error('Worker exited before kill'));});});
  const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;
  raw=new (require('../../backend/node_modules/better-sqlite3'))(path.join(data,'test.sqlite'));
  const fixture=JSON.parse(fs.readFileSync(path.join(data,'fixture.json'))),expected=point==='before-commit'?0:1;
  assert.equal(raw.pragma('integrity_check',{simple:true}),'ok');assert.deepEqual(raw.pragma('foreign_key_check'),[]);
  const sales=raw.prepare('SELECT COUNT(*) n FROM retail_sales WHERE tenant_id=?').get(fixture.tenant).n;
  assert.equal(sales,expected);assert.equal(raw.prepare('SELECT COUNT(*) n FROM pos_sales WHERE tenant_id=?').get(fixture.tenant).n,expected);
  assert.equal(raw.prepare('SELECT quantity FROM stock_records WHERE warehouse_id=? AND product_id=?').get(fixture.warehouse,fixture.product).quantity,5-expected);
  assert.equal(raw.prepare('SELECT COUNT(*) n FROM depot_operation_keys WHERE tenant_id=? AND operation_key=?').get(fixture.tenant,'scan-sale:rc-process-crash').n,expected);
  out.push({point,status:'PASS',sales,stock:5-expected,integrity:'ok',method:'SIGKILL of disposable Node child, WAL recovery; not physical power or storage-cache loss'});console.log(point,'PASS');
 }finally{if(child&&!child.killed)child.kill('SIGKILL');raw?.close();if(path.dirname(data)===base&&path.basename(data).startsWith('crash-'))try{fs.rmSync(data,{recursive:true,force:true,maxRetries:20,retryDelay:100});}catch(e){out.push({point,status:'CLEANUP BLOCKED',path:path.basename(data),code:e.code});}}
}fs.writeFileSync(path.join(base,'crash-results.json'),JSON.stringify({created_at:new Date().toISOString(),results:out,physical_power_failure:'NOT TESTED'},null,2));})().catch(e=>{fs.writeFileSync(path.join(base,'crash-results.json'),JSON.stringify({results:out,error:e.message},null,2));console.error(e.message);process.exitCode=1;});
