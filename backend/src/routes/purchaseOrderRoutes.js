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
router.post('/:id/receive', authMiddleware, requireRole('admin', 'manager'), receivePurchaseOrder);
router.post('/:id/status', authMiddleware, requireRole('admin', 'manager'), transitionPurchaseOrder);
router.post('/:id/returns', authMiddleware, requireRole('admin', 'manager'), returnPurchaseOrder);

module.exports = router;
