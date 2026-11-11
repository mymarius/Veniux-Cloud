process.env.AUTH_RATE_LIMIT_MAX = '1000';
const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const db = require('../src/config/database');
const { JWT_SECRET } = require('../src/middlewares/authMiddleware');
const webPush = require('../src/services/webPush');
const push = require('../src/services/pushNotifier');
const { createTenant, createWarehouse, createUser } = require('./factories');

const b64u = webPush.b64u;
// Telefon (alıcı) tarafı: anahtar çifti ve gizli değer
function phone() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { sub: (host = 'fcm.googleapis.com') => ({ endpoint: `https://${host}/fcm/send/${crypto.randomBytes(12).toString('hex')}`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } }), receiver: { uaPrivate: b64u(ecdh.getPrivateKey()), uaPublic: b64u(ecdh.getPublicKey()), auth: b64u(auth) } };
}
const fakeFetch = (status = 201, log = []) => async (url, init) => { log.push({ url, init }); return { status }; };

let owner, other, w, manager, waiter;
const as = who => ({ get: u => request(app).get(u).set('Authorization', 'Bearer ' + who.token), post: (u, b) => request(app).post(u).set('Authorization', 'Bearer ' + who.token).send(b), del: (u, b) => request(app).delete(u).set('Authorization', 'Bearer ' + who.token).send(b) });
const tokenFor = (id, tenantId, role) => ({ userId: id, tenantId, role, token: jwt.sign({ userId: id, tenantId, role }, JWT_SECRET) });

beforeAll(async () => {
  owner = await createTenant(); other = await createTenant();
  w = await createWarehouse(owner.tenantId);
  const m = await createUser(owner.tenantId, 'manager'), c = await createUser(owner.tenantId, 'cashier');
  manager = tokenFor(m.id, owner.tenantId, 'manager'); waiter = tokenFor(c.id, owner.tenantId, 'cashier');
});

describe('şifreleme (RFC 8291 aes128gcm)', () => {
  test('şifrelenen bildirim yalnız doğru telefonda açılır; her mesajda tuz ve anahtar farklıdır', () => {
    const p = phone(), s = p.sub(), text = JSON.stringify({ title: 'Sipariş geldi', body: 'Masa 4 · 2× Kıymalı pide' });
    const a = webPush.encrypt({ p256dh: s.keys.p256dh, auth: s.keys.auth }, text), b = webPush.encrypt({ p256dh: s.keys.p256dh, auth: s.keys.auth }, text);
    expect(webPush.decrypt(p.receiver, a).toString()).toBe(text);
    expect(a.equals(b)).toBe(false);
    expect(a.subarray(0, 16).equals(b.subarray(0, 16))).toBe(false);
    expect(a.readUInt32BE(16)).toBe(4096); expect(a[20]).toBe(65);
    const stranger = phone();
    expect(() => webPush.decrypt(stranger.receiver, a)).toThrow();
    const tampered = Buffer.from(a); tampered[tampered.length - 1] ^= 1;
    expect(() => webPush.decrypt(p.receiver, tampered)).toThrow();
  });

  test('geçersiz abonelik anahtarı ve çok büyük içerik reddedilir', () => {
    const p = phone(), s = p.sub();
    expect(() => webPush.encrypt({ p256dh: 'kisa', auth: s.keys.auth }, 'x')).toThrow(/geçersiz/);
    expect(() => webPush.encrypt({ p256dh: s.keys.p256dh, auth: 'kisa' }, 'x')).toThrow(/geçersiz/);
    expect(() => webPush.encrypt({ p256dh: s.keys.p256dh, auth: s.keys.auth }, 'x'.repeat(3001))).toThrow(/büyük/);
  });
});

describe('VAPID ve gönderim', () => {
  test('sunucu anahtarı kalıcıdır; JWT ES256 ile doğrulanır, hedef adresin kökü ve 12 saat süre içerir', async () => {
    const key = await webPush.vapid(); webPush.resetKeyCache();
    expect((await webPush.vapid()).publicKey).toBe(key.publicKey);
    expect((await db.query('SELECT private_sealed FROM push_vapid WHERE id=1')).rows[0].private_sealed.startsWith('enc1:')).toBe(true);
    const header = webPush.vapidHeader('https://fcm.googleapis.com/fcm/send/abc', await webPush.vapid(), 1_700_000_000_000);
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header).slice(0, 3).map((v, i) => (i === 0 ? v : v));
    const [h, c, sig] = token.split('.');
    const pub = Buffer.from(k, 'base64url');
    const publicKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' });
    expect(crypto.verify('sha256', Buffer.from(h + '.' + c), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(c, 'base64url'))).toMatchObject({ aud: 'https://fcm.googleapis.com', exp: 1_700_000_000 + 12 * 3600 });
    expect(JSON.parse(Buffer.from(h, 'base64url'))).toEqual({ typ: 'JWT', alg: 'ES256' });
  });

  test('yalnız bilinen push servislerine gidilir; http, IP, port, kullanıcı bilgisi ve yabancı alan adı reddedilir', () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/x']) expect([ok, webPush.validEndpoint(ok)]).toEqual([ok, true]);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://evil.example.com/x', 'https://fcm.googleapis.com.evil.com/x', 'https://fcm.googleapis.com:8443/x', 'https://user:pw@fcm.googleapis.com/x', 'ftp://fcm.googleapis.com/x', 'bozuk', '', null]) expect([String(bad), webPush.validEndpoint(bad)]).toEqual([String(bad), false]);
  });

  test('gönderim: başlıklar doğru, 201 başarılı, 410 abonelik bitmiş, ağ hatası geçici; geçersiz adrese istek atılmaz', async () => {
    const p = phone(), s = p.sub(), log = [];
    const ok = await webPush.send({ endpoint: s.endpoint, ...s.keys }, { title: 'x' }, { fetchImpl: fakeFetch(201, log) });
    expect(ok).toEqual({ ok: true, gone: false, status: 201 });
    const h = log[0].init.headers;
    expect(h['Content-Encoding']).toBe('aes128gcm'); expect(h.TTL).toBe('86400'); expect(h.Authorization).toMatch(/^vapid t=.+, k=.+$/);
    expect(JSON.parse(webPush.decrypt(p.receiver, log[0].init.body).toString())).toEqual({ title: 'x' });
    expect((await webPush.send({ endpoint: s.endpoint, ...s.keys }, {}, { fetchImpl: fakeFetch(410) })).gone).toBe(true);
    expect((await webPush.send({ endpoint: s.endpoint, ...s.keys }, {}, { fetchImpl: async () => { throw new Error('ağ'); } })).gone).toBe(false);
    const calls = [];
    expect((await webPush.send({ endpoint: 'https://evil.example.com/x', ...s.keys }, {}, { fetchImpl: fakeFetch(201, calls) })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('abonelik uçları', () => {
  test('kimlik doğrulama gerekir; anahtar iki kez aynı döner; geçersiz abonelik reddedilir', async () => {
    expect((await request(app).get('/api/push/key')).status).toBe(401);
    const a = (await as(manager).get('/api/push/key')).body.publicKey, b = (await as(waiter).get('/api/push/key')).body.publicKey;
    expect(a).toBe(b); expect(Buffer.from(a, 'base64url')).toHaveLength(65);
    const p = phone();
    for (const bad of [{ endpoint: 'https://evil.example.com/x', keys: p.sub().keys }, { endpoint: p.sub().endpoint, keys: { p256dh: 'x', auth: 'y' } }, {}, { endpoint: p.sub().endpoint }]) expect((await as(manager).post('/api/push/subscribe', bad)).status).toBe(400);
  });

  test('abone ol: aynı adres tekrar gelirse güncellenir (çift olmaz); kişi başı 10 sınırı; abonelikten çıkma yalnız sahibine', async () => {
    const p = phone(), s = p.sub();
    const first = await as(manager).post('/api/push/subscribe', s);
    expect(first.body.updated).toBe(false);
    expect((await as(manager).post('/api/push/subscribe', s)).body.updated).toBe(true);
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2', [owner.tenantId, manager.userId])).rows[0].c)).toBe(1);
    expect((await as(waiter).del('/api/push/subscribe', { endpoint: s.endpoint })).body.removed).toBe(0);
    expect((await as(manager).del('/api/push/subscribe', { endpoint: s.endpoint })).body.removed).toBe(1);
    for (let i = 0; i < 13; i++) await as(waiter).post('/api/push/subscribe', phone().sub());
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM push_subscriptions WHERE tenant_id=$1 AND user_id=$2', [owner.tenantId, waiter.userId])).rows[0].c)).toBe(10);
    await db.query('DELETE FROM push_subscriptions WHERE tenant_id=$1', [owner.tenantId]);
  });

  test('deneme bildirimi: abonelik yoksa 409', async () => {
    expect((await as(manager).post('/api/push/test', {})).status).toBe(409);
  });
});

describe('bildirim dağıtımı', () => {
  beforeEach(() => db.query('DELETE FROM push_subscriptions WHERE tenant_id IN ($1,$2)', [owner.tenantId, other.tenantId]));
  const addSub = async (who, s) => (await as(who).post('/api/push/subscribe', s)).status;

  test('yalnız yöneticilere gider; siparişi giren hariç; başka işletmeye sızmaz; bitmiş abonelik silinir', async () => {
    const pm = phone(), pw = phone(), po = phone(), sm = pm.sub(), sw = pw.sub(), so = po.sub('updates.push.services.mozilla.com');
    await addSub(manager, sm); await addSub(waiter, sw);
    const stranger = tokenFor((await createUser(other.tenantId, 'manager')).id, other.tenantId, 'manager'); await addSub(stranger, so);
    const log = [];
    const r = await push.notifyTenant(owner.tenantId, { title: 'Sipariş geldi', body: 'Masa 1' }, { options: { fetchImpl: fakeFetch(201, log) } });
    expect(r.sent).toBe(1); expect(log).toHaveLength(1); expect(log[0].url).toBe(sm.endpoint);
    expect(JSON.parse(webPush.decrypt(pm.receiver, log[0].init.body).toString())).toMatchObject({ title: 'Sipariş geldi', body: 'Masa 1' });
    expect((await push.notifyTenant(owner.tenantId, { title: 'x' }, { exceptUser: manager.userId, options: { fetchImpl: fakeFetch(201) } })).sent).toBe(0);
    const gone = await push.notifyTenant(owner.tenantId, { title: 'x' }, { options: { fetchImpl: fakeFetch(410) } });
    expect(gone.removed).toBe(1);
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM push_subscriptions WHERE tenant_id=$1', [owner.tenantId])).rows[0].c)).toBe(1); // yalnız kasiyerin aboneliği kaldı
  });

  test('geçici hata 5 kez üst üste olursa abonelik silinir; başarı sayacı sıfırlar', async () => {
    const p = phone(), s = p.sub(); await addSub(manager, s);
    for (let i = 0; i < 4; i++) await push.notifyTenant(owner.tenantId, { title: 'x' }, { options: { fetchImpl: fakeFetch(503) } });
    expect(Number((await db.query('SELECT failures FROM push_subscriptions WHERE tenant_id=$1', [owner.tenantId])).rows[0].failures)).toBe(4);
    await push.notifyTenant(owner.tenantId, { title: 'x' }, { options: { fetchImpl: fakeFetch(201) } });
    expect(Number((await db.query('SELECT failures FROM push_subscriptions WHERE tenant_id=$1', [owner.tenantId])).rows[0].failures)).toBe(0);
    for (let i = 0; i < 5; i++) await push.notifyTenant(owner.tenantId, { title: 'x' }, { options: { fetchImpl: fakeFetch(503) } });
    expect(Number((await db.query('SELECT COUNT(*) AS c FROM push_subscriptions WHERE tenant_id=$1', [owner.tenantId])).rows[0].c)).toBe(0);
  });

  test('kritik stok özeti: hırdavat paketi şart; yeni kritik ürün bildirilir, aynısı tekrar bildirilmez, biten ürün yeniden bildirilir', async () => {
    const p = phone(); await addSub(manager, p.sub());
    const vida = (await db.query("INSERT INTO products(tenant_id,sku,name,barcode,unit,sale_price,min_stock_level,module_type) VALUES($1,'PN-1','Vida M3','PN-1','kutu',5,100,'NORMAL') RETURNING id", [owner.tenantId])).rows[0];
    await db.query('INSERT INTO stock_records(tenant_id,warehouse_id,product_id,quantity) VALUES($1,$2,$3,40)', [owner.tenantId, w.id, vida.id]);
    const log = [];
    const run = () => push.digest(owner.tenantId, { fetchImpl: fakeFetch(201, log) });
    expect(await run()).toEqual({ skipped: 'paket yok' });
    await db.query("INSERT INTO sector_packs(tenant_id,pack) VALUES($1,'hardware')", [owner.tenantId]);
    expect((await run()).notified).toBe(1); expect(log).toHaveLength(1);
    expect(JSON.parse(webPush.decrypt(p.receiver, log[0].init.body).toString())).toMatchObject({ title: 'Kritik stok', url: '/m/kritik' });
    expect((await run()).notified).toBe(0); expect(log).toHaveLength(1);
    await db.query('UPDATE stock_records SET quantity=0 WHERE product_id=$1', [vida.id]);
    expect((await run()).notified).toBe(1); expect(log).toHaveLength(2);
    await db.query('DELETE FROM sector_packs WHERE tenant_id=$1', [owner.tenantId]);
  });

  test('sipariş bildirimi: masa adı ve kalemler gövdede, ekleme ayrı başlıkla', async () => {
    const p = phone(); await addSub(manager, p.sub());
    const log = [];
    const user = { tenantId: owner.tenantId, userId: waiter.userId };
    await push.orderCreated(user, { order_id: 7, appended: false, type: 'masa', items: [{ quantity: 2, name: 'Kıymalı pide' }, { quantity: 1, name: 'Ayran' }] }, 'Masa 4', { fetchImpl: fakeFetch(201, log) });
    const body = JSON.parse(webPush.decrypt(p.receiver, log[0].init.body).toString());
    expect(body).toMatchObject({ title: 'Sipariş geldi', body: 'Masa 4 · 2× Kıymalı pide, 1× Ayran', url: '/m/esnaf', tag: 'order-7' });
    await push.orderCreated(user, { order_id: 7, appended: true, type: 'motor', items: [{ quantity: 1, name: 'Çay' }] }, null, { fetchImpl: fakeFetch(201, log) });
    expect(JSON.parse(webPush.decrypt(p.receiver, log[1].init.body).toString())).toMatchObject({ title: 'Siparişe ekleme', body: 'Motor · 1× Çay' });
  });
});
