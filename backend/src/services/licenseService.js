const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Ensure RSA-2048 keys exist for cryptographic license token signing
const KEY_DIR = path.join(__dirname, '../../config/keys');
const PRIVATE_KEY_PATH = process.env.LICENSE_PRIVATE_KEY_PATH || path.join(KEY_DIR, 'license_private_key.pem');
const PUBLIC_KEY_PATH = process.env.LICENSE_PUBLIC_KEY_PATH || path.join(KEY_DIR, 'license_public_key.pem');

let privateKey;
let publicKey;

try {
  if (process.env.NODE_ENV!=='production' && !fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true });
  }

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    crypto.createPrivateKey(privateKey);
    crypto.createPublicKey(publicKey);
  } else {
    if(process.env.NODE_ENV==='production')throw new Error('Production requires persistent license signing keys.');
    // Generate RSA-2048 Keypair
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, 'utf8');
  }
} catch (err) {
  if(process.env.NODE_ENV==='production')throw err;
  console.warn('[LicenseService] Keyfile disk access warning, generating in-memory keypair:', err.message);
  const keyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  privateKey = keyPair.privateKey;
  publicKey = keyPair.publicKey;
}

const ANNUAL_PLANS = {
  NORMAL_WMS_ANNUAL: {
    id: 'NORMAL_WMS_ANNUAL',
    name: 'Normal Depo (WMS) Lisansı',
    price_usd: 299,
    max_warehouses: 2,
    max_users: 20,
    max_devices: 10,
    max_pdas: 10,
    features: {
      module_type: 'NORMAL',
      wms_core: true,
      inbound: true,
      picking: true,
      pda: true
    }
  },
  ENTERPRISE_SUITE_ANNUAL: {
    id: 'ENTERPRISE_SUITE_ANNUAL',
    name: 'Kurumsal Stok ve Depo',
    price_usd: 799,
    max_warehouses: 50,
    max_users: 250,
    max_devices: 100,
    max_pdas: 100,
    features: {
      module_type: 'NORMAL',
      wms_core: true,
      inbound: true,
      picking: true,
      cold_chain: true,
      expiry_radar: true,
      its_medula: false,
      pda: true
    }
  },
  STARTER_ANNUAL: {
    id: 'STARTER_ANNUAL',
    name: 'Starter WMS Lisansı',
    price_usd: 149,
    max_warehouses: 1,
    max_users: 5,
    max_devices: 3,
    max_pdas: 3,
    features: {
      module_type: 'NORMAL',
      wms_core: true,
      inbound: true,
      picking: true,
      pda: true
    }
  },
  BUSINESS_ANNUAL: {
    id: 'BUSINESS_ANNUAL',
    name: 'Business WMS Lisansı',
    price_usd: 399,
    max_warehouses: 3,
    max_users: 15,
    max_devices: 10,
    max_pdas: 10,
    features: {
      module_type: 'NORMAL',
      wms_core: true,
      inbound: true,
      picking: true,
      cold_chain: true,
      expiry_radar: true,
      its_medula: false,
      pda: true
    }
  },
  ENTERPRISE_ANNUAL: {
    id: 'ENTERPRISE_ANNUAL',
    name: 'Enterprise WMS Lisansı',
    price_usd: 799,
    max_warehouses: 50,
    max_users: 250,
    max_devices: 100,
    max_pdas: 100,
    features: {
      module_type: 'NORMAL',
      wms_core: true,
      inbound: true,
      picking: true,
      cold_chain: true,
      expiry_radar: true,
      its_medula: false,
      pda: true
    }
  }
};

class LicenseService {
  getPublicKey() {
    return publicKey;
  }

  getPlans() {
    const pricing=require('../config/commercialPricing.json');
    return Object.values(ANNUAL_PLANS).map(plan=>pricing[plan.id]?{...plan,...pricing[plan.id],price_try:pricing[plan.id].annual_try,public_currency:'TRY',tax_included:true}:plan);
  }

  /**
   * Helper: Sign payload with RSA-SHA256 Private Key
   */
  signPayload(payload) {
    const dataStr = JSON.stringify(payload);
    const signer = crypto.createSign('SHA256');
    signer.update(dataStr);
    signer.end();
    return signer.sign(privateKey, 'base64');
  }

  /**
   * Helper: Verify payload with RSA-SHA256 Public Key
   */
  verifyPayload(payload, signature) {
    const dataStr = JSON.stringify(payload);
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataStr);
    verifier.end();
    return verifier.verify(publicKey, signature, 'base64');
  }

  /**
   * Helper: Generate Formatted License Key (VNX-YYYY-XXXX-XXXX-XXXX)
   */
  generateKey() {
    const year = new Date().getFullYear();
    const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    return `VNX-${year}-${seg()}-${seg()}-${seg()}`;
  }

  /**
   * 1. Public Promotional Portal: Purchase Annual License
   */
  async purchaseAnnualLicense(data) {
    const {
      tenant_code,
      company_name,
      email,
      password,
      phone,
      tax_number,
      tax_office,
      address,
      plan_id = 'NORMAL_WMS_ANNUAL',
      payment_method = 'CREDIT_CARD',
      currency = 'USD'
    } = data;

    if (!company_name || !email) {
      throw new Error('Firma ünvanı ve yetkili e-posta adresi zorunludur.');
    }

    const bcrypt = require('bcrypt');
    const plan = ANNUAL_PLANS[plan_id] || ANNUAL_PLANS.NORMAL_WMS_ANNUAL;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Find or create tenant
      const tenantRes = await client.query('SELECT * FROM tenants WHERE email = $1', [email]);
      let tenant;
      if (tenantRes.rows.length > 0) {
        tenant = tenantRes.rows[0];
      } else {
        const tenantCode = `TEN-${Date.now().toString().slice(-6)}`;
        const createTenantRes = await client.query(`
          INSERT INTO tenants (name, tenant_code, company_name, email, phone, tax_number, tax_office, address, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
          RETURNING *
        `, [company_name, tenantCode, company_name, email, phone || null, tax_number || null, tax_office || null, address || null]);
        tenant = createTenantRes.rows[0];
        
        // AUTO CREATE ADMIN USER IF PASSWORD PROVIDED
        if (password) {
          const password_hash = await bcrypt.hash(password, 10);
          await client.query(`
            INSERT INTO users (email, password_hash, role, tenant_id) 
            VALUES ($1, $2, 'admin', $3)
          `, [email, password_hash, tenant.id]);
        }
      }

      // 2. Generate Annual License Key
      const licenseKey = this.generateKey();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365); // Strictly 1 Year Validity

      const licRes = await client.query(`
        INSERT INTO licenses (
          license_key, tenant_id, plan_id, status, max_users, max_warehouses,
          max_devices, max_pdas, enabled_features_json, issued_at, expires_at, grace_period_days
        ) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, 14)
        RETURNING *
      `, [
        licenseKey,
        tenant.id,
        plan.id,
        plan.max_users,
        plan.max_warehouses,
        plan.max_devices,
        plan.max_pdas,
        JSON.stringify(plan.features),
        expiresAt.toISOString().replace('T', ' ').replace('Z', '')
      ]);

      const license = licRes.rows[0];

      // 3. Generate Paid Invoice
      const invoiceNo = `INV-VNX-${Date.now().toString().slice(-6)}`;
      await client.query(`
        INSERT INTO invoices (invoice_no, tenant_id, license_id, amount, currency, billing_period, payment_method, status, paid_at)
        VALUES ($1, $2, $3, $4, $5, 'ANNUAL', $6, 'PAID', CURRENT_TIMESTAMP)
      `, [invoiceNo, tenant.id, license.id, plan.price_usd, currency, payment_method]);

      // 4. Audit Log
      await client.query(`
        INSERT INTO license_audit_logs (license_id, event_type, details)
        VALUES ($1, 'PURCHASE_ANNUAL', $2)
      `, [license.id, `Plan: ${plan.id}, Amount: $${plan.price_usd}, Company: ${company_name}`]);

      await client.query('COMMIT');

      return {
        success: true,
        license_key: licenseKey,
        license_id: `VNX-LIC-${license.id}`,
        plan: plan,
        tenant: tenant,
        expires_at: expiresAt.toISOString(),
        invoice_no: invoiceNo,
        download_url: '/downloads/Veniux-WMS-Setup.exe'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 2. Desktop Client: Activate License on specific Hardware
   */
  async activateLicense(data) {
    const {
      license_key,
      device_fingerprint,
      device_name = 'Workstation-01',
      os_info = 'Windows 11 Enterprise x64',
      app_version = '2.4.0'
    } = data;

    if (!license_key || !device_fingerprint) {
      throw new Error('Lisans anahtarı ve cihaz donanım kimliği gereklidir.');
    }

    const cleanKey = license_key.trim().toUpperCase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Fetch license
      const licRes = await client.query(`
        SELECT l.*, t.company_name, t.tenant_code, t.email as tenant_email, t.is_active as tenant_active
        FROM licenses l
        JOIN tenants t ON l.tenant_id = t.id
        WHERE l.license_key = $1
      `, [cleanKey]);

      if (licRes.rows.length === 0) {
        throw new Error('Geçersiz lisans anahtarı. Lütfen anahtarınızı kontrol edin.');
      }

      const license = licRes.rows[0];

      if(Number(license.tenant_active)!==1||license.status!=='ACTIVE')throw new Error('İşletme veya lisans erişime kapalı.');

      if (license.status === 'REVOKED' || license.status === 'CANCELLED') {
        throw new Error('Bu lisans iptal edilmiş veya feshedilmiştir.');
      }

      if (license.status === 'SUSPENDED') {
        throw new Error('Lisansınız askıya alınmıştır. Lütfen destek ekibi ile iletişime geçin.');
      }

      const now = new Date();
      const expiresAt = new Date(license.expires_at);

      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
        throw new Error(`Lisansınızın geçerlilik süresi ${expiresAt.toLocaleDateString('tr-TR')} tarihinde dolmuştur.`);
      }

      // 2. Check Device Activations
      const activeDevicesRes = await client.query(`
        SELECT * FROM license_activations 
        WHERE license_id = $1 AND is_active = 1
      `, [license.id]);

      const isAlreadyActiveOnThisDevice = activeDevicesRes.rows.some(
        d => d.device_fingerprint === device_fingerprint
      );

      if (!isAlreadyActiveOnThisDevice && activeDevicesRes.rows.length >= license.max_devices) {
        throw new Error(`Lisansın cihaz aktivasyon limiti dolmuştur (${activeDevicesRes.rows.length} / ${license.max_devices}). Diğer cihazlardan birini deaktive ediniz.`);
      }

      // 3. Register or Refresh Device Binding
      await client.query(`
        INSERT INTO license_activations (
          license_id, tenant_id, device_fingerprint, device_name, os_info, app_version, is_active, last_seen_at, activated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(license_id, device_fingerprint) DO UPDATE SET
          is_active = 1,
          device_name = $7,
          os_info = $8,
          app_version = $9,
          last_seen_at = CURRENT_TIMESTAMP,
          deactivated_at = NULL
      `, [
        license.id, license.tenant_id, device_fingerprint, device_name || '', os_info || '', app_version || '',
        device_name || '', os_info || '', app_version || ''
      ]);

      // 4. Update License Validation Time
      await client.query(`
        UPDATE licenses 
        SET last_validation_at = CURRENT_TIMESTAMP,
            activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP)
        WHERE id = $1
      `, [license.id]);

      // 5. Construct & Cryptographically Sign the License Token
      const tokenPayload = {
        license_id: `VNX-LIC-${license.id}`,
        license_key: license.license_key,
        tenant_id: license.tenant_id,
        tenant_name: license.company_name,
        tenant_code: license.tenant_code,
        plan_id: license.plan_id,
        status: 'ACTIVE',
        issued_at: license.issued_at,
        activated_at: license.activated_at || new Date().toISOString(),
        expires_at: license.expires_at,
        max_users: license.max_users,
        max_warehouses: license.max_warehouses,
        max_devices: license.max_devices,
        max_pdas: license.max_pdas,
        enabled_features: JSON.parse(license.enabled_features_json || '{}'),
        device_fingerprint: device_fingerprint,
        grace_period_days: license.grace_period_days || 14,
        timestamp: Date.now()
      };

      const signature = this.signPayload(tokenPayload);

      // 6. Audit Log
      await client.query(`
        INSERT INTO license_audit_logs (license_id, event_type, device_fingerprint, details)
        VALUES ($1, 'ACTIVATION_SUCCESS', $2, $3)
      `, [license.id, device_fingerprint, `Device: ${device_name}, OS: ${os_info}`]);

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Lisans başarıyla aktive edildi.',
        token: {
          payload: tokenPayload,
          signature: signature
        },
        public_key: publicKey,
        quota: {
          active_devices: isAlreadyActiveOnThisDevice ? activeDevicesRes.rows.length : activeDevicesRes.rows.length + 1,
          max_devices: license.max_devices,
          max_users: license.max_users,
          max_warehouses: license.max_warehouses,
          max_pdas: license.max_pdas
        }
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * 3. Desktop Client: Periodic Server Validation & Grace Period Extension
   */
  async validateLicense(data) {
    const { license_key, device_fingerprint } = data;

    if (!license_key || !device_fingerprint) {
      throw new Error('Lisans anahtarı ve cihaz kimliği gereklidir.');
    }

    const licRes = await pool.query(`
      SELECT l.*, t.company_name, t.tenant_code, t.is_active as tenant_active
      FROM licenses l
      JOIN tenants t ON l.tenant_id = t.id
      WHERE l.license_key = $1
    `, [license_key.trim().toUpperCase()]);

    if (licRes.rows.length === 0) {
      throw new Error('Lisans bulunamadı.');
    }

    const license = licRes.rows[0];
    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    const isExpired = !Number.isFinite(expiresAt.getTime()) || expiresAt <= now;
    const currentStatus = Number(license.tenant_active)!==1 ? 'SUSPENDED' : isExpired ? 'EXPIRED' : license.status;

    // Check device binding
    const devRes = await pool.query(`
      SELECT * FROM license_activations 
      WHERE license_id = $1 AND device_fingerprint = $2 AND is_active = 1
    `, [license.id, device_fingerprint]);

    if (devRes.rows.length === 0) {
      throw new Error('Bu cihaz için geçerli bir aktivasyon bulunamadı. Lütfen yeniden aktive edin.');
    }

    // Update heartbeat
    await pool.query(`
      UPDATE license_activations 
      SET last_seen_at = CURRENT_TIMESTAMP 
      WHERE license_id = $1 AND device_fingerprint = $2
    `, [license.id, device_fingerprint]);

    const tokenPayload = {
      license_id: `VNX-LIC-${license.id}`,
      license_key: license.license_key,
      tenant_id: license.tenant_id,
      tenant_name: license.company_name,
      tenant_code: license.tenant_code,
      plan_id: license.plan_id,
      status: currentStatus,
      issued_at: license.issued_at,
      activated_at: license.activated_at,
      expires_at: license.expires_at,
      max_users: license.max_users,
      max_warehouses: license.max_warehouses,
      max_devices: license.max_devices,
      max_pdas: license.max_pdas,
      enabled_features: JSON.parse(license.enabled_features_json || '{}'),
      device_fingerprint: device_fingerprint,
      grace_period_days: license.grace_period_days || 14,
      timestamp: Date.now()
    };

    const signature = this.signPayload(tokenPayload);

    return {
      valid: currentStatus === 'ACTIVE',
      status: currentStatus,
      token: {
        payload: tokenPayload,
        signature: signature
      },
      public_key: publicKey
    };
  }

  /**
   * 4. Deactivate Device
   */
  async deactivateDevice(data) {
    const { license_key, device_fingerprint } = data;

    const licRes = await pool.query('SELECT id FROM licenses WHERE license_key = $1', [license_key]);
    if (licRes.rows.length === 0) throw new Error('Lisans bulunamadı.');

    const licenseId = licRes.rows[0].id;

    await pool.query(`
      UPDATE license_activations 
      SET is_active = 0, deactivated_at = CURRENT_TIMESTAMP
      WHERE license_id = $1 AND device_fingerprint = $2
    `, [licenseId, device_fingerprint]);

    await pool.query(`
      INSERT INTO license_audit_logs (license_id, event_type, device_fingerprint, details)
      VALUES ($1, 'DEVICE_DEACTIVATED', $2, 'Device deactivated by user')
    `, [licenseId, device_fingerprint]);

    return { success: true, message: 'Cihaz aktivasyonu başarıyla kaldırıldı.' };
  }
}

module.exports = new LicenseService();
