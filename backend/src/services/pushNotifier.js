// Telefon bildirimleri: abonelik yönetimi, işletmenin yöneticilerine gönderim ve kritik stok özeti.
// Bildirimler en iyi çabadır: gönderim hatası asıl işlemi (sipariş, stok hareketi) asla bozmaz.
const crypto = require('crypto');
const db = require('../config/database');
const webPush = require('./webPush');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const hash = endpoint => crypto.createHash('sha256').update(String(endpoint)).digest('hex');
const MAX_PER_USER = 10, MAX_SEND = 60;

async function subscribe(user, body = {}) {
  const sub = body.subscription || body;
  if (!sub || typeof sub !== 'object' || !webPush.validEndpoint(sub.endpoint)) fail('Bildirim adresi geçersiz veya desteklenmiyor.');
  const keys = sub.keys || {};
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || webPush.unb64u(keys.p256dh).length !== 65 || webPush.unb64u(keys.auth).length !== 16) fail('Bildirim anahtarları geçersiz.');
  const h = hash(sub.endpoint);
  return db.transaction(async tx => {
    const have = (await tx.query('SELECT id FROM push_subscriptions WHERE tenant_id=$1 AND endpoint_hash=$2', [user.tenantId, h])).rows[0];
    if (have) {
      await tx.query('UPDATE push_subscriptions SET user_id=$1,role=$2,endpoint=$3,p256dh=$4,auth=$5,failures=0 WHERE id=$6 AND tenant_id=$7', [user.userId, user.role, sub.endpoint, keys.p256dh, keys.auth, have.id, user.tenantId]);
      return { id: have.id, updated: true };
    }
    const mine = (await tx.query('SELECT id FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at,id', [user.tenantId, user.userId])).rows;
    for (const old of mine.slice(0, Math.max(0, mine.length - MAX_PER_USER + 1))) await tx.query('DELETE FROM push_subscriptions WHERE id=$1 AND tenant_id=$2', [old.id, user.tenantId]);
    const id = crypto.randomUUID();
    await tx.query('INSERT INTO push_subscriptions (id,tenant_id,user_id,role,endpoint_hash,endpoint,p256dh,auth) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, user.tenantId, user.userId, user.role, h, sub.endpoint, keys.p256dh, keys.auth]);
    return { id, updated: false };
  });
}

async function unsubscribe(user, endpoint) {
  const done = await db.query('DELETE FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2 AND endpoint_hash=$3', [user.tenantId, user.userId, hash(endpoint)]);
  return { removed: done.rowCount };
}

async function deliver(rows, message, options) {
  let sent = 0, removed = 0;
  for (const row of rows.slice(0, MAX_SEND)) {
    const result = await webPush.send({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, message, options);
    if (result.ok) { sent++; await db.query('UPDATE push_subscriptions SET last_ok_at=CURRENT_TIMESTAMP,failures=0 WHERE id=$1 AND tenant_id=$2', [row.id, row.tenant_id]); }
    else if (result.gone || Number(row.failures) + 1 >= 5) { removed++; await db.query('DELETE FROM push_subscriptions WHERE id=$1 AND tenant_id=$2', [row.id, row.tenant_id]); }
    else await db.query('UPDATE push_subscriptions SET failures=failures+1 WHERE id=$1 AND tenant_id=$2', [row.id, row.tenant_id]);
  }
  return { sent, removed };
}

// Bir işletmenin yöneticilerine bildirim: sipariş girenin kendisi (exceptUser) hariç.
async function notifyTenant(tenantId, message, { roles = ['admin', 'manager'], exceptUser = null, options } = {}) {
  const marks = roles.map((_, i) => '$' + (i + 2)).join(',');
  const rows = (await db.query(`SELECT id,tenant_id,user_id,endpoint,p256dh,auth,failures FROM push_subscriptions WHERE tenant_id=$1 AND role IN (${marks})`, [tenantId, ...roles])).rows
    .filter(r => exceptUser === null || Number(r.user_id) !== Number(exceptUser));
  if (!rows.length) return { sent: 0, removed: 0 };
  return deliver(rows, { icon: '/veniux-logo.png', badge: '/favicon.png', ...message }, options);
}

// Kullanıcının kendi cihazlarına deneme bildirimi.
async function selfTest(user, options) {
  const rows = (await db.query('SELECT id,tenant_id,user_id,endpoint,p256dh,auth,failures FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2', [user.tenantId, user.userId])).rows;
  if (!rows.length) fail('Bu cihaz için bildirim açık değil. Önce bildirimleri açın.', 409);
  const result = await deliver(rows, { title: 'Veniux deneme bildirimi', body: 'Bildirimler bu cihazda çalışıyor.', url: '/m', tag: 'veniux-test', icon: '/veniux-logo.png', badge: '/favicon.png' }, options);
  return result;
}

// ---------- Kritik stok özeti ----------
const timers = new Map();
function lowStockChanged(tenantId) {
  // Test ortamında zamanlayıcı kurulmaz: ortam kapandıktan sonra tetiklenip süreci hatalı bitirmesin (testler digest'i doğrudan çağırır).
  if (process.env.NODE_ENV === 'test' && !process.env.PUSH_DIGEST_TIMER) return;
  if (timers.has(tenantId)) return;
  const timer = setTimeout(() => { timers.delete(tenantId); digest(tenantId).catch(() => {}); }, 5000);
  if (timer.unref) timer.unref();
  timers.set(tenantId, timer);
}

async function digest(tenantId, options) {
  if (!(await require('./sectorPacks').has({ tenantId, isPlatformAdmin: false }, 'hardware'))) return { skipped: 'paket yok' };
  const { criticalKey } = { criticalKey: i => i.id + (i.empty ? ':empty' : ':low') };
  const items = (await require('./hardwareService').critical({ tenantId })).items;
  const keys = items.map(criticalKey);
  const row = (await db.query("SELECT state_json FROM push_state WHERE tenant_id=$1 AND topic='critical'", [tenantId])).rows[0];
  let seen = []; try { seen = row ? JSON.parse(row.state_json) : []; } catch { seen = []; }
  const fresh = items.filter(i => !seen.includes(criticalKey(i)));
  if (row) await db.query("UPDATE push_state SET state_json=$1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=$2 AND topic='critical'", [JSON.stringify(keys), tenantId]);
  else await db.query("INSERT INTO push_state (tenant_id,topic,state_json) VALUES ($1,'critical',$2)", [tenantId, JSON.stringify(keys)]);
  if (!fresh.length) return { notified: 0 };
  const body = fresh.length === 1 ? fresh[0].message : fresh.length + ' ürün azaldı veya bitti: ' + fresh.slice(0, 3).map(i => i.name).join(', ') + (fresh.length > 3 ? '…' : '');
  const sent = await notifyTenant(tenantId, { title: 'Kritik stok', body, url: '/m/kritik', tag: 'critical' }, { options });
  return { notified: fresh.length, ...sent };
}

// ---------- Restoran: yeni sipariş ----------
async function orderCreated(user, order, tableName, options) {
  const lines = order.items.map(i => i.quantity + '× ' + i.name).join(', ');
  const where = tableName || (order.type === 'motor' ? 'Motor' : 'Paket');
  return notifyTenant(user.tenantId, { title: order.appended ? 'Siparişe ekleme' : 'Sipariş geldi', body: where + ' · ' + lines, url: '/m/esnaf', tag: 'order-' + order.order_id }, { exceptUser: user.userId, options });
}

module.exports = { subscribe, unsubscribe, notifyTenant, selfTest, lowStockChanged, digest, orderCreated, hash };
