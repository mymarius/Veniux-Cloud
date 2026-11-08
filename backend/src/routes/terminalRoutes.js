const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const terminalController = require('../controllers/terminalController');

// All terminal communication is authenticated
router.use(authMiddleware);
router.use(require('../middlewares/warehouseBoundary'));

// 1. Device Registration & Telemetry
// Cihaz kaydı ve depo ataması yönetici işidir; görüntüleme yetkili kullanıcılar cihazları değiştiremez.
router.post('/register', requireRole('admin', 'manager'), terminalController.registerDevice);
router.post('/heartbeat', terminalController.sendHeartbeat);
router.get('/devices', terminalController.getRegisteredDevices);

// 2. Barcode & Karekod Scanner Resolution
router.post('/scan', terminalController.resolveScan);

// 3. Terminal Warehouse Operations
router.post('/operations/inbound', requireRole('admin', 'manager'), terminalController.fastInbound);
router.post('/operations/outbound', requireRole('admin', 'manager'), terminalController.fastOutbound);
router.post('/operations/relocate', requireRole('admin', 'manager'), terminalController.relocateStock);
router.post('/operations/count', requireRole('admin', 'manager'), terminalController.cycleCount);

module.exports = router;
