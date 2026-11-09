const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, requireRole('admin'), getAuditLogs);
router.get('/integrity', authMiddleware, requireRole('admin'), async (req, res, next) => { try { res.json(await require('../services/auditIntegrityService').verify(req.user.tenantId)); } catch (error) { next(error); } });

module.exports = router;
