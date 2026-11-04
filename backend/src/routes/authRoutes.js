const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe, getAllUsers } = require('../controllers/authController');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const checkEntitlement = require('../middlewares/licenseMiddleware');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

// Self-signup: Creates a new tenant and sets user as admin
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
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
router.get('/users', authMiddleware, requireRole('admin'), getAllUsers);

module.exports = router;
