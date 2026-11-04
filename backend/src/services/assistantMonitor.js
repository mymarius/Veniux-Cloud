const db = require('../config/database');
const crypto = require('crypto');
const proposals = new Map();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
async function overview(user) {
  const tenant = user.tenantId;
  const rows = async sql => (await db.query(sql, [tenant])).rows;
  const stock = await rows(`SELECT p.id,p.name,p.sku,p.min_stock_level,COALESCE(SUM(s.quantity),0) quantity
    FROM products p LEFT JOIN stock_records s ON s.product_id=p.id AND s.tenant_id=p.tenant_id
    WHERE p.tenant_id=$1 GROUP BY p.id HAVING COALESCE(SUM(s.quantity),0)<=p.min_stock_level
    ORDER BY quantity ASC,p.id ASC`);
  const alerts = await rows("SELECT id,severity,message,created_at FROM alerts WHERE tenant_id=$1 AND status IN ('unread','active') ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'danger' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,id DESC");
  const orders = await rows('SELECT status,COUNT(*) count FROM purchase_orders WHERE tenant_id=$1 GROUP BY status');
  const counts = await rows('SELECT status,COUNT(*) count FROM stock_counts WHERE tenant_id=$1 GROUP BY status');
  const totals = (await rows(`SELECT COUNT(*) product_count,COALESCE(SUM(q.quantity),0) stock_units FROM products p
    LEFT JOIN (SELECT product_id,SUM(quantity) quantity FROM stock_records WHERE tenant_id=$1 GROUP BY product_id) q ON q.product_id=p.id WHERE p.tenant_id=$1`))[0];
  const workspaces = await rows("SELECT scope,payload FROM workspace_collections WHERE tenant_id=$1 AND name='workspace'");
  let overdueTasks = 0, employees = 0, openDeals = 0;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
  for (const row of workspaces) {
    const data = JSON.parse(row.payload);
    if (row.scope === 'crm') {
      overdueTasks += (data.tasks || []).filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < today).length;
      openDeals += (data.deals || []).filter(d => !['won', 'lost'].includes(d.stage)).length;
    }
    if (row.scope === 'hr') employees += (data.employees || []).filter(e => e.status !== 'ayrildi').length;
  }
  const warnings = alerts.slice(0, 10).map(a => ({ key: `alert:${a.id}`, alert_id: a.id, severity: a.severity, message: a.message, path: '/alerts' }));
  for (const p of stock.slice(0, 5)) warnings.push({ key: `stock:${p.id}:${p.quantity}:${p.min_stock_level}`, severity: Number(p.quantity) <= 0 ? 'critical' : 'warning', message: `${p.name}: stok ${p.quantity}, minimum seviye ${p.min_stock_level}.`, path: '/normal-depo/products' });
  if (overdueTasks) warnings.push({ key: `crm:overdue:${overdueTasks}:${today}`, severity: 'warning', message: `${overdueTasks} CRM görevinin teslim tarihi geçti.`, path: '/crm/dashboard' });
  let expiry = 0, coldAlarms = 0;

  const critical = warnings.filter(w => ['critical', 'danger'].includes(w.severity));
  const stockUnits=Number(totals.stock_units).toLocaleString('tr-TR',{maximumFractionDigits:6});
  const summary = `${totals.product_count} ürün ve ${stockUnits} stok birimini takip ediyorum. Minimum seviyeye ulaşan ${stock.length} ürün, ${alerts.length} açık uyarı ve ${overdueTasks} gecikmiş CRM görevi var.`;
  return { captured_at: new Date().toISOString(), summary, totals: { ...totals, low_stock: stock.length, open_alerts: alerts.length, overdue_tasks: overdueTasks, open_deals: openDeals, employees, expired_lots: expiry, cold_alarms: coldAlarms }, purchase_orders: orders, stock_counts: counts,
    warnings: [...critical, ...warnings.filter(w => !['critical', 'danger'].includes(w.severity))],
    suggestions: ['Bugünkü önceliklerimi özetle', 'Stok risklerini ve satın alma ihtiyacını değerlendir', 'CRM ve personel durumunu özetle'],
    scope: 'Stok, satın alma, sayım, uyarılar, CRM/personel özetleri. Panel açıkken dakikada bir kontrol edilir.' };
}
async function prepare(user, body, context) {
  const { kind, alert_id } = body || {};
  let title, impact, plan;
  if (kind === 'analysis') {
    title = 'İşletme analizi başlat';
    impact = 'Güncel stok kayıtları analiz edilir. Yeni AI uyarıları ve analiz özeti kaydedilebilir. Stok miktarları değiştirilmez.';
  } else if (kind === 'alert_read' && Number.isSafeInteger(alert_id) && alert_id > 0) {
    const alert = (await db.query('SELECT id,message FROM alerts WHERE tenant_id=$1 AND id=$2', [user.tenantId, alert_id])).rows[0];
    if (!alert) throw fail('Uyarı bulunamadı.', 404);
    title = 'Uyarıyı okundu olarak işaretle'; impact = alert.message;
  } else if(['system_operation','workspace_record'].includes(kind)) {
    plan=await require('./assistantSystemOperations').prepare(user,body.args,context,kind);
    if(plan.requires_file)return {title:plan.title,impact:plan.impact,requires_file:true,file_request:{kind,args:plan.params},confirmation_required:true};
    title=plan.title;impact=plan.impact;
  } else {plan=await require('./assistantActions').prepare(user,kind,body.args);title=plan.title;impact=plan.impact;}
  for (const [key, p] of proposals) if (p.expires_at < Date.now()) proposals.delete(key);
  if (proposals.size >= 1000) throw fail('Onay kuyruğu dolu. Biraz sonra deneyin.', 429);
  const id = crypto.randomUUID(), expires_at = Date.now() + 5 * 60000;
  proposals.set(id, { kind, alert_id, plan, user_id: user.userId, tenant_id: user.tenantId, expires_at });
    return { id, title, impact, expires_at, confirmation_required: true, deletion_required: kind==='crm_task_delete'||Boolean(plan?.deletion) };
}
async function execute(user, body, context) {
  if (body?.confirmed !== true) throw fail('İşlem için açık onay gerekli.');
  const p = proposals.get(body.id);
  if (!p || p.expires_at < Date.now() || p.user_id !== user.userId || p.tenant_id !== user.tenantId) throw fail('Onay geçersiz veya süresi dolmuş.', 409);
  if((p.kind==='crm_task_delete'||p.plan?.deletion)&&body.deletion_confirmed!==true)throw fail('Kalıcı silme için ayrı açık onay gerekli.',400);
  proposals.delete(body.id);
  if(['system_operation','workspace_record'].includes(p.kind))return require('./assistantSystemOperations').execute(user,p.plan,context);
  if(p.plan)return db.transaction(client=>require('./assistantActions').execute(client,user,p.plan));
  if (p.kind === 'analysis') {
    const result = await require('./aiAnalysisService').runAIAnalysis(user.tenantId);
    if (result.skipped) throw fail(result.reason, 503);
    await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) VALUES ($1,$2,$3,$4,$5)', [user.tenantId, user.email, 'assistant_analysis_approved', 'ai', JSON.stringify({ user_id: user.userId, created: result.created })]);
    return { reply: `Analiz tamamlandı. ${result.created} yeni uyarı kaydedildi. ${result.summary || ''}` };
  }
  return db.transaction(async client => {
    const result = await client.query("UPDATE alerts SET status='read' WHERE tenant_id=$1 AND id=$2", [user.tenantId, p.alert_id]);
    if (!result.rowCount) throw fail('Uyarı bulunamadı.', 404);
    await client.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'assistant_alert_read_approved', 'alert', p.alert_id, JSON.stringify({ user_id: user.userId })]);
    return { reply: 'Uyarı onayınızla okundu olarak işaretlendi. Uyarıya neden olan operasyon sorunu ayrıca giderilmelidir.' };
  });
}
module.exports = { overview, prepare, execute };
