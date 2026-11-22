// Tanılama (sunucu tarafı): yalnız GERÇEK ölçümler. Ölçülemeyen şey "unavailable" olur (başarısızlık değildir).
// Salt okunur; onarım yapmaz. Çıktıda lisans anahtarı, bulut adresi anahtarı, e-posta gibi sırlar yoktur.
const db = require('../config/database');
const ecr = require('./ecrService');
const fail = (message, status = 403) => { throw Object.assign(new Error(message), { status }); };

const day = 86400000;
async function timed(fn) { const t0 = Date.now(); try { return { value: await fn(), ms: Date.now() - t0 }; } catch (error) { return { error, ms: Date.now() - t0 }; } }

function checks(user) {
  const t = [];
  const add = (id, group, name, description, run) => t.push({ id, group, name, description, run });

  add('app.database', 'Veri ve yedek', 'Veritabanı bağlantısı', 'Sunucunun veritabanına gerçek bir sorgu atıp gecikmesini ölçer.', async () => {
    const r = await timed(() => db.query('SELECT 1 AS ok'));
    if (r.error) return { status: 'fail', summary: 'Sorgu başarısız.', detail: String(r.error.message).slice(0, 160), advice: 'Veritabanı hizmetinin çalıştığını kontrol edin.' };
    return { status: r.ms > 500 ? 'warn' : 'ok', summary: `Yanıt ${r.ms} ms`, data: { latencyMs: r.ms } };
  });

  add('app.license', 'Ağ ve bulut', 'Lisans durumu', 'İşletmenin lisans kaydı: durum ve bitiş tarihi.', async () => {
    const row = (await db.query("SELECT status,expires_at,grace_period_days FROM licenses WHERE tenant_id=$1 ORDER BY expires_at DESC LIMIT 1", [user.tenantId])).rows[0];
    if (!row) return { status: 'unavailable', summary: 'Bu işletme için lisans kaydı yok.', advice: 'Lisans merkezinden lisansı etkinleştirin.' };
    const left = Math.floor((Date.parse(String(row.expires_at).replace(' ', 'T') + (String(row.expires_at).includes('T') ? '' : 'Z')) - Date.now()) / day);
    const active = String(row.status).toUpperCase() === 'ACTIVE';
    const status = !active || left < 0 ? 'fail' : left <= 14 ? 'warn' : 'ok';
    return { status, summary: `${row.status} · ${left < 0 ? Math.abs(left) + ' gün önce bitti' : left + ' gün kaldı'}`, data: { status: row.status, expires_at: row.expires_at, days_left: left }, advice: status === 'ok' ? undefined : 'Lisansı yenileyin; süre bitince bazı işlemler kapanır.' };
  });

  add('app.sync', 'Ağ ve bulut', 'Mağaza–bulut eşitleme', 'Son eşitleme zamanı ve son hata.', async () => {
    const row = (await db.query('SELECT enabled,last_run_at,last_error FROM store_sync_config WHERE tenant_id=$1', [user.tenantId])).rows[0];
    if (!row) return { status: 'unavailable', summary: 'Eşitleme bu işletmede kurulu değil.' };
    if (!Number(row.enabled)) return { status: 'unavailable', summary: 'Eşitleme kapalı.' };
    if (row.last_error) return { status: 'fail', summary: 'Son eşitleme hata verdi.', detail: String(row.last_error).slice(0, 160), data: { last_run_at: row.last_run_at }, advice: 'İnternet ve bulut adresini kontrol edin; Ayarlar › Mağaza eşitleme.' };
    if (!row.last_run_at) return { status: 'warn', summary: 'Henüz hiç eşitlenmedi.' };
    return { status: 'ok', summary: 'Son eşitleme: ' + row.last_run_at, data: { last_run_at: row.last_run_at } };
  });

  add('app.offline-sales', 'Ağ ve bulut', 'Çevrimdışı satış kayıtları (sunucu)', 'Çevrimdışı yapılıp sunucuya ulaşmış satış sayısı ve çözülmemiş çakışmalar.', async () => {
    const n = Number((await db.query('SELECT COUNT(*) AS n FROM pos_offline_sales WHERE tenant_id=$1', [user.tenantId])).rows[0].n);
    const c = Number((await db.query('SELECT COUNT(*) AS n FROM pos_offline_conflicts WHERE tenant_id=$1', [user.tenantId])).rows[0].n);
    return { status: c ? 'warn' : 'ok', summary: `${n} satış sunucuda · ${c} çakışma`, data: { received: n, conflicts: c }, advice: c ? 'Ayarlar › Çevrimdışı çakışmalar bölümünden inceleyin.' : undefined };
  });

  add('app.ecr', 'Cihazlar', 'Yazarkasa (ÖKC)', 'Kayıtlı yazarkasa cihazları, sürücü durumu ve bekleyen/belirsiz mali fiş işleri. Simülatör gerçek sürücü akışıyla denenir.', async () => {
    const devices = (await ecr.devices(user)).items;
    const jobs = await ecr.jobs(user, {});
    const uncertain = jobs.items.filter(j => j.uncertain).length;
    if (!devices.length) return { status: 'unavailable', summary: 'Kayıtlı yazarkasa cihazı yok.' };
    const lines = [];
    let worst = 'ok';
    for (const d of devices) {
      if (d.brand === 'simulator') {
        const r = await timed(() => ecr.drivers.simulator.openSale(d, { receipt_no: 'TANILAMA', total_cents: 0, payments: [], lines: [] }));
        lines.push(`${d.name}: simülatör ${r.error ? 'hata verdi' : 'yanıt verdi'}`);
        if (r.error) worst = 'fail';
      } else {
        // Marka sürücüsü gerçek cihazla doğrulanmadıkça bağlantı denemesi yapılmaz; uydurma "başarılı" üretilmez.
        lines.push(`${d.name}: ${d.driver_status === 'not_installed' ? 'sürücü kurulu değil' : 'doğrulanmamış sürücü'} (bağlantı denenemedi)`);
      }
    }
    const status = worst === 'fail' ? 'fail' : (uncertain || jobs.blocking) ? 'warn' : devices.every(d => d.brand !== 'simulator') ? 'unavailable' : 'ok';
    return { status, summary: lines.join(' · ') + ` · bekleyen/başarısız iş: ${jobs.blocking}${uncertain ? ', belirsiz: ' + uncertain : ''}`, data: { devices: devices.length, blocking: jobs.blocking, uncertain }, advice: uncertain ? 'Belirsiz işlerde fişin yazılıp yazılmadığını yazarkasadan kontrol edin.' : jobs.blocking ? 'Bekleyen mali fiş işleri var; yazarkasayı kontrol edip kasa ekranından yeniden deneyin.' : undefined };
  });
  return t;
}

async function run(user) {
  if (!['admin', 'manager'].includes(user.role)) fail('Tanılama için yönetici yetkisi gerekir.');
  const results = [];
  for (const test of checks(user)) {
    const t0 = Date.now();
    try { results.push({ id: test.id, name: test.name, group: test.group, ...(await test.run()), ms: Date.now() - t0 }); }
    catch (e) { results.push({ id: test.id, name: test.name, group: test.group, status: 'fail', summary: 'Ölçüm sırasında hata.', detail: String(e.message).slice(0, 160), ms: Date.now() - t0 }); }
  }
  return { at: new Date().toISOString(), results, server: { node: process.version, uptime_s: Math.round(process.uptime()), db_engine: process.env.DB_ENGINE || 'sqlite' } };
}

module.exports = { run, checks };
