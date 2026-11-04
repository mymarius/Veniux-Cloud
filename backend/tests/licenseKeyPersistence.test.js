const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{spawnSync}=require('child_process');
test('fresh development license PEM files remain valid and identical after a second process boot',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'veniux-license-pem-'));
 const privateFile=path.join(root,'private.pem'),publicFile=path.join(root,'public.pem');
 try{
 const env={...process.env,NODE_ENV:'test',LICENSE_PRIVATE_KEY_PATH:privateFile,LICENSE_PUBLIC_KEY_PATH:publicFile};
 const code="require('./src/services/licenseService'); const fs=require('fs'),crypto=require('crypto'); const key=crypto.createPrivateKey(fs.readFileSync(process.env.LICENSE_PRIVATE_KEY_PATH)); const publicKey=crypto.createPublicKey(fs.readFileSync(process.env.LICENSE_PUBLIC_KEY_PATH)); const data=Buffer.from('isolated-license-test'); if(!crypto.verify('sha256',data,publicKey,crypto.sign('sha256',data,key)))process.exit(2);";
 for(let n=0;n<2;n++){
 const run=spawnSync(process.execPath,['-e',code],{cwd:path.resolve(__dirname,'..'),env,windowsHide:true,encoding:'utf8',timeout:20000});
 expect(run.error).toBeUndefined();expect(run.status).toBe(0);
 if(n===0){var before=crypto.createHash('sha256').update(fs.readFileSync(privateFile)).digest('hex');}
 else expect(crypto.createHash('sha256').update(fs.readFileSync(privateFile)).digest('hex')).toBe(before);
 }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
},45000);
