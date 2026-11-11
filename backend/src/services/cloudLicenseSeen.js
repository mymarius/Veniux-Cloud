// Bulutta lisansın en son ne zaman geçerli doğrulandığı. Lisanslı bir kullanıcı uygulamayı kullandıkça (lisans kapısı geçerli
// döndükçe) kayıt tazelenir. Mağaza cihaz anahtarıyla yapılan yükleme/indirme, lisansı GRACE_DAYS gündür doğrulanamayan
// hesapta durdurulur. Lisans sunucusuna her yüklemede sorulmaz; sunucu arızası eşitlemeyi kesmez.
const db = require('../config/database');
const GRACE_SECONDS = 7 * 86400;
const lastTouch = new Map();
const active = () => process.env.VENIUX_CLOUD_SERVICE === '1' && require('./centralLicense').enabled();
const nowSeconds = () => Math.floor(Date.now() / 1000);

async function touch(license) {
  if (!active() || !license || !license.valid) return;
  const id = Number(license.license_id);
  if (!Number.isSafeInteger(id) || id < 1) return;
  const now = nowSeconds();
  if (now - (lastTouch.get(id) || 0) < 600) return;
  lastTouch.set(id, now);
  const done = await db.query('UPDATE cloud_license_seen SET last_valid_epoch=$1 WHERE authority_license_id=$2', [now, id]);
  if (done.rowCount === 0) await db.query('INSERT INTO cloud_license_seen (authority_license_id,last_valid_epoch) VALUES ($1,$2)', [id, now]).catch(() => {});
}

// Lisans izlenmeyen kurulumda (bulut lisans sunucusu yok) her zaman izinli. İzlenen bulutta: bağlı lisansın son geçerli
// doğrulaması GRACE_SECONDS içindeyse izinli. İlk kez görülen lisansın saati bu çağrıyla başlar (dağıtımdan sonra kilitlenmeyi önler).
async function tenantAllowed(tenantId) {
  if (!active()) return true;
  const bound = (await db.query('SELECT authority_license_id FROM cloud_license_bindings WHERE tenant_id=$1', [tenantId])).rows[0];
  if (!bound) return false;
  const id = Number(bound.authority_license_id);
  const seen = (await db.query('SELECT last_valid_epoch FROM cloud_license_seen WHERE authority_license_id=$1', [id])).rows[0];
  if (!seen) { await db.query('INSERT INTO cloud_license_seen (authority_license_id,last_valid_epoch) VALUES ($1,$2)', [id, nowSeconds()]).catch(() => {}); return true; }
  return nowSeconds() - Number(seen.last_valid_epoch) < GRACE_SECONDS;
}

module.exports = { touch, tenantAllowed, GRACE_SECONDS };
