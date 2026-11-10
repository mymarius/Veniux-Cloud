// Kasa cihazları ve kasa-gün fiş numarası (online kasa 2. aşama).
// - Cihaz, kasa ekranının kalıcı kimliğiyle (x-veniux-device-uid) ilk satışta kendiliğinden kaydolur;
//   paketteki cihaz sınırı aşılırsa kaydolmaz. Kaldırılan cihaz satış yapamaz.
// - Fiş numarası: ŞUBE-KASA-YYYYAAGG-NNNNN. Sayaç satışla aynı işlemde artar; boşluk ve tekrar olmaz.
//   Bu Veniux numarasıdır; yasal fiş numarası ÖKC'den gelir.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const UID = /^[A-Za-z0-9-]{8,80}$/;
const PLATFORMS = new Set(['windows', 'android', 'web']);
const pad = (n, w) => String(n).padStart(w, '0');

async function deviceLimit(tx, tenant) {
  const l = (await tx.query("SELECT max_devices FROM licenses WHERE tenant_id=$1 AND status IN ('ACTIVE','PAST_DUE') ORDER BY id DESC LIMIT 1", [tenant])).rows[0];
  const n = Number(l?.max_devices || 0);
  return n > 0 ? n : null;
}

// Satış içinde çağrılır. Kimliksiz istek (eski istemci) cihazsız kabul edilir.
async function resolve(tx, user, device, registerId) {
  if (!device?.uid) return null;
  if (!UID.test(device.uid)) fail('Kasa cihaz kimliği geçersiz.');
  const platform = PLATFORMS.has(device.platform) ? device.platform : 'web';
  let row = (await tx.query('SELECT * FROM pos_devices WHERE tenant_id=$1 AND device_uid=$2', [user.tenantId, device.uid])).rows[0];
  if (row && row.status !== 'active') fail('Bu kasa cihazı yönetici tarafından kaldırıldı. Yeniden eklenmesi için yöneticinize başvurun.', 403);
  if (!row) {
    const limit = await deviceLimit(tx, user.tenantId);
    const used = Number((await tx.query("SELECT COUNT(*) AS n FROM pos_devices WHERE tenant_id=$1 AND status='active'", [user.tenantId])).rows[0].n);
    if (limit !== null && used >= limit) fail(`Paketinizin kasa cihazı sınırına (${limit}) ulaşıldı. Kullanılmayan cihazı kaldırın veya paketi yükseltin.`, 403);
    await tx.query('INSERT INTO pos_devices (tenant_id,device_uid,register_id,platform,label) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, device.uid, registerId || null, platform, (platform === 'android' ? 'Android kasa' : platform === 'windows' ? 'Windows kasa' : 'Tarayıcı kasa') + ' ' + device.uid.slice(0, 6)]);
    row = (await tx.query('SELECT * FROM pos_devices WHERE tenant_id=$1 AND device_uid=$2', [user.tenantId, device.uid])).rows[0];
    await tx.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'pos.device_registered','device',$3,$4)", [user.tenantId, user.email, row.id, JSON.stringify({ platform, register_id: registerId || null })]);
  } else {
    // MySQL kapsam denetimi, kasa/depo gibi başvuru sütunlarına yalnız düz parametre yazılmasına izin verir (COALESCE gibi ifade reddedilir):
    // son görülme ve kasa ataması bu yüzden iki ayrı, basit güncellemedir. Anlamı aynıdır: kasa verildiyse atanır, verilmediyse eskisi kalır.
    await tx.query('UPDATE pos_devices SET last_seen_at=CURRENT_TIMESTAMP WHERE id=$1 AND tenant_id=$2', [row.id, user.tenantId]);
    if (registerId) await tx.query('UPDATE pos_devices SET register_id=$1 WHERE id=$2 AND tenant_id=$3', [registerId, row.id, user.tenantId]);
  }
  return row;
}

async function nextReceiptNo(tx, tenant, warehouseId, registerId, businessDate) {
  const register = Number(registerId || 0);
  const existing = (await tx.query('SELECT id,last_no FROM pos_receipt_counters WHERE tenant_id=$1 AND register_id=$2 AND business_date=$3', [tenant, register, businessDate])).rows[0];
  let next;
  if (existing) { next = Number(existing.last_no) + 1; await tx.query('UPDATE pos_receipt_counters SET last_no=$1 WHERE id=$2 AND tenant_id=$3 AND last_no=$4', [next, existing.id, tenant, existing.last_no]); }
  else { next = 1; await tx.query('INSERT INTO pos_receipt_counters (tenant_id,register_id,business_date,last_no) VALUES ($1,$2,$3,1)', [tenant, register, businessDate]); }
  return `${pad(warehouseId, 2)}-${pad(register, 2)}-${businessDate.replace(/-/g, '')}-${pad(next, 5)}`;
}

async function record(tx, user, { saleId, clientUuid, device, receiptNo }) {
  await tx.query("INSERT INTO pos_sale_meta (tenant_id,sale_id,client_uuid,device_id,local_receipt_no,mode,okc_status) VALUES ($1,$2,$3,$4,$5,'online','not_required')", [user.tenantId, saleId, clientUuid || null, device?.id || null, receiptNo]);
}

async function list(user) {
  if (!['admin', 'manager'].includes(user.role)) fail('Kasa cihazlarını yalnız yönetici ve müdür görebilir.', 403);
  const limit = await deviceLimit(db, user.tenantId);
  const devices = (await db.query('SELECT d.id,d.platform,d.label,d.status,d.register_id,r.name AS register_name,d.created_at,d.last_seen_at FROM pos_devices d LEFT JOIN retail_registers r ON r.id=d.register_id AND r.tenant_id=d.tenant_id WHERE d.tenant_id=$1 ORDER BY d.status,d.last_seen_at DESC', [user.tenantId])).rows;
  return { limit, active: devices.filter(d => d.status === 'active').length, devices };
}

async function update(user, id, body = {}) {
  if (user.role !== 'admin') fail('Kasa cihazını yalnız firma yöneticisi değiştirebilir.', 403);
  const status = body.status === undefined ? null : body.status;
  if (status !== null && !['active', 'revoked'].includes(status)) fail('Durum "active" veya "revoked" olmalı.');
  const label = body.label === undefined ? null : String(body.label).trim().slice(0, 80);
  if (label !== null && !label) fail('Cihaz adı boş olamaz.');
  return db.transaction(async tx => {
    const row = (await tx.query('SELECT * FROM pos_devices WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0];
    if (!row) fail('Kasa cihazı bulunamadı.', 404);
    if (status === 'active' && row.status !== 'active') {
      const limit = await deviceLimit(tx, user.tenantId);
      const used = Number((await tx.query("SELECT COUNT(*) AS n FROM pos_devices WHERE tenant_id=$1 AND status='active'", [user.tenantId])).rows[0].n);
      if (limit !== null && used >= limit) fail(`Paketinizin kasa cihazı sınırına (${limit}) ulaşıldı.`, 403);
    }
    await tx.query('UPDATE pos_devices SET status=COALESCE($1,status),label=COALESCE($2,label) WHERE id=$3 AND tenant_id=$4', [status, label, id, user.tenantId]);
    await tx.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'pos.device_changed','device',$3,$4)", [user.tenantId, user.email, Number(id), JSON.stringify({ status, label, previous_status: row.status })]);
    return (await tx.query('SELECT id,platform,label,status,register_id FROM pos_devices WHERE id=$1 AND tenant_id=$2', [id, user.tenantId])).rows[0];
  });
}

module.exports = { resolve, nextReceiptNo, record, list, update };
