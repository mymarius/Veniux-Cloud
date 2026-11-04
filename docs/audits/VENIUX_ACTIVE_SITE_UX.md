# Aktif site karşılaştırması ve kullanılabilirlik iyileştirmeleri

20 Ekim 2026 · PHP pazarlama sitesi. Canlı site yalnızca herkese açık HTTP GET istekleriyle okundu. Kod değişiklikleri yerelde uygulandı; yayın yapılmadı, canlı hesap/veri/lisanslara dokunulmadı.

## Önce canlı ile yerel sürüm ayrıldı

`https://veniux.com/`, `/fiyatlandirma`, `/program-indir` ve `/stok-yonetimi` HTTP 200 döndü. Canlı ana sayfanın başlığı hâlâ “Veniux | Stok ve Depo Takip Programı, Windows ve Android”. Bu dört canlı sayfada yeni `product-*` ekran varlıkları ve `summary_large_image` bulunmadı. Ham `<img>` sayıları sırasıyla 3, 2, 2, 3; bu sayılar gerçek ürün görüntüsü olduğu anlamına gelmez. Kanıt: `.local/site-ux/live-snapshot.json`.

Yerelde Afterdark ana sayfa, sentetik verili gerçek POS/WMS ekranları ve stok/lot sayfalarında gerçek görüntüler zaten vardı. Bunlar yeniden üretilmedi. Canlı sitede eski yayın olması, yereldeki çalışmanın canlıda da bulunduğu anlamına gelmiyor. Canlı CSS, Lighthouse veya fiziksel telefon testi yapıldığı iddia edilmiyor.

## Uygulananlar

| Alan | Yerel sonuç |
|---|---|
| Windows/Android indirmesi | Ayrı `/dosya/windows` ve `/dosya/android` bağlantıları. Mevcut hesap kapısı korunur; başarılı girişten sonra seçilen platforma dönülür. |
| Platform önerisi | Tarayıcının bildirdiği Windows/Android bilgisine göre ilgili kart vurgulanır; diğer bağlantı gizlenmez. Desteklenmeyen platform için tahmin yapılmaz. |
| İndirme QR'ı | Android indirme adresi için yerel üretilmiş SVG QR. Masaüstünde görünür; hesap girişi gerekir. Oturum/token taşımayan genel URL'dir; cihaz eşleştirme QR'ı olarak sunulmaz. Fiziksel telefonla okutulduğu iddia edilmiyor. |
| Sürüm/boyut/tarih/SHA-256 | Mevcut indirme handler'ıyla aynı güncel manifest kaynakları okunur. Dosya adı/platform/sürüm eşleşmesi ve izin verilen alanlar doğrulanır. Eksik metadata uydurulmaz. Eski arşiv verisi güncel paket gibi gösterilmez. |
| Bulut ve yerel ağ | SVG cihaz simgeleriyle iki akış şeması, sunucunun rolü ve “Bilgisayar açık kalmalı mı?” yanıtları. Bulutta hayır; yerel bağlantıda evet. Web çalışma ekranı vaadi eklenmedi. |
| Fiyat dönemi | 3 aylık/yıllık geçiş aynı DOM'da çalışır; URL `pushState` ile güncellenir, Back/Forward dönem ve fiyatları yeniler. JS kapalıyken eski sunucu bağlantıları çalışır. |
| Fiyatlar | Mevcut onaylı 1.188/2.388/4.788 TL üç aylık ve 3.588/7.188/14.388 TL yıllık değerler, KDV ve lisans hakları korunur. Afterdark taslak fiyat bayrağı bu önizlemede kapalıdır. |
| Paket önerisi | Depo, kullanıcı ve cihaz sayılarını gerçek teklif kataloğu sınırlarıyla karşılaştırır. Kapsam aşılırsa özel görüşme önerir; yeni lisans hakkı icat etmez. CTA, plan ve süreyi teklif formuna taşır. |
| Karşılaştırma | İşletme planında Önerilen etiketi. 13 kapsam/başlık satırı, sticky tablo başlığı; mobilde paket bazlı native akordeonlar. Belirsiz kapsam “görüşün” olarak işaretlenir. |
| Tekrar eden içerik | Fiyatlandırmada `guide-view.php` yerine paket önerisi ve plan SSS'si kullanılır. |
| İletişim formu | Ad/e-posta/talep/çözüm alanları görünür; isteğe bağlı paket, işletme ve açıklama ayrıntıları native details içinde. Çözüm alanı sunucu doğrulamasında zorunlu olduğundan güvenli akış korunarak dört alan + iletişim izni bırakıldı. |
| Demo penceresi | Sticky düğme native dialog açar; mevcut tek form taşınır, kopyalanmaz. Escape/kapatma sonrası form eski yerine ve odak düğmeye döner. JS kapalıyken sayfa içi form çalışır. Demo düğmesi genel iletişim tipini demo olarak seçer; mevcut teklif seçimi ezilmez. |
| Ortaklık | Mevcut koşullu alan davranışı korundu ve tarayıcıda test edildi; yalnız ortaklıkta görünür/zorunludur. |
| Navigasyon | Desktop çözümler açılır menüsü, aktif rota işareti, Escape ve dışarı tıklama ile kapanma. Başlık CTA'sı Demo iste. |
| Footer | Ürün / Kaynaklar / Destek / Yasal sütunları; mobilde iki sütun. Hostimux logosu iki koyu temada da okunur tek renk görünüm kullanır. |
| İkonlar | Tema, Windows, Android, ağ ve eski dekoratif hedef/yetki/saat/bant simgeleri inline SVG'ye geçti. Dekoratif SVG'ler `aria-hidden`, tema düğmesinin erişilebilir etiketi korunur. |
| Sürüm bağlantısı | Hero'ya mevcut katalogdan Windows/Android sürüm bağlantısı eklendi. Doğrulanmamış tarih eklenmedi. |
| Paylaşım kartları | 22 kanonik sayfaya ayrı 1200×630 PNG ve `summary_large_image`. Kodla çizilmiş marka grafikleri; sahte uygulama ekranı değildir. Toplam yaklaşık 687 KB. |
| SEO ve yükleme | Canonical/URL/sitemap yapısı korundu. Gerçek FAQ'larıyla aynı kaynağı kullanan stok/lot FAQPage verisi eklendi. Organization, WebSite, BreadcrumbList ve SoftwareApplication korunur. Hero gerçek ekranı preload, mevcut yerel font ve alt ekran lazy loading korunur. |
| Çerezler | Panelin Escape kapanışı tarayıcıda doğrulandı; mevcut izin, odak ve kişisel veri içermeyen dönüşüm kuralları korunur. |

## Dosya bazında değişiklikler

- `website-php/experience-components.php`: inline SVG, bağlantı şemaları ve güncel manifestten güvenli metadata seçimi.
- `website-php/assets/experience.mjs`: dönem geçişi, önerici, platform vurgusu, rota/menü ve demo dialog davranışı.
- `website-php/assets/site.js`: yeni modülün başlatılması.
- `website-php/pricing-view.php`, `plan-advisor.php`: katalog verisi, önerilen etiket, geniş karşılaştırma, mobil akordeon, öneri alanı; tekrar eden rehber kaldırıldı.
- `website-php/program-view.php`: platform bağlantıları, metadata ve QR, bağlantı şemaları.
- `website-php/accounts.php`: güvenli oturumda yalnız allowlist platformunu hatırlama ve giriş sonrası dönüş; bağlantı açıklamasındaki eski yalnız-yerel anlatımı düzeltme.
- `website-php/index.php`: helper, çözümler menüsü, demo CTA, kısa form düzeni, SVG simgeler ve hero preload.
- `website-php/premium-hero.php`: mevcut katalog sürümlerine bağlantı.
- `website-php/footer.php`, `assets/premium.css`: gruplu footer, responsive araçlar, dialog, indirme metadata/QR ve mobil karşılaştırma stilleri.
- `website-php/growth-evidence.php`: gerçek lot/stok görsellerinde açık sentetik test verisi açıklaması.
- `website-php/seo.php`: gerçek PNG ölçüleri, büyük kart meta verisi ve görüntülenen FAQ kaynağıyla eşleşme.
- `website-php/bin/build-social-cards.py`, `assets/social-*.png`: localhost sayfalarının gerçek başlık/açıklamalarından tekrar üretilebilir 22 paylaşım kartı. Windows Segoe UI fontlarıyla üretilir; kaynak ürün görselleri değiştirilmedi.
- `website-php/assets/android-download-qr.svg`: mevcut qrcode-generator bağımlılığıyla üretilmiş halka açık Android indirme URL'si.
- `website-php/bin/experience.test.mjs`, `download-metadata-test.php`, `accounts-acceptance.cjs`, `growth-acceptance.cjs`, `tools/release-candidate/site-ux.cjs`: yeni davranış ve regresyon kontrolleri.
- `website-php/asset-manifest.php` ve hashli CSS/JS bundle'ları: kaynaklardan yeniden üretildi. Çerez bundle'ı değişmedi.

## Yeni çalıştırılan testler

| Kontrol | Gerçek sonuç |
|---|---|
| Asset build + değişen PHP dosyaları syntax | PASS |
| Ticari site regresyonu | PASS: 25 HTTP/form kontrolü ve 8 alt komut; `.local/site-ux/site-results.json` |
| Alt SEO testi | PASS: 22 kanonik rota, gerçek 404, private noindex ve sitemap |
| Giriş/indirme regresyonu | PASS: CSRF, hashli parola, giriş sonrası Android dosyasına dönüş, yetkisiz indirme kapısı |
| Plan önerisi birim testleri | PASS: 4 test; eşik, her ayrı kapasite, sınır aşımı ve geçersiz/tam sayı olmayan değerler |
| Metadata testleri | PASS: 6 kontrol; platform/sürüm/dosya eşleşmesi, alan allowlist'i, eksik/bozuk bilgi |
| Yeni UX kabul testi | PASS: 9 kontrol grubu; gerçek 22 PNG dosyasının binary 1200×630 ölçüleri dahil |
| Tarayıcı ölçümleri | PASS: 360/390/768/1024/1440 CSS px × 4 sayfa = 20 ölçüm; yatay taşma yok, tek H1 |
| Gerçek fiyat etkileşimi | 3 aylığa geçerken yazılan ad korunur; URL ve fiyatlar değişir. Back yıllık fiyatı geri getirir. |
| Gerçek modal testi | Açılma, Escape, close olayı sonrası MAIN içine form dönüşü ve düğmeye odak dönüşü doğrulandı. |
| Gerçek çerez/ortaklık testi | Çerez paneli Escape ile kapandı; ortaklık seçimi alanı görünür yaptı. |

Kanıt: `.local/site-ux/acceptance-results.json`, `viewport-checks.json`, `interaction-checks.json`, `advisor-tests.log`, `metadata-tests.log` ve `screenshots/`. İlk Node test denemesinde sandbox `spawn EPERM` verdi; izolasyonsuz test modu ile çalıştırıldı. İlk büyüme testi, yeni OG kartı sonrası lot sayfasında sentetik kelimesinin yalnız meta veride kaldığını ortaya çıkardı; görünür açıklama düzeltildi ve test tekrar geçti. Eski screenshot ölçü kontrolü kaldırılmadı; OG dosyası için ayrı gerçek PNG ölçü kontrolü eklendi.

Ekran yakalamaları sağlayıcının ölçeklenmiş çıktılarıdır; bazı masaüstü metinleri bu çıktıda yumuşak görünür. Bu kayıtlar gerçek cihaz keskinliği veya Core Web Vitals sertifikasyonu değildir.

## Tamamlanmamış / dış kanıt isteyen öneriler

- **Canlıya yayın:** Yapılmadı. Önceki “Canlıya yayın yapma” sınırı korunuyor. Aktif site hâlâ eski sürüm; yerel testlerin geçmesi üretim değişti demek değildir.
- **Güncel paket boyutu/tarihi/SHA:** Bu çalışma alanında gerçek güncel paket manifestleri bulunmuyor. Doğrulanmış manifest sağlanana kadar sayfa bunları beklemede gösterir. Katalog sürümü açıkça dosya doğrulaması bekleyen bilgi olarak işaretlenir.
- **Android telefon ve laptop mockup / ekran görüntülü stepper:** Gerçek, doğrulanmış Android bağlantı ekran görüntüsü bulunmadığından uydurulmadı. Gerçek POS/WMS/stok/lot görüntüleri korunuyor. Mevcut 3 adımlık yerel bağlantı rehberi korunuyor.
- **SmartScreen ekran görüntüleri:** İmzasızlık açıklaması korunuyor. Güncel kurulum paketiyle gerçek Windows görüntüleri alınmadan görsel adımlar üretilmedi; uyarının çıkmayacağı söylenmiyor.
- **30–60 saniyelik video/GIF:** Üretilmedi; gerçek ürün kaydı ve yayın seçimi gerekir.
- **WhatsApp/telefon:** Doğrulanmış işletme numarası verilmediği için eklenmedi.
- **Etkileşimli stok/lot örnekleri ve yeni sektör sekmeleri:** Bu teslimatta eklenmedi; gerçek satış/stok kaydı yapan bir simülasyon sunulmadı.
- **Offer yapılandırılmış verisi:** Yeni taslak fiyatlar sunucu lisans/ödeme haklarına veya şemaya aktarılmadı. Bu çalışmada ek Offer iddiası oluşturulmadı.
- **Lighthouse, alan CWV ve fiziksel cihaz matrisi:** Çalıştırılmadı. 20 tarayıcı yerleşim ölçümü hız veya fiziksel cihaz testi olarak gösterilmedi.
- **Sosyal kanıt:** Sahte müşteri logosu, yorum, trafik/başarı sayısı eklenmedi.

Yerel inceleme: `http://127.0.0.1:39768/`, `/fiyatlandirma`, `/program-indir`. Önizleme yalnız loopback, bildirim gönderimi kapalı ve `.local/site-ux/` altında izole kayıtlarla çalıştırıldı. Yeni paket/lisans veya üretim verisi değişikliği yok.
