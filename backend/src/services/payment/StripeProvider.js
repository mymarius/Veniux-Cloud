const crypto = require('crypto');
const PaymentProvider = require('./PaymentProvider');

class StripeProvider extends PaymentProvider {
  validateSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;

    // Expected Stripe format: t=timestamp,v1=signature
    const pairs = signatureHeader.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k] = v;
      return acc;
    }, {});

    if (!pairs.t || !pairs.v1) return false;

    // Timestamp tolerance (5 minutes)
    const currentUnix = Math.floor(Date.now() / 1000);
    if (Math.abs(currentUnix - parseInt(pairs.t, 10)) > 300) {
      return false; // Replay attack or delayed payload
    }

    const payloadToSign = `${pairs.t}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadToSign)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(pairs.v1));
  }

  normalizeEvent(payload) {
    // Basic stripe event parsing
    return {
      eventId: payload.id,
      eventType: payload.type,
      timestamp: payload.created, // Unix seconds
      amount: payload.data?.object?.amount || 0,
      currency: payload.data?.object?.currency?.toUpperCase() || 'USD',
      metadata: payload.data?.object?.metadata || {}
    };
  }
}

module.exports = StripeProvider;
