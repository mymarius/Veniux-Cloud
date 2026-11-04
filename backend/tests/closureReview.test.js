// A non-default local port must work without admitting unrelated websites.
process.env.PORT = '44079';
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const {createTenant} = require('./factories');
let owner;
beforeAll(async()=>{owner=await createTenant();});
test.each(['http://127.0.0.1:44079','http://localhost:44079'])('same configured local origin can access the authenticated API: %s', async origin=>{
 const response=await request(app).get('/api/auth/me').set('Origin',origin).set('Authorization','Bearer '+owner.token);
 expect(response.status).toBe(200);
 expect(response.headers['access-control-allow-origin']).toBe(origin);
});
test.each(['http://127.0.0.1:44080','https://foreign.invalid'])('unconfigured origin is rejected before a stock write: %s',async origin=>{
 const before=db.getDb().prepare('SELECT COUNT(*) n FROM stock_movements').get().n;
 expect((await request(app).post('/api/stock/import').set('Origin',origin).set('Authorization','Bearer '+owner.token).send({data:[]})).status).toBe(403);
 expect(db.getDb().prepare('SELECT COUNT(*) n FROM stock_movements').get().n).toBe(before);
});
test('system diagnostic reports the active database rather than an unverified bridge',async()=>{
 const r=await request(app).get('/api/settings/system-engine').set('Authorization','Bearer '+owner.token);
 expect(r.status).toBe(200);expect(r.body.engine).toBe('SQLite');
 expect(r.body.journalMode).toBe(db.getDb().pragma('journal_mode',{simple:true}));
 expect(r.body.services.cronJobs).not.toContain('ACTIVE');
 expect(r.body.services.telegramBridge).not.toBe('ONLINE');
});
