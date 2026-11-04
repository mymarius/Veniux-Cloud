const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const normalDepoController = require('../controllers/normalDepoController');

router.use(authMiddleware);
router.get('/stock-health',async(req,res,next)=>{try{res.json(await require('../services/stockHealthService').stockOverview(req.user.tenantId,req.query.days||30));}catch(e){if(e.status)return res.status(e.status).json({error:e.message});next(e);}});
router.use('/product-import',requireRole('admin','manager'),require('./productImportRoutes'));

router.get('/dashboard-stats', normalDepoController.getDashboardStats);
router.get('/products', normalDepoController.getProducts);
router.get('/warehouses', normalDepoController.getWarehouses);
router.get('/locations', normalDepoController.getLocations);
router.post('/inbound-receive', requireRole('admin', 'manager'), normalDepoController.inboundReceive);
router.get('/movements', normalDepoController.getMovements);
router.post('/transfer', requireRole('admin', 'manager'), normalDepoController.createTransfer);

module.exports = router;
