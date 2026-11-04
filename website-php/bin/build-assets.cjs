const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'assets');
const {transform}=require('../../frontend/node_modules/lightningcss');
const groups={main:['site.css','legal.css','motion.css','guide.css'],program:['site.css','legal.css','motion.css','guide.css','program.css','terminal-guide.css'],pricing:['site.css','legal.css','motion.css','guide.css','pricing.css'],notes:['site.css','legal.css','motion.css','guide.css','release-notes.css'],accounts:['site.css','legal.css','accounts.css','terminal-guide.css']};
(async()=>{
 const manifest={};
 for(const [name,files] of Object.entries(groups)){
  const code=Buffer.from([...files,'precision.css','brand-design.css','hosting-sponsor.css','cookie-consent.css'].map(file=>fs.readFileSync(path.join(assets,file),'utf8')).join('\n'));
  const result=transform({filename:name+'.css',code,minify:true}).code;
  const filename=name+'.'+crypto.createHash('sha256').update(result).digest('hex').slice(0,12)+'.css';
  fs.writeFileSync(path.join(assets,filename),result);manifest[name]=filename;
 }
 const {rolldown}=await import('../../frontend/node_modules/rolldown/dist/index.mjs');
 const bundle=await rolldown({input:path.join(assets,'site.js')});
 const {output}=await bundle.generate({format:'iife',minify:true});await bundle.close();
 const code=output.find(item=>item.type==='chunk').code;
 const name='site.'+crypto.createHash('sha256').update(code).digest('hex').slice(0,12)+'.js';
 fs.writeFileSync(path.join(assets,name),code);manifest.script=name;
 const consentBundle=await rolldown({input:path.join(assets,'cookie-consent.mjs')});
 const consentOutput=await consentBundle.generate({format:'iife',minify:true});await consentBundle.close();
 const consentCode=consentOutput.output.find(item=>item.type==='chunk').code;
 const consentName='consent.'+crypto.createHash('sha256').update(consentCode).digest('hex').slice(0,12)+'.js';
 fs.writeFileSync(path.join(assets,consentName),consentCode);manifest.consent=consentName;
 fs.writeFileSync(path.join(root,'asset-manifest.php'),'<?php\nreturn '+JSON.stringify(manifest).replace(/\{/,'[').replace(/\}$/ ,']').replace(/"([^"\n]+)":/g,'"$1"=>')+';\n');
 console.log(JSON.stringify(manifest));
})();
