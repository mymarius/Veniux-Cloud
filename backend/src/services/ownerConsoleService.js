// Yönetim sitesinin bulut tarafında yapabildiği işlemler: hesaba erişimi kapatma/açma ve paket kataloğunda fiyat/satış durumu düzenleme.
// Her işlem denetim kaydına "yonetim-sitesi" adıyla ve gerekçeyle yazılır.
const db = require('../config/database');
const packages = require('./productPackages');
const fail = (message, status = 400, code) => { throw Object.assign(new Error(message), { status, ...(code ? { code } : {}) }); };
const ACTOR = { isPlatformAdmin: true, email: 'yonetim-sitesi', userId: null };

function reasonOf(value) {
  const r = typeof value === 'string' ? value.trim() : '';
  if (r.length < 5 || r.length > 300) fail('Gerekçe en az 5 karakter olmalı.', 422, 'BAD_REASON');
  return r;
}
// Hesaba erişimi kapat/aç (tenants.is_active). Platform yöneticisinin kendi işletmesi kapatılamaz.
async function setTenantAccess(tenantId, active, reason) {
  const id = Number(tenantId);
  if (!Number.isSafeInteger(id) || id < 1) fail('Geçersiz işletme.', 422, 'BAD_TENANT');
  if (typeof active !== 'boolean') fail('Erişim durumu (active) true ya da false olmalı.', 422, 'BAD_ACTIVE');
  const why = reasonOf(reason);
  await db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM tenants WHERE id=$1', [id])).rows.length) fail('İşletme bulunamadı.', 404, 'NO_TENANT');
    if ((await tx.query('SELECT p.user_id FROM platform_admins p JOIN users u ON u.id=p.user_id WHERE u.tenant_id=$1', [id])).rows.length) fail('Platform yöneticisi işletmesi kapatılamaz.', 403, 'PROTECTED');
    await tx.query('UPDATE tenants SET is_active=$1 WHERE id=$2', [active ? 1 : 0, id]);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [id, ACTOR.email, 'tenant_access_changed', 'tenant', id, JSON.stringify({ active, reason: why, via: 'yonetim-sitesi' })]);
  });
  return { tenant_id: id, active };
}
async function catalogue() { const c = await packages.catalogue(); return { revision: c.revision, plans: c.plans }; }
// Katalogdaki tek bir planın yıllık fiyatını (kuruş) ve satışa açık/kapalı durumunu değiştirir. Eşzamanlı değişiklikte revizyon uyuşmazlığı 409 verir.
async function setPlan(code, body = {}) {
  if (!/^[A-Z]+_[A-Z0-9_]{2,40}$/.test(String(code))) fail('Geçersiz paket kodu.', 422, 'BAD_CODE');
  const why = reasonOf(body.reason);
  const current = await packages.catalogue();
  if (Number(body.revision) !== current.revision) fail('Katalog başka biri tarafından değiştirilmiş. Sayfayı yenileyin.', 409, 'REVISION_CONFLICT');
  const plan = current.plans.find(p => p.code === code);
  if (!plan) fail('Paket bulunamadı.', 404, 'NO_PLAN');
  const next = { ...plan };
  if (body.annual_cents !== undefined) {
    if (body.annual_cents === null) next.annual_cents = null;
    else if (!Number.isSafeInteger(body.annual_cents) || body.annual_cents < 100 || body.annual_cents > 100000000) fail('Yıllık fiyat 1 ₺ ile 1.000.000 ₺ arasında olmalı.', 422, 'BAD_PRICE');
    else next.annual_cents = body.annual_cents;
  }
  if (body.available !== undefined) { if (typeof body.available !== 'boolean') fail('Satış durumu true/false olmalı.', 422, 'BAD_AVAILABLE'); next.available = body.available; }
  if (next.annual_cents === plan.annual_cents && next.available === plan.available) fail('Değişiklik yok.', 422, 'NO_CHANGE');
  const saved = await packages.save(ACTOR, { revision: current.revision, plans: current.plans.map(p => (p.code === code ? next : p)) });
  await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,details) SELECT u.tenant_id,$1,$2,$3,$4 FROM platform_admins p JOIN users u ON u.id=p.user_id ORDER BY p.user_id LIMIT 1', [ACTOR.email, 'package_price_changed', 'package', JSON.stringify({ code, from: { annual_cents: plan.annual_cents, available: plan.available }, to: { annual_cents: next.annual_cents, available: next.available }, reason: why })]).catch(() => {});
  return { revision: saved.revision, plan: next };
}

// ---- Havale ve fatura (platformRoutes ile aynı faturalama servisini kullanır; işlem "yonetim-sitesi" adıyla kayda geçer) ----
const billing = require('./billingService');
const ids = (t, l, i) => { const out = { tenantId: Number(t), licenseId: Number(l) }; if (i !== undefined) out.invoiceId = Number(i); if (Object.values(out).some(v => !Number.isSafeInteger(v) || v < 1)) fail('Geçersiz işletme, lisans veya fatura.', 422, 'BAD_ID'); return out; };
async function bankTransfers() {
  const pending = (await db.query("SELECT i.id,i.invoice_no,i.tenant_id,i.license_id,i.amount,i.currency,i.billing_period,i.created_at,t.company_name FROM invoices i JOIN tenants t ON t.id=i.tenant_id WHERE i.payment_method=$1 AND i.status='PENDING' ORDER BY i.id DESC LIMIT 200", [billing.BANK_TRANSFER])).rows;
  const licenses = (await db.query("SELECT l.id,l.tenant_id,l.plan_id,l.status,l.expires_at,t.company_name FROM licenses l JOIN tenants t ON t.id=l.tenant_id WHERE l.status IN ('PENDING_PAYMENT','ACTIVE','PAST_DUE','EXPIRED') ORDER BY l.id DESC LIMIT 200")).rows;
  return { bank: billing.bankDetails(), pending, licenses };
}
async function createBankInvoice(tenantId, licenseId, body = {}) {
  const t = ids(tenantId, licenseId); const why = reasonOf(body.reason);
  return db.transaction(async tx => ({ invoice: await billing.createInvoice(tx, { ...t, billingPeriod: body.billing_period || 'ANNUAL', paymentMethod: billing.BANK_TRANSFER, amount: body.amount, currency: body.currency, actor: ACTOR.email, reason: why }) }));
}
async function confirmBankTransfer(tenantId, licenseId, invoiceId, body = {}) {
  const t = ids(tenantId, licenseId, invoiceId); reasonOf(body.reason);
  return db.transaction(tx => billing.confirmBankTransfer(tx, { ...t, amount: body.amount, reference: body.reference, actor: ACTOR.email }));
}
async function voidBankInvoice(tenantId, licenseId, invoiceId, body = {}) {
  const t = ids(tenantId, licenseId, invoiceId); reasonOf(body.reason);
  return db.transaction(tx => billing.voidBankInvoice(tx, { ...t, actor: ACTOR.email }));
}
module.exports = { setTenantAccess, catalogue, setPlan, bankTransfers, createBankInvoice, confirmBankTransfer, voidBankInvoice };
