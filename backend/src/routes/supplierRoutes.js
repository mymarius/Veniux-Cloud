const express = require('express');
const router = express.Router();
const {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  returnSupplier
} = require('../controllers/supplierController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, getAllSuppliers);
router.get('/:id', authMiddleware, getSupplierById);
router.post('/', authMiddleware, requireRole('admin', 'manager'), createSupplier);
router.put('/:id', authMiddleware, requireRole('admin', 'manager'), updateSupplier);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteSupplier);
router.post('/:id/returns', authMiddleware, requireRole('admin','manager'), returnSupplier);

module.exports = router;
