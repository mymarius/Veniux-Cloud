const gateway=require('../src/services/mobileGateway');
test('pairing ticket is private to QR, expires, and is usable only once',async()=>{
 const https=require('https'),create=https.createServer;const listenerMock=jest.spyOn(https,'createServer').mockImplementation((...args)=>{const server=create(...args),listen=server.listen;server.listen=function(port,host,callback){return listen.call(this,0,host,callback);};return server;});
 const oldPort=process.env.PORT,oldHost=process.env.HOST;process.env.PORT='17849';process.env.HOST='127.0.0.1';
 try{await gateway.start();const context={authorization:'Bearer desktop-session',device_token:'a'.repeat(64),device_fingerprint:'HW-'+ 'A'.repeat(32)};
 const state=gateway.pairing(context);const qr=JSON.parse(Buffer.from(state.codes[0].slice(6),'base64url'));
 expect(qr.authorization).toBeUndefined();expect(qr.device_token).toBeUndefined();expect(qr.ticket).toMatch(/^[a-f0-9]{64}$/);
 const req={body:{ticket:qr.ticket},socket:{remoteAddress:'127.0.0.1'},get:name=>name==='x-veniux-companion'?qr.token:''};
 expect(()=>gateway.takeTicket({...req,get:()=>''})).toThrow(/Eşleştirilmiş/);
 expect(gateway.takeTicket(req).authorization).toBe(context.authorization);expect(()=>gateway.takeTicket(req)).toThrow(/kullanılmış/);
 const fresh=JSON.parse(Buffer.from(gateway.pairing(context).codes[0].slice(6),'base64url'));req.body.ticket=fresh.ticket;
 const clock=jest.spyOn(Date,'now').mockReturnValue(Date.now()+121000);try{expect(()=>gateway.takeTicket(req)).toThrow(/süresi/);}finally{clock.mockRestore();}
 }finally{await gateway.stop();listenerMock.mockRestore();if(oldPort===undefined)delete process.env.PORT;else process.env.PORT=oldPort;if(oldHost===undefined)delete process.env.HOST;else process.env.HOST=oldHost;}
},20000);
