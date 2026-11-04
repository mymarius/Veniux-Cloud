# Veniux bağımsız PHP tanıtım sitesi

PHP 8.0+ (yayın için güncel desteklenen PHP sürümü tercih edilmeli); veritabanı, npm veya Veniux API bağlantısı gerekmez. Yerel PHP 8.0.30 ile doğrulandı. Uygulama frontend’i artık `/` adresinde oturuma göre giriş veya dashboard’a yönlenir. Lisans etkinleştirme ve mevcut checkout korunur.

Yerel önizleme (proje kökünden):

```powershell
C:\xampp\php\php.exe -S 127.0.0.1:39180 -t website-php website-php/router.php
```

Apache’de document root yalnız `website-php` olmalı; `mod_rewrite` ve `.htaccess` etkin olmalı. Ana uygulamanın kaynak/veri dizini web kökü yapılmamalı. Nginx’te `/assets/` statik dosyaları dışında istekler `index.php`ye yönlenmeli; `config.php` ve `router.php` HTTP erişimine kapatılmalı.

Hosting ortam değişkenleri:

| Değişken | Kullanım |
|---|---|
| `VENIUX_SITE_URL` | Gerçek HTTPS site adresi; varsayılan `https://veniux.com`. Canonical/sitemap/OG için kullanılır. |
| `VENIUX_SITE_INDEXABLE` | Mevcut kodda varsayılan indeksleme açıktır. Önizlemelerde açıkça `0` ayarlayın; robots + meta + HTTP `noindex` ile kapatılır. Üretimde `1` kullanın. |
| `app_url` | Mevcut ön denetleyici indirme akışını `/indir` olarak sabitler; `VENIUX_APP_URL` şu an okunmaz. |
| `VENIUX_CONTACT_EMAIL` | Bildirim alıcısı. Form önce özel klasöre kaydedilir; SMTP/mail etkin değilken e-posta teslimatı iddia edilmez. |

SEO: sunucudan render edilmiş Türkçe içerik, sayfaya özgü title/description/canonical/OG, sitemap, robots, Organization/WebSite yapılandırılmış veri, semantik başlıklar ve gerçek 404. Sayfa sayısı sabitlenmez; güncel liste sitemap üzerinden denetlenir. Sitemap yalnız açıkça bilinen editoryal `modified` tarihi varsa `lastmod` içerir; dosya yükleme zamanı kullanılmaz. Sahte referans, kullanıcı sayısı veya puan yoktur. Ürün içeriği mevcut özelliklerle sınırlıdır; canlı kurum entegrasyonu vaat edilmez.

Yayın kabulü: HTTPS + tek canonical host yönlendirmesi, gerçek giriş/iletişim bilgileri, Search Console alan adı doğrulaması ve sitemap gönderimi, gerçek cihazda Core Web Vitals ölçümü. PNG sosyal paylaşım görseli hazırdır; canlı sosyal kart doğrulaması yayında yapılmalı. İçerik ve organik görünürlük düzenli takip edilmelidir. Google ilk sayfa/ilk sıra garantisi vermez: https://developers.google.com/search/docs/fundamentals/seo-starter-guide

Tasarım: CSS operasyon orbitleri, canlı bar ritmi, kayan şerit, görünürlük animasyonları ve klavyeyle kullanılabilen üç adımlı ürün akışı. `prefers-reduced-motion` desteklenir; JS yokken içerik görünür kalır. Harici font/izleyici/CDN yoktur.

## Görüşme formu ve tema kabulü — 11 Ekim 2026

Açık/koyu tema düğmesi, sistem temasıyla ilk açılış ve localStorage ile seçim kalıcılığı eklendi. Gerçek tarayıcıda koyu tema sonrası sayfa yenilenince koyu görünümün kaldığı doğrulandı; 390 px görünümde yatay taşma yok. Görüntüler: `preview/contact-dark.png`, `preview/contact-light.png`.

Form, PHP oturum CSRF anahtarı, sunucu doğrulaması, honeypot ve oturum başına 60 saniyelik tekrar sınırı kullanır. Gerçek HTTP ile sentetik test: yanlış anahtar 403, başarılı kayıt 200 ve tek JSON kayıt, hızlı tekrar 429. Sentetik talep dosyası testten sonra temizlendi. SMTP çalıştırılmadı; e-posta teslimatı iddia edilmez. Talepler varsayılan olarak uygulama kökündeki `.local/website-contact-requests` içinde, PHP oturumları ayrı `.local/website-sessions` içinde tutulur; bu iki dizin web kökünün dışında olmalıdır. `VENIUX_CONTACT_STORAGE` ile farklı özel dizin seçilebilir. Unix izinleri 0700/0600; Windows hedefte hosting hesabına özel ACL ayrıca uygulanmalıdır. Yayında bot koruması/rate limit reverse proxy düzeyinde de etkinleştirilmelidir. Saklama süresi, hukuki bilgilendirme metni ve e-posta ile gerçek takip akışı site sahibiyle netleştirilmeden genel yayın kabulü yapılmış sayılmaz.

SEO kontrolleri: dört farklı title, sayfa başına tek h1, dört canonical URL, dört sitemap URL, parse edilen Organization/WebSite/WebPage + çözüm sayfalarında BreadcrumbList. Görünür breadcrumb eklendi; /index.php ve çözüm sayfalarının son slash varyantları 301; özel contact.php HTTP 404. Yerel önizleme noindex kalır. Canlı indeksleme, Google Rich Results Test ve Search Console yapılmış sayılmaz.

Kaynaklar: [Google canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb).

Bildirim alıcısı site sahibi tarafından `mymarius1@gmail.com` olarak belirlendi; `VENIUX_CONTACT_EMAIL` bunu değiştirebilir. Gerçek gönderim için hostingin PHP mail/SMTP taşıyıcısı yapılandırılmalı, doğrulanmış alan adı göndericisi `VENIUX_CONTACT_MAIL_FROM` olarak girilmeli ve `VENIUX_CONTACT_MAIL_ENABLED=1` seçilmelidir. Gmail SMTP seçeneğinde aynı adres doğrulanmış gönderici hesabı olarak da kullanılır. mail() kabulü teslimat garantisi değildir. Başarısız gönderimde talep kuyruğu korunur. Bu değişiklikte dışarıya test e-postası gönderilmedi.

Form anahtarı düzeltmesi: HTML ve token yanıtı no-store; gönderim öncesi aynı origin token yenileme, başarısız isteklerde alanları koruma eklendi. Yanlış token 403, korunmuş alan ve yenilenen tokenla 200 gerçek HTTP üzerinden; tarayıcıda sentetik form gönderiminin kaydedildiği doğrulandı. Sentetik kayıtlar temizlendi; e-posta gönderilmedi.


Gmail/XAMPP: PHPMailer 7.1.1 ile STARTTLS (587) eklendi. Özel ayar .local/website-mail.php dosyasındadır; web kökü dışında ve Git kapsamı dışındadır. Google uygulama şifresini password alanına yerelde girin. Bağlantı kontrolü: C:\xampp\php\php.exe website-php/check-mail.php. Kontrol e-posta göndermez; kimlik doğrulamasını sınar. SMTP hatasında kaydedilmiş talep korunur ve form bunu bildirir. Parola ve SMTP hata ayrıntıları çıktıya yazılmaz. Canlı SMTP doğrulaması şifre girilene kadar bekliyor. Kaynak: https://github.com/PHPMailer/PHPMailer (resmî proje).

## PHP fiyatlandırma sayfası — 11 Ekim 2026

`/fiyatlandirma` eklendi: Başlangıç (990 TL / 3 ay; 2.990 TL / yıl), İşletme (2.490 TL / 3 ay; 7.990 TL / yıl), Kurumsal (4.990 TL / 3 ay; 15.990 TL / yıl). Tutarlar KDV hariç, dönem toplamıdır. Yıllık tasarruf dört adet 3 aylık tutarla hesaplanır. Teklif kataloğu `website-php/pricing.php` içinde; mevcut uygulamanın USD lisans kataloğu değiştirilmedi. Site ödeme almaz ve lisans etkinleştirmez. Limitler mevcut Starter/Business/Enterprise lisanslarından alınmıştır; canlı kurum entegrasyonları vaat edilmez.

Değişen dosyalar: index.php, contact.php, smtp.php, .htaccess; yeni pricing.php, pricing-view.php ve assets/pricing.css. Menü, mobil menü, footer, canonical, açıklama ve sitemap bağlantıları eklendi. Paket kodu sunucuda izin listesiyle doğrulanır; kayıt ve e-posta gövdesine sunucunun belirlediği tutar/süre eklenir.

Çalıştırılan kontroller: tüm kök PHP dosyaları syntax kontrolü; altı HTTP görünümü 200 ve tek h1; sitemap 5 URL; 14 bağımsız PHP kabul kontrolü (altı paket/dönem, geçersiz dönem ve dizi, kayıt, tek dosya, değiştirilmiş istemci tutarını yok sayma, seçimi koruma, geçersiz paketi reddetme ve kaydetmeme). Kayıt testinde ayrı sentetik dizin kullanıldı ve temizlendi; SMTP kapalıydı. Tarayıcıda 3 aylık/yıllık geçiş, seçimin forma aktarımı, 1366 px masaüstü ve 390 px açık/koyu tema kontrol edildi; küçük ekranda yatay taşma ve konsol hatası yok. Görüntüler website-php/preview/pricing-*.png.

Bekleyen: canlı yayında Search Console ve indeksleme; bu değişiklik için gerçek e-posta teslimatı testi yapılmadı. Fiyat seviyesi için Bizim Hesap resmî fiyat sayfası incelendi (https://bizimhesap.com/fiyatlar); özellik eşdeğerliği iddiası yok. Üretim kayıtları ve mevcut SMTP sırları değiştirilmedi.

### Renk ve hareket güncellemesi — 11 Ekim 2026
Site ve fiyatlandırma paleti petrol/adaçayı tonlarına güncellendi. assets/motion.css: kademeli giriş, kart/düğme hover, menü alt çizgisi, merkez/orbit ışık ve durum göstergesi animasyonları. assets/site.js: kartlara reveal ve grup gecikmesi; canlı reduced-motion değişimine uyum. Masaüstü ve 390 px mobil açık/koyu görünüm incelendi; yatay taşma ve konsol hatası yok. PHP syntax ve motion CSS HTTP 200 geçti. Tarayıcı reduced-motion=true: hesaplanan animation-name=none; normal hareket tercihiyle animasyonların canlı oynatımı bu ortamda ayrıca doğrulanmadı. Görüntüler preview/home-sage.png, home-sage-mobile.png, pricing-sage.png. Form/SMTP/plan tutarları değiştirilmedi.

### Detaylı anlatım — 11 Ekim 2026
Ana sayfa ve fiyatlandırmaya altı adımlı Nasıl çalışır bölümü eklendi: ürün, kabul, depo/sayım, satış/vardiya, lot/miat, erişim. Yeni guide-view.php ve assets/guide.css; menü bağlantısı index.php içinde güncellendi. İçerik HTML olarak sunulur, JavaScript olmadan okunur. Temsili 24-3=21 stok örneğinin varsayımları görünürdür. PHP syntax, altı adım, fare ve Enter ile açılma kontrolü geçti; 390 px görünümde yatay taşma ve konsol hatası yok. Genel FAQ CSS'inin tüm summary span elemanlarını döndüren kuralı yeni bölüm içinde sınırlandırıldı. Son görüntü preview/guide-desktop.png. Üretim verileri ve bildirim ayarları değiştirilmedi.
