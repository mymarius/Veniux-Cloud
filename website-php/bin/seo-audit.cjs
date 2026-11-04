// Read-only audit. Never follows account, API, download or external links.
const fs=require('fs'),path=require('path');
const base=process.env.VENIUX_SEO_CHECK_URL||'https://veniux.com';
const errors=[],warnings=[],pages=[];const titles=new Set(),descriptions=new Set(),htmlByRoute=new Map();
function check(ok,message){if(!ok)errors.push(message)}
async function get(url){return fetch(url,{signal:AbortSignal.timeout(20000),redirect:'manual'})}
(async()=>{
 const r=await get(base+'/sitemap.xml');check(r.status===200,'Sitemap HTTP');const xml=await r.text();
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);check(urls.length>0,'Empty sitemap');check(new Set(urls).size===urls.length,'Duplicate sitemap URLs');
 const robots=await get(base+'/robots.txt');check(robots.status===200,'Robots HTTP');const rules=await robots.text();check(!/^Disallow:\s*\/\s*$/m.test(rules),'Public crawl blocked');check(rules.includes('/sitemap.xml'),'Missing sitemap reference');
 for(const canonical of urls){
  const route=new URL(canonical).pathname;check(!/\/(giris|kayit|indir|dosya|contact-token)\b/.test(route),'Private sitemap URL '+route);
  const response=await get(base+route);check(response.status===200,route+' HTTP '+response.status);const html=await response.text();htmlByRoute.set(route,html);
  const title=html.match(/<title>([^<]*)<\/title>/)?.[1]||'';const description=html.match(/name="description" content="([^"]*)"/)?.[1]||'';
  check(!!title&&!titles.has(title),route+' missing/duplicate title');titles.add(title);
  check(!!description&&!descriptions.has(description),route+' missing/duplicate description');descriptions.add(description);
  check((html.match(/<h1\b/g)||[]).length===1,route+' H1 count');check(html.includes('rel="canonical" href="'+canonical+'"'),route+' canonical');
  check(response.headers.get('x-robots-tag')==='index, follow',route+' indexability');check(!/name="robots" content="noindex/.test(html),route+' meta noindex');
  check(html.includes('og:url" content="'+canonical+'"'),route+' social URL');check(html.includes('twitter:image:alt'),route+' social image alt');
  let graph;try{graph=JSON.parse(html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)?.[1])[ '@graph' ]}catch{}
  check(Array.isArray(graph)&&graph.some(n=>n['@type']==='WebPage'&&n.url===canonical),route+' schema');
  if(route!=='/')check(graph?.some(n=>n['@type']==='BreadcrumbList'),route+' breadcrumbs');
  for(const img of html.matchAll(/<img\b[^>]*>/g))check(/\balt="[^"]+"/.test(img[0])||/aria-hidden="true"/.test(img[0]),route+' image alt');
  if(title.length>75)warnings.push(route+' long title; inspect search preview');
  pages.push({route,status:response.status,title,description});
 }
 const known=new Set(urls.map(u=>new URL(u).pathname));
 for(const p of pages){const html=htmlByRoute.get(p.route);for(const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)){
  const url=new URL(m[1].replaceAll('&amp;','&'),new URL(p.route,base));if(url.origin!==new URL(base).origin)continue;
  const route=url.pathname;
  if(!known.has(route)&&!['/giris','/kayit','/indir','/dosya/windows','/dosya/android'].includes(route)&&!route.startsWith('/assets/'))warnings.push(p.route+' unregistered internal link '+route);
  if(url.hash&&htmlByRoute.has(route)){const id=decodeURIComponent(url.hash.slice(1));const target=htmlByRoute.get(route);check(target.includes('id="'+id+'"')||target.includes("id='"+id+"'"),p.route+' broken anchor '+route+url.hash);}
 }}
 for(const route of ['/giris','/kayit','/seo-unknown-audit']){const r=await get(base+route);check(r.headers.get('x-robots-tag')==='noindex, nofollow'||([301,302,303].includes(r.status)&&r.headers.get('location')==='https://veniux.com'+route),route+' private/error indexing');if(route.includes('unknown'))check(r.status===404,'Unknown URL must return 404')}
 const report={checkedAt:new Date().toISOString(),base,pages,errors,warnings:[...new Set(warnings)]};
 const dest=path.resolve(__dirname,'../../.local/seo-audit.json');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2));
 console.log(JSON.stringify({pages:pages.length,errors,warnings:report.warnings,report:dest},null,2));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});

