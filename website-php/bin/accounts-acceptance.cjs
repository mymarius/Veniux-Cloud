const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const data=fs.mkdtempSync(path.resolve(__dirname,'../../.local/website-account-test-'));
const server=spawn('C:/xampp/php/php.exe',['-S','127.0.0.1:39219','-t',path.resolve(__dirname,'..'),path.resolve(__dirname,'../router.php')],{env:{...process.env,VENIUX_SITE_ENV:'development',VENIUX_SITE_DATA_DIR:data,VENIUX_CONTACT_STORAGE:path.join(data,'requests')},stdio:'ignore'});
(async()=>{try{
 const base='http://127.0.0.1:39219';let r;for(let i=0;i<40;i++){try{r=await fetch(base+'/kayit');break;}catch{await new Promise(ok=>setTimeout(ok,100));}}
 assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];const csrf=(await r.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
 const post=(route,values,session=cookie)=>fetch(base+route,{method:'POST',redirect:'manual',headers:{cookie:session,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
 assert.equal((await post('/kayit',{csrf:'wrong'})).status,403);
 const password='Isolated-download-test-password';r=await post('/kayit',{csrf,company:'Acceptance only',email:'download-test@example.invalid',password});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/indir');const accountCookie=r.headers.get('set-cookie').split(';')[0];
 const records=fs.readFileSync(path.join(data,'website-accounts/accounts.json'),'utf8');assert(!records.includes(password));assert(records.includes('password_hash'));
 assert.equal((await fetch(base+'/indir',{headers:{cookie:accountCookie}})).status,200);
 assert.equal((await fetch(base+'/dosya/windows',{redirect:'manual'})).status,303);
 const login=await fetch(base+'/giris');const loginCookie=login.headers.get('set-cookie').split(';')[0],loginCsrf=(await login.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
 assert.equal((await post('/giris',{csrf:loginCsrf,email:'download-test@example.invalid',password:'wrong-but-long-password'},loginCookie)).status,401);
 assert.equal((await post('/giris',{csrf:loginCsrf,email:'download-test@example.invalid',password},loginCookie)).status,303);
 assert.equal((await fetch(base+'/cikis')).status,405);console.log('PASS: isolated registration/login, password hashing, CSRF, authenticated downloads, failed-login rejection, POST-only logout.');
}finally{server.kill();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
