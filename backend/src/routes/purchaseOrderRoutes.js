const express = require('express');
const router = express.Router();
const {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  createFromForecast,
  receivePurchaseOrder,
  transitionPurchaseOrder,
  returnPurchaseOrder
} = require('../controllers/purchaseOrdersController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, requireRole('admin', 'manager'), getAllPurchaseOrders);
router.get('/:id', authMiddleware, requireRole('admin', 'manager'), getPurchaseOrderById);
router.post('/', authMiddleware, requireRole('admin', 'manager'), createPurchaseOrder);
router.post('/from-forecast', authMiddleware, requireRole('admin', 'manager'), createFromForecast);
const docs = require('../services/purchaseOrderDocumentService');
const docRoute = fn => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(error.status || 400).json({ error: error.message }); } };
router.get('/:id/document', authMiddleware, requireRole('admin', 'manager'), docRoute(async (req, res) => { const d = await docs.document(req.user, req.params.id, req.query.format === 'pdf' ? 'pdf' : 'html'); res.set('Cache-Control', 'no-store').type(d.type); if (req.query.download === '1') res.attachment(d.filename); res.send(d.body); }));
router.post('/:id/send-email', authMiddleware, requireRole('admin', 'manager'), docRoute(async (req, res) => res.json(await docs.sendEmail(req.user, req.params.id, req.body || {}))));
router.get('/:id/whatsapp-link', authMiddleware, requireRole('admin', 'manager'), docRoute(async (req, res) => res.json(await docs.whatsappLink(req.user, req.params.id))));
router.post('/:id/receive', authMiddleware, requireRole('admin', 'manager'), receivePurchaseOrder);
router.post('/:id/status', authMiddleware, requireRole('admin', 'manager'), transitionPurchaseOrder);
router.post('/:id/returns', authMiddleware, requireRole('admin', 'manager'), returnPurchaseOrder);

module.exports = router;
