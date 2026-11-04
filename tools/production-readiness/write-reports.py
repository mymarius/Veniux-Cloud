"""Compile this audit's evidence into seven reviewable reports, without secrets."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/audits'
EVIDENCE = '.local/production-readiness-3'

def ref(file, needle=None):
    text = (ROOT / file).read_text(encoding='utf-8-sig')
    line = 1 if needle is None else next(i for i, s in enumerate(text.splitlines(), 1) if needle in s)
    return f'`{file}:{line}`'

def write(name, text):
    (DOC / name).write_text(text.strip() + '\n', encoding='utf-8')

date = '18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim)'
common = f'''Tarih: {date}. Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.
'''

write('POS_TRANSACTION_INTEGRITY.md', f'''
# POS işlem bütünlüğü — Production Readiness 3.0

{common}
## Yeni çalıştırma kanıtı

İlk mevcut paket: `run-88a07e9e266f8d5b`, 167 API / 17 grup PASS; 43 sözleşme testi PASS. Geniş son API koşusu: `.local/customer-experience/run-d510c13891ac5689`, **736 PASS / 0 FAIL / 0 SKIP, 92 grup**. Bu sayılar birbirine eklenmez; 167 test geniş kümenin alt kümesidir.

Yeni testler: {ref('backend/tests/productionReadiness.test.js')}; sekiz test, tamamı PASS. Tüm adlar ve sonuçlar `{EVIDENCE}/api-test-inventory.json` içinde.

## Mekanizmalar

- {ref('backend/src/services/retailDailyService.js', 'async function idempotent')}: tenant + scope + işlem anahtarı; actor dahil istek hash'i ve sonuç aynı DB transaction'ında yazılır. Aynı anahtar/farklı içerik veya kullanıcı 409. **Yeni anahtar aynı fiziksel işlemi otomatik tanımaz**; istemci aynı anahtarı korumalıdır.
- {ref('backend/src/services/retailDailyService.js', 'async function lock')}: MySQL tenant satır kilidi; stok satırlarında FOR UPDATE ve koşullu miktar azaltma. {ref('backend/src/config/database.js', 'const transaction =')}: BEGIN / COMMIT / ROLLBACK. SQLite yazma kuyruğu ve BEGIN IMMEDIATE. Gerçek MySQL yarış testi bu ortamda çalıştırılmadı.
- {ref('frontend/src/pages/RetailPos.jsx', 'async function checkout')}: istek öncesinde sessionStorage'a anahtar/payload; belirsiz yanıtta sale-status sorgusu, aynı anahtarla tekrar. {ref('shared/pendingSale.mjs')}: taslak sözleşmesi. Bu mekanizma disk üzerinde kalıcı, cihazlar arası offline outbox değildir; sekme/OS kaybı ayrı risktir.
- {ref('backend/src/services/retailDailyService.js', 'function cents')}: iki ondalık tutar sınırı; satır/indirim/oran dağıtımı integer kuruş ve BigInt. {ref('backend/src/services/retailVatService.js')}: tarihsel oran/matrah snapshot'ı. Referans unit_price ve DB rapor alanları ondalık olabildiği için bütün DB alanları integer diye sunulmaz.

## Gerçek API + izole SQLite senaryoları

| Kontrol | Durum / gerçek sonuç | Dosya ve tekrar üretme |
|---|---|---|
| Tekrarlanan barkodlar | PASS — 2+2 miktar/3 stok atomik 409; 1+2 miktar başarılı, stok 0 | {ref('backend/tests/productionReadiness.test.js', "test('repeated scan")}; readiness-only |
| Aynı satış eşzamanlı iki gönderim | PASS — tek sale_id, tek stok düşümü; payload değişikliği 409 | {ref('backend/tests/retailCritical.test.js', "test('çift gönderim")}; all-api |
| İki kasiyer son stok yarışı | PASS — 201 + 409, tek satış/hareket | {ref('backend/tests/retailCritical.test.js', "test('iki gerçek")}; all-api |
| İstek tamamlanmadan TCP kopması | PASS — loopback HTTP soketi eksik JSON gövdesinde kapandı; 0 satış, stok 3; aynı anahtarla retry 201 | {ref('backend/tests/productionReadiness.test.js', "test('real TCP disconnect")}; readiness-only |
| Commit sonrası yanıt kaybı | PASS — res.end öncesi gerçek soket kapatıldı; istemci bağlantı hatası aldı; kayıt 1/stok 2; status + replay aynı sale_id | {ref('backend/tests/productionReadiness.test.js', "test('real TCP response")}; readiness-only |
| Stok yazıldıktan sonra kalıcılık hatası | PASS — retail_sales INSERT öncesi hata; pos_sales, stok hareketi ve anahtar geri alındı; aynı anahtarla retry tek satış | {ref('backend/tests/productionReadiness.test.js', "test('failure after stock")}; readiness-only |
| Kısmi/tam iade ve iptal | PASS — miktar/ödeme/KDV ve özgün lot/stock allocations; replay tek iade | {ref('backend/tests/retailCritical.test.js')}, {ref('backend/tests/retailVat.test.js')}, {ref('backend/tests/wmsLotOperations.test.js')} |
| Vardiya kapanış yarışı | PASS — satış önceyse kapanış hesabına dahil, kapanış önceyse satış 409; kapalı vardiyaya yeni satış yok | {ref('backend/tests/retailShift.test.js', "test('satış ve kapanış yarışı")}; all-api |
| Negatif/yetersiz stok ve hatalı fiyat | PASS — mevcut retail/critical/daily doğrulamaları; stok koşullu azaltılır, tüm yazımlar transaction içinde | {ref('backend/src/services/retailDailyService.js', 'for(const [id,qty]')}, {ref('backend/tests/retailDaily.test.js')} |
| KDV dahil/hariç, indirim, kuruş, iade | PASS — 19 KDV testi; 58/80 renderer, tam kümülatif iade, BigInt dağılım | {ref('backend/tests/retailVat.test.js')} |
| Tartılı ürün doğrulaması | PASS — gerçek API'de negatif/NaN/boolean/aşırı küçük miktar reddi; mevcut kg/litre ve manual quantity testleri | {ref('backend/tests/productionReadiness.test.js', 'test.each')}, {ref('backend/tests/retailPro.test.js')} |
| Gerçek banka onayı öncesi/sonrası kablo çekme | NOT TESTED — bağlı banka/ÖKC adaptörü yok. Yukarıdaki TCP testi **yerel satış kaydıdır**, banka provizyonu değildir | {ref('backend/src/services/retailExternalService.js', 'const adapters=')}; üretici sandbox + cihaz gerekli |

## Açık riskler

| ID / önem | Kanıt | Tekrar üretme / çözüm |
|---|---|---|
| TX-01 P1 — banka ile satışın uçtan uca atomikliği yok | {ref('backend/src/services/retailExternalService.js', 'const capabilities=')}; kart satırı yerel ödeme beyanı | Gerçek adaptör yapılandırılmadan capabilities configured=false; banka sandbox'ı, provizyon/iade ve gün sonu mutabakatını ayrı onaylı projede tamamla |
| TX-02 P1 — harici durum sorgusu süre sınırı yok | {ref('backend/src/services/retailExternalService.js', 'async function inspect')}; await adapter.status süresiz | Bitmeyen status Promise'i sorguyu tutabilir. Gerçek adaptör öncesi abort/timeout, unknown korunması ve geç yanıt sözleşmesini test et. Ödeme davranışı riskli olduğundan bu görevde değiştirilmedi |
| TX-03 P1 — MySQL/çok süreç yarış kabulü yok | {ref('backend/src/services/retailDailyService.js', 'async function lock')}; mevcut koşu SQLite | Ayrı boş MySQL, iki Node süreci ve iki kasa ile aynı son stok/idempotency/close yarışını tekrarla; MySQL DDL veya canlı DB bu görevde çalıştırılmadı |
| TX-04 P1 — offline satış/senkronizasyon tamamlanmamış | {ref('shared/pendingSale.mjs')}, {ref('backend/src/services/centralLicense.js', 'async function verify')} | Merkezi lisans erişimsizken fail-closed; ağ kesintisinde kesintisiz satış diye pazarlama. Kalıcı outbox ve çatışma politikasını mimari onaydan sonra tasarla |
| TX-05 P2 — anahtar ömrü ve sekme kaybı sınırı | {ref('frontend/src/pages/RetailPos.jsx', 'savePendingSale(sessionStorage')}, {ref('desktop/updater.js', 'autoUpdater.disableDifferentialDownload')} | Uygulama/sekme kapanması ve güncelleme esnası pending işlemi paketli ortamda doğrula; kalıcı kurtarma politikası olmadan cihaz çökmesi garantisi verme |

## Güvenli düzeltme

Satış/ödeme/stok motoruna davranış değişikliği yapılmadı. Test düzeneğinde ilk TCP kesinti koşulu Express req.url değiştiği için yanlış noktayı seçmişti; koşul router'a girişten önce sabitlendi. Bu ilk test hatası ürün kusuru gibi sayılmadı, başarısız koşu saklandı (`run-04c2e7043cce4db7`).
''')

write('HARDWARE_COMPATIBILITY_MATRIX.md', f'''
# Donanım uyumluluk matrisi

{common}
Yeni laboratuvar: `.local/hardware-lab-runs/run-709792c5baa3704345e40234`. **162 PASS, 0 FAIL, 5 BLOCKED, 5 NOT TESTED**. Ayrıntı: `docs/VENIUX_HARDWARE_TEST_REPORT.md`. Bu sonuç 736 API testine eklenerek benzersiz test toplamı yapılmaz.

| Bileşen | Kaynak / mevcut durum | Sanal doğrulama | Fiziksel kabul |
|---|---|---|---|
| USB/Bluetooth HID barkod | {ref('shared/scanner.mjs')}; odaklı karakter/sonlandırıcı işlemesi | PASS — EAN/UPC/Code128/GS1/DataMatrix metni, sıfırlar, tekrar/hata; TCP/API satış ayrıca testli | NOT TESTED — marka/model, USB/Bluetooth gecikmesi ve bağlantı kopması |
| Web Serial / COM köprü | {ref('scanner-bridge/server.cjs')}; isteğe bağlı loopback köprü | PASS — sanal port/taşıma, kimlik ve hata/kapanış testleri | NOT TESTED — gerçek port/sürücü/parity/baud/model |
| Kamera / optik QR-barkod | {ref('mobile/android/src/com/veniux/companion/MainActivity.java')}; ZXing ve WebView | PASS — Java ZXing sentetik PNG okur; Android kaynak derlenir | BLOCKED — Emulator/ADB yok; gerçek kamera, ışık ve Android izinleri NOT TESTED |
| Android el terminali fiziksel tarama tuşu | Java/WebView ve HID akışı var; üretici SDK profili kanıtlanmadı | Kısmen — yalnız ortak/API akışları ve derleme | Üretici SDK/model/lisans ve gerçek tuş olayı gerekli |
| 58 / 80 mm fiş | {ref('backend/src/services/retailReceipt.js', 'const w=')}; HTML renderer | PASS — KDV/matrah/toplam, Türkçe/uzun ad ve iki genişlik sözleşmesi; HTML çıktıları koşuda mevcut | NOT TESTED — gerçek DPI, termal kafa, sürücü, marj, kağıt bitmesi/kesici |
| ESC/POS | {ref('frontend/src/printing/receiptPrinter.js', 'const adapters=')}; adaptör kaydı için arayüz, hazır yerleşik ESC/POS sürücüsü yok | BLOCKED — HTML üretimi byte komut/kod sayfası doğrulaması değildir | Model adaptörü, codepage ve fiziksel baskı gerekli |
| Etiket yazıcısı/istasyonu | {ref('desktop/printing.cjs', "handle('label-print-job'")}; claim ve iş günlüğü, Electron OS kuyruğu | PASS — sanal print adapter ve mükerrer iş/tenant testleri | NOT TESTED — OS submitted fiziksel kağıt teslimi değildir |
| Para çekmecesi | Bağlı doğrulanmış kick/drawer adaptörü yok; printer adapter arayüzü yeterli kanıt değil | NOT TESTED / EKSİK | Model voltaj/pin/kick komutu, güvenli yetki ve gerçek açılma gerekli |
| Terazi | {ref('shared/scaleAdapter.mjs', 'export class ScaleAdapter')}; güvenilir taşıma/decode enjekte edilir; model sürücüsü yok | PASS — ortak stabil/taze/aşırı ağırlık doğrulaması; genel ScaleAdapter davranışının tamamı bu paketle doğrulanmış sayılmaz | Kalibrasyon, sertifikalı model, protokol, gerçek seri/TCP ve dara gerekli |
| Ödeme terminali / ÖKC | {ref('backend/src/services/retailExternalService.js', 'const capabilities=')}; adaptör sınırı/journal, varsayılan profiles boş | PASS — test adapter idempotency/unknown yerel kayıt; banka ile mutabakat yok | BLOCKED — üretici/banka test hesabı, yetki ve cihaz |

## Bulgular ve kabul kapıları

| ID / önem | Kanıt / tekrar üretme | Önerilen çözüm |
|---|---|---|
| HW-01 P1 — fiziksel uyumluluk matrisi boş | `environment.json`: physical_device_tested=false; gerçek cihaz koşusu bulunmuyor | Her cihazın marka/model/firmware/sürücü/OS sürümü, bağlantı tipi, test fişi ve operatör kabulünü kaydet |
| HW-02 P1 — baskı işinin teslim sınırı | {ref('frontend/src/printing/receiptPrinter.js', 'delivery_confirmed:false')}, {ref('desktop/printing.cjs', "status:'submitted'")} | Kağıt bitmesi, offline, kablo çekme, tekrar baskı testleri; 'gönderildi' ile 'basıldı'yı ayır |
| HW-03 P1 — mali cihaz ve çekmece sürücüsü eksik | {ref('backend/src/services/retailExternalService.js', 'const capabilities=')}; printer adapter listesi | Gerçek SDK alınmadan donanım destekli POS iddiası yayımlama; adaptör işi ayrı onaya tabi |

Fiziksel cihaz başarı oranı hesaplanmadı. Temiz Windows kurulumu ve Android Emulator bu sanal PASS sayısına dahil değildir.
''')

write('SECURITY_AND_LICENSE_AUDIT.md', f'''
# Güvenlik ve lisans denetimi

{common}
## Kritik arşiv bulgusu

**SEC-01 — P0 dağıtım engeli / dışarı sızma doğrulanmadı.** Kök `veniux.com.zip` (32.709 dosya girdisi) içinde:

- `backend/config/keys/license_private_key.pem`: crypto.createPrivateKey ile **geçerli özel anahtar**; mevcut yerel legacy anahtar dosyasıyla aynı. Paketlenen merkezi otorite açık anahtarıyla **eşleşmiyor**. Merkezi lisans imza anahtarının ele geçirildiği sonucu çıkarılamaz.
- `backend/stok_takip.db`, `backend/stok_takip_test.db`: SQLite dosya imzası doğrulandı. **Tabloları/müşteri kayıtları açılmadı**, içeriklerin test veya gerçek müşteri verisi olduğu varsayılmadı.
- `frontend/.env`, `frontend/.env.local`: dosya adları tespit edildi; sır içerdiği ayrıca kanıtlanmadı; dağıtım allowlist'i dışında tutulmalı.
- node_modules README/kod içindeki PEM örnekleri ham tarama eşleşmesidir; gerçek proje özel anahtarı bulgusuyla aynı sayılmaz.

Kanıt: `{EVIDENCE}/archive-audit.json`, `archive-key-validation.json`; tekrar: `python tools/production-readiness/archive-audit.py`. Hiçbir anahtar/token/DB satırı rapora veya terminale yazılmadı. **Arşiv silinmedi, yüklenmedi veya yeniden yayımlanmadı.** Canlı HTTP erişimi, eski paylaşım ve indirme geçmişi test edilmedi.

Gerekli çözüm: bu arşivi dağıtım kaynağı olarak kullanmayı durdur; özel erişimli saklamaya al; daha önce gönderildiyse alıcı/konum listesini değerlendir; etkilenen legacy anahtar için mevcut lisansları bozmayan kontrollü rotasyon planı hazırla. Üretim anahtarı değişimi, lisans iptali ve müşteri verisi silme bu görevin izni dışındadır. Salt temiz ZIP üretmek geçmiş ifşayı geri almaz.

## Uygulanan korumalar ve yeniden test

{ref('desktop/distribution-safety.cjs', 'function entryProblems')}: first-party kaynaklarda gerçek PEM özel anahtarı, SQLite dosya imzası, .env ve anahtar/veritabanı dosya adlarını reddeder. {ref('desktop/electron-builder.config.js', "require('./distribution-safety.cjs')")}: Windows afterPack aşamasında çalışır. Bu bir ZIP upload filtresi değildir; eski kök ZIP halen güvensizdir.

{ref('desktop/distribution-safety.test.cjs')}: 4 yeni test PASS — gerçek özel/public ayrımı, uzantısı değişmiş DB, gizli dosya, bozuk kaynak string'i ve dosyayı silmeden fail-closed kontrolü. Mevcut 2.4.38 unpacked resources için kontrol 340 first-party girdide geçti. node_modules içerikleri ve 4 MiB üstü dosyaların tam gövdesi bu guard kapsamı dışındadır; SBOM/SCA/zararlı yazılım taraması değildir.

## Diğer bulgular

| ID / önem / durum | Kanıt | Tekrar üretme | Çözüm / sınır |
|---|---|---|---|
| SEC-02 P1 açık — Windows yayıncı imzası yok | `windows-signature.json`: NotSigned; {ref('desktop/electron-builder.config.js', 'signAndEditExecutable:false')}; signed config ayrı | Get-AuthenticodeSignature mevcut EXE | Sertifika/Store yolu ve imzalı temiz VM kabulü; SHA256 yayıncı kimliği sağlamaz |
| SEC-03 P1 açık — deployment snapshot şifrelenmiyor | {ref('backend/src/services/deploymentSnapshot.js', "copy(locations.storage")}; DB/keys/install.env doğrudan kopya | Ayrı fixture update snapshot dosyalarını incele; 11 deployment testi davranışı doğrular, şifreleme iddiasını doğrulamaz | BackupService AES-GCM ile karıştırma. NTFS ACL/BitLocker/erişim ve anahtar escrow politikasını doğrula; formatı değiştirmek mimari onay gerektirir |
| SEC-04 P1 düzeltilmiş — gizli üst klasörde rapor indirme 404 | {ref('backend/src/routes/aiRoutes.js', "dotfiles:'allow'")}; önceki `run-04c2e7043cce4db7` FAIL | Testte rapor üret → dosya mevcut → kendi kullanıcıyla GET; düzeltmeden önce 404, sonra 200; anonim401/farklıtenant404 | Yalnız sunucu registry'sinden kimliği doğrulanmış kesin dosya yolu için izin; statik klasör erişimi genişletilmedi |
| SEC-05 P1 canlı kabul bekliyor — lisans paneli MFA/erişim sınırı | {ref('api.veniux.com/README.md', 'bu sürümde MFA yoktur')} | Üretim panelinin erişim topolojisi ve ikinci faktörü kontrol edilmedi | VPN/IP allowlist veya MFA tasarımı; Node kullanıcı MFA'sı PHP yönetim MFA'sı sayılmaz |
| SEC-06 P1 kullanılmamalı — eski compose varsayılanları | {ref('docker-compose.yml', 'POSTGRES_PASSWORD')}; public 5432/6379 port eşlemesi | Yalnız dosya incelemesi; container başlatılmadı | Eski örneği üretim tarifi olarak kullanma; gerçek altyapı kararı sonrası sır yöneticisi ve özel ağ |
| SEC-07 P2 açık — yerel anahtar/yedek ACL doğrulaması | {ref('backend/src/services/backupService.js', "local-key.bin")}; mode0600 Windows ACL garantisi değildir | Ayrı standart Windows kullanıcısıyla erişim testi NOT TESTED | DPAPI/NTFS servis hesabı ACL ve farklı diskte anahtar kurtarma tatbikatı |

## Doğrulanan güvenlik sınırları

| Alan | Sonuç / kanıt |
|---|---|
| Tenant ve rol | 92 grupta multi_tenant, authorizationOperations, access/warehouse/cost yetki regresyonları PASS; {ref('backend/src/middlewares/authMiddleware.js', 'const dbUser =')}. Bütün olası IDOR yollarının bağımsız pentesti değildir |
| Oturum/parola | auth (6), MFA (2) ve diğer lifecycle testleri PASS; JWT doğrulamasından sonra DB status/role/session_version kontrolü; bcrypt. {ref('backend/src/controllers/authController.js', 'bcrypt.compare')} |
| Merkezi lisans | Yerel iki PHP sürecinde seat yarışı, imza, yanlış cihaz, askı/iptal ve offline-denial PASS; `{EVIDENCE}/license-php.log`. Üretim MySQL, DNS/TLS ve hesap yetkileri NOT TESTED |
| Şifreli yedek / restore | backupRecovery 19 PASS; {ref('backend/src/services/backupService.js', 'function encrypt')}: AES-256-GCM; rollback ve kesilmiş restore günlüğü. Portable export sırları ayıklar ama **şifreli dosya değildir**, müşteri verisi taşıyabilir |
| Migration | deploymentLifecycle 11 PASS; checksum ve daha yeni şemayla eski kodu reddetme; üretim kopyası ve MySQL migration NOT TESTED |
| Güvenli log | productionPrivacy ve AI journal testleri geniş koşuda PASS; {ref('backend/src/middlewares/productionPrivacy.js', 'function installLogs')}. Canlı proxy/işletim sistemi logları incelenmedi |
| Electron | {ref('desktop/main.js', 'contextIsolation: true')}: nodeIntegration=false, sandbox/webSecurity=true; IPC/origin testleri mevcut; paketli OS pentesti yok |
| Android | {ref('mobile/android/AndroidManifest.xml', 'allowBackup')}; cleartext kapalı, pinli yerel HTTPS ve sınırlı bridge; kaynak derlemesi PASS, gerçek cihaz güvenlik kabulü yok |

## Paket taraması sınırı

`package-audit.json`: Windows unpacked resources (node_modules hariç) 331 girdilik envanter; asar 406 girdilik envanter; seçilmiş first-party kaynak klasörleri. `archive-audit.json`: APK107 ve ZIP32709 dosya girdisi. Windows/Android'de bu sınırlı kontrolde özel anahtar/SQLite bulunmadı; kök ZIP'de bulundu. EXE içindeki sıkıştırılmış payload bağımsız açılıp unpacked klasörle doğrulanmadı; EXE/APK SHA256 kaydedildi. Arbitrary hardcoded sır, bütün müşteri JSON dosyaları, bağımlılık CVE'si veya ikili analiz garantisi verilmez.
''')

write('TURKEY_FISCAL_COMPLIANCE_GAPS.md', f'''
# Türkiye mali entegrasyon boşlukları

{common}
Bu teknik boşluk analizidir; vergi mükellefiyeti/istisna kararı veya mevzuat uygunluk belgesi değildir. İşletmeye uygulanacak yükümlülük mali müşavir, yetkili cihaz üreticisi ve gerekli entegratörle doğrulanmalıdır.

## Gerçek ürün durumu

| Alan | Durum / kanıt | Gerekli kabul |
|---|---|---|
| POS satış bilgi fişi | Tamamlandı ve yazılım kapsamıyla doğrulandı; {ref('backend/src/services/retailReceipt.js', 'Mali cihaz fişi')}: açıkça mali fiş yerine geçmediği yazıyor | 58/80 mm fiziksel baskı ayrı; bunu mali fiş diye sunma |
| KDV hesap/snapshot | 19 test PASS, indirim/kısmi iade/kuruş; bu hesap doğruluğu mali cihaz onayı değildir | İşletme ürün/vergi sınıfları ve güncel oranlar mali müşavir tarafından atanmalı |
| ÖKC / YN ÖKC | Kısmen: generic adapter/journal; varsayılan profiles boş. {ref('backend/src/services/retailExternalService.js', 'const capabilities=')} | Onaylı üretici/model/protokol, SDK sözleşmesi, üretici testleri ve yetkili kabul |
| Banka ödeme terminali | Eksik gerçek sürücü; 'kart' alanı yerel kayıt, provizyon alınmıyor | Banka/ödeme sağlayıcı test ortamı; çekim, belirsiz işlem, iade, iptal ve gün sonu |
| e-Fatura/e-Arşiv | İç JSON taslak, sent_to_gib=false. {ref('backend/src/services/retailExternalService.js', 'async function invoiceDraft')} | UBL-TR, imza/mali mühür, durum yaşam döngüsü, gönderim/yanıt, saklama/ibraz; uygun resmî yöntem veya yetkili özel entegratör kabulü |
| Mali gün sonu | Yerel satış/shift raporu, bank_reconciled=false | Cihaz/banka raporuyla mutabakat; yerel raporu resmî Z raporu diye adlandırma |

## Bulgular

| ID / önem | Dosya/satır / tekrar üretme | Çözüm |
|---|---|---|
| FISC-01 P1 satış engeli | {ref('backend/src/services/retailExternalService.js', 'const capabilities=')}; configured=false, receipt mali uyarısı; yazılım fişi üretildiğinde resmî belge oluşmuyor | Hedef işletmenin yükümlülüğünü ve mevcut onaylı cihazıyla birlikte çalışma modelini yazılı belirle |
| FISC-02 P1 satış engeli | {ref('backend/src/services/retailExternalService.js', 'async function invoiceDraft')}; internal_draft/sent_to_gib=false; test adaptörü GİB hesabı değil | Resmî teknik kılavuzla belge doğrulama + sandbox + entegratör/üretici kabulü |
| FISC-03 P1 satış engeli | {ref('backend/src/services/retailExternalService.js', 'async function reconciliation')}; TX-01 / TX-02, yerel journal bank_reconciled=false | Üretici/banka yanıtı ve mali işlem kimliğiyle idempotent uçtan uca mutabakat; riskli ödeme akışı değişiklikleri için ayrı onay |

## Resmî kaynaklar

18 Ekim 2026 tarihinde resmî kaynaklar kontrol edildi. GİB'in YN ÖKC rehberi ve SSS'si yükümlülük ve üretici bağlantı usullerini açıklıyor; belirli bir entegrasyonun VENIUX tarafından onaylandığına kanıt değil:

- [GİB YN ÖKC SSS](https://ynokc.gib.gov.tr/Home/SSS) — harici donanım/yazılım ve GMP-3 bağlantı kuralları.
- [GİB YN ÖKC kullanım rehberi duyurusu](https://ynokc.gib.gov.tr/Home/DuyuruDetay/11135).
- [GİB e-Fatura Özel Entegrasyon Kılavuzu v1.12](https://ebelge.gib.gov.tr/dosyalar/kilavuzlar/e-Fatura_Uygulamasi_Ozel_Entegrasyon_Kilavuzu_v1.12.pdf).
- [GİB özel entegrasyon/e-Arşiv düzenlemesi](https://gib.gov.tr/mevzuat/kanun/434/teblig/7980).

Fiziksel cihaz, resmî test hesabı ve entegratör erişimi yok. Bu görevde mali entegrasyon kodu, gerçek tahsilat veya GİB gönderimi yapılmadı.
''')

write('WINDOWS_ANDROID_RELEASE_CHECKLIST.md', f'''
# Windows / Android / bulut yayın kontrol listesi

{common}
## Mevcut paketler ve kaynak ayrımı

- Windows 2.4.38 EXE: **NotSigned**, yeni NSIS kurulumu bu görevde çalıştırılmadı. Unpacked resources ve asar sınırlı tarandı; EXE hash'i `package-audit.json` içinde.
- Android 2.4.32 APK: mevcut apksigner/JDK17 ile **v2 ve v3 imzası doğrulandı** (exit0, 1 signer). v1/v4 false başlı başına bu minSDK26 APK için hata diye sayılmadı. Publisher/Store kimliği, kurulu eski APK ile aynı imza/upgrade ve gerçek cihaz çalışması NOT TESTED.
- `{EVIDENCE}/source-package-drift.json`: güncel backend/src karşısında mevcut Windows kaynaklarında **11 farklı, 27 eksik dosya**. Eksiklerin bir bölümü bilinçli eski sektör dışlamasıdır; **retailCreditService, retailExternalService, retailProService, retailVatService, retailReceipt ve 031 migration** de yoktur. Son kaynak testlerinin bu eski pakette geçtiği iddia edilemez.
- Son yerel kaynak build/test sürümü: 736 API + 47 ortak test; yeni EXE/APK üretilmedi, otomatik güncelleme kanalı değiştirilmedi.

## Kabul matrisi

| Kontrol | Durum | Kanıt / zorunlu sonraki adım |
|---|---|---|
| Windows ilk yönetici, lisans ve kalıcı veri dizini | Yazılım testi PASS; temiz VM BLOCKED | {ref('backend/tests/deploymentLifecycle.test.js')}; lisans yerel PHP kabulü PASS. Temiz standart Windows hesabında EXE kur, ilk açılış ve lisansı doğrula |
| Eksik bağımlılık / XAMPP veya HTTPS | Kaynak mevcut, paketli kabul NOT TESTED | {ref('desktop/local-server.cjs')}; gerçek dosya/kütüphane/dizin izinlerini VM'de dene |
| Güncelleme ve eski sürüme dönüş | SQLite fixture migration/checksum/snapshot PASS; imzalı EXE/OS kabul yok | {ref('backend/src/services/deploymentService.js', 'async function update')}, {ref('backend/src/database/migrator.js', 'SCHEMA_NEWER_THAN_CODE')}; eski kod + yeni DB kör downgrade yapılmamalı |
| Kurulum/kaldırmada DB korunması | NSIS deleteAppDataOnUninstall=false kaynakta; gerçek kaldırma NOT TESTED | {ref('desktop/electron-builder.config.js', 'deleteAppDataOnUninstall:false')}; farklı app/data dizininde kur/güncelle/kaldır/yeniden kur ve hash/iş kuralı karşılaştır |
| Lisans iptal/askı/yanlış cihaz/seat yarışı | Yerel iki PHP süreç kabulü PASS | `{EVIDENCE}/license-php.log`; üretim otorite MySQL/TLS kabulü ayrı |
| Windows imza/SmartScreen | FAIL: imzasız artefakt; SmartScreen gerçek VM NOT TESTED | İmzalı build yolu var, sertifika yok; SmartScreen'in uyarısız çalışacağı garantisi verilmez |
| Android derleme/imza | Java derlemesi PASS, APK imzası PASS | Emulator/ADB/üretici cihaz yok; kamera/tarama tuşu/permission/kesinti kabulü BLOCKED |
| Android/Windows/bulut tutarlılığı | Ortak API, mobile pairing ve tenant regresyonu PASS; çok cihaz pilotu yok | {ref('mobile/android/src/com/veniux/companion/MainActivity.java')}; bilgisayar pinli HTTPS veya bulut API. Yerel ve bulut DB'nin bağımsız otomatik eşitlenmesi yok |
| Geri yükleme | SQLite backup19/deployment11 PASS | Ayrı fiziksel makine/disk, kayıp anahtar, MySQL ve müşteri ölçekli restore NOT TESTED |
| Uzaktan destek | Doğrulanmış oturumlu destek/izin/sonlandırma hizmeti kanıtlanmadı | Müşteri rızası, süreli erişim, denetim izi ve sonlandırma pilot öncesi belirlenmeli; genel uzaktan erişim açılmadı |

## Açık yayın engelleri

| ID / önem | Kanıt / tekrar üretme | Çözüm |
|---|---|---|
| REL-01 P1 — kaynak/paket farklı | source-package-drift.json + SHA karşılaştırması | Temiz izinli kaynaklardan yeni sürüm; preflight + imza + clean VM + APK cihaz kabulü; kaynağı test ettik diye eski paketi güncel sayma |
| REL-02 P1 — VM/emulator yok | hardware environment.json, Windows Sandbox false, emulator_paths/adb_paths boş | Test ortamı sağla; yüklemeden fiziksel kabul varmış gibi raporlama |
| REL-03 P1 — güncellemede aktif POS işlemi kabulü yok | {ref('desktop/updater.js', 'autoUpdater.disableDifferentialDownload')}; autoInstallOnAppQuit=true; pending satışla OS kapanma testi yok | Paketli ortamda işlem devam ederken güncelleme/kapanma ve tekrar açılış kanıtı; riskli yaşam döngüsü değişikliği öncesi ayrı onay |
| REL-04 P0 dağıtım kapısı — güvensiz kaynak arşivi | SEC-01, kök ZIP gerçek private key ve DB içeriyor | Bu ZIP'i müşteri/hosting dağıtımına sokma; mevcut arşiv ve olası eski paylaşımlar için güvenli saklama ve rotasyon kararı |

Üretim yayını, DB migration, sertifika satın alımı, APK/EXE install veya uzaktan destek kurulumu yapılmadı. Kaynak/paket hash kayıtları bir imza veya müşteri kabul tutanağı değildir.
''')

write('TERMINAL_UX_3_REPORT.md', f'''
# Terminal UX 3.0 — sınırlı kalite düzeltmeleri ve yeniden doğrulama

{common}
Standalone POS mimarisi ve mavi/turuncu tasarım korundu. ERP navigasyonu eklenmedi; satış/ödeme motoru değişmedi.

## Bulgular ve düzeltmeler

| ID / önem / durum | Kanıt ve tekrar üretme | Sonuç / çözüm |
|---|---|---|
| UX-01 P2 düzeltilmiş — satır kaldırmadan vazgeçince odak dönmüyor | {ref('frontend/src/pages/RetailPos.jsx', '[tab,posMode')}; barkodla ürün → Kaldır → Vazgeç. Önce activeElement='Kaldır', sonra barkod | removeLine, discountOpen, priceEdit kapanışları mevcut gecikmeli güvenli odak etkisine eklendi; dialog/pending/lock koruması korunuyor. `focus-regression.json`: önce15 satır, sonra bağımsız yeni fixture1 satır; stok satışı yapılmadı |
| UX-02 P2 düzeltilmiş — küçük durum metni kontrastı 4,44:1 | {ref('frontend/src/pages/PosTerminalUX2.css', '.pos-terminal .pos-status{color')}; eski computed #526d87 / #e2eaf3 | Metin #476079 yapıldı. Statik sRGB oranı 5,38:1 (sRGB hesabı); normal küçük metin için 4,5 sınırını aşar. Tüm ekran WCAG sertifikası değildir |
| UX-03 P2 önceki düzeltme bu tur yeniden görüldü | Kamera46×46, nötr Ekle/kamera/ürünbul; `viewports.json` | Dört çözünürlükte güncel tarayıcı gözlemi; belirgin mavi ödeme vurgusunda kaldı |

## Çalıştırılmış görsel matris

{EVIDENCE}/classic-*.png ve visual-*.png: **8 yeni gerçek screenshot**, PNG ölçüleri ayrıca okundu. 15 satır (uzun kahve adı +14 fixture ürün), toplam347,90 TL; sayfa scrollWidth/Height viewport ile aynı, sepet scrollHeight951/1013 > clientHeight. İncelenen görünür ana düğmelerde <44 piksel hedef bulunmadı.

| Çözünürlük | Klasik / görselli | Ana sayfa | Sepet clientHeight (klasik/görsel) | Ödeme |
|---|---|---|---|---|
| 1024×768 | PASS / PASS | 1024×768, taşma yok | 438 /141 | Görünür, 76px yüksek |
| 1280×800 | PASS / PASS | 1280×800, taşma yok | 462 /165 | Görünür, 76px yüksek |
| 1366×768 | PASS / PASS | 1366×768, taşma yok | 430 /133 | Görünür, 76px yüksek |
| 1920×1080 | PASS / PASS | 1920×1080, taşma yok | 734 /790 | Görünür, 76px yüksek |

Bu sekiz görünüm `run-04c2e7043cce4db7` derlemesinden, odak/kontrast düzeltmesinden **önce** alındı; son iki değişiklik yerleşim ölçülerini değiştirmiyor. Odak düzeltmesi `run-797f47cf8ced2681` ile yeni fixture'da gerçek tarayıcıda tekrar edildi. Bu sonraki sekmede istenen viewport override doğru ölçüye ulaşmadı (capture386×217); bu görüntü **1366×768 kanıtı diye kullanılmadı**, `focus-capture-386x217.png` diye adlandırıldı. Son kaynakların run-d510c13891ac5689 derlemesinde final-viewports.json ile dört CSS çözünürlüğü × iki mod tekrar ölçüldü: ana sayfa hedef ölçüde,15 satır ve ödeme görünür. Yukarıdaki clientHeight tablosu bu son DOM ölçümüdür. Tarayıcı devicePixelRatio1,88 nedeniyle viewport aracı fiziksel ölçüyle ayarlandı; gerçek innerWidth/innerHeight hedeflerle doğrulandı. Son renk computed rgb(71,96,121) / rgb(226,234,243) olarak tekrar görüldü. Son screenshot aracı DOM1366×768 iken726×559 PNG döndürdüğünden bu dosya final-capture-726x559.png olarak ayrıldı; büyütülmedi ve1366 kanıtı diye sunulmadı. Bu, gerçek Windows DPI testi değildir.

## Akış ve erişilebilirlik kanıtları

- Boş sepet/yükleme durumu yeni fixture açılışında görüldü. Satır silme açık onayı ve vazgeçme, odak geri dönüşü gerçek UI'da test edildi.
- F8 ödeme ekranını açtı; Alınan nakit200 girildi; F9 aynı alanda kaldı; Enter ödemeyi kaydetmedi. Dialog ve sepet açık kaldı. `payment-keyboard.json`, `payment.png`. **Bu görevde tarayıcıdan satış tamamlanmadı**; gerçek API satış/ödeme regresyonları ayrı çalıştı.
- Yeni UI koşusunun son konsol error listesi boştu. Ekle disable/reading, hata/pending mesajlarının kaynak kontrolleri korundu; tarayıcıya ağ hatası enjekte edilerek bütün hata/toast görünümleri bu tur yeniden sınanmadı.
- Seçilmiş computed kontrastlar: barkod13,99; kamera7,92; ürün adı14,19; fiyat5,81; ödeme4,56. Gradient/hover/disabled ve bütün modallar için tam erişilebilirlik taraması değildir. Disabled kontroller normal etkin metin gibi değerlendirilmedi.
- 1366 ve1024 görsel modunda sepet kısa ama kendi alanında kayıyor; toplam sabit. Daha çok görünen satır için kullanıcı pilotu ölçümü önerilir; tüm sayfayı yeniden tasarlama yapılmadı.

## Test ve kalan risk

Son UI/guard koşusu `.local/customer-experience/run-d510c13891ac5689`: **47 PASS, 0 FAIL, 0 SKIP**, React build exit0. Önceki43 test aynen korundu;4 yeni dağıtım koruması testi eklendi. Bu testler React DOM bileşenlerinin tam render testi değildir; ortak/sunum/sözleşme testleridir.

UX-04 P1 fiziksel kabul bekliyor: Windows %125/%150 DPI, gerçek touch, zayıf POS CPU/GPU ve gerçek HID/kamera NOT TESTED. Kaynak: {ref('frontend/src/pages/PosTerminal.css')}; tekrar gerçek cihaz kabul planı; çözüm pilot öncesi bu matrisi paketli terminalde çalıştırmak.

UX-05 P2 açık: kalıcı API sağlık göstergesi ve bütün offline/hata durumlarının görsel regresyonu yok. Kaynak: {ref('frontend/src/pages/RetailPos.jsx', 'pos-status')}; API kesintisi/recovery durumunu UI testinde enjekte ederek mesaj, tekrar dene ve odak davranışını doğrula. Browser navigator.onLine tek başına yerel API sağlığı diye sunulmamalı.
''')

write('VENIUX_PRODUCTION_READINESS_3.md', f'''
# VENIUX CLOUD — Production Readiness 3.0

{common}
## Karar

| Kullanım | Karar | Gerekçe |
|---|---|---|
| Kontrollü, sentetik verili **yerel web demosu** | **Evet, doğrulanan POS/WMS/API akışlarıyla sınırlı** | Yeni API/regresyon, build, yerel PHP lisans/site kabulü ve gerçek tarayıcı terminal gözlemleri var. ÖKC/banka, offline satış ve fiziksel cihaz desteği demo özelliği gibi sunulmamalı. Eski EXE/APK için aynı karar verilmez |
| Gerçek satış yapan kontrollü pilot müşteri | **Hayır, henüz hazır değil** | SEC-01 güvensiz arşiv, güncel/imzalı paket ve temiz kurulum yok; cihaz/DB topolojisi ve kurtarma kabulü yok; mali entegrasyon boşlukları var |
| Genel ticari satış / günlük işletme kasası | **Hayır** | Pilot kapıları kapanmadı; kaynak testlerinin geçmesi mali/donanım/kurulum kabulünün yerine geçmiyor |

## Kapsam ve yöntem

Gerçek mimari korunuyor: Node/Express API + SQLite/MySQL adaptörü, React, Electron/NSIS Windows, Java Android/WebView, PHP pazarlama sitesi ve PHP lisans merkezi. Laravel/Blade yok; teknoloji göçü yapılmadı. Başlangıçta `VENIUX_POS_TERMINAL_UX_2.md`, önceki readiness/security, Retail Pro, kurulum ve donanım raporları okundu. Tarihsel başarı sayıları yeni sonuç sayılmadı.

Operasyon, erişim/lisans, migration/backup, POS, WMS/lot/stok/raporlama ve platform kaynak sınırları ile bütün92 kök API test grubu incelenip çalıştırıldı. İnceleme bütün satırların biçimsel doğrulaması veya bütün kullanıcı kombinasyonlarının exhaustive kanıtı değildir. Gerçek MySQL alt paketi, fiziksel cihaz, hosting ayarları ve harici banka/GİB hesapları sınır dışındadır.

## Yeni test sonuçları

| Koşu | Sonuç | Kanıt |
|---|---|---|
| Mevcut Terminal UX2 çekirdek regresyonu | 167 API PASS /0FAIL;43 ortak test PASS; build PASS | `.local/customer-experience/run-88a07e9e266f8d5b` |
| İlk geniş API koşusu | 734 PASS /2FAIL | `run-04c2e7043cce4db7`; biri gerçek indirme uyumluluk hatası, biri yeni TCP test düzeneği hatası |
| Son tüm kök API testleri | **736 PASS /0FAIL /0SKIP,92 grup** | `.local/customer-experience/run-d510c13891ac5689`; `api-test-inventory.json` |
| Son ortak/sunum/dağıtım testleri | **47 PASS /0FAIL /0SKIP**, build exit0 | `.local/customer-experience/run-d510c13891ac5689`;43 mevcut +4 guard testi |
| Sanal donanım | **162 PASS /0FAIL /5BLOCKED /5NOT TESTED** | `.local/hardware-lab-runs/run-709792c5baa3704345e40234` |
| PHP lisans otoritesi | Yerel fonksiyon ve güvenlik kabulü PASS, iki ayrı Node kabul betiği exit0 | `{EVIDENCE}/license-php.log`, `license-security-php.log`; SQLite, iki PHP süreci |
| PHP web hesap/form/rıza | Hesap ve4 form türü kabulü PASS;8 rıza/dönüşüm testi PASS | `{EVIDENCE}/ancillary.json`, ilgili loglar; bildirimler kapalı |
| APK | apksigner verify exit0, v2/v3 doğrulandı | `android-signature.json`; cihaz kabulü değil |
| EXE | **NotSigned**, temiz kurulum NOT TESTED | `windows-signature.json` |
| Terminal ekranları | 4 çözünürlük ×2 mod yeni görüntü;15 satırda overflow yok | `{EVIDENCE}/viewports.json`; son odak/kontrast değişikliği sınırı UX3 raporunda |

Test kümeleri kesişir; benzersizmiş gibi toplanmadı, toplam başarı yüzdesi üretilmedi. BLOCKED/NOT TESTED paydadan gizlenerek ticari hazırlık iddiası yapılmadı. Tüm API koşusu MySQL test dizinini kapsamaz.

## Özellik durum envanteri

| Alan / özellik | Durum | Kanıt / sınır |
|---|---|---|
| API kimlik/tenant/rol/warehouse sınırı | Tamamlandı ve doğrulandı — test kapsamı | auth/access/authorization ve tenant grupları PASS; canlı pentest değil |
| Ürün/tedarikçi/depo/stok/import | Tamamlandı ve doğrulandı — izole API | products/stock/import grupları; müşteri ölçekli performans ayrı |
| POS satış/indirim/ödeme beyanı | Tamamlandı ve doğrulandı — yerel kayıt | POS_TRANSACTION_INTEGRITY; banka tahsilatı hariç |
| İade/iptal/cari/veresiye | Tamamlandı ve doğrulandı — API/SQLite | retailDaily/Pro/Critical/Vat testleri; işletme kredi politikası pilot bekliyor |
| Lot/SKT/FEFO/raf/kabul/transfer | Tamamlandı ve doğrulandı — test senaryoları | wmsLotOperations18 ve diğer WMS grupları PASS; el terminali fiziksel kabulü yok |
| SmartCount | Kısmen tamamlandı | Kör baseline/taslak/onay testleri var; canlı satış mutabakatı ve cihazlar arası kalıcı görev/outbox tamamlanmış değil |
| Raporlama/gün sonu/brüt kâr | Tamamlandı ve doğrulandı — yerel defter | retailShift/Daily/Profit ve yetki testleri; mali Z/banka mutabakatı değil |
| Terminal UX2/UX3 | Tamamlandı ve doğrulandı — belirtilen yerel görünümler/odak | gerçek tarayıcı; tam WCAG/gerçek touch ve tüm hata durumları doğrulanmadı |
| 58/80 satış fişi KDV | Tamamlandı ve doğrulandı — HTML/hesap | fiziksel baskı/mali fiş değil |
| Barkod metni/COM köprüsü | Uygulandı; sanal kapsam doğrulandı | gerçek cihaz gerektiriyor |
| ESC/POS/para çekmecesi model sürücüsü | Eksik | generic adapter var; doğrulanmış hazır model sürücüsü yok |
| Terazi | Kısmen tamamlandı | quantity/stability sözleşmesi var; gerçek protokol/kalibrasyon yok |
| Banka/ÖKC/e-belge | Harici hizmet ve fiziksel cihaz gerektiriyor; gerçek entegrasyon eksik | internal draft ve yerel journal; resmî kabul yok |
| Şifreli SQLite yedek/geri yükleme | Tamamlandı ve doğrulandı — fixture | backupRecovery19; farklı cihaz/kayıp anahtar tatbikatı yok |
| Deployment snapshot | Uygulandı, şifreleme eksik | SEC-03; korunan anahtar/env kopyaları özel erişim gerektiriyor |
| Migration/rollback SQLite | Tamamlandı ve doğrulandı — yazılım testi | deployment11; gerçek güncel EXE/OS kabulü yok |
| MySQL/cloud veri topolojisi | Uygulandı ama bu ortamda doğrulanmadı | gerçek MySQL yük/migration/rollback/çok süreç yarışı yok |
| PHP lisans otoritesi | Yerel SQLite kabulü doğrulandı | canlı MySQL/TLS/MFA/erişim sınırı ayrı |
| PHP ana site/hesap/form/çerez | Yerel kabul doğrulandı | Analytics hesabı, e-posta teslimi, GSC/indeks başarısı bu denetimin kanıtı değil |
| Android | Kaynak derlemesi ve eski APK imzası doğrulandı | Emulator/gerçek cihaz BLOCKED; son kaynakların APK'ye dahil olduğu söylenemez |
| Windows paket/otomatik update | Kısmen tamamlandı | mevcut paket eski ve imzasız; temiz VM/rollback/aktif satış kabulü yok |
| Kesintisiz offline satış/sync | Eksik | session pending recovery offline satış sistemi değildir; merkezi lisans fail-closed |
| Uzaktan destek | Doğrulanmış ürün akışı eksik | süreli/rızalı/denetimli destek kabulü bekliyor |

## Öncelikli engeller

| Önem / ID | Dosya/satır kanıtı | Tekrar üretme / yapılacak |
|---|---|---|
| **P0 SEC-01 — güvensiz arşiv dağıtım engeli** | `veniux.com.zip!/backend/config/keys/license_private_key.pem`, SQLite girdileri; geçerli özel anahtar doğrulandı | archive-audit.py; arşivi paylaşma/yükleme. Anahtar ve eski paylaşım riskini kontrollü değerlendir; canlı erişim/merkezi anahtar ifşası iddia edilmedi |
| P1 SEC-02/REL-01 — imzasız/eski Windows paketi | {ref('desktop/electron-builder.config.js', 'signAndEditExecutable:false')}; source-package-drift | Yeni kaynaklardan izinli imzalı sürüm + VM/device kabulü |
| P1 SEC-03 — şifresiz recovery snapshot | {ref('backend/src/services/deploymentSnapshot.js', 'copy(locations.storage')} | ACL/encryption/key escrow ve farklı makinede kurtarma; format değişimi için mimari onay |
| P1 TX-01/TX-02/FISC-01 — gerçek mali ödeme/ÖKC/e-belge eksik | {ref('backend/src/services/retailExternalService.js', 'const capabilities=')}, inspect status timeout yok | Üretici/banka/entegratör sandbox + gerçek cihaz; ödeme değişikliği ayrı onaylı |
| P1 TX-03/REL-02 — hedef ortam kabulü yok | MySQL testi çalışmadı; emulator/VM araçları yok | Ayrı kopya hedefte migration/restore, iki Node/kasa, OS ve cihaz matrisi |
| P1 SEC-05 — PHP admin erişim güvenliği | {ref('api.veniux.com/README.md', 'bu sürümde MFA yoktur')} | Canlı topoloji/VPN-IP/MFA kabulü |
| P1 REL-03 — update esnası pending satış | {ref('desktop/updater.js', 'autoUpdater.disableDifferentialDownload')} | Paketli yaşam döngüsü ve sekme kaybı recovery testi |
| P2 UX-05 — kapsamlı hata/offline görsel matrisi | {ref('frontend/src/pages/RetailPos.jsx', 'pos-status')} | API failure/timeout/recovery UI testi; fiziksel düşük donanım ayrı |

## Bu görevde değiştirilen dosyalar

| Dosya | Değişiklik / doğrulama |
|---|---|
| backend/src/routes/aiRoutes.js | Kesin yetkili rapor dosyasında gizli üst klasör indirme uyumluluğu; anonim401/foreign404 korunuyor |
| backend/tests/assistantSystemOperations.test.js | Dosyanın mevcut olduğunu ve anonim erişimin reddini ekledi; başarı beklentisi kaldırılmadı |
| backend/tests/productionReadiness.test.js |8 yeni gerçek API/SQLite/TCP hata/retry/weighted testi |
| frontend/src/pages/RetailPos.jsx | Modal kapanışlarında güvenli barkod odak etkisi |
| frontend/src/pages/PosTerminalUX2.css | Durum metni kontrastı |
| desktop/distribution-safety.cjs | Yeni first-party paket güvenlik guard'ı |
| desktop/distribution-safety.test.cjs |4 yeni fail-closed/public-private/DB regresyonu |
| desktop/electron-builder.config.js | afterPack guard çağrısı; gerçek yeni EXE build yapılmadı |
| tools/customer-experience/run.cjs | all-api/readiness-only seçenekleri,47 ortak test; izole DB/anahtar temizliği korunuyor |
| tools/production-readiness/package-audit.cjs | Read-only resources/asar/kaynak tarama ve artefakt SHA256 |
| tools/production-readiness/archive-audit.py | APK/kök ZIP extract etmeden sınırlı tarama |
| tools/production-readiness/ancillary.cjs | Mevcut yerel PHP kabul testleri ve bu koşunun geçici anahtar/DB klasörlerini temizleme |
| tools/production-readiness/write-reports.py | Kanıta bağlı bu7 raporu üretme |
| docs/VENIUX_HARDWARE_TEST_REPORT.md | Gerçek yeni laboratuvar sonucu |
| docs/audits/VENIUX_POS_TERMINAL_UX_2.md | UX3 takip bağlantısı |
| docs/audits/ altındaki bu görevde istenen7 dosya | Karar, bulgu, repro, çözüm ve sınırlamalar |

Mevcut kök ZIP, EXE/APK, müşteri DB, imza anahtarları ve hosting dosyaları değiştirilmedi. Testlerin ürettiği geçici DB/anahtarlar koşu sonlarında temizlendi; tarayıcı fixture'ları da yalnız doğrulama bitiminde kapatılıp temizlenir. Log/JSON/HTML/PNG kanıtları saklanır. Assert silme, skip veya başarısız testi gizleme yapılmadı.

## Ayrıntı belgeleri

- [POS işlem bütünlüğü](POS_TRANSACTION_INTEGRITY.md)
- [Donanım matrisi](HARDWARE_COMPATIBILITY_MATRIX.md)
- [Güvenlik ve lisans](SECURITY_AND_LICENSE_AUDIT.md)
- [Türkiye mali boşlukları](TURKEY_FISCAL_COMPLIANCE_GAPS.md)
- [Windows/Android yayın listesi](WINDOWS_ANDROID_RELEASE_CHECKLIST.md)
- [Terminal UX3](TERMINAL_UX_3_REPORT.md)

Ücretli hizmet veya dış hesap etkinleştirilmedi. Mimari geçiş, mali entegrasyon, üretim anahtar rotasyonu ve riskli ödeme/update değişiklikleri uygulanmadı; bunlar ayrı somut plan ve onay gerektirir. Ticari/pilot kapıları kapanmadan 'üretime hazır' etiketi kullanılmamalı.
''')
print('Wrote seven Production Readiness 3.0 reports.')
