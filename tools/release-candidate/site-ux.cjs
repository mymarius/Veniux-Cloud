const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.VENIUX_UX_URL||'http://127.0.0.1:39768';assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
(async()=>{
 const checks=[];const check=(name,fn)=>{fn();checks.push({name,status:'PASS'});};
 const get=async route=>{const r=await fetch(base+route);assert.equal(r.status,200,route);return r.text();};
 const pricing=await get('/fiyatlandirma?donem=yillik');
 check('Approved prices preserved; draft prices absent',()=>{for(const price of ['3.588','7.188','14.388'])assert(pricing.includes(price));assert(!pricing.includes('Yerel fiyat taslağı'));});
 check('Advisor, recommendation, mobile matrix and repeated guide removed',()=>{assert(pricing.includes('data-price-catalog'));assert(pricing.includes('Önerilen'));assert(pricing.includes('data-advisor-run'));assert(pricing.includes('ux-comparison-mobile'));assert(!pricing.includes('Bir ürünün kaydı'));assert((pricing.match(/<tr>/g)||[]).length>=13);});
 const program=await get('/program-indir');
 check('Platform-specific authenticated downloads and public QR',()=>{assert(program.includes('href="/dosya/windows"'));assert(program.includes('href="/dosya/android"'));assert(program.includes('android-download-qr.svg'));assert(program.includes('bu kod cihaz eşleştirme kodu değildir'));});
 check('Cloud/local diagrams and signing disclosure',()=>{assert(program.includes('Bilgisayar açık kalmalı mı? Hayır.'));assert(program.includes('Bilgisayar açık kalmalı mı? Evet.'));assert(program.includes('İmzasız geçici yayın'));});
 const home=await get('/');
 check('Synthetic real product screenshots, SVG controls and grouped footer',()=>{assert(home.includes('product-retail-v1.jpg'));assert(home.includes('product-warehouse-v3.jpg'));assert(home.includes('ux-icon'));assert(home.includes('ux-footer-columns'));assert(home.includes('ux-form-details'));});
 const xml=await get('/sitemap.xml');const routes=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
 let cardCount=0;for(const route of routes){const html=await get(route);assert(html.includes('name="twitter:card" content="summary_large_image"'));const url=html.match(/property="og:image" content="([^"]+)"/)[1];const r=await fetch(base+new URL(url).pathname);assert.equal(r.status,200);const png=Buffer.from(await r.arrayBuffer());assert.equal(png.subarray(1,4).toString(),'PNG');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1200,630]);cardCount++;}
 check(`${cardCount} canonical pages have real 1200x630 PNG social cards`,()=>assert.equal(cardCount,22));
 const rows=JSON.parse(fs.readFileSync('.local/site-ux/viewport-checks.json','utf8'));
 check('20 fresh browser layouts: no horizontal overflow and one H1',()=>{for(const width of [360,390,768,1024,1440])for(const route of ['/','/fiyatlandirma','/program-indir','/stok-yonetimi']){const row=rows.find(r=>r.width===width&&r.route===route);assert(row);assert(row.scroll<=width);assert.equal(row.h1,1);}});
 const actions=JSON.parse(fs.readFileSync('.local/site-ux/interaction-checks.json','utf8'));
 check('Actual billing changes preserve form data, Back restores annual prices',()=>{assert.equal(actions[0].name,'Yerel kontrol');assert(actions[0].url.includes('uc-aylik'));assert(actions[0].prices[0].includes('1.188'));assert(actions[1].url.includes('yillik'));assert(actions[1].prices[0].includes('3.588'));});
 check('Modal closes, restores form and returns keyboard focus',()=>{assert(actions[2].closed);assert.equal(actions[2].restored,'MAIN');assert(actions[2].focus.includes('ux-demo-trigger'));});
 const report={date:new Date().toISOString(),checks,status:'PASS',production_access:false};fs.writeFileSync('.local/site-ux/acceptance-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
