const service=require('../src/services/ownerSmsService');
const originalFetch=global.fetch;
beforeEach(()=>{process.env.NETGSM_USERCODE='test-user';process.env.NETGSM_PASSWORD='test-password';process.env.NETGSM_MSGHEADER='VENIUX';});
afterEach(()=>{global.fetch=originalFetch;delete process.env.NETGSM_USERCODE;delete process.env.NETGSM_PASSWORD;delete process.env.NETGSM_MSGHEADER;});
test('sends only to the owner mobile and reports provider acceptance, not delivery',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,text:async()=> '00 123456'});
 expect(await service.send('05551234567','Tamamlandı <&>')).toEqual({status:'accepted',job_id:'123456'});
 const [url,request]=global.fetch.mock.calls[0];expect(url).toBe('https://api.netgsm.com.tr/sms/send/xml');expect(request.body).toContain('<no>905551234567</no>');expect(request.body).toContain('<msg><![CDATA[Tamamlandı <&>]]></msg>');expect(request.body).toContain('<filter>0</filter><encoding>TR</encoding>');expect(request.headers['Content-Type']).toBe('text/xml; charset=UTF-8');
});
test('uncertain failures are not automatically resent',async()=>{
 global.fetch=jest.fn().mockRejectedValue(new Error('timeout'));
 expect(await service.send('05551234567','Tamamlandı')).toEqual({status:'unknown'});expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('missing configuration never pretends to send SMS',async()=>{
 delete process.env.NETGSM_PASSWORD;global.fetch=jest.fn();expect(await service.send('05551234567','Tamamlandı')).toEqual({status:'not_configured'});expect(global.fetch).not.toHaveBeenCalled();
});

test("ileti XML'i bozamaz; Netgsm hata kodu anlaşılır nedene çevrilir",async()=>{
 const xml=service.request('905551234567','a]]><x>b');
 expect(xml).toContain('<msg><![CDATA[a]]]]><![CDATA[><x>b]]></msg>');
 global.fetch=jest.fn().mockResolvedValue({ok:true,text:async()=>'40'});
 expect(await service.send('05551234567','x')).toEqual({status:'rejected',code:'40',detail:service.ERRORS['40']});
 global.fetch=jest.fn().mockResolvedValue({ok:true,text:async()=>'01 777'});
 expect(await service.send('05551234567','x')).toEqual({status:'accepted',job_id:'777'});
});
