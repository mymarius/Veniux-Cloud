const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const {
  getAlerts,
  updateAlertStatus,
  runRuleEngine,
  runAIAnalysisEndpoint
} = require('../controllers/alertController');

// All alert routes require authentication
router.use(authMiddleware);

// GET /api/alerts - Get all alerts with optional filters
router.get('/', getAlerts);

// PUT /api/alerts/:id - Update alert status
router.put('/:id', requireRole('admin', 'manager'), updateAlertStatus);

// POST /api/alerts/run-rule-engine - Run rule engine manually (admin/manager only)
router.post('/run-rule-engine', requireRole('admin', 'manager'), runRuleEngine);

// POST /api/alerts/run-analysis - Run AI analysis manually (admin/manager only)
router.post('/run-analysis', requireRole('admin', 'manager'), runAIAnalysisEndpoint);

module.exports = router;
