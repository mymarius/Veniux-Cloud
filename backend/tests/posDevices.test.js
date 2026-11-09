process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant, createWarehouse } = require('./factories');

let owner, w, shift;
const sale = (uid, key = crypto.randomUUID(), count = 1) => {
  const r = request(app).post('/api/scanner/sale').set('Authorization', 'Bearer ' + owner.token).set('Idempotency-Key', key);
  if (uid) r.set('x-veniux-device-uid', uid).set('x-veniux-device-platform', 'android');
  return r.send({ warehouse_id: w.id, shift_id: shift.shift_id, register_id: shift.register_id, items: [{ barcode: '000-DEV', count }], payment_method: 'cash' });
};
const today = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10).replace(/-/g, '');
beforeAll(async () => {
  owner = await createTenant();
  w = await createWarehouse(owner.tenantId);
  const p = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,module_type) VALUES($1,'DEV-SKU','Cihaz ürünü','000-DEV','adet',10,'NORMAL') RETURNING *", [owner.tenantId])).rows[0];
  await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,500)', [owner.tenantId, w.id, p.id]);
  shift = await require('./factories').openTestShift(owner, w.id, 0);
});

test('kasa-gün fiş numarası boşluksuz artar; aynı satış tekrar gönderilince yeni numara almaz', async () => {
  const uid = 'cihaz-aaaa-0001';
  const key = crypto.randomUUID();
  const a = await sale(uid, key), again = await sale(uid, key), b = await sale(uid);
  expect(a.status).toBe(201);
  const prefix = `${String(w.id).padStart(2, '0')}-${String(shift.register_id).padStart(2, '0')}-${today()}-`;
  expect(a.body.local_receipt_no).toBe(prefix + '00001');
  expect(again.body.local_receipt_no).toBe(prefix + '00001');
  expect(b.body.local_receipt_no).toBe(prefix + '00002');
  const meta = (await db.query('SELECT local_receipt_no,client_uuid,device_id FROM pos_sale_meta WHERE tenant_id=$1 ORDER BY id', [owner.tenantId])).rows;
  expect(meta).toHaveLength(2);
  expect(meta[0].client_uuid).toBe(key);
  const html = await request(app).get(`/api/scanner/sales/${a.body.sale_id}/receipt?width=80`).set('Authorization', 'Bearer ' + owner.token);
  expect(html.text).toContain('Fiş no: ' + prefix + '00001');
});

test('aynı anda gelen satışlar farklı ve ardışık numara alır', async () => {
  const results = await Promise.all([sale('cihaz-aaaa-0001'), sale('cihaz-aaaa-0001'), sale('cihaz-aaaa-0001')]);
  const nos = results.map(r => r.body.local_receipt_no).sort();
  expect(new Set(nos).size).toBe(3);
  expect(nos.map(n => Number(n.slice(-5)))).toEqual([3, 4, 5]);
});

test('cihaz sınırı aşılınca yeni kasa satış yapamaz; kaldırılan cihaz reddedilir, yeniden etkinleştirilince çalışır', async () => {
  await db.query('UPDATE licenses SET max_devices=2 WHERE tenant_id=$1', [owner.tenantId]);
  expect((await sale('cihaz-bbbb-0002')).status).toBe(201);
  const third = await sale('cihaz-cccc-0003');
  expect(third.status).toBe(403);
  expect(third.body.error).toContain('(2)');
  const list = (await request(app).get('/api/scanner/devices').set('Authorization', 'Bearer ' + owner.token)).body;
  expect(list).toMatchObject({ limit: 2, active: 2 });
  const first = list.devices.find(d => d.label.includes('cihaz-'.slice(0, 6)) || d.platform === 'android');
  const revoke = await request(app).put('/api/scanner/devices/' + first.id).set('Authorization', 'Bearer ' + owner.token).send({ status: 'revoked' });
  expect(revoke.status).toBe(200);
  const uidOf = (await db.query('SELECT device_uid FROM pos_devices WHERE id=$1', [first.id])).rows[0].device_uid;
  const blocked = await sale(uidOf);
  expect(blocked.status).toBe(403);
  expect(blocked.body.error).toContain('kaldırıldı');
  expect((await sale('cihaz-cccc-0003')).status).toBe(201);
  expect((await request(app).put('/api/scanner/devices/' + first.id).set('Authorization', 'Bearer ' + owner.token).send({ status: 'active' })).status).toBe(403);
  await db.query('UPDATE licenses SET max_devices=100 WHERE tenant_id=$1', [owner.tenantId]);
  expect((await request(app).put('/api/scanner/devices/' + first.id).set('Authorization', 'Bearer ' + owner.token).send({ status: 'active' })).status).toBe(200);
  expect((await sale(uidOf)).status).toBe(201);
});

test('cihaz kimliği göndermeyen eski istemci yine satar ve numara alır; geçersiz kimlik reddedilir', async () => {
  const old = await sale(null);
  expect(old.status).toBe(201);
  expect(old.body.local_receipt_no).toMatch(/-\d{5}$/);
  expect((await sale('kisa')).status).toBe(400);
});
