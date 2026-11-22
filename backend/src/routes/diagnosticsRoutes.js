const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
router.use(authMiddleware, requireRole('admin', 'manager'));
router.get('/app', async (req, res, next) => { try { res.set('Cache-Control', 'no-store').json(await require('../services/diagnosticsService').run(req.user)); } catch (e) { next(e); } });
module.exports = router;
