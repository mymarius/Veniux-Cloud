const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const { BaseMedicineProvider, ProviderUnavailableError } = require('./BaseMedicineProvider');
const { normalizeSearch } = require('../normalize');
const { downloadToFile, fetchSafely } = require('../safeDownload');

const listPage = () => process.env.MEDICINE_TITCK_LIST_PAGE || 'https://www.titck.gov.tr/dinamikmodul/85';
const allowedHosts = () => (process.env.MEDICINE_SOURCE_ALLOWED_HOSTS || 'titck.gov.tr,www.titck.gov.tr').split(',');

// TİTCK liste sayfalarında tablo en yeni dosyadan başlar; ilk .xlsx bağlantısı alınır.
async function discoverLatestXlsx(page) {
  // Accept başlığı gönderilmez: TİTCK güvenlik duvarı bu başlıkta bağlantıyı kesiyor.
  const { buffer, finalUrl } = await fetchSafely(page, { allowedHosts: allowedHosts(), maxBytes: 3 * 1024 * 1024, timeoutMs: 30000 });
  const match = buffer.toString('utf8').match(/href\s*=\s*["']([^"']+?\.xlsx)["']/i);
  if (!match) throw new Error('TİTCK sayfasında indirilebilir liste bulunamadı (sayfa yapısı değişmiş olabilir).');
  return new URL(match[1].replace(/&amp;/g, '&'), finalUrl).toString();
}

// TİTCK (Türkiye İlaç ve Tıbbi Cihaz Kurumu) kamuya açık listeleri:
// "Ruhsatlı Beşeri Tıbbi Ürünler Listesi" ve "İlaç Fiyat Listesi" Excel
// dosyaları ücretsiz yayımlanır. Bu sağlayıcı iki yoldan veri alır:
//   1) Yöneticinin panelden yüklediği .xlsx / .xls / .csv dosyası
//   2) MEDICINE_TITCK_LIST_URL ortam değişkeniyle verilen https adresi
//      (yalnızca MEDICINE_SOURCE_ALLOWED_HOSTS içindeki alan adları)
// Sütun adları dosyadan dosyaya değiştiği için başlıklar takma adlarla eşleştirilir.

const HEADER_ALIASES = {
  barcode: ['barkod', 'barkodu', 'barcode', 'gtin', 'urun barkodu', 'ilac barkodu'],
  name: ['ilac adi', 'urun adi', 'ilacin adi', 'urun ismi', 'ilac ismi', 'ticari adi', 'ticari isim', 'name'],
  activeIngredient: ['etken madde', 'etkin madde', 'etken maddeler', 'etkin maddeler', 'etken madde adi', 'active ingredient'],
  atcCode: ['atc kodu', 'atc', 'atc code'],
  company: ['ruhsat sahibi', 'ruhsat sahibi firma', 'ruhsat sahibi firma adi', 'firma adi', 'firma', 'company'],
  manufacturer: ['uretici', 'uretici firma', 'imalatci', 'uretim yeri', 'manufacturer'],
  prescriptionType: ['recete turu', 'recete tipi', 'recete', 'recete durumu'],
  marketStatus: ['durumu', 'durum', 'piyasa durumu', 'ruhsat durumu', 'urun durumu'],
  suspended: ['askida mi', 'askida', 'askiya alinma durumu', 'urun askida mi'],
  // Ruhsatlı ürünler listesinde durum, tarih sütunlarıyla verilir: doluysa askıda / iptal.
  suspendedDate: ['askiya alinma tarihi', 'askiya alinis tarihi', 'askiya alma tarihi'],
  cancelledDate: ['iptal tarihi', 'ruhsat iptal tarihi'],
  // TİTCK: "RUHSATI ASKIDA OLMAYAN ÜRÜN: 0, MADDE-23 GEREKÇELİ ASKIDA OLAN ÜRÜN: 1 …"
  suspendedCode: ['ruhsati askida olmayan urun'],
  licenseDate: ['ruhsat tarihi', 'ruhsat onay tarihi'],
  licenseNumber: ['ruhsat numarasi', 'ruhsat no'],
  price: ['perakende satis fiyati', 'perakende satis fiyati kdv dahil', 'psf', 'kdv dahil perakende satis fiyati', 'fiyat', 'satis fiyati', 'kamu fiyati'],
  pharmaceuticalForm: ['farmasotik form', 'farmasotik sekil', 'dozaj formu', 'form'],
  dosage: ['doz', 'dozaj', 'etken madde miktari', 'kuvvet'],
  packageSize: ['ambalaj', 'ambalaj miktari', 'paket', 'paket buyuklugu', 'kutu'],
  kubUrl: ['kub', 'kub linki', 'kub url'],
  ktUrl: ['kt', 'kt linki', 'kt url']
};

// Başlık satırını bulur: ilk 25 satırda hem barkod hem ad sütunu olan satır.
function detectHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const map = mapHeaders(rows[r] || []);
    if (map.barcode !== undefined && map.name !== undefined) return { row: r, map };
  }
  return null;
}

function mapHeaders(cells) {
  const map = {};
  const normalized = cells.map(cell => normalizeSearch(cell));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    // Önce birebir eşleşme, sonra "ile başlayan" eşleşme (ör. "barkod no")
    let index = normalized.findIndex(h => aliases.includes(h));
    if (index < 0) index = normalized.findIndex(h => h && aliases.some(a => h.startsWith(a + ' ')));
    if (index >= 0 && !Object.values(map).includes(index)) map[field] = index;
  }
  return map;
}

function toRecord(cells, map) {
  const pick = field => (map[field] === undefined ? null : cells[map[field]]);
  const suspended = normalizeSearch(pick('suspended'));
  const filled = field => { const v = pick(field); return v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim() !== '-'; };
  const status = filled('cancelledDate') ? 'passive'
    : ['evet', 'askida', '1', 'e'].includes(suspended) || filled('suspendedDate') || ['1', '2', '3'].includes(String(pick('suspendedCode') ?? '').trim()) ? 'suspended'
      : pick('marketStatus');
  return {
    barcode: pick('barcode'),
    name: pick('name'),
    activeIngredient: pick('activeIngredient'),
    atcCode: pick('atcCode'),
    company: pick('company'),
    manufacturer: pick('manufacturer'),
    prescriptionType: pick('prescriptionType'),
    marketStatus: status,
    price: pick('price'),
    pharmaceuticalForm: pick('pharmaceuticalForm'),
    dosage: pick('dosage'),
    packageSize: pick('packageSize'),
    kubUrl: pick('kubUrl'),
    ktUrl: pick('ktUrl'),
    licenseDate: pick('licenseDate'),
    licenseNumber: pick('licenseNumber'),
    currency: 'TRY',
    image: null
  };
}

class TitckListProvider extends BaseMedicineProvider {
  static key = 'titck';
  static label = 'TİTCK kamu listesi';
  static description = 'TİTCK\'nin ücretsiz yayımladığı ruhsatlı ürün / ilaç fiyat listesi (Excel veya CSV).';

  get fullCatalog() { return true; }

  sourceUrl() { return this.resolvedUrl || process.env.MEDICINE_TITCK_LIST_URL || listPage(); }

  async status() {
    const { filePath } = this.options;
    if (filePath && fs.existsSync(filePath)) return { available: true, message: `Yüklenen dosya: ${path.basename(filePath)}` };
    if (process.env.MEDICINE_TITCK_LIST_URL) return { available: true, message: 'Ortam değişkenindeki adresten indirilecek.' };
    return { available: true, message: 'TİTCK Ruhsatlı Ürünler sayfasındaki en güncel liste otomatik indirilecek.' };
  }

  async discoverLatestUrl() {
    try { return await discoverLatestXlsx(listPage()); }
    catch (error) {
      // Only fail over the built-in official URL on transient network failures.
      if (process.env.MEDICINE_TITCK_LIST_PAGE || !error.retryable) throw error;
      return discoverLatestXlsx('https://titck.gov.tr/dinamikmodul/85');
    }
  }

  // Senkronizasyon bitince otomatik indirilen geçici dosya silinir (yüklenen dosyaya dokunulmaz).
  async cleanup() { if (this.downloadedFile) fs.rm(this.downloadedFile, { force: true }, () => {}); }

  async resolveFile() {
    const { filePath, downloadDir } = this.options;
    if (filePath) {
      if (!fs.existsSync(filePath)) throw new ProviderUnavailableError('İçe aktarılacak dosya bulunamadı. Dosyayı yeniden yükleyin.');
      return filePath;
    }
    try {
      this.resolvedUrl = process.env.MEDICINE_TITCK_LIST_URL || await this.discoverLatestUrl();
      this.downloadedFile = await downloadToFile(this.resolvedUrl, downloadDir, { maxBytes: 60 * 1024 * 1024, allowedHosts: allowedHosts() });
      return this.downloadedFile;
    } catch (error) {
      throw new ProviderUnavailableError(`TİTCK kaynağına erişilemedi (Provider unavailable): ${error.message} Listeyi titck.gov.tr'den indirip İçe Aktar sekmesinden yükleyebilirsiniz.`);
    }
  }

  // Dosya parça parça satıra çevrilir; tüm kayıtlar tek seferde nesneye dönüştürülmez.
  async *fetchBatches(chunkSize = 500) {
    const file = await this.resolveFile();
    const ext = path.extname(file).toLowerCase();
    const sourceUrl = this.options.filePath ? null : this.sourceUrl();

    if (ext === '.csv' || ext === '.txt') {
      const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
      const rows = Papa.parse(text, { skipEmptyLines: true, delimiter: '' }).data;
      const header = detectHeader(rows);
      if (!header) throw new ProviderUnavailableError('Dosyada "Barkod" ve "İlaç adı" sütunları bulunamadı.');
      for (let i = header.row + 1; i < rows.length; i += chunkSize) {
        yield rows.slice(i, i + chunkSize).map(cells => ({ ...toRecord(cells, header.map), sourceUrl }));
      }
      return;
    }

    let workbook;
    try { workbook = XLSX.readFile(file, { dense: true, cellDates: false, cellHTML: false, cellFormula: false }); }
    catch { throw new ProviderUnavailableError('Excel dosyası okunamadı. Dosyanın bozuk olmadığından emin olun.'); }
    // Birden çok sayfa varsa başlığı tanınan ilk sayfa kullanılır.
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      const head = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range: { s: { r: range.s.r, c: range.s.c }, e: { r: Math.min(range.e.r, range.s.r + 25), c: range.e.c } } });
      const header = detectHeader(head);
      if (!header) continue;
      for (let start = range.s.r + header.row + 1; start <= range.e.r; start += chunkSize) {
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, range: { s: { r: start, c: range.s.c }, e: { r: Math.min(range.e.r, start + chunkSize - 1), c: range.e.c } } });
        yield rows.filter(cells => cells.some(v => v !== null && v !== '')).map(cells => ({ ...toRecord(cells, header.map), sourceUrl }));
      }
      return;
    }
    throw new ProviderUnavailableError('Dosyada "Barkod" ve "İlaç adı" sütunları bulunamadı.');
  }
}

module.exports = TitckListProvider;
module.exports.mapHeaders = mapHeaders;
module.exports.discoverLatestXlsx = discoverLatestXlsx;
module.exports.allowedHosts = allowedHosts;
