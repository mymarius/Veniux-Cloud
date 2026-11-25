const express = require('express');
const service = require('../services/accountingExportService');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();
const handle = fn => async (req, res) => {
  try { res.json(await fn(req)); } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Muhasebe aktarımı tamamlanamadı.' }); }
};
router.use(authMiddleware, requireRole('admin', 'manager'));
router.get('/maps', handle(req => service.getMaps(req.user)));
router.put('/maps', handle(req => service.saveMaps(req.user, req.body)));
router.post('/preview', handle(req => service.preview(req.user, req.body)));
router.get('/', handle(req => service.list(req.user)));
router.post('/', handle(req => service.create(req.user, req.body)));
const templates = require('../services/accountingTemplateService');
const templateBuffer = body => { if (typeof body?.data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(body.data)) { throw Object.assign(Error('Şablon dosyası okunamadı.'), { status: 400 }); } return Buffer.from(body.data, 'base64'); };
// Şablonun sütun adlarını ve seçilen veri türünün alanlarını döner; eşleme ekranı bunlarla çizilir.
router.post('/template/headers', handle(async req => {
  const info = templates.readTemplate(req.body?.filename, templateBuffer(req.body), Number(req.body?.header_row) || undefined);
  return { kind: info.kind, headers: info.headers, header_row: info.headerRowNumber || 1, fields: service.typeFields(req.body?.type) };
}));
router.post('/:id/template', async (req, res) => {
  try {
    const pack = await service.file(req.user, req.params.id);
    const out = templates.fill({ filename: req.body?.filename, buffer: templateBuffer(req.body), mapping: req.body?.mapping, content: pack.content, headerRow: Number(req.body?.header_row) || undefined });
    res.set('Cache-Control', 'no-store').attachment(out.name).type(out.type).send(out.content);
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Şablon doldurulamadı.' }); }
});
router.get('/:id/file', async (req, res) => {
  try {
    const file = await service.file(req.user, req.params.id);
    res.set('Cache-Control', 'no-store').attachment(file.name).type('text/csv; charset=utf-8').send(file.content);
  } catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : 'Dosya hazırlanamadı.' }); }
});
router.post('/:id/imported', handle(req => service.markImported(req.user, req.params.id)));
router.post('/:id/cancel', handle(req => service.cancel(req.user, req.params.id, req.body)));
module.exports = router;
