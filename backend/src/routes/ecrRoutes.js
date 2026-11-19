const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const ecr = require('../services/ecrService');
const run = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (e) { next(e); } };

router.use(authMiddleware);
router.get('/devices', requireRole('admin', 'manager'), run(req => ecr.devices(req.user)));
router.post('/devices', requireRole('admin', 'manager'), async (req, res, next) => { try { res.status(201).json(await ecr.registerDevice(req.user, req.body || {})); } catch (e) { next(e); } });
router.get('/jobs', requireRole('admin', 'manager', 'cashier'), run(req => ecr.jobs(req.user, req.query || {})));
router.post('/process', requireRole('admin', 'manager', 'cashier'), run(req => ecr.processPending(req.user)));
router.post('/jobs/:id/process', requireRole('admin', 'manager', 'cashier'), run(req => ecr.processJob(req.user, Number(req.params.id))));
module.exports = router;
