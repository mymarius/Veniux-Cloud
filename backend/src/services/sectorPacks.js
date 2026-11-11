// Sektör paketleri: Hırdavat (hardware), Züccaciye (tableware), Pide/Restoran (restaurant). Her biri ayrı satın alınır.
// Hak kaynağı: (0) lisans merkezinin imzalı yanıtındaki addons, (1) paket sözleşmesi varsa sözleşmenin modül listesi (tek yetkili), (2) sözleşmesiz eski lisanslarda platform
// yöneticisinin verdiği kayıt (sector_packs). Platform sahibinin kendi çalışma alanı deneme için tüm paketleri görür.
const db = require('../config/database');
const packages = require('./productPackages');
const PACKS = ['hardware', 'tableware', 'restaurant'];
const LABELS = { hardware: 'Hırdavat paketi', tableware: 'Züccaciye paketi', restaurant: 'Pide ve restoran paketi' };
const denied = pack => Object.assign(new Error((LABELS[pack] || 'Bu paket') + ' hesabınızda etkin değil. Paketi satın almak için bize ulaşın.'), { status: 403, code: 'PACK_REQUIRED', pack });

async function has(user, pack, central) {
  if (!PACKS.includes(pack)) return false;
  if (user.isPlatformAdmin) return true;
  const contract = await packages.rights(user.tenantId, db, central);
  if (contract && contract.blocked) return false;
  // Lisans merkezi lisansa sektör paketi işaretlemişse (imzalı yanıttaki addons) paket açıktır.
  if (central && Array.isArray(central.addons) && central.addons.includes(pack)) return true;
  if (contract) return packages.hasModule(contract, pack);
  return Boolean((await db.query('SELECT pack FROM sector_packs WHERE tenant_id=$1 AND pack=$2', [user.tenantId, pack])).rows[0]);
}

async function mine(user, central) {
  const result = {};
  for (const pack of PACKS) result[pack] = await has(user, pack, central);
  return result;
}

const require_ = pack => async (req, res, next) => {
  try { if (!(await has(req.user, pack, req.centralLicense))) throw denied(pack); next(); } catch (e) { next(e); }
};

// Platform yöneticisi: tüm işletmeleri ve verilmiş sektör paketlerini listeler (en çok 500 işletme).
async function listAll(admin) {
  if (!admin.isPlatformAdmin) throw Object.assign(new Error('Platform yöneticisi gerekli.'), { status: 403 });
  const tenants = (await db.query('SELECT id, company_name FROM tenants ORDER BY id DESC LIMIT 500')).rows;
  const granted = (await db.query('SELECT tenant_id, pack FROM sector_packs')).rows;
  const byTenant = new Map();
  for (const row of granted) { const list = byTenant.get(Number(row.tenant_id)) || []; list.push(row.pack); byTenant.set(Number(row.tenant_id), list); }
  return { packs: PACKS, labels: LABELS, tenants: tenants.map(t => ({ id: Number(t.id), company_name: t.company_name, packs: (byTenant.get(Number(t.id)) || []).sort() })) };
}

// Platform yöneticisi: sözleşmesiz bir işletmeye paket hakkı verir/alır.
async function setForTenant(admin, tenantId, packs) {
  if (!admin.isPlatformAdmin) throw Object.assign(new Error('Platform yöneticisi gerekli.'), { status: 403 });
  const tenant = Number(tenantId);
  if (!Number.isSafeInteger(tenant) || tenant < 1) throw Object.assign(new Error('İşletme geçersiz.'), { status: 400 });
  if (!Array.isArray(packs) || packs.some(p => !PACKS.includes(p))) throw Object.assign(new Error('Paket listesi geçersiz.'), { status: 400 });
  const wanted = [...new Set(packs)];
  return db.transaction(async tx => {
    if (!(await tx.query('SELECT id FROM tenants WHERE id=$1', [tenant])).rows[0]) throw Object.assign(new Error('İşletme bulunamadı.'), { status: 404 });
    await tx.query('DELETE FROM sector_packs WHERE tenant_id=$1', [tenant]);
    for (const pack of wanted) await tx.query('INSERT INTO sector_packs (tenant_id,pack,granted_by) VALUES ($1,$2,$3)', [tenant, pack, admin.userId]);
    await tx.query('INSERT INTO audit_logs (tenant_id,user_email,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5,$6)', [tenant, admin.email, 'sector_packs.set', 'sector_pack', null, JSON.stringify({ packs: wanted })]);
    return { tenant_id: tenant, packs: wanted };
  });
}

module.exports = { PACKS, LABELS, has, mine, require: require_, setForTenant, listAll };
