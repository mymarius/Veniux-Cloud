const express = require('express');
const service = require('../services/marketplaceService');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();
const handle = fn => async (req, res) => {
  try { res.json(await fn(req)); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Pazaryeri işlemi tamamlanamadı.' }); }
};
router.use(authMiddleware, requireRole('admin'));
// Desteklenen pazaryerleri ve her birinin deneme durumu.
router.get('/', handle(() => ({ providers: service.providerList() })));
// :provider = trendyol | hepsiburada | n11 (bilinmeyen ad 404 döner).
router.get('/:provider', handle(req => service.status(req.user, req.params.provider)));
router.put('/:provider', handle(req => service.save(req.user, req.body || {}, req.params.provider)));
router.post('/:provider/test', handle(req => service.test(req.user, req.params.provider)));
router.post('/:provider/sync', handle(req => service.sync(req.user, req.params.provider)));
router.get('/:provider/report', handle(req => service.report(req.user, req.query || {}, req.params.provider)));
router.post('/:provider/settlements/sync', handle(req => service.syncSettlements(req.user, req.params.provider)));
module.exports = router;
