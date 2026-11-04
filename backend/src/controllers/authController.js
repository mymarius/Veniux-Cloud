const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const policies = require('../services/settingsPolicyService');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Register new user
const register = async (req, res) => {
  try {
    const { password } = req.body;
    const ownerPhone=require('../services/ownerPhone').normalizePhone(req.body.phone);
    if(!ownerPhone)return res.status(400).json({error:'Firma sahibinin geçerli cep telefonu zorunludur. Örnek: 05xx xxx xx xx.'});
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    // Validate input
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'Geçerli e-posta ve en az 8 karakter, en fazla 72 bayt uzunluğunda şifre gereklidir.' });
    }

    // Public signup only creates a customer-owned tenant. Submitted roles are ignored.
    if (req.body.role !== undefined && !['customer','admin','manager','viewer'].includes(req.body.role)) return res.status(400).json({error:'Geçersiz hesap türü.'});

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const ownerIdentity=require('../services/ownerIdentity');
    const isVerifiedOwner=email===ownerIdentity.OWNER_EMAIL;
    if(isVerifiedOwner&&await ownerIdentity.verify(email,password)!==true)return res.status(401).json({error:'Merkezi sahip hesabı doğrulanamadı.'});
    const password_hash = await bcrypt.hash(password, 10);

    // Create new tenant for this signup
    const user = await pool.transaction(async client => {
    const tenantCode = 'T-' + crypto.randomUUID();
    const tenantResult = await client.query(
      'INSERT INTO tenants (name, tenant_code, company_name, email,owner_phone) VALUES ($1, $2, $3, $4,$5) RETURNING id',
      [`${email.split('@')[0]}'s Organization`, tenantCode, `${email.split('@')[0]}'s Organization`, email,ownerPhone]
    );
    const newTenantId = tenantResult.rows[0].id;

    // Insert user as admin of the new tenant
    const result = await client.query(
      'INSERT INTO users (email, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id, email, role, tenant_id, created_at',
      [email, password_hash, 'admin', newTenantId]
    );

    // New company founder gets an explicit scope, never the default for employees.
    await client.query("UPDATE user_access_scopes SET mode='company',updated_by=$1 WHERE user_id=$1 AND tenant_id=$2",[result.rows[0].id,newTenantId]);
    if(isVerifiedOwner)await client.query('INSERT INTO platform_admins(user_id) VALUES($1)',[result.rows[0].id]);
    await client.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',[newTenantId,email,'access.founder_scope','user',result.rows[0].id,JSON.stringify({mode:'company',reason:'New company founder'})]);
    return result.rows[0];
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        account_type: 'customer',
        is_platform_admin: false,
        module_type: 'NONE',
        tenant_id: user.tenant_id,
        created_at: user.created_at
      }
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'ER_DUP_ENTRY') return res.status(409).json({error:'Email already registered'});
    console.error('Register error:', error.message, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    // Validate input
    if (!email || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT u.id, u.email, u.password_hash, u.role, u.tenant_id, u.status, u.session_version, t.is_active,t.email AS company_owner_email FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE LOWER(u.email) = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const ownerIdentity=require('../services/ownerIdentity');
    const existingPlatformAdmin=(await pool.query('SELECT user_id FROM platform_admins WHERE user_id=$1',[user.id])).rows.length>0;
    const ownerBinding=email===ownerIdentity.OWNER_EMAIL&&(existingPlatformAdmin||(user.role==='admin'&&String(user.company_owner_email||'').toLowerCase()===email));
    const centralOwner=ownerBinding?await ownerIdentity.verify(email,password):null;
    const validPassword = centralOwner===null?await bcrypt.compare(password, user.password_hash):centralOwner;

    if (!validPassword || user.status !== 'active' || Number(user.is_active) !== 1) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if(!require('../services/centralLicense').enabled()&&await require('../services/moduleAccess').getModuleType(user.tenant_id)==='NONE'){
      // Parolası doğru firma yöneticisi, lisansı açacak ödeme bilgisini burada görür; oturum açılmaz.
      const billing=user.role==='admin'?await require('../services/billingService').customerBilling(pool,user.tenant_id):null;
      return res.status(423).json({...{error:'Giriş için işletmenizin aktif lisansı zorunludur.',code:'LICENSE_REQUIRED'},...(billing?.bank?{billing}:{})});
    }
    
    const second=await require('../services/mfaService').verify(user,typeof req.body.mfa_code==='string'?req.body.mfa_code.trim():'');
    if(second.required&&!req.body.mfa_code)return res.json({mfa_required:true});
    if(!second.ok)return res.status(401).json({error:'İkinci doğrulama kodu geçersiz veya yeniden kullanılmış.'});
    await require('../services/cloudLicenseBinding').claim(user.tenant_id,req.centralLicense);
    if(ownerBinding&&centralOwner===true&&!existingPlatformAdmin)await pool.transaction(async client=>{
      await client.query('INSERT INTO platform_admins(user_id) VALUES($1)',[user.id]);
      await client.query("UPDATE user_access_scopes SET mode='company',updated_by=$1 WHERE user_id=$1 AND tenant_id=$2",[user.id,user.tenant_id]);
      await client.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',[user.tenant_id,email,'owner.identity.linked','user',user.id,JSON.stringify({source:'license-authority',company_owner:true})]);
    });
    const isPlatformAdmin = Boolean((await pool.query('SELECT user_id FROM platform_admins WHERE user_id=$1',[user.id])).rows.length);
    const module_type = isPlatformAdmin ? 'BOTH' : await require('../services/moduleAccess').getModuleType(user.tenant_id,req.centralLicense);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        moduleType: module_type,
        sessionVersion: user.session_version
      },
      JWT_SECRET,
      { expiresIn: (await policies.read(user.tenant_id, 'security')).sessionTimeout || JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        module_type: module_type,
        portal_role: process.env.VENIUX_CLOUD_SERVICE==='1' ? (isPlatformAdmin?'admin':(await pool.query('SELECT portal_role FROM business_members WHERE tenant_id=$1 AND user_id=$2 AND active=1',[user.tenant_id,user.id])).rows[0]?.portal_role || null) : null
        ,account_type: isPlatformAdmin ? 'platform_admin' : 'customer',
        is_platform_admin: isPlatformAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(error.status||500).json({ error: error.status?error.message:'Internal server error',...(error.code==='LICENSE_REQUIRED'?{code:error.code}:{}) });
  }
};

// Get current user profile
const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, avatar_url, role, tenant_id, created_at FROM users WHERE id = $1 AND tenant_id = $2',
      [req.user.userId, req.user.homeTenantId || req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const tenant = await pool.query('SELECT COALESCE(company_name, name) AS company_name FROM tenants WHERE id = $1', [req.user.tenantId]);
    user.company_name = tenant.rows[0]?.company_name || null;

    const module_type = await require('../services/moduleAccess').getModuleType(user.tenant_id,req.centralLicense);

    user.module_type = req.user.moduleType || module_type;
    user.product_package=await require('../services/productPackages').rights(req.user.tenantId,pool,req.centralLicense);
    user.is_platform_admin = req.user.isPlatformAdmin;
    user.account_type = req.user.isPlatformAdmin ? 'platform_admin' : 'customer';
    user.home_tenant_id = req.user.homeTenantId;
    user.tenant_id = req.user.tenantId;
    user.role = req.user.role;

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, tenant_id, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  getAllUsers
};
