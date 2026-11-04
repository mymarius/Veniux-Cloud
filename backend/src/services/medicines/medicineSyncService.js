const path = require('path');
const pool = require('../../config/database');
const repo = require('./medicineRepository');
const { toRow } = require('./medicineService');
const { createProvider, PROVIDERS } = require('./providers');
const { ProviderUnavailableError } = require('./providers/BaseMedicineProvider');

// Uygulamada kuyruk sistemi olmadığı için senkronizasyon aynı süreçte arka
// planda çalışır: istek hemen 202 döner, iş parçalar halinde ilerler ve her
// parça arasında olay döngüsüne nefes aldırılır. Aynı anda tek iş çalışır.

const STORAGE = path.join(process.env.MEDICINE_STORAGE_DIR || require('../../config/runtimeConfig').paths().storage, 'medicine-imports');
const STALE_MS = 2 * 60 * 60 * 1000;
const ENRICHABLE = ['price', 'prescription_type', 'dosage', 'pharmaceutical_form', 'package_size', 'manufacturer', 'kub_url', 'kt_url'];
const DEFAULTS = { active_provider: 'titck', chunk_size: '500', auto_deactivate: '1', deactivate_max_percent: '20', enrich_price_list: '1', enrich_controlled_lists: '1' };
// enrich_price_list: yalnızca yönetici bir fiyat listesi yüklediyse etkilidir (her senkronizasyonda yeniden uygulanır).
let current = null; // { logId, promise }

const yieldLoop = () => new Promise(resolve => setImmediate(resolve));
const parseUtc = value => new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');

async function getSettings() {
  return { ...DEFAULTS, ...(await repo.getSettings()) };
}

// Sunucu yeniden başlatıldığında yarıda kalan işler "başarısız" işaretlenir.
async function recoverStale() {
  const running = await repo.runningLog();
  if (running && (!current || current.logId !== running.id) && Date.now() - parseUtc(running.started_at).getTime() > (current ? STALE_MS : 0)) {
    await repo.updateLog(running.id, { status: 'failed', finished_at: 'NOW()', error_message: 'İşlem yarıda kaldı (sunucu yeniden başlatılmış olabilir).' });
  }
}

async function processChunk(records, ctx) {
  const prepared = [];
  for (const record of records) {
    ctx.stats.total++;
    const { row, image, error, skip } = toRow(record, ctx.provider.key);
    if (skip) { ctx.stats.skipped++; ctx.noBarcode++; continue; }
    if (error) { ctx.stats.failed++; if (ctx.errors.length < 50) ctx.errors.push({ barcode: String(record.barcode ?? '').slice(0, 20), name: String(record.name ?? '').slice(0, 80), error }); continue; }
    if (ctx.seen.has(row.barcode)) { ctx.stats.skipped++; continue; } // dosyada tekrar eden barkod
    ctx.seen.add(row.barcode);
    prepared.push({ row, image });
  }
  if (!prepared.length) return;

  await pool.transaction(async client => {
    const existing = await repo.findByBarcodes(prepared.map(p => p.row.barcode), client);
    const seenIds = [];
    for (const { row, image } of prepared) {
      const found = existing.get(row.barcode);
      const stamp = { last_seen_sync_id: ctx.logId, last_synced_at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
      // Sağlayıcı görseli yalnızca barkodla birebir eşleşen kayıt için ve
      // elle yüklenmiş bir görselin üzerine yazmadan kullanılır.
      const imageFields = image && (!found || !['manual', 'manufacturer'].includes(found.image_source))
        ? { image_url: image, image_source: 'provider', image_verified: ctx.provider.imagesBarcodeMatched ? 1 : 0 }
        : {};
      if (!found) {
        await repo.insert({ ...row, ...imageFields, ...stamp }, client);
        ctx.stats.created++;
      } else if (found.source === 'manual' || Number(found.manual_override) === 1) {
        // Elle eklenen / elle düzenlenen kayda dokunulmaz, pasife de alınmaz.
        seenIds.push(found.id);
        ctx.stats.skipped++;
        ctx.protectedCount = (ctx.protectedCount || 0) + 1;
      } else if (found.data_hash === row.data_hash && !imageFields.image_url) {
        seenIds.push(found.id);
        ctx.stats.unchanged++;
      } else {
        // Kaynağın boş bıraktığı alanlar, başka kaynaktan (ör. fiyat listesi) gelmiş değeri silmez.
        const patch = { ...row };
        for (const key of ENRICHABLE) if (patch[key] === null || patch[key] === undefined) delete patch[key];
        await repo.update(found.id, { ...patch, ...imageFields, ...stamp }, client);
        ctx.stats.updated++;
      }
    }
    await repo.markSeen(seenIds, ctx.logId, client);
  });
}

async function run(logId, provider, settings) {
  const chunkSize = Math.min(2000, Math.max(50, Number(settings.chunk_size) || 500));
  const ctx = { logId, provider, seen: new Set(), errors: [], noBarcode: 0, stats: { total: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, deactivated: 0 } };
  const details = {};
  try {
    for await (const batch of provider.fetchBatches(chunkSize)) {
      await processChunk(batch, ctx);
      await repo.updateLog(logId, ctx.stats); // ilerleme panelde canlı görünür
      await yieldLoop();
    }
    // Piyasadan çekilenler: yalnızca tam katalog sunan kaynaklarda ve
    // güvenlik eşiği aşılmıyorsa (eksik/kesik dosyaya karşı koruma).
    if (provider.fullCatalog && settings.auto_deactivate === '1' && ctx.stats.total > 0) {
      const { missing, all } = await repo.countMissing(provider.key, logId);
      const limit = Number(settings.deactivate_max_percent) || 20;
      if (missing && all && (missing / all) * 100 > limit) {
        details.deactivationSkipped = `Kaynakta bulunmayan ${missing} kayıt (%${Math.round((missing / all) * 100)}) eşik değeri olan %${limit}'yi aştığı için pasife alınmadı. Dosyanın eksiksiz olduğundan emin olun.`;
      } else if (missing) {
        ctx.stats.deactivated = await repo.deactivateMissing(provider.key, logId);
      }
    }
    // Reçete türü: TİTCK Kırmızı / Yeşil reçete listeleri (herkese açık PDF).
    if (settings.enrich_controlled_lists !== '0' && ctx.stats.total > 0) {
      await repo.updateLog(logId, { details: JSON.stringify({ ...details, controlled: { running: true } }) });
      try { details.controlled = await require('./enrichers/controlledLists').enrich(); }
      catch (error) { details.controlled = { error: `Reçete listeleri alınamadı: ${error.message}` }; }
    }
    // Yönetici bir fiyat / reçete listesi yüklediyse fiyat ve reçete türü ondan tamamlanır.
    if (settings.price_import_file && settings.enrich_price_list !== '0' && ctx.stats.total > 0) {
      await repo.updateLog(logId, { details: JSON.stringify({ ...details, enrichment: { running: true } }) });
      try { details.enrichment = await require('./enrichers/titckPriceList').enrich({ file: settings.price_import_file, chunkSize }); }
      catch (error) { details.enrichment = { error: `Fiyat listesi alınamadı: ${error.message}` }; }
    }
    details.errors = ctx.errors;
    details.skippedNoBarcode = ctx.noBarcode;
    details.skippedProtected = ctx.protectedCount || 0;
    details.skippedDuplicate = ctx.stats.skipped - ctx.noBarcode - details.skippedProtected;
    const status = ctx.stats.failed && ctx.stats.failed === ctx.stats.total ? 'failed' : ctx.stats.failed ? 'partial' : 'success';
    await repo.updateLog(logId, { ...ctx.stats, status, finished_at: 'NOW()', details: JSON.stringify(details), error_message: status === 'failed' ? 'Kaynaktaki kayıtların hiçbiri işlenemedi.' : null });
  } catch (error) {
    // Kaynak çökse bile mevcut veriler yerinde kalır; yalnızca günlük güncellenir.
    const message = error instanceof ProviderUnavailableError ? error.message : `Beklenmeyen hata: ${error.message}`;
    console.error('[MedicineSync]', { logId, provider: provider.key, message: error.message });
    details.errors = ctx.errors;
    await repo.updateLog(logId, { ...ctx.stats, status: 'failed', finished_at: 'NOW()', error_message: message.slice(0, 1000), details: JSON.stringify(details) }).catch(() => {});
  }
}

// Senkronizasyonu başlatır ve hemen günlük kimliğini döner.
async function start({ providerKey, filePath, triggeredBy }) {
  await recoverStale();
  if (current || await repo.runningLog()) throw Object.assign(new Error('Devam eden bir senkronizasyon var. Bitmesini bekleyin.'), { status: 409 });
  const settings = await getSettings();
  const key = providerKey || settings.active_provider;
  const provider = createProvider(key, { filePath, downloadDir: STORAGE });
  // Kaynak hiç tanımlı değilse başarısız günlük oluşturmadan yönlendirici bir hata döner.
  const availability = await provider.status().catch(() => ({ available: false, message: 'Kaynak durumu alınamadı.' }));
  if (!availability.available) throw Object.assign(new Error(availability.message), { status: 400, code: 'SOURCE_NOT_CONFIGURED' });
  const logId = await repo.createLog(key, triggeredBy || null);
  const promise = run(logId, provider, settings).finally(() => {
    provider.cleanup().catch(() => {});
    if (current?.logId === logId) current = null;
  });
  current = { logId, promise };
  return { logId, promise };
}

async function status() {
  await recoverStale();
  const [running, lastSuccess, settings] = await Promise.all([repo.runningLog(), repo.lastSuccessfulLog(), getSettings()]);
  const providers = await Promise.all(PROVIDERS.map(async P => {
    const provider = new P({ filePath: settings.last_import_file || undefined, downloadDir: STORAGE });
    return { key: P.key, label: P.label, description: P.description, fullCatalog: provider.fullCatalog, ...(await provider.status().catch(() => ({ available: false, message: 'Durum alınamadı.' }))) };
  }));
  const { last_import_file: _serverPath, price_import_file: _pricePath, ...publicSettings } = settings; // sunucu yolları istemciye gönderilmez
  return { running, lastSuccess, settings: publicSettings, providers };
}

const waitForIdle = () => (current ? current.promise : Promise.resolve());

module.exports = { start, status, getSettings, waitForIdle, STORAGE };
