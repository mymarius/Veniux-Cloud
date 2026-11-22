const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const tasks = require('../services/businessTaskService');
const run = (fn, status = 200) => async (req, res, next) => { try { res.status(status).json(await fn(req)); } catch (e) { next(e); } };
const id = req => Number(req.params.id);

// Yönetici dışındakiler yalnız kendilerine atananı görür; ayrıntılı kural servis içindedir.
router.use(authMiddleware, requireRole('admin', 'manager', 'cashier', 'warehouse_lead', 'viewer'));
router.get('/', run(req => tasks.list(req.user, req.query || {})));
router.get('/badge', run(req => tasks.badge(req.user)));
router.get('/assignees', requireRole('admin', 'manager'), run(req => tasks.assignees(req.user)));
router.post('/', requireRole('admin', 'manager'), run(req => tasks.create(req.user, req.body || {}), 201));
router.put('/:id', requireRole('admin', 'manager'), run(req => tasks.update(req.user, id(req), req.body || {})));
router.patch('/:id/status', requireRole('admin', 'manager', 'cashier', 'warehouse_lead'), run(req => tasks.changeStatus(req.user, id(req), req.body?.status)));
router.delete('/:id', requireRole('admin', 'manager'), run(req => tasks.remove(req.user, id(req))));
module.exports = router;
