const https=require('https'),http=require('http'),crypto=require('crypto');
const gateway=require('../src/services/mobileGateway');
test('paired TLS transport preserves API authorization and blocks unpaired or management traffic',async()=>{
 let testPort;const create=https.createServer;const listenerMock=jest.spyOn(https,'createServer').mockImplementation((...args)=>{const server=create(...args),listen=server.listen;server.listen=function(port,host,callback){return listen.call(this,0,host,()=>{testPort=this.address().port;callback();});};return server;});
 const old={PORT:process.env.PORT,HOST:process.env.HOST,WEB:process.env.VENIUX_WEB_ACCESS};let upstream;
 try{
  process.env.HOST='127.0.0.1';delete process.env.VENIUX_WEB_ACCESS;
  upstream=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({authorization:req.headers.authorization,method:req.method,companion:gateway.isCompanion({get:name=>req.headers[name],socket:req.socket})}));});
  await new Promise(ok=>upstream.listen(0,'127.0.0.1',ok));process.env.PORT=String(upstream.address().port);
  const state=await gateway.start();expect(state.enabled).toBe(true);
  const code=state.codes[0];expect(code).toBeTruthy();const paired=JSON.parse(Buffer.from(code.slice(6),'base64url'));
  function get(path,headers={}){return new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',port:testPort,path,method:'GET',rejectUnauthorized:false,headers},res=>{const cert=res.socket.getPeerCertificate(true);expect(crypto.createHash('sha256').update(cert.raw).digest('hex')).toBe(paired.pin);let body='';res.on('data',b=>body+=b);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();});}
  expect((await get('/api/stock')).status).toBe(403);
  const headers={cookie:'veniux_companion='+paired.token,authorization:'Bearer test-business-session'};
  const valid=await get('/api/stock',headers);expect(valid.status).toBe(200);expect(JSON.parse(valid.body)).toEqual({authorization:'Bearer test-business-session',method:'GET',companion:true});
  expect((await get('/api/settings/mobile/start',headers)).status).toBe(403);
  expect((await get('/api/stock',{...headers,origin:'https://foreign.example'})).status).toBe(403);
  await gateway.stop();expect(gateway.status().enabled).toBe(false);
 }finally{await gateway.stop();listenerMock.mockRestore();if(upstream)await new Promise(ok=>upstream.close(ok));for(const [key,value] of [['PORT',old.PORT],['HOST',old.HOST],['VENIUX_WEB_ACCESS',old.WEB]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
},20000);
