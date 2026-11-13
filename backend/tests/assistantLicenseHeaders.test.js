jest.mock('../src/services/nvidiaAIService',()=>({complete:jest.fn()}));
const system=require('../src/services/assistantSystemOperations');
const {createTenant}=require('./factories');
// Bulutta merkezi lisans kapısı asistanın iç isteğini de denetler; cihaz lisans başlıkları aktarılmazsa
// lisanslı cihazdaki kullanıcı "lisans etkinleştirilmemiş" hatası alır.
const env={...process.env},fetchBefore=global.fetch;
let a,user;
beforeAll(async()=>{a=await createTenant();user={...a,role:'admin',moduleType:'BOTH'};});
afterEach(()=>{process.env={...env};global.fetch=fetchBefore;});
test('device license headers reach the central gate on assistant reads',async()=>{
 process.env.VENIUX_LICENSE_AUTHORITY_URL='https://api.veniux.com/v1';
 global.fetch=jest.fn(async()=>({ok:false,status:403}));
 const auth={authorization:'Bearer '+a.token};
 await expect(system.read(user,{operation:'suppliers:GET:/'},{headers:auth})).rejects.toMatchObject({status:423});
 // Başlıklar aktarılınca kapı lisans merkezine sorar (merkez yapılandırılmadığı için doğrulama başarısız olur); "etkinleştirilmemiş" denmez.
 await expect(system.read(user,{operation:'suppliers:GET:/'},{headers:{...auth,'x-veniux-device-token':'a'.repeat(64),'x-device-id':'HW-'+'B'.repeat(32)}})).rejects.not.toMatchObject({status:423});
});
test('malformed device headers are not forwarded',async()=>{
 process.env.VENIUX_LICENSE_AUTHORITY_URL='https://api.veniux.com/v1';
 global.fetch=jest.fn();
 await expect(system.read(user,{operation:'suppliers:GET:/'},{headers:{authorization:'Bearer '+a.token,'x-veniux-device-token':'zz'}})).rejects.toMatchObject({status:423});
 expect(global.fetch).not.toHaveBeenCalled();
});
