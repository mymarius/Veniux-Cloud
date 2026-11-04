# Veniux SEO altyapısı

Bu altyapı arama motorlarının herkese açık ürün sayfalarını anlamasını ve taramasını destekler. İndeksleme kararı veya arama sırası üretmez; müşterilerin özel işletme verilerini arama motorlarına açmaz.

## Merkezi sayfa kaydı

`index.php` içindeki `$pages` her herkese açık sayfanın yolunu, başlığını, açıklamasını ve görünen etiketini tutar. Başlık ve açıklamayı gerçek sayfa içeriğine göre yazın. Aynı metni farklı ürün sayfalarında tekrar etmeyin. Başlıklar için katı bir Google karakter sınırı yoktur; denetim uzun başlıkları inceleme uyarısı olarak raporlar.

Yeni bir sayfa eklerken özgün ve faydalı görünür içerik, bir H1, ana sayfadan veya ilgili çözümden ulaşılabilen bağlantı ve merkezi kayıt ekleyin. Sitemap kayıttan otomatik üretilir. Aynı içeriği çok sayıda anahtar kelime sayfasına çoğaltmayın.

## Meta ve paylaşım katmanı

`seo.php` içindeki `siteSeoHead` başlık, açıklama, canonical, robots, Open Graph ve Twitter etiketlerini üretir. Sosyal görsellerin boyutu, türü ve alternatif metni belirtilir. Etiket değerleri HTML için kaçışlanır. Canonical URL sorgu parametrelerinden üretilmez; reklam takip parametreleri ayrı indekslenebilir sayfalar oluşturmaz.

Herkese açık içeriklerde geniş resim önizlemesi ve snippet izinleri bulunur. Özel sayfalarda `noindex` kullanılır. Robots engeli kimlik doğrulama değildir; özel verilere erişim uygulama tarafından korunmalıdır.

## Yapılandırılmış veri

`siteSeoGraph` Organization, WebSite ve WebPage düğümlerini kalıcı kimliklerle bağlar. Alt sayfalarda BreadcrumbList, indirme tanıtım sayfasında SoftwareApplication üretilir. Bilinmeyen sayfalara ürün şeması eklenmez. Olmayan müşteri yorumları, puanlar, sertifikalar, fiyatlar ve ödüller eklenmez.

Bu şema Google zengin sonuç garantisi değildir. Sonuç türüne göre ek alanlar veya uygunluk şartları olabilir. İçerikte görünmeyen bilgileri şemaya eklemeyin.

## Tarama ve URL yönetimi

- `/robots.txt`: herkese açık tarama izni ve sitemap adresi.
- `/sitemap.xml`: yalnız kayıtlı herkese açık canonical adresler ve içerik kaynaklarının değişiklik zamanları.
- WWW sürümü ana alan adına 301 yönlenir.
- `/index.php` ve kayıtlı sayfaların sonundaki slash tek ana adrese yönlenir.
- Bilinmeyen adres gerçek 404 ve noindex döndürür.
- Giriş, kayıt ve kişiye özel indirme alanları sitemap'e eklenmez.

Sitemap `lastmod` kaynak dosyaların değişiklik zamanlarından hesaplanır; ortak şablon değişiklikleri birden fazla sayfayı etkileyebilir. Dağıtım dosya zamanlarını sıfırlarsa bu alanın doğruluğunu yeniden değerlendirin.

## Performans ve görseller

Sıkıştırılmış CSS/JS içerik karmasıyla adlandırılır. Sürüm numaralı logolar ve fontlar bir yıl immutable önbellek kullanır. Logo responsive srcset ve sizes ile seçilir; yüksek yoğunluklu ekran daha büyük aday indirebilir. Üst logo lazy yüklenmez. Form/oturum içeren HTML özel önbellek politikasıyla korunur; statik dosya kuralını HTML'e uygulamayın.

## Denetim

`node website-php/bin/seo-audit.cjs` canlı siteyi salt okunur tarar ve `.local/seo-audit.json` üretir. Başarısız zorunlu kontrollerde sıfırdan farklı çıkış kodu döndürür. Alternatif test adresi `VENIUX_SEO_CHECK_URL` ile verilebilir.

Kontroller: sitemap erişimi/tekrarlar/özel yol dışlama, robots tarama izni, HTTP durumları, yinelenmeyen başlık ve açıklamalar, H1 sayısı, canonical, robots başlığı/meta, sosyal URL ve görsel alt metni, JSON-LD geçerliliği, sayfa kimliği, breadcrumb, resim alternatif metinleri, kayıt dışı iç bağlantılar ve özel/404 indeksleme kuralları.

Denetim yalnız teknik site çıktısını kontrol eder. Google'daki gerçek indeks kapsamını, backlink kalitesini, içerik uzmanlığını veya kullanıcı performansını ölçmez. PageSpeed ve Google zengin sonuç testi ayrı kontrollerdir. Search Console isteğe bağlı bir takip ve başvuru aracıdır; sitenin teknik olarak taranabilmesi için şart değildir.

## Yayın ve bakım

SEO kodunu yayımlamadan önce PHP sözdizimi, yerel çıktı ve canlı denetim kontrol edilir. Canlı FTP bilgilerini kaynak dosyalarda saklamayın. İçerik güncellemelerinde gerçek ürün davranışlarını esas alın. Arama sonuçları gecikmeli değişebilir; sitemap ve canonical sinyaldir, zorunlu indeksleme komutu değildir.

14 Ekim 2026 canlı kontrolü: 11 sayfa, denetimde 0 hata ve 0 uyarı. Bu sonuç SEO sıralama puanı değildir.
