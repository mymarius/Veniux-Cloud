// Online mağaza vitrini (oturumsuz): mağaza, ürünler, görseller, sipariş. Yalnız yayında olan mağaza için çalışır; yoksa hep aynı 404.
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const apiThrottle = require('../middlewares/apiThrottle');
const store = require('../services/onlineStoreService');
const router = express.Router({ mergeParams: true });
const num = (name, fallback) => Number(process.env[name]) || fallback;
const keyOf = req => apiThrottle.clientAddress(req);
const limiter = (windowMs, max, message) => rateLimit({ windowMs, max, keyGenerator: keyOf, standardHeaders: false, legacyHeaders: false, message: { error: message, code: 'RATE_LIMIT' } });
const readLimit = limiter(60000, num('SHOP_READ_MAX', 120), 'Çok fazla istek. Biraz bekleyin.');
const quoteLimit = limiter(60000, num('SHOP_QUOTE_MAX', 40), 'Çok fazla istek. Biraz bekleyin.');
const orderMinute = limiter(60000, num('SHOP_ORDER_MINUTE_MAX', 5), 'Çok sık sipariş denemesi. Bir dakika sonra tekrar deneyin.');
const orderHour = limiter(3600000, num('SHOP_ORDER_HOUR_MAX', 30), 'Sipariş sınırına ulaşıldı. Daha sonra tekrar deneyin.');
const run = (fn, cache) => async (req, res, next) => { try { const body = await fn(req); res.set('Cache-Control', cache || 'no-store'); res.json(body); } catch (e) { next(e); } };

router.get('/:slug', readLimit, run(req => store.publicStore(req.params.slug), 'public, max-age=30'));
router.get('/:slug/products', readLimit, run(req => store.publicProducts(req.params.slug, req.query), 'public, max-age=10'));
router.get('/:slug/products/:id', readLimit, run(req => store.publicProduct(req.params.slug, req.params.id), 'public, max-age=10'));
router.get('/:slug/orders/:code', readLimit, run(req => store.publicOrder(req.params.slug, req.params.code)));
router.post('/:slug/quote', quoteLimit, express.json({ limit: '32kb' }), run(req => store.quote(req.params.slug, req.body || {})));
router.post('/:slug/orders', orderMinute, orderHour, express.json({ limit: '32kb' }), async (req, res, next) => {
  try {
    const ipHash = crypto.createHash('sha256').update(String(keyOf(req))).digest('hex').slice(0, 16);
    const result = await store.createOrder(req.params.slug, req.body || {}, req.get('Idempotency-Key'), ipHash);
    res.set('Cache-Control', 'no-store').status(result.repeated ? 200 : 201).json(result);
  } catch (e) { next(e); }
});

// Görsel: dosya işleme (sonraki adım) hazır olana dek yalnız kaydı doğrular.
router.get('/:slug/media/:key', readLimit, async (req, res, next) => {
  try {
    const row = await store.publicMedia(req.params.slug, req.params.key);
    const file = require('../services/onlineStoreMedia').pathOf(row);
    if (!file || !require('fs').existsSync(file)) return res.status(404).json({ error: 'Görsel bulunamadı.' });
    res.set({ 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(file);
  } catch (e) { next(e); }
});

// Genel hata işleyicisi stok/fiyat ayrıntısını düşürür; müşteri hangi ürünün sorunlu olduğunu görmeli.
router.use((err, req, res, next) => {
  if (err && (err.shortages || err.changed)) return res.status(err.status || 409).json({ error: err.message, code: err.code, shortages: err.shortages, changed: err.changed });
  next(err);
});

module.exports = router;
