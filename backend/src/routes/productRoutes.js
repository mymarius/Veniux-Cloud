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
const scaleCodes = require('../services/productScaleCodes');
const scaleHandle = fn => async (req, res) => { try { res.json(await fn(req)); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Terazi kodu kaydedilemedi.' }); } };
router.get('/:id/scale-code', authMiddleware, scaleHandle(req => scaleCodes.get(req.user, req.params.id)));
router.put('/:id/scale-code', authMiddleware, requireRole('admin', 'manager'), scaleHandle(req => scaleCodes.set(req.user, req.params.id, req.body?.plu)));
router.delete('/:id', authMiddleware, requireRole('admin'), deleteProduct);

module.exports = router;
