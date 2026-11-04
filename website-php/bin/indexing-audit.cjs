// Small, read-only diagnostic crawl. No analytics execution, forms or package bodies.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const base=(process.env.VENIUX_SEO_CHECK_URL||'https://veniux.com').replace(/\/$/,'');
const target=new URL(base);if(target.origin!=='https://veniux.com'&&target.hostname!=='127.0.0.1')throw Error('Audit target must be Veniux or isolated loopback');
const output=path.resolve(process.env.VENIUX_INDEX_AUDIT_OUTPUT||'.local/indexing-audit/live.json');fs.mkdirSync(path.dirname(output),{recursive:true});
const report={checked_at:new Date().toISOString(),base,checks:[],pages:[],redirects:[],links:[],limitations:['User-Agent probe is not a verified Googlebot IP or Search Console test.','No Google account, WAF panel, server access logs or field Core Web Vitals data accessed.']};
const check=(ok,name,detail)=>report.checks.push({name,status:ok?'PASS':'FAIL',detail});
const request=async(url,options={})=>{const start=performance.now();try{const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),...options});return {response,ms:Math.round(performance.now()-start)};}catch(e){return {error:e.cause?.code||e.message,ms:Math.round(performance.now()-start)};}};
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
(async()=>{
 const {response:map}=await request(base+'/sitemap.xml');if(!map)throw Error('Sitemap fetch failed');const xml=await map.text();fs.writeFileSync(output.replace(/\.json$/,'.xml'),xml);check(map.status===200,'sitemap status',map.status);
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));check(urls.length>0&&urls.length<=80,'bounded sitemap URL list',urls.length);if(!urls.length||urls.length>80)throw Error('Invalid sitemap bounds');
 check(new Set(urls).size===urls.length,'unique sitemap URLs',urls.length);
 const robotResult=await request(base+'/robots.txt'),robot=await robotResult.response?.text()||'';check(robotResult.response?.status===200,'robots HTTP',robotResult.response?.status);check(!/^Disallow:\s*\/\s*$/im.test(robot),'robots permits public crawl',robot);check(robot.includes('Sitemap: https://veniux.com/sitemap.xml'),'robots sitemap reference');
 const htmls=new Map(),titles=new Set(),descriptions=new Set();
 for(const canonical of urls){
  const url=new URL(canonical);check(url.origin==='https://veniux.com'&&!url.search&&!url.hash,'canonical sitemap origin/path '+url.pathname);if(url.origin!=='https://veniux.com')continue;
  const route=url.pathname;check(!/^\/(giris|kayit|indir|dosya|admin|hesap|contact-token)(\/|$)/.test(route),'private exclusion '+route);
  const {response:r,ms}=await request(base+route);if(!r){check(false,'public response '+route,'network failure');continue;}const html=await r.text();htmls.set(route,html);
  const title=html.match(/<title>(.*?)<\/title>/s)?.[1]||'',description=html.match(/name="description" content="([^"]*)"/)?.[1]||'',h1=html.match(/<h1\b[^>]*>(.*?)<\/h1>/s)?.[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||'';
  check(r.status===200,'public HTTP '+route,r.status);check(!!title&&!titles.has(title),'unique title '+route,title);titles.add(title);check(!!description&&!descriptions.has(description),'unique description '+route,description);descriptions.add(description);
  check((html.match(/<h1\b/g)||[]).length===1,'single H1 '+route,h1);check(html.includes('rel="canonical" href="'+canonical+'"'),'self canonical '+route);
  check(!/noindex|none/i.test(r.headers.get('x-robots-tag')||'')&&!/<meta[^>]+name="(?:robots|googlebot)"[^>]+content="[^"]*(?:noindex|none)/i.test(html),'index permission '+route,r.headers.get('x-robots-tag'));
  check(html.includes('name="viewport"'),'viewport '+route);check(h1.length>0&&html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g,' ').replace(/\s+/g,' ').trim().length>200,'server rendered content '+route);
  const google=await request(base+route,{headers:{'User-Agent':'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}});
  const googleHtml=await google.response?.text()||'';check(google.response?.status===200&&googleHtml.includes('<title>'+title+'</title>'),'Googlebot UA parity '+route,google.response?.status);
  report.pages.push({route,status:r.status,title,description,h1,header_response_ms:ms,html_bytes:Buffer.byteLength(html),googlebot_ua_status:google.response?.status,robots:r.headers.get('x-robots-tag'),server:r.headers.get('server'),cf_ray_present:r.headers.has('cf-ray'),challenge_header:r.headers.get('cf-mitigated')});
 }
 const destinations=new Set();
 for(const [route,html] of htmls)for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
  let url;try{url=new URL(decode(m[1]),'https://veniux.com'+route);}catch{check(false,'invalid internal href '+route);continue;}if(url.origin!=='https://veniux.com')continue;
  if(url.hash&&htmls.has(url.pathname)){let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{check(false,'invalid anchor encoding '+route);continue;}check(htmls.get(url.pathname).includes('id="'+id+'"')||htmls.get(url.pathname).includes("id='"+id+"'"),'anchor '+route+' → '+url.pathname+url.hash);}
  if(!htmls.has(url.pathname)&&!url.pathname.startsWith('/dosya/'))destinations.add(url.pathname);
 }
 for(const route of destinations){const r=await request(base+route);const status=r.response?.status;check([200,301,302,303].includes(status),'internal destination '+route,status);report.links.push({route,status});}
 for(const route of ['/giris','/kayit','/indir','/dosya/windows?surum=2.4.38','/dosya/android?surum=2.4.32','/seo-audit-missing-page']){
  const r=(await request(base+route)).response;const status=r?.status,robots=r?.headers.get('x-robots-tag'),location=r?.headers.get('location');
  check(/noindex/.test(robots||''),'private/error noindex '+route,{status,robots});
  if(route.startsWith('/dosya/'))check(status===303&&location==='/giris','download remains authenticated '+route,status);
  if(route.includes('missing-page'))check(status===404,'unknown is real 404',status);
 }
 for(const route of ['/.env','/config.php','/accounts.php','/release-archive.php']){const r=(await request(base+route,{method:'HEAD'})).response;check([403,404].includes(r?.status),'private source protected '+route,r?.status);}
 for(const route of ['/index.php','/stok-yonetimi/'])for(const method of ['GET','HEAD']){const r=(await request(base+route,{method})).response;check(r?.status===301,'alias redirect '+method+' '+route,{status:r?.status,location:r?.headers.get('location')});}
 if(target.hostname!=='127.0.0.1')for(const start of ['http://veniux.com/','http://www.veniux.com/','https://www.veniux.com/']){let url=start,chain=[];for(let n=0;n<4;n++){const r=await request(url);if(!r.response){chain.push({url,error:r.error});break;}chain.push({url,status:r.response.status});const location=r.response.headers.get('location');if(![301,302,303,307,308].includes(r.response.status)||!location)break;url=new URL(location,url).href;}check(url==='https://veniux.com/'&&chain.at(-1)?.status===200,'HTTPS canonical redirect '+start,chain);report.redirects.push({start,chain});}
 report.summary={pass:report.checks.filter(c=>c.status==='PASS').length,fail:report.checks.filter(c=>c.status==='FAIL').length,pages:report.pages.length};fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report.summary,failures:report.checks.filter(c=>c.status==='FAIL')},null,2));if(report.summary.fail)process.exitCode=1;
})().catch(e=>{report.fatal=e.message;fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(e.message);process.exitCode=1;});
