# Search Console kurulumu ve raporu

15 Ekim 2026. Hesaba bağlanılmadı, TXT kaydı değiştirilmedi, sitemap gönderilmedi.

1. Yetkili Google hesabıyla Domain mülkü olarak veniux.com ekleyin. DNS doğrulama değerini doğrudan konsoldan kopyalayın; örnek/uydurma token kullanmayın.
2. DNS panelinde kök alan adına TXT ekleyin; mevcut MX/SPF/TXT kayıtlarını silmeyin. Domain mülkü tüm alt alanları kapsar; yetkili hesapları en az erişimle tutun.
3. DNS yayılımından sonra konsolda doğrulayın, TXT kaydını koruyun. Alternatif URL-prefix mülkü https://veniux.com için meta/HTML dosyası doğrulaması kullanılabilir; URL-prefix kapsamı daha dardır.
4. Sitemaps bölümünde https://veniux.com/sitemap.xml gönderin. Hesap/giriş/dosya adreslerini eklemeyin.
5. URL Inspection: ana sayfa, stok, depo ve lot URL’sinde canlı test→HTTP/robots/noindex/canonical/render kontrolü→uygunsa indeks talebi. Talep indeks garantisi değildir; tekrar tekrar göndermeyin.
6. Page Indexing: keşfedildi/tarandı fakat indekslenmedi, yönlendirme, duplicate canonical,404,5xx sebeplerini ayrı gruplandırın. Mevcut URL’yi sırf indekslenmedi diye silmeyin.

Haftalık tablo sütunları: tarih aralığı, önceki eşit dönem, total clicks, impressions, CTR, average position, indexed/non-indexed, query, landing page, device, country. Veri yoksa “erişim/veri yok” yazın. Aynı filtre ve saat dilimini kullanın. Marka ve marka dışı sorguları ayrı inceleyin.24 saatlik küçük örnekten başarı/başarısızlık kararı çıkarmayın.

Kaynak: https://support.google.com/webmasters/answer/9008080

## 16 Ekim 2026 kontrolü (tarihsel)

Canlı 12 sayfa denetlendi; yerelde üç yeni konu ile sitemap 15 URL hazırlandı. Yayın yapılmadı. Yeni barkod, son kullanma tarihi ve el terminali URL’leri yayın sonrası Inspection listesine eklenmeli. Gerçek hesap, TXT doğrulaması ve sitemap gönderimi hâlâ manuel bekliyor.

## 17 Ekim 2026 güncel durum

Canlı sitemap artık 16 URL içeriyor; tamamı bu denetimde GET 200 verdi. Yukarıdaki 12/15 sayıları geçmiş denetimin durumudur. Güncel URL listesi ve kanıtlar: `../audits/VENIUX_GOOGLE_INDEXING_AUDIT.md`. Gerçek Google hesabına erişilmedi; doğrulama ve sitemap gönderimi yapılmış sayılmaz.

- [ ] Domain mülkünü gerçek konsoldan alınan DNS TXT değeriyle doğrulayın; mevcut DNS kayıtlarını koruyun.
- [ ] `https://veniux.com/sitemap.xml` gönderin; son okuma ve hata durumunu kaydedin.
- [ ] Ana sayfa, stok, depo, barkod, lot/miat, tarih kontrolü, Android/el terminali ve indirme sayfasında URL Denetimi açın.
- [ ] Kayıtlı indeks verisi ile canlı testi ayrı kaydedin: son tarama, taramaya izin, alınan HTTP yanıtı, kullanıcı canonical ve Google tarafından seçilen canonical. Canlı test Google canonical seçimini/indekslenmeyi garanti etmez.
- [ ] Canlı testte oluşturulan HTML ve ekran görüntüsünü inceleyin; yalnızca uygun canonical URL için bir kez indeksleme isteyin.
- [ ] Sayfa indeksleme nedenlerini, örnek URL'leri ve ilk/son görülme tarihini dışa aktarın. Yönlendirme ve özel sayfa noindex durumlarını gerçek hatalardan ayırın.
- [ ] Ayarlar → Tarama istatistikleri: DNS, sunucu bağlantısı, robots erişimi, 429/5xx ve yanıt süresini inceleyin.
- [ ] Manuel işlemler ve Güvenlik sorunları bölümlerini kontrol edin; erişim olmadan temiz kabul etmeyin.
- [ ] Hosting erişim günlüklerinde Googlebot isteklerini resmi IP listesi veya ters/ileri DNS ile doğrulayın; yalnız User-Agent yeterli değildir.
- [ ] Son 28 gün için mevcut `SEARCH_CONSOLE_28_DAY_TEMPLATE.md` ve CSV şablonunu gerçek sorgu/sayfa/cihaz/ülke verileriyle doldurun. Verisiz alanlara sıfır yerine “veri yok” yazın.

Normal ürün sayfaları için Indexing API kullanılmayacak. Kaynaklar: [URL Denetimi](https://support.google.com/webmasters/answer/9012289), [Google tarayıcısını doğrulama](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests), [Indexing API kapsamı](https://developers.google.com/search/apis/indexing-api/v3/using-api).
