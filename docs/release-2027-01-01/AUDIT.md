# Veniux denetimi — 25 Kasım 2026

Bu belge, 1 Ocak 2027 hedefi için depodaki **gerçek durumu** kanıtla yazar. Statüler kanıt olmadan yükseltilmez.

Statü sözlüğü: `NOT_IMPLEMENTED` · `IMPLEMENTED_UNTESTED` · `MOCK_TESTED` · `AUTOMATED_TESTED` · `SANDBOX_VERIFIED` · `REAL_DEVICE_VERIFIED` · `PRODUCTION_OBSERVED`.

## 1. Mimari (kodda doğrulandı)
- **Depo:** tek git deposu, dal `masaustu-2.4.40`. Çalışma ağacı temiz. Dizinler: `backend/` (Node/Express), `frontend/` (React + Vite), `shared/` (para, terazi, sayım, i18n yardımcıları), `desktop/` (Electron), `mobile/` (Android, Capacitor/Java), `website-php/` (site, müşteri paneli köprüsü), `yonetim-php/`, `api.veniux.com/` (lisans otoritesi, PHP), `tools/` (yayın, simülatör, i18n).
- **Veritabanı:** üç hedef. Masaüstünde SQLite, bulutta MariaDB/MySQL (canlı `veniu8e1_app`, 35 şema adımı, 181 tablo), testte her ikisi. Eklemeli MySQL yükseltici (`mysqlMigrator.upgradeAdditive`), SQLite migrasyonları `backend/src/database/migrations` (066 son).
- **Kimlik:** JWT, parolalar bcrypt, IP+e-posta bazlı giriş yavaşlatma, isteğe bağlı iki aşamalı doğrulama, kiracı (`tenant_id`) tabanlı yetki, depo kapsamı (`user_access_scopes`), merkezî lisans cihaz anahtarı (`x-veniux-device-token`). Site hesabıyla giriş köprüsü 25 Kasım'da eklendi (`siteAccountBridge`).
- **Para:** `shared/money.mjs` (TRY/AZN/USD/EUR/GBP), sunucuda tamsayı kuruş alanları; satış anlık görüntüsü `snapshot_json`.
- **Dağıtım:** Windows NSIS (`yayinla.py`), Android APK, bulut = Plesk Node.js (FTP ile `source.json`, `run stage`, `upgradeAdditive`). Otomatik production dağıtımı **yoktur**; her yayın elle tetiklenir.
- **CI:** yalnız `uptime.yml` (10 dakikada canlı adres denetimi). Test/lint/build işi **yoktu**; bu turda `ci.yml` eklendi (aşağıda).

## 2. Ölçülenler (bu turda çalıştırıldı)
| Kontrol | Sonuç |
|---|---|
| `npm audit --omit=dev` backend | 0 açık |
| `npm audit --omit=dev` frontend | 0 açık |
| `oxlint` backend | yalnız uyarı (ör. kullanılmayan `next` parametresi); hata yok |
| Backend jest (tam) | 198 dosya, 1430 test geçti (25 Kas) |
| Frontend/shared/simülatör `node --test` | 221 geçti, 0 kalan |
| Tür denetimi | **Yok** (proje JavaScript; TypeScript değil). `typecheck` betiği tanımlı değil |
| TODO/FIXME | 0 (kod tabanında işaretli yok; eksikler belgelerde) |

## 3. Özellik durumu (kanıtla)
Ayrıntı ve kanıt dosyaları: `INTEGRATION_MATRIX.md`.

| Alan | Durum | Kanıt / not |
|---|---|---|
| Mağaza→bulut eşitleme (satış, vardiya, gider) | AUTOMATED_TESTED | `storeSync.test.js` (10), `storeSyncFailures.test.js` (5): ağ kopması, yarıda 500, kayıp yanıt, 1200 ürün. 24 Kas'ta gerçek bulut hesabına tek satışlık gerçek HTTPS denemesi (SANDBOX_VERIFIED düzeyi, uzun süre yok) |
| Çevrimdışı kasa | AUTOMATED_TESTED (sunucu), IMPLEMENTED_UNTESTED (tarayıcı/service worker katmanı) | `offlineSaleService` testleri var; tarayıcı çevrimdışı akışı otomatik testte **yok**, Chrome'da elle denendi |
| Barkod sağlayıcı katmanı | AUTOMATED_TESTED | `barcodeProviders`, `sharedCatalog` testleri; Open Food Facts gerçek çağrı yok; Barcode Lookup anahtarsız |
| Terazi (seri port) | AUTOMATED_TESTED (sahte port + simülatör + kılavuz örnekleri) | `scalePort.test.mjs`, `scaleProtocols.test.mjs`; gerçek terazi yok |
| Zebra DataWedge | IMPLEMENTED_UNTESTED | `MainActivity.java` derlendi, cihazda/emülatörde çalıştırılmadı |
| Trendyol | MOCK_TESTED | 20 test; 25 Kas'ta resmî belgeyle uyum denetimi; sipariş yolu `/orders` (+ `/v2/orders` yedek) |
| Hepsiburada, N11 | MOCK_TESTED | `marketplaceProviders.test.js`; "DENENMEDİ" işaretli |
| Muhasebe CSV paketleri | AUTOMATED_TESTED | `accountingExport.test.js` (8) |
| Şablonla muhasebe doldurma | AUTOMATED_TESTED (uydurma şablonlarla) | `accountingTemplate.test.js` (6); gerçek Logo/Mikro/Paraşüt şablonu yok |
| e-Belge | IMPLEMENTED_UNTESTED (mükellef sorgusu, UBL taslağı); gönderim NOT_IMPLEMENTED | `edocumentService`, `ublTrService`; Uyumsoft yalnız test+mükellef |
| ÖKC | MOCK_TESTED (simülatör); markalar NOT_IMPLEMENTED | `ecrService`, `ecr/` çerçevesi; gerçek sürücü yok |
| Online mağaza | AUTOMATED_TESTED (sunucu); iyzico gerçek hesap yok | sipariş, stok, kapıda ödeme testleri |
| CRM | IMPLEMENTED (JSON çalışma alanı) | `workspace_collections`; yönetim/ilişki testleri sınırlı, `crmService`+`crm_*` tabloları kullanılmıyor (ölü kod) |
| Azerbaycanca | IMPLEMENTED (kısmi) | 1286 sözlük girişi, DOM çevirisi; yerli okuyucu yok |
| Giriş birleştirme | AUTOMATED_TESTED | gerçek PHP + Node HTTP testi (`siteBridgeWire.test.js`); canlı gerçek hesapla yok |

## 4. Bilinen riskler ve kusurlar
1. **Tür/CI açığı:** CI'da test koşmuyordu, tür denetimi yok → regresyonlar elle yakalanıyordu. `ci.yml` eklendi.
2. **Çevrimdışı kasa tarayıcı katmanı otomatik testsiz** (service worker, IndexedDB kuyruğu, önbellek sürüm yükseltmesi). En büyük doğrulama boşluğu.
3. **Uzun süreli gerçek mağaza kullanımı yok.** Eşitleme, yedek ve kasa bellek davranışı gerçek yük altında ölçülmedi (yalnız sentetik 205 satır, 1200 ürün).
4. **SKU kiracılar arası benzersiz** (düşük önem bilgi sızıntısı); veri taşıma gerektirir. `GUVENLIK-INCELEMESI-2026-11-24.md`.
5. **Sunucu mesajları Türkçe** (Azerbaycanca arayüzde bile). `moneyText` yalnız birim için.
6. **Ölü kod:** `crmService.js`, `crm_*` tabloları; eski `Products.jsx` (İngilizce sayfa).
7. **Üretimde ek sır:** `install.env` içinde site köprü anahtarı var; Plesk dışına çıkmamalı (git'te yok).
8. **Yedek geri yükleme onayı** Türkçe sabit cümle gerektirir (çeviriyle kırılmasın diye bilerek).
9. **Plesk elle yayın:** otomatik geri alma yok; her yayında dump + kaynak yedeği elle alınır.

## 5. Eksik testler (öncelik sırasıyla)
1. Tarayıcı çevrimdışı kasa E2E (Playwright, service worker).
2. Eşitleme yük testi: 1.000 ve 10.000 kayıt, süre ve bellek.
3. İstemci tarafı eşitleme kuyruğu kalıcılığı: uygulama/bilgisayar yeniden başlatma.
4. Çok kiracılı izolasyon: pazaryeri, muhasebe şablonu, köprü uçları için IDOR testleri.
5. Hepsiburada/N11 sözleşme testleri (resmî belgeden okunarak).
6. e-Belge UBL şema doğrulaması (resmî XSD ile).
7. Android emülatör/instrumentation (DataWedge sahte intent).
