// Yeni cihazdan giriş: tarayıcı/uygulama kimliğinin özeti saklanır (IP saklanmaz).
// Kullanıcının daha önce görülmemiş bir cihazdan ilk girişi denetim kaydına yazılır ve ayar açıksa kullanıcıya e-posta gider.
// İlk kayıtlı cihaz bildirim üretmez. Özet geri çevrilemez; kişisel veri olarak yalnız cihaz türü etiketi tutulur.
const crypto = require('crypto');
const db = require('../config/database');

function label(agent) {
  const ua = String(agent || '');
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Bilinmeyen sistem';
  const app = /Electron|Veniux/i.test(ua) ? 'Veniux masaüstü' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Uygulama';
  return `${app} · ${os}`;
}

async function record(user, req) {
  const agent = String(req.get?.('user-agent') || '').slice(0, 400);
  const hash = crypto.createHash('sha256').update(`${user.tenant_id}:${user.id}:${agent}`).digest('hex');
  const known = (await db.query('SELECT id FROM login_devices WHERE user_id=$1 AND device_hash=$2', [user.id, hash])).rows[0];
  if (known) { await db.query('UPDATE login_devices SET last_seen=CURRENT_TIMESTAMP WHERE id=$1', [known.id]); return { known: true }; }
  const previous = Number((await db.query('SELECT COUNT(*) AS n FROM login_devices WHERE user_id=$1', [user.id])).rows[0].n);
  const name = label(agent);
  await db.query('INSERT INTO login_devices (tenant_id,user_id,device_hash,label) VALUES ($1,$2,$3,$4) ON CONFLICT(user_id,device_hash) DO NOTHING', [user.tenant_id, user.id, hash, name]);
  if (!previous) return { known: false, first: true };
  await db.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'auth.new_device','user',$3,$4)", [user.tenant_id, user.email, user.id, JSON.stringify({ device: name })]);
  const security = await require('./settingsPolicyService').read(user.tenant_id, 'security');
  if (security.newDeviceAlert) {
    const when = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    await require('./notificationService').sendEmail(user.email, 'Veniux: yeni cihazdan giriş', `Hesabınıza ${when} tarihinde yeni bir cihazdan (${name}) giriş yapıldı.\n\nBu siz değilseniz hemen şifrenizi değiştirin ve iki aşamalı doğrulamayı açın.`).catch(() => {});
  }
  return { known: false, first: false, label: name };
}

async function list(user) {
  return (await db.query('SELECT id,label,first_seen,last_seen FROM login_devices WHERE tenant_id=$1 AND user_id=$2 ORDER BY last_seen DESC LIMIT 50', [user.tenantId, user.userId])).rows;
}
// Cihazı listeden çıkarmak oturumları da kapatır (session_version artar); bir sonraki girişte yeniden kayda geçer.
async function revoke(user, id) {
  const r = await db.query('DELETE FROM login_devices WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [id, user.tenantId, user.userId]);
  if (!r.rowCount) throw Object.assign(Error('Cihaz bulunamadı.'), { status: 404 });
  await db.query('UPDATE users SET session_version=session_version+1 WHERE id=$1 AND tenant_id=$2', [user.userId, user.tenantId]);
  await db.query("INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,'auth.device_revoked','user',$3,$4)", [user.tenantId, user.email, user.userId, JSON.stringify({ device_id: Number(id) })]);
  return { revoked: true };
}

module.exports = { record, list, revoke, label };
