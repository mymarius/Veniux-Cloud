# İlerleme kaydı

Son güncelleme: 25 Kasım 2026 (Sprint 1 başlangıcı). Her çalışma sonunda güncellenir.

## Test çalıştırmaları (gerçekten koşuldu)
| Tarih | Ortam | Komut | Sonuç | Kanıt |
|---|---|---|---|---|
| 25 Kas 2026 | Windows 10, Node 24, SQLite test DB | backend `jest --runInBand` (tam) | **198 dosya, 1430 test geçti, 0 kaldı**, 556 sn | `.local/full-backend-test.log` |
| 25 Kas 2026 | aynı | frontend + shared + simülatör `node --test` | **221 geçti, 0 kaldı** | konsol |
| 25 Kas 2026 | aynı | `npm audit --omit=dev` (backend, frontend) | 0 açık | konsol |
| 25 Kas 2026 | aynı | `oxlint` (backend) | yalnız uyarı | konsol |
| 25 Kas 2026 | aynı | eşitleme yük testi, 1.000 satış | geçti: oluşturma 34 sn, **eşitleme 0,69 sn**, 335 MB bellek, çift kayıt yok, yerel=bulut toplam | `storeSyncLoad.test.js` |
| 25 Kas 2026 | aynı | eşitleme yük testi, 10.000 satış | geçti: oluşturma 341 sn, **eşitleme 34 sn**, 435 MB bellek, çift kayıt yok, yerel=bulut toplam | `.local/sync-load-10000.log` |
| 25 Kas 2026 | aynı | `storeSync*.test.js` (10 + 5 + 4 yeni) | **19 geçti** | konsol |

**Yapılmadı / doğrulanmadı:** GitHub Actions üzerinde `ci.yml` çalıştırması (dosya yazıldı, bu ortamdan push yok, çalışmış gibi gösterilmez); MySQL jest (`test:mysql`) bu turda koşulmadı; tür denetimi (yok); E2E tarayıcı testleri (kurulu değil).

## Bu turda bulunanlar
-2. **Çevrimdışı kasa testleri (26 yeni):** `offlineStore.test.mjs` (5, gerçek IndexedDB API'si `fake-indexeddb` ile) ve `serviceWorker.test.mjs` (11, `public/sw.js` sahte `self/caches/fetch` ile). **Hata bulundu ve düzeltildi:** ürün listesi yazılırken hata olursa (ör. depolama dolarsa) eski liste silinip yenisi yarım kalıyordu (`offlineStore.js` işlemi iptal etmiyordu); artık işlem iptal ediliyor, eski liste korunuyor.
-3. **Yayın kapısı boşluğu bulundu ve düzeltildi:** yayın aracı yalnız `src/lib/*.test.mjs` koşuyordu; çevrimdışı, i18n, utils, paylaşılan (`shared/*.test.mjs`) ve donanım simülatörü testleri yayını engellemiyordu. Artık hepsi koşuluyor (frontend tarafı 278 test).
-1. **Test kirliliği:** 10.000 satırlık yük testi ortak test veritabanını 59 MB'a şişirince `backupRecovery.test.js` (18 test) 5 sn zaman aşımına düştü ve sürüm aracı yayını durdurdu (hiçbir şey yayınlanmadı, sürüm geri alındı). Test veritabanı silinince hepsi geçti. Kalıcı çözüm: yük testi yalnızca `SYNC_LOAD` ayarlıyken çalışır.
0. **Veri kaybı riski bulundu ve düzeltildi:** `pushOnce` yanıtın yalnız `ok` (2xx) olmasına bakıyordu. Bulut yanıtı olmayan bir 200 sayfası (ör. Wi-Fi giriş/ara sayfa, yarım kesilmiş JSON) satışları buluta ulaşmamış olduğu halde "gönderildi" işaretleyip kuyruktan düşürürdü. Artık yanıt gövdesi JSON olmalı ve `added+updated+unchanged` gönderilen satış sayısına eşit olmalı; aksi halde hata kaydedilir ve kayıtlar bekler. Testler: `storeSyncResponses.test.js` (4: HTML ara sayfa, kesik/eksik/uyuşmayan JSON, 502/503, iptal edilmiş anahtar).
1. **İstek güvenlik duvarı (`requestFirewall`):** aynı IP'den 10 sn'de 600 istek (6000/dk) aşılınca 429. Yük testinde 595. ve 807. satışta çıktı. Gerçek kasada tek kullanıcı için sorun değil; ama aynı IP'den (mağaza NAT'ı) çok kasa + toplu işlem yapılırsa 429 görülebilir. **Karar gerekir:** sınır mağaza başına mı olmalı, yoksa kasa uçları (`/scanner/sale`) için ayrı bir bölme mi. Şimdilik değiştirilmedi.
2. CI yoktu → `ci.yml` eklendi (çalışması doğrulanmadı).
3. `AUDIT.md` §4 riskleri.

## Özellik tablosu
| Özellik | Statü | Yazıldı | Testler | Geçti/Kaldı | Gerçek test durumu | Kalan |
|---|---|---|---|---|---|---|
| Mağaza→bulut eşitleme | AUTOMATED_TESTED | evet | 15 + 5 + yük | hepsi geçti | tek satır gerçek bulut (24 Kas) | uzun süreli gerçek mağaza, istemci kuyruğu yeniden başlatma, iki mağaza aynı ürün, fiyat değişimi sırasında satış |
| Çevrimdışı kasa | IMPLEMENTED_UNTESTED (tarayıcı) | evet | sunucu tarafı var | geçti | Chrome elle | Playwright E2E, kuyruk kalıcılığı |
| Barkod sağlayıcı | AUTOMATED_TESTED | evet | mevcut | geçti | yok | OFF gerçek şema sözleşmesi, Barcode Lookup anahtarı |
| Terazi | AUTOMATED_TESTED | evet | 6 + protokol | geçti | yok (cihaz) | gerçek cihaz |
| DataWedge | IMPLEMENTED_UNTESTED | evet | yok | — | yok | emülatör/instrumentation |
| Trendyol | MOCK_TESTED | evet | 20 | geçti | yok (hesap) | stage hesabı |
| Hepsiburada, N11 | MOCK_TESTED | evet | marketplaceProviders | geçti | yok | belge okuma, sözleşme testleri, hesap |
| Muhasebe CSV + şablon | AUTOMATED_TESTED | evet | 8 + 6 | geçti | yok (şablon) | gerçek şablonlar |
| e-Belge | gönderim NOT_IMPLEMENTED | taslak/test | mevcut | geçti | yok | entegratör, mali mühür |
| ÖKC | MOCK_TESTED | çerçeve+simülatör | mevcut | geçti | yok | marka SDK |
| Online mağaza | AUTOMATED_TESTED | evet | mevcut | geçti | yok (iyzico) | iyzico sandbox |
| CRM | IMPLEMENTED_UNTESTED | evet | sınırlı | — | — | CRUD/yetki testleri |
| Azerbaycanca | IMPLEMENTED_UNTESTED | kısmi | 7 | geçti | canlı gözle bakıldı | yerli okuyucu, sunucu mesajları |

## 26 Kasım: eşitleme senaryoları
- `storeSyncScenarios.test.js` (6): yarıda kapanma sonrası devam, iki mağaza aynı barkod, satış sırasında bulut fiyatı değişimi, yerel fiyat/bulut kazanır, çakışan gönderim, çakışan ürün çekme. Hepsi sahte ağ + SQLite ile; gerçek mağaza ve MySQL değil.
- **Bulunan ve düzeltilen:** aynı mağaza için iki gönderim/ürün çekme aynı anda çalışabiliyordu (aynı satışlar iki kez yollanıyordu). Artık mağaza başına tek iş çalışır.
- Bilinen davranış: yerelde elle değiştirilen fiyat, bulutta o ürün değişene kadar korunur.

## Yük sonuçları (ortam: Windows 10, tek makine, SQLite, sahte ağ)
| Satış | Oluşturma | Eşitleme | Bellek (RSS) | Sonuç |
|---|---|---|---|---|
| 1.000 | 34 sn | 0,69 sn | 335 MB | yerel=bulut, çift kayıt yok |
| 10.000 | 341 sn | 34 sn | 435 MB | yerel=bulut, çift kayıt yok |

Not: "oluşturma" süresi 20 ms'lik yapay bekleme içerir (istek güvenlik duvarı 10 sn'de 600 isteği aştırmaz). Eşitleme doğrusal ölçekleniyor (~3,4 ms/satış). Gerçek mağaza ağı, MySQL ve gecikme dahil değil.

## Bir sonraki adımlar
1. Eşitleme: istemci kuyruğu yeniden başlatma, iki mağaza aynı ürünü güncellesin, fiyat değişimi sırasında satış.
2. Çevrimdışı kasa: Playwright kurulumu ve service worker E2E.
3. `requestFirewall` kararı (yukarı).
4. Hepsiburada, N11, iyzico resmî belgelerinin okunması.

## 26 Kas güncellemesi — pazaryeri ve iyzico belge uyumu
- Hepsiburada, N11 ve iyzico belgeleri okundu (Hepsiburada otomatik istemciye 403 verdi, okunamadı). Ayrıntılı karşılaştırma: `TEST_REPORT_MARKETPLACE_PAYMENT.md`.
- **Düzeltilen gerçek sorunlar:** (1) iyzico: geri çağırma gelmeyen ödeme, süre dolunca sorulmadan iptal ediliyordu; (2) iyzico: gün sonundan sonra iptal reddedilince iade denenmiyordu; (3) N11: `UnSupplied` paketinde stok düşülü kalıyordu; (4) N11: stok görevi sonucu hiç sorulmuyordu; (5) görev sonucu sorgusu hata verirse sipariş eşitlemesi duruyordu.
- Uygulanmadı: N11 iade/parçalı iptal (SOAP), iyzico yanıt imzası doğrulaması ve webhook, kısmi iade. Nedenleri raporda.
