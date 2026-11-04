const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const service = require('../services/medicines/medicineService');
const syncService = require('../services/medicines/medicineSyncService');
const imageService = require('../services/medicines/medicineImageService');
const repo = require('../services/medicines/medicineRepository');
const { getProviderClass } = require('../services/medicines/providers');
const { fail } = require('./medicineController');

// İlaç Yönetimi – yalnızca platform yöneticisi. Her değişiklik denetim günlüğüne yazılır.
const pool = require('../config/database');
const audit = (req, action, entityId, details) => pool.query(
  'INSERT INTO audit_logs (tenant_id, user_email, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
  [req.user.homeTenantId || req.user.tenantId, req.user.email, action, 'medicine', entityId || null, JSON.stringify(details || {})]
).catch(() => {});

exports.list = async (req, res) => {
  try {
    const result = await service.search(req.query, { includeAll: true });
    res.json({ success: true, data: result.rows, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages }, fuzzy: result.fuzzy });
  } catch (error) { fail(res, error); }
};

exports.create = async (req, res) => {
  try {
    const medicine = await service.create(req.body || {});
    audit(req, 'medicine.create', medicine.id, { barcode: medicine.barcode });
    res.status(201).json({ success: true, data: service.toDto(medicine) });
  } catch (error) { fail(res, error); }
};

exports.update = async (req, res) => {
  try {
    const medicine = await service.updateMedicine(req.params.id, req.body || {});
    audit(req, 'medicine.update', medicine.id, { barcode: medicine.barcode });
    res.json({ success: true, data: service.toDto(medicine) });
  } catch (error) { fail(res, error); }
};

// Varsayılan: pasife al. ?permanent=1 ile kalıcı silme.
exports.remove = async (req, res) => {
  try {
    if (req.query.permanent === '1') {
      const removed = await service.removePermanently(req.params.id);
      imageService.removeLocal(removed.image_local_path);
      audit(req, 'medicine.delete', removed.id, { barcode: removed.barcode });
      return res.json({ success: true, message: 'İlaç kalıcı olarak silindi.' });
    }
    const medicine = await service.deactivate(req.params.id);
    audit(req, 'medicine.deactivate', medicine.id, { barcode: medicine.barcode });
    res.json({ success: true, data: service.toDto(medicine), message: 'İlaç pasife alındı.' });
  } catch (error) { fail(res, error); }
};

// Görsel yükleme: gövde ham dosya (application/octet-stream), en fazla 2 MB.
exports.uploadImage = async (req, res) => {
  try {
    const medicine = await service.getById(req.params.id);
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ success: false, message: 'Görsel dosyası gönderilmedi.' });
    await imageService.upload(medicine.id, req.body);
    audit(req, 'medicine.image.upload', medicine.id, {});
    res.json({ success: true, data: service.toDto(await repo.findById(medicine.id)) });
  } catch (error) { fail(res, error); }
};

exports.updateImage = async (req, res) => {
  try {
    const medicine = await service.getById(req.params.id);
    const body = req.body || {};
    if (body.imageUrl !== undefined) await imageService.setRemote(medicine.id, { imageUrl: body.imageUrl, imageSource: body.imageSource || 'manufacturer', verified: Boolean(body.verified) });
    else if (body.verified !== undefined) await imageService.setVerified(medicine.id, Boolean(body.verified));
    audit(req, 'medicine.image.update', medicine.id, { verified: Boolean(body.verified) });
    res.json({ success: true, data: service.toDto(await repo.findById(medicine.id)) });
  } catch (error) { fail(res, error); }
};

exports.deleteImage = async (req, res) => {
  try {
    const medicine = await service.getById(req.params.id);
    await imageService.clear(medicine.id);
    audit(req, 'medicine.image.delete', medicine.id, {});
    res.json({ success: true, data: service.toDto(await repo.findById(medicine.id)) });
  } catch (error) { fail(res, error); }
};

exports.cacheImage = async (req, res) => {
  try {
    const medicine = await service.getById(req.params.id);
    await imageService.cacheRemote(medicine.id);
    res.json({ success: true, data: service.toDto(await repo.findById(medicine.id)) });
  } catch (error) { fail(res, error); }
};

// İçe aktarma dosyası: .xlsx/.xls/.csv, ham gövde, en fazla 40 MB.
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
exports.importFile = async (req, res) => {
  try {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length < 16) return res.status(400).json({ success: false, message: 'Dosya gönderilmedi.' });
    const head = buffer.subarray(0, 4);
    const ext = head.equals(ZIP) ? '.xlsx' : head.equals(OLE) ? '.xls' : null;
    let finalExt = ext;
    if (!finalExt) {
      // CSV: ikili karakter içermeyen metin olmalı
      const sample = buffer.subarray(0, 4096);
      if (sample.includes(0)) return res.status(415).json({ success: false, message: 'Yalnızca .xlsx, .xls veya .csv dosyaları kabul edilir.' });
      finalExt = '.csv';
    }
    fs.mkdirSync(syncService.STORAGE, { recursive: true });
    const name = `import-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${finalExt}`;
    fs.writeFileSync(path.join(syncService.STORAGE, name), buffer);
    let rawName = String(req.headers['x-file-name'] || '');
    try { rawName = decodeURIComponent(rawName); } catch { /* kodlanmamış ad */ }
    const original = rawName.replace(/[^\w.\- ğüşıöçĞÜŞİÖÇ]/g, '').slice(0, 120);
    // ?kind=prices: barkodlu fiyat / reçete listesi; aksi halde ana ilaç listesi.
    const prefix = req.query.kind === 'prices' ? 'price_import' : 'last_import';
    // Önceki dosya silinir; diskte her tür için yalnızca son yüklenen tutulur.
    const previous = (await repo.getSettings())[`${prefix}_file`];
    if (previous && path.dirname(previous) === syncService.STORAGE && !(await repo.runningLog())) fs.rm(previous, { force: true }, () => {});
    const stored = path.join(syncService.STORAGE, name);
    await repo.setSetting(`${prefix}_file`, stored);
    await repo.setSetting(`${prefix}_name`, original || name);
    await repo.setSetting(`${prefix}_at`, new Date().toISOString());
    audit(req, `medicine.import.${req.query.kind === 'prices' ? 'prices' : 'upload'}`, null, { file: original || name, size: buffer.length });

    // Fiyat listesi hemen uygulanır (senkronizasyon beklenmez); sonuç yanıtta döner.
    let enrichment;
    if (prefix === 'price_import') {
      if (await repo.runningLog()) return res.status(409).json({ success: false, message: 'Devam eden bir senkronizasyon var. Bittikten sonra tekrar yükleyin.' });
      try { enrichment = await require('../services/medicines/enrichers/titckPriceList').enrich({ file: stored }); }
      catch (error) { return res.status(422).json({ success: false, message: error.message }); }
    }
    res.status(201).json({ success: true, data: { file: name, originalName: original || name, size: buffer.length, enrichment } });
  } catch (error) { fail(res, error); }
};

exports.startSync = async (req, res) => {
  try {
    const settings = await syncService.getSettings();
    const providerKey = req.body?.provider || settings.active_provider;
    if (!getProviderClass(providerKey)) return res.status(400).json({ success: false, message: 'Bilinmeyen veri sağlayıcısı.' });
    // Yüklenmiş dosya varsa ve istenirse o kullanılır; aksi halde sağlayıcı kendi kaynağına gider.
    const useUpload = req.body?.useUploadedFile !== false && settings.last_import_file && fs.existsSync(settings.last_import_file);
    const { logId } = await syncService.start({ providerKey, filePath: useUpload ? settings.last_import_file : undefined, triggeredBy: req.user.email });
    audit(req, 'medicine.sync.start', logId, { provider: providerKey });
    res.status(202).json({ success: true, data: { logId }, message: 'Senkronizasyon başlatıldı.' });
  } catch (error) { fail(res, error); }
};

exports.syncLogs = async (req, res) => {
  try {
    const logs = await repo.listLogs(req.query.limit);
    res.json({ success: true, data: logs.map(l => ({ ...l, details: l.details ? JSON.parse(l.details) : null })) });
  } catch (error) { fail(res, error); }
};

exports.syncLog = async (req, res) => {
  try {
    const log = await repo.getLog(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı.' });
    res.json({ success: true, data: { ...log, details: log.details ? JSON.parse(log.details) : null } });
  } catch (error) { fail(res, error); }
};

const SETTING_RULES = {
  active_provider: v => Boolean(getProviderClass(v)),
  chunk_size: v => /^\d+$/.test(v) && Number(v) >= 50 && Number(v) <= 2000,
  auto_deactivate: v => ['0', '1'].includes(v),
  enrich_price_list: v => ['0', '1'].includes(v),
  enrich_controlled_lists: v => ['0', '1'].includes(v),
  deactivate_max_percent: v => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100
};
exports.getSettings = async (req, res) => {
  try {
    const settings = await syncService.getSettings();
    res.json({ success: true, data: { ...settings, imageCacheHosts: imageService.cacheHosts(), titckUrlConfigured: Boolean(process.env.MEDICINE_TITCK_LIST_URL), last_import_file: undefined } });
  } catch (error) { fail(res, error); }
};
exports.updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body || {}).filter(([key]) => SETTING_RULES[key]);
    for (const [key, value] of entries) if (!SETTING_RULES[key](String(value))) return res.status(400).json({ success: false, message: `Geçersiz ayar: ${key}` });
    for (const [key, value] of entries) await repo.setSetting(key, String(value));
    audit(req, 'medicine.settings.update', null, Object.fromEntries(entries));
    exports.getSettings(req, res);
  } catch (error) { fail(res, error); }
};
