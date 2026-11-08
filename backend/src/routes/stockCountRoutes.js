const express = require('express');
const router = express.Router();
const {
  getAllStockCounts,
  getStockCountById,
  createStockCount,
  updateStockCountItem,
  finalizeStockCount
} = require('../controllers/stockCountController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, getAllStockCounts);
router.get('/:id', authMiddleware, getStockCountById);
router.post('/', authMiddleware, requireRole('admin', 'manager', 'warehouse_lead'), createStockCount);
router.put('/:count_id/items/:item_id', authMiddleware, requireRole('admin', 'manager', 'warehouse_lead'), updateStockCountItem);
router.post('/:id/finalize', authMiddleware, requireRole('admin', 'manager'), finalizeStockCount);

module.exports = router;
