const express = require('express');
const router = express.Router();
const service = require('../services/pharmacyMigrationService');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Browser clients cannot inspect Windows.  This is a provider catalogue, never
// a local-installation result.
router.get('/detect', (req, res) => {
  res.json({
    detectionMode: 'catalog_only',
    note: 'Tarayıcı ortamı Windows kayıt defteri veya uygulama dosyası okuyamaz. Buradaki satırlar olası uyumlu dışa aktarımlardır; kurulum tespiti değildir.',
    supportedSoftware: [
      {
        id: 'farmakom',
        name: 'Farmakom Eczane Otomasyonu',
        vendor: 'Farmakom Bilgisayar Ltd.',
        status: 'catalog_only',
        statusLabel: 'Yerel kurulum ölçülmedi — olası uyumlu dışa aktarım',
        dataAccessSupported: false,
        citation: {
          label: 'Farmakom resmî ürün sayfası',
          url: 'https://farmakom.com/Default.aspx',
          exportInstruction: 'Sağlayıcının kurulu sürümünüz için verdiği resmî stok/ürün dışa aktarım yönergesini kullanın; yalnız ürün ve stok alanlarını seçin.'
        },
        dataAccessNote: 'Resmi/belgelenmiş ODBC/veritabanı sürücüsü veya API bağlantısı bulunmamaktadır. Sağlayıcı doğrudan DB API sunmamakta olup gerçek sağlayıcı veritabanı örneği (DBF/MDF) olmadan doğrudan adaptör sertifikalandırılamaz. Veri güvenliği için Farmakom resmi dışa aktarım (Excel/CSV) dosyası üzerinden aktarım desteklenir.'
      },
      {
        id: 'ilon',
        name: 'İlon Eczane Otomasyonu',
        vendor: 'İlon Yazılım',
        status: 'catalog_only',
        statusLabel: 'Yerel kurulum ölçülmedi — olası uyumlu dışa aktarım',
        dataAccessSupported: false,
        citation: {
          label: 'Sağlayıcı kılavuzu bu kaynakta doğrulanmadı',
          url: null,
          exportInstruction: 'İlon desteğinden kendi sürümünüzün ürün/stok CSV veya Excel dışa aktarma talimatını isteyin; hasta/reçete ekranlarını dışa aktarmayın.'
        },
        dataAccessNote: 'Belgelenmiş üçüncü parti veritabanı sürücüsü yoktur. Excel/CSV aktarım formatı gereklidir.'
      },
      {
        id: 'teb',
        name: 'TEB Eczane Otomasyonu',
        vendor: 'Türk Eczacıları Birliği',
        status: 'catalog_only',
        statusLabel: 'Yerel kurulum ölçülmedi — olası uyumlu dışa aktarım',
        dataAccessSupported: false,
        citation: {
          label: 'TEB CETAŞ eczane otomasyonu kılavuzları',
          url: 'https://cetas.teb.org.tr/m1_4_otomasyon.php',
          exportInstruction: "TEB'in kurulu sürümünüze ait kılavuzundan ürün/stok dışa aktarımını izleyin; Veniux yalnız izin verilen sütunları kabul eder."
        },
        dataAccessNote: 'Sağlayıcı doğrudan DB API sunmamaktadır. Excel/CSV dışa aktarım desteği kullanılmalıdır.'
      },
      {
        id: 'rxmediapharma',
        name: 'RxMediaPharma',
        vendor: 'GEMAŞ',
        status: 'catalog_only',
        statusLabel: 'Yerel kurulum ölçülmedi — olası uyumlu dışa aktarım',
        dataAccessSupported: false,
        citation: {
          label: 'Sağlayıcı dışa aktarım kılavuzu bu kaynakta doğrulanmadı',
          url: null,
          exportInstruction: 'Sağlayıcı desteğinden kendi sürümünüze ait ürün/stok dışa aktarma yönergesini isteyin.'
        },
        dataAccessNote: 'Referans ilaç bilgi sistemi; doğrudan stok aktarımı dışa aktarılan Excel listeleri üzerinden yapılır.'
      }
    ],
    kvkkScope: {
      strictAllowlistOnly: true,
      allowedFields: [
        'Barkod', 'İlaç/Ürün Adı', 'Kategori', 'Birim', 'Alış Fiyatı',
        'Satış Fiyatı', 'KDV Oranı', 'Stok Miktarı', 'Parti/Lot No',
        'Son Kullanma Tarihi (SKT)', 'Raf/Lokasyon Kodu'
      ],
      discardedByDefault: 'Hasta adı, TC kimlik no, reçete no, hekim adı, tanı/teşhis, SGK provizyon verileri ve tüm yabancı sütunlar anında ayıklanır ve depolanmaz.'
    }
  });
});

// 2. CSV / Excel template download
router.get('/template', (req, res) => {
  const type = req.query.type || 'combined';
  const csv = service.generateTemplate(type);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eczane-aktarim-sablonu-${type}.csv"`);
  res.send(csv);
});

// 3. Parse uploaded file
router.post('/parse', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const result = await service.parsePharmacyFile(req.user, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// 4. Preview and reconcile batch
router.post('/:id/preview', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const result = await service.previewPharmacyBatch(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 5. Commit atomic import
router.post('/:id/commit', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const result = await service.commitPharmacyBatch(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
