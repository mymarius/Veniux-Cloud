/**
 * Lisans faturalama durum makinesi. Ödeme sağlayıcısı yalnızca bizim oluşturduğumuz bekleyen bir
 * faturaya ödeme bildirebilir; tutar/para birimi tutmazsa lisans açılmaz. Her olay bir kez işlenir
 * (webhook_logs.event_id tekil) ve lisanstaki son olay zamanından eski olaylar durumu değiştirmez.
 *
 * Durumlar: PENDING_PAYMENT → ACTIVE ⇄ PAST_DUE → CANCELLED / EXPIRED. REVOKED ve SUSPENDED
 * yalnızca platform yöneticisi tarafından verilir; ödeme olayı bunları geri açmaz.
 *
 * Havale: fatura tutarıyla birlikte platform yöneticisince kesilir ve yine onun onayıyla ödenir;
 * sağlayıcı olayı havale faturasını kapatamaz.
 */
const crypto = require('crypto');
const licenseService = require('./licenseService');

const DAY = 86400000;
const PAYABLE = new Set(['PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'EXPIRED']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const parseStamp = value => {
  if (!value) return NaN;
  const raw = String(value);
  return Date.parse(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
};
// İki motorun da kabul ettiği UTC biçimi; MySQL ISO 'T...Z' yazımını reddeder.
const toDbTime = ms => new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
const cents = amount => Math.round(Number(amount) * 100);

const PERIOD_DAYS = { ANNUAL: 365, MONTHLY: 30 };
const BANK_TRANSFER = 'BANK_TRANSFER';
const BANK_CURRENCIES = new Set(['TRY', 'USD', 'EUR']);

/** Kontrol basamağı tutmayan IBAN müşteriye gösterilmez: yanlış hesaba havaleyi önler. */
const normalizeIban = value => {
  const iban = String(value || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || (iban.startsWith('TR') && iban.length !== 26)) return null;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, letter => letter.charCodeAt(0) - 55);
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1 ? iban : null;
};
const bankDetails = () => {
  const iban = normalizeIban(process.env.BANK_IBAN), accountName = String(process.env.BANK_ACCOUNT_NAME || '').trim();
  return iban && accountName ? { iban, account_name: accountName, bank_name: String(process.env.BANK_NAME || '').trim() || null } : null;
};

/** Yenileme / ilk satın alma için bekleyen fatura üretir. */
const createInvoice = async (client, { tenantId, licenseId, billingPeriod = 'ANNUAL', paymentMethod = 'CREDIT_CARD', amount: statedAmount, currency = 'USD' }) => {
  const license = (await client.query('SELECT * FROM licenses WHERE id = $1 AND tenant_id = $2', [licenseId, tenantId])).rows[0];
  if (!license) throw fail('Lisans bulunamadı.', 404);
  if (!PAYABLE.has(license.status)) throw fail(`${license.status} durumundaki lisans için fatura kesilemez.`, 409);
  const isBank = paymentMethod === BANK_TRANSFER;
  if (isBank) {
    if (!bankDetails()) throw fail('Havale bilgileri tanımlı değil: BANK_IBAN ve BANK_ACCOUNT_NAME gerekli.', 503);
    if (typeof statedAmount !== 'number' || !Number.isFinite(statedAmount) || statedAmount <= 0 || statedAmount > 10000000 || Math.abs(statedAmount * 100 - Math.round(statedAmount * 100)) > 1e-6) throw fail('Geçerli bir fatura tutarı girin.');
    if (!BANK_CURRENCIES.has(currency)) throw fail('Geçersiz para birimi.');
  }
  const plan = licenseService.getPlans().find(p => p.id === license.plan_id);
  if (!isBank && (!plan || !Number.isFinite(plan.price_usd))) throw fail('Paketin fiyatı tanımlı değil.', 409);
  if (!PERIOD_DAYS[billingPeriod]) throw fail('Geçersiz fatura dönemi.');
  const open = await client.query("SELECT id FROM invoices WHERE license_id = $1 AND tenant_id = $2 AND status = 'PENDING'", [licenseId, tenantId]);
  if (open.rows.length) throw fail('Bu lisans için ödenmemiş bir fatura zaten var.', 409);
  const amount = isBank ? statedAmount : billingPeriod === 'ANNUAL' ? plan.price_usd : Math.round(plan.price_usd / 12 * 100) / 100;
  const invoiceNo = `VNX-LIC-${new Date().getFullYear()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  return (await client.query(`
    INSERT INTO invoices (invoice_no, tenant_id, license_id, amount, currency, billing_period, payment_method, status, paid_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NULL)
    RETURNING *
  `, [invoiceNo, tenantId, licenseId, amount, isBank ? currency : 'USD', billingPeriod, isBank ? BANK_TRANSFER : 'CREDIT_CARD'])).rows[0];
};

const audit = (client, tenantId, action, entityId, details, actor = 'payment-webhook') =>
  client.query('INSERT INTO audit_logs (tenant_id, user_email, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
    [tenantId, actor, action, 'license', entityId, JSON.stringify(details)]);

/** Ödeme süresini uzatır: aktif lisansta kalan süre korunur, süresi geçmişte ise bugünden başlar. */
const extendLicense = async (client, license, days, extra = {}) => {
  const current = parseStamp(license.expires_at);
  const base = ['ACTIVE', 'PAST_DUE'].includes(license.status) && current > Date.now() ? current : Date.now();
  const expiresAt = toDbTime(base + days * DAY);
  await client.query(`UPDATE licenses SET status = 'ACTIVE', expires_at = $1, cancelled_at = NULL${extra.eventAt ? ', last_billing_event_at = $4' : ''} WHERE id = $2 AND tenant_id = $3`,
    extra.eventAt ? [expiresAt, license.id, license.tenant_id, extra.eventAt] : [expiresAt, license.id, license.tenant_id]);
  return expiresAt;
};

/**
 * Normalize edilmiş bir sağlayıcı olayını uygular. Dönen sonuç webhook_logs'a yazılır.
 * { outcome: 'applied' | 'ignored' | 'rejected', reason?, tenantId?, licenseId?, invoiceId? }
 */
const applyEvent = async (client, event) => {
  const meta = event.metadata || {};
  const tenantId = Number(meta.tenant_id);
  const licenseId = Number(meta.license_id);
  if (!Number.isSafeInteger(tenantId) || !Number.isSafeInteger(licenseId)) return { outcome: 'rejected', reason: 'missing_metadata' };
  const license = (await client.query('SELECT * FROM licenses WHERE id = $1 AND tenant_id = $2', [licenseId, tenantId])).rows[0];
  if (!license) return { outcome: 'rejected', reason: 'unknown_license', tenantId, licenseId };
  const ids = { tenantId, licenseId };
  if (license.last_billing_event_at && event.timestamp && Number(event.timestamp) < Number(license.last_billing_event_at)) {
    return { outcome: 'ignored', reason: 'stale_event', ...ids };
  }
  const touch = () => client.query('UPDATE licenses SET last_billing_event_at = $1 WHERE id = $2', [event.timestamp || Math.floor(Date.now() / 1000), licenseId]);

  if (event.kind === 'payment_succeeded') {
    const invoiceId = Number(meta.invoice_id);
    const invoice = Number.isSafeInteger(invoiceId)
      ? (await client.query('SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2 AND license_id = $3', [invoiceId, tenantId, licenseId])).rows[0]
      : null;
    if (!invoice) return { outcome: 'rejected', reason: 'unknown_invoice', ...ids };
    if (invoice.status === 'PAID') return { outcome: 'ignored', reason: 'invoice_already_paid', invoiceId, ...ids };
    if (invoice.payment_method === BANK_TRANSFER) return { outcome: 'rejected', reason: 'invoice_bank_transfer', invoiceId, ...ids };
    if (invoice.status !== 'PENDING') return { outcome: 'rejected', reason: `invoice_${String(invoice.status).toLowerCase()}`, invoiceId, ...ids };
    if (cents(invoice.amount) !== Number(event.amount) || String(invoice.currency || 'USD').toUpperCase() !== String(event.currency).toUpperCase()) {
      await audit(client, tenantId, 'billing_amount_mismatch', licenseId, { invoice_id: invoiceId, expected_cents: cents(invoice.amount), expected_currency: invoice.currency, received_cents: event.amount, received_currency: event.currency, event_id: event.eventId });
      return { outcome: 'rejected', reason: 'amount_mismatch', invoiceId, ...ids };
    }
    if (!PAYABLE.has(license.status)) return { outcome: 'rejected', reason: `license_${license.status.toLowerCase()}`, invoiceId, ...ids };
    await client.query("UPDATE invoices SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, provider_reference = $1 WHERE id = $2", [event.reference || event.eventId, invoiceId]);
    const expiresAt = await extendLicense(client, license, PERIOD_DAYS[invoice.billing_period] || 365, { eventAt: event.timestamp || Math.floor(Date.now() / 1000) });
    await audit(client, tenantId, 'license_paid', licenseId, { invoice_id: invoiceId, expires_at: expiresAt, event_id: event.eventId });
    return { outcome: 'applied', invoiceId, ...ids };
  }

  if (event.kind === 'payment_failed') {
    if (license.status !== 'ACTIVE') return { outcome: 'ignored', reason: 'not_active', ...ids };
    await client.query("UPDATE licenses SET status = 'PAST_DUE' WHERE id = $1 AND tenant_id = $2", [licenseId, tenantId]);
    await touch();
    await audit(client, tenantId, 'license_past_due', licenseId, { event_id: event.eventId });
    return { outcome: 'applied', ...ids };
  }

  if (event.kind === 'subscription_cancelled') {
    if (!['ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT'].includes(license.status)) return { outcome: 'ignored', reason: 'not_cancellable', ...ids };
    await client.query("UPDATE licenses SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2", [licenseId, tenantId]);
    await client.query("UPDATE invoices SET status = 'VOID' WHERE license_id = $1 AND tenant_id = $2 AND status = 'PENDING'", [licenseId, tenantId]);
    await touch();
    await audit(client, tenantId, 'license_cancelled', licenseId, { event_id: event.eventId, source: 'provider' });
    return { outcome: 'applied', ...ids };
  }

  return { outcome: 'ignored', reason: 'unhandled_event_type', ...ids };
};

/** Platform yöneticisinin iptali: ödenmemiş faturalar geçersiz olur, erişim hemen kapanır. */
const cancelLicense = async (client, { tenantId, licenseId, actor }) => {
  const license = (await client.query('SELECT * FROM licenses WHERE id = $1 AND tenant_id = $2', [licenseId, tenantId])).rows[0];
  if (!license) throw fail('Lisans bulunamadı.', 404);
  if (!['ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT'].includes(license.status)) throw fail(`${license.status} durumundaki lisans iptal edilemez.`, 409);
  await client.query("UPDATE licenses SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2", [licenseId, tenantId]);
  await client.query("UPDATE invoices SET status = 'VOID' WHERE license_id = $1 AND tenant_id = $2 AND status = 'PENDING'", [licenseId, tenantId]);
  await audit(client, tenantId, 'license_cancelled', licenseId, { source: 'platform' }, actor);
};

const bankInvoice = async (client, { tenantId, licenseId, invoiceId }) => {
  if (!Number.isSafeInteger(invoiceId) || invoiceId < 1) throw fail('Geçersiz fatura.');
  const invoice = (await client.query('SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2 AND license_id = $3', [invoiceId, tenantId, licenseId])).rows[0];
  if (!invoice) throw fail('Fatura bulunamadı.', 404);
  if (invoice.payment_method !== BANK_TRANSFER) throw fail('Bu fatura havale ile ödenmiyor.', 409);
  if (invoice.status !== 'PENDING') throw fail(invoice.status === 'PAID' ? 'Bu fatura zaten ödendi.' : 'Bu fatura artık geçerli değil.', 409);
  return invoice;
};

/** Havale hesaba geçtikten sonra platform yöneticisinin onayı: tutar yeniden yazılır, dekont bir kez kullanılır. */
const confirmBankTransfer = async (client, { tenantId, licenseId, invoiceId, amount, reference, actor }) => {
  const dekont = typeof reference === 'string' ? reference.trim() : '';
  if (dekont.length < 3 || dekont.length > 100) throw fail('Dekont veya işlem numarası zorunludur.');
  const license = (await client.query('SELECT * FROM licenses WHERE id = $1 AND tenant_id = $2', [licenseId, tenantId])).rows[0];
  if (!license) throw fail('Lisans bulunamadı.', 404);
  const invoice = await bankInvoice(client, { tenantId, licenseId, invoiceId });
  if (typeof amount !== 'number' || cents(invoice.amount) !== cents(amount)) throw fail('Girilen tutar fatura tutarıyla aynı değil.');
  if (!PAYABLE.has(license.status)) throw fail(`${license.status} durumundaki lisans açılamaz.`, 409);
  if ((await client.query('SELECT id FROM invoices WHERE provider_reference = $1 AND payment_method = $2', [dekont, BANK_TRANSFER])).rows.length) throw fail('Bu dekont başka bir faturada kullanıldı.', 409);
  const paid = await client.query("UPDATE invoices SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, provider_reference = $1 WHERE id = $2 AND tenant_id = $3 AND status = 'PENDING'", [dekont, invoiceId, tenantId]);
  if (paid.rowCount !== 1) throw fail('Bu fatura zaten ödendi.', 409);
  const expiresAt = await extendLicense(client, license, PERIOD_DAYS[invoice.billing_period] || 365, { eventAt: Math.floor(Date.now() / 1000) });
  await audit(client, tenantId, 'license_paid', licenseId, { invoice_id: invoiceId, expires_at: expiresAt, method: BANK_TRANSFER, reference: dekont }, actor);
  return { status: 'ACTIVE', expires_at: expiresAt };
};

/** Yanlış kesilen havale faturası geri alınır; lisansa dokunulmaz. */
const voidBankInvoice = async (client, { tenantId, licenseId, invoiceId, actor }) => {
  await bankInvoice(client, { tenantId, licenseId, invoiceId });
  await client.query("UPDATE invoices SET status = 'VOID' WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'", [invoiceId, tenantId]);
  await audit(client, tenantId, 'invoice_voided', licenseId, { invoice_id: invoiceId }, actor);
  return { status: 'VOID' };
};

/** Müşterinin göreceği özet: IBAN yalnız ödenecek fatura varken verilir, dekont bilgisi verilmez. */
const customerBilling = async (client, tenantId) => {
  const invoices = (await client.query("SELECT invoice_no, amount, currency, billing_period, status, created_at, paid_at FROM invoices WHERE tenant_id = $1 AND payment_method = $2 AND status IN ('PENDING', 'PAID') ORDER BY id DESC LIMIT 20", [tenantId, BANK_TRANSFER])).rows;
  return { invoices, bank: invoices.some(invoice => invoice.status === 'PENDING') ? bankDetails() : null };
};

/** Ödeme dışı süre uzatma (ör. telafi): gerekçe zorunlu ve denetim kaydına yazılır. */
const extendManually = async (client, { tenantId, licenseId, days, reason, actor }) => {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw fail('Süre 1–366 gün olmalıdır.');
  if (!reason || String(reason).trim().length < 3) throw fail('Uzatma gerekçesi zorunludur.');
  const license = (await client.query('SELECT * FROM licenses WHERE id = $1 AND tenant_id = $2', [licenseId, tenantId])).rows[0];
  if (!license) throw fail('Lisans bulunamadı.', 404);
  if (!['ACTIVE', 'PAST_DUE', 'EXPIRED'].includes(license.status)) throw fail(`${license.status} durumundaki lisans uzatılamaz.`, 409);
  const expiresAt = await extendLicense(client, license, days);
  await audit(client, tenantId, 'license_extended', licenseId, { days, reason: String(reason).trim(), expires_at: expiresAt }, actor);
  return expiresAt;
};

module.exports = { createInvoice, applyEvent, cancelLicense, extendManually, parseStamp, normalizeIban, bankDetails, confirmBankTransfer, voidBankInvoice, customerBilling, BANK_TRANSFER };
