// One clearly labelled publication test account; no email is sent and no business account/license is created.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const expected=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.local/website-downloads-release-2.4.14/releases.json'),'utf8'));
const email='download-check-'+crypto.randomUUID()+'@example.invalid';
const base='https://veniux.com';
let stage='registration-page';
(async()=>{
 let r=await fetch(base+'/kayit',{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);
 let cookie=r.headers.get('set-cookie').split(';')[0];const csrf=(await r.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
 stage='registration';r=await fetch(base+'/kayit',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,email,company:'Veniux yayın doğrulaması',password:crypto.randomBytes(24).toString('hex')})});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/indir');cookie=r.headers.get('set-cookie').split(';')[0];
 stage='downloads-page';r=await fetch(base+'/indir',{headers:{cookie},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);const html=await r.text();assert(html.includes('/dosya/windows')&&html.includes('/dosya/android'));
 stage='windows-download';r=await fetch(base+'/dosya/windows',{headers:{cookie},signal:AbortSignal.timeout(180000)});assert.equal(r.status,200);assert(r.headers.get('content-disposition').includes(expected.windows.filename));let windowsBytes=0;const windowsHash=crypto.createHash('sha256');for await(const chunk of r.body){windowsBytes+=chunk.length;windowsHash.update(chunk);}assert.equal(windowsBytes,expected.windows.bytes);assert.equal(windowsHash.digest('hex'),expected.windows.sha256);
 stage='android-download';r=await fetch(base+'/dosya/android',{headers:{cookie},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,expected.android.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected.android.sha256);
 const logoutCsrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];r=await fetch(base+'/cikis',{method:'POST',redirect:'manual',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:logoutCsrf}),signal:AbortSignal.timeout(15000)});assert.equal(r.status,303);
 console.log(JSON.stringify({checked_at:new Date().toISOString(),registration:303,downloads_page:200,windows_bytes:expected.windows.bytes,android_bytes:bytes.length,android_sha256:expected.android.sha256,logout:303,test_account:email}));
})().catch(e=>{console.error('Publication test failed at '+stage+': '+e.message);process.exitCode=1;});
