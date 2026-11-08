const request = require('supertest');
const app = require('../src/index');
const { fullyShown } = require('../src/services/assistantSystemOperations');
const { createTenant } = require('./factories/index');

test('onay kartında kısaltılacak işlem hazırlanmaz', () => {
  expect(fullyShown({ name: 'Ürün', items: [{ sku: 'A', qty: 1 }] })).toBe(true);
  expect(fullyShown({ rows: Array.from({ length: 101 }, (_, i) => i) })).toBe(false);
  expect(fullyShown({ note: 'x'.repeat(4001) })).toBe(false);
  expect(fullyShown({ a: { b: { c: { d: { e: 1 } } } } })).toBe(false);
});

describe('HTTP', () => {
  let owner;
  beforeAll(async () => { owner = await createTenant(); });
  test('asistan dosyası boyutu belleğe alınmadan reddedilir', async () => {
    const r = await request(app).post('/api/ai/actions/files').set('Authorization', 'Bearer ' + owner.token).set('Content-Type', 'application/octet-stream').set('Content-Length', String(41 * 1024 * 1024)).send(Buffer.alloc(10));
    expect(r.status).toBe(413);
    expect(r.body.error).toContain('40 MB');
  });
  test('terminal kaydı yönetici dışındakilere kapalı', async () => {
    const pool = require('../src/config/database');
    await pool.query("UPDATE users SET role='viewer' WHERE id=$1", [owner.userId]);
    try {
      const r = await request(app).post('/api/terminal/register').set('Authorization', 'Bearer ' + owner.token).send({ device_uid: 'VIEW-1' });
      expect(r.status).toBe(403);
    } finally { await pool.query("UPDATE users SET role='admin' WHERE id=$1", [owner.userId]); }
  });
});
