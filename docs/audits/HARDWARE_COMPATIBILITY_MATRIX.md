# Donanım uyumluluk matrisi

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

Yeni laboratuvar: `.local/hardware-lab-runs/run-709792c5baa3704345e40234`. **162 PASS, 0 FAIL, 5 BLOCKED, 5 NOT TESTED**. Ayrıntı: `docs/VENIUX_HARDWARE_TEST_REPORT.md`. Bu sonuç 736 API testine eklenerek benzersiz test toplamı yapılmaz.

| Bileşen | Kaynak / mevcut durum | Sanal doğrulama | Fiziksel kabul |
|---|---|---|---|
| USB/Bluetooth HID barkod | `shared/scanner.mjs:1`; odaklı karakter/sonlandırıcı işlemesi | PASS — EAN/UPC/Code128/GS1/DataMatrix metni, sıfırlar, tekrar/hata; TCP/API satış ayrıca testli | NOT TESTED — marka/model, USB/Bluetooth gecikmesi ve bağlantı kopması |
| Web Serial / COM köprü | `scanner-bridge/server.cjs:1`; isteğe bağlı loopback köprü | PASS — sanal port/taşıma, kimlik ve hata/kapanış testleri | NOT TESTED — gerçek port/sürücü/parity/baud/model |
| Kamera / optik QR-barkod | `mobile/android/src/com/veniux/companion/MainActivity.java:1`; ZXing ve WebView | PASS — Java ZXing sentetik PNG okur; Android kaynak derlenir | PASS — Java ZXing sentetik PNG okur; Android kaynak derlenir. **12 Kasım 2026 gerçek cihaz (Redmi Note 15 Pro 25100RA69G, Android 16, WebView 156, Veniux 2.4.69):** `getUserMedia` arka kamera akışı canlı (720×1280, 29 kare/sn, `facingMode=environment`), fener `torch` kısıtı çalıştı (kare parlaklığı değişti), cihazın `BarcodeDetector`'ı sentetik EAN-13'ü doğru okudu (`8690000000012`), desteklenen biçimler: aztec, code_128, code_39, code_93, codabar, data_matrix, ean_13, ean_8, itf, pdf417, qr_code, upc_a, upc_e | PARTIAL — gerçek cihazda kamera + okuyucu hattı doğrulandı. Gerçek basılı etiketin kamerayla okutulması, ışık koşulları ve başka marka/model NOT TESTED (deneme sırasında telefon karanlık yüzeye bakıyordu) 
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

## 12 Kasım 2026 — gerçek telefon (USB hata ayıklama + WebView CDP)

Cihaz: Redmi Note 15 Pro (25100RA69G), Android 16 / API 36, HyperOS. Ölçümler `adb` ve WebView uzaktan hata ayıklama ile alındı; test için geçici bir derleme kullanıldı (yayına girmedi). Müşteri verisi kullanılmadı.

| Kontrol | Sonuç |
|---|---|
| Uygulama güncellemesi (2.4.67 → 2.4.69) kuruldu, imza eşleşti | PASS |
| Kamera akışı (arka kamera, 29 kare/sn) ve fener | PASS |
| `BarcodeDetector` ile sentetik EAN-13 okuma | PASS |
| Yapay zeka asistanı üst bant düğmesinden açılıyor, uyarı listesi hatasız | PASS |
| Üst başlık yüksekliği (86 px) ve asistan paneli tam ekran (düzeltme sonrası) | PASS |
| Android 13+ bildirim izni penceresi (`GrantPermissionsActivity`) açıldı, izin verildi | PASS |
| Yerel bildirim gönderildi ve bildirim gölgesinde göründü (`veniux-alerts` kanalı) | PASS |
| Gerçek basılı barkod etiketinin kamerayla okunması | NOT TESTED |
| Uygulama kapalıyken bildirim | NOT SUPPORTED (sunucu tarafı push altyapısı yok) |
| Android ön plan servisi / arka planda yoklama | NOT TESTED |
