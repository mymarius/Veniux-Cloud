const service = require('../services/medicines/medicineService');
const syncService = require('../services/medicines/medicineSyncService');
const imageService = require('../services/medicines/medicineImageService');
const repo = require('../services/medicines/medicineRepository');

// İlaç Veritabanı – okuma uçları. Yanıt biçimi: { success, data } / { success:false, message }.
const fail = (res, error) => {
  const status = error.status || 500;
  if (status === 500) console.error('[Medicines]', error.message);
  res.status(status).json({ success: false, message: status === 500 ? 'İşlem sırasında sunucu hatası oluştu.' : error.message, error: status === 500 ? 'İşlem sırasında sunucu hatası oluştu.' : error.message });
};

exports.list = async (req, res) => {
  try {
    const result = await service.search(req.query,{includeAll:true});
    res.json({ success: true, data: result.rows, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.pages }, fuzzy: result.fuzzy });
  } catch (error) { fail(res, error); }
};

exports.newMedicines = async (req, res) => {
  try {
    const { data, ...meta } = await service.newMedicines(req.query.period, req.query.limit);
    res.json({ success: true, data, ...meta });
  } catch (error) { fail(res, error); }
};

exports.byBarcode = async (req, res) => {
  try {
    const medicine = await service.getByBarcode(req.params.barcode);
    if (!medicine) return res.status(404).json({ success: false, message: 'İlaç bulunamadı.' });
    res.json({ success: true, data: service.toDto(medicine) });
  } catch (error) { fail(res, error); }
};

exports.detail = async (req, res) => {
  try { res.json({ success: true, data: service.toDto(await service.getById(req.params.id)) }); }
  catch (error) { fail(res, error); }
};

exports.stats = async (req, res) => {
  try {
    const [stats, lastSuccess] = await Promise.all([repo.stats(), repo.lastSuccessfulLog()]);
    res.json({ success: true, data: { ...stats, lastSyncedAt: lastSuccess?.finished_at || null, lastSyncProvider: lastSuccess?.provider || null } });
  } catch (error) { fail(res, error); }
};

// Görseller <img> etiketiyle yüklendiği için bu uç kimlik doğrulaması istemez;
// yalnızca kayıtlı ilaç görsellerini sunar.
exports.image = async (req, res) => {
  try {
    const medicine = await service.getById(req.params.id);
    let target = imageService.resolve(medicine);
    if(!target){
      const url=await require('../services/medicines/barcodeImages').lookup(medicine);
      if(url)target={redirect:url};
    }
    if (!target) return res.status(404).json({ success: false, message: 'Görsel bulunamadı.' });
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    if (target.redirect) return res.redirect(302, target.redirect);
    res.type(target.type).sendFile(target.file);
  } catch (error) { fail(res, error); }
};

exports.fail = fail;
exports.syncStatus = async (req, res) => {
  try { res.json({ success: true, data: await syncService.status() }); } catch (error) { fail(res, error); }
};
