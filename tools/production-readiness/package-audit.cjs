// Read-only artifact inspection. Never prints key material or database contents.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.local/production-readiness-3');
const asar=require('../../desktop/node_modules/@electron/asar');
const resources=path.join(root,'.local/desktop-installer-2.4.38/win-unpacked/resources');
const result={created_at:new Date().toISOString(),scope:'existing Windows unpacked resources, app.asar and selected first-party source; not the EXE embedded payload',artifacts:[],scans:[],findings:[],errors:[]};
function inspect(name,bytes,scope){
 const reason=[];
 if(/-----BEGIN (?:RSA |EC |ENCRYPTED |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')))reason.push('private-key-header');
 if(bytes.subarray(0,16).equals(Buffer.from('SQLite format 3\0')))reason.push('sqlite-database');
 if(/(?:^|[/\\])(?:\.env(?:\.(?!example|sample)[\w-]+)?|local-key\.bin|[^/\\]+\.(?:pfx|p12|jks|keystore|vnxsecure))$/i.test(name))reason.push('sensitive-filename');
 if(reason.length)result.findings.push({scope,path:name,reasons:reason});
}
function walk(folder,scope,skip){let count=0;function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(e.name)||e.isSymbolicLink())continue;const p=path.join(dir,e.name);if(e.isDirectory())visit(p);else if(e.isFile()){count++;const relative=path.relative(root,p).replaceAll('\\','/');if(e.name==='app.asar')continue;const stat=fs.statSync(p);if(stat.size<4*1024*1024)inspect(relative,fs.readFileSync(p),scope);else{const fd=fs.openSync(p,'r'),head=Buffer.alloc(16);fs.readSync(fd,head,0,16,0);fs.closeSync(fd);inspect(relative,head,scope);}}}}if(fs.existsSync(folder))visit(folder);result.scans.push({scope,files:count,large_file_content_limit_bytes:4194304});}
async function main(){
 walk(resources,'windows-resources',new Set(['node_modules']));
 const archive=path.join(resources,'app.asar');let count=0;
 if(fs.existsSync(archive))for(const n of asar.listPackage(archive)){const name=n.replace(/^[/\\]/,'');const stat=asar.statFile(archive,name);if(stat.files||!stat.size)continue;count++;if(stat.size<4*1024*1024)inspect('app.asar/'+name,asar.extractFile(archive,name),'windows-asar');}
 result.scans.push({scope:'windows-asar',files:count,large_file_content_limit_bytes:4194304});
 for(const folder of ['backend/src','desktop','shared','mobile/android/src','website-php','api.veniux.com'])walk(path.join(root,folder),'first-party-source',new Set(['node_modules','storage','data','uploads','.git','dist','keys']));
 for(const name of ['.local/desktop-installer-2.4.38/Veniux-Setup-2.4.38.exe','.local/android-build-2.4.32/Veniux-Android-2.4.32.apk'])if(fs.existsSync(path.join(root,name))){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(path.join(root,name)))hash.update(chunk);result.artifacts.push({path:name,bytes:fs.statSync(path.join(root,name)).size,sha256:hash.digest('hex')});}
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'package-audit.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({scans:result.scans,findings:result.findings,artifact_count:result.artifacts.length}));
}
main().catch(e=>{console.error('Artifact inspection failed:',e.code||e.name);process.exitCode=1;});
