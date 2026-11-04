'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {responseOk}=require('./core.cjs');
function validCallback(url,host,expectedHost,state){return host===expectedHost&&url.pathname==='/oauth/callback'&&url.searchParams.get('state')===state;}
async function authorize(file,fetcher=fetch,announce=console.log){
 if(!file||!path.isAbsolute(file))throw Error('Set absolute VENIUX_GOOGLE_OAUTH_FILE outside public/source directories');
 const resolved=fs.realpathSync(file),root=path.resolve(__dirname,'../..');
 const rel=path.relative(root,resolved);
 if(!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel)&&!rel.startsWith('.local'+path.sep))throw Error('OAuth credentials must be outside source or inside ignored .local');
 const client=JSON.parse(fs.readFileSync(resolved,'utf8')).installed;
 if(!client?.client_id?.endsWith('.apps.googleusercontent.com')||!client.client_secret)throw Error('Expected Google Desktop app OAuth JSON');
 const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('base64url');
 let server,timer,redirect;
 try{
  const code=await new Promise((resolve,reject)=>{
   server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    const u=new URL(req.url,'http://127.0.0.1');
    if(req.method!=='GET'||!validCallback(u,req.headers.host,new URL(redirect).host,state)){res.writeHead(400);res.end('Invalid OAuth callback');return;}
    if(u.searchParams.has('error')||!u.searchParams.get('code')){res.end('Authorization denied');reject(Error('Google authorization denied'));return;}
    res.end('Authorization received. You may close this page.');resolve(u.searchParams.get('code'));
   });
   server.on('error',()=>reject(Error('Could not start local OAuth callback')));
   server.listen(0,'127.0.0.1',()=>{
    redirect='http://127.0.0.1:'+server.address().port+'/oauth/callback';
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/webmasters',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',access_type:'online',prompt:'consent'}).toString();
    announce('Open in your system browser after owner authorization:\n'+url.href);
   });
   timer=setTimeout(()=>reject(Error('OAuth timeout after 10 minutes')),600000);
  });
  const r=await responseOk(fetcher,'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,client_secret:client.client_secret,redirect_uri:redirect,code,code_verifier:verifier,grant_type:'authorization_code'}).toString()});
  const token=await r.json();
  if(!token.access_token||token.token_type?.toLowerCase()!=='bearer')throw Error('Invalid OAuth token response');
  // Short interactive session only. Access/refresh tokens are never persisted or logged.
  return token.access_token;
 }finally{clearTimeout(timer);if(server){server.closeAllConnections();server.close();}}
}
module.exports={authorize,validCallback};
