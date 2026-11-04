# Donanım uyumluluk matrisi

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

Yeni laboratuvar: `.local/hardware-lab-runs/run-709792c5baa3704345e40234`. **162 PASS, 0 FAIL, 5 BLOCKED, 5 NOT TESTED**. Ayrıntı: `docs/VENIUX_HARDWARE_TEST_REPORT.md`. Bu sonuç 736 API testine eklenerek benzersiz test toplamı yapılmaz.

| Bileşen | Kaynak / mevcut durum | Sanal doğrulama | Fiziksel kabul |
|---|---|---|---|
| USB/Bluetooth HID barkod | `shared/scanner.mjs:1`; odaklı karakter/sonlandırıcı işlemesi | PASS — EAN/UPC/Code128/GS1/DataMatrix metni, sıfırlar, tekrar/hata; TCP/API satış ayrıca testli | NOT TESTED — marka/model, USB/Bluetooth gecikmesi ve bağlantı kopması |
| Web Serial / COM köprü | `scanner-bridge/server.cjs:1`; isteğe bağlı loopback köprü | PASS — sanal port/taşıma, kimlik ve hata/kapanış testleri | NOT TESTED — gerçek port/sürücü/parity/baud/model |
| Kamera / optik QR-barkod | `mobile/android/src/com/veniux/companion/MainActivity.java:1`; ZXing ve WebView | PASS — Java ZXing sentetik PNG okur; Android kaynak derlenir | BLOCKED — Emulator/ADB yok; gerçek kamera, ışık ve Android izinleri NOT TESTED |
| Android el terminali fiziksel tarama tuşu | Java/WebView ve HID akışı var; üretici SDK profili kanıtlanmadı | Kısmen — yalnız ortak/API akışları ve derleme | Üretici SDK/model/lisans ve gerçek tuş olayı gerekli |
| 58 / 80 mm fiş | `backend/src/services/retailReceipt.js:9`; HTML renderer | PASS — KDV/matrah/toplam, Türkçe/uzun ad ve iki genişlik sözleşmesi; HTML çıktıları koşuda mevcut | NOT TESTED — gerçek DPI, termal kafa, sürücü, marj, kağıt bitmesi/kesici |
| ESC/POS | `frontend/src/printing/receiptPrinter.js:2`; adaptör kaydı için arayüz, hazır yerleşik ESC/POS sürücüsü yok | BLOCKED — HTML üretimi byte komut/kod sayfası doğrulaması değildir | Model adaptörü, codepage ve fiziksel baskı gerekli |
| Etiket yazıcısı/istasyonu | `desktop/printing.cjs:10`; claim ve iş günlüğü, Electron OS kuyruğu | PASS — sanal print adapter ve mükerrer iş/tenant testleri | NOT TESTED — OS submitted fiziksel kağıt teslimi değildir |
| Para çekmecesi | Bağlı doğrulanmış kick/drawer adaptörü yok; printer adapter arayüzü yeterli kanıt değil | NOT TESTED / EKSİK | Model voltaj/pin/kick komutu, güvenli yetki ve gerçek açılma gerekli |
| Terazi | `shared/scaleAdapter.mjs:4`; güvenilir taşıma/decode enjekte edilir; model sürücüsü yok | PASS — ortak stabil/taze/aşırı ağırlık doğrulaması; genel ScaleAdapter davranışının tamamı bu paketle doğrulanmış sayılmaz | Kalibrasyon, sertifikalı model, protokol, gerçek seri/TCP ve dara gerekli |
| Ödeme terminali / ÖKC | `backend/src/services/retailExternalService.js:9`; adaptör sınırı/journal, varsayılan profiles boş | PASS — test adapter idempotency/unknown yerel kayıt; banka ile mutabakat yok | BLOCKED — üretici/banka test hesabı, yetki ve cihaz |

## Bulgular ve kabul kapıları

| ID / önem | Kanıt / tekrar üretme | Önerilen çözüm |
|---|---|---|
| HW-01 P1 — fiziksel uyumluluk matrisi boş | `environment.json`: physical_device_tested=false; gerçek cihaz koşusu bulunmuyor | Her cihazın marka/model/firmware/sürücü/OS sürümü, bağlantı tipi, test fişi ve operatör kabulünü kaydet |
| HW-02 P1 — baskı işinin teslim sınırı | `frontend/src/printing/receiptPrinter.js:8`, `desktop/printing.cjs:14` | Kağıt bitmesi, offline, kablo çekme, tekrar baskı testleri; 'gönderildi' ile 'basıldı'yı ayır |
| HW-03 P1 — mali cihaz ve çekmece sürücüsü eksik | `backend/src/services/retailExternalService.js:9`; printer adapter listesi | Gerçek SDK alınmadan donanım destekli POS iddiası yayımlama; adaptör işi ayrı onaya tabi |

Fiziksel cihaz başarı oranı hesaplanmadı. Temiz Windows kurulumu ve Android Emulator bu sanal PASS sayısına dahil değildir.
