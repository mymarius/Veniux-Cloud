const soap=require('soap');
const path=require('path');
test('indirilen resmi sözleşmeden sorgu istemcisi gerçekten oluşturulur',async()=>{const c=await soap.createClientAsync(path.join(__dirname,'../src/integrations/contracts/uyumsoft-read.wsdl'));for(const method of ['TestConnection','IsEInvoiceUser','QueryOutboxInvoiceStatus','GetOutboxInvoicePdf'])expect(typeof c[method+'Async']).toBe('function');});
