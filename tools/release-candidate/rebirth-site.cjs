// Read-only checks against a deliberately started, isolated local preview.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.VENIUX_REBIRTH_URL||'http://127.0.0.1:39768';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local preview required');
(async()=>{
 const checks=[];
 const check=(name,fn)=>{fn();checks.push({name,status:'PASS'});};
 const response=await fetch(base+'/yapay-zeka');const ai=await response.text();
 check('Intelligence route, unique H1 and canonical',()=>{assert.equal(response.status,200);assert.equal((ai.match(/<h1\b/g)||[]).length,1);assert(ai.includes('rel="canonical" href="https://veniux.com/yapay-zeka"'));});
 check('AI limitations and external provider disclosure',()=>{assert(ai.includes('harici AI sağlayıcısının'));assert(ai.includes('sağlayıcıya iletilebilir'));assert(ai.includes('onay kartına'));});
 const home=await(await fetch(base+'/')).text();
 check('No fabricated telemetry, financial success or isolation guarantee',()=>{for(const text of ['&lt;12ms','SIFIR SENKRON','48.650','%100 Kiracı','Otomatik Z raporu','dış modellerle asla'])assert(!home.includes(text),text);});
 const xml=await(await fetch(base+'/sitemap.xml')).text();
 check('Intelligence discoverable in sitemap',()=>assert(xml.includes('<loc>https://veniux.com/yapay-zeka</loc>')));
 const css=fs.readFileSync('website-php/assets/premium.css','utf8');
 check('Reduced-motion fallback and no continuous decorative animation',()=>{assert(/prefers-reduced-motion\s*:\s*reduce/.test(css));assert(css.includes('animation:none!important'));assert(!css.includes('@keyframes'));assert(!css.includes('infinite'));});
 const measured=JSON.parse(fs.readFileSync('.local/editorial-design/viewport-checks.json','utf8'));
 check('54 browser-measured route / viewport combinations',()=>{for(const width of [360,390,768,1024,1440,1920])for(const route of ['/','/market-pos','/depo-yonetimi','/yapay-zeka','/fiyatlandirma','/demo','/program-indir','/giris','/kayit']){const row=measured.find(r=>r.width===width&&r.route===route);assert(row,`${route} @ ${width}`);assert(row.scroll<=row.width,`${route} overflow @ ${width}`);assert.equal(row.h1,1);}});
 const report={checks,status:'PASS',production_access:false,scope:'HTTP, source guards and saved real browser DOM measurements; not Lighthouse or physical-device certification'};
 fs.mkdirSync('.local/editorial-design',{recursive:true});fs.writeFileSync(path.join('.local/editorial-design','design-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
