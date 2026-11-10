const express = require('express');
const { authMiddleware } = require('../middlewares/authMiddleware');
const service = require('../services/storeSyncService');
const router = express.Router();

// Mağaza bilgisayarı: kendi cihaz anahtarıyla satış yükler (kullanıcı oturumu gerekmez).
router.post('/sales', async (req, res, next) => {
  try { res.json(await service.ingest(await service.authenticate(req.get('Authorization')), req.body)); } catch (e) { next(e); }
});

// Mağaza bilgisayarı: bulutun ürün ve fiyat listesini sayfa sayfa çeker (cihaz anahtarıyla).
router.get('/products', async (req, res, next) => {
  try { res.json(await service.productPage(await service.authenticate(req.get('Authorization')), req.query.after_id)); } catch (e) { next(e); }
});

// Yönetici uçları (oturum gerekir).
router.use(authMiddleware);
router.get('/devices', async (req, res, next) => { try { res.json(await service.listDevices(req.user)); } catch (e) { next(e); } });
router.post('/devices', async (req, res, next) => { try { res.status(201).json(await service.createDevice(req.user, req.body && req.body.name)); } catch (e) { next(e); } });
router.delete('/devices/:id', async (req, res, next) => { try { res.json(await service.revokeDevice(req.user, req.params.id)); } catch (e) { next(e); } });
router.get('/summary', async (req, res, next) => { try { res.json(await service.summary(req.user, req.query)); } catch (e) { next(e); } });
// Mağaza tarafı ayarı ve elle gönderim.
router.get('/config', async (req, res, next) => { try { res.json(await service.getConfig(req.user)); } catch (e) { next(e); } });
router.put('/config', async (req, res, next) => { try { res.json(await service.saveConfig(req.user, req.body)); } catch (e) { next(e); } });
router.delete('/config', async (req, res, next) => { try { res.json(await service.removeConfig(req.user)); } catch (e) { next(e); } });
router.post('/push', async (req, res, next) => { try { await service.getConfig(req.user); const pushed = await service.pushOnce(req.user.tenantId); res.json({ ...pushed, products: await service.pullProducts(req.user.tenantId) }); } catch (e) { next(e); } });

module.exports = router;
