const assertRetired=require('./helpers/assertRetired');
const os = require('os');
const path = require('path');
const fs = require('fs');
// Testler yüklenen dosyaları gerçek storage/ klasörüne değil geçici klasöre yazar.
process.env.MEDICINE_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'veniux-medicines-'));
afterAll(() => fs.rmSync(process.env.MEDICINE_STORAGE_DIR, { recursive: true, force: true }));
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/database');
const { createTenant } = require('./factories');
const sync = require('../src/services/medicines/medicineSyncService');
const { normalizeSearch, cleanBarcode, parsePrice } = require('../src/services/medicines/normalize');

let admin, tenant;
const auth = user => ({ Authorization: 'Bearer ' + user.token });

// TİTCK listelerine benzer: üstte başlık satırları, Türkçe sütun adları.
const csv = rows => ['T.C. SAĞLIK BAKANLIĞI TİTCK;;;;;', 'Ruhsatlı Ürünler Listesi;;;;;',
  'BARKOD;İLAÇ ADI;ETKEN MADDE;ATC KODU;RUHSAT SAHİBİ FİRMA;PERAKENDE SATIŞ FİYATI;DURUMU',
  ...rows].join('\n');

async function upload(content) {
  return request(app).post('/api/admin/medicines/import').set(auth(admin))
    .set('Content-Type', 'application/octet-stream').set('x-file-name', encodeURIComponent('liste.csv')).send(Buffer.from(content, 'utf8'));
}
async function runSync() {
  const started = await request(app).post('/api/admin/medicines/sync').set(auth(admin)).send({ provider: 'titck' });
  expect(started.status).toBe(202);
  await sync.waitForIdle();
  return (await request(app).get(`/api/admin/medicines/sync/logs/${started.body.data.logId}`).set(auth(admin))).body.data;
}

beforeAll(async () => {
  admin = await createTenant();
  tenant = await createTenant();
  await db.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [admin.userId]);
  // Testler TİTCK fiyat listesini internetten indirmez.
  await request(app).put('/api/admin/medicines/settings').set(auth(admin)).send({ enrich_price_list: '0', enrich_controlled_lists: '0' });
});

test('kontrole tabi ilaç listesi: etken madde (Türkçe/İngilizce) veya marka ile eşleşir, kombine ilaç yalnızca markayla', () => {
  const { buildIndex, classify } = require('../src/services/medicines/enrichers/controlledLists');
  const { normalizeSearch: n } = require('../src/services/medicines/normalize');
  const index = buildIndex([{ name: 'ABSTRAL 100 MCG 10 DILALTI TABLET', substance: 'fentanyl' }, { name: 'ZALDIAR 37.5 MG', substance: 'tramadol kombine halde' }]);
  const med = (name, ingredient) => ({ normalized_name: n(name), normalized_ingredient: n(ingredient) });
  expect(classify(med('FENTANEST 500 MCG AMPUL', 'fentanil'), index)).toBe(true);   // İngilizce → Türkçe
  expect(classify(med('ABSTRAL 200 MCG DİLALTI TABLET', 'fentanil sitrat'), index)).toBe(true); // marka
  expect(classify(med('ZALDIAR FİLM TABLET', 'parasetamol ve tramadol hcl'), index)).toBe(true); // kombine, marka listede
  expect(classify(med('BAŞKA KOMBİNE TABLET', 'parasetamol ve tramadol hcl'), index)).toBe(false); // kombine, marka yok
  expect(classify(med('PAROL 500 MG TABLET', 'parasetamol'), index)).toBe(false);
  expect(classify(med('HAZIR ENJEKTÖR', 'serum fizyolojik'), index)).toBe(false); // genel kelime marka sayılmaz
});

test('ürün adından doz, farmasötik form ve paket çıkarılır', () => {
  const { parseProductName } = require('../src/services/medicines/parseProductName');
  expect(parseProductName('ONADRON 0.75 MG TABLET, 100 TABLET')).toEqual({ dosage: '0.75 MG', pharmaceuticalForm: 'Tablet', packageSize: '100 TABLET' });
  expect(parseProductName('PAROL 500 MG 20 TABLET')).toEqual({ dosage: '500 MG', pharmaceuticalForm: 'Tablet', packageSize: '20 TABLET' });
  expect(parseProductName('DUFEN 100MG/5ML PEDİATRİK SÜSPANSİYON, 100 ML')).toEqual({ dosage: '100MG/5ML', pharmaceuticalForm: 'Süspansiyon', packageSize: '100 ML' });
  expect(parseProductName('EYEFLOX 1 MG/ML + 0.25 MG/ML GÖZ DAMLASI, SÜSPANSİYON, 1 ADET').dosage).toBe('1 MG/ML + 0.25 MG/ML');
  expect(parseProductName('KSİLİDİN %5 MERHEM')).toEqual({ dosage: '%5', pharmaceuticalForm: 'Merhem', packageSize: null });
});

test('Türkçe normalizasyon, barkod ve fiyat ayrıştırma', () => {
  expect(normalizeSearch('PAROL')).toBe(normalizeSearch('Parol'));
  expect(normalizeSearch('parol')).toBe('parol');
  expect(normalizeSearch('İBUFEN')).toBe(normalizeSearch('ıbufen'));
  expect(normalizeSearch('Asetilsalisilik Asit / Şurup')).toBe('asetilsalisilik asit surup');
  expect(cleanBarcode('8699514090150')).toBe('8699514090150');
  expect(cleanBarcode(8699514090150)).toBe('8699514090150');
  expect(cleanBarcode('86995abc')).toBeNull();
  expect(cleanBarcode(':8683060090130')).toBe('8683060090130');
  expect(cleanBarcode('8699587013286​')).toBe('8699587013286');
  expect(parsePrice('1.234,56')).toBe(1234.56);
  expect(parsePrice('45,9')).toBe(45.9);
});

test("retired contract / active guard: yönetici olmayan kullanıcı içe aktarma ve senkronizasyon başlatamaz", async()=>{await assertRetired(["/api/admin/medicines/sync","/api/admin/medicines","/api/medicines","/api/admin/medicines/import","/api/medicines/search","/api/medicines/1/image"]);});

test("retired contract / active guard: senkronizasyon oluşturur, tekrarında kopya üretmez, değişeni günceller, çekileni pasife alır", async()=>{await assertRetired(["/api/admin/medicines/settings","/api/medicines/barcode/8699540154016","/api/medicines/barcode/8699514090150","/api/admin/medicines/import","/api/admin/medicines/sync","/api/medicines/search","/api/medicines/1/image"]);});

test("retired contract / active guard: barkod bulunamazsa standart hata döner; arama büyük/küçük harf ve yazım hatasına toleranslıdır", async()=>{await assertRetired(["/api/medicines/barcode/8690000000000","/api/medicines/search","/api/medicines","/api/admin/medicines/import","/api/admin/medicines/sync","/api/medicines/1/image"]);});

test("retired contract / active guard: manuel kayıt senkronizasyonda korunur; aynı barkod ikinci kez eklenemez", async()=>{await assertRetired(["/api/admin/medicines","/api/medicines/barcode/8691234567893","/api/admin/medicines/import","/api/admin/medicines/sync","/api/medicines/search","/api/medicines/1/image"]);});

test("retired contract / active guard: barkodlu fiyat listesi yüklenince fiyat ve reçete türü hemen uygulanır; barkodsuz liste reddedilir", async()=>{await assertRetired(["/api/admin/medicines/import","/api/medicines/barcode/8699525092310","/api/admin/medicines/sync","/api/medicines/search","/api/medicines/1/image"]);});

test("retired contract / active guard: piyasaya yeni giren ilaçlar ruhsat tarihine göre bugün / bu hafta / bu ay listelenir", async()=>{await assertRetired(["/api/admin/medicines","/api/medicines/new","/api/admin/medicines/import","/api/admin/medicines/sync","/api/medicines/search","/api/medicines/1/image"]);});

test("retired contract / active guard: görsel yükleme dosya imzasını denetler; doğrulanmamış uzak görsel onaylı sayılmaz", async()=>{await assertRetired(["/api/medicines/barcode/8699514090150","/api/medicines/1/image","/api/admin/medicines/1/image","/api/admin/medicines/1/image/cache","/api/admin/medicines/import","/api/admin/medicines/sync","/api/medicines/search"]);});
