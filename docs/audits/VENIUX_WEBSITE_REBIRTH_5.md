# VENIUX CLOUD — WEBSITE REBIRTH 5.0

19–20 Ekim 2026. Yerel uygulama ve bu çalışma sırasında yeniden çalıştırılan testler. Üretime dağıtım, üretim veritabanına erişim, lisans/anahtar değişikliği veya gerçek ödeme yapılmadı.

## İnceleme ve tasarım kararı

PHP ön yüz denetleyicisi, ortak tasarım bileşenleri, varlık derleyicisi, ürün ailesi sayfaları, mevcut Signature 3 raporu ve RC2 engelleri incelendi. React/Node satış motoru değiştirilmedi; Laravel'e geçilmedi.

Çalışma başındaki dosyalarda Rebirth başlığı ve bazı 5.0 stil/metin taslakları zaten mevcuttu. Bu rapor onların tamamını bu tur sıfırdan yazılmış gibi sahiplenmez. Özellikle mevcut taslaktaki `<12ms`, sıfır senkron gecikmesi, örnek ciro/büyüme rakamları, otomatik mali Z raporu ve dış modele veri gönderilmeyeceği iddiaları kanıtlanmış değildi. Bunlar kaldırıldı veya gerçek kapsamla değiştirildi.

Yeni uygulama: büyük, sola hizalı marka başlığı; sağda keskin kenarlı gece mavisi ürün sahnesi; gerçek POS ve mal kabul ekranlarının katmanlanması; üç çözümü bağlayan navigasyon. Mobilde sütunlar, rozetler ve sahne düzeni ayrıca değişir; görseller dikey ve perspektifsiz sunulur. Gerçek ekranın tam boy bağlantısı korunur. Mavi Retail, turuncu Warehouse, açık mavi Intelligence vurgusu kullanılır.

Retail/Warehouse anlatısında masaüstü ürün görseli kaydırma boyunca sabit kalır; metinler operasyon adımlarını açıklar. Destekleyen tarayıcılarda CSS view-timeline ile hafif giriş geçişi, sahne arka planında küçük transform hareketi vardır. Yeni animasyon kütüphanesi, video veya framework eklenmedi. Hareketler `prefers-reduced-motion` altında kapatılır; desteklenmeyen tarayıcıda içerik statik ve görünür kalır. Her işlem için ayrı gerçek ekran kaynağı mevcut olmadığından sahte kasa/gün sonu ekranları üretilmedi.

## Intelligence: gerçek kaynaklara dayalı kapsam

`backend/src/services/assistantMonitor.js` mevcut tenant üzerinden ürün/stok, minimum stok, uyarı, satın alma/sayım durumu ve bazı CRM/personel özetlerini derler. `prepare` ve `execute` teklifleri kullanıcı/işletme/süre ile eşleştirir; değişiklik için açık onay ister. `aiController.js` doğal dil taleplerini mevcut araçlara ve onay kartlarına dönüştürür.

`backend/src/services/nvidiaAIService.js` NVIDIA API anahtarı ister; sohbet bağlamını harici sağlayıcıya gönderir. Dolayısıyla “veriler asla dış modelle paylaşılmaz” doğru değildir. Yeni içerik bu gereksinimi ve veri değerlendirmesini açıkça anlatır. Bu tur sağlayıcı çağrısı veya gerçek müşteri kaydı kullanılmadı. Ciro tahmini, kasa sapmasını AI ile otomatik tespit ve tüm kurulumlarda aktif AI iddiası yapılmaz.

Yeni `/yapay-zeka` sayfası ayrı title, description, H1 ve canonical ile mevcut `$pages`/sitemap sistemi üzerinden sunulur. Ana ve mobil menüler bu sayfaya bağlanır. Ana sayfadaki `#zeka` derin bağlantısı da çalışmaya devam eder.

## Dosya bazında değişiklikler

| Dosya | Bu çalışmadaki değişiklik |
|---|---|
| `website-php/premium-hero.php` | Gerçek ekran/sentetik veri açıklamaları, doğrulanmamış telemetri ve gecikme iddialarının kaldırılması; Intelligence bağlantısı |
| `website-php/commercial-home.php` | Ürün kapsamı metinlerinin düzeltilmesi; sahte AI metrik kartları yerine ortak Intelligence bileşeni |
| `website-php/intelligence-section.php` | Yeni numaralı yetenek dökümü; stok/özet/onay sınırları ve harici sağlayıcı açıklaması |
| `website-php/intelligence-view.php` | Yeni bağımsız Intelligence tanıtımı ve demo çağrısı; canlı sohbet taklidi içermez |
| `website-php/index.php` | Yeni public route/meta/render dalı ve ana/mobil menü bağlantıları; mevcut URL ve form denetimleri korunur |
| `website-php/assets/premium.css` | Asimetrik hero, mobil sahne, masaüstü navigasyon, sabit ürün anlatısı, Intelligence satır düzeni, kontrast, hafif hareket/fallback |
| `website-php/asset-manifest.php` | Yeniden derlenen CSS hashleri |
| `website-php/assets/main.f1f62b2a11ff.css` | Ana sayfa ve genel pazarlama çıktısı |
| `website-php/assets/program.589b34ee8dd2.css` | İndirme sayfası ortak tasarım çıktısı |
| `website-php/assets/pricing.f77f67de7c35.css` | Fiyatlandırma ortak tasarım çıktısı |
| `website-php/assets/notes.8bd6f3425ae9.css` | Not/arşiv ortak tasarım çıktısı |
| `website-php/assets/accounts.5f284e364cd2.css` | Hesap sayfalarının ortak tasarım çıktısı; hesap mantığı değişmedi |
| `tools/release-candidate/rebirth-site.cjs` | Localhost ile sınırlı yeni route/içerik/motion/42 ölçüm kabul denetimi |
| Bu rapor | Kararlar, yeni kanıtlar ve açık sınırlar |

Fiyatlandırma, demo, indirme, iletişim ve FAQ mevcut güvenli markup ve işlemlerini koruyarak ortak görsel katmanı kullanır. Paket karşılaştırma yapısı, teklif modeli ve onaylanmamış fiyatların gizliliği korunur. Bu sayfaların iş mantığı yeniden yazılmadı. Önceki hash dosyaları silinmedi; manifest yalnız son çıktıları seçer.

## Yeni test kanıtları

| Çalıştırılan kontrol | Sonuç | Kanıt |
|---|---|---|
| Varlık derleme | PASS | `node website-php/bin/build-assets.cjs`; yukarıdaki manifest |
| PHP index sözdizimi | PASS | `php -l website-php/index.php` |
| Ortak gerçek ekran bileşenleri | 9 PASS | `website-php/bin/signature-components-test.php` |
| Ticari site/form regresyonu | 25 PASS, 8 alt komut exit 0 | `.local/rebirth-5/site-results.json` |
| Yeni Rebirth kabulü | 6 grup PASS | `.local/rebirth-5/rebirth-results.json` |
| Teknik SEO | 22 canonical public URL PASS | `VENIUX_SEO_CHECK_URL=http://127.0.0.1:39768 node website-php/bin/seo-check.cjs`; yeni Intelligence dahil |
| API/SQLite | 760 PASS, 0 FAIL, 95 suite | `.local/customer-experience/run-1ba8a8f064cc9df5/jest.json` |
| Ortak sunum/guard | 51 PASS, 0 FAIL, 0 skip | aynı run `presentation.log` |
| React üretim derlemesi | PASS | aynı run `commands.json`, frontend-build exit 0 |

Ticari alt komutlar: yayınlanmış fiyatlar, SEO, büyüme sayfaları, form guard, dönüşüm guard, hesap akışları, dört form dönüşüm kabulü ve consent/analytics testleri. İzole test kayıtları ve loopback sunucusu kullanıldı; SMTP bildirimleri kapalıydı. Google/GA4 hesabının aktif olduğu veya indeksleme başarısı iddia edilmez. MySQL bu sunum değişikliğinde yeniden çalıştırılmadı; geçmiş MySQL sonucu yeni kanıt sayılmadı.

## Gerçek tarayıcı kontrolü

IAB/Chromium tabanlı gerçek tarayıcıda DOM ölçümleri alındı. CSS `innerWidth` değerleri kaydedildi; yalnız istenen viewport adına güvenilmedi. Yedi rota: `/`, `/market-pos`, `/depo-yonetimi`, `/yapay-zeka`, `/fiyatlandirma`, `/demo`, `/program-indir`. Altı genişlik: **360, 390, 768, 1024, 1440, 1920**. Toplam **42 benzersiz kombinasyon**: tek H1, belge genişliği viewport'u aşmıyor. Ham kayıt `.local/rebirth-5/viewport-checks.json`; aynı rotanın ek ölçümleri de dosyada tutulur.

Menü açma/Escape kapama doğrulandı. Yeni ürün sekmesinde Depo seçimi ve ArrowRight ile Stok seçimi doğrulandı. Koyu tema geçişi, 1440 pikselde taşmasız görünüm doğrulandı. Görsel incelemede tespit edilen masaüstü menüde genişleyen indirme düğmesi, örtülen Warehouse katmanı ve koyu Intelligence başlık/eyebrow kontrastı düzeltildi. Menü testindeki ilk seçici iki kapatma düğmesine eşleşti; belirli `.drawer-close` seçicisiyle kontrol tamamlandı, uygulama hatası olarak sayılmadı.

Ekran görüntüleri `.local/rebirth-5/screenshots/`:

- `home-1440.png`, `home-dark-1440.png`, `home-390.png`
- `retail-1440.png`, `warehouse-1440.png`
- `intelligence-1440.png`, `intelligence-section-1440.png`, `intelligence-390.png`
- `download-360.png`, `download-768.png`, `download-1024.png`, `download-1920.png`

Görüntü sağlayıcısı bazı görüntüleri yumuşatabilir/kırpabilir; dosya adı birebir raster piksel boyutu veya kayıpsız görsel kalite sertifikası değildir. Ölçüm genişlikleri DOM kayıtlarıyla doğrulanmıştır. Erken `intelligence-390.png` kontrast düzeltmesinden önce alınmıştır; son koyu bölüm görünümü `intelligence-section-1440.png` ile kanıtlanır.

## Açık kontroller ve yayın sınırları

- Lighthouse/CWV laboratuvar veya gerçek kullanıcı ölçümü çalıştırılmadı; performans puanı/başarı garantisi yok. CSS animasyonları transform/opacity ile sınırlı, JS animasyon bağımlılığı eklenmedi.
- Reduced-motion CSS guard kontrolü geçti; işletim sistemi hareket tercihi emülasyonu ve ekran okuyucu kabulü ayrıca bekliyor. Bütün sitede tam WCAG sertifikasyonu iddia edilmez.
- Gerçek Android/iOS, Safari/Firefox ve düşük güçlü cihaz testleri yapılmadı. Bu tur görsel kontrol IAB ile sınırlı.
- Koyu tema ana sayfada kontrol edildi; tüm rota/genişlikler için ikinci bir koyu tema matrisi çalıştırılmadı.
- Mevcut gerçek ekranlar sınırlı; her kasa/gün sonu/WMS adımının ayrı ekran kaydı henüz yok. Olmayan ekranlar veya başarı istatistikleri uydurulmadı.
- RC2 kod imzalama, temiz Windows kurulumu, gerçek kasa donanımı, mali/banka entegrasyonu, anahtar/yedek geçişi ve merkezi lisans yayın engelleri bu tasarım çalışmasıyla kapanmaz. Ürün ticari hazırlık kararı yükseltilmedi.

**Yayın durumu: yalnız yerel.** Üretim dosyası/verisi/lisansı değiştirilmedi. Tasarım kabulü ile ticari sürüm kabulü ayrı değerlendirilmelidir.
