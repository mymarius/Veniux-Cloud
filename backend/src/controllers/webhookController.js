const pool = require('../config/database');
const StripeProvider = require('../services/payment/StripeProvider');
const billingService = require('../services/billingService');

const provider = new StripeProvider();
// Varsayılan sır yoktur: yapılandırılmamış ortamda hiçbir ödeme bildirimi kabul edilmez.
const webhookSecret = () => process.env.PAYMENT_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
const isUniqueViolation = error => /UNIQUE|Duplicate entry|ER_DUP_ENTRY/i.test(`${error.code || ''} ${error.message || ''}`);

const handlePaymentWebhook = async (req, res) => {
  const secret = webhookSecret();
  if (!secret) return res.status(503).json({ error: 'Ödeme bildirimi yapılandırılmamış.' });
  const signature = req.headers['stripe-signature'];
  // İmza, sağlayıcının gönderdiği ham gövde üzerinden doğrulanır; yeniden serileştirilmiş JSON kabul edilmez.
  if (typeof req.rawBody !== 'string' || !provider.validateSignature(req.rawBody, signature, secret)) {
    return res.status(400).json({ error: 'Geçersiz imza veya süresi geçmiş bildirim.' });
  }
  const event = provider.normalizeEvent(req.body);
  if (!event.eventId || !/^[\w-]{3,255}$/.test(event.eventId)) return res.status(400).json({ error: 'Olay kimliği eksik.' });

  try {
    const result = await pool.transaction(async client => {
      const seen = await client.query('SELECT status FROM webhook_logs WHERE event_id = $1', [event.eventId]);
      if (seen.rows.length) return { duplicate: true, outcome: seen.rows[0].status };
      const outcome = await billingService.applyEvent(client, event);
      // Kayıt, uygulanan değişiklikle aynı transaction'dadır: eşzamanlı ikinci teslimat tekil anahtara takılır.
      await client.query(`
        INSERT INTO webhook_logs (event_id, event_type, payload, provider, status, tenant_id, license_id, invoice_id, event_created_at, error_message)
        VALUES ($1, $2, $3, 'stripe', $4, $5, $6, $7, $8, $9)
      `, [event.eventId, event.eventType || 'unknown', req.rawBody, outcome.outcome, outcome.tenantId || null, outcome.licenseId || null,
        outcome.invoiceId || null, event.timestamp, outcome.reason || null]);
      return outcome;
    });
    // Reddedilen olay da 200 alır: sağlayıcı aynı geçersiz olayı sonsuza kadar yeniden göndermesin; sonuç kayıtlıdır.
    res.status(200).json({ received: true, outcome: result.outcome, duplicate: Boolean(result.duplicate), reason: result.reason });
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(200).json({ received: true, duplicate: true });
    console.error('Webhook error:', { requestId: req.requestId, message: error.message });
    // 500: sağlayıcı daha sonra yeniden dener; olay kaydı yazılmadığı için tekrar işlenebilir.
    res.status(500).json({ error: 'Bildirim işlenemedi.' });
  }
};

module.exports = {
  handlePaymentWebhook
};
