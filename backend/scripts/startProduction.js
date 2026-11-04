const fs=require('fs'),path=require('path'),crypto=require('crypto');
let releaseLock;
try{
 if(Number(process.versions.node.split('.')[0])!==24)throw Error('Node.js 24.x gerekli.');
 const i=process.argv.indexOf('--data-dir'),data=process.argv[i+1];if(i<0||!data||!path.isAbsolute(data))throw Error('Mutlak --data-dir gerekli.');
 Object.assign(process.env,require('node:util').parseEnv(fs.readFileSync(path.join(data,'install.env'),'utf8')));process.env.NODE_ENV='production';if(path.resolve(process.env.VENIUX_DATA_DIR)!==path.resolve(data))throw Error('Kurulum ayarlarının veri klasörü farklı.');
 require('../src/config/runtimeConfig').validate();const deployment=require('../src/services/deploymentService');releaseLock=deployment.lock(data);deployment.check(data,{allowOwnedMaintenance:true});
 if(!fs.existsSync(path.resolve(__dirname,'../../frontend/dist/index.html')))throw Error('Derlenmiş arayüz yok. Önce Windows kurulum adımını tamamlayın.');
 const file=path.join(data,'server.json'),token=crypto.randomBytes(32).toString('hex');if(fs.existsSync(file)){if(deployment.alive(JSON.parse(fs.readFileSync(file,'utf8')).pid))throw Error('API zaten açık.');fs.unlinkSync(file);}fs.writeFileSync(file,JSON.stringify({pid:process.pid,port:Number(process.env.PORT),token,release_root:path.resolve(__dirname,'../..')}),{mode:0o600,flag:'wx'});
 process.on('exit',()=>{if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file,'utf8')).pid===process.pid)fs.unlinkSync(file);});
 releaseLock();releaseLock=null;require('../src/services/runtimeControl').configure(token);require('../src/index');
}catch(error){releaseLock?.();console.error('API başlatılamadı: '+require('../src/middlewares/productionPrivacy').text(error.message));process.exitCode=1;}
