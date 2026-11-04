const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, requireRole('admin'), getAuditLogs);

module.exports = router;
