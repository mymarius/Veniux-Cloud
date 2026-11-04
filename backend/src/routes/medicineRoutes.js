const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('../middlewares/authMiddleware');
const controller = require('../controllers/medicineController');

const router = express.Router();
const limited = message => rateLimit({ windowMs: 60000, limit: 240, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });

// Görsel ucu <img> etiketinden çağrılır; kimlik doğrulaması istemez, sıkı oran sınırlıdır.
router.get('/:id/image', limited('Çok fazla görsel isteği. Biraz sonra tekrar deneyin.'), controller.image);

router.use(authMiddleware, limited('Çok fazla istek. Bir dakika sonra tekrar deneyin.'));
router.get('/', controller.list);
router.get('/search', controller.list);
router.get('/stats', controller.stats);
router.get('/new', controller.newMedicines);
router.get('/barcode/:barcode', controller.byBarcode);
router.get('/:id/knowledge',async(req,res)=>{try{res.json({success:true,data:await require('../services/medicines/medicineKnowledgeService').get(req.params.id)});}catch(error){controller.fail(res,error);}});
router.get('/:id', controller.detail);

module.exports = router;
