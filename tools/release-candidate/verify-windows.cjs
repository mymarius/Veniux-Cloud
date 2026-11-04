const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.local/release-candidate-1'),base=path.join(out,'windows-unsigned'),exe=path.join(base,'Veniux-RC-2.4.39-rc.1-UNSIGNED.exe');
const seven=path.join(process.env.LOCALAPPDATA,'electron-builder/Cache/7zip@1.0.0/7zip-win-x64-a34pt/bin/7za.exe'),guard=require('../../desktop/distribution-safety.cjs');
const result={created_at:new Date().toISOString(),installer_executed:false,checks:[],findings:[]};
const listed=spawnSync(seven,['l','-slt',exe],{encoding:'utf8',windowsHide:true,maxBuffer:24*1024*1024});assert.equal(listed.status,0);
const entries=[...listed.stdout.matchAll(/^Path = (.+)$/gm)].map(m=>m[1].trim()).filter(n=>n!==exe);
for(const name of entries){if(name.split(/[/\\]/).includes('node_modules'))continue;const reasons=guard.entryProblems(name,Buffer.alloc(0));if(reasons.length)result.findings.push({path:name,reasons});}
assert.deepEqual(result.findings,[]);result.checks.push({name:'NSIS first-party entry names',status:'PASS',entries:entries.length});
const extracted=path.join(out,'payload-proof');fs.mkdirSync(extracted,{recursive:true});
const r=spawnSync(seven,['x',exe,'-o'+extracted,'-y','resources\\*','-x!resources\\backend\\node_modules\\*','-x!resources\\app.asar.unpacked\\node_modules\\*'],{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
fs.writeFileSync(path.join(out,'payload-extract.log'),r.stdout+'\n'+r.stderr);assert.equal(r.status,0);
const resources=path.join(extracted,'resources');result.checks.push({name:'extracted NSIS first-party content',status:'PASS',...guard.audit(resources)});
const asar=require('../../desktop/node_modules/@electron/asar'),archive=path.join(resources,'app.asar');const metadata=JSON.parse(asar.extractFile(archive,'package.json'));assert.equal(metadata.version,'2.4.39-rc.1');
result.checks.push({name:'embedded application version',status:'PASS',version:metadata.version});
const original=path.join(base,'win-unpacked/resources'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');let compared=0;
function compare(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules')continue;const file=path.join(dir,e.name);if(e.isDirectory())compare(file);else if(e.isFile()){const other=path.join(original,path.relative(resources,file));assert(fs.existsSync(other));assert.equal(hash(file),hash(other),path.relative(resources,file));compared++;}}}
compare(resources);result.checks.push({name:'extracted payload matches unpacked resources',status:'PASS',files:compared});
for(const name of ['retailDailyService.js','retailCreditService.js','retailExternalService.js','retailVatService.js','retailReceipt.js','retailProService.js'])assert.equal(hash(path.join(resources,'backend/src/services',name)),hash(path.join(root,'backend/src/services',name)),name);
result.checks.push({name:'critical backend services match current source',status:'PASS',files:6});
fs.writeFileSync(path.join(out,'windows-payload-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.checks));
