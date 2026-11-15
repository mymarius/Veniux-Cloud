// İşletmenin marka adı ve logosu: herkes (oturumlu) okuyabilir, yalnız yönetici değiştirir.
const express = require('express');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const branding = require('../services/brandingService');
const router = express.Router();
const run = fn => async (req, res, next) => { try { res.set('Cache-Control', 'no-store').json(await fn(req)); } catch (e) { next(e); } };
router.use(authMiddleware);
router.get('/', run(req => branding.get(req.user.tenantId)));
// Gövde genel JSON ayrıştırıcısıyla okunur; logo uzunluğu ve içeriği serviste (200 KB, bayt imzası, boyut) doğrulanır.
router.put('/', requireRole('admin'), run(req => branding.save(req.user, req.body || {})));
module.exports = router;
