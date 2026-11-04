// Explicit, bounded production verification: six invalid login attempts, no real account credentials.
const assert=require('node:assert/strict');
const base='https://api.veniux.com';
const options={signal:AbortSignal.timeout(15000)};
(async()=>{
 const health=await fetch(base+'/health',options);assert.equal(health.status,200);
 assert.match(health.headers.get('strict-transport-security'),/max-age=31536000/);
 assert.match(health.headers.get('permissions-policy'),/camera=\(\)/);
 assert(!/PHP\//i.test(health.headers.get('x-powered-by')||''));
 const missing=await fetch(base+'/unknown-security-path',options);assert.equal(missing.status,404);assert(missing.headers.get('strict-transport-security'));
 const security=await fetch(base+'/.well-known/security.txt',options);assert.equal(security.status,200);assert.match(await security.text(),/Contact: https:\/\/veniux.com\/#iletisim/);
 // Avoid a minute boundary splitting this short fixed-window test.
 if(new Date().getUTCSeconds()>40)throw Error('Run again near the start of a minute; no login requests sent.');
 const statuses=[];
 for(let i=0;i<6;i++){
  const page=await fetch(base+'/login',{signal:AbortSignal.timeout(15000)});assert.equal(page.status,200);
  const cookie=page.headers.get('set-cookie').split(';')[0];const csrf=(await page.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const response=await fetch(base+'/login',{method:'POST',signal:AbortSignal.timeout(15000),headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,email:'security-check@example.invalid',password:'invalid-security-check'})});
  statuses.push(response.status);
  assert.equal(response.status,i<5?401:429);if(i===5)assert.equal(response.headers.get('retry-after'),'60');
 }
 console.log(JSON.stringify({checked_at:new Date().toISOString(),health:200,unknown_route:404,security_txt:200,login_statuses:statuses,headers:'HSTS and Permissions-Policy present; PHP version absent',remaining_x_powered_by:health.headers.get('x-powered-by')}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
