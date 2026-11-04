const path=require('path'),fs=require('fs');
const backend=path.resolve(__dirname,'../..');
function paths(env=process.env){
 const data=env.VENIUX_DATA_DIR?path.resolve(env.VENIUX_DATA_DIR):backend;
 return {data,database:env.NODE_ENV==='test'?path.resolve(env.TEST_SQLITE_PATH||path.join(backend,'stok_takip_test.db')):path.join(data,'stok_takip.db'),storage:path.join(data,'storage'),keys:env.VENIUX_DATA_DIR?path.join(data,'keys'):path.join(backend,'config','keys'),recovery:path.join(data,'recovery')};
}
function validate(env=process.env){
 if(env.NODE_ENV!=='production')return;
 const errors=[];
 if(!env.VENIUX_DATA_DIR||!path.isAbsolute(env.VENIUX_DATA_DIR))errors.push('VENIUX_DATA_DIR mutlak bir kalıcı veri klasörü olmalı.');
 if(!['sqlite','mysql'].includes(env.DB_ENGINE))errors.push('Üretimde DB_ENGINE açıkça sqlite veya mysql seçilmelidir.');
 if(env.DB_ENGINE==='mysql'){
  if(!env.DB_HOST||!/^[A-Za-z0-9_.:-]+$/.test(env.DB_HOST)||!env.DB_NAME||!/^[A-Za-z0-9_]+$/.test(env.DB_NAME)||!env.DB_USER||/^root$/i.test(env.DB_USER)||!env.DB_PASSWORD)errors.push('MySQL için DB_HOST, DB_NAME ve root olmayan, şifreli DB_USER hesabı gerekli.');
  if(env.DB_PORT&&(!/^\d+$/.test(env.DB_PORT)||Number(env.DB_PORT)<1||Number(env.DB_PORT)>65535))errors.push('MySQL DB_PORT geçersiz.');
 }
 if(typeof env.JWT_SECRET!=='string'||Buffer.byteLength(env.JWT_SECRET)<32||/your-secret|change-this|example|placeholder/i.test(env.JWT_SECRET))errors.push('JWT_SECRET en az 32 bayt rastgele bir sır olmalı. Kurulum komutu bunu üretir.');
 if(!/^\d+$/.test(env.PORT||'')||Number(env.PORT)<1024||Number(env.PORT)>65535)errors.push('PORT 1024–65535 arasında olmalı.');
 if(env.HOST!=='127.0.0.1')errors.push('Bu yerel kurulum HOST=127.0.0.1 ile çalışır.');
 if(env.VENIUX_DATA_DIR){const data=path.resolve(env.VENIUX_DATA_DIR),project=path.resolve(backend,'..');if(data===project||data.startsWith(project+path.sep))errors.push('Kalıcı veri klasörü uygulama sürüm klasörünün dışında olmalı.');}
 for(const field of ['LICENSE_PRIVATE_KEY_PATH','LICENSE_PUBLIC_KEY_PATH'])if(!env[field]||!path.isAbsolute(env[field])||!fs.existsSync(env[field]))errors.push(field+' kalıcı anahtar dosyası bulunamadı. Kurulumu tamamlayın.');
 if(!errors.length){try{const crypto=require('crypto'),privateKey=crypto.createPrivateKey(fs.readFileSync(env.LICENSE_PRIVATE_KEY_PATH)),publicKey=crypto.createPublicKey(fs.readFileSync(env.LICENSE_PUBLIC_KEY_PATH));if(crypto.createPublicKey(privateKey).export({type:'spki',format:'pem'})!==publicKey.export({type:'spki',format:'pem'}))errors.push('Lisans anahtar çifti eşleşmiyor.');}catch{errors.push('Lisans anahtarları geçersiz PEM biçiminde.');}}
 if(errors.length)throw Object.assign(Error('Kurulum ayarları eksik:\n'+errors.join('\n')),{code:'INSTALL_CONFIG_INVALID'});
}
module.exports={paths,validate};
