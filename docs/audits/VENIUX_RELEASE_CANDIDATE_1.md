# VENIUX CLOUD — Release Candidate 1.0

> Güncel takip: [RC2 kabul raporu](VENIUX_RELEASE_CANDIDATE_2.md). RC1 sonuçları tarihseldir; RC2'de gerçek MySQL hedefli testleri ve iki kaynak düzeltmesi vardır. Eski EXE bu yeni düzeltmeleri içermez.

Tarih: 19 Ekim 2026. Karar kapsamı: bu çalışma alanındaki kaynaklar, izole test verileri ve yerel RC paketi. Üretime yayın, gerçek ödeme, mali işlem, üretim DB değişikliği ve lisans iptali yapılmadı. Önce Production Readiness 3 ve Security and License Audit tamamen okundu; tarihsel sonuçlar yeni test sayılmadı.

## Yayın kararı

| Hedef | Karar | Kanıt ve sınır |
|---|---|---|
| Sentetik verili yerel web demosu | **PASS** | 742 API, 51 ortak test, frontend build, tarayıcı POS ve paketli API smoke geçti. Banka/ÖKC, fiziksel cihaz, offline satış veya temiz Windows kurulumu başarısı olarak sunulamaz. |
| Gerçek müşteriyle kontrollü pilot | **BLOCKED** | Anahtar maruziyeti/migrasyon kararı, imza, temiz OS kabulü, hedef DB ve gerçek cihaz kabulü tamamlanmadı. |
| Genel ticari satış | **FAIL** | Açık P1'ler ve eksik mali/donanım entegrasyonları mevcut. Testlerin geçmesi bu gereksinimleri karşılamıyor. |

RC dosyasının derlenmesi ticari dağıtım onayı değildir. P0/P1 bulgularının tamamı kapatılmış değildir.

## Yeni çalıştırılan kanıtlar

Kanıt kökü: `.local/release-candidate-1/`. Test kümeleri kesişir; sayılar benzersizmiş gibi toplanmadı. BLOCKED/NOT TESTED başarıya dahil edilmedi.

| Kontrol | Gerçek sonuç | Kanıt |
|---|---|---|
| Tüm kök API testleri, SQLite | **742 PASS / 0 FAIL**, 93 test grubu | `.local/customer-experience/run-814b952fee760052/jest.json`, `backend.log`, `commands.json` |
| Ortak sunum/dağıtım testleri | **51 PASS / 0 FAIL / 0 SKIP** | aynı koşunun `presentation.log`; frontend production build exit0 |
| Donanım laboratuvarı | **162 PASS / 0 FAIL / 5 BLOCKED / 5 NOT TESTED** | `.local/hardware-lab-runs/run-a30c1cc6a4d5864f47874789/summary.json`, `matrix.json`; `docs/VENIUX_HARDWARE_TEST_REPORT.md` |
| Yeni WAL/SHM paket regresyonu | Önce 4 PASS/1 FAIL; düzeltme sonrası **5 PASS/0 FAIL** | `preflight-before.log`, `preflight-after.log` |
| Gerçek SQLite süreç kesintisi | Commit öncesi ve sonrası **2 PASS** | `crash-results.json`; fiziksel elektrik kesintisi değil |
| Windows x64 NSIS üretim optimizasyonlu RC build | **PASS**, frontend ve Windows exit0 | `windows-build.json`, build logları; imzasız |
| NSIS payload incelemesi | **PASS**: 14.611 ad girdisi, 402 first-party kontrol, 393 dosya hash karşılaştırması, 6 kritik servis kaynak eşleşmesi | `windows-payload-verification.json`; bağımlılıklar hariç belirtilen kapsam |
| Paketlenen Node/API | **PASS**, Node v24.15.0: health, login, sentetik lisans, satış/replay/58–80 fiş/iptal/stock restore | `package-smoke.json`; merkezi aktivasyon ve kurulum GUI **NOT TESTED** |
| POS 1366×768 CSS viewport | 15/50/100 satır × klasik/görselli mod kontrol edildi | `cart-viewports.json`; 15 satır ve 100 satır ödeme PNG'leri |
| Son build F6/F9 odağı | **PASS**: F6 arama inputu, modal içinde F9 odağı korur, kapatınca barkod | `focus-after.json`, build `run-814b952fee760052` |

Tekrar çalıştırma: `node tools/customer-experience/run.cjs --all-api`; `node tools/hardware-lab/run.cjs`; `node tools/release-candidate/crash-tests.cjs`; `node tools/release-candidate/build-windows.cjs`; `node tools/release-candidate/verify-windows.cjs`; `node tools/release-candidate/package-smoke.cjs`. Test araçları kendi geçici verilerini kullanır. Paket smoke gerçek merkezi lisans aktivasyonu yapmaz.

Ara denemeler korundu: receipt biçimi değiştikten sonra bir eski İngilizce beklenti başarısız oldu (`run-4578f32f3ea22896`, 741 PASS/1 FAIL); beklenti Türkçe biçime güncellendi. İlk RC testi mevcut olmayan aggregate `vat_cents` alanına bakıyordu; gerçek grup sözleşmesi test edildi. İlk crash aracı supertest çözüm yolu yanlıştı; backend bağımlılık yolu düzeltildi. Sandbox spawn EPERM sonrası test-isolation=none/izinli çalıştırma kullanıldı. Başarı için assertion silinmedi veya test atlanmadı. Tarayıcıda özel adlı 24. ürün bekleme ve ekran görüntüsü alma denemeleri yeniden hedeflendi; uygulama test başarısı gibi sayılmadı.

## Güvenlik ve P0/P1 kapanış matrisi

| Bulgu / önem | Durum | Dosya/satır, tekrar üretme ve gereken çözüm |
|---|---|---|
| SEC-01 P0: özel anahtar/SQLite içeren kaynak ZIP | **Dağıtım kaynağı karantinaya alındı; olay kapanışı AÇIK** | Eski `veniux.com.zip!/backend/config/keys/license_private_key.pem`; yeni `.local/security-quarantine/veniux-source-private-20261019.zip`. `quarantine.json` önce/sonra aynı SHA256'yı doğrular. Arşiv açılarak DB satırları okunmadı. Eski paylaşım ve alıcı envanteri/rotasyon kararı hâlâ gerekli. |
| Yeni paketlere DB/WAL/SHM/anahtar girmesi | **Belirtilen first-party kapsamda KAPATILDI** | `desktop/distribution-safety.cjs:13`, `:18`, test dosyası; NSIS afterPack ve `Build-Release.ps1` ZIP öncesi fail-closed. WAL magic, DB companion adları ve storage/recovery/backup/keys yolları reddedilir. |
| SEC-02/REL-01 P1: güncel Windows paketi/imza | Kaynak-paket farkı **KAPATILDI**; imza **BLOCKED** | Yeni RC metadata ve hash karşılaştırması geçti. `windows-signature.json`: **NotSigned**. Sertifika/Store ve imzalı temiz VM kabulü yok. SmartScreen'in çıkmayacağı garanti edilmez. |
| SEC-03 P1: deployment snapshot şifrelenmiyor | **AÇIK** | `backend/src/services/deploymentSnapshot.js:18–19` keys/env kopyalar. AES-GCM backupService farklı akıştır. ACL/BitLocker/escrow ve şifreli snapshot tasarımı onaylanmalı; bu turda riskli format değişikliği yapılmadı. |
| SEC-05 P1: PHP lisans yönetimi MFA/erişim | **BLOCKED** | `api.veniux.com/README.md:20`; gerçek hosting erişim topolojisi doğrulanmadı. Canlı yönetim için MFA/VPN/IP sınırı kabulü gerekir. |
| TX-01/02/FISC-01 P1: mali ödeme entegrasyonu | **AÇIK / harici entegrasyon** | `backend/src/services/retailExternalService.js:32`: adapter.status beklemesinde süre sınırı yok. Gerçek banka/ÖKC sürücüsü ve resmî kabul yok. Ödeme sözleşmesini değiştirmek için ayrı onay gerekir. |
| TX-03/REL-02 P1: hedef ortam kabulü | **BLOCKED** | Gerçek MySQL8, temiz Win10/11, Android Emulator ve fiziksel cihaz bulunmadı. SQLite testi bunların yerine geçmez. |
| REL-03 P1: aktif pending satışta update/kapanış | **AÇIK** | `frontend/src/pages/RetailPos.jsx:69–74`: pending sessionStorage kullanıyor. SQLite crash testi bu UI durumunun uygulama kapatılınca geri geleceğini kanıtlamaz. Paketli yaşam döngüsü testi gerekli. |

Koruma sınırı: node_modules kapsam dışıdır; first-party dosyalarda tam içerik en çok4 MiB, büyük dosyalarda başlık/ad kontrolü yapılır. Arbitrary müşteri JSON'u, gizlenmiş sır, bütün ikili dosyalar veya bağımlılık güvenliği için sertifika değildir. Karantina özel erişimli klasör adı sağlar; NTFS ACL/şifreleme doğrulanmadığından kriptografik koruma iddiası yoktur.

## Anahtar envanteri ve geçiş planı

`key-inventory.json`: 10.917 normal dosya,13 arşiv tarandı;43 opak container/ikili ayrı listelendi, okuma hatası0. Çalışma alanı ve içindeki yedekler/ZIP/APK/TAR incelendi; bilgisayarın bütün disklerinin ve uzak hosting'in tarandığı iddia edilmez. 4MiB üstü arşiv girdilerinin tam içeriği okunmadı. Git deposu bulunmadı: **Git geçmişi NOT TESTED**, temiz olduğu söylenemez.

Mevcut yerel legacy özel anahtarın iki eşleşmesi: `backend/config/keys/license_private_key.pem` ve eski kök ZIP içindeki aynı yol. Envanter karantina öncesi yolu kaydeder; `quarantine.json` yeni yolu ve aynı dosya hash'ini bağlar. Başka, farklı özel anahtar konumları: `.local/business-cloud-data/keys/license_private_key.pem`, `.local/desktop-backend/license-private.pem`, `.local/license-authority/signing-private.pem`. Bunlar hedef anahtarla eşleşmedi; otomatik olarak silinmedi veya değişmedi. Merkezi otoritenin paketlenen açık anahtarı legacy anahtarla eşleşmiyor; merkezi anahtarın sızdığı sonucu çıkarılamaz.

Yeni NSIS içeriği ayrıca açılıp kontrol edildi. Diğer opak EXE/asar/JKS/container'ların tamamına bu envanterden temiz kararı verilmez. Önceki arşiv bulgularındaki DB'lerin müşteri/test ayrımı kayıtlar açılmadan bilinmiyor.

Salt HEAD kontrolü: `https://veniux.com/veniux.com.zip` ve `/backend/config/keys/license_private_key.pem` kontrol anında404 verdi (`public-head-check.json`). Body indirilmedi. Bu iki sonuç geçmiş ifşanın veya başka URL'lerin yokluğunu kanıtlamaz.

**Uygulanmadı; sahip onayı gerektiren anahtar geçişi:**

1. Legacy issuer, merkezi PHP issuer ve Android imza anahtarlarını ayrı tut; geçmiş arşiv/alıcı/paylaşım ve etkilenen lisansları yetkili kişiyle envanterle. Bu rapora lisans/token/müşteri bilgisi ekleme.
2. Anahtar üretme/iptal için açık onay al. Yeni anahtarı korunan issuer üzerinde oluştur; istemci paketine yalnız açık anahtar koy, erişimi ve kurtarma escrow'unu doğrula.
3. Mevcut `licenseService.js:8–21,159` tek anahtar çifti kullanıyor; hazır dual-key/kid geçişi yok. Önce ayrı onaylı uyumluluk sürümü ve test edilmiş güvenilir açık anahtar halkası/geçiş penceresi tasarla. Mevcut lisansları bir anda geçersiz kılma.
4. Yeni lisans üretimini yeni issuer'a taşı; meşru mevcut hakları/cihaz bağını koruyarak yetkili yeniden lisansla. İptal/askı/offline davranışı ve eski sürüm geçişini staging'de doğrula.
5. Geçiş kapsamı doğrulanınca eski issuance anahtarını durdur; doğrulama desteğinin kaldırılmasını sahip tarafından onaylanan tarihe bağla. Açık istismar varsa ayrı olay müdahale kararı al; sessiz toplu iptal yapma.
6. Geri dönüş planı yeni imzalı lisansların doğrulanmasını korumalı; ele geçirilmiş anahtarla tekrar lisans üretimini açmamalı. Denetim kaydı ve yedek erişimini kontrol et.

Bu turda hiçbir üretim/yerel legacy anahtarı yenilenmedi, lisans geçersiz kılınmadı veya sır çıktılanmadı.

## Windows adayı ve temiz kurulum kapıları

Dosya: `.local/release-candidate-1/windows-unsigned/Veniux-RC-2.4.39-rc.1-UNSIGNED.exe`.

- Boyut196.262.490 bayt; SHA256 `BD9730B65C4506A0D57F62F9650B2D1A89861ED2977B4BF241BF37E80A72BB5D`.
- Standart NSIS mimarisi korunur; özel kurulum ekranı geri getirilmedi. Publish kapalı; sertifika bilgisi tüketilmedi. RC metadata2.4.39-rc.1; çalışma ağacındaki public2.4.38 sürüm/notları ve backend1.0.0 metadata'sı değiştirilmedi. Public sürüm notu/yayın yapılmadı.
- Paketlenen API yeni izole DB'yle açıldı; gerçek kurulu Electron ilk açılışı veya temiz Windows kabulü değildir.

| Yaşam döngüsü | Sonuç |
|---|---|
| Win10 temiz kurulum / ilk açılış / OS bağımlılıkları | **BLOCKED** — uygun VM/Sandbox yok |
| Win11 temiz kurulum | **BLOCKED** — mevcut geliştirici bilgisayarı temiz ortam sayılmaz |
| Üretim merkezi lisans aktivasyonu | **NOT TESTED** — sentetik yerel lisans smoke ile karıştırma |
| Yeni DB / migration / backup restore | **PASS**, izole API/deployment test kapsamı; paketli OS kabulü ayrıca BLOCKED |
| Güncelleme müşteri DB koruma / rollback | **PASS**, izole lifecycle fixture; kurulu EXE ve aktif satış **NOT TESTED** |
| Kaldırma / yeniden kurma / kullanıcı verisi korunması | **BLOCKED**, temiz OS kabulü gerekli |
| Authenticode/SmartScreen | **BLOCKED** — imzasız; uyarısız açılış garantisi yok |

## Veri, kesinti ve mutabakat

| Senaryo | Durum / yöntem |
|---|---|
| SQLite satış/iade/stok/vardiya/KDV | **PASS**: tüm API koşusundaki retailDaily/Shift/Critical/Vat/Credit ve yeni RC testleri |
| İki kasanın son stoğa yarışı | **PASS**, mevcut izole SQLite/API yarış regresyonu; iki fiziksel kasa/gerçek MySQL değildir |
| İstek tamamlanmadan TCP kopması | **PASS**, productionReadiness gerçek loopback TCP; satış yok ve aynı anahtarla retry |
| Commit sonrası yanıt kaybı | **PASS**, aynı anahtarla sonuç kurtarılır, ikinci stok düşümü yok |
| İşlem ortasında süreç öldürme | **PASS**: gerçek test Node süreci SIGKILL; commit öncesi0 satış/stock5, sonrası1 satış/stock4; integrity ok |
| Fiziksel elektrik/disk cache kaybı | **NOT TESTED** — SIGKILL bu koşulu bütünüyle taklit etmez |
| İnternet yokken bağımsız satış/sync | **Eksik / NOT TESTED** — TCP retry testi tam offline satış/outbox değildir |
| Şifreli yedek ve geri yükleme | **PASS**, backupRecovery fixture; müşteri yedeği açılmadı |
| Hatalı migration/update rollback | **PASS**, deploymentLifecycle fixture; gerçek Windows update rollback ayrı BLOCKED |
| SQLite–MySQL veri eşitliği, gerçek MySQL8 yarışı/restore | **BLOCKED** — MySQL8 listener/ortam yok; mevcut XAMPP MariaDB10.4.32 eşdeğer kabul edilmedi; var olan MySQL test DB'si değiştirilmedi |

## POS son düzeltmeleri

`RetailPos.jsx:73` F6 ürün aramayı açar (F10 uyumluluğu korunur), F9 barkoda gider; modal/ödeme içinde kısayol odağı çalmaz. F6 ilk odağının Kapat düğmesine gittiği gerçek tarayıcıda görüldü; `DialogShell.jsx` input/data-autofocus önceliğiyle düzeltildi. Son build'de gerçek DOM odağı doğrulandı.

1366×768 CSS viewport'ta15/50/100 ürün için iki modda ana sayfa boyutu sabit kaldı, yalnız sepet kaydı. Klasik sepet görünür alanı427px, görselli182px; önceki görselli yaklaşık132px idi. Sticky başlık, dengelenmiş kart alanı ve44px birim fiyat kontrolü eklendi. Toplam ve ödeme erişilebilir kaldı. Kanıt: `cart-viewports.json`, `cart-15-classic.png`, `cart-15-visual.png`, `payment-100.png`. PNG'ler tarayıcı zoom/DPR nedeniyle1708×960 piksel; CSS viewport1366×768'dir. 50/100 sepetin DOM geometrisi kaydedildi; her kombinasyon için PNG olduğu iddia edilmez.

Para girişi ve POS/fiş sunumu `1.234,56 TL` biçiminde iki ondalıklıdır. `posMoneyInput.mjs` virgüllü/Türkçe gruplu ve fiziksel klavye noktalı ondalığı canonical string'e çevirir; negatif/bilimsel/çok ondalıklı hatalı tutarı sessiz yuvarlamaz. Backend fiş formatter'ı integer/BigInt kuruşu korur; satış/vergi motoru yeniden yazılmadı. 100 satırlı sepette1.200,00 TL, alınan1.500,50 ve para üstü300,50 görüntülendi; F9 nakit input odağını korudu. Gerçek ödeme başlatılmadı.

**0 TL mevcut politika:** katalog fiyatı0 olan ürün açık vardiyada yetkili kasiyer tarafından satılabilir; stok düşer, nakit0 ve vergi0 olur. Kasiyerin gizli0 fiyat override/100% indirim girişimi403; yönetici yetkisiyle0 override/100% indirim mevcut davranış gereği mümkündür. Yeni RC testleri bu davranışı doğruladı; iş politikası sessizce değiştirilmedi. Pilot öncesi ücretsiz ürün politikasının sahibi tarafından kabulü gerekir.

Tarayıcıda eski fixture'nin aynı origin'deki pending sessionStorage'ı yeni fixture'ye taşınınca erişim hatası ve doğrulama engeli görüldü; yeni sekmeyle son odak testi yapıldı. Bu bir müşteri DB kurtarma kanıtı değildir ve pending/update riskini kapatmaz. Tam hata/offline görsel matrisi henüz tamamlanmış sayılmaz.

## Donanım kabul matrisi

Hiçbir satır **Gerçek cihazda doğrulandı** değildir.

| Cihaz | Durum | Kanıt / kalan iş |
|---|---|---|
| USB/Bluetooth HID barkod okuyucu | **Simülasyonda doğrulandı** | Metin/tekrar/başında0 ve gerçek tarayıcı girişleri; fiziksel bağlantı/firmware kabulü yok |
| Serial/COM okuyucu | **Simülasyonda doğrulandı** | Sanal port/köprü hata-kapanış testleri; gerçek USB sürücüsü yok |
| 58/80mm HTML fiş | **Simülasyonda doğrulandı** | KDV/matrah/toplam ve Türkçe biçim; gerçek baskı ölçüsü/kağıt/driver değil |
| ESC/POS termal yazıcı | **Harici entegrasyon gerekiyor** | Doğrulanmış model adapter'ı ve fiziksel komut çıktısı yok |
| Para çekmecesi | **Harici entegrasyon gerekiyor** | Model/ESC-POS kick ve fiziksel açılış doğrulanmadı |
| Terazi | **Test edilmedi** | Yazılım miktar/stability sözleşmesi regresyonu var; gerçek protokol/kalibrasyon yok |
| Banka ödeme terminali / ÖKC | **Harici entegrasyon gerekiyor** | İç journal ve ödeme beyanı gerçek tahsilat/mali fiş değildir |
| Android el terminali | **Test edilmedi** | Java compile/ZXing optik simülasyon geçti; emulator/ADB/üretici SDK/cihaz yok |

## Dosya bazında değişiklikler

| Dosya | Yapılan |
|---|---|
| desktop/distribution-safety.cjs | WAL/SHM, storage/recovery/backup/keys ve WAL magic guard; CLI |
| desktop/distribution-safety.test.cjs | Düzeltmeden önce başarısız olan yeni sızıntı regresyonu |
| Build-Release.ps1 | ZIP oluşturulmadan guard zorunluluğu |
| desktop/electron-builder.rc.cjs | Yayınsız, imzasız standart NSIS RC output/metadata |
| frontend/src/lib/posMoneyInput.mjs | Türkçe exact sunum ve canonical giriş ayrıştırma |
| frontend/src/lib/posMoneyInput.test.mjs |3 format/yanlış girdi regresyonu |
| frontend/src/components/PosMoneyInput.jsx | Ondalık giriş taslağı, invalid state ve mevcut callback sözleşmesi |
| frontend/src/pages/RetailPos.jsx | Para alanları,44px fiyat düğmesi, F6 |
| frontend/src/pages/PosTerminalUX2.css | Sepet/kart dengesi, sticky başlık, tutar sarmalama |
| frontend/src/components/RetailSalesHistory.jsx | Türkçe para sunumu |
| frontend/src/components/RetailShiftPanel.jsx | Para girişi ve finite doğrulama |
| frontend/src/components/RetailProTools.jsx | Limit/tahsilat para girişi |
| frontend/src/components/ui/DialogShell.jsx | İlk odakta input önceliği |
| backend/src/services/retailReceipt.js | BigInt kuruşu koruyan Türkçe gruplama/iki ondalık |
| backend/src/services/retailShiftService.js | Aynı fiş para formatter'ı |
| backend/tests/releaseCandidate.test.js |6 test:15/50/100 satır, replay/stock/shift,0 TL yetki,exact para |
| backend/tests/retailVat.test.js | Türkçe fiş sunum beklentisi |
| backend/tests/retailShift.test.js | Türkçe fiş sunum beklentisi |
| backend/tests/retailDaily.test.js | Türkçe fiş sunum beklentisi |
| backend/tests/hardwareLab.proof.cjs | Türkçe para beklentileri; assertion korunur |
| tools/customer-experience/run.cjs | Yeni testlerin dahil edilmesi, rc-only seçimi |
| tools/customer-experience/preview.cjs | İsteğe bağlı100 sentetik ürün fixture'si |
| tools/release-candidate/key-inventory.py | Sır yazdırmadan anahtar/arşiv/yedek/Git envanteri |
| tools/release-candidate/build-windows.cjs | Ayrı RC frontend ve Windows build/kanıt |
| tools/release-candidate/crash-worker.cjs | İzole API failpoint test süreci |
| tools/release-candidate/crash-tests.cjs | SIGKILL/WAL doğrulama ve kanıt |
| tools/release-candidate/verify-windows.cjs | NSIS payload içerik/hash/version doğrulama |
| tools/release-candidate/package-smoke.cjs | Bundled Node/API fixture smoke |
| docs/VENIUX_HARDWARE_TEST_REPORT.md | Yeni gerçek laboratuvar koşusuyla güncellendi |
| docs/audits/VENIUX_RELEASE_CANDIDATE_1.md | Bu karar, anahtar geçiş planı ve engeller |
| Önceki readiness/security raporları | Tarihsel bulgular korunarak RC takip bağlantısı eklendi |
| veniux.com.zip → .local/security-quarantine/veniux-source-private-20261019.zip | Geri alınabilir taşıma, içerik/hash aynı; silme yok |

Şema migration'ı, müşteri verisi temizliği, anahtar rotasyonu, mali entegrasyon veya canlı dağıtım yapılmadı. Açık P1'ler için mimari/finansal değişiklikler ve sahip/harici ortam kabulü gerekir; test sonucu uydurularak kapatılmadı.
