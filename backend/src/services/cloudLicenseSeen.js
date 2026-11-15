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
  await syncPacks(id, license).catch(() => {});
}

// Herkese açık vitrinler (cihazsız ziyaretçi) paketin merkezde hâlâ geçerli olup olmadığını bu kayıttan öğrenir.
// Lisans sunucusunun imzalı yanıtına göre paket açıksa kayıt tazelenir, kapalıysa silinir: mağaza en geç bir sonraki yönetici/kasiyer isteğinde kapanır.
const PUBLIC_PACKS = ['online_store'];
async function syncPacks(licenseId, license) {
  const bound = (await db.query('SELECT tenant_id FROM cloud_license_bindings WHERE authority_license_id=$1', [licenseId])).rows[0];
  if (!bound) return;
  const now = nowSeconds();
  for (const pack of PUBLIC_PACKS) {
    const allowed = await require('./sectorPacks').has({ tenantId: Number(bound.tenant_id), isPlatformAdmin: false }, pack, license);
    if (allowed) {
      const done = await db.query('UPDATE cloud_pack_seen SET last_seen_epoch=$3 WHERE authority_license_id=$1 AND pack=$2', [licenseId, pack, now]);
      if (done.rowCount === 0) await db.query('INSERT INTO cloud_pack_seen (authority_license_id,pack,last_seen_epoch) VALUES ($1,$2,$3)', [licenseId, pack, now]).catch(() => {});
    } else await db.query('DELETE FROM cloud_pack_seen WHERE authority_license_id=$1 AND pack=$2', [licenseId, pack]);
  }
}
// Bulutta paket merkezde GRACE_SECONDS içinde doğrulanmış mı. İzlenmeyen kurulumda hep izinli. Kayıt hiç yoksa saat bu çağrıyla başlar.
async function packAllowed(tenantId, pack) {
  if (!active()) return true;
  const bound = (await db.query('SELECT authority_license_id FROM cloud_license_bindings WHERE tenant_id=$1', [tenantId])).rows[0];
  if (!bound) return false;
  const id = Number(bound.authority_license_id);
  const seen = (await db.query('SELECT last_seen_epoch FROM cloud_pack_seen WHERE authority_license_id=$1 AND pack=$2', [id, pack])).rows[0];
  if (!seen) { await db.query('INSERT INTO cloud_pack_seen (authority_license_id,pack,last_seen_epoch) VALUES ($1,$2,$3)', [id, pack, nowSeconds()]).catch(() => {}); return true; }
  return nowSeconds() - Number(seen.last_seen_epoch) < GRACE_SECONDS;
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

module.exports = { touch, tenantAllowed, packAllowed, syncPacks, GRACE_SECONDS };
