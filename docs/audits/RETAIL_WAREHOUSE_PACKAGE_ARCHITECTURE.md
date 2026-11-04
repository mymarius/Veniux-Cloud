# Retail / Warehouse — ön denetim ve uygulama kaydı

19 Ekim 2026. Ön denetim RC2 kabulü ve gerçek kaynaklara dayanır. Canlı veri/lisans dönüşümü, ödeme veya yayın yapılmaz. Bu dosyanın ilk bölümü uygulama öncesi karar kaydıdır.

## Gerçek özellik envanteri

| Alan | Kod ve kanıt | Sunulabilecek sınır |
|---|---|---|
| POS, nakit/kart beyanı, bölünmüş ödeme, iade, vardiya | retailDaily/Shift/Credit/ReportingService; RC2 ödeme testleri | Yazılım kayıt akışı. Kart banka tahsilatı, bilgi fişi mali fiş değildir. |
| Ürün/barkod/stok/tedarikçi | product/stock/warehouse controllers, scannerService | Ortak temel modül; cihaz modeli garantisi yok. |
| Lot/SKT/FEFO | retailVat/Cost, WMS lot operations ve API testleri | Yazılımsal kontrol. Fiziksel terminal/kamera kabulü ayrı. |
| Mal kabul, raf, transfer, sayım | normalDepo/wms route ve WMS servisleri | Warehouse ürün ailesi. SmartCount tam kalıcı offline görev/sync diye satılamaz. |
| Firma/depo erişimi | authMiddleware/accessScope/scopeQueryContext | Tenant ve rol kontrolü korunmalı; paket rol yetkisini aşamaz. |
| Windows/Android | Electron/NSIS, Java WebView, ortak API | RC2 temiz Windows ve gerçek cihaz engelleri sürer. |
| Offline | merkezi lisans gate fail-closed; legacy imzalı önbellek sınırlı | Yeni paketler için güvenli merkezi offline lease yok; kesintisiz offline satış pazarlanmaz. |
| Şube | Ayrı şube kaydı ve kota modeli kanıtlanmadı | Depoyu şube diye yeniden adlandırıp hak uygulanmış iddiası yapılmaz. Ayrı tasarım/kabul engeli. |

## Güvenli paket matrisi (önerilen yeni sözleşmeler)

| Paket | Modüller | Kullanıcı / depo / kasa / cihaz |
|---|---|---|
| Retail Start | Ortak stok + POS |5 /1 /1 /3 |
| Retail Pro | Start + cari/veresiye |15 /3 /3 /10 |
| Retail Business | Pro, geniş kapasite |50 /10 /10 /30 |
| Warehouse Start | Ortak stok + WMS |5 /1 /0 /3 |
| Warehouse Pro | WMS, lot/SKT |15 /3 /0 /10 |
| Warehouse Enterprise | Geniş WMS kapasitesi |250 /50 /0 /100 |
| Unified | POS + cari + WMS + lot |250 /50 /50 /100 |

Lot/SKT güvenlik kontrolleri mevcut satışlarda paket düşüşüyle kapatılmaz; ayrı lot ekranının erişimi ile güvenli satış kontrolü farklıdır. Mevcut legacy planların hakları bu matrise otomatik eşlenmez. Varsayılan fiyatlar **belirlenmemiş**: aylık/yıllık seçim teklif içindir; yönetici taslak tarife oluşturabilir. Ödeme altyapısı etkinleştirilmez.

## Mimari karar

- Yeni katalog ve talep metadata'sı mevcut workspace_collections üzerinde ayrı korumalı settings adlarıyla tutulabilir; şema migration'ı ve müşteri verisi taşıması gerekmez.
- Yeni lisans sözleşmesi immutable, sürümlü hak snapshot'ı olmalı. Katalog değişikliği eski snapshot'ı değiştirmemeli. Bilinmeyen/bozuk sözleşme fail-closed olmalı; legacy sözleşme yolu ayrı kalmalı.
- API hakları auth sonrası tenant bağlamında uygulanmalı. UI menüsü tek güvenlik sınırı olamaz. Kaynak sayısı/kota kontrolü aynı yazma transaction'ında olmalı; ön kontrol yarışı yeterli değildir.
- Paket düşüşü kayıt silmez; kullanım aşımı, açık vardiya, son lisans revision'ı incelenir. Değişiklik talebi otomatik lisans değişikliği değildir; ayrıca yetkili onay gerekir.
- Merkezi PHP issuer ve istemci açık anahtar/plan protokolü yeni snapshot'ı uçtan uca desteklemeden yeni paketler merkezi/offline dağıtıma hazır sayılmaz. Özel anahtar değişikliği bu işin parçası değildir.

RC2'nin imza, temiz OS, snapshot şifreleme, merkezi yönetim erişimi, pending/update ve mali/donanım engelleri korunur. Son uygulama ve test sınırları takip bölümlerine eklenecektir.

## Uygulanan yerel paket altyapısı

Bu çalışma **yerel kaynak uygulamasıdır**. Merkezi issuer'a ve gerçek Windows/Android dağıtımına hazır, bütün engelleri kapanmış ticari sürüm değildir.

### Katalog ve sözleşme

`backend/src/config/productPackages.json` yedi temel paketin sürüm1 seed kataloğudur. Warehouse Start da temel WMS lot kayıtlarını içerir; üst Warehouse paketleri mevcut doğrulanmış modüllerde kapasite artırır. Yeni ve kanıtlanmamış özellikler üst pakete yazılmadı. `productPackages.validatePlan` aile/modül uyumunu, integer kuruş fiyatları,0–80 indirim yüzdesini ve sınırlı integer kapasiteyi doğrular. Temel paket silinemez; yeni tekliflere kapatılabilir. Yeni aileye uygun custom plan eklenebilir.

Katalog değişiklikleri `workspace_collections(scope=settings,name=product_packages_v1)` içinde kanonik platform sahibi tenant'ında saklanır. Transaction + revision çakışma kontrolü vardır. Katalog kaydı mevcut licenses satırlarını değiştirmez. Ayrı DB migration'ı veya üretim DB taşıması yapılmadı.

Yeni lisans `enabled_features_json.product_package` altında immutable hak snapshot'ı taşır: version/code/family/name/catalogue_revision/modules/limits. Eski `module_type=NORMAL` sözleşmesi korunur; ürün ailesi bu eski alana sıkıştırılmadı. Yeni kodlu ama snapshot'ı olmayan, bozuk sürümlü veya plan koduyla uyuşmayan sözleşme reddedilir. Katalog sonradan genişletilirse eski lisans otomatik hak kazanmaz. Legacy lisanslara otomatik snapshot eklenmez.

### Sunucu ve istemci erişimi

- `authMiddleware` kimliği ve tenant'ı doğruladıktan sonra paket haklarını DB'den okur. POS, WMS ve cari API grupları ayrı kontrol edilir. WMS terminal/normal-depo alias'ları da eşleştirildi. Mevcut rol, firma/depo kapsamı, KDV ve satış doğrulamaları korunur.
- `database.js:90,108` aktif yazma transaction'ında kullanıcı/depo/kasa/kayıtlı cihaz INSERT'lerini denetler. SQLite kaynak ekleme yazımları aynı serialize transaction yoluna alınır; MySQL mevcut mutex/transaction yolunu korur. Kota sayımı bütün tenant'ı kapsar; dar depo okuma kapsamı sayıyı düşüremez. Bu kontrollü iç sayımın sonunda gerçek INSERT'in mevcut tenant/depo doğrulaması devam eder.
- Mevcut Ana kasa için tekrarlanan ON CONFLICT oluşturma kotada ikinci kasa sayılmaz. Kaynak silinmez veya kullanılmakta olan kaydı azaltmak için veri temizliği yapılmaz. Kullanıcı ve kasa/depo kotaları toplam kayıt sayısını kullanır; kayıt pasifleştirmek otomatik koltuk boşaltma garantisi değildir.
- Cihaz etkinleştirmesinde mevcut `licenseService` max_devices kontrolü korunur. Kayıtlı warehouse_devices için ayrıca aynı sayısal cihaz tavanı uygulanır. Bu iki envanter fiziksel cihaz kimlikleriyle birleştirilmiş tek sayaç değildir; Windows/PDA kayıtlarını tek fiziksel koltuk diye pazarlama. Farklı UID ile aynı fiziksel cihazın tanınması bu kapsamda doğrulanmadı.
- `/auth/me` yeni snapshot'ı istemciye verir. React ProtectedRoute pakette olmayan POS/WMS ekranını reddeder; API kontrolünün yerine geçmez. LicenseTab katalog ve teklif talebini gösterir. Java/Electron lisans protokolü değiştirilmedi; paketli OS kabulü yapılmadı.

Kota guard'ı mevcut first-party parametrik INSERT biçimlerine bağlıdır. Yeni import/upsert/bulk/raw adapter yazma yolları eklenirken bu kontrat test edilmelidir. Kullanıcıya genel SQL yazma hakkı verilmedi; bütün olası eklenti/DB yönetici müdahaleleri için bir sandbox sertifikası değildir.

### Değişim, düşürme ve yenileme

Müşteri `POST /api/packages/requests` ile aylık/yıllık teklif/değişim talebi açar. Tenant, actor, katalog revision ve fiyat/indirim snapshot'ı kaydedilir; lisans ve veri değişmez. Talep kuyruğu tenant bazında izoledir. Fiyat boşsa teklif tutarı null kalır; sahte0 TL tahsilat oluşturulmaz.

Yalnız platform yöneticisinin açık manuel atama yolu `POST /api/packages/admin/assign` vardır. Müşteri onay referansı, tam onay ifadesi, beklenen son lisans ID'si, katalog revision ve gün süresi gerekir. Yanlış revision/ID409; onaysız istek400. Açık vardiya veya yeni sınırın üzerindeki kullanım409 üretir. Tek transaction eski aktif lisansı kapatıp yeni snapshot yazar ve audit kaydı oluşturur. Görev boyunca bu yol yalnız disposable test tenant'larında çalıştırıldı; gerçek lisanslar değiştirilmedi. Onay referansı bir müşteri e-imza sistemi değildir; platform yöneticisinin kayıt sorumluluğu sürer.

`nextExpiry` UTC tarihleri kullanır. Paket değişimi kalan bitiş süresini kısaltmaz; yenileme daha ileri olan mevcut bitiş/şimdi üzerine gün ekler. Süre dolumu sunucuda kontrol edilir; arayüzdeki tarih/önbellek hak vermez. Geçersiz/zamanı dolmuş sözleşme423 ile kapanır. İşlem tipi ve kalan süre UI'da açıklanır.

Veri satırları ve geçmiş silinmez. Modül kaldırıldığında eski ekranın erişimi kapanabilir; lisans geri verilince veriler yerinde kalır. WMS açık görevlerinin düşüş öncesi ayrıntılı devir/readonly-arşiv kabulü ve sekme kaybında POS pending mutabakatı tamamlanmış değildir. Bu nedenle genel müşteri paket düşüşü otomasyonu hazır sayılmaz; talepler otomatik uygulanmaz.

## Yönetici ve satış ekranları

Platform kontrol merkezinde:

- Üç ailede yeni paket taslağı; ad, aylık/yıllık TL fiyat, indirim, modüller, kullanıcı/depo/kasa/cihaz kapasiteleri ve yeni tekliflere açıklık düzenlenir.
- İstemci TL girişi Türkçe iki ondalık, kalıcılık integer kuruştur. Tarife1.234,56 girilip sentetik katalogda kaydedildiği gerçek UI'da doğrulandı.
- Müşteri lisans envanteri, paket talepleri ve reviewing/quoted/declined/closed durumları görüntülenir. Talep durumu lisansı değiştirmez. Onaylı atama ayrı form/son onay gerektirir.
- Mevcut POS satış/fatura taslak istatistikleri korunur. Paket talepleri en çok300 kayıt olarak gösterilir; collected revenue veya web sitesi lead toplamı diye adlandırılmaz. PHP web form kuyruğu ve Node paket talepleri henüz aynı satış CRM'i değildir.
- Ek kapasite yeni sürümlü custom paket/kontrat üzerinden tanımlanabilir. Oransal fatura/prorata/otomatik ödeme ve bağımsız add-on SKU sistemi yapılmadı. Şube kaydı/kotası yok.

Web'de `/retail`, `/warehouse`, `/unified` eklendi. Retail ve Warehouse üçer kart; Unified birleşik teklif sunar. Aylık/yıllık seçim, karşılaştırma, FAQ, demo/teklif bağlantıları, mevcut CSRF/rıza/durable form ve canonical/sitemap kullanılır. Yeni sayfa listesi mevcut sayfaları yeniden oluşturmaz. Kartlar mavi/turuncu kimlik ve mevcut Manrope fontunu kullanır; görsel/donanım başarısı uydurulmaz.

**Fiyat ve yayın sınırı:** Yeni aile fiyatları seed'de null ve teklif esaslıdır. Eski legacy3 aylık/yıllık fiyatlar ve mevcut kayıt akışı değiştirilmedi. Yönetici kataloğu Node DB'sinde, PHP kamu sayfası sürümlü yayın snapshot'ı `website-php/product-packages.json` içindedir. Bu snapshot seed ile parity testine tabidir; katalog yönetimi hosting PHP dosyasını otomatik güncellemez. Yeni onaylı tarifelerin private export/deploy doğrulaması ve iki sistem arası yayın iş akışı hâlâ gerekir. Tek merkezli canlı fiyat senkronizasyonu tamamlandı denemez; bu tur fiyat veya kod canlıya yayınlanmadı.

## Gerçek test kanıtları

Kanıt kökü `.local/product-packages/`. Kümeler kesişir, toplam başarı yüzdesi hesaplanmadı.

| Kontrol | Gerçek sonuç | Kanıt |
|---|---|---|
| Son tüm kök API/SQLite | **760 PASS /0 FAIL**,95 grup | `.local/customer-experience/run-cf1605b0f4a40e77/jest.json`, commands.json |
| Ortak sunum/dağıtım | **51 PASS /0 FAIL /0 SKIP**, frontend build exit0 | aynı koşunun presentation.log ve frontend-build.log |
| Gerçek MySQL8.4.6 | **29 PASS /0 FAIL**,5 grup | mysql-jest.json, mysql-results.json;18 RC2 +11 yeni paket testi |
| RC2 test adlarının korunması |749 API ve18 MySQL örneği dosya+ad+tekrar sayısıyla tamamen korundu | regression-comparison.json; eksik/başarısız baseline0 |
| PHP yeni aileler | **PASS**: seed parity,3 sayfa ×2 dönem,7 CSRF korumalı durable teklif | site-tests.json; bildirimler kapalı, sentetik kuyruk silindi |
| Eski PHP hesap/doğrulama | acceptance exit0 | legacy-accounts.log, legacy-site-results.json |
| Eski dört form dönüşümü | acceptance exit0 | legacy-conversion.log; demo/quote/contact/partnership |
| Çerez/dönüşüm birim testleri |8 PASS | legacy-consent.log |
| Görsel kontrol | Retail/Warehouse desktop+mobile; yönetici7fieldset, Türkçe tutar kaydı | web-viewports.json, admin-visual.json, PNG'ler |

Yeni11 test: plan doğrulaması; yetkisiz katalog düzenleme/revision yarışı; aileler arası API reddi; eşzamanlı kullanıcı sınırı; tenant talep izolasyonu/izinli atama; terminal WMS alias'ı/bozuk sözleşme; kapasite üstü düşüş ve açık vardiya reddi; imzalı payload hak değişikliği reddi; süre koruyan değişim/yenileme; depo/kasa/kayıtlı cihaz kotası; immutable snapshot ve expiry.

İlk gerçek MySQL paket koşusu21 PASS/3 FAIL: yeni atama ISO timestamp'ı DATETIME alanına yazamıyordu; diğer iki hata bunun zincirleme sonucuydu. SQL UTC biçimine dönüştürülerek ve expiry UTC normalizasyonuyla düzeltildi. İlk kanıt `mysql-attempt-1/` içinde; assertion silinmedi/atlama yapılmadı. Sonraki27/28 ve son29 PASS koşuları eski çıktının yerine tek kanıt gibi sunulmadı; ara JSON/loglar saklandı.

Görsel genişlikler gerçek DOM'dan ölçüldü: web1367×900 ve390×841 CSS viewport; mobil kartlar334,573px tek sütun, document width378. Aylık seçim aria-current=true oldu; aksiyonlar yaklaşık49px yüksek. Yerel yönetimde eski üst tablo mobil sayfayı443px'e taşıyordu; kapsayıcı clip/min-width düzeltmesi sonrası390px viewport'ta belge385px ve7fieldset doğrulandı (`run-521af0e6f65c65d6` UI build). Renewal selector bundan sonra eklendi ve final frontend build'de derlendi; onun ayrı görsel kabulü yapılmadı.

Tam sayfa screenshot aracı bazı PNG'leri kırptı; bunlar fiziksel1367px kanıtı sayılmaz. Native viewport kayıtları `retail-desktop-viewport.png`, `retail-mobile-viewport.png`, `warehouse-desktop.png`, `warehouse-mobile.png`, `admin-desktop-final.png`, `admin-mobile-final.png` esas görsel kanıttır. Gerçek cihaz/OS testi değildir.

## Kalan engeller ve yayın kararı

| Alan | Durum | Sonraki adım |
|---|---|---|
| Yerel katalog/API, hak snapshot'ı ve kota | **PASS**, test kapsamı | Kaynak incelemesi ve kontrollü staging kabulü |
| Yerel web teklif demosu | **PASS** | Tarifeyi/ürün kapsamını yetkili işletme kararıyla kesinleştir |
| Merkezi PHP issuer yeni plan protokolü | **BLOCKED** | Issuer hâlâ3 legacy plan kabul ediyor; yeni family/kota snapshot ve istemci protokolü uçtan uca staging'de test edilmeli. Merkezi modda yeni manuel atama409/fail-closed. |
| Yeni paketlerin Windows/Android dağıtımı | **BLOCKED** | Yeni EXE/APK üretilmedi; QR companion merkezi plan lookup'ı yeni kodları tanımıyor. Kaynak testlerini kurulu uygulama kabulü sayma. |
| Offline Windows yeni hak lease'i | **BLOCKED / fail-closed** | Yeni merkezi offline lease/clock rollback/revocation sözleşmesi yok. İmza değiştirme testi yalnız payload bütünlüğünü gösterir; tam offline satış değildir. Anahtarlar değiştirilmedi. |
| Şube ve birleşik fiziksel cihaz koltuğu | **Eksik** | Ayrı şube modeli, mevcut depolarla ilişki, kotaya dahil etme ve fiziksel kimlik kabulü tasarlanmalı; depoyu şube diye sayma. |
| PHP↔Node fiyat/katalog yayını | **Kısmi** | Snapshot dağıtım/export ve revision uyum kontrolü staging'de tamamlanmalı. Bu tur otomatik senkronizasyon yapılmadı. |
| Açık WMS görevleri/pending işlemde paket düşüşü | **Kısmi** | Görev devri/readonly geçmiş, update ve kesinti kabulü; otomatik düşürme yok. |
| RC2 güvenlik/dağıtım/mali engelleri | **AÇIK** | Anahtar olay kapanışı, şifreli deployment snapshot, imza, temiz Win10/11, merkezi yönetim erişimi, fiziksel kasa/ÖKC/banka kabulü. RC2 raporu aynen geçerlidir. |

**Sonuç:** Yerel kaynakta iki ayrı ürün ailesi, birleşik teklif, sürümlü paket yönetimi ve gerçek API sınırları uygulanıp test edildi. Genel ticari aktivasyon, merkezi/offline yeni aile dağıtımı ve bütün hedef işletme akışları tamamlanmış değildir. Demo PASS (yerel/sentetik), gerçek müşteri pilotu BLOCKED, genel ticari satış FAIL. Canlı yayın, gerçek tahsilat, müşteri verisi temizliği ve gerçek lisans değişimi yapılmadı.

## Dosya bazında değişiklikler

| Dosya | İşlev |
|---|---|
| backend/src/config/productPackages.json | Yedi temel plan, modül/kota ve teklife bağlı tarife seed'i |
| backend/src/services/productPackages.js | Katalog, immutable snapshot, erişim, kota ve süre hesabı |
| backend/src/routes/packageRoutes.js | Katalog/talep/yönetici inceleme ve açık onaylı yerel atama API'si |
| backend/src/index.js | Yeni korumalı route mount |
| backend/src/config/database.js | Gerçek kaynak yazma transaction'ında kota guard |
| backend/src/middlewares/authMiddleware.js | Yeni paket API doğrulaması ve kontrollü hata kodu |
| backend/src/middlewares/licenseMiddleware.js | Yeni sözleşme limitlerini legacy fallback'ten ayırma |
| backend/src/services/customerSetupService.js | Yeni plan özetini snapshot'tan okuma |
| backend/src/controllers/authController.js | /auth/me snapshot alanı |
| backend/src/controllers/settingsController.js | Kota hatasının HTTP durumunu koruma |
| backend/src/controllers/warehouseController.js | Kota hatasının HTTP durumunu koruma |
| backend/src/controllers/terminalController.js | Kayıtlı cihaz kota hatasının HTTP durumunu koruma |
| backend/tests/productPackages.test.js |11 yeni API/DB/crypto/lifecycle regresyonu |
| frontend/src/App.jsx | İstemci POS/WMS rota koruması |
| frontend/src/components/ProductPackageAdmin.jsx | Katalog ve talep/lisans yönetimi |
| frontend/src/components/ApprovedPackageAssignment.jsx | Açık onaylı plan değişimi/yenileme formu |
| frontend/src/components/ProductPackageSelection.jsx | Müşteri teklif talebi |
| frontend/src/pages/ApiManagement.jsx | Yönetici entegrasyonu ve mobil tablo kapsayıcı düzeltmesi |
| frontend/src/pages/settings/LicenseTab.jsx | Müşteri paket ekranı entegrasyonu |
| website-php/product-packages.json | Yayın snapshot'ı; seed parity kontrolü |
| website-php/package-family.php | Güvenli teklif plan çözümleme |
| website-php/package-family-view.php | Üç ürün ailesinin sayfaları |
| website-php/assets/package-family.css | Mavi/turuncu responsive erişilebilir görünüm |
| website-php/pricing.php | Legacy seçimle uyumlu yeni plan seçimi |
| website-php/index.php | Route/meta/sitemap/teklif görünümü ve navigasyon |
| website-php/footer.php | Ürün ailesi bağlantıları |
| tools/release-candidate/package-mysql.cjs | Yeni testleri içeren ayrı MySQL laboratuvarı |
| tools/release-candidate/package-mysql-environment.cjs | Kesin test hedefi/config guard |
| tools/release-candidate/package-site.cjs | PHP sayfa/CSRF/teklif kabulü |
| tools/customer-experience/preview.cjs | Yalnız --packages test bayrağında sentetik platform yöneticisi |
| docs/audits/RETAIL_WAREHOUSE_PACKAGE_ARCHITECTURE.md | Ön denetim, gerçek matris, uygulama ve kalan sınırlar |

Kapanış temizliği: MySQL normal SHUTDOWN ile kapandı; yalnız bu görevin yeni MySQL datadir kopyaları, iki önizleme DB/PEM dizini ve bu tur üretilen PHP sentetik hesap/form klasörleri kaldırıldı. Log/JSON/PNG kanıtları korundu (`cleanup.json`). Eski müşteri/test klasörleri, karantina, issuer anahtarları ve üretim verisi değiştirilmedi. RC2'den kalan portable MySQL binary önbelleği korundu. Tarayıcı test sekmeleri kapatıldı ve viewport override sıfırlandı.
