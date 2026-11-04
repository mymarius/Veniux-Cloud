# Arama motoru düzenlemeleri — 13 Ekim 2026

Canlı siteye uygulandı:

- Ana sayfa başlığı Veniux, stok/depo takip programı, Windows ve Android ürün kapsamını açıklıyor.
- Her tanıtım sayfası kendine özgü başlık/açıklama, HTTPS canonical adres, tek H1 ve sayfada gömülü yapılandırılmış veri sunuyor. Mevcut Organization, WebSite, WebPage ve BreadcrumbList verileri korunup Veniux marka alternatif adı eklendi.
- `/program-indir` kayıt gerektirmeden okunabilen yeni bir ürün sayfasıdır. Windows ve Android gereksinimleri, aynı yerel veriye bağlantı ve lisans koşulları gerçek ürün davranışına göre açıklanır. SoftwareApplication verisi eklendi; hayalî puan, yorum veya ücretsiz kullanım iddiası eklenmedi.
- Masaüstü/mobil ana menü bu sayfaya bağlanır. Dosyalar `/indir` üzerinden oturumla indirilir; kayıt ve sahip girişi korunur.
- `/robots.txt` genel taramaya izin verir ve kökteki `/sitemap.xml` adresini bildirir. Sitemap yalnız altı açık tanıtım sayfasını listeler. `lastmod` değerleri gerçek kaynak dosyası değişiklik zamanlarından hesaplanır.
- Giriş, kayıt, oturumlu indirme ekranları noindex ile korunur. Dosya indirme yolu robots taramasından dışlanır. Bulunmayan yollar 404/noindex vermeye devam eder.
- Yanlış SVG türü taşıyan PNG favicon etiketi düzeltildi.

Canlı test: `website-php/bin/seo-check.cjs`. Altı sayfada 200 yanıtı, index/follow, ayrı başlıklar, canonical, tek H1 ve JSON-LD doğrulandı. Sitemap ve robots doğrulandı; eksik sayfa 404/noindex, giriş sayfası noindex verdi. HTTP ana sayfa HTTPS'ye; `/index.php` köke; `/program-indir/` doğru canonical yola 301 ile yönleniyor.

`https://www.veniux.com/` bağlantısı bu kontrolde doğrulanamadı. Ana canonical adres `https://veniux.com` çalışıyor. www için DNS/sertifika kontrolü Cloudflare/hosting erişimiyle ayrıca tamamlanmalıdır.

Google Search Console mülkü/doğrulama kodu kullanıcıda bulunmadığından mülk oluşturma, sitemap gönderimi veya URL incelemesi üzerinden indeksleme isteği yapılmadı. robots.txt üzerinden sitemap keşfi mümkündür. Bu işlemler Google'da indeksleme veya belirli bir sıralama garantisi değildir.

Önceki ana sayfa ve yönlendirme dosyaları web kökü dışındaki `.local/seo-before-20261013-*` dosyalarında yedeklendi. Site yapılandırması, posta ayarları, firma verileri ve sahip şifresi değiştirilmedi.

Kaynaklar: https://developers.google.com/search/docs/fundamentals/seo-starter-guide ve https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
