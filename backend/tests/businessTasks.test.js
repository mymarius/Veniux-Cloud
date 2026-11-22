const request = require('supertest'), app = require('../src/index'), db = require('../src/config/database'), f = require('./factories');
const svc = require('../src/services/businessTaskService');
let owner, cashier, lead, viewer, other;
const as = (u, r) => r.set('Authorization', 'Bearer ' + u.token);
async function login(tenantId, role) {
  const u = await f.createUser(tenantId, role);
  const res = await request(app).post('/api/auth/login').send({ email: u.email, password: 'password123' });
  return { ...u, token: res.body.token };
}
const day = n => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + n * 86400000));
beforeAll(async () => {
  owner = await f.createTenant(); other = await f.createTenant();
  cashier = await login(owner.tenantId, 'cashier'); lead = await login(owner.tenantId, 'warehouse_lead'); viewer = await login(owner.tenantId, 'viewer');
});

test('yönetici görev atar; atanan kasiyer yalnız kendi görevini görür', async () => {
  const a = await as(owner, request(app).post('/api/tasks')).send({ title: 'Reyonları say', description: 'Süt reyonu', assignee_id: cashier.id, due_date: day(2), priority: 'high' });
  expect(a.status).toBe(201);
  expect(a.body).toMatchObject({ title: 'Reyonları say', status: 'open', priority: 'high', assignee_id: cashier.id, overdue: false });
  const b = await as(owner, request(app).post('/api/tasks')).send({ title: 'Depo sayımı', assignee_id: lead.id });
  expect(b.status).toBe(201);
  const mine = await as(cashier, request(app).get('/api/tasks'));
  expect(mine.body.tasks.map(t => t.title)).toEqual(['Reyonları say']);
  expect(mine.body.can_manage).toBe(false);
  expect((await as(owner, request(app).get('/api/tasks'))).body.tasks.length).toBe(2);
  expect((await as(owner, request(app).get('/api/tasks?assignee=' + lead.id))).body.tasks.map(t => t.title)).toEqual(['Depo sayımı']);
  expect((await as(cashier, request(app).get('/api/tasks/badge'))).body).toEqual({ open: 1, overdue: 0 });
});

test('yetkisizler görev oluşturamaz, düzenleyemez, silemez; başkasının görevi görünmez', async () => {
  expect((await as(cashier, request(app).post('/api/tasks')).send({ title: 'x' })).status).toBe(403);
  const mineId = (await as(cashier, request(app).get('/api/tasks'))).body.tasks[0].id;
  expect((await as(cashier, request(app).put('/api/tasks/' + mineId)).send({ title: 'y' })).status).toBe(403);
  expect((await as(cashier, request(app).delete('/api/tasks/' + mineId))).status).toBe(403);
  expect((await as(cashier, request(app).get('/api/tasks/assignees'))).status).toBe(403);
  const leadTask = (await as(lead, request(app).get('/api/tasks'))).body.tasks[0].id;
  expect((await as(cashier, request(app).patch(`/api/tasks/${leadTask}/status`)).send({ status: 'done' })).status).toBe(404);
  expect((await as(viewer, request(app).patch(`/api/tasks/${leadTask}/status`)).send({ status: 'done' })).status).toBe(403);
  expect((await as(viewer, request(app).get('/api/tasks'))).body.tasks).toEqual([]);
});

test('başka işletme görevleri görünmez ve atanamaz', async () => {
  const t = await as(owner, request(app).post('/api/tasks')).send({ title: 'Gizli' });
  expect((await as(other, request(app).get('/api/tasks'))).body.tasks).toEqual([]);
  expect((await as(other, request(app).put('/api/tasks/' + t.body.id)).send({ title: 'ele geçirildi' })).status).toBe(404);
  expect((await as(other, request(app).delete('/api/tasks/' + t.body.id))).status).toBe(404);
  expect((await as(owner, request(app).post('/api/tasks')).send({ title: 'Yabancı', assignee_id: other.userId })).status).toBe(404);
});

test('durum akışı: açık → yapılıyor → bitti; açılış ve bitiş denetim kaydına yazılır', async () => {
  const t = (await as(owner, request(app).post('/api/tasks')).send({ title: 'Denetimli görev', assignee_id: cashier.id })).body;
  let r = await as(cashier, request(app).patch(`/api/tasks/${t.id}/status`)).send({ status: 'doing' });
  expect(r.body.status).toBe('doing');
  r = await as(cashier, request(app).patch(`/api/tasks/${t.id}/status`)).send({ status: 'done' });
  expect(r.body.status).toBe('done');
  expect(r.body.completed_at).toBeTruthy();
  expect((await as(cashier, request(app).patch(`/api/tasks/${t.id}/status`)).send({ status: 'bogus' })).status).toBe(400);
  const logs = (await db.query("SELECT action,user_email FROM audit_logs WHERE tenant_id=$1 AND entity_type='business_task' AND entity_id=$2 ORDER BY id", [owner.tenantId, t.id])).rows;
  expect(logs.map(l => l.action)).toEqual(['task.created', 'task.status_changed', 'task.completed']);
  expect(logs[0].user_email).toBe(owner.email);
  expect(logs[2].user_email).toBe(cashier.email);
  r = await as(owner, request(app).put('/api/tasks/' + t.id)).send({ status: 'open' });
  expect(r.body).toMatchObject({ status: 'open', completed_at: null });
  const last = (await db.query("SELECT action FROM audit_logs WHERE entity_type='business_task' AND entity_id=$1 ORDER BY id DESC LIMIT 1", [t.id])).rows[0];
  expect(last.action).toBe('task.reopened');
});

test('vadesi geçen açık görev vurgulanır; biten görev vurgulanmaz; vade günü İstanbul saatine göre', async () => {
  const late = (await as(owner, request(app).post('/api/tasks')).send({ title: 'Geciken', assignee_id: cashier.id, due_date: day(-3) })).body;
  expect(late.overdue).toBe(true);
  const list = (await as(cashier, request(app).get('/api/tasks'))).body;
  expect(list.summary.overdue).toBe(1);
  expect(list.tasks[0].title).toBe('Geciken');
  await as(cashier, request(app).patch(`/api/tasks/${late.id}/status`)).send({ status: 'done' });
  const again = (await as(cashier, request(app).get('/api/tasks'))).body;
  expect(again.summary.overdue).toBe(0);
  expect(again.tasks.find(t => t.id === late.id).overdue).toBe(false);
  expect(svc.today(new Date('2026-11-22T22:30:00Z'))).toBe('2026-11-23');
});

test('doğrulama; atama değişimi ve silme denetime yazılır', async () => {
  expect((await as(owner, request(app).post('/api/tasks')).send({ title: '  ' })).status).toBe(400);
  expect((await as(owner, request(app).post('/api/tasks')).send({ title: 'a', due_date: '31/12/2026' })).status).toBe(400);
  expect((await as(owner, request(app).post('/api/tasks')).send({ title: 'a', priority: 'acil' })).status).toBe(400);
  const t = (await as(owner, request(app).post('/api/tasks')).send({ title: 'Devredilecek', assignee_id: cashier.id })).body;
  const moved = await as(owner, request(app).put('/api/tasks/' + t.id)).send({ assignee_id: lead.id, priority: 'urgent' });
  expect(moved.body).toMatchObject({ assignee_id: lead.id, priority: 'urgent' });
  expect((await as(cashier, request(app).get('/api/tasks'))).body.tasks.some(x => x.id === t.id)).toBe(false);
  expect((await as(owner, request(app).delete('/api/tasks/' + t.id))).status).toBe(200);
  const acts = (await db.query("SELECT action FROM audit_logs WHERE entity_type='business_task' AND entity_id=$1 ORDER BY id", [t.id])).rows.map(r => r.action);
  expect(acts).toEqual(['task.created', 'task.assigned', 'task.deleted']);
  const people = (await as(owner, request(app).get('/api/tasks/assignees'))).body;
  expect(people.map(p => p.id)).toEqual(expect.arrayContaining([cashier.id, lead.id]));
});
