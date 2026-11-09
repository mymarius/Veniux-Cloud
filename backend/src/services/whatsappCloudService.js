// Resmî WhatsApp Business Platform (Cloud API) ile bildirim.
// Kaynak: developers.facebook.com/documentation/business-messaging/whatsapp (Kasım 2026):
// POST https://graph.facebook.com/{sürüm}/{telefon-numarası-kimliği}/messages, Authorization: Bearer <token>.
// 24 saatlik müşteri penceresi dışında yalnız Meta'nın onayladığı şablon gönderilebilir; bu yüzden bildirim
// tek gövde değişkenli ({{1}}) bir "utility" şablonuyla gider. Yanıt yalnız kabulü gösterir, teslimi değil.
const { normalizePhone } = require('./ownerPhone');
const VERSION = 'v27.0';
const configured = (env = process.env) => Boolean(env.WHATSAPP_CLOUD_TOKEN && env.WHATSAPP_CLOUD_PHONE_ID && env.WHATSAPP_CLOUD_TEMPLATE);

// Şablon değişkeni tek satır olmalı: satır sonları ve sekmeler ayraçla değiştirilir, uzun boşluklar kısaltılır.
const parameter = text => String(text).replace(/[\r\n\t]+/g, ' · ').replace(/ {2,}/g, ' ').trim().slice(0, 900);

function body(phone, text, env = process.env) {
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: '+' + phone, type: 'template',
    template: { name: env.WHATSAPP_CLOUD_TEMPLATE, language: { code: env.WHATSAPP_CLOUD_LANGUAGE || 'tr' }, components: [{ type: 'body', parameters: [{ type: 'text', text: parameter(text) }] }] },
  };
}

async function send(rawPhone, text, env = process.env) {
  if (!configured(env)) return { status: 'not_configured' };
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return { status: 'invalid_phone' };
  const phone = normalized.replace(/^\+/, '').replace(/^0/, '90');
  const base = env.WHATSAPP_CLOUD_TEST_BASE_URL || 'https://graph.facebook.com';
  try {
    const response = await fetch(`${base}/${VERSION}/${encodeURIComponent(env.WHATSAPP_CLOUD_PHONE_ID)}/messages`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + env.WHATSAPP_CLOUD_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body(phone, text, env)),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.messages?.[0]?.id) return { status: 'accepted', message_id: 'wa-cloud-' + require('crypto').randomUUID() };
    if (response.status === 401) return { status: 'rejected', detail: 'WhatsApp erişim anahtarı geçersiz veya süresi dolmuş.' };
    return { status: 'rejected', detail: 'WhatsApp isteği reddetti' + (data.error?.code ? ` (kod ${data.error.code})` : '') + '. Şablon adı, dili ve numara iznini kontrol edin.' };
  } catch {
    return { status: 'unknown' };
  }
}

module.exports = { configured, send, body, parameter, VERSION };
