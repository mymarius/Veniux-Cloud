const db = require('../config/database');
const daily = require('./retailDailyService');
const fail = require('./scannerService').fail;
const crypto = require('crypto');
const validId = value => {
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) fail('Geçerli kasa veya vardiya seçin.');
  return Number(value);
};
const reason = value => {
  if (typeof value !== 'string' || value.trim().length < 5 || value.length > 500) fail('En az 5, en fazla 500 karakter gerekçe gerekli.');
  return value.trim();
};
function retail(user) {
  if (!['admin', 'manager', 'cashier'].includes(user.role) || user.moduleType === 'PHARMACY') fail('Kasa vardiyası erişim yetkiniz yok.', 403);
}
async function register(tx, user, warehouseId, registerId) {
  retail(user);
  await daily.warehouse(tx, user.tenantId, validId(warehouseId));
  if (registerId === undefined || registerId === null) {
    await tx.query("INSERT INTO retail_registers (tenant_id,warehouse_id,name) VALUES ($1,$2,'Ana kasa') ON CONFLICT(tenant_id,warehouse_id,name) DO NOTHING", [user.tenantId, warehouseId]);
    return (await tx.query("SELECT * FROM retail_registers WHERE tenant_id=$1 AND warehouse_id=$2 AND name='Ana kasa'", [user.tenantId, warehouseId])).rows[0];
  }
  const r = (await tx.query('SELECT * FROM retail_registers WHERE tenant_id=$1 AND warehouse_id=$2 AND id=$3', [user.tenantId, warehouseId, validId(registerId)])).rows[0];
  if (!r) fail('Seçilen kasa bu depoya ait değil.', 404);
  return r;
}
async function requireOpen(tx, user, warehouseId, body = {}) {
  const r = await register(tx, user, warehouseId, body.register_id);
  const s = (await tx.query("SELECT * FROM retail_shifts WHERE tenant_id=$1 AND register_id=$2 AND status='open'", [user.tenantId, r.id])).rows[0];
  if (!s) fail('Bu kasada açık vardiya yok. Başlangıç nakdiyle vardiya açın.', 409);
  if (body.shift_id !== undefined && validId(body.shift_id) !== s.id) fail('Vardiya değişti. Kasayı yenileyip işlemi tekrar kontrol edin.', 409);
  return s;
}
async function row(tx, user, id) {
  retail(user);
  const s = (await tx.query('SELECT s.*,r.name AS register_name,w.name AS warehouse_name FROM retail_shifts s JOIN retail_registers r ON r.id=s.register_id AND r.tenant_id=s.tenant_id JOIN warehouses w ON w.id=s.warehouse_id AND w.tenant_id=s.tenant_id WHERE s.tenant_id=$1 AND s.id=$2', [user.tenantId, validId(id)])).rows[0];
  if (!s) fail('Vardiya bulunamadı.', 404);
  return s;
}
async function mayRead(user, s) {
  const rights = await daily.permissions(user);
  if (!rights.day_close && !rights.cash_movement && Number(s.user_id) !== Number(user.userId)) fail('Bu vardiyanın nakit raporuna erişim yetkiniz yok.', 403);
}
async function calculate(tx, user, s) {
  if (s.status === 'closed') return JSON.parse(s.closing_json);
  const sales = (await tx.query('SELECT sale_id,user_id,snapshot_json FROM retail_sales WHERE tenant_id=$1 AND shift_id=$2', [user.tenantId, s.id])).rows;
  const refunds = (await tx.query('SELECT id,sale_id,kind,amount_cents,data_json FROM retail_reversals WHERE tenant_id=$1 AND shift_id=$2 ORDER BY created_at,id', [user.tenantId, s.id])).rows;
  const movements = (await tx.query('SELECT * FROM retail_cash_movements WHERE tenant_id=$1 AND shift_id=$2 ORDER BY created_at,id', [user.tenantId, s.id])).rows;
  const out = {shift_id:s.id, register_id:s.register_id, register_name:s.register_name, warehouse_id:s.warehouse_id, warehouse_name:s.warehouse_name, status:'open', opened_by:s.opened_by_email, opened_by_id:s.user_id, opened_at:s.opened_at, opening_cash_cents:s.opening_cash_cents, sale_count:sales.length, gross_cents:0, discount_cents:0, sales_cents:0, cash_cents:0, card_cents:0,credit_cents:0,credit_refund_cents:0, received_cash_cents:0, change_cents:0, cash_refund_cents:0, card_refund_cents:0, return_cents:0, cancel_cents:0, cash_in_cents:0, cash_out_cents:0, movements, reversals:[]};
  for (const r of sales) {
    const sale = JSON.parse(r.snapshot_json);
    out.gross_cents += sale.gross_cents;
    out.discount_cents += sale.discount_cents;
    out.sales_cents += sale.net_cents;
    out.cash_cents += sale.payments.cash;
    out.card_cents += sale.payments.credit_card;out.credit_cents += sale.payments.on_account||0;
    out.received_cash_cents += sale.payments.received;
    out.change_cents += sale.payments.change;
  }
  for (const r of refunds) {
    const data = JSON.parse(r.data_json);
    out.cash_refund_cents += data.cash_cents;
    out.card_refund_cents += data.card_cents;out.credit_refund_cents += data.credit_cents||0;
    out[r.kind === 'cancel' ? 'cancel_cents' : 'return_cents'] += r.amount_cents;
    out.reversals.push({id:r.id,sale_id:r.sale_id,kind:r.kind,amount_cents:r.amount_cents,user_id:data.user_id,user_email:data.user_email,reason:data.reason,source_shift_id:data.source_shift_id,created_at:data.created_at});
  }
  for (const m of movements) out[m.direction === 'in' ? 'cash_in_cents' : 'cash_out_cents'] += m.amount_cents;
  out.cash_net_cents = out.cash_cents - out.cash_refund_cents;
  out.card_net_cents = out.card_cents - out.card_refund_cents;
  out.net_cents = out.sales_cents - out.return_cents - out.cancel_cents;
  out.expected_cash_cents = out.opening_cash_cents + out.cash_net_cents + out.cash_in_cents - out.cash_out_cents;
  if (Object.entries(out).some(([k,v]) => k.endsWith('_cents') && !Number.isSafeInteger(v))) fail('Vardiya parasal tutarı sınırı aşıldı.', 409);
  return out;
}
async function context(user, warehouseId, registerId) {
  retail(user);
  const rights = await daily.permissions(user);
  return db.transaction(async tx => {
    await daily.lock(tx,user.tenantId);
    const r = await register(tx,user,warehouseId,registerId);
    const registers = (await tx.query('SELECT id,name FROM retail_registers WHERE tenant_id=$1 AND warehouse_id=$2 ORDER BY id', [user.tenantId,warehouseId])).rows;
    const current = (await tx.query("SELECT id FROM retail_shifts WHERE tenant_id=$1 AND register_id=$2 AND status='open'",[user.tenantId,r.id])).rows[0];
    const s = current ? await row(tx,user,current.id) : null;
    const readable = rights.day_close || rights.cash_movement || (s && Number(s.user_id) === Number(user.userId));
    const recent = rights.day_close ? (await tx.query('SELECT id,status,opened_at,closed_at,opened_by_email FROM retail_shifts WHERE tenant_id=$1 AND register_id=$2 ORDER BY id DESC LIMIT 20',[user.tenantId,r.id])).rows : [];
    return {register:r,registers,active_shift:s ? readable ? await calculate(tx,user,s) : {shift_id:s.id,register_id:s.register_id,status:s.status,opened_at:s.opened_at,opened_by:s.opened_by_email} : null,recent,permissions:rights};
  });
}
async function open(user, body, key) {
  retail(user);daily.assertPermission(await daily.permissions(user),'shift_open');
  const opening=daily.cents(body.opening_cash,'Başlangıç nakdi');
  return db.transaction(async tx => {
    await daily.lock(tx,user.tenantId);
    return daily.idempotent(tx,user.tenantId,key,'shift-open',{...body,actor:user.userId},async()=>{
      const r=await register(tx,user,body.warehouse_id,body.register_id);
      if((await tx.query("SELECT id FROM retail_shifts WHERE tenant_id=$1 AND register_id=$2 AND status='open'",[user.tenantId,r.id])).rows.length)fail('Bu kasada zaten açık vardiya var.',409);
      const s=(await tx.query('INSERT INTO retail_shifts (tenant_id,register_id,warehouse_id,user_id,opened_by_email,opening_cash_cents,opened_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',[user.tenantId,r.id,r.warehouse_id,user.userId,user.email,opening,new Date().toISOString()])).rows[0];
      await daily.audit(tx,user,'retail.shift_open',null,{shift_id:s.id,register_id:r.id,opening_cash_cents:opening,user_id:user.userId});
      return calculate(tx,user,await row(tx,user,s.id));
    });
  });
}
async function cashMovement(user,id,body,key) {
  retail(user);daily.assertPermission(await daily.permissions(user),'cash_movement');
  const amount=daily.cents(body.amount,'Nakit hareketi');if(!amount)fail('Nakit hareketi sıfırdan büyük olmalıdır.');
  if(!['in','out'].includes(body.direction))fail('Nakit giriş veya çıkışı seçin.');
  const note=reason(body.reason);
  return db.transaction(async tx => {
    await daily.lock(tx,user.tenantId);
    return daily.idempotent(tx,user.tenantId,key,'shift-cash',{...body,shift_id:validId(id),actor:user.userId},async()=>{
      const s=await row(tx,user,id);if(s.status!=='open')fail('Kapalı vardiyaya nakit hareketi eklenemez.',409);
      const r=await calculate(tx,user,s);
      if(body.direction==='out' && amount>r.expected_cash_cents)fail('Çıkış tutarı kasadaki beklenen nakdi aşamaz.',409);
      const movement={id:crypto.randomUUID(),direction:body.direction,amount_cents:amount,reason:note,user_id:user.userId,user_email:user.email,shift_id:s.id};
      await tx.query('INSERT INTO retail_cash_movements (id,tenant_id,shift_id,user_id,user_email,direction,amount_cents,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[movement.id,user.tenantId,s.id,user.userId,user.email,body.direction,amount,note]);
      await daily.audit(tx,user,'retail.cash_'+body.direction,null,movement);
      return movement;
    });
  });
}
async function close(user,id,body,key) {
  retail(user);daily.assertPermission(await daily.permissions(user),'day_close');
  const counted=daily.cents(body.counted_cash,'Sayılan nakit');
  return db.transaction(async tx => {
    await daily.lock(tx,user.tenantId);
    return daily.idempotent(tx,user.tenantId,key,'shift-close',{...body,shift_id:validId(id),actor:user.userId},async()=>{
      const s=await row(tx,user,id);if(s.status!=='open')fail('Vardiya zaten kapalı.',409);
      if(body.opening_cash!==undefined && daily.cents(body.opening_cash)!==s.opening_cash_cents)fail('Başlangıç nakdi açılışta kaydedildi; kapanışta değiştirilemez.');
      const r=await calculate(tx,user,s),difference=counted-r.expected_cash_cents;
      if(body.expected_cash_cents!==undefined && (!Number.isSafeInteger(body.expected_cash_cents)||body.expected_cash_cents!==r.expected_cash_cents))fail('Vardiya nakdi değişti. Özeti yenileyip nakdi tekrar kontrol edin.',409);
      const note=difference ? reason(body.reason) : body.reason ? reason(body.reason) : '';
      const result={...r,status:'closed',counted_cash_cents:counted,difference_cents:difference,difference_reason:note,closed_by:user.email,closed_by_id:user.userId,closed_at:new Date().toISOString()};
      const changed=await tx.query("UPDATE retail_shifts SET status='closed',closed_at=$1,closed_by=$2,closing_json=$3 WHERE tenant_id=$4 AND id=$5 AND status='open'",[result.closed_at,user.userId,JSON.stringify(result),user.tenantId,s.id]);
      if(changed.rowCount!==1)fail('Vardiya durumu değişti. Kasayı yenileyin.',409);
      await daily.audit(tx,user,'retail.shift_close',null,{shift_id:s.id,register_id:s.register_id,difference_cents:difference,reason:note,user_id:user.userId});
      return result;
    });
  });
}
async function detail(user,id) {
  retail(user);
  // Permission reads are outside the serialized transaction to avoid nested locks.
  const r=(await db.query('SELECT user_id FROM retail_shifts WHERE tenant_id=$1 AND id=$2',[user.tenantId,validId(id)])).rows[0];if(!r)fail('Vardiya bulunamadı.',404);
  await mayRead(user,r);
  return db.transaction(async tx=>calculate(tx,user,await row(tx,user,id)));
}
async function assertRefundCash(tx,user,s,cash) {
  if (cash > (await calculate(tx,user,s)).expected_cash_cents) fail('Nakit iade için kasada yeterli beklenen nakit yok. Yetkili nakit girişini kaydedin.',409);
}
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function receipt(user,id,width) {
  if(![58,80].includes(Number(width)))fail('Fiş genişliği 58 veya 80 mm olmalıdır.');
  const r=await detail(user,id);if(r.status!=='closed')fail('Önce vardiyayı kapatın.',409);
  const money=require('./retailReceipt').money;
  const lines=[['Başlangıç nakdi',r.opening_cash_cents],['Nakit tahsilat (para üstü sonrası)',r.cash_cents],['Alınan nakit',r.received_cash_cents],['Verilen para üstü',r.change_cents],['Nakit iade / iptal',r.cash_refund_cents],['Nakit giriş',r.cash_in_cents],['Nakit çıkış',r.cash_out_cents],['Beklenen nakit',r.expected_cash_cents],['Sayılan nakit',r.counted_cash_cents],['Kasa farkı',r.difference_cents],['Kart kaydı',r.card_cents],['Kart iade kaydı',r.card_refund_cents],['Veresiye kaydı',r.credit_cents||0],['Veresiye iade',r.credit_refund_cents||0],['Net satış KDV dahil',r.net_cents]];
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Vardiya kapanış özeti</title><style>@page{size:${Number(width)}mm ${Math.max(180,180+r.movements.length*15)}mm;margin:2mm}body{width:${Number(width)-4}mm;margin:auto;font:11px monospace;overflow-wrap:anywhere}h1{font-size:14px}table{width:100%}td:last-child{text-align:right}p{margin:5px 0}</style></head><body><h1>Vardiya kapanış özeti</h1><p>${esc(r.warehouse_name)} · ${esc(r.register_name)} · #${r.shift_id}</p><p>Açan: ${esc(r.opened_by)} · ${esc(r.opened_at)}</p><p>Kapatan: ${esc(r.closed_by)} · ${esc(r.closed_at)}</p><table>${lines.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('')}</table><p>Fark gerekçesi: ${esc(r.difference_reason||'Fark yok')}</p><p>Nakit hareketleri satış geliri değildir.</p>${r.movements.map(m=>`<p>${m.direction==='in'?'Giriş':'Çıkış'} ${money(m.amount_cents)} · ${esc(m.reason)} · ${esc(m.user_email)}</p>`).join('')}<p>Kart tahsilat/iadesi banka cihazında ayrıca tamamlanır. Bu çıktı mali fiş değildir.</p></body></html>`;
}
module.exports={context,open,requireOpen,cashMovement,close,detail,receipt,assertRefundCash};
