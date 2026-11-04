'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const c=require('./core.cjs'),{validCallback}=require('./oauth.cjs');
test('OAuth installed-client flow uses loopback, state and PKCE; token stays in memory',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
 const file=path.join(os.tmpdir(),'veniux-synthetic-oauth-'+crypto.randomBytes(8).toString('hex')+'.json');
 fs.writeFileSync(file,JSON.stringify({installed:{client_id:'synthetic.apps.googleusercontent.com',client_secret:'synthetic-only'}}));
 let auth,callback;
 try{
  const token=await require('./oauth.cjs').authorize(file,async(url,options)=>{
   assert.equal(url,'https://oauth2.googleapis.com/token');const b=new URLSearchParams(options.body);
   assert.equal(crypto.createHash('sha256').update(b.get('code_verifier')).digest('base64url'),auth.searchParams.get('code_challenge'));
   assert.equal(b.get('code'),'synthetic-code');return Response.json({access_token:'synthetic-memory-token',token_type:'Bearer'});
  },message=>{
   auth=new URL(message.split('\n')[1]);assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
   callback=new URL(auth.searchParams.get('redirect_uri'));assert.equal(callback.hostname,'127.0.0.1');
   callback.search=new URLSearchParams({code:'synthetic-code',state:auth.searchParams.get('state')}).toString();
   fetch(callback).catch(()=>{});
  });
  assert.equal(token,'synthetic-memory-token');
 }finally{fs.unlinkSync(file);}
});
test('canonical excludes credentials, private routes, queries, fragments and foreign origins',()=>{
 for(const url of ['https://evil.test/','https://u:p@veniux.com/','https://veniux.com/dosya/windows','https://veniux.com/admin/x','https://veniux.com/?x=1','https://veniux.com/#x','http://veniux.com/'])assert.throws(()=>c.canonical(url));
 assert.equal(c.canonical('https://veniux.com/stok-yonetimi'),'https://veniux.com/stok-yonetimi');
});
test('sitemap rejects duplicates and private URLs',()=>{
 assert.throws(()=>c.urlsFromXml('<loc>https://veniux.com/</loc><loc>https://veniux.com/</loc>'));
 assert.throws(()=>c.urlsFromXml('<loc>https://veniux.com/giris</loc>'));
 assert.deepEqual(c.urlsFromXml('<loc>https://veniux.com/</loc>'),['https://veniux.com/']);
});
test('CSRF and nonce churn does not trigger editorial changes',()=>{
 assert.equal(c.fingerprint('<main><p>Stock</p><form><input value="a"></form></main>'),c.fingerprint('<main><p>Stock</p><form><input value="b"></form></main>'));
 assert.notEqual(c.fingerprint('<main>A</main>'),c.fingerprint('<main>B</main>'));
 assert.throws(()=>c.fingerprint('<p>No main</p>'));
});
test('first observation and unchanged pages send nothing; acknowledged changes deduplicate; reverted changes notify',()=>{
 const pages=[{url:c.ORIGIN+'/',hash:'b'}],baseline={[c.ORIGIN+'/']:'a'};
 assert.deepEqual(c.changedPages(null,pages),[]);
 assert.deepEqual(c.changedPages(baseline,pages),[c.ORIGIN+'/']);
 assert.deepEqual(c.changedPages(baseline,pages,{[c.ORIGIN+'/']:'b'}),[]);
 assert.deepEqual(c.changedPages(baseline,[{url:c.ORIGIN+'/',hash:'a'}],{[c.ORIGIN+'/']:'b'}),[c.ORIGIN+'/']);
});
test('unchanged sitemap never resubmits after acceptance, failures have 24h backoff',()=>{
 assert.equal(c.due({acceptedHash:'a'},'a',1e9),false);
 assert.equal(c.due({attemptHash:'a',attemptAt:100},'a',1000),false);
 assert.equal(c.due({attemptHash:'a',attemptAt:100},'a',86400101),true);
 assert.equal(c.due({acceptedHash:'a'},'b'),true);
});
test('OAuth callback rejects CSRF, wrong host and wrong path',()=>{
 const url=new URL('http://127.0.0.1:1234/oauth/callback?state=ok&code=test');
 assert.equal(validCallback(url,'127.0.0.1:1234','127.0.0.1:1234','ok'),true);
 assert.equal(validCallback(url,'evil.test','127.0.0.1:1234','ok'),false);
 assert.equal(validCallback(url,'127.0.0.1:1234','127.0.0.1:1234','bad'),false);
 assert.equal(validCallback(new URL('http://127.0.0.1:1234/?state=ok'),'127.0.0.1:1234','127.0.0.1:1234','ok'),false);
});
test('sitemap uses official PUT and no request body; acceptance is separate from indexing',async()=>{
 let seen;await c.submitSitemap(async(url,opts)=>{seen={url,opts};return new Response(null,{status:204});},'synthetic-token','sc-domain:veniux.com');
 assert.equal(seen.opts.method,'PUT');assert.equal(seen.opts.body,undefined);assert.match(seen.url,/^https:\/\/www.googleapis.com\/webmasters\/v3\/sites\/sc-domain%3Aveniux.com\/sitemaps\//);
 await assert.rejects(()=>c.submitSitemap(fetch,'x','sc-domain:evil.test'));
});
test('inspection preserves actual reasons, canonical, last crawl; absent data stays unknown',async()=>{
 let seen;const row=await c.inspect(async(url,opts)=>{seen={url,opts};return Response.json({inspectionResult:{indexStatusResult:{verdict:'NEUTRAL',coverageState:'Crawled - currently not indexed',lastCrawlTime:'2026-10-01T00:00:00Z',googleCanonical:c.ORIGIN+'/'}}});},'synthetic','sc-domain:veniux.com',c.ORIGIN+'/');
 assert.equal(row.status,'NOT_INDEXED');assert.equal(row.googleCanonical,c.ORIGIN+'/');assert.equal(row.reason,'Crawled - currently not indexed');assert.equal(JSON.parse(seen.opts.body).inspectionUrl,c.ORIGIN+'/');
 assert.equal(c.inspectionRow(c.ORIGIN+'/',{}).status,'UNKNOWN');
 assert.equal(c.inspectionRow(c.ORIGIN+'/',{inspectionResult:{indexStatusResult:{verdict:'PASS'}}}).status,'INDEXED');
});
test('HTTP auth/rate/server errors fail without logging token or response body',async()=>{
 for(const status of [401,403,429,500])await assert.rejects(()=>c.submitSitemap(async()=>new Response('secret server detail',{status}),'secret','sc-domain:veniux.com'),new RegExp('Remote HTTP '+status));
});
test('existing Google sitemap is read before deciding; never resubmitted even without local history',async()=>{
 let calls=[];const state=await c.ensureSitemap(async(url,options)=>{calls.push(options.method);return Response.json({path:c.ORIGIN+'/sitemap.xml',lastSubmitted:'2026-10-01T00:00:00Z',isPending:true,errors:'0'});},'synthetic','sc-domain:veniux.com','digest');
 assert.deepEqual(calls,['GET']);assert.equal(state.status,'ALREADY_PRESENT — NOT_RESUBMITTED');assert.equal(state.remote.isPending,true);
});
test('confirmed Google sitemap absence submits once and persists attempt before PUT',async()=>{
 let calls=[],saved=false;
 const state=await c.ensureSitemap(async(url,options)=>{calls.push(options.method);if(options.method==='GET')return new Response(null,{status:404});assert.equal(saved,true);return new Response(null,{status:204});},'synthetic','sc-domain:veniux.com','digest',{},()=>{saved=true;});
 assert.deepEqual(calls,['GET','PUT']);assert.equal(state.status,'SUBMISSION_ACCEPTED HTTP 204');
});
test('sitemap lookup permission/rate/server failures never cause submission',async()=>{
 for(const code of [401,403,429,500]){
  let calls=[];await assert.rejects(()=>c.ensureSitemap(async(url,options)=>{calls.push(options.method);return new Response(null,{status:code});},'synthetic','sc-domain:veniux.com','digest'),new RegExp('Sitemap lookup HTTP '+code));assert.deepEqual(calls,['GET']);
 }
});
test('manual priorities use real non-indexed results only and flag canonical or technical blockers',()=>{
 const rows=[{url:c.ORIGIN+'/',status:'NOT_INDEXED'},{url:c.ORIGIN+'/stok-yonetimi',status:'INDEXED'},{url:c.ORIGIN+'/depo-yonetimi',status:'UNKNOWN'},{url:c.ORIGIN+'/lot-miat-takibi',status:'NOT_INDEXED',robotsTxtState:'DISALLOWED',indexingState:'BLOCKED_BY_META_TAG'},{url:c.ORIGIN+'/cerez-politikasi',status:'NOT_INDEXED',googleCanonical:c.ORIGIN+'/'}];
 const priorities=c.manualCandidates(rows);assert.equal(priorities.length,3);assert.equal(priorities[0].priority,1);assert.match(priorities[1].action,/technical block/);assert.match(priorities[2].action,/canonical mismatch/);
});
test('absent sitemap backoff avoids duplicate PUT; malformed records also fail closed',async()=>{
 let calls=[];const state=await c.ensureSitemap(async(url,options)=>{calls.push(options.method);return new Response(null,{status:404});},'synthetic','sc-domain:veniux.com','digest',{attemptHash:'digest',attemptAt:Date.now()});
 assert.deepEqual(calls,['GET']);assert.equal(state.status,'ABSENT — RETRY_BACKOFF');
 await assert.rejects(()=>c.ensureSitemap(async()=>Response.json({path:'https://evil.test/'}),'synthetic','sc-domain:veniux.com','digest'));
});
test('IndexNow requires matching hosted key, sends only caller changed canonical list; 202 is pending not indexed',async()=>{
 const key='a'.repeat(64),urls=[c.ORIGIN+'/stok-yonetimi'];let calls=[];
 const result=await c.indexNow(async(url,opts)=>{calls.push({url,opts});return calls.length===1?new Response(key):new Response(null,{status:202});},key,urls);
 assert.equal(result.status,'KEY_VALIDATION_PENDING');assert.equal(result.indexed,false);assert.deepEqual(JSON.parse(calls[1].opts.body).urlList,urls);assert.equal(calls.length,2);
 let called=0;await assert.rejects(()=>c.indexNow(async()=>{called++;return new Response('wrong');},key,urls));assert.equal(called,1);
 await assert.rejects(()=>c.indexNow(fetch,key,[c.ORIGIN+'/giris']));
});
test('PHP ownership proof is opt-in, exact-path only, GET/HEAD only and outside sitemap',()=>{
 const {execFileSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
 const root=path.resolve(__dirname,'../..'),dir=path.join(root,'.local/index-submission/route-test'),key='b'.repeat(64);
 const invoke=(method,request,keyValue)=>execFileSync(process.env.VENIUX_PHP||'C:/xampp/php/php.exe',['-r',"$_SERVER['REQUEST_URI']=getenv('TEST_ROUTE');$_SERVER['REQUEST_METHOD']=getenv('TEST_METHOD');$_SERVER['REMOTE_ADDR']='127.0.0.1';register_shutdown_function(function(){echo '\\nSTATUS:'.http_response_code();});require 'website-php/index.php';"],{cwd:root,encoding:'utf8',env:{...process.env,VENIUX_CONTACT_NOTIFY:'0',VENIUX_CONTACT_STORAGE:path.join(dir,'contact'),VENIUX_INDEXNOW_KEY:keyValue,TEST_ROUTE:request,TEST_METHOD:method}});
 const get=invoke('GET','/'+key+'.txt',key);assert.ok(get.startsWith(key));assert.ok(!get.includes('<html'));
 assert.equal(invoke('HEAD','/'+key+'.txt',key).trim(),'\\nSTATUS:');
 assert.equal(invoke('POST','/'+key+'.txt',key).trim(),'\\nSTATUS:405');
 assert.match(invoke('GET','/'+key+'.txt',''),/STATUS:404$/);
 assert.match(invoke('GET','/'+('c'.repeat(64))+'.txt',key),/STATUS:404$/);
 assert.ok(!invoke('GET','/sitemap.xml',key).includes(key));
});
