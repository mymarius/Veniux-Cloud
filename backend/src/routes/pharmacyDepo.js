const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const pharmacyDepoController = require('../controllers/pharmacyDepoController');

router.use(authMiddleware);

router.get('/dashboard-stats', pharmacyDepoController.getDashboardStats);
router.get('/medicines', pharmacyDepoController.getMedicines);
router.get('/lots-serials', pharmacyDepoController.getLotsAndSerials);
router.post('/inbound', requireRole('admin', 'manager'), pharmacyDepoController.inboundReceive);
router.post('/dispense-fefo', requireRole('admin', 'manager'), pharmacyDepoController.dispenseFEFO);
router.get('/returns-quarantine', pharmacyDepoController.getReturnsAndQuarantine);
router.get('/movements', pharmacyDepoController.getMovements);
router.post('/count', requireRole('admin', 'manager'), pharmacyDepoController.count);
router.post('/quarantine', requireRole('admin', 'manager'), pharmacyDepoController.quarantine);

module.exports = router;
