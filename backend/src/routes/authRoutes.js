const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe, getAllUsers } = require('../controllers/authController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const checkEntitlement = require('../middlewares/licenseMiddleware');

// Giriş/kayıt: istemci adresi başına 15 dakikada en fazla 20 BAŞARISIZ deneme.
// - Başarılı girişler sayılmaz (aynı ofisten çok kişinin sabah girişi birbirini kilitlemez).
// - Adres, ters vekilin (Passenger/nginx) arkasında bile gerçek istemciden alınır; aksi halde tüm müşteriler tek IP görünür.
// - Hesap bazlı kilit ayrıca loginThrottle'dadır (e-posta + adres çifti).
const { clientAddress } = require('../middlewares/apiThrottle');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  skipSuccessfulRequests: true,
  keyGenerator: req => clientAddress(req),
  validate: { ip: false, trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Çok fazla deneme. Bir süre sonra tekrar deneyin.' }
});

// Self-signup: Creates a new tenant and sets user as admin
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Şifre sıfırlama: yanıt hesaba göre değişmez. Sunucu e-posta gönderemiyorsa bu her adres için açık bir hatadır.
const passwordReset = require('../services/passwordResetService');
const recoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.RECOVERY_RATE_LIMIT_MAX) || 5, message: { error: 'Çok fazla deneme. Daha sonra tekrar deneyin.' } });
router.post('/forgot-password', recoveryLimiter, async (req, res) => {
  if (!passwordReset.deliveryReady()) {
    console.error('Forgot password: SMTP_HOST/SMTP_USER/SMTP_PASS ve üretimde APP_BASE_URL tanımlı olmalıdır.');
    return res.status(503).json({ error: 'E-posta gönderimi yapılandırılmamış. Şifre sıfırlama için yöneticinize başvurun.' });
  }
  try { await passwordReset.requestReset(req.body.email); }
  catch (error) { console.error('Forgot password error:', error.message); }
  res.json({ message: 'Bu e-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' });
});
router.post('/reset-password', recoveryLimiter, async (req, res, next) => {
  try {
    await passwordReset.resetPassword(req.body.token, req.body.password);
    res.json({ message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapın.' });
  } catch (error) { error.status ? res.status(error.status).json({ error: error.message }) : next(error); }
});
// A busy shop may legitimately unlock many times. Keep ordinary login limits;
// authenticated terminal checks count failed attempts per current cashier.
const terminalLimiter=rateLimit({windowMs:15*60*1000,max:6,skipSuccessfulRequests:true,
  keyGenerator:req=>String(req.user.tenantId)+':'+String(req.user.userId),
  message:{error:'Çok fazla hatalı doğrulama. 15 dakika sonra yeniden deneyin.'}});
router.post('/terminal-verify',authMiddleware,requireRole('admin','manager','cashier'),terminalLimiter,async(req,res,next)=>{
  try{
    const mode=req.body?.mode,email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    if(!['unlock','approve','switch'].includes(mode))return res.status(400).json({error:'Geçersiz kasa doğrulaması.'});
    const rows=(await require('../config/database').query('SELECT id,role FROM users WHERE tenant_id=$1 AND LOWER(email)=$2',[req.user.tenantId,email])).rows;
    const candidate=rows[0];
    if(!candidate||(mode==='unlock'&&Number(candidate.id)!==Number(req.user.userId))||(mode==='approve'&&!['admin','manager'].includes(candidate.role))||(mode==='switch'&&!['admin','manager','cashier'].includes(candidate.role)))return res.status(403).json({error:'Bu işlem için aynı işletmeden uygun yetkili hesap gerekli.'});
    res.set('Cache-Control','no-store');
    // Reuse password, account state, licensing and MFA verification unchanged.
    return login(req,res);
  }catch(error){next(error);}
});
router.use('/mfa',require('./mfaRoutes'));
router.get('/me', authMiddleware, getMe);
router.get('/devices', authMiddleware, async (req, res, next) => { try { res.json(await require('../services/loginDeviceService').list(req.user)); } catch (error) { next(error); } });
router.delete('/devices/:id', authMiddleware, async (req, res, next) => { try { res.json(await require('../services/loginDeviceService').revoke(req.user, req.params.id)); } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); } });
router.get('/users', authMiddleware, requireRole('admin'), getAllUsers);

module.exports = router;
