# Veniux Cloud — Ticari platform dönüşümü

19 Ekim 2026. Bu rapor yerel kaynak uygulamasını ve bu tur çalıştırılmış testleri kapsar. Canlıya kod/fiyat yayımlanmadı, üretim DB/lisans/anahtar değiştirilmedi, ödeme alınmadı. Gerçek müşteri bilgisi kullanılmadı.

## 1. Başlangıç ve kapsam

Mimari PHP web/lisans merkezi + Node API + React + Electron/NSIS + Java Android olarak korunuyor. Laravel/Blade yok. Önceki RC2 raporu, paket mimarisi raporu, gerçek kaynak ve test kaynakları incelendi. Önceki turda oluşturulmuş yedi paketli katalog, immutable lisans snapshot'ı, transaction içi kota koruması ve yönetici ekranı yeniden geliştirilmedi.

Başlangıçta `/retail`, `/warehouse`, `/unified` teklif sayfaları vardı; ana sayfa hâlâ ortak stok/depo tanıtımıydı. Ayrı ürün/fiyat adresleri ve `/demo` yoktu. Yeni paketlerin fiyatları null idi. PHP yayın kataloğu Node yönetici kataloğundan otomatik eşitlenmiyordu. Bu son eksik hâlâ vardır.

### Gerçek özellik ve doğrulama envanteri

| Bileşen | Durum | Kaynak / sınır |
|---|---|---|
| Ürün, barkod, stok, depo kayıtları | Çalışıyor; yazılım regresyonuyla doğrulandı | `backend/src/controllers/`, stock/product/warehouse testleri; gerçek okuyucu kabulü ayrı |
| POS sepet, vardiya, satış, iade, para/KDV, idempotency | Çalışıyor; API/DB seviyesinde doğrulandı | retail servisleri; `rc2Payments`, retailCritical/Vat/Shift; yerel kart beyanı banka tahsilatı değildir |
| Görselli bağımsız POS terminali | Çalışıyor; yerel UI açıldı | `frontend/src/pages/RetailPos.jsx`, yeni sentetik ekran görüntüsü; bu tur satış yapılmadı |
| Cari/veresiye | Yazılım testleri var | Retail Pro/Business ve Unified katalog modülü; gerçek işletme mutabakatı ayrı |
| Mal kabul, raf, transfer, sayım, lot/SKT | Yazılım akışları ve API testleri var | normalDepo/WMS servisleri ve testleri; mal kabul UI boş kuyrukla açıldı |
| FIFO/FEFO, ABC | Kod mevcut; her ticari kullanım için genel kabul verilmedi | `inventoryReservationService.js:21`, `wmsSlottingService.js:8`; WarehouseTab strateji seçimi hâlâ önizleme. Pazarlamada her akışa uygulanmış kural diye sunulmadı |
| SmartCount | Kısmen tamamlandı | WMSCycleCount istemci taslakları; tam offline görev/senkronizasyon garantisi verilmedi |
| Tenant/rol/depo izolasyonu, paket kotası | Yerel yazılım testleriyle doğrulandı | productPackages/authMiddleware/database guard; yeni API ve gerçek MySQL koşuları aşağıda |
| Çoklu kasa/depo/kullanıcı | Sınırlı yazılım kabulü var | Paket transaction koruması; kapasite kaydı fiziksel terminal sertifikası değildir |
| Çok şube | Eksik | Ayrı şube modeli/kotası yok. Depo, şube diye pazarlanmadı |
| Üyelik, giriş, e-posta doğrulama, indirme erişimi | Mevcut akış korundu | `accounts.php`; sentetik kayıt/giriş/parola/CSRF/download testi geçti. Gerçek SMTP teslimi doğrulanmadı |
| Demo/teklif kuyruğu | Çalışıyor; geliştirilip test edildi | `contact.php`; private JSON, pending durumu, CSRF, honeypot, süre sınırı, tek kullanımlık dönüşüm |
| Başvuru durumunu müşterinin çevrimiçi takip etmesi | Eksik | pending iç kayıt vardır; müşteriye açık takip portalı ve site taleplerini birleştiren CRM yapılmadı |
| Paket yönetici ekranı | Önceki yerel uygulama korundu | ProductPackageAdmin, ApprovedPackageAssignment; gerçek müşteriye paket atanmadı |
| Windows ve Android dağıtımı | Doğrulama bekliyor | Bu tur EXE/APK üretilmedi; temiz OS/gerçek Android cihaz kabulü yok |
| Yeni aileler için merkezi/offline lisans | Eksik / güvenli kapalı | PHP issuer protokolü yeni snapshot'ı desteklemiyor; offline lease/revocation/clock rollback tamamlanmadı |
| GA4/GSC | Yapılandırma/hesap kabulü bekliyor | İzinli olay tasarımı hazır; gerçek GA4 alımı, GSC indeks durumu veya sıralama başarısı iddia edilmedi |

## 2. Uygulanan web dönüşümü

- Ana başlık ve açıklama istenen Retail + depo konumlandırmasına geçirildi. İlk ekranda iki çözüm bağlantısı, devamında iki açıklayıcı çözüm kartı ve Unified bağlantısı var.
- `/market-pos`, `/market-pos/fiyatlandirma`, `/depo-yonetimi/fiyatlandirma`, `/demo` eklendi. Mevcut `/depo-yonetimi` adresi korunup Warehouse detayına dönüştürüldü. `/fiyatlandirma` yeni aileleri keşfetme alanını ve **mevcut üç aylık/yıllık tarifeyi** birlikte sunuyor.
- `/retail` ve `/warehouse` eski adresleri yeni karşılıklarına 301 yönlenir; sondaki slash ve geçerli dönem seçimi korunur. Eski stok/lot/rehber/indirme adresleri silinmedi.
- Aile sayfalarında aylık/yıllık seçim, gerçek modül ve kapasite karşılaştırması, FAQ, demo ve teklif CTA'sı var. Retail satış/iadeye, Warehouse kabul/lokasyon/lot akışına odaklanıyor.
- Mavi/turuncu marka, mevcut Manrope fontu ve tema sistemi korundu. Yeni bağımlılık eklenmedi. Yeni alanlar düşük hareketli; reduced-motion tercihi korunuyor.

## 3. Yeni ürün ve paket yapısı

Merkezi kodlar ve önceki matris korunuyor:

| Paket | Modül | Kullanıcı / depo / kasa / cihaz tavanı |
|---|---|---|
| Retail Start | stock + pos | 5 / 1 / 1 / 3 |
| Retail Pro | stock + pos + credit | 15 / 3 / 3 / 10 |
| Retail Business | stock + pos + credit | 50 / 10 / 10 / 30 |
| Warehouse Start | stock + wms | 5 / 1 / 0 / 3 |
| Warehouse Pro | stock + wms | 15 / 3 / 0 / 10 |
| Warehouse Enterprise | stock + wms | 250 / 50 / 0 / 100 |
| Unified | stock + pos + wms + credit | 250 / 50 / 50 / 100 |

**İstenen pazarlama listesinin tamamı bağımsız plan yetkisi değildir.** Görselli POS, iade, güvenli lot kontrolü gibi mevcut işlemler yalnız Pro diye yeni kapatılmadı. SmartCount, terazi ve ABC için ayrı fine-grained entitlement kabulü yok. Üst planların kanıtlanmış farkı modül + kapasitedir. Çok şube, özel entegrasyon ve destek SLA'sı hazır özellik olarak yazılmadı. Enterprise özel kapsam sözleşme/kabul gerektirir. Cihaz etkinleştirme ve kayıtlı PDA sayımları fiziksel cihaz havuzuna tekilleştirilmiş değildir.

## 4. Fiyatlandırma taslağı ve mevcut fiyat karşılaştırması

`docs/audits/COMMERCIAL_PRICING_DRAFT.json` **DRAFT_NOT_APPROVED** durumundadır. Web root dışındadır; public PHP/Node kataloglarına yüklenmez. Admin/üretim fiyatı veya müşteri sözleşmesi otomatik değişmez.

| Taslak | Aylık KDV hariç | Aylık %20 KDV dahil | İndirimsiz 12 ay KDV hariç |
|---|---:|---:|---:|
| Retail Start | 790,00 TL | 948,00 TL | 9.480,00 TL |
| Retail Pro | 1.490,00 TL | 1.788,00 TL | 17.880,00 TL |
| Retail Business | 2.990,00 TL | 3.588,00 TL | 35.880,00 TL |
| WMS Start | 1.290,00 TL | 1.548,00 TL | 15.480,00 TL |
| WMS Pro | 2.490,00 TL | 2.988,00 TL | 29.880,00 TL |
| WMS Enterprise | Özel teklif | Teklif | Teklif |
| Unified | 3.490,00 TL'den | 4.188,00 TL'den | 41.880,00 TL'den |

Yıllık indirim onaylanmadığı için taslakta %0 ve `annual_discount_approved:false` kullanıldı; %10 senaryosu yalnız aritmetik testidir. BigInt kuruş hesabı ve yarım kuruşu yukarı yuvarlama test edildi. Public teklif hesapları da integer indirim uygular; yıllık fiyatı aylık değerle karıştırmaz.

19 Ekim'de [canlı fiyat sayfası](https://veniux.com/fiyatlandirma) yalnız GET ile okundu (200): Başlangıç **3.588**, İşletme **7.188**, Kurumsal **14.388 TL/yıl, %20 KDV dahil**; aylık karşılıkları 299/599/1.199 TL. `.local/commercial-platform/live-pricing.html` ve `live-pricing-result.json` kanıttır. İlk sandbox isteği proxy bağlantısı nedeniyle başarısızdı; izinli okuma başarılı oldu. Yeni öneriler ayrı ürün/kapsam ve vergi tabanına sahiptir; eski müşterilere oranlanarak zam uygulanmadı. Yeni rakamlar onaylanıp yayına alınmadıkça genel sayfalarda **teklif isteyin** gösterilir.

## 5. Gerçek ekranlar ve performans

Güncel React derlemesi `run-02273c17a29fa205` ve yalnız bu tur oluşturulmuş sentetik fixture açıldı. POS görselli mod, ürün paneli ve boş mal kabul kuyruğu gerçekten görüntülendi; bunlar çizilmiş maket değildir. POS'ta Gıda kategorisi seçildi; vardiya açılmadı, satış/tahsilat yapılmadı. Ekrandaki kişi adı da sentetiktir.

- `product-retail-v1.jpg`:1320×768,125.249 bayt; bağımsız kasa terminali.
- `product-stock-v1.jpg`:1315×765,107.762 bayt; ortak stok paneli.
- `product-warehouse-v3.jpg`:1320×768,72.612 bayt; boş mal kabul kuyruğu.

PNG kaynaklar kanıt klasöründe tutuldu; yalnız JPEG format/sıkıştırma dönüşümü yapıldı, upscale veya sahte içerik ekleme yok. Görseller büyütülmeden, lazy loading/async decoding ve doğru intrinsic ölçülerle sunulur. Screenshot aracı sağ kenarı kırpmış olabilir; gerçek PNG ölçüsü kullanıldı,1366px tam OS ekranı iddiası yapılmadı. Bazı native canlı önizleme PNG'leri düşük netlikteydi; ürün varlıklarında daha okunabilir DOM çekimleri seçildi. Eski terminal görseli mal kabul simülatörüydü; yeni Retail tanıtımında kullanılmaz.

Mobil390×840 CSS ölçüsünde altı sayfanın document genişliği378px; yatay taşma görülmedi. Masaüstü1366×857 ölçüsünde document1354px, çözüm kartları iki600px sütunda; yeni ana CTA'lar51px yüksekliğinde. Form aile değişiminde yanlış paketi temizler, ilgili çözümü seçer ve eski teklif özetini gizler. Kanıt: `mobile-layout.json`, `desktop-layout.json`, `form-ui.json`, PNG'ler.

**Core Web Vitals/Lighthouse saha ölçümü yapılmadı.** HTTP kabulü, dosya boyutu ve DOM taşma kontrolü LCP/INP/CLS başarısı veya ekran okuyucu sertifikası değildir. Gerçek düşük donanım/mobil tarayıcı, koyu tema tam sayfa kontrast ve yardımcı teknoloji kabulü ek kapıdır.

## 6. SEO

Yerel tam SEO kabulü21 kanonik sayfada200, benzersiz title, meta, canonical, tek H1, schema, robots/sitemap ve gerçek404 kontrol etti. Redirect alias'ları sitemap'ten çıkarıldı. Pazarlama ürünlerine SoftwareApplication eklendi; mevcut Organization/WebSite/Breadcrumb yapısı korundu. Yeni Retail ve mevcut depo/stock OG görselleri gerçek ekranlara bağlandı. Login/kayıt/indirme kapıları korunuyor.

Bu kaynak henüz deploy edilmedi. Yerel indexable test ayarı üretim başarısı değildir. Googlebot erişimi, GSC mülk erişimi ve URL Inspection canlı sonuçları bu tur doğrulanmadı; indekslenme/organik trafik garantisi yok.

## 7. Demo, teklif ve analitik

Tek form korunuyor: ürün ailesi, isteğe bağlı paket/dönem, mevcut işletme/iletişim/çözüm alanları ve1200 karaktere kadar kısa ihtiyaç. Paket seçilmeden veya aileye karar verilmeden de başvuru yapılabilir. Paket/aile uyumsuzluğu API yerine **PHP sunucusunda** da422 verir; JS kapalı olsa kontrol korunur. Başarısız formda ihtiyaç metni1200 karaktere kadar korunur. KVKK/gizlilik bağlantıları, consent ve gerçek başarı/hata mesajları var.

Yeni aile ve ihtiyaç, web root dışındaki private kayıtla `status=pending` olarak saklanır. CSRF403, honeypot400, geçersiz seçim422, geçerli tekrar için60sn429 ve kullanılmış token403 test edildi. SMTP kapalıyken gönderildi iddiası yok. Site başvurularını Node yönetici ekranında birleştiren CRM ve müşteri durum portalı henüz yok; otomatik bir demo oturumu planlanmış sayılmaz.

| Olay | Tetik / sınır |
|---|---|
| product_view | Retail/Warehouse/Unified ürün sayfası açılışı |
| package_select | İzinli plan seçimi veya teklif CTA'sı |
| demo_start / quote_start | İlgili formun ilk odağı |
| generate_lead + form_type=demo/quote | Başarılı kalıcı kayıt sonrası mevcut tek kullanımlık makbuz |
| partnership_submit | Mevcut ortaklık dönüşümü; korunuyor |

Yeni olaylar da analytics rızası, GPC=false ve mevcut gtag adapter'ı gerektirir. URL/query, ihtiyaç metni, kişi adı, e-posta ve talep ID'si gönderilmez; whitelist path/family/plan ve temiz page_location/referrer kullanılır. Ayrı demo_submit/quote_submit ekleyip aynı lead'i iki kez saymadım. Rıza verilmeden oluşan olaylar sonradan gönderilmez. Gerçek GA4 hesabı/transport veya GSC verisi olmadan ölçüm aktif ilan edilmedi.

## 8. Güvenlik ve lisans

Satış motoru, DB şeması, mevcut lisanslar, issuer anahtarı ve rol yetkileri bu tur değiştirilmedi. Önceki sunucu module/kota/tenant/expiry/snapshot guard'ları korunuyor. UI gizleme güvenlik sınırı değildir. Upgrade/downgrade testleri veri silmeden, kullanım ve açık vardiya kontrolüyle çalışır; katalog düzenlemek eski snapshot'ı değiştirmez.

Yeni ailelerin merkez/offline kapısı kapalı kalır. Çevrimdışı doğrulamaya başarı verilmedi. Pending WMS işleri, downgrade sonrası salt okunur geçmiş, tekilleştirilmiş cihaz havuzu ve şube kotası için ayrıca tasarım/kabul gerekir.

## 9. Bu tur gerçekten çalıştırılan testler

Kanıt kökü `.local/commercial-platform/`; paket MySQL ve API ham çıktıları aşağıdaki yerlerde.

| Test | Sonuç | Kanıt |
|---|---|---|
| Tüm API/SQLite | **760 PASS,0 FAIL**,95 suite | `.local/customer-experience/run-02273c17a29fa205/jest.json` |
| Ortak sunum/scanner/runtime/distribution | **51 PASS,0 FAIL,0 SKIP** | aynı run/presentation.log |
| React production build | exit0 | aynı run/commands.json |
| Gerçek MySQL8.4.6 | **29 PASS,0 FAIL**,5 suite; migration başarılı | `.local/product-packages/mysql-jest.json`, mysql-results/server.log; normal SHUTDOWN |
| RC2 örnekleri korunması |749/749 API ve18/18 MySQL passed | `regression.json`; dosya+test adı+tekrar sayısı karşılaştırıldı |
| Yeni ticari sayfa/form kabulü | **25 kontrol PASS** | site-results.json;8 alt komut exit0 |
| Mevcut tam SEO |21 kanonik sayfa PASS | seo.log |
| Mevcut büyüme/görsel/indirme kontrolü | PASS | growth.log; gerçek boyut/OG/CTA ve erişim kapıları |
| PHP fiyat birim kabulü |12 kontrol PASS | published-price.log |
| Rıza/dönüşüm + yeni taslak/analitik | **11 PASS,0 FAIL,0 SKIP** | analytics.log; eski8+ yeni3 |
| Mevcut hesap kabulü | PASS | accounts.log |
| Demo/teklif/iletişim/ortaklık kabulü |4 form PASS | conversion-acceptance.log; tek makbuz/refresh/replay/no PII |
| Altı mobil sayfa ve form etkileşimi | Sınırlı yerel browser kabulü PASS | mobile-layout/form-ui/desktop-layout JSON |
| Temiz Windows/Android/fiziksel cihaz/banka/ÖKC | **NOT TESTED / BLOCKED** | Bu turun testleri bu sonuçları içermez |

İlk sandbox başlatması alt süreç EPERM nedeniyle test çalıştıramadı (`run-579e31bc1e01ecc0/commands.json`); MySQL init de başlamadı. İzinli tekrar gerçek testleri çalıştırdı. Bu ortam hatası gizlenmedi; test assertion'ı silinmedi veya skip eklenmedi. Kümeler kesişir; test sayıları toplam benzersiz özellik veya hazırlık yüzdesi değildir.

## 10. Değiştirilen dosyalar

| Dosya | Bu turun değişikliği |
|---|---|
| website-php/index.php | Ana sayfa başlığı/ilk çözüm seçimi,4 route, güvenli301, form bileşeni, yeni ekran meta, uzun metin koruma |
| website-php/commercial-home.php | İki ürün kartı ve Unified yönlendirmesi |
| website-php/commercial-product.php | Ayrı Retail/WMS akışı ve gerçek ekranlar |
| website-php/demo-view.php | Kısa demo giriş alanı |
| website-php/commercial-form.php | Aile/paket/dönem seçimi; eski plan seçimini koruma |
| website-php/package-family-view.php | Yeni kanonik detay/fiyat route'ları ve ayrı başlık/CTA |
| website-php/package-family.php | Tek integer indirim hesaplayıcısı; form ve kart fiyat tutarlılığı |
| website-php/contact.php | Opsiyonel boş plan, aile/paket eşleşmesi, ihtiyaç validasyonu ve private kayıt |
| website-php/pricing-view.php | Eski tarifeyi değiştirmeden ürün ailesi seçimi |
| website-php/seo.php | Ürün SoftwareApplication şeması |
| website-php/growth-evidence.php | Gerçek stock paneli görseli |
| website-php/footer.php | Kanonik ürün bağlantıları |
| website-php/assets/commercial.css | Responsive iki çözüm, akışlar, form, ilk ekran seçimi |
| website-php/assets/commercial.mjs | Rızalı whitelist analitik, aile/paket/çözüm seçimi ve eski özet gizleme |
| website-php/assets/site.js | Yeni davranışın mevcut girişe bağlanması |
| website-php/bin/build-assets.cjs | Yeni CSS'nin mevcut hashli paketlere katılması |
| website-php/asset-manifest.php | Son CSS/JS dosya hashleri |
| website-php/assets/main.ec09123ab68c.css | Üretilmiş ana CSS |
| website-php/assets/program.f35707bb502d.css | Üretilmiş indirme CSS |
| website-php/assets/pricing.56abbfb1e148.css | Üretilmiş fiyat CSS |
| website-php/assets/notes.724625764343.css | Üretilmiş notlar CSS |
| website-php/assets/accounts.54473e872725.css | Üretilmiş hesap CSS |
| website-php/assets/site.c0093240e142.js | Üretilmiş site JS; consent paketi değişmedi |
| website-php/assets/product-retail-v1.jpg | Yeni gerçek POS ekranı |
| website-php/assets/product-stock-v1.jpg | Yeni gerçek stok ekranı |
| website-php/assets/product-warehouse-v3.jpg | Yeni gerçek depo ekranı |
| website-php/bin/commercial.test.mjs | Taslak/aritmetik/rıza/PII testleri |
| website-php/bin/commercial-pricing-test.php | PHP public teklif fiyatı testleri |
| tools/release-candidate/commercial-pricing.cjs | Yayın yapmayan taslak vergi/indirim hesabı |
| tools/release-candidate/commercial-site.cjs | İzole server,25 yeni kontrol ve mevcut kabul komutları |
| tools/release-candidate/package-site.cjs | Eski kabulü yeni kanonik route'lara uyarlama; assertion'lar korunur |
| docs/audits/COMMERCIAL_PRICING_DRAFT.json | Yayımlanmayan yapılandırılabilir öneri |
| docs/audits/VENIUX_COMMERCIAL_PLATFORM_UPGRADE.md | Bu rapor |

Ara hashli derlemeler de yerelde oluştu; deploy manifestteki son dosyaları kullanmalıdır. Kaynak dosyaları ile hashli varlıkların farklı sürümünün karıştırılmaması gerekir. Bu rapor Git diff değildir; çalışma alanında Git deposu yok.

## 11. Kalan engeller ve yayın onayları

1. **Yeni ailelerin merkezi lisans protokolü, offline lease ve istemci dağıtımı:** uygulanmış kabul yok. Lisans/anahtar geçişi mevcut hakları koruyan ayrı onaylı çalışma gerektirir.
2. **Şube modeli/kotası, fine-grained tier hakları, PDA/aktivasyon tekilleştirmesi:** eksik. Yeni fiyat/sözleşme bu hakları varmış gibi vaat edemez.
3. **Node yönetici kataloğu → PHP yayın snapshot'ı:** otomatik güvenli yayın akışı yok. Taslak inceleme/fiyat/vergi/yıllık indirim onayı ve yayın adımı gerekir.
4. **Site talep CRM'i, müşterinin durum takibi, gerçek SMTP teslimi ve destek SLA'sı:** tam kabul yok.
5. **RC2 güvenlik engelleri:** anahtar olayının kapatılması/rotasyon onayı, şifreli deployment recovery geçişi, merkezi PHP yönetimi MFA/topoloji kabulü, pending satış/update kurtarma sözleşmesi sürüyor.
6. **Dağıtım ve fiziksel kabul:** imzalı EXE, temiz Win10/11 aktivasyon/update/uninstall/rollback, gerçek Android/okuyucu/yazıcı/terazi/çekmece/banka/ÖKC/e-belge yok. Simülasyon bunların yerine sayılmaz.
7. **Canlı SEO/ölçüm:** deployment sonrası robots/sitemap/canonical yeniden kabul, hesap sahibinin GSC ve GA4 doğrulaması, gerçek CWV ve yardımcı teknoloji incelemesi gerekir. İndekslenme garantisi verilmez.

| Kullanım | Karar |
|---|---|
| Sentetik verili yerel web/uygulama demosu | **PASS**, yukarıdaki sınırlı kanıt kapsamında |
| Gerçek müşteride kontrollü pilot | **BLOCKED**, RC2 ve yeni paket entegrasyon kapıları nedeniyle |
| Genel ticari satış | **FAIL**, açık lisans/güvenlik/cihaz/yaşam döngüsü kabulleri nedeniyle |

Canlıya çıkış için yeni fiyatların/kapsamın yönetici onayı, gerekiyorsa müşteri lisans geçiş onayı, kalan güvenlik/dağıtım kabulleri ve ayrıca deployment onayı gereklidir. Bu çalışma hiçbirine otomatik onay sayılmaz.

Kapanış: yerel Node/PHP önizlemeleri durduruldu, iki geçici tarayıcı sekmesi kapatıldı ve viewport sıfırlandı. Yalnız bu turun sentetik MySQL datadir'leri, preview DB/PEM ve PHP kabul klasörleri tam yol/reparse kontrolleriyle temizlendi; kanıt log/JSON/PNG'leri ve eski dosyalar korundu (`cleanup.json`). Önizlemede yapılandırılmamış Google ses hizmeti hatası da görüldü; ses hizmetine çalışıyor kabulü verilmedi. Bu, yeni satış sayfası veya ödeme akışında değişiklik gerektirmedi.
