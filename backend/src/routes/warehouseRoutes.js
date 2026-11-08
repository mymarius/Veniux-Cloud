const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const {
  getAllWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse
} = require('../controllers/warehouseController');

// All warehouse routes require authentication
router.use(authMiddleware);
const checkEntitlement = require('../middlewares/licenseMiddleware');

// GET /api/warehouses - Get all warehouses
router.get('/', getAllWarehouses);

// GET /api/warehouses/branch-report - Şubeler arası stok ve satış (yalnız yönetici ve müdür)
router.get('/branch-report', requireRole('admin', 'manager'), async (req, res, next) => { try { res.json(await require('../services/branchReportService').report(req.user, req.query || {})); } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); } });

// GET /api/warehouses/:id - Get warehouse by ID
router.get('/:id', getWarehouseById);

// POST /api/warehouses - Create new warehouse
router.post('/', requireRole('admin'), checkEntitlement('warehouses'), createWarehouse);

// PUT /api/warehouses/:id - Update warehouse (admin/manager only)
router.put('/:id', requireRole('admin', 'manager'), updateWarehouse);

// DELETE /api/warehouses/:id - Delete warehouse (admin only)
router.delete('/:id', requireRole('admin'), deleteWarehouse);

module.exports = router;
