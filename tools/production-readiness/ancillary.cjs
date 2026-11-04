// Existing local-only PHP acceptance suites; no deployment or production DB access.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
if(process.env.NODE_ENV!=='test')throw Error('Test only');
const root=path.resolve(__dirname,'../..'),local=path.join(root,'.local'),out=path.join(local,'production-readiness-3');
const prefixes=['license-test-','security-test-','website-account-test-','phase2-conversion-'];
const before=new Set(fs.readdirSync(local)),results=[];
const env={...process.env,NODE_ENV:'test',VENIUX_HARDWARE_LAB:'1',VENIUX_CONTACT_NOTIFY:'0'};
for(const k of Object.keys(env))if(/^(LICENSE_|VENIUX_LICENSE_|DB_|SMTP_|NVIDIA_|GEMINI_|OPENAI_|ANTHROPIC_)/.test(k))delete env[k];
const jobs=[['license-php',['api.veniux.com/bin/acceptance.cjs']],['license-security-php',['api.veniux.com/bin/security-acceptance.cjs']],['website-accounts',['website-php/bin/accounts-acceptance.cjs']],['website-conversion',['website-php/bin/conversion-acceptance.cjs']],['website-consent',['--test','website-php/bin/consent.test.mjs','website-php/bin/conversion.test.mjs']]];
fs.mkdirSync(out,{recursive:true});
try{for(const [name,args]of jobs){const r=spawnSync(process.execPath,['--require',path.join(root,'tools/hardware-lab/network-guard.cjs'),...args],{cwd:root,env,encoding:'utf8',timeout:90000,windowsHide:true,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+'\n'+(r.stderr||''));results.push({name,exit:r.status,error:r.error?.code});console.log(name,r.status);}}
finally{for(const name of fs.readdirSync(local)){const p=path.resolve(local,name);if(!before.has(name)&&prefixes.some(prefix=>name.startsWith(prefix))&&path.dirname(p)===local&&fs.statSync(p).isDirectory())fs.rmSync(p,{recursive:true,force:true});}fs.writeFileSync(path.join(out,'ancillary.json'),JSON.stringify({created_at:new Date().toISOString(),results},null,2));}
if(results.some(r=>r.exit!==0))process.exitCode=1;
