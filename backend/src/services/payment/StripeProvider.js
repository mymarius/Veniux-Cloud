const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

const TOLERANCE_SECONDS = 300;
// Sağlayıcı olay türleri iç olay türlerine indirgenir; listede olmayanlar kayıt altına alınıp yok sayılır.
const KINDS = {
  'checkout.session.completed': 'payment_succeeded',
  'invoice.payment_succeeded': 'payment_succeeded',
  'invoice.paid': 'payment_succeeded',
  'invoice.payment_failed': 'payment_failed',
  'customer.subscription.deleted': 'subscription_cancelled'
};

class StripeProvider extends PaymentProvider {
  /**
   * Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>…] — HMAC-SHA256(secret, `${t}.${rawBody}`).
   * Ham gövde üzerinden doğrulanır; zaman damgası ±5 dakika dışındaysa tekrar oynatma sayılır.
   */
  validateSignature(rawBody, signatureHeader, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (typeof rawBody !== 'string' || !signatureHeader || !secret) return false;
    let timestamp = null;
    const signatures = [];
    for (const part of String(signatureHeader).split(',')) {
      const index = part.indexOf('=');
      if (index < 1) continue;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key === 't') timestamp = value;
      else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
    }
    if (!/^\d{1,12}$/.test(timestamp || '') || !signatures.length) return false;
    if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;
    const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'));
    return signatures.some(signature => crypto.timingSafeEqual(expected, Buffer.from(signature)));
  }

  sign(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  normalizeEvent(payload) {
    const object = payload?.data?.object || {};
    return {
      eventId: typeof payload?.id === 'string' ? payload.id : null,
      eventType: payload?.type,
      kind: KINDS[payload?.type] || 'unhandled',
      timestamp: Number.isSafeInteger(payload?.created) ? payload.created : null,
      // Stripe tutarları en küçük para biriminde (sent) gönderir.
      amount: Number(object.amount_total ?? object.amount_paid ?? object.amount ?? 0),
      currency: String(object.currency || '').toUpperCase(),
      reference: object.id || null,
      metadata: object.metadata || {}
    };
  }
}

module.exports = StripeProvider;
