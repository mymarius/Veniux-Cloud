const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const licenseController = require('../controllers/licenseController');
const central = require('../services/centralLicense');
router.get('/policy', (req,res)=>res.json({activation_mode:'license_key',central_required:central.enabled(),browser_access:process.env.VENIUX_WEB_ACCESS==='1'||require('../services/mobileGateway').isCompanion(req),poll_seconds:30,offline_allowed:!central.enabled()}));
router.use(async (req,res,next)=>{
  if(!central.enabled() || !['/activate','/validate','/heartbeat','/deactivate'].includes(req.path)) return next();
  if(req.method!=='POST') return res.sendStatus(405);
  try {
    if(req.path==='/deactivate') return res.json({success:true});
    if(req.path==='/activate'&&req.body.app_version==='web'&&process.env.VENIUX_WEB_ACCESS!=='1'&&!require('../services/mobileGateway').isCompanion(req))return res.status(403).json({error:'Bu sunucuda web cihaz erişimi etkin değil.'});
    let credential=req.body.device_token;
    if(req.path==='/activate') {
      const key=typeof req.body.license_key==='string'?req.body.license_key.trim().toUpperCase():'';
      if(!/^VNX-[A-F0-9]{48}$/.test(key))return res.status(400).json({error:key.startsWith('HW-')?'HW- ile başlayan kod cihaz kimliğidir. Lisans merkezinden verilen VNX- ile başlayan lisans anahtarını girin.':'Lisans merkezinden verilen VNX- ile başlayan lisans anahtarını eksiksiz girin.'});
      credential=(await central.request('/activate',{...req.body,license_key:key})).device_token;
    }
    const payload=await central.verify(credential,req.body.device_fingerprint);
    if(!payload.valid) return res.json({valid:false,success:false,status:payload.status});
    const plan=require('../services/licenseService').getPlans().find(p=>p.id===payload.plan_id);
    if(!plan)return res.status(403).json({error:'Lisans paketi bu sürümde tanımlı değil.'});
    return res.json({valid:true,success:true,token:{payload:{...payload,enabled_features:plan.features,max_users:plan.max_users,max_warehouses:plan.max_warehouses,max_pdas:Math.min(plan.max_pdas,payload.max_devices??plan.max_pdas),device_token:credential}}});
  } catch(error) {
    if(error.status===429)return res.status(429).set('Retry-After','60').json({error:'Lisans deneme sınırına ulaşıldı. Bir dakika sonra tekrar deneyin.'});
    if([400,403].includes(error.status))return res.status(403).json({error:'Lisans anahtarı geçersiz, süresi dolmuş veya terminal sınırı dolu. Lisans merkezindeki kaydı kontrol edin.'});
    return res.status(503).json({error:'Merkezi lisans doğrulanamadı. Bağlantınızı ve lisans durumunu kontrol edin.'});
  }
});

const licenseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many license activation/validation attempts.'
});

// Public endpoints (used by Promotional Website & Desktop Boot)
router.get('/plans', licenseController.getPlans);
// Lisans anahtarı olmayan müşteri ödeme yapabilsin: yalnız yayımlanan hesap bilgisi, firma verisi içermez.
router.get('/bank-details', (req, res) => res.json({ bank: require('../services/billingService').bankDetails() }));
router.get('/public-key', licenseController.getPublicKey);
router.post('/purchase', (req, res, next) => {
  return res.status(503).json({ error: 'Ödeme doğrulaması henüz bağlı değil. Paketiniz platform yöneticisi tarafından tanımlanmalıdır.' });
}, licenseController.purchase);
// Yenileme bekleyen firma yöneticisi için; lisansı kapalı firma aynı bilgiyi giriş yanıtında alır.
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
router.get('/billing', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json(await require('../services/billingService').customerBilling(require('../config/database'), req.user.tenantId)); }
  catch (error) { next(error); }
});
// Ödeme sağlayıcısı bildirimi: kimlik doğrulaması HMAC imzasıyla yapılır (bkz. webhookController).
router.post('/webhooks/payment', require('../controllers/webhookController').handlePaymentWebhook);
router.post('/activate', licenseLimiter, licenseController.activate);
router.post('/validate', licenseLimiter, licenseController.validate);
router.post('/deactivate', licenseLimiter, licenseController.deactivate);
router.post('/heartbeat', licenseLimiter, licenseController.heartbeat);

module.exports = router;
