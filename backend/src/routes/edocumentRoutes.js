const express = require('express');
const service = require('../services/edocumentService');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();
const handle = fn => async (req, res) => {
  try { res.json(await fn(req)); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'e-Belge işlemi tamamlanamadı.' }); }
};
router.use(authMiddleware, requireRole('admin', 'manager'));
router.get('/connection', handle(req => service.status(req.user)));
router.put('/connection', handle(req => service.saveConnection(req.user, req.body)));
router.delete('/connection', handle(req => service.removeConnection(req.user)));
router.post('/connection/test', handle(req => service.testConnection(req.user)));
router.post('/taxpayer', handle(req => service.checkTaxpayer(req.user, req.body?.vkn)));
router.get('/', handle(req => service.list(req.user)));
router.post('/sales/:id/draft', handle(req => service.draftFromSale(req.user, req.params.id, req.body)));
router.post('/:id/send', handle(req => service.send(req.user, req.params.id)));
router.post('/:id/refresh', handle(req => service.refresh(req.user, req.params.id)));
module.exports = router;
