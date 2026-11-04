'use strict';
// Acceptance of saved real-browser measurements, not a fabricated rendering test.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),zlib=require('zlib');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.local/signature-3'),read=n=>JSON.parse(fs.readFileSync(path.join(out,n)));
const layouts=[...new Map(read('layout.json').map(x=>[x.path+'|'+x.width,x])).values()];
for(const width of [360,390,768,1024,1440,1920])for(const route of ['/','/market-pos','/depo-yonetimi','/market-pos/fiyatlandirma','/depo-yonetimi/fiyatlandirma','/demo']){
 const row=layouts.find(x=>x.width===width&&x.path===route);assert(row,'Missing actual viewport '+width+route);assert(row.document<=width,'Page overflow');assert.equal(row.h1,1);assert.equal(row.brokenTurkish,false);assert.equal(row.badImages,0);assert.deepEqual(row.clipped,[]);
 for(const img of row.compositionCuts){assert(img.top>=img.fieldTop-2,'Image clipped at top');assert(img.bottom<=img.fieldBottom+2,'Image clipped at bottom');}
 if(route.includes('fiyatlandirma'))assert.equal(row.recommended,1);
}
for(const row of read('supplemental.json')){assert(row.document<=row.width,row.path);assert.equal(row.h1,1);assert.equal(row.badText,false);}
for(const row of read('final-small.json')){assert(row.document<=row.width,row.path);assert.equal(row.h1,1);assert.equal(row.badText,false);}
function lum(s){const a=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
const contrast=read('contrast-samples.json').flatMap(g=>g.samples.map(s=>{const a=lum(s.fg),b=lum(s.bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),threshold=parseFloat(s.font)>=24||(parseFloat(s.font)>=18.6667&&parseFloat(s.weight)>=700)?3:4.5;return{...s,path:g.path,theme:g.theme,ratio,threshold,pass:ratio>=threshold};}));assert(contrast.length>=200);assert(contrast.every(x=>x.pass),'Text contrast failed');
const interactions=read('interaction.json');assert.equal(interactions[0].newSelected,'Depo');assert.deepEqual(interactions[0].visiblePanels,['vx-all-panel-warehouse']);assert.equal(interactions[1].focus,'vx-all-tab-stock');assert.equal(interactions[1].oldSelected,'tab-0');assert.equal(interactions[2].newSelected,'Stok & sayım');assert.equal(interactions[2].oldSelected,'tab-1');assert(interactions[3].referenceOpen&&interactions[3].targetVisible);
const menu=read('menu.json');assert.equal(menu.open,false);assert.equal(menu.focus,'Menüyü aç');
const form=read('form-browser.json');assert.equal(form.familyProof.plan,'');assert.equal(form.familyProof.interest,'depo');assert(form.submitProof.success.includes('kaydedildi'));assert(form.submitProof.document<=form.submitProof.width);
const manifest=fs.readFileSync(path.join(root,'website-php/asset-manifest.php'),'utf8'),names=[...manifest.matchAll(/=>"([^"]+)"/g)].map(m=>m[1]);
const assets=names.map(name=>{const b=fs.readFileSync(path.join(root,'website-php/assets',name));if(name.endsWith('.css')){assert(!b.includes(Buffer.from('__BP_')));assert(b.includes(Buffer.from('--vx-ink')));}return{name,bytes:b.length,gzip:zlib.gzipSync(b).length};});
const screenshots=fs.readdirSync(out).filter(n=>/\.(?:png|jpg)$/.test(n)).map(name=>{const b=fs.readFileSync(path.join(out,name));let width,height,format;if(b.readUInt32BE(0)===0x89504e47){format='PNG';width=b.readUInt32BE(16);height=b.readUInt32BE(20);}else{assert.equal(b.readUInt16BE(0),0xffd8,'Unknown capture format');format='JPEG';for(let i=2;i<b.length;){const mark=b[i+1],len=b.readUInt16BE(i+2);if([192,193,194].includes(mark)){width=b.readUInt16BE(i+7);height=b.readUInt16BE(i+5);break;}i+=len+2;}assert(width&&height);}return{name,format,width,height,bytes:b.length};});
for(const w of [360,390,768,1024,1440,1920])assert(screenshots.some(s=>s.name.startsWith('home-'+w)),'Missing screenshot '+w);
const result={status:'PASS',core_layouts:layouts.length,supplemental_layouts:read('supplemental.json').length,contrast_samples:contrast.length,min_contrast:Math.min(...contrast.map(x=>x.ratio)),interaction_checks:8,form_browser:'PASS',menu_keyboard:'PASS',screenshots,physical_device_tested:false,cwv_field_tested:false};
for(const [name,value]of Object.entries({'visual-results.json':result,'contrast.json':contrast,'assets.json':assets}))fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2));console.log(JSON.stringify({status:result.status,core:result.core_layouts,supplemental:result.supplemental_layouts,contrast:result.contrast_samples,screenshots:screenshots.length}));
