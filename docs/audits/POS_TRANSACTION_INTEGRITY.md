# POS işlem bütünlüğü — Production Readiness 3.0

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

## Yeni çalıştırma kanıtı

İlk mevcut paket: `run-88a07e9e266f8d5b`, 167 API / 17 grup PASS; 43 sözleşme testi PASS. Geniş son API koşusu: `.local/customer-experience/run-d510c13891ac5689`, **736 PASS / 0 FAIL / 0 SKIP, 92 grup**. Bu sayılar birbirine eklenmez; 167 test geniş kümenin alt kümesidir.

Yeni testler: `backend/tests/productionReadiness.test.js:1`; sekiz test, tamamı PASS. Tüm adlar ve sonuçlar `.local/production-readiness-3/api-test-inventory.json` içinde.

## Mekanizmalar

- `backend/src/services/retailDailyService.js:25`: tenant + scope + işlem anahtarı; actor dahil istek hash'i ve sonuç aynı DB transaction'ında yazılır. Aynı anahtar/farklı içerik veya kullanıcı 409. **Yeni anahtar aynı fiziksel işlemi otomatik tanımaz**; istemci aynı anahtarı korumalıdır.
- `backend/src/services/retailDailyService.js:22`: MySQL tenant satır kilidi; stok satırlarında FOR UPDATE ve koşullu miktar azaltma. `backend/src/config/database.js:115`: BEGIN / COMMIT / ROLLBACK. SQLite yazma kuyruğu ve BEGIN IMMEDIATE. Gerçek MySQL yarış testi bu ortamda çalıştırılmadı.
- `frontend/src/pages/RetailPos.jsx:66`: istek öncesinde sessionStorage'a anahtar/payload; belirsiz yanıtta sale-status sorgusu, aynı anahtarla tekrar. `shared/pendingSale.mjs:1`: taslak sözleşmesi. Bu mekanizma disk üzerinde kalıcı, cihazlar arası offline outbox değildir; sekme/OS kaybı ayrı risktir.
- `backend/src/services/retailDailyService.js:11`: iki ondalık tutar sınırı; satır/indirim/oran dağıtımı integer kuruş ve BigInt. `backend/src/services/retailVatService.js:1`: tarihsel oran/matrah snapshot'ı. Referans unit_price ve DB rapor alanları ondalık olabildiği için bütün DB alanları integer diye sunulmaz.

## Gerçek API + izole SQLite senaryoları

| Kontrol | Durum / gerçek sonuç | Dosya ve tekrar üretme |
|---|---|---|
| Tekrarlanan barkodlar | PASS — 2+2 miktar/3 stok atomik 409; 1+2 miktar başarılı, stok 0 | `backend/tests/productionReadiness.test.js:36`; readiness-only |
| Aynı satış eşzamanlı iki gönderim | PASS — tek sale_id, tek stok düşümü; payload değişikliği 409 | `backend/tests/retailCritical.test.js:10`; all-api |
| İki kasiyer son stok yarışı | PASS — 201 + 409, tek satış/hareket | `backend/tests/retailCritical.test.js:9`; all-api |
| İstek tamamlanmadan TCP kopması | PASS — loopback HTTP soketi eksik JSON gövdesinde kapandı; 0 satış, stok 3; aynı anahtarla retry 201 | `backend/tests/productionReadiness.test.js:10`; readiness-only |
| Commit sonrası yanıt kaybı | PASS — res.end öncesi gerçek soket kapatıldı; istemci bağlantı hatası aldı; kayıt 1/stok 2; status + replay aynı sale_id | `backend/tests/productionReadiness.test.js:16`; readiness-only |
| Stok yazıldıktan sonra kalıcılık hatası | PASS — retail_sales INSERT öncesi hata; pos_sales, stok hareketi ve anahtar geri alındı; aynı anahtarla retry tek satış | `backend/tests/productionReadiness.test.js:25`; readiness-only |
| Kısmi/tam iade ve iptal | PASS — miktar/ödeme/KDV ve özgün lot/stock allocations; replay tek iade | `backend/tests/retailCritical.test.js:1`, `backend/tests/retailVat.test.js:1`, `backend/tests/wmsLotOperations.test.js:1` |
| Vardiya kapanış yarışı | PASS — satış önceyse kapanış hesabına dahil, kapanış önceyse satış 409; kapalı vardiyaya yeni satış yok | `backend/tests/retailShift.test.js:18`; all-api |
| Negatif/yetersiz stok ve hatalı fiyat | PASS — mevcut retail/critical/daily doğrulamaları; stok koşullu azaltılır, tüm yazımlar transaction içinde | `backend/src/services/retailDailyService.js:100`, `backend/tests/retailDaily.test.js:1` |
| KDV dahil/hariç, indirim, kuruş, iade | PASS — 19 KDV testi; 58/80 renderer, tam kümülatif iade, BigInt dağılım | `backend/tests/retailVat.test.js:1` |
| Tartılı ürün doğrulaması | PASS — gerçek API'de negatif/NaN/boolean/aşırı küçük miktar reddi; mevcut kg/litre ve manual quantity testleri | `backend/tests/productionReadiness.test.js:40`, `backend/tests/retailPro.test.js:1` |
| Gerçek banka onayı öncesi/sonrası kablo çekme | NOT TESTED — bağlı banka/ÖKC adaptörü yok. Yukarıdaki TCP testi **yerel satış kaydıdır**, banka provizyonu değildir | `backend/src/services/retailExternalService.js:4`; üretici sandbox + cihaz gerekli |

## Açık riskler

| ID / önem | Kanıt | Tekrar üretme / çözüm |
|---|---|---|
| TX-01 P1 — banka ile satışın uçtan uca atomikliği yok | `backend/src/services/retailExternalService.js:9`; kart satırı yerel ödeme beyanı | Gerçek adaptör yapılandırılmadan capabilities configured=false; banka sandbox'ı, provizyon/iade ve gün sonu mutabakatını ayrı onaylı projede tamamla |
| TX-02 P1 — harici durum sorgusu süre sınırı yok | `backend/src/services/retailExternalService.js:32`; await adapter.status süresiz | Bitmeyen status Promise'i sorguyu tutabilir. Gerçek adaptör öncesi abort/timeout, unknown korunması ve geç yanıt sözleşmesini test et. Ödeme davranışı riskli olduğundan bu görevde değiştirilmedi |
| TX-03 P1 — MySQL/çok süreç yarış kabulü yok | `backend/src/services/retailDailyService.js:22`; mevcut koşu SQLite | Ayrı boş MySQL, iki Node süreci ve iki kasa ile aynı son stok/idempotency/close yarışını tekrarla; MySQL DDL veya canlı DB bu görevde çalıştırılmadı |
| TX-04 P1 — offline satış/senkronizasyon tamamlanmamış | `shared/pendingSale.mjs:1`, `backend/src/services/centralLicense.js:19` | Merkezi lisans erişimsizken fail-closed; ağ kesintisinde kesintisiz satış diye pazarlama. Kalıcı outbox ve çatışma politikasını mimari onaydan sonra tasarla |
| TX-05 P2 — anahtar ömrü ve sekme kaybı sınırı | `frontend/src/pages/RetailPos.jsx:66`, `desktop/updater.js:11` | Uygulama/sekme kapanması ve güncelleme esnası pending işlemi paketli ortamda doğrula; kalıcı kurtarma politikası olmadan cihaz çökmesi garantisi verme |

## Güvenli düzeltme

Satış/ödeme/stok motoruna davranış değişikliği yapılmadı. Test düzeneğinde ilk TCP kesinti koşulu Express req.url değiştiği için yanlış noktayı seçmişti; koşul router'a girişten önce sabitlendi. Bu ilk test hatası ürün kusuru gibi sayılmadı, başarısız koşu saklandı (`run-04c2e7043cce4db7`).
