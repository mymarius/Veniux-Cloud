const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{spawn}=require('child_process'),net=require('net');
const root=path.resolve(__dirname,'../..'),data=fs.mkdtempSync(path.join(root,'.local/phase2-conversion-'));
async function main(){
 const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const base='http://127.0.0.1:'+port,child=spawn('C:/xampp/php/php.exe',['-S','127.0.0.1:'+port,'-t',path.join(root,'website-php'),path.join(root,'website-php/router.php')],{windowsHide:true,env:{...process.env,VENIUX_CONTACT_STORAGE:path.join(data,'requests'),VENIUX_CONTACT_NOTIFY:'0',VENIUX_SITE_INDEXABLE:'0'}});
 let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/robots.txt')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'PHP startup: '+stderr);
  for(const type of ['demo','quote','contact','partnership']){
   const page=await fetch(base+'/'),cookie=page.headers.get('set-cookie').split(';')[0],html=await page.text(),token=html.match(/name="token" value="([a-f0-9]+)"/)[1];
   const post=values=>fetch(base+'/',{method:'POST',redirect:'manual',headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(values)});
   const values={token,name:'Synthetic Only',email:'synthetic@example.invalid',company:'TEST ONLY',interest:'stok',consent:'1',form_type:type,...(type==='partnership'?{partner_type:'hardware'}:{})};
   assert.equal((await post({...values,token:'wrong'})).status,403);
   if(type==='partnership')assert.equal((await post({...values,partner_type:'invalid'})).status,422);
   const success=await post(values);assert.equal(success.status,303);assert.equal(success.headers.get('location'),'/?request=received#iletisim');
   const first=await(await fetch(base+'/?request=received',{headers:{cookie}})).text();
   assert.equal((first.match(/data-conversion-receipt=/g)||[]).length,1);assert(first.includes('data-conversion-type="'+type+'"'));
   const receipt=first.match(/<span hidden data-conversion-receipt=[^>]+>/)[0];assert(!receipt.includes('Synthetic'));assert(!receipt.includes('@'));assert(!receipt.includes('TEST ONLY'));
   const refresh=await(await fetch(base+'/?request=received',{headers:{cookie}})).text();assert(!refresh.includes('data-conversion-receipt='));
   assert.equal((await post(values)).status,403);console.log('PASS durable '+type+': success303, one-use event, refresh0, replay403, no PII');
  }
  const records=fs.readdirSync(path.join(data,'requests')).filter(n=>n.endsWith('.json'));assert.equal(records.length,4);for(const name of records){const record=JSON.parse(fs.readFileSync(path.join(data,'requests',name)));assert.equal(record.email,'synthetic@example.invalid');assert(record.form_type);assert(!record.notification_status);}
  console.log('PASS 4 synthetic records only; external notifications disabled; isolated data '+path.basename(data));
 }finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));fs.writeFileSync(path.join(data,'php.log'),stderr);}
}
main().catch(e=>{console.error(e);process.exitCode=1});
