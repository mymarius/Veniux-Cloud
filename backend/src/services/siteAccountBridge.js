const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// veniux.com site hesabıyla uygulamaya giriş: parola yalnız sunucudan sunucuya, imzalı istekle sitenin doğrulama adresine gider.
// Site "geçerli" derse bu işletme için bulut hesabı ilk girişte açılır. İki sistemde parola ayrı saklanır; biri değişince diğeri değişmez.
const SECRET_MIN = 32;

function settings() {
  const secret = String(process.env.VENIUX_SITE_BRIDGE_SECRET || '');
  const base = String(process.env.VENIUX_SITE_BRIDGE_URL || 'https://veniux.com').replace(/\/+$/, '');
  return { secret, base };
}

function enabled() { return settings().secret.length >= SECRET_MIN; }

function sign(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(timestamp + '\n' + body).digest('hex');
}

// { valid: true, company } | { valid: false, reason: 'unverified' | 'invalid' | 'unavailable' }
async function verify(email, password) {
  const { secret, base } = settings();
  if (secret.length < SECRET_MIN) return { valid: false, reason: 'unavailable' };
  const body = JSON.stringify({ email, password });
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const response = await fetch(base + '/api/hesap-dogrula', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'X-Veniux-Timestamp': timestamp, 'X-Veniux-Signature': sign(secret, timestamp, body) },
      body
    });
    if (!response.ok) return { valid: false, reason: response.status === 429 ? 'unavailable' : 'invalid' };
    const data = await response.json();
    if (data && data.valid === true) return { valid: true, company: typeof data.company === 'string' ? data.company.trim().slice(0, 120) : '' };
    return { valid: false, reason: data && data.reason === 'unverified' ? 'unverified' : 'invalid' };
  } catch {
    return { valid: false, reason: 'unavailable' };
  }
}

// Site hesabı için işletme ve yönetici kullanıcısı açar (register ile aynı kayıtlar). Eşzamanlı ikinci istekte mevcut olanı kullanır.
async function provision(email, password, company) {
  const passwordHash = await bcrypt.hash(password, 10);
  const name = company || `${email.split('@')[0]}'s Organization`;
  try {
    await pool.transaction(async client => {
      const tenant = await client.query(
        'INSERT INTO tenants (name, tenant_code, company_name, email) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, 'T-' + crypto.randomUUID(), name, email]
      );
      const tenantId = tenant.rows[0].id;
      const user = await client.query(
        'INSERT INTO users (email, password_hash, role, tenant_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, passwordHash, 'admin', tenantId]
      );
      const userId = user.rows[0].id;
      await client.query("UPDATE user_access_scopes SET mode='company',updated_by=$1 WHERE user_id=$1 AND tenant_id=$2", [userId, tenantId]);
      await client.query('INSERT INTO audit_logs(tenant_id,user_email,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6)',
        [tenantId, email, 'access.founder_scope', 'user', userId, JSON.stringify({ mode: 'company', reason: 'Site hesabıyla ilk giriş' })]);
    });
  } catch (error) {
    if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE' && error.code !== 'ER_DUP_ENTRY') throw error;
  }
}

module.exports = { enabled, verify, provision, sign, SECRET_MIN };
