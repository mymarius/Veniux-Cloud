const fs=require('fs'),path=require('path'),crypto=require('crypto'),request=require('supertest');
if(process.env.NODE_ENV!=='test'||process.env.VENIUX_HARDWARE_LAB!=='1'){
 throw Error('Hardware laboratory requires explicit isolated runner');
}else{
 const root=path.resolve(process.env.VENIUX_HARDWARE_LAB_DIR||'');
 if(!/^run-[a-f0-9]{24}$/.test(path.basename(root))||path.basename(path.dirname(root))!=='hardware-lab-runs'||path.resolve(process.env.TEST_SQLITE_PATH)!==path.join(root,'data','lab.sqlite'))throw Error('Unsafe hardware lab database');
 const app=require('../src/index'),db=require('../src/config/database'),f=require('./factories');
 let owner,wh,product,core,printer;const barcode='0001234567895';
 const post=(route,body,key=crypto.randomUUID())=>request(app).post('/api/scanner/'+route).set('Authorization','Bearer '+owner.token).set('Idempotency-Key',key).send(body);
 const lookup=raw=>post('lookup',{barcode:raw,warehouse_id:wh.id});
 const stock=async()=>Number((await db.query('SELECT SUM(quantity) q FROM stock_records WHERE tenant_id=$1 AND product_id=$2',[owner.tenantId,product.id])).rows[0].q);
 const saleBody=()=>({warehouse_id:wh.id,payment_method:'cash',cash_received:100,items:[{barcode,count:2}]});
 const receipt=async(sale,width)=>{const r=await request(app).get('/api/scanner/sales/'+sale.sale_id+'/receipt?width='+width).set('Authorization','Bearer '+owner.token);expect(r.status).toBe(200);return r.text;};
 beforeAll(async()=>{
  core=await import('../../shared/scanner.mjs');printer=await import('../../frontend/src/printing/receiptPrinter.js');
  owner=await f.createTenant();wh=await f.createWarehouse(owner.tenantId);await f.openTestShift(owner,wh.id);
  product=(await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,$3,$4,'adet',12.5,'NORMAL') RETURNING *",[owner.tenantId,crypto.randomUUID(),'Çığ Şişe Öğütülmüş Türk Kahvesi Uzun Ürün Adı '.repeat(4)+'<img src=x>',barcode])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,20)',[owner.tenantId,wh.id,product.id]);
 });
 test('LAB-E2E HID frames → actual lookup API → virtual cart; repeated scan increases quantity',async()=>{
  const cart=new Map(),q=new core.ScanQueue(async e=>{const r=await lookup(e.raw);expect(r.status).toBe(200);expect(r.body.product.id).toBe(product.id);cart.set(r.body.product.id,(cart.get(r.body.product.id)||0)+1);});
  const framer=new core.Framer(core.defaults,raw=>q.push({raw}));framer.feed(barcode+'\r'+barcode+'\r');await q.tail;framer.reset();expect(cart.get(product.id)).toBe(2);expect(await stock()).toBe(20);
  expect((await lookup('UNKNOWN-LAB')).body.product).toBeNull();expect((await lookup('')).status).toBe(400);
 });
 test('LAB-FORMATS actual lookup preserves UPC/Code128 and resolves GS1 DataMatrix GTIN',async()=>{
  for(const code of ['012345678905','CODE128-0007']){const p=(await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,$2,'Lab format',$3,'adet',1,'NORMAL') RETURNING id",[owner.tenantId,crypto.randomUUID(),code])).rows[0];const r=await lookup(code);expect(r.status).toBe(200);expect(r.body.product.id).toBe(p.id);expect(r.body.barcode).toBe(code);}
  for(const code of [']C1010'+barcode+'10LOT7',']d2010'+barcode+'10LOT7\x1d17291231']){const r=await lookup(code);expect(r.status).toBe(200);expect(r.body.product.id).toBe(product.id);expect(r.body.barcode).toBe(code);}
 });
 test('LAB-RECEIPT actual sale reduces stock once; 58/80 mm Turkish HTML, totals and change captured',async()=>{
  const before=await stock(),r=await post('sale',saleBody());expect(r.status).toBe(201);expect(r.body.total).toBe(25);expect(r.body.change).toBe(75);expect(await stock()).toBe(before-2);
  for(const width of [58,80]){const html=await receipt(r.body,width);expect(html).toContain('size:'+width+'mm');expect(html).toContain('Çığ');expect(html).toContain('&lt;img');expect(html).not.toContain('<img src=x>');expect(html).toContain('25,00 TL');expect(html).toContain('Para üstü: 75,00 TL');fs.writeFileSync(path.join(root,'receipt-'+width+'.html'),html);}
 });
 test.each([58,80])('LAB-VAT %s mm receipt exposes a VAT breakdown (required capability)',async width=>{
  const r=await post('sale',saleBody());expect(r.status).toBe(201);const html=await receipt(r.body,width);expect(html).toMatch(/KDV/);
 });
 test('LAB-PRINTER disconnected adapter cannot undo or duplicate a committed sale; retry reprints same snapshot',async()=>{
  const r=await post('sale',saleBody());expect(r.status).toBe(201);const before=await stock(),html=await receipt(r.body,80);let connected=false;const printed=[];
  printer.registerPrinterAdapter('hardware-lab',{print:async job=>{if(!connected)throw Error('Simulated printer disconnected');printed.push(job);return {status:'captured',delivery_confirmed:false};}});
  await expect(printer.printReceipt({html,width:80,saleId:r.body.sale_id,adapter:'hardware-lab'})).rejects.toThrow('disconnected');expect(await stock()).toBe(before);
  connected=true;const output=await printer.printReceipt({html,width:80,saleId:r.body.sale_id,adapter:'hardware-lab'});expect(output.delivery_confirmed).toBe(false);expect(printed[0].html).toBe(html);expect(await stock()).toBe(before);
 });
 test('LAB-RECONNECT lost response recovery uses durable operation key, status and exactly one sale',async()=>{
  const key=crypto.randomUUID(),payload=saleBody(),before=await stock();const first=await post('sale',payload,key);expect(first.status).toBe(201);
  const recovered=await request(app).get('/api/scanner/sale-status').query({operation_key:key}).set('Authorization','Bearer '+owner.token);expect(recovered.body.sale.sale_id).toBe(first.body.sale_id);
  expect((await post('sale',payload,key)).body.sale_id).toBe(first.body.sale_id);expect(await stock()).toBe(before-2);
 });
 test('LAB-OFFLINE denied external internet leaves local API operational; this is not autonomous Android offline sync',async()=>{
  await expect(fetch('https://hardware-lab.invalid/denied')).rejects.toThrow('Hardware lab blocks external network');
  const before=await stock(),result=await post('sale',saleBody());expect(result.status).toBe(201);expect(await stock()).toBe(before-2);
 });
}
