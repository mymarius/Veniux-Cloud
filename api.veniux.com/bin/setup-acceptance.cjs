const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const data=fs.mkdtempSync(path.resolve(__dirname,'../../.local/web-setup-test-'));
const password='Isolated-test-credential-2026';fs.writeFileSync(path.join(data,'admin-setup.json'),JSON.stringify({email:'setup@example.invalid',password}));
const server=spawn('C:/xampp/php/php.exe',['-S','127.0.0.1:39215','-t',path.resolve(__dirname,'../public')],{env:{...process.env,LICENSE_ENV:'development',LICENSE_DATA_DIR:data},stdio:'ignore'});
(async()=>{try{
let r;for(let i=0;i<40;i++){try{r=await fetch('http://127.0.0.1:39215/setup.php');break;}catch{await new Promise(r=>setTimeout(r,100));}}
const cookie=r.headers.get('set-cookie').split(';')[0],html=await r.text(),csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
assert(!html.includes(password));
async function post(values){return fetch('http://127.0.0.1:39215/setup.php',{method:'POST',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});}
assert.equal((await post({csrf:'wrong'})).status,400);assert.equal((await post({csrf,email:'setup@example.invalid',password:'wrong',confirm:'1'})).status,400);assert(!fs.existsSync(path.join(data,'authority.sqlite')));
r=await post({csrf,email:'setup@example.invalid',password,confirm:'1'});assert.equal(r.status,200);assert((await r.text()).includes('yönetici hesabı hazır'));assert.equal(fs.readFileSync(path.join(data,'admin-setup.json'),'utf8'),'');assert(fs.existsSync(path.join(data,'signing-private.pem')));
assert.equal((await post({csrf,email:'setup@example.invalid',password,confirm:'1'})).status,400);
assert((await (await fetch('http://127.0.0.1:39215/installation.php')).text()).includes('404'));
console.log('PASS: isolated HTTP setup, CSRF rejection, wrong credentials, no pre-auth database writes, successful initialization, credential cleanup, repeat rejection. SQLite only.');
}finally{server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
