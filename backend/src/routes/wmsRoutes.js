const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

const warehouseLocationController = require('../controllers/warehouseLocationController');
const inventoryTransactionController = require('../controllers/inventoryTransactionController');
const inventoryReservationController = require('../controllers/inventoryReservationController');
const wmsInboundController = require('../controllers/wmsInboundController');
const wmsPickingController = require('../controllers/wmsPickingController');
const wmsPackingController = require('../controllers/wmsPackingController');
const wmsSlottingController = require('../controllers/wmsSlottingController');
const wmsCycleCountController = require('../controllers/wmsCycleCountController');

// All WMS routes are authenticated
router.use(authMiddleware);
router.use(require('../middlewares/warehouseBoundary'));
router.get('/inventory/transfer-options',async(req,res,next)=>{try{res.json(await require('../services/warehouseLocationService').getTransferOptions(req.user.tenantId,req.query.warehouse_id));}catch(e){res.status(e.status||400).json({error:e.message});}});

// --- 1. Locations & Bins ---
router.get('/locations', warehouseLocationController.getLocations);
router.get('/locations/:id', warehouseLocationController.getLocationById);
router.post('/locations/generate-grid', requireRole('admin', 'manager'), warehouseLocationController.generateAisleGrid);
router.post('/locations/relocate', requireRole('admin', 'manager'), warehouseLocationController.relocateStock);
router.put('/locations/:id/lock', requireRole('admin', 'manager'), warehouseLocationController.toggleLock);

// --- 2. Inventory Ledger & Unified Barcode Resolver ---
router.get('/ledger', inventoryTransactionController.getLedgerHistory);
router.post('/ledger/transaction', requireRole('admin', 'manager'), inventoryTransactionController.recordTransaction);
router.get('/ledger/product/:productId', inventoryTransactionController.getProductBreakdown);
router.post('/barcode/resolve', inventoryTransactionController.resolveBarcode);

// --- 3. Reservations & Allocations ---
router.get('/reservations', inventoryReservationController.getActiveReservations);
router.post('/reservations', requireRole('admin', 'manager'), inventoryReservationController.createReservation);
router.delete('/reservations/:id', requireRole('admin', 'manager'), inventoryReservationController.releaseReservation);

// --- 4. Inbound & Putaway ---
router.get('/inbound/receipts', wmsInboundController.getReceipts);
router.get('/inbound/receipts/:id', wmsInboundController.getReceiptById);
router.post('/inbound/receipts', requireRole('admin', 'manager'), wmsInboundController.createReceipt);
router.post('/inbound/putaway', requireRole('admin', 'manager'), wmsInboundController.completePutaway);

// --- 5. Wave & Batch Picking ---
router.get('/picking/waves', wmsPickingController.getWaves);
router.get('/picking/waves/:id', wmsPickingController.getWaveById);
router.post('/picking/waves', requireRole('admin', 'manager'), wmsPickingController.createWave);
router.post('/picking/confirm-item', requireRole('admin', 'manager'), wmsPickingController.confirmPickItem);

// --- 6. Packing, Handling Units & Dock Appointments ---
router.get('/packing/handling-units', wmsPackingController.getHandlingUnits);
router.post('/packing/handling-units', requireRole('admin', 'manager'), wmsPackingController.createHandlingUnit);
router.post('/packing/dispatch', requireRole('admin', 'manager'), wmsPackingController.dispatchShipment);
router.get('/packing/dock-appointments', wmsPackingController.getDockAppointments);
router.post('/packing/dock-appointments', requireRole('admin', 'manager'), wmsPackingController.createDockAppointment);

// --- 7. ABC Slotting & Replenishment Analytics ---
router.get('/slotting/abc', wmsSlottingController.getABCAnalysis);
router.get('/slotting/recommendations', wmsSlottingController.getRecommendations);
router.get('/slotting/replenishment', wmsSlottingController.getReplenishments);

// --- 8. Blind Cycle Counting ---
router.get('/cycle-count/locations', wmsCycleCountController.getLocationsForCount);
router.post('/cycle-count/baseline', wmsCycleCountController.getManualBaseline);
router.post('/cycle-count/preview', wmsCycleCountController.previewAdjustment);
router.get('/cycle-count/reviews', wmsCycleCountController.getReviews);
router.post('/cycle-count/adjust', requireRole('admin', 'manager'), wmsCycleCountController.submitCountAdjustment);

module.exports = router;
