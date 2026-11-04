const service=require('../src/services/ownerIdentity');
const originalFetch=global.fetch,originalURL=process.env.VENIUX_LICENSE_AUTHORITY_URL;
afterEach(()=>{global.fetch=originalFetch;if(originalURL===undefined)delete process.env.VENIUX_LICENSE_AUTHORITY_URL;else process.env.VENIUX_LICENSE_AUTHORITY_URL=originalURL;});
test('owner password uses the HTTPS authority without forwarding redirects',async()=>{
 process.env.VENIUX_LICENSE_AUTHORITY_URL='https://api.veniux.com/v1';global.fetch=jest.fn(async()=>({ok:true,status:200,json:async()=>({valid:true,email:service.OWNER_EMAIL})}));
 expect(await service.verify(service.OWNER_EMAIL,'fixture-password-only')).toBe(true);
 expect(String(global.fetch.mock.calls[0][0])).toBe('https://api.veniux.com/v1/owner/login');expect(global.fetch.mock.calls[0][1].redirect).toBe('error');
});
test('wrong credentials cannot fall back to the old local password',async()=>{
 process.env.VENIUX_LICENSE_AUTHORITY_URL='https://api.veniux.com/v1';global.fetch=jest.fn(async()=>({status:401,ok:false}));expect(await service.verify(service.OWNER_EMAIL,'wrong')).toBe(false);
});
test('authority outage fails closed',async()=>{
 process.env.VENIUX_LICENSE_AUTHORITY_URL='https://api.veniux.com/v1';global.fetch=jest.fn(async()=>({status:503,ok:false}));await expect(service.verify(service.OWNER_EMAIL,'fixture')).rejects.toMatchObject({status:503});
});
test('credentials are never sent to an alternate host',async()=>{
 process.env.VENIUX_LICENSE_AUTHORITY_URL='https://attacker.invalid/v1';global.fetch=jest.fn();await expect(service.verify(service.OWNER_EMAIL,'fixture')).rejects.toMatchObject({status:503});expect(global.fetch).not.toHaveBeenCalled();
});
