const path=require('path');
const fs=require('fs');
const directory=path.resolve(process.env.UPDATE_STORAGE_DIR||path.join(require('../config/runtimeConfig').paths().storage,'updates'));
const validName=name=>/^[A-Za-z0-9][A-Za-z0-9._ -]{0,160}$/.test(name)&&(/\.(exe|blockmap)$/.test(name)||name==='latest.yml');
async function validateManifest(buffer){
 if(buffer.length>65536)throw Object.assign(new Error('Sürüm dosyası en fazla 64 KB olabilir.'),{status:400});
 const manifest=require('yaml').parse(buffer.toString('utf8'));
 if(!manifest||!/^\d+\.\d+\.\d+$/.test(manifest.version)||!Array.isArray(manifest.files)||!manifest.files.length)throw Object.assign(new Error('Geçerli electron-builder latest.yml dosyası gerekli.'),{status:400});
 for(const entry of manifest.files){
  if(!entry||!validName(entry.url)||!entry.url.endsWith('.exe')||typeof entry.sha512!=='string')throw Object.assign(new Error('Sürüm dosyası yalnızca yüklenmiş EXE dosyalarını içerebilir.'),{status:400});
  const target=path.join(directory,entry.url);
  if(!fs.existsSync(target))throw Object.assign(new Error('Önce kurulum dosyasını yükleyin: '+entry.url),{status:400});
  const hash=require('crypto').createHash('sha512');
  for await(const chunk of fs.createReadStream(target))hash.update(chunk);
  if(hash.digest('base64')!==entry.sha512||fs.statSync(target).size!==entry.size)throw Object.assign(new Error('Kurulum dosyasının boyutu veya imzası sürüm bilgisiyle uyuşmuyor.'),{status:400});
 }
 if(manifest.path!==undefined&&!manifest.files.some(entry=>entry.url===manifest.path))throw Object.assign(new Error('Sürüm dosyası yolu geçersiz.'),{status:400});
 return manifest;
}
module.exports={directory,validName,validateManifest,list:()=>fs.existsSync(directory)?fs.readdirSync(directory).filter(validName).map(name=>({name,bytes:fs.statSync(path.join(directory,name)).size})):[]};
