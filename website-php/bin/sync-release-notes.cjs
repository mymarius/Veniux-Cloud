// Run before website publication. Do not infer EXE/APK versions from source versions.
const fs=require('fs'),path=require('path');
(async()=>{
 const root=path.resolve(__dirname,'../..'),program=JSON.parse(fs.readFileSync(path.join(root,'frontend/src/data/programRelease.json')));
 const downloads={};
 for(const platform of ['windows','android']){const r=await fetch('https://api.veniux.com/updates/files/'+platform+'.json');if(!r.ok)throw Error('Manifest unavailable: '+platform);const m=await r.json();if(!/^\d+\.\d+\.\d+$/.test(m.version))throw Error('Invalid version');downloads[platform]=m.version;}
 const newest=Math.max(...Object.values(downloads).map(v=>Number(v.split('.').at(-1))));
 const data={checked_at:new Date().toISOString(),downloads,releases:program.releases.filter(r=>Number(r.version.split('.').at(-1))>=24&&Number(r.version.split('.').at(-1))<=newest&&r.platform!=='Windows').map(r=>({...r,platforms:['android'],notice:'Android güncelleme geçmişi. İndirme kanalı: Windows '+downloads.windows+', Android '+downloads.android+'. Windows yeni paketinin yayın tarihi ayrı kayıtta gösterilir. Fiziksel cihaz uyumluluğu ayrıca doğrulanmalıdır.'}))};
 fs.writeFileSync(path.join(root,'website-php/release-catalog.php'),'<?php\ndeclare(strict_types=1);\nreturn (require __DIR__.\'/release-live.php\')(json_decode('+JSON.stringify(JSON.stringify(data)).replaceAll('$','\\$')+", true, 512, JSON_THROW_ON_ERROR));\n");
 console.log('Release catalogue synced with verified download versions:',downloads);
})().catch(e=>{console.error(e.message);process.exitCode=1});
