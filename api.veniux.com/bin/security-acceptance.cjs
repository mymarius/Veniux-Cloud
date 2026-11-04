const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const data=fs.mkdtempSync(path.resolve(__dirname,'../../.local/security-test-'));
const env={...process.env,LICENSE_ENV:'development',LICENSE_DATA_DIR:data};
const php=process.env.PHP_BINARY||'C:/xampp/php/php.exe';
const base='http://127.0.0.1:39216';
let server;
(async()=>{try{
 await new Promise((resolve,reject)=>{const p=spawn(php,[path.join(__dirname,'setup.php')],{env,stdio:['pipe','ignore','pipe']});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error('Fixture setup failed')));p.stdin.end(JSON.stringify({email:'security@example.invalid',password:'Isolated-security-test-password'}));});
 server=spawn(php,['-S','127.0.0.1:39216','-t',path.resolve(__dirname,'../public'),path.resolve(__dirname,'../public/router.php')],{env,stdio:'ignore'});
 let r;for(let i=0;i<40;i++){try{r=await fetch(base+'/health');break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
 assert.equal(r.status,200);assert.equal(r.headers.get('x-powered-by'),null);assert.match(r.headers.get('permissions-policy'),/camera=\(\)/);assert.equal(r.headers.get('strict-transport-security'),null);
 assert.equal((await fetch(base+'/unknown-security-path')).status,404);
 const security=await fetch(base+'/.well-known/security.txt');assert.equal(security.status,200);assert.match(security.headers.get('content-type'),/text\/plain/);assert.match(await security.text(),/Contact: https:\/\/veniux.com\/#iletisim/);
 // New sessions must share the IP bucket; four GETs do not consume password attempts.
 for(let i=0;i<4;i++)assert.equal((await fetch(base+'/login')).status,200);
 for(let i=0;i<6;i++){
  const page=await fetch(base+'/login');const cookie=page.headers.get('set-cookie').split(';')[0];const csrf=(await page.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
  r=await fetch(base+'/login',{method:'POST',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,email:'security@example.invalid',password:'wrong'})});
  assert.equal(r.status,i<5?401:429);if(i===5)assert.equal(r.headers.get('retry-after'),'60');
 }
 console.log('PASS: response headers, unknown route 404, GET does not consume login quota, sixth POST across separate sessions returns 429. Isolated SQLite only.');
}finally{server?.kill();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
