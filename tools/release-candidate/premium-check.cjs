'use strict';
// Checks saved, real browser observations. Does not emulate a browser or manufacture measurements.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.local/premium-ui');
const read=n=>JSON.parse(fs.readFileSync(path.join(out,n)));
const layouts=[...new Map(read('layout.json').map(x=>[x.path+'|'+x.width,x])).values()];
for(const width of [1440,1024,768,390,360])for(const route of ['/','/market-pos','/depo-yonetimi','/market-pos/fiyatlandirma','/depo-yonetimi/fiyatlandirma','/demo']){
 const row=layouts.find(x=>x.width===width&&x.path===route);assert(row,'Missing browser observation '+width+route);assert(row.document<=row.width,'Page overflow '+width+route);assert.equal(row.h1,1);assert.deepEqual(row.clipped,[]);assert.equal(row.badImages,0);
 if(route.includes('fiyatlandirma'))assert.equal(row.recommended,1);
}
for(const row of read('supplemental-mobile.json')){assert(row.document<=row.width,row.path);assert.equal(row.h1,1);}
function lum(s){const a=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;}
const contrast=read('contrast-samples.json').flatMap(g=>g.samples.map(s=>{const a=lum(s.fg),b=lum(s.bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),threshold=parseFloat(s.font)>=24||(parseFloat(s.font)>=18.6667&&parseFloat(s.weight)>=700)?3:4.5;return{...s,path:g.path,theme:g.theme,ratio,threshold,pass:ratio>=threshold};}));
assert(contrast.length>40);assert(contrast.every(x=>x.pass),'Contrast failure');
const screenshots=fs.readdirSync(out).filter(x=>/\.(png|jpg)$/.test(x)).map(name=>{const b=fs.readFileSync(path.join(out,name));let width,height,format;
 if(b.readUInt32BE(0)===0x89504e47){width=b.readUInt32BE(16);height=b.readUInt32BE(20);format='PNG';}
 else {assert.equal(b.readUInt16BE(0),0xffd8,'Unknown screenshot format');format='JPEG';for(let i=2;i<b.length;){const marker=b[i+1],length=b.readUInt16BE(i+2);if([192,193,194].includes(marker)){width=b.readUInt16BE(i+7);height=b.readUInt16BE(i+5);break;}i+=length+2;}assert(width&&height,'Missing JPEG frame dimensions');}
 return{name,width,height,format,bytes:b.length};});
for(const width of [1440,1024,768,390,360])assert(screenshots.some(s=>s.name==='home-'+width+'.png'||s.name==='home-'+width+'.jpg'),'Missing screenshot');
fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify(contrast,null,2));
const result={status:'PASS',core_layouts:layouts.length,supplemental_layouts:read('supplemental-mobile.json').length,contrast_samples:contrast.length,min_contrast:Math.min(...contrast.map(x=>x.ratio)),screenshots,physical_device_tested:false,cwv_field_tested:false};
fs.writeFileSync(path.join(out,'visual-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,core_layouts:result.core_layouts,supplemental_layouts:result.supplemental_layouts,contrast_samples:result.contrast_samples,screenshots:screenshots.length}));
