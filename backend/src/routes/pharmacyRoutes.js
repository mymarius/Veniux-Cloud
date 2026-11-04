const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacyController');
const { authMiddleware,requireRole } = require('../middlewares/authMiddleware');

const coloredPrescController = require('../controllers/coloredPrescriptionController');
const majistralController = require('../controllers/majistralController');
const salesController = require('../controllers/pharmacySalesController');
const drugInteractionController = require('../controllers/drugInteractionController');
const medulaProvisionController = require('../controllers/medulaProvisionController');
const dutyPharmacyController = require('../controllers/dutyPharmacyController');
const returnManagementController = require('../controllers/returnManagementController');
const coldChainController = require('../controllers/coldChainController');
const pharmacyAnalyticsController = require('../controllers/pharmacyAnalyticsController');
const depotAccountController = require('../controllers/depotAccountController');
const eInvoiceController = require('../controllers/eInvoiceController');

// All pharmacy endpoints are protected
router.use(authMiddleware);
router.use((req,res,next)=>{
  if(['/scan-local-folders','/farmakom-status','/farmakom-sync','/interaction-rules'].includes(req.path)&&(req.path!=='/interaction-rules'||req.method!=='GET')&&!req.user.isPlatformAdmin)return res.status(403).json({error:'Bu işlem platform yöneticisine açıktır.'});
  const readOnly=req.method==='GET'||['/check-interactions','/medula/calculate','/majistral/calculate'].includes(req.path)||(req.path==='/decode-karekod'&&(!req.body.action||req.body.action==='check'));
  return readOnly?next():requireRole('admin','manager','pharmacist')(req,res,next);
});
router.use(require('../middlewares/warehouseBoundary'));

// Dashboard & Overview
router.get('/dashboard', pharmacyController.getPharmacyDashboardStats);

// Medicines catalog & batches
router.get('/medicines', pharmacyController.getPharmacyMedicines);

// GS1 Karekod (2D Datamatrix) Scanning & Decoding
router.post('/decode-karekod', pharmacyController.decodeAndProcessKarekod);

// Medula & Local Computer Folder Auto-Scanner
router.post('/scan-local-folders', pharmacyController.scanLocalMedulaFolders);

// Direct Medula XML / CSV Import
router.post('/import-file', pharmacyController.importMedulaFile);

// Expiry (Miad) Radar
router.get('/expiry-radar', pharmacyController.getExpiryRadar);

// Pharmacy Depots
router.get('/depots', pharmacyController.getPharmacyDepots);

// Farmakom System Diagnosis & Stock Sync
router.get('/farmakom-status', pharmacyController.getFarmakomStatus);
router.post('/farmakom-sync', pharmacyController.syncFarmakomStock);

// Renkli Reçete (Kırmızı, Yeşil, Mor, Turuncu) & İl Sağlık Denetim Defteri
router.get('/colored-prescriptions', coloredPrescController.getColoredPrescriptions);
router.post('/colored-prescriptions', coloredPrescController.createColoredPrescription);
router.get('/colored-prescriptions/inspection-report', coloredPrescController.getInspectionReport);

// TEB Majistral Tarife & Laboratuvar Hesaplayıcı
router.post('/majistral/calculate', majistralController.calculateMajistralPrice);
router.get('/majistral/formulas', majistralController.getMajistralFormulas);
router.post('/majistral/formulas', majistralController.saveMajistralFormula);

// Eczane POS & Banko Hızlı Satış & Hasta Veresiye Defteri
router.post('/pos/sales', salesController.createPosSale);
router.get('/pos/sales', salesController.getPosSales);
router.get('/patients', salesController.getPatientAccounts);
router.post('/patients', salesController.createPatientAccount);
router.post('/patients/pay-debt', salesController.payPatientDebt);

// ======== MEGA ALTYAPI YENİ ENDPOINT'LER ========

// İlaç Etkileşim Kontrol Sistemi
router.post('/check-interactions', drugInteractionController.checkInteractions);
router.get('/patient-interactions/:patientId', drugInteractionController.checkPatientInteractions);
router.get('/interaction-rules', drugInteractionController.getInteractionRules);
router.post('/interaction-rules', drugInteractionController.addInteractionRule);

// SGK Medula Provizyon Sistemi
router.post('/medula/provision', medulaProvisionController.createProvision);
router.post('/medula/calculate', medulaProvisionController.calculateProvision);
router.get('/medula/provision-history', medulaProvisionController.getProvisionHistory);
router.get('/medula/provision/:id', medulaProvisionController.getProvisionById);
router.get('/medula/sut-prices', medulaProvisionController.getSutPrices);

// Nöbetçi Eczane & Vardiya Yönetimi
router.get('/staff', dutyPharmacyController.getStaff);
router.post('/staff', dutyPharmacyController.addStaff);
router.put('/staff/:id', dutyPharmacyController.updateStaff);
router.get('/duty-schedule', dutyPharmacyController.getDutySchedule);
router.post('/duty-schedule', dutyPharmacyController.createDutyEntry);
router.delete('/duty-schedule/:id', dutyPharmacyController.deleteDutyEntry);
router.get('/duty-summary', dutyPharmacyController.getDutySummary);

// İlaç İade & Ecza Deposu İade Yönetimi
router.post('/returns', returnManagementController.createReturn);
router.get('/returns', returnManagementController.getReturns);
router.get('/returns/summary', returnManagementController.getReturnSummary);
router.get('/returns/:id', returnManagementController.getReturnById);
router.put('/returns/:id/status', returnManagementController.updateReturnStatus);

// Soğuk Zincir & Sıcaklık Takip
router.get('/cold-chain/devices', coldChainController.getDevices);
router.post('/cold-chain/devices', coldChainController.addDevice);
router.post('/cold-chain/log-temperature', coldChainController.logTemperature);
router.get('/cold-chain/history/:deviceId', coldChainController.getTemperatureHistory);
router.get('/cold-chain/alarms', coldChainController.getAlarms);
router.get('/cold-chain/readings', coldChainController.getCurrentReadings);

// Gelişmiş Eczane Analitik & Raporlama
router.get('/analytics/revenue', pharmacyAnalyticsController.getRevenueAnalytics);
router.get('/analytics/top-selling', pharmacyAnalyticsController.getTopSellingMedicines);
router.get('/analytics/profit-margin', pharmacyAnalyticsController.getProfitMarginAnalysis);
router.get('/analytics/prescription-trends', pharmacyAnalyticsController.getPrescriptionTrends);
router.get('/analytics/depot-comparison', pharmacyAnalyticsController.getDepotComparison);
router.get('/analytics/monthly-report', pharmacyAnalyticsController.getMonthlyReport);

// Ecza Deposu Cari Hesap & Mutabakat
router.get('/depots/balance-summary', depotAccountController.getBalanceSummary);
router.get('/depots/:depotId/transactions', depotAccountController.getDepotTransactions);
router.post('/depots/:depotId/transactions', depotAccountController.addDepotTransaction);
router.post('/depots/:depotId/reconcile', depotAccountController.createReconciliation);
router.get('/reconciliations', depotAccountController.getReconciliations);
router.put('/reconciliations/:id', depotAccountController.updateReconciliationStatus);

// E-Fatura / E-İrsaliye
router.post('/invoices', eInvoiceController.createInvoice);
router.get('/invoices', eInvoiceController.getInvoices);
router.get('/invoices/summary', eInvoiceController.getInvoiceSummary);
router.get('/invoices/:id', eInvoiceController.getInvoiceById);
router.put('/invoices/:id/status', eInvoiceController.updateInvoiceStatus);
router.get('/invoices/:id/html', eInvoiceController.getInvoiceHtml);

module.exports = router;
