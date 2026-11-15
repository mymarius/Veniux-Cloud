// Online mağaza yönetimi (oturumlu): ayarlar, ürün yayını, siparişler. Paket: online_store.
const express = require('express');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const packs = require('../services/sectorPacks');
const store = require('../services/onlineStoreService');
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

router.get('/orders', staff, run(req => store.listOrders(req.user, req.query)));
router.get('/orders/:id', staff, run(req => store.getOrder(req.user, req.params.id)));
router.patch('/orders/:id/status', staff, run(req => store.setStatus(req.user, req.params.id, req.body)));
router.get('/summary', staff, run(req => store.summary(req.user)));

module.exports = router;
