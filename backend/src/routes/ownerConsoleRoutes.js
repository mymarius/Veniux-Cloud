// Yönetim sitesi (yonetim.veniux.com) için imzalı uçlar. Oturum yok; her istek HMAC ile doğrulanır (bkz. middlewares/ownerConsoleAuth.js).
const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/ownerConsoleAuth');
const service = require('../services/ownerConsoleService');
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, limit: process.env.NODE_ENV === 'test' ? 100000 : 60, standardHeaders: false, legacyHeaders: false, message: { code: 'RATE_LIMIT', error: 'Çok fazla istek.' } }));
router.use(auth.middleware);
const run = fn => async (req, res, next) => { try { res.set('Cache-Control', 'no-store').json(await fn(req)); } catch (e) { next(e); } };
router.get('/ping', run(() => ({ ok: true })));
router.post('/tenants/:id/access', run(req => service.setTenantAccess(req.params.id, req.body && req.body.active, req.body && req.body.reason)));
router.get('/catalogue', run(() => service.catalogue()));
router.put('/catalogue/plans/:code', run(req => service.setPlan(req.params.code, req.body || {})));
module.exports = router;
