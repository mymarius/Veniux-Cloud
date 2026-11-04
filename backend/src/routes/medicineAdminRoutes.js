const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middlewares/authMiddleware');
const controller = require('../controllers/medicineAdminController');
const { syncStatus } = require('../controllers/medicineController');

// İlaç kataloğu tüm işletmelerin ortak verisidir; yalnızca platform yöneticisi değiştirebilir.
const router = express.Router();
router.use(
  authMiddleware,
  (req, res, next) => (req.user.isPlatformAdmin ? next() : res.status(403).json({ success: false, message: 'İlaç Yönetimi yalnızca platform yöneticisine açıktır.', error: 'İlaç Yönetimi yalnızca platform yöneticisine açıktır.' })),
  rateLimit({ windowMs: 60000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Çok fazla istek.' } })
);

const imageBody = express.raw({ type: ['application/octet-stream', 'image/*'], limit: '2mb' });
const fileBody = express.raw({ type: ['application/octet-stream', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], limit: '40mb' });

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/settings', controller.getSettings);
router.get('/images/sync', (req,res)=>res.json(require('../services/medicines/manufacturerImages').status()));
router.post('/images/sync', (req,res)=>{
 const service=require('../services/medicines/manufacturerImages');
 if(service.status().running)return res.status(409).json({error:'Görsel eşleştirme zaten çalışıyor.'});
 service.run().catch(error=>console.error('[Medicine images]',error.message));
 res.status(202).json({running:true});
});
router.put('/settings', controller.updateSettings);
router.post('/import', fileBody, controller.importFile);
router.post('/sync', controller.startSync);
router.get('/sync/status', syncStatus);
router.get('/sync/logs', controller.syncLogs);
router.get('/sync/logs/:id', controller.syncLog);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/image', imageBody, controller.uploadImage);
router.put('/:id/image', controller.updateImage);
router.delete('/:id/image', controller.deleteImage);
router.post('/:id/image/cache', controller.cacheImage);

module.exports = router;
