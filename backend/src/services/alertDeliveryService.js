// Uyarı iletimi: kritik stok, miadı yaklaşan ürün ve sayım farkı uyarılarını seçilen kanallardan özet olarak gönderir.
// - Her uyarı her kanaldan en çok bir kez gider (alert_deliveries tekil kaydı).
// - Tek tek mesaj yerine tek özet gönderilir; günlük üst sınır ve sessiz saatler maliyeti ve rahatsızlığı sınırlar.
// - Alıcılar işletmenin kendi yetkilileridir: firma e-postası ve patron telefonu. Ek e-posta alıcısı yalnız
//   yönetici "kişinin izni alındı" onayını verdiyse kullanılır (KVKK: açık bilgilendirme ve rıza kaydı).
const crypto = require('crypto');
const db = require('../config/database');
const policies = require('./settingsPolicyService');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const TYPES = { low_stock: 'Kritik stok', expiry: 'Miadı yaklaşan', count_variance: 'Sayım farkı' };
const CHANNELS = ['email', 'sms', 'whatsapp'];
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const defaults = { channels: { email: false, sms: false, whatsapp: false }, types: { low_stock: true, expiry: true, count_variance: true }, quietStart: 22, quietEnd: 8, dailyLimit: 3, extraEmails: [], consentConfirmedAt: null, consentConfirmedBy: null };

async function read(tenant, tx = db) {
  const row = (await tx.query("SELECT payload FROM workspace_collections WHERE tenant_id=$1 AND scope='settings' AND name='alert_delivery'", [tenant])).rows[0];
  const stored = row ? JSON.parse(row.payload) : {};
  return { ...defaults, ...stored, channels: { ...defaults.channels, ...(stored.channels || {}) }, types: { ...defaults.types, ...(stored.types || {}) } };
}

async function save(user, body = {}) {
  if (user.role !== 'admin') fail('Bildirim tercihlerini yalnız firma yöneticisi değiştirebilir.', 403);
  const bool = v => v === true;
  const channels = Object.fromEntries(CHANNELS.map(c => [c, bool(body.channels?.[c])]));
  const types = Object.fromEntries(Object.keys(TYPES).map(t => [t, bool(body.types?.[t])]));
  const hour = v => Number.isInteger(v) && v >= 0 && v <= 23;
  if (!hour(body.quietStart) || !hour(body.quietEnd)) fail('Sessiz saatler 0-23 arasında olmalı.');
  if (!Number.isInteger(body.dailyLimit) || body.dailyLimit < 1 || body.dailyLimit > 24) fail('Günlük özet sayısı 1-24 arasında olmalı.');
  const extra = Array.isArray(body.extraEmails) ? [...new Set(body.extraEmails.map(e => String(e).trim().toLowerCase()).filter(Boolean))] : [];
  if (extra.length > 10 || extra.some(e => !EMAIL.test(e))) fail('Ek alıcılar geçerli e-posta adresi olmalı (en çok 10).');
  const previous = await read(user.tenantId);
  const added = extra.filter(e => !previous.extraEmails.includes(e));
  if (added.length && body.consentConfirmed !== true) fail('Yeni alıcılar için kişilerin bilgilendirildiğini ve iznin alındığını onaylayın.');
  const data = { channels, types, quietStart: body.quietStart, quietEnd: body.quietEnd, dailyLimit: body.dailyLimit, extraEmails: extra,
    consentConfirmedAt: added.length ? new Date().toISOString() : previous.consentConfirmedAt, consentConfirmedBy: added.length ? user.email : previous.consentConfirmedBy };
  await policies.save(user.tenantId, 'alert_delivery', data);
  await db.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [user.tenantId, user.email, 'alert_delivery.changed', 'settings', user.tenantId, JSON.stringify({ channels, types, added_recipients: added.length, removed_recipients: previous.extraEmails.filter(e => !extra.includes(e)).length })]);
  return data;
}

const istanbulHour = now => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false }).format(now)) % 24;
const quiet = (s, now) => { const h = istanbulHour(now); return s.quietStart === s.quietEnd ? false : s.quietStart < s.quietEnd ? h >= s.quietStart && h < s.quietEnd : h >= s.quietStart || h < s.quietEnd; };

function digest(company, alerts) {
  const lines = alerts.slice(0, 8).map(a => `• ${TYPES[a.alert_type]}: ${String(a.message).replace(/^\[lot:\d+:\d+\]\s*/, '').slice(0, 140)}`);
  if (alerts.length > 8) lines.push(`• ve ${alerts.length - 8} uyarı daha`);
  return `Veniux - ${company || 'İşletmeniz'}: ${alerts.length} yeni uyarı\n${lines.join('\n')}\nAyrıntılar: Veniux > Bildirimler`;
}

async function senders() {
  return {
    email: async (to, text) => { const r = await require('./notificationService').sendEmail(to, 'Veniux uyarı özeti', text, undefined); return r.success ? 'sent' : r.error === 'Not configured' ? 'not_configured' : 'failed'; },
    sms: async (phone, text) => (await require('./ownerSmsService').send(phone, text)).status,
    // Resmî Cloud API ayarlıysa o kullanılır; değilse eski bağlı oturum (gayriresmî) yedek olarak kalır.
    whatsapp: async (tenant, text, phone) => (require('./whatsappCloudService').configured() ? await require('./whatsappCloudService').send(phone, text) : await require('./ownerWhatsAppService').send(tenant, text)).status,
  };
}

// Bir firmanın bekleyen uyarılarını iletir. now ve send dışarıdan verilebilir (test ve zamanlayıcı).
async function deliver(tenant, { now = new Date(), send } = {}) {
  const s = await read(tenant);
  const active = CHANNELS.filter(c => s.channels[c]);
  const types = Object.keys(TYPES).filter(t => s.types[t]);
  if (!active.length || !types.length) return { skipped: 'disabled' };
  if (quiet(s, now)) return { skipped: 'quiet_hours' };
  const since = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const dayStart = new Date(Date.parse(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(now) + 'T00:00:00+03:00')).toISOString().slice(0, 19).replace('T', ' ');
  const company = (await db.query('SELECT company_name,email,owner_phone FROM tenants WHERE id=$1', [tenant])).rows[0] || {};
  send = send || await senders();
  const results = {};
  for (const channel of active) {
    const batches = Number((await db.query('SELECT COUNT(DISTINCT batch_id) AS n FROM alert_deliveries WHERE tenant_id=$1 AND channel=$2 AND created_at>=$3', [tenant, channel, dayStart])).rows[0].n);
    if (batches >= s.dailyLimit) { results[channel] = 'daily_limit'; continue; }
    const placeholders = types.map((_, i) => '$' + (i + 4)).join(',');
    const alerts = (await db.query(`SELECT a.id,a.alert_type,a.message,a.severity FROM alerts a WHERE a.tenant_id=$1 AND a.status<>'resolved' AND a.created_at>=$2 AND a.alert_type IN (${placeholders})
      AND NOT EXISTS (SELECT 1 FROM alert_deliveries d WHERE d.tenant_id=a.tenant_id AND d.alert_id=a.id AND d.channel=$3) ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,a.id LIMIT 200`, [tenant, since, channel, ...types])).rows;
    if (!alerts.length) { results[channel] = 'nothing'; continue; }
    const text = digest(company.company_name, alerts);
    let status;
    if (channel === 'email') {
      const to = [company.email, ...s.extraEmails].filter(e => e && EMAIL.test(e));
      status = to.length ? await send.email(to.join(','), text) : 'no_recipient';
    } else if (channel === 'sms') status = company.owner_phone ? await send.sms(company.owner_phone, text) : 'no_recipient';
    else status = company.owner_phone ? await send.whatsapp(tenant, text, company.owner_phone) : 'no_recipient';
    // Sağlayıcı kabul ettiyse veya sonuç belirsizse işaretlenir (aynı özet iki kez gitmesin); ayarı eksik kanal sonra yeniden dener.
    if (['sent', 'accepted', 'unknown'].includes(status)) {
      const batch = crypto.randomUUID();
      for (const a of alerts) await db.query('INSERT INTO alert_deliveries (tenant_id,alert_id,channel,status,batch_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,alert_id,channel) DO NOTHING', [tenant, a.id, channel, status, batch]);
    }
    results[channel] = { status, alerts: alerts.length };
  }
  return results;
}

async function tick({ now = new Date() } = {}) {
  const rows = (await db.query("SELECT tenant_id FROM workspace_collections WHERE scope='settings' AND name='alert_delivery'")).rows;
  for (const r of rows) await deliver(r.tenant_id, { now }).catch(error => console.error('[Uyarı iletimi]', r.tenant_id, error.message));
}

module.exports = { read, save, deliver, tick, digest, quiet, TYPES };
