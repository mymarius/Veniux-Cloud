const soap=require('soap');
const path=require('path');
const endpoint='https://efatura.uyumsoft.com.tr/Services/Integration';
const actions={connection:'TestConnection',taxpayer:'IsEInvoiceUser',status:'QueryOutboxInvoiceStatus',pdf:'GetOutboxInvoicePdf'};
let lastProbe=null;
function status(){return {provider:'uyumsoft',endpoint,configured:Boolean(process.env.UYUMSOFT_USERNAME&&process.env.UYUMSOFT_PASSWORD),liveIssuing:false,actions:Object.keys(actions),probe:lastProbe};}
function parameters(action,data={}){
 if(!actions[action])throw Object.assign(Error('Desteklenmeyen e-belge işlemi.'),{status:400});
 if(action==='connection')return {};
 if(action==='taxpayer'){if(typeof data.vknTckn!=='string'||!/^\d{10,11}$/.test(data.vknTckn))throw Object.assign(Error('10 veya 11 haneli vergi/kimlik numarası gerekli.'),{status:400});return {vknTckn:data.vknTckn,alias:''};}
 const ids=action==='status'?data.invoiceIds:[data.invoiceId];
 if(!Array.isArray(ids)||!ids.length||ids.length>50||ids.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw Object.assign(Error('Geçerli belge UUID kimliği gerekli.'),{status:400});
 return action==='status'?{invoiceIds:{string:ids}}:{invoiceId:ids[0]};
}
async function invoke(action,data){
 const args=parameters(action,data);
 if(!status().configured)throw Object.assign(Error('Uyumsoft hesabı henüz bağlanmadı.'),{status:503});
 const started=Date.now();
 try{
 const client=await soap.createClientAsync(path.join(__dirname,'contracts/uyumsoft-read.wsdl'),{endpoint,disableCache:true,wsdl_options:{timeout:15000}});
 client.setSecurity(new soap.WSSecurity(process.env.UYUMSOFT_USERNAME,process.env.UYUMSOFT_PASSWORD,{passwordType:'PasswordText',hasTimeStamp:true}));
 const [response]=await client[actions[action]+'Async'](args,{timeout:20000});
 const result=response[actions[action]+'Result'];
 if(!result||![true,'true'].includes(result.attributes?.IsSucceded??result.IsSucceded))throw Error('provider_rejected');
 lastProbe={at:new Date().toISOString(),action,success:true,ms:Date.now()-started};
 return result;
 }catch{lastProbe={at:new Date().toISOString(),action,success:false,ms:Date.now()-started};throw Object.assign(Error('Entegratör işlemi doğrulanamadı. Bağlantı ve hesap erişimini kontrol edin.'),{status:502});}
}
module.exports={status,parameters,invoke};
