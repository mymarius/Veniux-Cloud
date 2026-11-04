const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const base=process.env.VENIUX_SEO_CHECK_URL||'http://127.0.0.1:39234';
(async()=>{
 const sitemap=await(await fetch(base+'/sitemap.xml')).text();const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 for(const route of ['/depo-yonetimi','/lot-miat-takibi','/barkodlu-stok-takibi','/son-kullanma-tarihi-takibi','/el-terminali-depo-yonetimi']){
  assert(urls.includes('https://veniux.com'+route));const r=await fetch(base+route),html=await r.text();assert.equal(r.status,200);assert.equal((html.match(/<h1\b/g)||[]).length,1);assert(html.includes('request_type=demo'));assert(html.includes('request_type=quote'));
  const image=html.match(/<img\b[^>]*src="(\/assets\/product-[^"]+)"[^>]*>/);assert(image,route+' real screenshot');assert(html.includes('sentetik')||html.includes('sentetik'.toUpperCase()));
  const response=await fetch(base+image[1]);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());let size;for(let offset=2;offset<bytes.length;){const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);if([192,193,194].includes(marker)){size=[bytes.readUInt16BE(offset+7),bytes.readUInt16BE(offset+5)];break;}offset+=length+2;}const declared=[Number(image[0].match(/width="(\d+)"/)[1]),Number(image[0].match(/height="(\d+)"/)[1])];assert.deepEqual(size,declared);assert(size[0]>=1200&&size[1]>=750,'Real readable screenshot dimensions');assert(html.includes('property="og:image:width" content="'+size[0]+'"'));
  assert(html.includes('content="image/jpeg"'));assert(html.includes('name="twitter:card" content="summary_large_image"'));
  console.log('PASS focused content, screenshot, metadata and CTA '+route);
 }
 for(const route of ['/giris','/kayit']){const r=await fetch(base+route);assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'noindex, nofollow');}
 for(const route of ['/indir','/dosya/windows','/dosya/android']){const r=await fetch(base+route,{redirect:'manual'});assert([302,303].includes(r.status),route+' unauthorized download guard');}
 const unknown=await fetch(base+'/growth-does-not-exist');assert.equal(unknown.status,404);assert.equal(unknown.headers.get('x-robots-tag'),'noindex, nofollow');
 console.log('PASS accounts/download gates preserved, private noindex and real404; sitemap '+urls.length+' URLs');
})().catch(e=>{console.error(e.message);process.exitCode=1});
