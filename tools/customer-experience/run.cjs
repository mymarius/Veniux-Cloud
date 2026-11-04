const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
if(!['test','development'].includes(process.env.NODE_ENV))throw Error('Development/test only');
const root=path.resolve(__dirname,'../..'),runs=path.join(root,'.local/customer-experience');fs.mkdirSync(runs,{recursive:true});
const run=path.join(runs,'run-'+crypto.randomBytes(8).toString('hex')),data=path.join(run,'data');fs.mkdirSync(data,{recursive:true});
const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});fs.writeFileSync(path.join(data,'private.pem'),keys.privateKey);fs.writeFileSync(path.join(data,'public.pem'),keys.publicKey);
const env={...process.env,NODE_ENV:'test',VENIUX_HARDWARE_LAB:'1',VENIUX_HARDWARE_LAB_DIR:run,VENIUX_DATA_DIR:data,TEST_SQLITE_PATH:path.join(data,'test.sqlite'),DB_ENGINE:'sqlite',VENIUX_MYSQL_TEST:'0',VENIUX_CLOUD_SERVICE:'0',VENIUX_DISABLE_BACKGROUND_JOBS:'1',LICENSE_PRIVATE_KEY_PATH:path.join(data,'private.pem'),LICENSE_PUBLIC_KEY_PATH:path.join(data,'public.pem'),JWT_SECRET:crypto.randomBytes(48).toString('hex')};
for(const key of Object.keys(env))if(/^(DB_(HOST|PORT|NAME|USER|PASSWORD)|VENIUX_LICENSE_AUTHORITY_|SMTP_|NVIDIA_|GEMINI_|OPENAI_|ANTHROPIC_)/.test(key))delete env[key];
const results=[];
function execute(name,args,cwd=root,guard=true){
 const commandEnv=name==='frontend-build'?{...env,NODE_ENV:'production'}:env;
 const r=spawnSync(process.execPath,[...(guard?['--require',path.join(root,'tools/hardware-lab/network-guard.cjs')]:[]),...args],{cwd,env:commandEnv,encoding:'utf8',timeout:300000,maxBuffer:24*1024*1024,windowsHide:true});
 fs.writeFileSync(path.join(run,name+'.log'),(r.stdout||'')+'\n'+(r.stderr||'')+(r.error?'\n'+r.error.code:''));
 results.push({name,exit:r.status,error:r.error?.code});console.log(name,'exit',r.status);
}
const suites=process.argv.includes('--rc-only')?['releaseCandidate.test.js','productionReadiness.test.js','retailCritical.test.js','retailShift.test.js','retailVat.test.js','backupRecovery.test.js','deploymentLifecycle.test.js']:process.argv.includes('--all-api')?fs.readdirSync(path.join(root,'backend/tests')).filter(n=>n.endsWith('.test.js')).sort():process.argv.includes('--readiness-only')?['productionReadiness.test.js','assistantSystemOperations.test.js']:process.argv.includes('--retail-pro-only')?['retailPro.test.js']:process.argv.includes('--setup-only')?['customerSetup.test.js']:['retailTerminalUX.test.js','retailPro.test.js','customerSetup.test.js','productImport.test.js','retail.test.js','retailCritical.test.js','retailRecovery.test.js','retailVat.test.js','retailDaily.test.js','retailShift.test.js','wmsLotOperations.test.js','virtualTerminalFlow.test.js','stockHealth.test.js','authorizationOperations.test.js','multi_tenant_isolation.test.js','mobilePairing.test.js','backupRecovery.test.js'];
try{
 execute('presentation',['--test','--test-isolation=none','--test-reporter=tap','frontend/src/lib/customerExperience.test.mjs','frontend/src/lib/terminalIdentity.test.mjs','frontend/src/lib/posPresentation.test.mjs','frontend/src/lib/posMoneyInput.test.mjs','desktop/runtime.test.js','desktop/distribution-safety.test.cjs','desktop/integration-settings.test.cjs','desktop/printing.test.cjs','shared/scanner.test.mjs','shared/pendingSale.test.mjs','shared/retailPro.test.mjs']);
 if(!process.argv.includes('--ui-only'))execute('backend',['--experimental-vm-modules',path.join(root,'backend/node_modules/jest/bin/jest.js'),'--config',path.join(root,'tools/hardware-lab/jest.config.cjs'),'--runInBand','--json','--outputFile',path.join(run,'jest.json'),'--runTestsByPath',...suites.map(s=>path.join(root,'backend/tests',s))],path.join(root,'backend'));
 execute('frontend-build',[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'build','--outDir',path.join(run,'frontend')],path.join(root,'frontend'),false);
}finally{
 fs.writeFileSync(path.join(run,'commands.json'),JSON.stringify(results,null,2));fs.writeFileSync(path.join(runs,'latest.json'),JSON.stringify({run},null,2));
 // This directory was generated for this run and never points at installed/business data.
 if(path.dirname(data)===run&&path.dirname(run)===runs&&path.basename(run).startsWith('run-'))fs.rmSync(data,{recursive:true,force:true});
 console.log('Evidence:',path.relative(root,run));
}
if(results.some(r=>r.exit!==0))process.exitCode=1;
