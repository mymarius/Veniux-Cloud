// Mobil etiket kontrolü: raftaki etiket fiyatı ile sistem fiyatının karşılaştırma kayıtları.
// Kayıt istemcide üretilen kimlikle tekrar gönderilse de bir kez yazılır; "doğru/hatalı" kararı sunucuda yeniden hesaplanır.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const istanbulDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const cents = value => Math.round(Number(value) * 100);
const allowed = user => (user.accessScope && user.accessScope.mode !== 'company' ? new Set((user.accessScope.warehouse_ids || []).map(Number)) : null);

function money(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e7) fail(label + ' geçersiz.');
  return Math.round(n * 100) / 100;
}

async function record(user, body = {}) {
  if (typeof body.id !== 'string' || !UUID.test(body.id)) fail('Kayıt kimliği geçersiz.');
  const warehouse = Number(body.warehouse_id);
  if (!Number.isSafeInteger(warehouse) || warehouse < 1) fail('Mağaza geçersiz.');
  const scope = allowed(user);
  if (scope && !scope.has(warehouse)) fail('Bu mağaza için yetkiniz yok.', 403);
  if (typeof body.barcode !== 'string' || !body.barcode.trim() || body.barcode.length > 128 || /[\x00-\x1f]/.test(body.barcode)) fail('Barkod geçersiz.');
  const shelf = money(body.shelf_price, 'Etiket fiyatı'), system = money(body.system_price, 'Sistem fiyatı');
  const at = Date.parse(body.checked_at || '');
  const checkedAt = Number.isFinite(at) && Math.abs(Date.now() - at) < 7 * 86400000 ? new Date(at) : new Date();
  const product = body.product_id == null ? null : Number(body.product_id);
  if (product !== null && (!Number.isSafeInteger(product) || product < 1)) fail('Ürün geçersiz.');
  const name = typeof body.product_name === 'string' ? body.product_name.slice(0, 200) : null;
  return db.transaction(async tx => {
    const store = (await tx.query('SELECT id FROM warehouses WHERE id=$1 AND tenant_id=$2', [warehouse, user.tenantId])).rows[0];
    if (!store) fail('Mağaza bulunamadı.', 404);
    const have = (await tx.query('SELECT id FROM store_label_checks WHERE tenant_id=$1 AND id=$2', [user.tenantId, body.id])).rows[0];
    if (have) return { id: body.id, duplicate: true };
    const ok = cents(shelf) === cents(system) ? 1 : 0;
    await tx.query('INSERT INTO store_label_checks (id,tenant_id,warehouse_id,check_day,barcode,product_id,product_name,shelf_price,system_price,ok,user_id,checked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [body.id, user.tenantId, warehouse, istanbulDay(checkedAt), body.barcode.trim(), product, name, shelf, system, ok, user.userId, checkedAt.toISOString()]);
    return { id: body.id, ok: Boolean(ok), duplicate: false };
  });
}

// O günün özeti: doğru sayısı (her doğru kontrol) ve hatalı etiket listesi (barkod başına son kontrol hatalıysa).
async function summary(user, query = {}) {
  const warehouse = Number(query.warehouse_id);
  if (!Number.isSafeInteger(warehouse) || warehouse < 1) fail('Mağaza geçersiz.');
  const scope = allowed(user);
  if (scope && !scope.has(warehouse)) fail('Bu mağaza için yetkiniz yok.', 403);
  const day = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : istanbulDay();
  const rows = (await db.query('SELECT barcode,product_id,product_name,shelf_price,system_price,ok,checked_at FROM store_label_checks WHERE tenant_id=$1 AND warehouse_id=$2 AND check_day=$3 ORDER BY checked_at DESC,created_at DESC LIMIT 5000', [user.tenantId, warehouse, day])).rows;
  let correct = 0; const last = new Map();
  for (const r of rows) { if (Number(r.ok) === 1) correct += 1; if (!last.has(r.barcode)) last.set(r.barcode, r); }
  const wrong = [...last.values()].filter(r => Number(r.ok) !== 1).map(r => ({ barcode: r.barcode, id: r.product_id == null ? null : Number(r.product_id), name: r.product_name, shelf: Number(r.shelf_price), system: Number(r.system_price), at: new Date(r.checked_at).toISOString() }));
  return { date: day, warehouse_id: warehouse, correct, wrong, total: correct + wrong.length };
}

module.exports = { record, summary, istanbulDay };
