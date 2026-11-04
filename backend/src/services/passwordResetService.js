/**
 * E-postayla şifre sıfırlama. Jeton tek kullanımlık ve 30 dakikalıktır; veritabanında yalnızca özeti durur.
 * Sıfırlama açık oturumları kapatır, iki aşamalı doğrulamayı kapatmaz.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/database');
const policies = require('./settingsPolicyService');
const { sendEmail, isEmailConfigured } = require('./notificationService');

const RESET_TTL_MS = 30 * 60 * 1000;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const parseStamp = value => {
  const raw = String(value || '');
  return Date.parse(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
};
const audit = (db, tenantId, email, action, userId) => db.query(
  'INSERT INTO audit_logs (tenant_id, user_email, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
  [tenantId, email, action, 'user', userId, '{}']
);

/** Üretimde bağlantı müşteriye gideceği için genel adres de gerekir. */
const deliveryReady = () => isEmailConfigured() && (process.env.NODE_ENV !== 'production' || Boolean(process.env.APP_BASE_URL));

/** Hesabın varlığını yanıttan veya süreden belli etmez: gönderim arka planda yapılır. */
const requestReset = async email => {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const user = (await pool.query(`
    SELECT u.id, u.email, u.tenant_id FROM users u JOIN tenants t ON t.id = u.tenant_id
    WHERE LOWER(u.email) = $1 AND u.status = 'active' AND t.is_active = 1
  `, [normalized])).rows[0];
  if (!user) return null;
  const token = crypto.randomBytes(32).toString('hex');
  await pool.transaction(async client => {
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND tenant_id = $2', [user.id, user.tenant_id]);
    await client.query('INSERT INTO password_reset_tokens (tenant_id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [user.tenant_id, user.id, sha256(token), new Date(Date.now() + RESET_TTL_MS).toISOString().replace('T', ' ').replace('Z', '')]);
    await audit(client, user.tenant_id, user.email, 'password_reset_requested', user.id);
  });
  const link = `${(process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')}/reset-password?token=${token}`;
  const delivery = sendEmail(user.email, 'Veniux şifre sıfırlama',
    `Şifrenizi sıfırlamak için bu bağlantıyı 30 dakika içinde açın:\n${link}\n\nBu isteği siz yapmadıysanız bu e-postayı yok sayın; şifreniz değişmez.`);
  delivery.then(result => {
    if (!result.success) console.error('[Password Reset] e-posta gönderilemedi', { userId: user.id, error: result.error });
  });
  return { delivery };
};

const resetPassword = async (token, password) => {
  const invalid = 'Bağlantı geçersiz veya süresi dolmuş.';
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw fail(invalid);
  const row = (await pool.query(`
    SELECT r.id, r.user_id, r.expires_at, r.used_at, u.tenant_id, u.email FROM password_reset_tokens r
    JOIN users u ON u.id = r.user_id AND u.tenant_id = r.tenant_id WHERE r.token_hash = $1
  `, [sha256(token)])).rows[0];
  if (!row || row.used_at || !(parseStamp(row.expires_at) > Date.now())) throw fail(invalid);
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) throw fail('Şifre en az 8 karakter, en fazla 72 bayt olmalıdır.');
  if ((await policies.read(row.tenant_id, 'security')).strictPassword && !policies.strong(password)) throw fail('Güçlü şifre politikasına uygun bir şifre girin.');
  const hash = await bcrypt.hash(password, 10);
  await pool.transaction(async client => {
    const claimed = await client.query('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2 AND used_at IS NULL', [row.id, row.tenant_id]);
    if (!claimed.rowCount) throw fail(invalid);
    // session_version artınca açık tüm oturumlar geçersiz olur.
    await client.query('UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 AND tenant_id = $3', [hash, row.user_id, row.tenant_id]);
    await audit(client, row.tenant_id, row.email, 'password_reset_completed', row.user_id);
  });
};

module.exports = { deliveryReady, requestReset, resetPassword };
