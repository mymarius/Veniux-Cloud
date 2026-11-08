const express = require('express');
const router = express.Router();
const {
  createMovement,
  transferStock,
  adjustStock,
  importStock,
  getStockRecords,
  getStockMovements,
  getStockAnalytics,
  getDashboardMetrics
} = require('../controllers/stockController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/dashboard-metrics', authMiddleware, getDashboardMetrics);
router.get('/analytics', authMiddleware, getStockAnalytics);
router.get('/records', authMiddleware, getStockRecords);
router.get('/movements', authMiddleware, getStockMovements);
router.post('/movement', authMiddleware, requireRole('admin', 'manager'), createMovement);
router.post('/transfer', authMiddleware, requireRole('admin', 'manager', 'warehouse_lead'), transferStock);
router.post('/adjust', authMiddleware, requireRole('admin', 'manager'), adjustStock);
router.post('/import', authMiddleware, requireRole('admin', 'manager'), importStock);

module.exports = router;
