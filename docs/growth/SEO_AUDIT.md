# Teknik SEO kanıtı

15 Ekim 2026. Canlı herkese açık sayfalar düşük sayıda GET ile okundu; üretimde değişiklik/yük testi yok. Kanıt: .local/seo-audit.json ve master-live-seo-check.log.

- /sunucu-kurulumu — 200 — Veniux Kurulum Seçenekleri | Otomatik ve Ayrı Sunucu
- /guncelleme-notlari — 200 — Güncelleme Notları | Veniux Windows ve Android
- /program-indir — 200 — Veniux İndir | Windows Stok Programı ve Android Uygulaması
- /fiyatlandirma — 200 — Veniux Cloud Fiyatlandırma | 3 Aylık ve Yıllık Stok Yönetim Planları
- / — 200 — Veniux | Stok ve Depo Takip Programı, Windows ve Android
- /stok-yonetimi — 200 — Stok Yönetim Programı ve Barkodlu Takip | Veniux Cloud
- /depo-yonetimi — 200 — Depo Yönetim Yazılımı ve Mal Kabul | Veniux Cloud
- /lot-miat-takibi — 200 — Lot ve Miat Takibi | Veniux Cloud
- /kullanim-kosullari — 200 — Kullanım Koşulları | Veniux
- /gizlilik-politikasi — 200 — Gizlilik Politikası | Veniux
- /kvkk-aydinlatma — 200 — KVKK Aydınlatma Metni | Veniux
- /cerez-politikasi — 200 — Çerez ve Yerel Depolama Politikası | Veniux

12 sayfada hata0/uyarı0: sitemap benzersiz URL, robots Allow, title/description ayrımı, canonical, tekH1, index header, OG, Twitter alt ve WebPage/Breadcrumb JSON-LD. /giris ve /kayit noindex; bilinmeyen URL404. Ana içerik PHP ile sunucuda render ediliyor. HTTP ve www ana sayfa varyantları ayrıca doğrulandı; Googlebot gerçek logları ölçülmedi.

Yerel düzeltmeler: sabit11 URL testi artık sayfa arttığında yanlış alarm vermiyor. lastmod yalnız editoryal olarak bilinen geçerli geçmiş tarih varsa üretiliyor; bütün dosyaların yükleme saatini güncellik kanıtı saymıyor. Kaynak: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

Trafik teşhisi:24 saatte8 istek tek başına indekslenememe kanıtı değil; bot/user ayrımı, Search Console mülkü, gösterim/sorgu ve erişim logu gerekir. Arama konsoluna erişim olmadığı için indeks/CTR/sıralama sayısı verilmedi. Yeni Lighthouse veya Core Web Vitals puanı üretilmedi. Hız kabulü: mobil/masaüstü sayfaları, soğuk/sıcak önbellek ve yavaş ağda ölç; LCP/INP/CLS’yi alan verisi varsa28 günlük pencereyle değerlendir.

Yeni sayfa politikası: önce mevcut stok/depo/lot URL’lerini güçlendir; yalnız ayrı kullanıcı ihtiyacı varsa bağımsız rehber. Site kopyası, sahte sık güncelleme, arama motoru pingi veya sahte trafik motoru kurulmayacak.

Ek canlı yönlendirme kontrolü: http://veniux.com/ ve https://www.veniux.com/ tek301 ile https://veniux.com/ adresine ulaşıyor; son yanıt200. Kanıt: .local/master-redirects.json.

## Phase2 — 15 Ekim 2026

Phase2: mevcut12 canlı sayfa ve iç fragment hedefleri hata0/uyarı0;390px mobil12sayfada taşma yok. Yerel12sayfada noindex/canonical/şema kontrolü ve üç ürün alanı geçti. Search Console/indeks/sıralama verisi yok.
