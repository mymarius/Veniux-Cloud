const express = require('express');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const service = require('../services/labelCheckService');
const router = express.Router();
router.use(authMiddleware, requireRole('admin', 'manager', 'cashier'));
router.post('/', async (req, res, next) => { try { res.status(201).json(await service.record(req.user, req.body)); } catch (e) { next(e); } });
router.get('/', async (req, res, next) => { try { res.json(await service.summary(req.user, req.query)); } catch (e) { next(e); } });
module.exports = router;
