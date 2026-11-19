const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

// ÖKC (yazarkasa) köprüsü: Veniux mali fiş düzenlemez; satış tamamlanınca cihaza "bu satışı yaz" işi bırakır, cihazın verdiği
// mali fiş numarasını geri okur. Cihaz kapalı/hatalıysa satış ASLA engellenmez; iş "failed" kalır ve elle yeniden denenir.
// Sürücü sözleşmesi: openSale({ lines, payments, total_cents, receipt_no }) → { fiscal_receipt_no, z_no }
const BRANDS = ['simulator', 'ingenico', 'beko', 'hugin', 'pavo', 'odeal'];
const CONNECTIONS = ['simulated', 'serial', 'usb', 'network'];
const MAX_ATTEMPTS = 5;

let simulatorSeq = 0;
const drivers = {
  // Testler ve demo için: ad "hata" içeriyorsa kâğıt bitti hatası verir.
  simulator: {
    async openSale(device, sale) {
      if (/hata/i.test(device.name)) throw new Error('Yazarkasa yanıt vermedi (kâğıt bitti veya kapalı).');
      simulatorSeq += 1;
      return { fiscal_receipt_no: 'SIM-' + String(simulatorSeq).padStart(6, '0'), z_no: 'Z' + new Date().toISOString().slice(0, 10).replace(/-/g, '') };
    }
  }
};
// Üretici sürücüleri üretici SDK'sı ve sözleşme gerektirir; gelene kadar net bir hata verilir.
for (const brand of BRANDS) if (!drivers[brand]) drivers[brand] = { async openSale() { throw new Error(brand + ' sürücüsü henüz kurulu değil.'); } };

async function registerDevice(user, body = {}) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  const brand = String(body.brand || ''), connection = String(body.connection || ''), name = String(body.name || '').trim();
  if (!BRANDS.includes(brand)) fail('Marka geçersiz.');
  if (!CONNECTIONS.includes(connection)) fail('Bağlantı türü geçersiz.');
  if (name.length < 2 || name.length > 60) fail('Cihaz adı 2–60 karakter olmalı.');
  const registerId = body.register_id == null ? null : Number(body.register_id);
  if (registerId !== null && (!Number.isInteger(registerId) || registerId <= 0)) fail('Kasa geçersiz.');
  const row = (await db.query('INSERT INTO ecr_devices (tenant_id,register_id,brand,connection,name) VALUES ($1,$2,$3,$4,$5) RETURNING id', [user.tenantId, registerId, brand, connection, name])).rows[0];
  return { id: Number(row.id), brand, connection, name, register_id: registerId };
}

async function devices(user) {
  if (!['admin', 'manager'].includes(user.role)) fail('Bu işlem için yetkiniz yok.', 403);
  return { items: (await db.query('SELECT id,register_id,brand,connection,name,active FROM ecr_devices WHERE tenant_id=$1 ORDER BY id', [user.tenantId])).rows.map(r => ({ ...r, id: Number(r.id), active: Number(r.active) === 1 })) };
}

// Satış işleminin içinden çağrılır (aynı tx). Etkin cihaz yoksa hiçbir şey yapmaz; hata satışı bozmaz.
async function enqueueSale(tx, tenantId, saleId, registerId) {
  try {
    const device = (await tx.query('SELECT id FROM ecr_devices WHERE tenant_id=$1 AND active=1 AND (register_id=$2 OR register_id IS NULL) ORDER BY register_id IS NULL, id LIMIT 1', [tenantId, registerId ?? null])).rows[0];
    if (!device) return null;
    await tx.query("INSERT INTO ecr_jobs (tenant_id,device_id,sale_id,kind,status) VALUES ($1,$2,$3,'sale','pending')", [tenantId, device.id, saleId]);
    return Number(device.id);
  } catch { return null; }
}

async function processJob(user, jobId) {
  const job = (await db.query('SELECT * FROM ecr_jobs WHERE id=$1 AND tenant_id=$2', [jobId, user.tenantId])).rows[0];
  if (!job) fail('İş bulunamadı.', 404);
  if (job.status === 'done') return { id: Number(job.id), status: 'done', fiscal_receipt_no: job.fiscal_receipt_no, z_no: job.z_no };
  if (Number(job.attempts) >= MAX_ATTEMPTS) fail('Deneme sınırına ulaşıldı; cihazı kontrol edip yönetici onayıyla sıfırlayın.', 409);
  const device = (await db.query('SELECT * FROM ecr_devices WHERE id=$1 AND tenant_id=$2', [job.device_id, user.tenantId])).rows[0];
  const sale = (await db.query('SELECT snapshot_json FROM retail_sales WHERE sale_id=$1 AND tenant_id=$2', [job.sale_id, user.tenantId])).rows[0];
  if (!device || !sale) fail('Cihaz veya satış kaydı yok.', 409);
  const s = JSON.parse(sale.snapshot_json);
  const driver = drivers[device.brand];
  try {
    const r = await driver.openSale(device, { receipt_no: s.receipt_no, total_cents: s.net_cents, payments: s.payments, lines: (s.items || []).map(i => ({ name: i.name, quantity: i.quantity, net_cents: i.net_cents })) });
    await db.query("UPDATE ecr_jobs SET status='done',attempts=attempts+1,last_error=NULL,fiscal_receipt_no=$1,z_no=$2,done_at=CURRENT_TIMESTAMP WHERE id=$3", [r.fiscal_receipt_no, r.z_no, job.id]);
    return { id: Number(job.id), status: 'done', fiscal_receipt_no: r.fiscal_receipt_no, z_no: r.z_no };
  } catch (e) {
    const message = String(e.message || 'Bilinmeyen hata').slice(0, 300);
    await db.query("UPDATE ecr_jobs SET status='failed',attempts=attempts+1,last_error=$1 WHERE id=$2", [message, job.id]);
    return { id: Number(job.id), status: 'failed', error: message };
  }
}

// Bekleyen ve başarısız işleri sırayla dener (kasa her satıştan sonra ve gün sonunda çağırır).
async function processPending(user, limit = 20) {
  const rows = (await db.query("SELECT id FROM ecr_jobs WHERE tenant_id=$1 AND status IN ('pending','failed') AND attempts<$2 ORDER BY id LIMIT $3", [user.tenantId, MAX_ATTEMPTS, limit])).rows;
  const results = [];
  for (const r of rows) results.push(await processJob(user, Number(r.id)));
  return { processed: results.length, done: results.filter(x => x.status === 'done').length, failed: results.filter(x => x.status === 'failed').length, results };
}

async function jobs(user, query = {}) {
  const params = [user.tenantId];
  let where = 'tenant_id=$1';
  if (['pending', 'failed', 'done'].includes(query.status)) { params.push(query.status); where += ` AND status=$${params.length}`; }
  const rows = (await db.query(`SELECT id,sale_id,status,attempts,last_error,fiscal_receipt_no,z_no,created_at,done_at FROM ecr_jobs WHERE ${where} ORDER BY id DESC LIMIT 100`, params)).rows;
  const counts = (await db.query("SELECT status, COUNT(*) AS n FROM ecr_jobs WHERE tenant_id=$1 GROUP BY status", [user.tenantId])).rows.reduce((m, r) => ({ ...m, [r.status]: Number(r.n) }), { pending: 0, failed: 0, done: 0 });
  return { items: rows.map(r => ({ ...r, id: Number(r.id), sale_id: Number(r.sale_id), attempts: Number(r.attempts) })), counts, blocking: counts.pending + counts.failed };
}

module.exports = { registerDevice, devices, enqueueSale, processJob, processPending, jobs, BRANDS, CONNECTIONS, MAX_ATTEMPTS, drivers };
