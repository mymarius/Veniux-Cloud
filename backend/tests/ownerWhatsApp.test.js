const mockClients=[];
jest.mock('whatsapp-web.js',()=>({
 LocalAuth:class{constructor(options){this.options=options;}},
 Client:class extends require('events').EventEmitter{
  constructor(options){super();this.options=options;mockClients.push(this);this.getNumberId=jest.fn().mockResolvedValue({_serialized:'905550000000@c.us'});this.sendMessage=jest.fn().mockResolvedValue({id:{_serialized:'true_905550000000@c.us_message-id'}});this.logout=jest.fn().mockResolvedValue();this.destroy=jest.fn().mockResolvedValue();}
  initialize(){return Promise.resolve();}
 }
}));
jest.mock('qrcode',()=>({toDataURL:jest.fn().mockResolvedValue('data:image/png;base64,test-qr')}));
jest.mock('../src/config/database',()=>({query:jest.fn().mockResolvedValue({rows:[{owner_phone:'+905550000000'}]})}));
const whatsapp=require('../src/services/ownerWhatsAppService');
afterEach(async()=>{await whatsapp.shutdown();mockClients.length=0;});
test('QR and sessions are tenant-scoped and use a hidden browser',async()=>{
 whatsapp.connect(1);mockClients[0].emit('qr','secret-qr');await Promise.resolve();
 expect(whatsapp.status(1).qr).toBe('data:image/png;base64,test-qr');expect(whatsapp.status(2).qr).toBeNull();
 expect(mockClients[0].options.puppeteer.headless).toBe(true);expect(mockClients[0].options.authStrategy.options.clientId).toBe('tenant-1');
});
test('only the configured owner number receives notifications',async()=>{
 whatsapp.connect(1);mockClients[0].emit('ready');
 const result=await whatsapp.send(1,'Tamamlandı');
 expect(result).toEqual({status:'accepted',message_id:expect.stringMatching(/^wa-/)});
 expect(result.message_id).not.toContain('905550000000');
 expect(mockClients[0].getNumberId).toHaveBeenCalledWith('905550000000');expect(mockClients[0].sendMessage).toHaveBeenCalledWith('905550000000@c.us','Tamamlandı');
});
test('disconnect removes the connection and failures do not pretend delivery',async()=>{
 whatsapp.connect(1);mockClients[0].emit('ready');mockClients[0].sendMessage.mockRejectedValue(new Error('network'));
 expect(await whatsapp.send(1,'Tamamlandı')).toEqual({status:'unknown'});expect(mockClients[0].sendMessage).toHaveBeenCalledTimes(1);
 await whatsapp.disconnect(1);expect(whatsapp.status(1).status).toBe('disconnected');
});

test('paired sessions retry readiness and eventually stop waiting',async()=>{
 jest.useFakeTimers();
 try{
  whatsapp.connect(1);const client=mockClients[0];
  client.pupPage={evaluate:jest.fn().mockRejectedValue(new Error('temporary initialization failure'))};
  client.emit('authenticated');
  await jest.advanceTimersByTimeAsync(10000);
  expect(client.pupPage.evaluate).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(120000);
  expect(whatsapp.status(1).status).toBe('error');
 }finally{await whatsapp.shutdown();jest.useRealTimers();}
});

test('successful readiness cancels recovery checks',async()=>{
 jest.useFakeTimers();
 try{
  whatsapp.connect(1);const client=mockClients[0];
  client.pupPage={evaluate:jest.fn(async()=>client.emit('ready'))};
  client.emit('authenticated');await jest.advanceTimersByTimeAsync(10000);
  expect(whatsapp.status(1).status).toBe('connected');
  await jest.advanceTimersByTimeAsync(120000);
  expect(client.pupPage.evaluate).toHaveBeenCalledTimes(1);
 }finally{await whatsapp.shutdown();jest.useRealTimers();}
});
