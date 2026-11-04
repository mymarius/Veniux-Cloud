# Search Console: 28 günlük analiz şablonu

Durum: Gerçek Google hesabına bağlanılmadı. Doğrulama token’ı, tıklama, gösterim, sorgu, sıra ve indeks sayısı elde edilmedi. Temel kurulum SEARCH_CONSOLE_SETUP.md içinde.

## Mülk ve kurulum

- [ ] Yetkili hesapta Domain mülkü veniux.com açıldı.
- [ ] Konsolun verdiği gerçek TXT kök alan adına eklendi; eski kayıtlar korunuyor.
- [ ] Doğrula başarılı; doğrulama TXT’si silinmedi.
- [ ] https://veniux.com/sitemap.xml Sitemaps bölümüne gönderildi, son okuma/hata kaydedildi.
- [ ] Mülk yetkileri kontrol edildi; gereksiz sahip eklenmedi.

## URL Inspection kontrol listesi

Ana sayfa, stok, depo, lot ve güncelleme sayfasında: Google’ın bildiği durum; canlı test; HTTP200; robots erişimi; noindex yok; kullanıcı canonical ve Google canonical karşılaştırması; render edilmiş metin; sitemap keşfi; mobil ekran; son tarama tarihi. İndeks talebi yalnız anlamlı düzeltmeden sonra; talep başarı garantisi değildir. Hesap/dosya sayfalarında indeks talep etmeyin.

## Dönem

Search type Web; ülke Türkiye; cihaz filtresi önce tümü, sonra mobile/desktop. Son28tam ve raporlanmış gün ile önceki eşit28günü karşılaştırın; geçici/eksik son günleri not edin. Aynı filtreyi tüm dışa aktarımlarda koruyun. Bugüne kadar veri yoksa sıfır yazmayın.

| Gösterge | Son28gün | Önceki28gün | Değişim | Karar |
|---|---|---|---|---|
| Tıklama | Veri yok | Veri yok | Hesaplanamaz | Erişim bekleniyor |
| Gösterim | Veri yok | Veri yok | Hesaplanamaz | Erişim bekleniyor |
| CTR | Veri yok | Veri yok | Hesaplanamaz | Oranları pay/paydayla hesapla |
| Ortalama konum | Veri yok | Veri yok | Hesaplanamaz | Sorgu/cihaz bileşimiyle yorumla |
| İndekslenen/indekslenmeyen | Veri yok | Veri yok | Hesaplanamaz | Page Indexing nedenleri ayrı |

Sorgu tablosu: query, brand/nonbrand, clicks, impressions, CTR, position, landing page, device, country, previous values, proposed action. Sayfa tablosu: canonicalURL, clicks, impressions, queries, indexing reason, content gap, next action. Anonimleştirilmiş sorgular ve export sınırı nedeniyle toplamlar birebir eşleşmeyebilir.

Kararlar: gösterim var/tıklama düşük→niyet ve title açıklığı; taranmış/indekslenmemiş→özgünlük/yarar/canonical; URLhatası→teknik düzeltme; gösterim yok→indeks, niyet ve dağıtımı birlikte incele. Küçük örnekte yüzde artışını başarı manşeti yapmayın.

Resmi kaynaklar: https://support.google.com/webmasters/answer/9008080 ; https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
