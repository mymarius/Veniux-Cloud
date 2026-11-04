const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-this')) {
  throw new Error('Production requires a non-default JWT_SECRET.');
}

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    // Strict Database Validation for Tenant & Role
    const userResult = await pool.query('SELECT u.tenant_id, u.role, u.email, u.status, u.session_version, t.is_active FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User does not exist.' });
    }
    
    const dbUser = userResult.rows[0];
    if (dbUser.status !== 'active' || Number(dbUser.is_active) !== 1 || (decoded.sessionVersion ?? 0) !== dbUser.session_version) {
      return res.status(401).json({ error: 'Oturumunuz geçersiz veya hesabınız erişime kapalı. Yeniden giriş yapın.' });
    }
    
    // For legacy tokens without tenantId, default to dbUser.tenant_id
    const tokenTenantId = decoded.tenantId !== undefined ? decoded.tenantId : dbUser.tenant_id;
    
    if (dbUser.tenant_id !== tokenTenantId) {
      return res.status(403).json({ error: 'Tenant context mismatch. Invalid token.' });
    }

    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: dbUser.email,
      role: dbUser.role, // Trust DB role
      tenantId: dbUser.tenant_id // Trust DB tenant
    };

    req.user.isPlatformAdmin = Boolean((await pool.query('SELECT user_id FROM platform_admins WHERE user_id=$1',[decoded.userId])).rows.length);
    req.user.homeTenantId = dbUser.tenant_id;
    req.user.centralLicense=req.centralLicense;
    if(!require('../services/centralLicense').enabled()&&await require('../services/moduleAccess').getModuleType(dbUser.tenant_id)==='NONE')return res.status(423).json({error:'Bu işletmenin aktif lisansı bulunmuyor.',code:'LICENSE_REQUIRED'});
    await require('../services/cloudLicenseBinding').requireBinding(dbUser.tenant_id,req.centralLicense);
    const targetTenant = req.headers['x-tenant-id'];
    if (targetTenant !== undefined) {
      if (!req.user.isPlatformAdmin) return res.status(403).json({error:'İşletme değiştirme yetkiniz yok.'});
      if (!/^\d+$/.test(String(targetTenant)) || !Number.isSafeInteger(Number(targetTenant))) return res.status(400).json({error:'Geçersiz işletme.'});
      const target=(await pool.query('SELECT id,is_active FROM tenants WHERE id=$1',[Number(targetTenant)])).rows[0];
      if (!target || Number(target.is_active)!==1) return res.status(403).json({error:'İşletme bulunamadı veya erişime kapalı.'});
      req.user.tenantId=target.id;
      if(!require('../services/centralLicense').enabled()&&await require('../services/moduleAccess').getModuleType(target.id)==='NONE')return res.status(423).json({error:'Hedef işletmenin aktif lisansı bulunmuyor.',code:'LICENSE_REQUIRED'});
      await require('../services/cloudLicenseBinding').requireBinding(target.id,req.centralLicense);
    }
    if(req.user.isPlatformAdmin) req.user.role='admin';
    req.user.moduleType = req.user.isPlatformAdmin ? 'BOTH' : await require('../services/moduleAccess').getModuleType(dbUser.tenant_id,req.centralLicense);
    const path = req.originalUrl.split('?')[0];
    if (!req.user.isPlatformAdmin && req.user.moduleType==='NONE' && !/^\/api\/(auth|settings|license|business)(\/|$)/.test(path)) {
      return res.status(403).json({error:'Operasyon modülleri için aktif bir lisans paketi gereklidir.',code:'LICENSE_REQUIRED'});
    }
    const required = /^\/api\/(pharmacy|eczane-depo|medicines)(\/|$)/.test(path) ? 'PHARMACY'
      : /^\/api\/(normal-depo|retail|wms)(\/|$)/.test(path) ? 'NORMAL' : null;
    if (required && req.user.moduleType !== 'BOTH' && req.user.moduleType !== required) {
      return res.status(403).json({ error: 'Bu modül lisans paketinizde bulunmuyor.', code: 'MODULE_ACCESS_DENIED' });
    }

    await require('../services/productPackages').authorize(req.user,path,req.centralLicense);
    const portalMember=(await pool.query('SELECT portal_role,active FROM business_members WHERE tenant_id=$1 AND user_id=$2',[req.user.tenantId,req.user.id])).rows[0];
    if(portalMember&&!req.user.isPlatformAdmin&&!['admin','manager'].includes(req.user.role)&&!/^\/api\/(business|auth\/(me|mfa))(\/|$)/.test(path))return res.status(403).json({error:'Bu hesap yalnız saha/bayi ekranlarına erişebilir.'});
    require('./costVisibility')(req, res);
    return require('./accessScope')(req, res, next);
  } catch (error) {
    if(error.code==='PACKAGE_ACCESS_DENIED')return res.status(error.status||403).json({error:error.message,code:error.code});
    if(error.status===423)return res.status(423).json({error:error.message,code:'LICENSE_REQUIRED'});
    if (error.status === 503) return res.status(503).json({error:'Yedekleme/geri yükleme bakımı sürüyor. Biraz sonra tekrar deneyin.'});
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  JWT_SECRET
};
