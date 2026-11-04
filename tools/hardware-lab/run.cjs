const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
if(!['test','development'].includes(process.env.NODE_ENV))throw Error('Set NODE_ENV=test or development. Production execution is forbidden.');
const root=path.resolve(__dirname,'../..'),runs=path.join(root,'.local/hardware-lab-runs');fs.mkdirSync(runs,{recursive:true});
const run=path.join(runs,'run-'+crypto.randomBytes(12).toString('hex')),data=path.join(run,'data');fs.mkdirSync(data,{recursive:true});
const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
fs.writeFileSync(path.join(data,'private.pem'),keys.privateKey);fs.writeFileSync(path.join(data,'public.pem'),keys.publicKey);
const env={...process.env,NODE_ENV:'test',VENIUX_HARDWARE_LAB:'1',VENIUX_HARDWARE_LAB_DIR:run,VENIUX_DATA_DIR:data,TEST_SQLITE_PATH:path.join(data,'lab.sqlite'),DB_ENGINE:'sqlite',VENIUX_MYSQL_TEST:'0',VENIUX_DISABLE_BACKGROUND_JOBS:'1',VENIUX_CLOUD_SERVICE:'0',LICENSE_PRIVATE_KEY_PATH:path.join(data,'private.pem'),LICENSE_PUBLIC_KEY_PATH:path.join(data,'public.pem'),JWT_SECRET:crypto.randomBytes(48).toString('hex')};
for(const key of Object.keys(env))if(/^(DB_(HOST|PORT|NAME|USER|PASSWORD)|VENIUX_LICENSE_AUTHORITY_|SMTP_|NVIDIA_|GEMINI_|OPENAI_|ANTHROPIC_)/.test(key))delete env[key];
function execute(name,args,cwd=root,binary=process.execPath){const result=spawnSync(binary,binary===process.execPath?['--require',path.join(__dirname,'network-guard.cjs'),...args]:args,{cwd,env,encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:20*1024*1024});fs.writeFileSync(path.join(run,name+'.log'),(result.stdout||'')+'\n'+(result.stderr||'')+(result.error?'\n'+result.error.stack:''));console.log(name,'exit',result.status);return {name,exit:result.status,error:result.error?.message};}
const commands=[];
const focusVat=process.argv.includes('--vat-only');
try{
 if(focusVat){
  commands.push(execute('backend',['--experimental-vm-modules',path.join(root,'backend/node_modules/jest/bin/jest.js'),'--config',path.join(__dirname,'jest.config.cjs'),'--runInBand','--json','--testLocationInResults','--outputFile',path.join(run,'jest.json'),'--runTestsByPath',path.join(root,'backend/tests/hardwareLab.proof.cjs'),'--testNamePattern=LAB-VAT'],path.join(root,'backend')));
 }else{
 commands.push(execute('software',['--test','--test-isolation=none','--test-reporter=tap','shared/scanner.test.mjs','shared/retailMoney.test.mjs','shared/pendingSale.test.mjs','desktop/runtime.test.js','desktop/printing.test.cjs','desktop/integration-settings.test.cjs','scanner-bridge/tests/bridge.test.cjs','tools/hardware-lab/adapters.test.mjs']));
 const suites=['scanner.test.js','retail.test.js','retailCritical.test.js','retailRecovery.test.js','retailVat.test.js','retailProfit.test.js','retailDaily.test.js','retailShift.test.js','wmsLotOperations.test.js','virtualTerminalFlow.test.js','stockHealth.test.js','label-print.test.js','hardwareLab.proof.cjs'];
 commands.push(execute('backend',['--experimental-vm-modules',path.join(root,'backend/node_modules/jest/bin/jest.js'),'--config',path.join(__dirname,'jest.config.cjs'),'--runInBand','--json','--testLocationInResults','--outputFile',path.join(run,'jest.json'),'--runTestsByPath',...suites.map(x=>path.join(root,'backend/tests',x))],path.join(root,'backend')));
 const javaRoot=process.env.JAVA_HOME||'C:/Program Files/Java/jdk-17',jar=path.join(root,'mobile/android/libs/zxing-core-3.5.3.jar'),classes=path.join(data,'classes');fs.mkdirSync(classes);
 if(fs.existsSync(path.join(javaRoot,'bin/javac.exe'))){
  const compiled=execute('optical-compile',['-cp',jar,'-d',classes,path.join(__dirname,'OpticalLab.java')],root,path.join(javaRoot,'bin/javac.exe'));commands.push(compiled);
  if(compiled.exit===0)commands.push(execute('optical',['-Djava.awt.headless=true','-cp',classes+path.delimiter+jar,'OpticalLab',run],root,path.join(javaRoot,'bin/java.exe')));
  const platform=path.join(root,'.local/android-sdk/platform/android-35/android.jar'),generated=path.join(root,'.local/android-build-2.4.32/generated/com/veniux/companion/R.java');
  if(fs.existsSync(platform)&&fs.existsSync(generated)){
   const destination=path.join(data,'android-classes');fs.mkdirSync(destination);
   const folder=path.join(root,'mobile/android/src/com/veniux/companion');
   commands.push(execute('android-compile',['-encoding','UTF-8','-source','8','-target','8','-cp',platform+path.delimiter+jar,'-d',destination,generated,...fs.readdirSync(folder).filter(x=>x.endsWith('.java')).map(x=>path.join(folder,x))],root,path.join(javaRoot,'bin/javac.exe')));
  }else commands.push({name:'android-compile',exit:null,status:'BLOCKED',error:'Android platform or generated resources unavailable'});
 }else commands.push({name:'optical',exit:null,error:'JDK unavailable',status:'BLOCKED'});
 commands.push(execute('environment-probe',['-NoProfile','-File',path.join(__dirname,'probe.ps1'),'-OutputPath',path.join(run,'environment.json')],root,'powershell.exe'));
 }
}finally{
 // Only this randomly allocated laboratory directory is disposable. Keep small evidence files.
 if(path.dirname(data)===run&&path.dirname(run)===runs&&/^run-[a-f0-9]{24}$/.test(path.basename(run)))fs.rmSync(data,{recursive:true,force:true});
 fs.writeFileSync(path.join(run,'summary.json'),JSON.stringify({created_at:new Date().toISOString(),commands,isolated_database_removed:!fs.existsSync(data),physical_hardware:false},null,2));
 fs.writeFileSync(path.join(runs,focusVat?'vat-focused.json':'latest.json'),JSON.stringify({run},null,2));
 if(!focusVat)require('./report.cjs').writeReport(root,run);
 console.log('Lab evidence:',path.relative(root,run));
}
if(commands.some(x=>x.exit!==0))process.exitCode=1;
