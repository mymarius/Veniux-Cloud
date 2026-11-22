// İşletme içi görevler. Yetki: admin/manager atar, düzenler, siler ve hepsini görür;
// diğer roller (kasiyer, depo sorumlusu, görüntüleyici) yalnız kendilerine atananları görür; kasiyer/depo sorumlusu durumunu değiştirebilir.
const db = require('../config/database');
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };

const STATUSES = ['open', 'doing', 'done'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const MANAGERS = ['admin', 'manager'];
const WORKERS = ['cashier', 'warehouse_lead'];
const isManager = user => MANAGERS.includes(user.role);

// İstanbul takvim günü (vade karşılaştırması işletmenin günüdür, sunucu saat dilimi değil).
const today = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(now);

function view(row, day) {
  return {
    id: Number(row.id), title: row.title, description: row.description || '', assignee_id: row.assignee_id === null ? null : Number(row.assignee_id),
    assignee_name: row.assignee_name || row.assignee_email || null, assignee_email: row.assignee_email || null, created_by: row.created_by === null ? null : Number(row.created_by),
    due_date: row.due_date || null, status: row.status, priority: row.priority, completed_at: row.completed_at || null, created_at: row.created_at, updated_at: row.updated_at,
    overdue: !!row.due_date && row.status !== 'done' && row.due_date < day
  };
}

const SELECT = 'SELECT t.*,u.email AS assignee_email,u.full_name AS assignee_name FROM business_tasks t LEFT JOIN users u ON u.id=t.assignee_id';

function cleanText(value, label, max, required) {
  const text = String(value ?? '').trim();
  if (required && !text) fail(label + ' gerekli.');
  if (text.length > max) fail(label + ' en fazla ' + max + ' karakter olabilir.');
  return text;
}
function cleanDue(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text + 'T00:00:00Z'))) fail('Vade tarihi geçersiz.');
  return text;
}

async function assertAssignee(tx, user, id) {
  if (id === undefined || id === null || id === '') return null;
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n < 1) fail('Atanan kullanıcı geçersiz.');
  const found = (await tx.query('SELECT id FROM users WHERE id=$1 AND tenant_id=$2', [n, user.tenantId])).rows[0];
  if (!found) fail('Atanan kullanıcı bu işletmeye ait değil.', 404);
  return n;
}

async function audit(tx, user, action, task, details) {
  await tx.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',
    [user.tenantId, user.email, action, 'business_task', task.id, JSON.stringify({ title: task.title, ...details })]);
}

async function load(tx, user, id) {
  const row = (await tx.query(SELECT + ' WHERE t.id=$1 AND t.tenant_id=$2', [id, user.tenantId])).rows[0];
  if (!row) fail('Görev bulunamadı.', 404);
  // Yönetici olmayan yalnız kendi görevini görür; başkasının görevi "yok" gibi davranır.
  if (!isManager(user) && Number(row.assignee_id) !== Number(user.userId)) fail('Görev bulunamadı.', 404);
  return row;
}

async function list(user, query = {}) {
  const day = today();
  const where = ['t.tenant_id=$1'], params = [user.tenantId];
  if (!isManager(user)) { params.push(user.userId); where.push('t.assignee_id=$' + params.length); }
  else if (query.assignee === 'me') { params.push(user.userId); where.push('t.assignee_id=$' + params.length); }
  else if (query.assignee && Number.isSafeInteger(Number(query.assignee))) { params.push(Number(query.assignee)); where.push('t.assignee_id=$' + params.length); }
  else if (query.assignee === 'none') where.push('t.assignee_id IS NULL');
  const rows = (await db.query(SELECT + ' WHERE ' + where.join(' AND ') + " ORDER BY CASE t.status WHEN 'done' THEN 1 ELSE 0 END, CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.id DESC LIMIT 500", params)).rows;
  const all = rows.map(r => view(r, day));
  // Özet kartları durum süzgecinden bağımsızdır (kişi süzgecine bağlıdır).
  const summary = { open: 0, doing: 0, done: 0, overdue: 0 };
  for (const t of all) { summary[t.status]++; if (t.overdue) summary.overdue++; }
  const tasks = query.status === 'active' ? all.filter(t => t.status !== 'done') : STATUSES.includes(query.status) ? all.filter(t => t.status === query.status) : all;
  return { tasks, summary, today: day, can_manage: isManager(user) };
}

async function create(user, body = {}) {
  if (!isManager(user)) fail('Görev atamak için yönetici yetkisi gerekir.', 403);
  const title = cleanText(body.title, 'Başlık', 160, true), description = cleanText(body.description, 'Açıklama', 4000, false);
  const due = cleanDue(body.due_date);
  const priority = body.priority === undefined ? 'normal' : body.priority;
  if (!PRIORITIES.includes(priority)) fail('Öncelik geçersiz.');
  return db.transaction(async tx => {
    const assignee = await assertAssignee(tx, user, body.assignee_id);
    const row = (await tx.query('INSERT INTO business_tasks(tenant_id,title,description,assignee_id,created_by,due_date,priority) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id', [user.tenantId, title, description || null, assignee, user.userId, due, priority])).rows[0];
    await audit(tx, user, 'task.created', { id: row.id, title }, { assignee_id: assignee, due_date: due, priority });
    return view(await load(tx, user, row.id), today());
  });
}

// Yönetici: tüm alanlar. Atanan çalışan: yalnız durum (changeStatus).
async function update(user, id, body = {}) {
  if (!isManager(user)) fail('Görevi düzenlemek için yönetici yetkisi gerekir.', 403);
  return db.transaction(async tx => {
    const cur = await load(tx, user, id);
    const next = {
      title: body.title === undefined ? cur.title : cleanText(body.title, 'Başlık', 160, true),
      description: body.description === undefined ? cur.description : (cleanText(body.description, 'Açıklama', 4000, false) || null),
      due_date: body.due_date === undefined ? cur.due_date : cleanDue(body.due_date),
      priority: body.priority === undefined ? cur.priority : body.priority,
      assignee_id: body.assignee_id === undefined ? cur.assignee_id : await assertAssignee(tx, user, body.assignee_id)
    };
    if (!PRIORITIES.includes(next.priority)) fail('Öncelik geçersiz.');
    await tx.query('UPDATE business_tasks SET title=$1,description=$2,due_date=$3,priority=$4,assignee_id=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$6 AND tenant_id=$7', [next.title, next.description, next.due_date, next.priority, next.assignee_id, id, user.tenantId]);
    if (Number(next.assignee_id || 0) !== Number(cur.assignee_id || 0)) await audit(tx, user, 'task.assigned', cur, { from: cur.assignee_id, to: next.assignee_id });
    if (body.status !== undefined && body.status !== cur.status) await setStatus(tx, user, cur, body.status);
    return view(await load(tx, user, id), today());
  });
}

async function setStatus(tx, user, cur, status) {
  if (!STATUSES.includes(status)) fail('Durum geçersiz.');
  if (status === cur.status) return;
  if (status === 'done') await tx.query("UPDATE business_tasks SET status='done',completed_at=CURRENT_TIMESTAMP,completed_by=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3", [user.userId, cur.id, user.tenantId]);
  else await tx.query('UPDATE business_tasks SET status=$1,completed_at=NULL,completed_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND tenant_id=$3', [status, cur.id, user.tenantId]);
  await audit(tx, user, status === 'done' ? 'task.completed' : cur.status === 'done' ? 'task.reopened' : 'task.status_changed', cur, { from: cur.status, to: status });
}

async function changeStatus(user, id, status) {
  if (!isManager(user) && !WORKERS.includes(user.role)) fail('Görev durumunu değiştirme yetkiniz yok.', 403);
  return db.transaction(async tx => {
    const cur = await load(tx, user, id);
    await setStatus(tx, user, cur, status);
    return view(await load(tx, user, id), today());
  });
}

async function remove(user, id) {
  if (!isManager(user)) fail('Görevi silmek için yönetici yetkisi gerekir.', 403);
  return db.transaction(async tx => {
    const cur = await load(tx, user, id);
    await tx.query('DELETE FROM business_tasks WHERE id=$1 AND tenant_id=$2', [id, user.tenantId]);
    await audit(tx, user, 'task.deleted', cur, { status: cur.status });
    return { ok: true };
  });
}

async function assignees(user) {
  if (!isManager(user)) fail('Bu işlem için yetkiniz yok.', 403);
  return (await db.query('SELECT id,email,full_name,role FROM users WHERE tenant_id=$1 ORDER BY COALESCE(full_name,email)', [user.tenantId])).rows.map(r => ({ id: Number(r.id), email: r.email, name: r.full_name || r.email, role: r.role }));
}

// Kasiyer/depocu için kısa özet (rozet): açık ve vadesi geçen görev sayısı.
async function badge(user) {
  const { summary } = await list(user, { status: 'active' });
  return { open: summary.open + summary.doing, overdue: summary.overdue };
}

module.exports = { list, create, update, changeStatus, remove, assignees, badge, today, STATUSES, PRIORITIES };
