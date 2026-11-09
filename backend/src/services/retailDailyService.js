const db = require('../config/database');
const scanner = require('./scannerService');
const crypto = require('crypto');
const stockHealth = require('./stockHealthService');
const fail = scanner.fail;
const permissionKeys = ['discount','price_override','return','cancel','day_close','shift_open','cash_movement'];
function businessDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
}
function cents(value,label='Tutar') {
  if (!['number','string'].includes(typeof value) || String(value).trim()==='' || !Number.isFinite(Number(value)) || Number(value)<0 || Number(value)>1000000000 || Math.abs(Number(value)*100-Math.round(Number(value)*100))>0.00001) fail(label+' en fazla iki ondalık basamakla, sıfır veya pozitif olmalıdır.');
  return Math.round(Number(value)*100);
}
async function permissions(user) {
  if (['admin','manager'].includes(user.role)) return Object.fromEntries(permissionKeys.map(k=>[k,true]));
  const row=(await db.query('SELECT permissions_json FROM retail_cashier_permissions WHERE tenant_id=$1 AND user_id=$2',[user.tenantId,user.userId])).rows[0];
  const stored=row?JSON.parse(row.permissions_json):{};
  return Object.fromEntries(permissionKeys.map(k=>[k,user.role==='cashier'&&stored[k]===true]));
}
function assertPermission(rights,key){if(!rights[key]) fail('Bu işlem için kasa yetkiniz yok.',403);}
async function lock(tx,tenant){if(db.getEngine()==='mysql')await tx.query('SELECT id FROM tenants WHERE id=$1 FOR UPDATE',[tenant]);}
async function warehouse(tx,tenant,id){if(!(await tx.query("SELECT id FROM warehouses WHERE tenant_id=$1 AND id=$2 AND warehouse_type='NORMAL'",[tenant,id])).rows.length)fail('Market deposu bulunamadı.',404);}
async function openDay(tx,tenant,id,date){if((await tx.query('SELECT id FROM retail_day_closings WHERE tenant_id=$1 AND warehouse_id=$2 AND business_date=$3',[tenant,id,date])).rows.length)fail('Bu deponun bugünkü kasa günü kapalı. Yeni işlem yapılamaz.',409);}
async function idempotent(tx,tenant,key,scope,body,work){
  if(typeof key!=='string'||!key||key.length>120)fail('İşlem anahtarı gerekli.');
  const name=scope+':'+key,hash=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const previous=(await tx.query('SELECT * FROM depot_operation_keys WHERE tenant_id=$1 AND operation_key=$2',[tenant,name])).rows[0];
  if(previous){
    const result=JSON.parse(previous.result_json);
    if(previous.request_hash!==hash){
      // Upgrade earlier recovery keys only after confirming the original actor from the durable ledger.
      const legacy={...body};delete legacy.actor;
      const oldHash=crypto.createHash('sha256').update(JSON.stringify(legacy)).digest('hex');let originalActor=null;
      if(body.actor!==undefined&&previous.request_hash===oldHash){
        if(scope==='scan-sale')originalActor=(await tx.query('SELECT user_id FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2',[result.sale_id,tenant])).rows[0]?.user_id;
        else if(scope==='retail-return'||scope==='retail-cancel'){const event=(await tx.query('SELECT data_json FROM retail_reversals WHERE id=$1 AND tenant_id=$2',[result.id,tenant])).rows[0];if(event)originalActor=JSON.parse(event.data_json).user_id;}
      }
      if(originalActor===null||Number(originalActor)!==Number(body.actor))fail('İşlem anahtarı farklı bilgilerle kullanıldı.',409);
      await tx.query('UPDATE depot_operation_keys SET request_hash=$1 WHERE tenant_id=$2 AND operation_key=$3',[hash,tenant,name]);
    }
    return result;
  }
  const result=await work();
  await tx.query('INSERT INTO depot_operation_keys (tenant_id,operation_key,request_hash,result_json) VALUES ($1,$2,$3,$4)',[tenant,name,hash,JSON.stringify(result)]);
  return result;
}
async function audit(tx,user,action,id,data){await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)',[user.tenantId,user.email,action,'pos_sale',id,JSON.stringify(data)]);}
function paymentBreakdown(body,total){
  const entries=body.payments ?? [{method:body.payment_method,amount:total/100}];
  if(!Array.isArray(entries)||entries.length<1||entries.length>3)fail('Nakit, kart veya veresiye ödeme tutarlarını belirtin.');
  const values={cash:0,credit_card:0};let credit=0;
  for(const p of entries){if(!p||!['cash','credit_card','on_account'].includes(p.method))fail('Ödeme yöntemi geçersiz.');if(p.method==='on_account')credit+=cents(p.amount,'Veresiye tutarı');else values[p.method]+=cents(p.amount,'Ödeme tutarı');}
  if(values.cash+values.credit_card+credit!==total)fail('Ödeme toplamı satış tutarıyla aynı olmalıdır.');
  const received=body.cash_received===undefined?values.cash:cents(body.cash_received,'Alınan nakit');
  if(received<values.cash||(!values.cash&&received>0))fail('Alınan nakit yetersiz veya bu satışta nakit ödeme yok.');
  return {...values,...(credit?{on_account:credit}:{}),received,change:received-values.cash};
}
function ratio(amount,numerator,denominator){
  const a=BigInt(amount)*BigInt(numerator),d=BigInt(denominator);
  return Number((a+d/2n)/d);
}
function discountAllocation(lines,discount,total){
  const cuts=lines.map(line=>total?Number(BigInt(discount)*BigInt(line.gross_cents)/BigInt(total)):0);
  let left=discount-cuts.reduce((a,b)=>a+b,0);
  const order=lines.map((line,i)=>({i,remainder:total?Number(BigInt(discount)*BigInt(line.gross_cents)%BigInt(total)):0})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
  for(const {i} of order){if(left<=0)break;if(cuts[i]<lines[i].gross_cents){cuts[i]++;left--;}}
  return lines.map((line,i)=>({...line,net_cents:line.gross_cents-cuts[i],returned_quantity:0,refunded_cents:0}));
}
async function price(tx,user,body,rights,settings,date){
    const lines=[],needed=new Map();let gross=0;
    for(const item of body.items){
      if(!Number.isSafeInteger(item.count)||item.count<1||item.count>100000)fail('Tekrar sayısı geçersiz.');
      const scan=await scanner.lookup(user.tenantId,item.barcode,body.warehouse_id,tx,settings);
      if(!scan.product||scan.product.module_type!=='NORMAL')fail('Market ürünü bulunamadı.',404);
      let qty=Number((scan.quantity*item.count).toFixed(6));
      if(item.quantity!==undefined){if(!['kg','litre'].includes(scan.product.unit)||scan.weighted||item.count!==1)fail('Elle tartı miktarı yalnız normal barkodlu kg/litre ürünü için girilebilir.');try{qty=(await import('../../../shared/retailPro.mjs')).quantity(item.quantity);}catch(e){fail(e.message);}}if(!Number.isFinite(qty)||qty<=0||qty>1000000)fail('Miktar sınırı aşıldı.');
      let price=cents(scan.unit_price,'Ürün birim fiyatı')/100,lineCents=scan.weighted&&Math.abs(scan.line_total-scan.quantity*price)>0.0000001?cents(scan.line_total,'Tartı tutarı')*item.count:ratio(cents(price),Math.round(qty*1000000),1000000);
      if(item.price_override!==undefined){assertPermission(rights,'price_override');price=cents(item.price_override,'Birim fiyat')/100;lineCents=ratio(cents(price),Math.round(qty*1000000),1000000);}
      const priceBasis=item.price_tax_basis??'inclusive';
      if(!['inclusive','exclusive'].includes(priceBasis)||item.price_tax_basis!==undefined&&item.price_override===undefined)fail('KDV fiyat temeli yalnızca açık bir fiyat değişikliğiyle belirtilebilir.');
      if(priceBasis==='exclusive')lineCents=require('./retailVatService').inclusive(lineCents,scan.product.kdv_orani);
      const enteredPriceCents=cents(price);
      // Reference unit price stays gross for existing sales reports. Authoritative
      // line totals above use integer cents; do not multiply this display value.
      const grossUnitPrice=priceBasis==='exclusive'?Number(BigInt(enteredPriceCents)*BigInt(100+Number(scan.product.kdv_orani)))/10000:price;
      if(!Number.isSafeInteger(lineCents)||lineCents<0)fail('Satış tutarı geçersiz.');gross+=lineCents;
      lines.push({id:lines.length+1,barcode:item.barcode,product_id:scan.product.id,name:scan.product.name,unit:scan.product.unit,variant:scan.product.uom_code||null,quantity:qty,unit_price:grossUnitPrice,entered_unit_price_cents:enteredPriceCents,price_tax_basis:priceBasis,gross_cents:lineCents,allocations:[],selected_lot_id:item.lot_id??null,manual_price:item.price_override!==undefined,weighted:Boolean(scan.weighted)||['kg','litre'].includes(scan.product.unit)});
      needed.set(scan.product.id,(needed.get(scan.product.id)||0)+qty);
    }
    if(!Number.isSafeInteger(gross)||gross>1000000000000)fail('Satış tutarı sınırı aşıldı.');
    const manual=cents(body.discount_amount??0,'İndirim');if(manual>0)assertPermission(rights,'discount');
    const promo=require('./retailPromoService'),canApprove=['admin','manager'].includes(user.role)||rights.discount===true;
    const campaign=await promo.campaignDiscount(tx,user.tenantId,date,lines,canApprove);
    if(manual+campaign.total>gross)fail('İndirim satış tutarını aşamaz.');
    const redeem=await promo.redeemValue(tx,user.tenantId,body,gross-manual-campaign.total);
    const discount=manual+campaign.total+redeem.cents;
    return {lines,needed,gross,manual,campaign,redeem,discount};
}
// Kasa ekranı ödeme tutarını bu toplamdan alır: kampanya ve puan indirimi satıştan önce görünür. Hiçbir şey yazılmaz.
async function quote(user,body){
  if(!['admin','manager','cashier'].includes(user.role))fail('Kasada satış yetkiniz yok.',403);
  const rights=await permissions(user),settings=await scanner.config(user.tenantId),date=businessDate();
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>200)fail('Geçerli satış sepeti gerekli.');
  return db.transaction(async tx=>{await warehouse(tx,user.tenantId,body.warehouse_id);const r=await price(tx,user,body,rights,settings,date);
    return {gross:r.gross/100,manual_discount:r.manual/100,campaign_discount:r.campaign.total/100,loyalty_discount:r.redeem.cents/100,total:(r.gross-r.discount)/100,campaigns:r.campaign.applied,campaigns_skipped:r.campaign.skipped};});
}
async function sale(user,body,key,device){
  if(!['admin','manager','cashier'].includes(user.role))fail('Kasada satış yetkiniz yok.',403);
  const rights=await permissions(user),settings=await scanner.config(user.tenantId),date=businessDate();
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>200)fail('Geçerli satış sepeti gerekli.');
  return db.transaction(async tx=>{await lock(tx,user.tenantId);return idempotent(tx,user.tenantId,key,'scan-sale',{...body,actor:user.userId},async()=>{
    await warehouse(tx,user.tenantId,body.warehouse_id);
    const shift=await require('./retailShiftService').requireOpen(tx,user,body.warehouse_id,body);
    const {lines,needed,gross,manual,campaign,redeem,discount}=await price(tx,user,body,rights,settings,date);
    const net=gross-discount,payments=paymentBreakdown(body,net);
    for(const [id,qty] of needed){const stocks=(await tx.query('SELECT quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3'+(db.getEngine()==='mysql'?' FOR UPDATE':''),[user.tenantId,body.warehouse_id,id])).rows;if(stocks.reduce((sum,s)=>sum+Number(s.quantity),0)+0.0000001<qty)fail('Satış için yeterli stok yok.',409);}
    const no='POS-'+crypto.randomUUID(),method=payments.on_account?(payments.cash||payments.credit_card?'split':'on_account'):payments.cash&&payments.credit_card?'split':payments.credit_card?'credit_card':'cash';
    if(payments.on_account&&!['admin','manager'].includes(user.role))fail('Veresiye satış için yönetici yetkisi gerekli.',403);
    if(!payments.on_account&&(body.account_id!==undefined||body.due_date!==undefined))fail('Cari hesap yalnız veresiye ödemede seçilebilir.');
    const devices=require('./posDeviceService'),posDevice=await devices.resolve(tx,user,device,shift.register_id),localNo=await devices.nextReceiptNo(tx,user.tenantId,body.warehouse_id,shift.register_id,date);
    const pos=(await tx.query("INSERT INTO pos_sales (tenant_id,receipt_no,total_amount,discount_amount,net_amount,payment_method,status) VALUES ($1,$2,$3,$4,$5,$6,'completed') RETURNING *",[user.tenantId,no,gross/100,discount/100,net/100,method])).rows[0];
    for(const line of lines){delete line.manual_price;delete line.weighted;}
    const items=discountAllocation(lines,discount,gross);
    for(const line of items){
      line.lot_allocations=await stockHealth.reserveSaleLots(user.tenantId,line.product_id,body.warehouse_id,line.quantity,line.selected_lot_id,tx);
      await require('./retailCostService').snapshot(tx,user.tenantId,line);
      await tx.query('INSERT INTO pos_sale_items (tenant_id,sale_id,product_id,gtin,quantity,unit_price,total_price) VALUES ($1,$2,$3,$4,$5,$6,$7)',[user.tenantId,pos.id,line.product_id,line.barcode,line.quantity,line.unit_price,line.net_cents/100]);
      let remaining=line.quantity;const stocks=(await tx.query('SELECT id,quantity FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 AND quantity>0 ORDER BY id',[user.tenantId,body.warehouse_id,line.product_id])).rows;
      for(const stock of stocks){const take=Math.min(Number(stock.quantity),remaining);const updated=await tx.query('UPDATE stock_records SET quantity=ROUND(quantity-$1,6) WHERE id=$2 AND quantity>=$1',[take,stock.id]);if(updated.rowCount!==1)fail('Stok değişti; satış tamamlanamadı.',409);line.allocations.push({stock_id:stock.id,quantity:take,recovered:0});remaining=Number((remaining-take).toFixed(6));if(remaining<=0)break;}
      if(remaining>0.0000001)fail('Stok değişti; satış tamamlanamadı.',409);
      await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'outbound','scanner_pos',$5)",[user.tenantId,line.product_id,body.warehouse_id,-line.quantity,no]);
      await syncCashStock(tx,user.tenantId,line.product_id,body.warehouse_id);
    }
    const snapshot={receipt_no:no,status:'completed',shift_id:shift.id,register_id:shift.register_id,items,gross_cents:gross,discount_cents:discount,net_cents:net,payments,refunded_cents:0,refund_payments:{cash:0,credit_card:0},cashier:user.email,created_at:new Date().toISOString()};
    snapshot.local_receipt_no=localNo;if(posDevice)snapshot.device_id=Number(posDevice.id);
    if(payments.on_account){snapshot.account_id=await require('./retailCreditService').charge(tx,user,body,payments.on_account,pos.id,shift.id);snapshot.due_date=body.due_date;snapshot.refund_payments.on_account=0;}
    snapshot.vat_breakdown=require('./retailVatService').breakdown(items);
    if(campaign.applied.length||manual||redeem.cents)snapshot.discounts={manual_cents:manual,campaign_cents:campaign.total,loyalty_cents:redeem.cents,campaigns:campaign.applied};
    const loyalty=await require('./retailPromoService').settle(tx,user.tenantId,redeem,pos.id,net);if(loyalty)snapshot.loyalty=loyalty;
    await tx.query('INSERT INTO retail_sales (sale_id,tenant_id,warehouse_id,user_id,business_date,snapshot_json,shift_id,register_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[pos.id,user.tenantId,body.warehouse_id,user.userId,date,JSON.stringify(snapshot),shift.id,shift.register_id]);
    await audit(tx,user,'scanner.sale',pos.id,{receipt:no,gross_cents:gross,discount_cents:discount,payments,price_overrides:body.items.filter(i=>i.price_override!==undefined).map(i=>({barcode:i.barcode,price:i.price_override}))});
    await devices.record(tx,user,{saleId:pos.id,clientUuid:key,device:posDevice,receiptNo:localNo});
    return {receipt_no:no,local_receipt_no:localNo,total:net/100,sale_id:pos.id,shift_id:shift.id,register_id:shift.register_id,change:payments.change/100,payments,discount:discount/100,campaigns:campaign.applied,campaigns_skipped:campaign.skipped,...(loyalty?{loyalty:{earned:loyalty.earned,redeemed:loyalty.redeemed}}:{})};
  });});
}
async function restore(tx,user,row,line,quantity,disposition='saleable'){
  await stockHealth.restoreSaleLots(user.tenantId,line.product_id,row.warehouse_id,line,quantity,tx,{disposition,user_id:user.userId,sale_id:row.sale_id});
  let remaining=quantity;
  for(const allocation of line.allocations){const take=Math.min(allocation.quantity-allocation.recovered,remaining);if(take<=0)continue;
    const existing=(await tx.query('SELECT id FROM stock_records WHERE id=$1 AND tenant_id=$2 AND warehouse_id=$3 AND product_id=$4',[allocation.stock_id,user.tenantId,row.warehouse_id,line.product_id])).rows[0];
    if(existing)await tx.query('UPDATE stock_records SET quantity=ROUND(quantity+$1,6) WHERE id=$2',[take,existing.id]);
    else {const fallback=(await tx.query('SELECT id FROM stock_records WHERE tenant_id=$1 AND warehouse_id=$2 AND product_id=$3 ORDER BY id LIMIT 1',[user.tenantId,row.warehouse_id,line.product_id])).rows[0];if(fallback)await tx.query('UPDATE stock_records SET quantity=quantity+$1 WHERE id=$2',[take,fallback.id]);else await tx.query('INSERT INTO stock_records (tenant_id,warehouse_id,product_id,quantity) VALUES ($1,$2,$3,$4)',[user.tenantId,row.warehouse_id,line.product_id,take]);}
    allocation.recovered=Number((allocation.recovered+take).toFixed(6));remaining=Number((remaining-take).toFixed(6));if(remaining<=0)break;
  }
  if(remaining>0.0000001)fail('İade stok kaydı uyuşmuyor; işlem geri alındı.',409);
  await syncCashStock(tx,user.tenantId,line.product_id,row.warehouse_id);
}
async function syncCashStock(tx,tenant,product,warehouse){await require('./stockAlertSync').syncWarehouseStockAlert(tx,tenant,product,warehouse);}
async function reverse(user,id,kind,body,key){
  const rights=await permissions(user);assertPermission(rights,kind);
  if(!['cancel','return'].includes(kind))fail('İşlem geçersiz.');
  if(typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>500)fail('En az 5 karakter gerekçe gerekli.');
  const date=businessDate();
  return db.transaction(async tx=>{await lock(tx,user.tenantId);return idempotent(tx,user.tenantId,key,'retail-'+kind,{...body,actor:user.userId,id},async()=>{
    const row=(await tx.query('SELECT * FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2',[id,user.tenantId])).rows[0];if(!row)fail('İade/iptal için doğrulanmış kasa kaydı bulunamadı.',404);
    if(user.role==='cashier'&&Number(row.user_id)!==Number(user.userId))fail('Başka kasiyerin satışını değiştiremezsiniz.',403);
    const snapshot=JSON.parse(row.snapshot_json);
    const shift=await require('./retailShiftService').requireOpen(tx,user,row.warehouse_id,{...body,register_id:body.register_id??row.register_id});
    if(kind==='cancel' && row.shift_id!==null && Number(row.shift_id)!==Number(shift.id))fail('Kapanmış vardiyadaki satış iptal edilemez; yeni vardiyada iade işlemi yapın.',409);
    if(['cancelled','returned'].includes(snapshot.status))fail('Bu satış zaten tamamen geri alınmış.',409);
    if(kind==='cancel'&&snapshot.items.some(i=>i.returned_quantity>0))fail('Kısmi iade yapılmış satış iptal edilemez; kalan ürünleri iade edin.',409);
    const requests=kind==='cancel'?snapshot.items.map(i=>({id:i.id,quantity:i.quantity})):body.items;
    if(!Array.isArray(requests)||!requests.length||requests.length>snapshot.items.length)fail('İade edilecek kalemleri seçin.');
    let refund=0;const seen=new Set(),restored=[];
    for(const request of requests){const line=snapshot.items.find(i=>i.id===Number(request.id)),qty=Number(request.quantity);if(!line||seen.has(line.id)||!['number','string'].includes(typeof request.quantity)||!Number.isFinite(qty)||qty<=0||Math.abs(qty*1000000-Math.round(qty*1000000))>0.0001)fail('İade miktarı veya kalem geçersiz.');seen.add(line.id);
      const totalQty=Number((line.returned_quantity+qty).toFixed(6));if(totalQty>line.quantity+0.0000001)fail('İade miktarı kalan satış miktarını aşamaz.',409);
      if(!['kg','litre'].includes(line.unit)&&!Number.isInteger(qty))fail('Bu ürün tam birim olarak iade edilmelidir.');
      const cumulative=Math.min(line.net_cents,ratio(line.net_cents,Math.round(totalQty*1000000),Math.round(line.quantity*1000000))),lineRefund=cumulative-line.refunded_cents;
      const disposition=kind==='cancel'?'saleable':request.disposition||'saleable';
      const finance=require('./retailCostService').reversal(line,qty,totalQty);
      await restore(tx,user,row,line,qty,disposition);line.returned_quantity=totalQty;line.refunded_cents=cumulative;refund+=lineRefund;restored.push({id:line.id,product_id:line.product_id,quantity:qty,amount_cents:lineRefund,disposition,...finance,vat_rate:line.vat_rate??null,refund_vat_cents:finance.refund_ex_vat_cents===null?null:lineRefund-finance.refund_ex_vat_cents});
      await tx.query("INSERT INTO stock_movements (tenant_id,product_id,warehouse_id,change_amount,movement_type,source,note) VALUES ($1,$2,$3,$4,'inbound',$5,$6)",[user.tenantId,line.product_id,row.warehouse_id,qty,'retail_'+kind,snapshot.receipt_no+' · '+body.reason.trim()]);
    }
    snapshot.refunded_cents+=refund;
    const creditTotal=snapshot.payments.on_account||0;
    const targetCredit=snapshot.net_cents?ratio(snapshot.refunded_cents,creditTotal,snapshot.net_cents):0;
    const targetCash=snapshot.net_cents-creditTotal?ratio(snapshot.refunded_cents-targetCredit,snapshot.payments.cash,snapshot.net_cents-creditTotal):0;
    const credit=targetCredit-(snapshot.refund_payments.on_account||0),cash=targetCash-snapshot.refund_payments.cash,card=refund-cash-credit;
    if(credit){await require('./retailCreditService').append(tx,user,{account_id:snapshot.account_id,sale_id:row.sale_id,shift_id:shift.id,kind:'refund',amount_cents:-credit,reason:body.reason.trim()});snapshot.refund_payments.on_account=targetCredit;}
    await require('./retailShiftService').assertRefundCash(tx,user,shift,cash);
    snapshot.refund_payments.cash=targetCash;snapshot.refund_payments.credit_card+=card;
    snapshot.status=kind==='cancel'?'cancelled':snapshot.items.every(i=>i.returned_quantity>=i.quantity-0.0000001)?'returned':'partially_returned';
    snapshot.refund_vat_breakdown=require('./retailVatService').breakdown(snapshot.items,'refund');
    snapshot.remaining_vat_breakdown=require('./retailVatService').breakdown(snapshot.items,'remaining');
    await require('./retailPromoService').reverse(tx,user.tenantId,snapshot,id);
    await tx.query('UPDATE retail_sales SET snapshot_json=$1 WHERE sale_id=$2 AND tenant_id=$3',[JSON.stringify(snapshot),id,user.tenantId]);
    await tx.query('UPDATE pos_sales SET status=$1,net_amount=$2 WHERE id=$3 AND tenant_id=$4',[snapshot.status,(snapshot.net_cents-snapshot.refunded_cents)/100,id,user.tenantId]);
    const reversalId=crypto.randomUUID(),data={items:restored,reason:body.reason.trim(),user_id:user.userId,user_email:user.email,shift_id:shift.id,register_id:shift.register_id,source_shift_id:row.shift_id,cash_cents:cash,card_cents:card,...(credit?{credit_cents:credit}:{}),refund_status:'recorded',created_at:new Date().toISOString()};
    await tx.query('INSERT INTO retail_reversals (id,tenant_id,sale_id,kind,business_date,amount_cents,data_json,shift_id,register_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[reversalId,user.tenantId,id,kind,date,refund,JSON.stringify(data),shift.id,shift.register_id]);
    await audit(tx,user,'retail.'+kind,id,{reversal_id:reversalId,...data,amount_cents:refund});
    return {id:reversalId,sale_id:Number.isSafeInteger(Number(id))?Number(id):String(id),shift_id:shift.id,source_shift_id:row.shift_id,status:snapshot.status,refund:refund/100,cash_refund:cash/100,card_refund:card/100,...(credit?{credit_refund:credit/100}:{}),refund_status:'recorded'};
  });});
}
module.exports={sale,quote,reverse,permissions,permissionKeys,businessDate,cents,lock,warehouse,openDay,idempotent,audit,assertPermission};
