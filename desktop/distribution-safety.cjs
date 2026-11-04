// Release preflight for first-party resources. Does not print file contents.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function entryProblems(name,bytes){
 const problems=[];
 if(/(?:^|[/\\])(?:\.env(?:\.(?!example$|sample$)[\w-]+)?|local-key\.bin|[^/\\]+\.(?:(?:db|sqlite|sqlite3)(?:-(?:wal|shm|journal))?|pfx|p12|jks|keystore|vnxsecure))$/i.test(name))problems.push('private configuration/database filename');
 if(/(?:^|[/\\])(?:storage|recovery|backups?|keys|customer-data)(?:[/\\]|$)/i.test(name))problems.push('private runtime data directory');
 if(bytes.subarray(0,16).equals(Buffer.from('SQLite format 3\0')))problems.push('SQLite database');
 if(bytes.length>=32&&[0x377f0682,0x377f0683].includes(bytes.readUInt32BE(0)))problems.push('SQLite WAL');
 const blocks=bytes.toString('utf8').match(/-----BEGIN (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----/g)||[];
 for(const block of blocks){try{crypto.createPrivateKey(block);problems.push('private signing key');break;}catch{if(/BEGIN (?:ENCRYPTED |OPENSSH )PRIVATE KEY/.test(block)){problems.push('private key container');break;}}}
 return problems;
}
function audit(resources){
 resources=path.resolve(resources);const findings=[];let checked=0;
 const check=(name,bytes)=>{checked++;const reasons=entryProblems(name,bytes);if(reasons.length)findings.push({path:name,reasons});};
 function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules')continue;const full=path.join(dir,e.name),name=path.relative(resources,full);if(e.isSymbolicLink())throw Error('Release preflight rejects symbolic links');if(e.isDirectory())visit(full);else if(e.isFile()){if(e.name==='app.asar')continue;const size=fs.statSync(full).size;if(size<=4*1024*1024)check(name,fs.readFileSync(full));else{const fd=fs.openSync(full,'r'),head=Buffer.alloc(16);try{fs.readSync(fd,head,0,16,0);check(name,head);}finally{fs.closeSync(fd);}}}}}
 visit(resources);const archive=path.join(resources,'app.asar');
 if(fs.existsSync(archive)){const asar=require('@electron/asar');for(const n of asar.listPackage(archive)){const name=n.replace(/^[/\\]/,'');if(name.split(/[/\\]/).includes('node_modules'))continue;const stat=asar.statFile(archive,name);if(stat.files)continue;if(stat.size<=4*1024*1024)check('app.asar/'+name,asar.extractFile(archive,name));else check('app.asar/'+name,Buffer.alloc(0));}}
 if(findings.length)throw Error('Unsafe distribution resources: '+JSON.stringify(findings));
 return {checked,scope:'first-party resources and app.asar; dependency fixtures excluded; content capped at 4 MiB'};
}
module.exports={entryProblems,audit};
if(require.main===module){try{if(!process.argv[2])throw Error('A release directory is required');console.log(JSON.stringify(audit(process.argv[2])));}catch(e){console.error(e.message);process.exitCode=1;}}
