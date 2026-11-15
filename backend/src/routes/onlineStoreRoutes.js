// Online mağaza yönetimi (oturumlu): ayarlar, ürün yayını, siparişler. Paket: online_store.
const express = require('express');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const packs = require('../services/sectorPacks');
const store = require('../services/onlineStoreService');
const media = require('../services/onlineStoreMedia');
const extras = require('../services/onlineStoreExtras');
const router = express.Router();
const run = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { next(e); } };
const staff = requireRole('admin', 'manager', 'cashier');
const boss = requireRole('admin', 'manager');

router.use(authMiddleware, packs.require('online_store'));

router.get('/settings', boss, run(req => store.getSettings(req.user)));
router.put('/settings', boss, run(req => store.saveSettings(req.user, req.body)));
router.get('/slug-check', boss, run(req => store.slugAvailable(req.user, req.query.slug)));

router.get('/products', boss, run(req => store.listProducts(req.user, req.query)));
router.put('/products/bulk', boss, run(req => store.bulkPublish(req.user, req.body)));
router.put('/products/:id', boss, run(req => store.setProduct(req.user, req.params.id, req.body)));

// Ürün görselleri: tarayıcı küçültüp JPEG/PNG/WebP gövdesini doğrudan gönderir (en çok 2 MB).
const image = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: media.MAX_BYTES });
router.get('/products/:id/media', boss, run(req => media.list(req.user, req.params.id)));
router.post('/products/:id/media', boss, image, async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body)) return res.status(415).json({ error: 'Görsel JPEG, PNG veya WebP olarak gönderilmeli.', code: 'BAD_IMAGE' });
    res.status(201).json(await media.save(req.user, req.params.id, req.body, req.query.alt));
  } catch (e) { next(e); }
});
router.put('/products/:id/media/order', boss, run(req => media.reorder(req.user, req.params.id, req.body)));
router.patch('/products/:id/media/:mediaId', boss, run(req => media.setAlt(req.user, req.params.id, req.params.mediaId, req.body)));
router.delete('/products/:id/media/:mediaId', boss, run(req => media.remove(req.user, req.params.id, req.params.mediaId)));
router.get('/media/:key', staff, async (req, res, next) => {
  try { const found = await media.ownFile(req.user, req.params.key); res.set({ 'Content-Type': found.mime, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' }); res.sendFile(found.file); } catch (e) { next(e); }
});

router.get('/orders', staff, run(req => store.listOrders(req.user, req.query)));
router.get('/orders/:id', staff, run(req => store.getOrder(req.user, req.params.id)));
router.patch('/orders/:id/status', staff, run(req => store.setStatus(req.user, req.params.id, req.body)));
router.get('/discount-codes', boss, run(req => extras.listCodes(req.user)));
router.post('/discount-codes', boss, run(req => extras.saveCode(req.user, null, req.body)));
router.put('/discount-codes/:id', boss, run(req => extras.saveCode(req.user, req.params.id, req.body)));
router.delete('/discount-codes/:id', boss, run(req => extras.deleteCode(req.user, req.params.id)));
router.get('/shipping-rules', boss, run(req => extras.listRules(req.user)));
router.post('/shipping-rules', boss, run(req => extras.saveRule(req.user, null, req.body)));
router.put('/shipping-rules/:id', boss, run(req => extras.saveRule(req.user, req.params.id, req.body)));
router.delete('/shipping-rules/:id', boss, run(req => extras.deleteRule(req.user, req.params.id)));
router.put('/orders/:id/shipping', staff, run(req => extras.setShipping(req.user, req.params.id, req.body)));
router.get('/summary', staff, run(req => store.summary(req.user)));

module.exports = router;
