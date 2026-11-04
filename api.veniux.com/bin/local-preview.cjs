const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'.local/license-authority');
fs.mkdirSync(data,{recursive:true});
const env={...process.env,LICENSE_ENV:'development',LICENSE_DATA_DIR:data};
const loginFile=path.join(root,'.local/license-admin-login.json');
if(!fs.existsSync(path.join(data,'authority.sqlite'))){
 const account={email:'admin@veniux.com',password:crypto.randomBytes(24).toString('base64url')};
 const r=spawnSync('C:/xampp/php/php.exe',[path.join(__dirname,'setup.php')],{env,input:JSON.stringify(account),encoding:'utf8'});
 if(r.status!==0)throw new Error('Authority initialization failed');
 fs.writeFileSync(loginFile,JSON.stringify(account,null,2),{mode:0o600});
}
console.log('Yerel lisans paneli: http://127.0.0.1:39210 — giriş bilgileri .local/license-admin-login.json');
const server=spawn('C:/xampp/php/php.exe',['-S','127.0.0.1:39210','-t',path.join(root,'api.veniux.com/public'),path.join(root,'api.veniux.com/public/router.php')],{env,stdio:['ignore','ignore','ignore']});
server.on('exit',code=>{process.exitCode=code||0;});
process.on('SIGINT',()=>server.kill());

