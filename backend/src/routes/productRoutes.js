const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories
} = require('../controllers/productController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/categories', authMiddleware, getCategories);
router.get('/', authMiddleware, getAllProducts);
router.get('/:id', authMiddleware, getProductById);
router.post('/', authMiddleware, requireRole('admin', 'manager'), createProduct);
router.put('/:id', authMiddleware, requireRole('admin', 'manager'), updateProduct);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteProduct);

module.exports = router;
