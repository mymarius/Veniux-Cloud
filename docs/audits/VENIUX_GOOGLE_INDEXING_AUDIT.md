# Veniux Google indeksleme denetimi

## 18 Ekim yayın sonrası güncelleme

Kullanıcı onayıyla 18 Ekim 2026 01:37 Türkiye saatinde SEO yayını tamamlandı. Bu raporun ilk denetiminde canlıda açık kalan iki HEAD alias hatası artık düzeltildi: yeni canlı denetim **380 PASS, 0 FAIL**. Altı sayfa başlığı, sayfaya özgü SSS ve bağlamsal rehber bağlantıları da canlı. Dosyalar ve kanıtlar `SEO_CONTENT_FIXES_2026-10-18.md` içinde. Aşağıdaki 17 Ekim bulguları tarihsel ilk denetimdir. GSC/Google indekslenme sonucu henüz doğrulanmadı; HTTP www iki adımlı yönlendirme hosting iyileştirmesi olarak sürüyor.

17 Ekim 2026, Europe/Istanbul. Canlı örneklem: yaklaşık 00:43–00:50. PHP web sitesi incelendi; Laravel/Blade/middleware bulunmadığından mevcut PHP yönlendirme, SEO ve güvenlik katmanları korundu. React/Node/Electron/Android uygulamaları bu çalışmada değiştirilmedi. Üretime yayın, üretim veritabanı işlemi, gerçek form gönderimi ve ücretli servis etkinleştirmesi yapılmadı.

## 1. Tespit edilen teknik SEO sorunları

| Bulgu | Kanıt | İşlem |
|---|---|---|
| GET/HEAD yönlendirme tutarsızlığı | Canlı `/index.php` ve `/stok-yonetimi/`: GET 301, HEAD 404/noindex | `index.php` içinde aynı canonical yönlendirme HEAD için de uygulandı; yerelde geçti, canlıya alınmadı |
| HTTP www iki yönlendirme yapıyor | `http://www.veniux.com/` → `https://www.veniux.com/` → `https://veniux.com/` → 200 | Hosting/nginx seviyesinde tek adıma indirme önerisi; üretim ayarı değiştirilmedi |
| Test aracında iki yanlış bağlantı uyarısı | Sürüm arşivinin `/dosya/windows` ve `/dosya/android` bağlantıları | Bilinen yetkili indirme uçları tanındı; gerçek erişim koruması yeni testte ayrıca doğrulandı |
| Sitemap fonksiyonu gelecekte eklenebilecek özel/noindex rotalara karşı savunma içermiyordu | Kaynak fonksiyona özel/uygunsuz rota verildiğinde otomatik filtre yoktu | Geçersiz, özel, açıkça noindex veya sitemap dışı rotalar filtrelendi; bugünkü 16 URL değişmedi |
| Eski Search Console belgesinde tarihsel 12/15 URL sayıları vardı | Güncel canlı sitemap 16 URL | Tarihsel not korundu, güncel durum ve manuel kontrol listesi eklendi |

Başlıklar/açıklamalar 16 URL'de benzersiz, her sayfada bir H1 ve self canonical mevcut. Ana içerik sunucu HTML'inde, JavaScript çalıştırılmadan okunabiliyor. Sayfa başlıklarını sırf değiştirmek için yeniden yazmadık. Stok sayfasının “Her ürünün bir hikâyesi var.” H1'i yaratıcı fakat konu açısından genel; sonraki içerik düzenlemesinde “Stok yönetimi”ni doğrudan içeren doğal başlık değerlendirilebilir. Bu tek başına indeksleme engeli değildir.

## 2. İndekslemeyi engelleyen kesin hatalar

**Denetlenen 16 canonical herkese açık sayfada kesin bir indeksleme engeli bulunmadı.** Tamamı GET 200 döndü; robots genel taramaya izin veriyor; sitemap canonical HTTPS/non-www URL'lerden oluşuyor; public yanıtlarında noindex yok. Bilinmeyen adres gerçekten 404/noindex dönüyor; giriş/kayıt/özel indirmelerin noindex veya yetkilendirme davranışı kasıtlıdır.

Bu sonuç “Google indeksledi” demek değildir. Erişilebilir ve teknik olarak uygun sayfalar yine de Google tarafından indekslenmeyebilir. [Google teknik gereksinimleri](https://developers.google.com/search/docs/essentials/technical).

Gerçek Google hesabı, kayıtlı URL Denetimi verileri ve doğrulanmış Googlebot erişim günlükleri olmadan düşük tarama/indeksleme sayısının kesin nedeni belirlenemedi. İki HEAD hatası somut uygulama hatasıdır; canonical GET sayfaları için kanıtlanmış genel engel olarak sunulmamalıdır.

## 3. İndekslemeyi olumsuz etkileyebilecek olası sorunlar

- Google'ın keşfetme, tarama ve canonical seçme durumları Search Console'da incelenmeli. “Keşfedildi/tarandı, şu anda indekslenmiş değil” aynı sorun değildir; içerik ve tarama verileri birlikte değerlendirilmelidir.
- Canlı yanıtlar nginx bildiriyor. Örneklemde `cf-ray`/`cf-mitigated` görülmedi; bununla WAF bulunmadığı kanıtlanamaz. Googlebot kullanıcı aracını kullanmak gerçek Google ağından erişimi doğrulamaz. Hosting günlüklerinde IP veya ters/ileri DNS doğrulaması gerekir. [Google tarayıcısını doğrulama](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests).
- Bu küçük örneklemde 429/5xx gözlenmedi. Botları engellemek için kullanıcı aracına dayalı bir kural kaynakta bulunmadı. Trafik sınırları ve saldırı yolu engelleri korunuyor; canlıda yük testi/flood yapılmadı.
- Public PHP yanıtlarında oturum/önbellek kısıtlamaları bulunuyor. Form CSRF ve hesap güvenliği nedeniyle bunlar kaldırılmadı. Gerçek alan performansı kötü çıkarsa kişisel veri içermeyen public içerik ile oturumlu form akışının önbellek tasarımı ayrıca ele alınabilir.
- Ana sayfanın ham HTML gövdesi 91.568 bayt; diğer sayfalar 12.698–56.025 bayt. Canlı örneklemde yanıt başlıkları 48–69 ms'de geldi. Bu değerler bu bağlantıya ait tek ölçümlerdir; sıkıştırılmış ağ boyutu, mobil LCP, INP veya CLS değildir.
- Mobil tarayıcı örnekleminde ana sayfa ve stok sayfası için 390×844 viewport ayarlandı; scrollbar sonrası içerik genişliği 375 px, scrollWidth 375 px: yatay taşma yok. H1/ana içerik ve ilk ekrandaki logolar göründü. Footer sponsor resmi lazy olduğu için ilk ekranda yüklenmemişti; bu testten bozuk resim sonucu çıkarılmadı. Fiziksel Android/iOS ve tüm sayfa etkileşimleri bu çalışmanın doğruladığı kapsam değildir.
- Tekrarlanan footer/header normaldir. Konu sayfalarının title/description/H1 değerleri farklı; tam kopya metadata bulunmadı. Semantik içerik benzerliği veya Google kalite değerlendirmesi otomatik testlerle kesinleştirilmiş sayılmaz. Lot/miat ile tarih rehberi farklı kullanıcı sorularına odaklanmaya devam etmeli.

### Mevcut içerik mimarisi ve sonraki editoryal çalışma

Yeni kopya sayfalar oluşturulmadı. Mevcut bağlantılar ve demo yönlendirmeleri korunuyor.

| Arama ihtiyacı | Mevcut hedef | Özgün içerik odağı / sınır |
|---|---|---|
| Stok takip programı | `/stok-yonetimi` | Ürün kaydı, barkod, stok hareketi; gerçek ürün ekranlarıyla görev akışı |
| Depo yönetim sistemi | `/depo-yonetimi` | Mal kabul, raf/lokasyon, transfer, sayım; stok sayfasına doğal bağlantı |
| Barkodlu stok takibi | `/barkodlu-stok-takibi` | Barkodla ürünü bulma; her marka cihazın uyumlu olduğu iddia edilmemeli |
| Windows stok yazılımı | `/program-indir` | Güncel paket, kurulum seçeneği ve sistem koşulları; ayrı ince içerik sayfası gerekmiyor |
| Android depo yönetimi | `/el-terminali-depo-yonetimi`, `/program-indir` | Bağlantı ve depo görevleri; test edilmemiş üretici SDK/çevrimdışı uyumu vaat edilmemeli |
| Lot ve SKT takibi | `/lot-miat-takibi`, `/son-kullanma-tarihi-takibi` | İlkinde parti bazında kayıt; ikincide tarih kontrolü, örnek kontrol listesi |
| Çok şubeli stok yönetimi | `/depo-yonetimi`, `/stok-yonetimi` | Mevcut firma/depo yetki kapsamını anlatan bölüm; sınırsız şube veya kanıtlanmamış senkronizasyon vaadi yok |
| POS satış ve stok | `/stok-yonetimi` ve ana sayfanın mağaza bölümü | Mevcut satış/iade/stok akışı; mali onaylı cihaz, banka POS entegrasyonu iddiası yok |

Sonraki içerik güncellemesinde mevcut gerçek ürün ekranlarının ilgili iş adımına yerleştirilmesi, sentetik örnek verilerin belirtilmesi ve açıklayıcı alt metin kullanılması uygundur. Temsili illüstrasyonlar gerçek uygulama ekranı diye sunulmamalı. Bu denetimde tasarım/görsel dosyaları değiştirilmedi.

## 4. Düzeltilen dosyalar ve yapılan değişiklikler

| Dosya | Değişiklik |
|---|---|
| `website-php/index.php` | Canonical alias yönlendirmesi GET ve HEAD için tutarlı |
| `website-php/seo.php` | Sitemap'te özel/noindex/uygunsuz rotaların savunmacı filtresi |
| `website-php/bin/seo-audit.cjs` | Bilinen yetkili indirme bağlantılarının yanlış uyarısı giderildi |
| `website-php/bin/indexing-audit.cjs` | Bounded read-only HTTP, canonical, meta, SSR, Googlebot UA, link, özel uç, alias ve HTTPS testleri eklendi; JSON/XML kanıt kaydı |
| `website-php/bin/indexing-policy-test.php` | Gerçek XML ayrıştırma, sitemap filtreleri, preview, canonical ve izole güvenlik/rate-limit testleri |
| `docs/growth/SEARCH_CONSOLE_SETUP.md` | Güncel 16 URL durumu ve gerçek hesapla yapılacak işlemler |
| `docs/audits/VENIUX_GOOGLE_INDEXING_AUDIT.md` | Bu rapor |

Mevcut robots/sitemap gereksiz yere yeniden oluşturulmadı. Hesap, teklif, download yetkilendirme kodları ve tasarım değiştirilmedi. Önceki donanım/KDV çalışmasındaki değişiklikler bu SEO değişikliklerinden ayrıdır ve bu çalışmada yayımlanmadı.

## 5. Yerel test sonuçları

İzole PHP 8.0.30 geliştirme sunucusu `127.0.0.1:39764` kullanıldı. Contact mail/notify kapalı, test depolaması `.local/indexing-audit/local-private` altında; müşteri veritabanı kullanılmadı.

| Çalıştırılan kontrol | Gerçek sonuç |
|---|---|
| Yeni `indexing-audit.cjs`, 16 URL | **377 PASS, 0 FAIL** |
| Mevcut `seo-audit.cjs`, 16 URL | **0 hata, 0 uyarı**; schema JSON/WebPage URL, sosyal meta, görsel alt metni kontrolleri dahil |
| `indexing-policy-test.php`, canlı ve yerel XML dosyalarıyla | **18 PASS**; DOMDocument/LIBXML_NONET ile gerçek XML/namespace kontrolü |
| Mevcut `seo-contact-test.php` | **13 PASS**; tarih/robots, bozuk form girdileri ve CSRF reddi; kayıt/mail yok |
| PHP index.php/seo.php syntax; Node iki audit script syntax | Geçti |
| İki mobil DOM/görsel örneklemi | Ana sayfa/stok: yatay taşma yok, ana içerik görünür |
| Local/live metadata karşılaştırması | 16 rotanın title/description/H1 değerleri aynı |

Test geliştirilirken string-key array unpack işlemi PHP 8.0'da hata verdi; test PHP 8.0 uyumlu `array_replace` ile düzeltildi ve yeniden 18/18 geçti. Hata gizlenmedi veya uygulamanın PHP sürümü değiştirilmedi.

Kanıt dosyaları: `.local/indexing-audit/local.json`, `local.xml`, `local-existing-audit.json`. Denetim scriptlerinin kontrolleri birbirleriyle örtüşür; sayılar bağımsız kullanıcı senaryosu veya Google başarı yüzdesi değildir.

Tekrar çalıştırma (PowerShell, izole yerel sunucu açıkken):

```powershell
$env:VENIUX_SEO_CHECK_URL='http://127.0.0.1:39764'
$env:VENIUX_INDEX_AUDIT_OUTPUT="$PWD/.local/indexing-audit/local.json"
node website-php/bin/indexing-audit.cjs
node website-php/bin/seo-audit.cjs
& C:/xampp/php/php.exe website-php/bin/indexing-policy-test.php .local/indexing-audit/live.xml .local/indexing-audit/local.xml
& C:/xampp/php/php.exe website-php/bin/seo-contact-test.php
```

## 6. Canlı site test sonuçları

| Kontrol | Gerçek sonuç |
|---|---|
| Yeni ayrıntılı denetim | **378 PASS, 2 FAIL**, 16 sayfa; FAIL yalnız iki HEAD alias yönlendirmesi |
| Mevcut SEO denetimi (yanlış bağlantı uyarıları düzeltildikten sonra) | 16 sayfa, **0 hata, 0 uyarı** |
| Robots/sitemap | 200; public crawl izinli; 16 benzersiz canonical HTTPS/non-www URL; XML ayrıştırma geçti |
| Canonical sayfalar | GET 200; benzersiz title/description, bir H1, self canonical, index izni, viewport ve SSR metin |
| Googlebot mobil User-Agent örneklemi | 16 sayfa 200 ve aynı title; gerçek Googlebot IP'si/Google render testi değil |
| İç bağlantılar/anchor'lar | Denetlenen anchor ve iç hedeflerde hata yok; oturum gerektiren dosya uçları 303 ile girişe yönleniyor |
| Özel sayfa/dosya koruması | Giriş/kayıt/indir noindex; özel kaynak HEAD istekleri 403/404; özel dosya gövdesi indirilmedi |
| Bilinmeyen sayfa | 404/noindex |
| HTTPS/non-www | Üç başlangıç varyantı doğru ana adreste 200'e ulaştı; HTTP www iki adım |
| CWV/gerçek mobil ağ | **NOT TESTED**: Lighthouse/CrUX/alan LCP-INP-CLS çalıştırılmadı |
| Search Console indeks raporu, WAF paneli, sunucu günlükleri | **BLOCKED**: hesap/panel/günlük erişimi yok |

Canlı kanıtlar: `.local/indexing-audit/live.json`, `live.xml`, `live-existing-audit.json`. Canlı başarısızlıklar yerel düzeltmeyle kapanmış gibi raporlanmadı. İstekler küçük bir teknik denetimdir; ziyaretçi simülasyonu, analitik olayı, form gönderimi veya paket indirme yapılmadı.

## 7. Search Console üzerinden manuel yapılması gereken işlemler

1. Yetkili Google hesabında `veniux.com` Domain mülkü açın; konsolun verdiği gerçek DNS TXT kaydını ekleyin. MX/SPF ve diğer kayıtları koruyun, doğrulama kaydını kaldırmayın.
2. Sitemaps bölümünde `https://veniux.com/sitemap.xml` gönderin; son okuma, keşfedilen URL sayısı ve hata durumunu kaydedin. [Sitemap hazırlama](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
3. Aşağıdaki ürün URL'lerinde kayıtlı URL Denetimi ve Canlı URL Testi sonuçlarını ayrı saklayın. Son tarama, HTTP, robots/noindex, kullanıcı canonical ve Google canonical alanlarını karşılaştırın. Canlı test, Google'ın indeks kararını garanti etmez. [URL Denetimi](https://support.google.com/webmasters/answer/9012289).
4. Uygun canonical URL'ler için indeksleme isteyin; tekrar tekrar talep göndermeyin. Login/hesap/dosya uçlarına indeksleme istemeyin.
5. Sayfa indeksleme raporundan kapsam dışı nedenleri ve örnek URL'leri dışa aktarın; taranmadı, tarandı-indekslenmedi, duplicate ve gerçek erişim hatalarını ayırın.
6. Tarama istatistikleri, robots erişimi, DNS/bağlantı, 429/5xx; ardından Manuel işlemler ve Güvenlik sorunlarını inceleyin. Hosting loglarından gerçek Googlebot isteklerini doğrulayın.
7. Son 28 günlük gösterim/tıklama/sorgu/sayfa/cihaz/ülke verisini mevcut `docs/growth/SEARCH_CONSOLE_28_DAY_TEMPLATE.md` ve CSV şablonuna aktarın. Önceki eşit dönemle aynı filtrelerde karşılaştırın; erişilemeyen veriyi sıfır saymayın.

Normal pazarlama sayfaları için Indexing API kurulmadı/kullanılmadı; API desteklenen özel içerik türleriyle sınırlıdır. [Resmi kapsam](https://developers.google.com/search/apis/indexing-api/v3/using-api).

## 8. İndekslenmesi hedeflenen URL listesi

Mevcut canlı sitemap aşağıdaki 16 URL'yi içeriyor. Yasal sayfalar da mevcut sitemap politikasına göre public/index; bunlar büyüme landing sayfası olarak sayılmamalı.

- https://veniux.com/
- https://veniux.com/stok-yonetimi
- https://veniux.com/depo-yonetimi
- https://veniux.com/lot-miat-takibi
- https://veniux.com/barkodlu-stok-takibi
- https://veniux.com/son-kullanma-tarihi-takibi
- https://veniux.com/el-terminali-depo-yonetimi
- https://veniux.com/program-indir
- https://veniux.com/fiyatlandirma
- https://veniux.com/sunucu-kurulumu
- https://veniux.com/guncelleme-notlari
- https://veniux.com/surum-arsivi
- https://veniux.com/kullanim-kosullari
- https://veniux.com/gizlilik-politikasi
- https://veniux.com/kvkk-aydinlatma
- https://veniux.com/cerez-politikasi

## 9. Düzeltilmeyen sorunlar ve gerekçeleri

- **Canlı iki HEAD hatası sürüyor:** yerel düzeltme hazır ve test edildi; bu görevde yayın onayı yok. Yayın sonrası canlı audit yeniden çalıştırılmalı.
- **HTTP www zinciri:** hosting/nginx ayarı gerektiriyor; ters proxy HTTPS algısını varsayarak PHP/.htaccess'e riskli kural eklenmedi. Hostingte tek 301 ile `https://veniux.com$request_uri` hedeflenmeli ve döngü/query korunumu test edilmeli.
- **Gerçek indeks durumu/kök neden:** Search Console ve doğrulanmış tarama günlükleri yok. İndeksleme, sıralama veya trafik artışı iddia edilmiyor.
- **Mobil CWV:** alan verisi ve Lighthouse ölçümü yapılmadı. İki responsive görünümün geçmesi performans başarısı değildir; mobil PageSpeed/CrUX veya GSC CWV raporu ayrı kontrol edilmeli.
- **WAF/IP bazlı kurallar:** yalnız dış HTTP örneklemi ve yerel firewall incelendi; panel/günlük olmadan tüm Google IP'lerinin engellenmediği kesinleştirilemez.
- **Editoryal genişletmeler:** mevcut sayfalar korunarak önerildi; yeni kopya sayfa, uydurma özellik veya müşteri referansı oluşturulmadı. GSC sorguları geldikten sonra öncelik verilmeli.

Üretim verileri, hesaplar ve yetkili indirmeler korunmuştur. Yerelde geçen testler Google indeksleme garantisi değildir.
