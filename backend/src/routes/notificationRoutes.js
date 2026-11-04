const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const { sendTest } = require('../controllers/notificationController');

// All notification routes require authentication
router.use(authMiddleware);

// POST /api/notifications/test - Send test notification (admin only)
router.post('/test', requireRole('admin'), sendTest);

module.exports = router;
