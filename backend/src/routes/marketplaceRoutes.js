const express = require('express');
const service = require('../services/marketplaceService');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();
const handle = fn => async (req, res) => {
  try { res.json(await fn(req)); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Trendyol işlemi tamamlanamadı.' }); }
};
router.use(authMiddleware, requireRole('admin'));
router.get('/trendyol', handle(req => service.status(req.user)));
router.put('/trendyol', handle(req => service.save(req.user, req.body || {})));
router.post('/trendyol/test', handle(req => service.test(req.user)));
router.post('/trendyol/sync', handle(req => service.sync(req.user)));
module.exports = router;
