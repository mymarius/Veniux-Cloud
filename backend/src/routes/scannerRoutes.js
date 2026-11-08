const router=require('express').Router(),db=require('../config/database');
const {authMiddleware,requireRole}=require('../middlewares/authMiddleware');
const service=require('../services/scannerService');
router.use(authMiddleware);
const pro=require('../services/retailProService'),credit=require('../services/retailCreditService'),external=require('../services/retailExternalService');
const action=fn=>async(req,res,next)=>{try{res.json(await fn(req));}catch(e){next(e);}};
const promo=require('../services/retailPromoService');
router.get('/pro/campaigns',requireRole('admin','manager'),action(req=>promo.list(req.user)));
router.post('/pro/campaigns',requireRole('admin','manager'),action(req=>promo.create(req.user,req.body||{})));
router.put('/pro/campaigns/:id/active',requireRole('admin','manager'),action(req=>promo.setActive(req.user,req.params.id,req.body?.active===true)));
router.get('/pro/loyalty/cards',requireRole('admin','manager'),action(req=>promo.cards(req.user)));
router.post('/pro/loyalty/cards',requireRole('admin','manager'),action(req=>promo.createCard(req.user,req.body||{})));
router.get('/pro/loyalty/cards/:no',requireRole('admin','manager','cashier'),action(req=>promo.lookup(req.user,req.params.no)));
router.get('/pro/insights',requireRole('admin','manager'),action(req=>require('../services/retailInsightsService').insights(req.user,req.query||{})));
router.get('/pro/categories',requireRole('admin','manager','cashier'),action(req=>pro.categories(req.user)));
router.get('/pro/catalog',requireRole('admin','manager','cashier'),action(req=>pro.catalog(req.user,req.query)));
router.get('/pro/preferences',requireRole('admin','manager','cashier'),action(req=>pro.preferences(req.user)));
router.put('/pro/preferences',requireRole('admin','manager','cashier'),action(req=>pro.save(req.user,req.body)));
router.get('/pro/products/:id/image',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{res.set('Cache-Control','private, no-store').type('png').send(await pro.image(req.user,req.params.id));}catch(e){next(e);}});
router.put('/pro/products/:id/media',requireRole('admin','manager'),action(req=>pro.media(req.user,req.params.id,req.body)));
router.get('/pro/accounts',requireRole('admin','manager'),action(req=>credit.list(req.user)));
router.post('/pro/accounts',requireRole('admin','manager'),action(req=>credit.create(req.user,req.body,req.get('Idempotency-Key'))));
router.get('/pro/accounts/reminders',requireRole('admin','manager'),action(req=>credit.reminders(req.user,req.query||{})));
router.get('/pro/accounts/:id',requireRole('admin','manager'),action(req=>credit.statement(req.user,req.params.id)));
router.post('/pro/accounts/:id/movements',requireRole('admin','manager'),action(req=>credit.movement(req.user,req.params.id,req.body,req.get('Idempotency-Key'))));
router.get('/pro/hardware',requireRole('admin','manager','cashier'),action(()=>external.capabilities()));
router.post('/pro/okc',requireRole('admin','manager'),action(req=>external.operation(req.user,req.body,req.get('Idempotency-Key'))));
router.get('/pro/okc-reconciliation',requireRole('admin','manager'),action(req=>external.reconciliation(req.user,req.query.date)));
router.get('/pro/okc/:id',requireRole('admin','manager'),action(req=>external.inspect(req.user,req.params.id)));
router.get('/pro/sales/:id/invoice-draft',requireRole('admin','manager'),action(req=>external.invoiceDraft(req.user,req.params.id)));
router.get('/shifts/context',async(req,res,next)=>{try{res.json(await require('../services/retailShiftService').context(req.user,req.query.warehouse_id,req.query.register_id));}catch(e){next(e);}});
router.post('/shifts/open',async(req,res,next)=>{try{res.status(201).json(await require('../services/retailShiftService').open(req.user,req.body,req.get('Idempotency-Key')));}catch(e){next(e);}});
router.get('/shifts/:id',async(req,res,next)=>{try{res.json(await require('../services/retailShiftService').detail(req.user,req.params.id));}catch(e){next(e);}});
router.post('/shifts/:id/cash',async(req,res,next)=>{try{res.status(201).json(await require('../services/retailShiftService').cashMovement(req.user,req.params.id,req.body,req.get('Idempotency-Key')));}catch(e){next(e);}});
router.post('/shifts/:id/close',async(req,res,next)=>{try{res.json(await require('../services/retailShiftService').close(req.user,req.params.id,req.body,req.get('Idempotency-Key')));}catch(e){next(e);}});
router.get('/shifts/:id/receipt',async(req,res,next)=>{try{res.type('html').send(await require('../services/retailShiftService').receipt(req.user,req.params.id,req.query.width||80));}catch(e){next(e);}});
router.get('/settings',async(req,res,next)=>{try{res.json(await service.config(req.user.tenantId));}catch(e){next(e);}});
router.put('/settings',requireRole('admin','manager'),async(req,res,next)=>{try{let c;try{c=(await service.core()).validateConfig(req.body);}catch(e){throw Object.assign(e,{status:400});}await db.transaction(async tx=>{await tx.query('DELETE FROM scanner_settings WHERE tenant_id=$1',[req.user.tenantId]);await tx.query('INSERT INTO scanner_settings (tenant_id,config_json) VALUES ($1,$2)',[req.user.tenantId,JSON.stringify(c)]);});res.json(c);}catch(e){next(e);}});
// Kaydedilmemiş tartı şemasıyla deneme: satış ve stok değişmez.
router.post('/weighted-preview',requireRole('admin','manager'),async(req,res,next)=>{try{const core=await service.core();let settings;try{settings=core.validateConfig({...(await service.config(req.user.tenantId)),weighted:req.body.weighted});}catch(e){throw Object.assign(e,{status:400});}if(typeof req.body.barcode!=='string'||!req.body.barcode.trim())throw Object.assign(Error('Barkod gerekli.'),{status:400});res.json(await service.lookup(req.user.tenantId,req.body.barcode.trim(),null,undefined,settings));}catch(e){if(!e.status&&/kontrol hanesi|geçersiz|uyumlu/i.test(e.message))e.status=400;next(e);}});
// Okutulan terazi etiketine CAS/Digi kılavuzlarındaki yaygın düzenler uygulanır; ürünle eşleşenler önerilir. Hiçbir şey kaydedilmez.
router.post('/weighted-detect',requireRole('admin','manager'),async(req,res,next)=>{try{
 const code=typeof req.body.barcode==='string'?req.body.barcode.trim():'';const core=await service.core();
 if(!/^2\d{12}$/.test(code))throw Object.assign(Error('Terazi etiketi 2 ile başlayan 13 haneli bir barkod olmalı.'),{status:400});
 if(!core.validCheckDigit(code))throw Object.assign(Error('Barkod kontrol hanesi hatalı. Etiketi tekrar okutun.'),{status:400});
 const prefix=code.slice(0,2),base={prefix,length:13,productStart:2,productLength:5,checkDigit:true};
 const layouts=[
  {label:'Ağırlıklı: 5 hane kod + 5 hane gram',rule:{...base,valueStart:7,valueLength:5,divisor:1000,kind:'weight'}},
  {label:'Fiyatlı: 5 hane kod + 5 hane kuruş',rule:{...base,valueStart:7,valueLength:5,divisor:100,kind:'price'}},
  {label:'Fiyatlı, fiyat kontrol haneli: 5 hane kod + 1 + 4 hane kuruş',rule:{...base,valueStart:8,valueLength:4,divisor:100,kind:'price',priceCheckAt:7}},
 ];
 const current=await service.config(req.user.tenantId),candidates=[];
 for(const layout of layouts){try{const settings=core.validateConfig({...current,weighted:[layout.rule]});const r=await service.lookup(req.user.tenantId,code,null,undefined,settings);
  candidates.push({label:layout.label,rule:layout.rule,product:r.product?{id:r.product.id,name:r.product.name,unit:r.product.unit}:null,product_code:r.product?undefined:r.product_code,quantity:r.quantity??null,line_total:r.line_total??null});}catch{}}
 res.json({barcode:code,prefix,candidates});
}catch(e){next(e);}});
router.post('/lookup',async(req,res,next)=>{try{res.json(await service.lookup(req.user.tenantId,req.body.barcode,req.body.warehouse_id));}catch(e){next(e);}});
router.get('/sale-status',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{
 const key=req.query.operation_key;if(typeof key!=='string'||!key||key.length>120)service.fail('Geçerli işlem anahtarı gerekli.');
 const result=await db.transaction(async tx=>{
  const row=(await tx.query('SELECT result_json FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[req.user.tenantId,'scan-sale:'+key])).rows[0];
  if(!row)return {status:'not_found'};
  const sale=JSON.parse(row.result_json),owner=(await tx.query('SELECT user_id FROM retail_sales WHERE tenant_id=$1 AND sale_id=$2',[req.user.tenantId,sale.sale_id])).rows[0];
  if(!owner||Number(owner.user_id)!==Number(req.user.userId))service.fail('Bu işlemin sonucuna erişemezsiniz.',403);
  return {status:'completed',sale};
 });res.set('Cache-Control','no-store').json(result);
}catch(e){next(e);}});
router.post('/sale-quote',requireRole('admin','manager','cashier'),action(req=>require('../services/retailDailyService').quote(req.user,req.body||{})));
router.post('/sale',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{res.status(201).json(await require('../services/retailDailyService').sale(req.user,req.body,req.get('Idempotency-Key')));}catch(e){next(e);}});
router.post('/sales/:id/:action',async(req,res,next)=>{try{res.json(await require('../services/retailDailyService').reverse(req.user,req.params.id,req.params.action,req.body,req.get('Idempotency-Key')));}catch(e){next(e);}});
router.get('/permissions',async(req,res,next)=>{try{res.json({role:req.user.role,permissions:await require('../services/retailDailyService').permissions(req.user)});}catch(e){next(e);}});
router.get('/cashiers',requireRole('admin','manager'),async(req,res,next)=>{try{res.json((await db.query("SELECT u.id,u.email,u.full_name,p.permissions_json FROM users u LEFT JOIN retail_cashier_permissions p ON p.user_id=u.id AND p.tenant_id=u.tenant_id WHERE u.tenant_id=$1 AND u.role='cashier' AND u.status='active' ORDER BY u.id",[req.user.tenantId])).rows);}catch(e){next(e);}});
router.put('/cashiers/:id/permissions',requireRole('admin'),async(req,res,next)=>{try{const daily=require('../services/retailDailyService'),body=req.body;if(!body||typeof body!=='object'||Object.keys(body).some(k=>!daily.permissionKeys.includes(k))||daily.permissionKeys.some(k=>body[k]!==undefined&&typeof body[k]!=='boolean')||['discount','price_override','return','cancel','day_close'].some(k=>typeof body[k]!=='boolean'))service.fail('Geçerli kasa yetkileri gerekli.');await db.transaction(async tx=>{if(!(await tx.query("SELECT id FROM users WHERE id=$1 AND tenant_id=$2 AND role='cashier'",[req.params.id,req.user.tenantId])).rows.length)service.fail('Kasiyer bulunamadı.',404);await tx.query('DELETE FROM retail_cashier_permissions WHERE tenant_id=$1 AND user_id=$2',[req.user.tenantId,req.params.id]);await tx.query('INSERT INTO retail_cashier_permissions (tenant_id,user_id,permissions_json) VALUES ($1,$2,$3)',[req.user.tenantId,req.params.id,JSON.stringify(body)]);await daily.audit(tx,req.user,'retail.permissions_updated',null,{user_id:Number(req.params.id),permissions:body});});res.json({success:true});}catch(e){next(e);}});
router.get('/sales',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{res.json(await require('../services/retailReportingService').history(req.user,req.query.warehouse_id,req.query.date));}catch(e){next(e);}});
router.get('/sales/:id',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{res.json(await require('../services/retailReportingService').detail(req.user,req.params.id));}catch(e){next(e);}});
router.get('/sales/:id/receipt',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; sandbox allow-modals");res.type('html').send(await require('../services/retailReportingService').receipt(req.user,req.params.id,req.query.width||80));}catch(e){next(e);}});
router.get('/day-report',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{if(req.user.role==='cashier')require('../services/retailDailyService').assertPermission(await require('../services/retailDailyService').permissions(req.user),'day_close');res.json(await require('../services/retailReportingService').report(req.user,req.query.warehouse_id,req.query.date));}catch(e){next(e);}});
router.get('/gross-profit',requireRole('admin','manager'),async(req,res,next)=>{
  try {
    const s=require('../services/retailProfitService'),data=await s.report(req.user,req.query);
    if(!req.query.format)return res.json(data);
    const format=req.query.format;
    if(!['csv','xlsx'].includes(format))service.fail('Dışa aktarma biçimi CSV veya Excel olmalıdır.');
    if(req.query.report_fingerprint && req.query.report_fingerprint!==data.fingerprint)service.fail('Rapor değişti. Raporu yenileyip tekrar indirin.',409);
    const rows=s.exportRows(data),filename=`brut-kar_${data.from}_${data.to}.${format}`;
    res.set('X-Report-Fingerprint',data.fingerprint);
    if(format==='csv'){
      const cell=v=>'"'+(typeof v==='number'?v.toFixed(2).replace('.',','):String(typeof v==='string'&&/^[=+@\-\t\r\n]/.test(v.trimStart())?"'"+v:v)).replace(/"/g,'""')+'"';
      res.attachment(filename).type('text/csv; charset=utf-8').send('\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n'));
    }else{
      const x=require('xlsx'),book=x.utils.book_new(),sheet=x.utils.aoa_to_sheet(rows);
      for(const cell of Object.values(sheet))if(cell && cell.t==='n')cell.z='#,##0.00" TL"';
      sheet['!cols']=rows[0].map((_,i)=>({wch:i===1?30:22}));
      x.utils.book_append_sheet(book,sheet,'Brüt kâr');
      res.attachment(filename).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(x.write(book,{type:'buffer',bookType:'xlsx'}));
    }
  }catch(e){next(e);}
});
router.post('/day-close',async(req,res,next)=>{try{res.json(await require('../services/retailReportingService').closeDay(req.user,req.body,req.get('Idempotency-Key')));}catch(e){next(e);}});
router.get('/search',requireRole('admin','manager','cashier'),async(req,res,next)=>{try{const q=String(req.query.q||'').trim();if(q.length<2||q.length>100)return res.json([]);res.json((await db.query("SELECT id,name,barcode,sku,sale_price,unit FROM products WHERE tenant_id=$1 AND module_type='NORMAL' AND (name LIKE $2 OR sku LIKE $2 OR barcode LIKE $2) ORDER BY name LIMIT 20",[req.user.tenantId,'%'+q+'%'])).rows);}catch(e){next(e);}});
module.exports=router;
