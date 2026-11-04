class PaymentProvider {
  /**
   * Validates a webhook payload signature
   * @param {string} rawBody 
   * @param {string} signature 
   * @param {string} secret 
   * @returns {boolean}
   */
  validateSignature(rawBody, signature, secret) {
    throw new Error('Not implemented');
  }

  /**
   * Normalizes the webhook event payload to a standard internal format
   * @param {object} payload 
   * @returns {object} { eventId, eventType, timestamp, amount, currency, metadata }
   */
  normalizeEvent(payload) {
    throw new Error('Not implemented');
  }
}

module.exports = PaymentProvider;
