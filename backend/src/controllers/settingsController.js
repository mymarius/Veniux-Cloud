const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const policies = require('../services/settingsPolicyService');
const { sendEmail, sendTelegram } = require('../services/notificationService');

// Schema changes run through versioned startup migrations.
const ensureSettingsSchema = () => pool.ready;

// 1. Account Settings
const getAccount = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const result = await pool.query(
      'SELECT id, email, role, tenant_id, full_name, phone, status, last_login, created_at, avatar_url FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name || user.email.split('@')[0],
      phone: user.phone || '',
      status: user.status || 'active',
      createdAt: user.created_at,
      lastLogin: user.last_login || null,
      avatarUrl: user.avatar_url || null
    });
  } catch (error) {
    console.error('getAccount error:', error);
    res.status(500).json({ error: 'Hesap bilgileri alınamadı.' });
  }
};

const updateAccount = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const { fullName, phone, email } = req.body;
    
    // Check if new email is taken by someone else
    if (email && email !== req.user.email) {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.userId]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      }
    }

    await pool.query(
      'UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), email = COALESCE($3, email) WHERE id = $4',
      [fullName, phone, email, req.user.userId]
    );

    res.json({ message: 'Hesap profili başarıyla güncellendi.' });
  } catch (error) {
    console.error('updateAccount error:', error);
    res.status(500).json({ error: 'Hesap güncellenirken hata oluştu.' });
  }
};

// Profile photo. The client resizes to a small image before upload, so a tight cap is safe.
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const AVATAR_MAX_BYTES = 300 * 1024;
const updateAvatar = async (req, res) => {
  try {
    const { image } = req.body || {};
    if (typeof image !== 'string' || !AVATAR_PATTERN.test(image)) {
      return res.status(400).json({ error: 'Geçerli bir PNG, JPEG veya WebP görsel yükleyin.' });
    }
    if (Buffer.byteLength(image) > AVATAR_MAX_BYTES) {
      return res.status(413).json({ error: 'Profil fotoğrafı çok büyük. Daha küçük bir görsel seçin.' });
    }
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [image, req.user.userId]);
    res.json({ message: 'Profil fotoğrafı güncellendi.', avatarUrl: image });
  } catch (error) {
    console.error('updateAvatar error:', error);
    res.status(500).json({ error: 'Profil fotoğrafı kaydedilemedi.' });
  }
};

const removeAvatar = async (req, res) => {
  try {
    await pool.query('UPDATE users SET avatar_url = NULL WHERE id = $1', [req.user.userId]);
    res.json({ message: 'Profil fotoğrafı kaldırıldı.', avatarUrl: null });
  } catch (error) {
    console.error('removeAvatar error:', error);
    res.status(500).json({ error: 'Profil fotoğrafı kaldırılamadı.' });
  }
};

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword!=='string'||typeof newPassword!=='string'||!currentPassword||Buffer.byteLength(currentPassword)>72||Buffer.byteLength(newPassword)>72) {
      return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gereklidir.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Yeni şifre en az 8 karakter ve en fazla 72 bayt olmalıdır.' });
    }

    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mevcut şifreniz hatalı.' });
    }

    if ((await policies.read(req.user.tenantId,'security')).strictPassword && !policies.strong(newPassword)) return res.status(400).json({error:'Şifre en az 8 karakter, büyük harf ve rakam içermelidir.'});
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2', [newHash, req.user.userId]);

    res.json({ message: 'Şifreniz başarıyla güncellendi.' });
  } catch (error) {
    console.error('updatePassword error:', error);
    res.status(500).json({ error: 'Şifre güncellenirken hata oluştu.' });
  }
};

// 2. Company Profile
const getCompany = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const tenantId = req.user.tenantId;
    if(!tenantId)return res.status(403).json({error:'İşletme kapsamı doğrulanamadı. Yeniden giriş yapın.'});
    let resTenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    
    if (resTenant.rows.length === 0) {
      return res.status(404).json({error:'İşletme bilgileri bulunamadı. Yöneticinizle iletişime geçin.'});
    }

    const t = resTenant.rows[0];
    res.json({
      id: t.id,
      companyName: t.company_name || '',
      tenantCode: t.tenant_code || '',
      email: t.email || '',
      phone: t.phone || '',
      ownerPhone: '',
      ownerPhoneConfigured: Boolean(t.owner_phone),
      taxNumber: t.tax_number || '',
      taxOffice: t.tax_office || '',
      address: t.address || '',
      currency: t.currency || 'TRY',
      timezone: t.timezone || 'Europe/Istanbul',
      industry: t.industry || ''
    });
  } catch (error) {
    console.error('getCompany error:', error);
    res.status(500).json({ error: 'Şirket profili alınamadı.' });
  }
};

const updateCompany = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const tenantId = req.user.tenantId;
    if(!tenantId)return res.status(403).json({error:'İşletme kapsamı doğrulanamadı. Yeniden giriş yapın.'});
    const { companyName, email, phone, taxNumber, taxOffice, address, currency, timezone, industry } = req.body;
    let ownerPhone;
    if(req.body.ownerPhone!==undefined){
      if(req.user.role!=='admin')return res.status(403).json({error:'Firma sahibinin telefonunu yalnızca yönetici değiştirebilir.'});
      ownerPhone=require('../services/ownerPhone').normalizePhone(req.body.ownerPhone);
      if(!ownerPhone)return res.status(400).json({error:'Geçerli bir firma sahibi cep telefonu girin.'});
    }

    const existing = await pool.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE tenants SET 
          company_name = COALESCE($1, company_name),
          email = COALESCE($2, email),
          phone = COALESCE($3, phone),
          tax_number = COALESCE($4, tax_number),
          tax_office = COALESCE($5, tax_office),
          address = COALESCE($6, address),
          currency = COALESCE($7, currency),
          timezone = COALESCE($8, timezone),
          industry = COALESCE($9, industry)
        WHERE id = $10`,
        [companyName, email, phone, taxNumber, taxOffice, address, currency, timezone, industry, tenantId]
      );
    } else {
      await pool.query(
        `INSERT INTO tenants (id, tenant_code, company_name, email, phone, tax_number, tax_office, address, currency, timezone, industry)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [tenantId, 'VNX-HQ', companyName, email, phone, taxNumber, taxOffice, address, currency || 'TRY', timezone || 'Europe/Istanbul', industry || 'Depolama']
      );
    }

    if(ownerPhone)await pool.query('UPDATE tenants SET owner_phone=$1 WHERE id=$2',[ownerPhone,tenantId]);
    res.json({ message: 'Şirket profili başarıyla güncellendi.' });
  } catch (error) {
    console.error('updateCompany error:', error);
    res.status(500).json({ error: 'Şirket profili kaydedilemedi.' });
  }
};

// 3. User Management
const getUsers = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const tenantId = req.user.tenantId;
    const result = await pool.query(
      "SELECT u.id,u.email,u.role,u.full_name,u.phone,u.status,u.created_at,u.last_login,COALESCE(a.mode,'restricted') AS access_mode,(SELECT COUNT(*) FROM user_warehouse_access w WHERE w.user_id=u.id AND w.tenant_id=u.tenant_id) AS assigned_warehouses FROM users u LEFT JOIN user_access_scopes a ON a.user_id=u.id AND a.tenant_id=u.tenant_id WHERE u.tenant_id=$1 ORDER BY u.id ASC",
      [tenantId]
    );

    const users = result.rows.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.full_name || u.email.split('@')[0],
      phone: u.phone || '-',
      status: u.status || 'active',
      createdAt: u.created_at,
      lastLogin: u.last_login || null,
      accessMode:u.access_mode,assignedWarehouses:u.assigned_warehouses
    }));

    res.json(users);
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ error: 'Kullanıcı listesi alınamadı.' });
  }
};

const createUser = async (req, res) => {
  try {
    await ensureSettingsSchema();
    const tenantId = req.user.tenantId;
    const { email, password, role = 'viewer', fullName, phone } = req.body;
    if (!['admin','manager','viewer','cashier','operator','pharmacist'].includes(role)) return res.status(400).json({error:'Geçersiz kullanıcı rolü.'});

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || typeof password!=='string' || password.length<8 || Buffer.byteLength(password)>72) {
      return res.status(400).json({ error: 'Geçerli e-posta ve en az 8 karakter, en fazla 72 bayt şifre gereklidir.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    if ((await policies.read(req.user.tenantId,'security')).strictPassword && !policies.strong(password)) return res.status(400).json({error:'Güçlü şifre politikasına uygun bir şifre girin.'});
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, role, full_name, phone, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING id, email, role, full_name, phone, created_at`,
      [tenantId, email, hash, role, fullName || email.split('@')[0], phone || '']
    );

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(error.status||500).json({ error: error.status?error.message:'Kullanıcı eklenirken hata oluştu.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, status, fullName, phone, newPassword } = req.body;
    const tenantId = req.user.tenantId;
    if (role !== undefined && !['admin','manager','viewer','cashier','operator','pharmacist'].includes(role)) return res.status(400).json({error:'Geçersiz kullanıcı rolü.'});
    if (status !== undefined && !['active','inactive','suspended'].includes(status)) return res.status(400).json({error:'Geçersiz hesap durumu.'});
    if (Number(id) === req.user.userId && ((role && role !== 'admin') || (status && status !== 'active'))) return res.status(400).json({error:'Kendi yönetici erişiminizi kapatamazsınız.'});

    let query = `UPDATE users SET session_version = session_version + ${role !== undefined || status !== undefined || newPassword ? 1 : 0}, role = COALESCE($1, role), status = COALESCE($2, status), full_name = COALESCE($3, full_name), phone = COALESCE($4, phone)`;
    let params = [role ?? null, status ?? null, fullName ?? null, phone ?? null];

    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 8 || Buffer.byteLength(newPassword)>72)) return res.status(400).json({error:'Şifre en az 8 karakter, en fazla 72 bayt olmalıdır.'});
    if (newPassword && (await policies.read(tenantId,'security')).strictPassword && !policies.strong(newPassword)) return res.status(400).json({error:'Güçlü şifre politikasına uygun bir şifre girin.'});

    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      params.push(hash);
      query += `, password_hash = $${params.length}`;
    }

    params.push(id, tenantId);
    query += ` WHERE id = $${params.length - 1} AND tenant_id = $${params.length}`;

    const result = await pool.query(query, params);
    if (!result.rowCount) return res.status(404).json({error:'Kullanıcı bulunamadı.'});
    res.json({ message: 'Kullanıcı güncellendi.' });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ error: 'Kullanıcı güncellenirken hata oluştu.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    if (parseInt(id, 10) === req.user.userId) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    }

    const removed = await pool.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (!removed.rowCount) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json({ message: 'Kullanıcı başarıyla silindi.' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ error: 'Kullanıcı silinemedi.' });
  }
};

// 4. Roles: read-only matrix of the permissions the route guards actually enforce.
const getRoles = (req, res) => res.json(require('../config/roleCapabilities').matrix());

// 5. System Engine & Diagnostics
const getSystemEngine = async (req, res) => {
  try {
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());
    
    // Check DB counts
    let productCount = 0;
    let warehouseCount = 0;
    let stockRecordsCount = 0;
    let auditLogsCount = 0;
    let devicesCount = 0;

    try {
      const p = await pool.query('SELECT COUNT(*) as c FROM products WHERE tenant_id=$1',[req.user.tenantId]);
      productCount = parseInt(p.rows[0]?.c || 0, 10);
    } catch(e){}

    try {
      const w = await pool.query('SELECT COUNT(*) as c FROM warehouses WHERE tenant_id=$1',[req.user.tenantId]);
      warehouseCount = parseInt(w.rows[0]?.c || 0, 10);
    } catch(e){}

    try {
      const s = await pool.query('SELECT COUNT(*) as c FROM stock_records WHERE tenant_id=$1',[req.user.tenantId]);
      stockRecordsCount = parseInt(s.rows[0]?.c || 0, 10);
    } catch(e){}

    try {
      const a = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE tenant_id=$1',[req.user.tenantId]);
      auditLogsCount = parseInt(a.rows[0]?.c || 0, 10);
    } catch(e){}

    try {
      const d = await pool.query('SELECT COUNT(*) as c FROM warehouse_devices WHERE tenant_id=$1',[req.user.tenantId]);
      devicesCount = parseInt(d.rows[0]?.c || 0, 10);
    } catch(e){}

    // DB File size
    let dbSizeMB = 'Ölçülmedi';
    try {
      const dbPath = require('../config/runtimeConfig').paths().database;
      if (pool.getEngine()==='mysql') {
        const result=await pool.query('SELECT COALESCE(SUM(DATA_LENGTH+INDEX_LENGTH),0) AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
        dbSizeMB=(Number(result.rows[0]?.bytes||0)/(1024*1024)).toFixed(2)+' MB';
      } else if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbSizeMB = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
      }
    } catch(e){}

    res.json({
      engine: pool.getEngine() === 'sqlite' ? 'SQLite' : pool.getEngine(),
      dbDriver: pool.getEngine()==='mysql'?'mysql2':'better-sqlite3 v12.11.1',
      journalMode: pool.getEngine() === 'sqlite' ? pool.getDb().pragma('journal_mode', {simple:true}) : 'InnoDB (SQLite journal modu uygulanmaz)',
      dbSize: dbSizeMB,
      nodeVersion: process.version,
      platform: `${process.platform} (${process.arch})`,
      uptimeSeconds: uptimeSec,
      uptimeFormatted: `${Math.floor(uptimeSec / 3600)} sa ${Math.floor((uptimeSec % 3600) / 60)} dk ${uptimeSec % 60}sn`,
      memoryUsage: {
        heapUsedMB: (memory.heapUsed / (1024 * 1024)).toFixed(1),
        heapTotalMB: (memory.heapTotal / (1024 * 1024)).toFixed(1),
        rssMB: (memory.rss / (1024 * 1024)).toFixed(1)
      },
      counts: {
        products: productCount,
        warehouses: warehouseCount,
        stockRecords: stockRecordsCount,
        auditLogs: auditLogsCount,
        devices: devicesCount
      },
      services: {
        fefoRouter: 'LOCAL_RULES',
        cronJobs: 'Çalışma durumu ölçülmedi',
        telegramBridge: process.env.TELEGRAM_BOT_TOKEN ? 'Yapılandırılmış; teslimat doğrulanmadı' : 'Yapılandırılmamış',
        smtpGateway: process.env.SMTP_USER ? 'Yapılandırılmış; teslimat doğrulanmadı' : 'Yapılandırılmamış'
      }
    });
  } catch (error) {
    console.error('getSystemEngine error:', error);
    res.status(500).json({ error: 'Sistem motoru bilgileri alınamadı.' });
  }
};

const runVacuum = async (req, res) => {
  try {
    if(pool.getEngine()==='mysql') {
      const tables=(await pool.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND ENGINE='InnoDB' ORDER BY TABLE_NAME")).rows;
      const results=[];
      for(const table of tables) {
        if(!/^[A-Za-z0-9_]+$/.test(table.name))throw new Error('Geçersiz tablo adı.');
        const rows=(await pool.query('ANALYZE TABLE `'+table.name+'`')).rows;
        if(rows.some(row=>row.Msg_type==='error'))throw new Error('Tablo istatistikleri güncellenemedi.');
        results.push(table.name);
      }
      return res.json({message:`${results.length} MySQL tablosunun sorgu istatistikleri güncellendi.`,tables:results.length,operation:'analyze'});
    }
    const db = pool.getDb ? pool.getDb() : null;
    if (db) {
      db.pragma('optimize');
      res.json({ message: 'Veritabanı optimizasyonu ve indeks bakımı başarıyla tamamlandı (PRAGMA optimize).' });
    } else {
      res.status(409).json({ error: 'MySQL tablo bakımı veritabanı yöneticisi tarafından planlanmalıdır. Bu işlem çalıştırılmadı.' });
    }
  } catch (error) {
    console.error('runVacuum error:', error);
    res.status(500).json({ error: 'Veritabanı optimizasyonu sırasında hata oluştu.' });
  }
};

const runBackup = async (req, res) => {
  try {
    if (pool.getEngine() !== 'sqlite') return res.status(409).json({error:'MySQL yedeklemesi veritabanı yönetim aracıyla yapılmalıdır.'});
    const result = await require('../services/backupService').create(req.user,'manual',req);
    res.json({message:'Yedek oluşturuldu. Sistem yedek geçmişinden indirebilirsiniz.',...result});
  } catch (error) {
    console.error('runBackup error:', error);
    res.status(500).json({ error: 'Yedekleme oluşturulamadı.' });
  }
};

module.exports = {
  getAccount,
  updateAccount,
  updatePassword,
  updateAvatar,
  removeAvatar,
  getCompany,
  updateCompany,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoles,
  getSystemEngine,
  runVacuum,
  runBackup
};
