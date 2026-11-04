// Read-only acceptance checks against an isolated local Afterdark preview.
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.VENIUX_AFTERDARK_URL||'http://127.0.0.1:39769';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Local preview required');
(async()=>{
 const checks=[];const check=(name,fn)=>{fn();checks.push({name,status:'PASS'});};
 const home=await(await fetch(base+'/')).text();
 check('Real product assets, headline and explicit synthetic data',()=>{assert(home.includes('İşletmeni yönetme.'));for(const asset of ['product-retail-v1.jpg','product-warehouse-v3.jpg','product-stock-v1.jpg'])assert(home.includes(asset));assert(home.includes('AI yanıtı değildir'));});
 const ai=await(await fetch(base+'/yapay-zeka')).text();
 check('AI scope, confirmation and provider disclosure',()=>{for(const text of ['sağlayıcıya iletilebilir','onay kartına','İşletmeler arası veri erişimi'])assert(ai.includes(text));});
 for(const [family,period,prices] of [['retail','monthly',['1.490','2.990','5.990']],['retail','annual',['15.198','30.498','61.098']],['warehouse','monthly',['2.490','4.990','Özel teklif']],['warehouse','annual',['25.398','50.898']],['unified','monthly',['6.490']],['unified','annual',['66.198']]]){
  const response=await fetch(base+`/fiyatlandirma?aile=${family}&donem=${period}`);const html=await response.text();
  check(`${family} ${period}: draft disclosure, exact prices, single H1`,()=>{assert.equal(response.status,200);assert.equal((html.match(/<h1\b/g)||[]).length,1);for(const price of prices)assert(html.includes(price));assert(html.includes('Yalnızca yerel fiyat taslağı'));assert(html.includes('KDV hariç'));assert(html.includes('AI: Kota ve sağlayıcı kapsamı teklifte belirlenir.'));});
 }
 const css=fs.readFileSync('website-php/assets/premium.css','utf8');
 check('Bounded motion and reduced-motion fallback',()=>{assert(css.includes('prefers-reduced-motion:no-preference'));assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('animation:none!important'));assert(!css.includes('infinite'));});
 const measured=JSON.parse(fs.readFileSync('.local/afterdark/viewport-checks.json','utf8'));
 check('54 actual browser measurements: no horizontal overflow, one H1',()=>{for(const width of [360,390,768,1024,1440,1920])for(const route of ['/','/market-pos','/depo-yonetimi','/yapay-zeka','/fiyatlandirma','/demo','/program-indir','/giris','/kayit']){const row=measured.find(r=>r.width===width&&r.route===route);assert(row,`${route} @ ${width}`);assert(row.scroll<=width,`${route}: overflow`);assert.equal(row.h1,1);}});
 const report={date:new Date().toISOString(),checks,status:'PASS',production_access:false,scope:'Local HTTP, source guards and browser DOM measurements; not Core Web Vitals certification'};
 fs.writeFileSync('.local/afterdark/design-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
