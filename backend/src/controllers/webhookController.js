const pool = require('../config/database');
const StripeProvider = require('../services/payment/StripeProvider');
const licenseService = require('../services/licenseService');

// In a real app this would be loaded from env
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || (process.env.NODE_ENV==='test'?'whsec_test_secret':null);
const provider = new StripeProvider();

const handlePaymentWebhook = async (req, res) => {
  try {
    if(!WEBHOOK_SECRET)return res.status(503).json({error:'Ödeme bildirimi entegrasyonu yapılandırılmamış.'});
    const signature = req.headers['stripe-signature'] || req.headers['x-payment-signature'];
    
    // 1. Signature & Replay Validation
    if (!provider.validateSignature(req.rawBody || JSON.stringify(req.body), signature, WEBHOOK_SECRET)) {
      return res.status(400).json({ error: 'Invalid webhook signature or expired timestamp' });
    }

    // 2. Parse Event
    const event = provider.normalizeEvent(req.body);
    const { eventId, eventType, amount, currency, metadata } = event;

    if (!eventId) {
      return res.status(400).json({ error: 'Missing event ID' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 3. Idempotency Check (Duplicate Event Drops)
      const existingLog = await client.query('SELECT id FROM webhook_logs WHERE event_id = $1', [eventId]);
      if (existingLog.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(200).json({ message: 'Event already processed' });
      }

      // Log the event immediately to prevent concurrent duplicates
      await client.query(
        'INSERT INTO webhook_logs (event_id, event_type, payload) VALUES ($1, $2, $3)',
        [eventId, eventType, JSON.stringify(req.body)]
      );

      // 4. Handle State Machine logic
      if (eventType === 'checkout.session.completed' || eventType === 'invoice.payment_succeeded') {
        const tenantId = metadata.tenant_id;
        const licenseId = metadata.license_id;
        
        if (!tenantId || !licenseId) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({ error: 'Missing metadata for tenant or license' });
        }

        // Amount & Currency Validation
        const expectedPrice = metadata.expected_price_cents;
        if (expectedPrice && parseInt(expectedPrice, 10) !== amount) {
          console.warn('Webhook amount mismatch', { expected: expectedPrice, actual: amount });
          // Depending on business logic, we could flag it or block it. We will flag it.
        }

        // Transition State: PENDING_PAYMENT -> ACTIVE
        const licRes = await client.query(
          'UPDATE licenses SET status = $1 WHERE id = $2 AND tenant_id = $3 AND status IN ($4, $5) RETURNING id',
          ['ACTIVE', licenseId, tenantId, 'PENDING_PAYMENT', 'EXPIRED']
        );

        if (licRes.rowCount > 0) {
          await client.query(
            'UPDATE invoices SET status = $1, paid_at = CURRENT_TIMESTAMP WHERE license_id = $2 AND tenant_id = $3',
            ['PAID', licenseId, tenantId]
          );
        }
      } else if (eventType === 'invoice.payment_failed') {
        // Transition State: ACTIVE -> PAST_DUE
        const licenseId = metadata.license_id;
        if (licenseId) {
          await client.query(
            'UPDATE licenses SET status = $1 WHERE id = $2 AND status = $3',
            ['PAID_DUE', licenseId, 'ACTIVE']
          );
        }
      } else if (eventType === 'customer.subscription.deleted') {
        // Transition State: ACTIVE -> CANCELLED
        const licenseId = metadata.license_id;
        if (licenseId) {
          await client.query(
            'UPDATE licenses SET status = $1 WHERE id = $2',
            ['CANCELLED', licenseId]
          );
        }
      }

      await client.query('COMMIT');
      res.status(200).json({ received: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
};

module.exports = {
  handlePaymentWebhook
};
