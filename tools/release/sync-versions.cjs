#!/usr/bin/env node
// Tek sürüm kaynağı: frontend/src/data/programRelease.json. Diğer yerleri eşitler; --check yalnız denetler.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),check=process.argv.includes('--check');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const release=JSON.parse(read('frontend/src/data/programRelease.json'));
const version=release.version,match=/^2\.4\.(\d+)$/.exec(version);
if(!match)throw Error('2.4.x biçiminde sürüm bekleniyor: '+version);
if(release.releases[0]?.version!==version)throw Error('İlk sürüm notu güncel sürümle aynı olmalı.');
const versionCode=240+Number(match[1]);
const edits=[
 ['desktop/package.json',s=>s.replace(/("version":\s*")[^"]+(")/,`$1${version}$2`)],
 ['mobile/android/AndroidManifest.xml',s=>s.replace(/android:versionCode="\d+"/,`android:versionCode="${versionCode}"`).replace(/android:versionName="[^"]+"/,`android:versionName="${version}"`)],
 ['mobile/android/src/com/veniux/companion/MainActivity.java',s=>s.replace(/VeniuxAndroid\/\d+\.\d+\.\d+/,`VeniuxAndroid/${version}`)],
 ['backend/src/config/release.json',s=>JSON.stringify({...JSON.parse(s),version},null,2)+'\n'],
];
const stale=[];
for(const [file,edit] of edits){const before=read(file),eol=before.includes('\r\n'),after=edit(before.replace(/\r\n/g,'\n'));if(after!==before.replace(/\r\n/g,'\n')){stale.push(file);if(!check)fs.writeFileSync(path.join(root,file),eol?after.replace(/\n/g,'\r\n'):after);}}
if(check&&stale.length){console.error('Sürümü eşit olmayan dosyalar: '+stale.join(', '));process.exit(1);}
console.log(check?`Sürümler eşit: ${version}`:`Sürüm ${version}; güncellenen: ${stale.join(', ')||'yok'}`);
