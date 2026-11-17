# Veniux karşılaştırması ve geliştirme sırası — 13 Ekim 2026

Hedef: mağaza ve küçük/orta depo işletmeleri. Karşılaştırma rakiplerin yayımladığı bilgiler ile Veniux kaynak incelemesine dayanır. Rakip ürünlerde gerçek işletme işlemi yapılmadı. Özellik sayısı, kullanım kolaylığı veya güvenilirlik için tek başına başarı ölçütü değildir.

| Ürün | Yayımlanan yaklaşım | Veniux için çıkarım |
|---|---|---|
| [Paraşüt](https://www.parasut.com/stok-ve-depo-takip-programi) | Ürün/barkod, Excel aktarımı, kritik stok, çoklu depo ve faturalarla birlikte stok takibi; internetten erişim. | Ürün ekleme → kabul → satış akışını basit anlatmak. Muhasebe/e-fatura entegrasyonu, Veniux'ta doğrulanmış teslimat olarak sunulmamalı. |
| [Skala](https://skalasuite.com/) | Üretim, iş emri, reçete/maliyet, stok ve sipariş akışları; muhasebe ve mağaza bağlantıları. | Üretim ağırlıklı geniş kapsamı bugün kopyalamak yerine mağaza/depo işlerini tamamlamak. |
| [EBS Depo Stok](https://www.depostokprogrami.net/) | Web ve masaüstü seçenekleri; depo yetkileri, transfer, barkod ve stok uyarıları. | Yerel Windows kurulumu ile Android bağlantısının şartlarını açık anlatmak; müşteriye kurulum kontrol listesi sunmak. |
| [NextTrack](https://www.nexttrack.com.tr/solutions/inventory-management/) | Lokasyon, lot/seri, sayım, RFID/barkod, sevkiyat ve envanter analizi. | Küçük depoda önce doğru miktar, doğru raf ve doğrulanmış sayım. RFID/GPS ve tahmin özelliklerini hazır gibi göstermemek. |
| [Mintsoft](https://www.mintsoft.com/warehouse-management/stock-control/) | Verilen sayfa ürün karşılaştırmasından çok FIFO, JIT ve diğer stok kontrol yöntemlerini açıklayan rehberdir. | Somut, ölçülebilir stok örnekleri ve işlem kontrol noktaları. Yazıda anlatılan yöntemleri ürünün uygulanmış özelliği olarak varsaymamak. |

## Veniux'ta mevcut kapsam

Kaynakta ürün/barkod, depo/lokasyon, mal kabul, toplama, sevkiyat, transfer, sayım, stok hareketleri, perakende kasa, firma/depo yetkileri ve QR ile yerel Android eşleştirmesi bulunuyor. Bunların hepsinin müşterinin cihazında uçtan uca denendiği anlamına gelmez. Eczane, İTS ve MEDULA kapsam dışında.

Windows işletme verilerini bilgisayarda tutar; Android aynı yerel ağdan bu bilgisayara bağlanır. Bu yapı rakiplerin internetten her yerden erişilen bulut hizmetleriyle eşdeğer değildir. Bağlı bilgisayar açık kalmalıdır.

## Bu düzenlemede yapılanlar

- Web sitesine yerel Manrope yazı tipi, daha okunaklı metin ve tutarlı mavi koyu tema.
- İki satırlı marka/menü düzeni; büyük logo ana görsel olarak korundu.
- Akış sekmelerine iç boşluk ve yuvarlatılmış kenarlar; aktif adımın belirginleştirilmesi.
- Örnek akış kartında açık yeşil zemin kaldırıldı; metin ve ürün satırı koyu temayla eşleştirildi.
- İletişim alanında dengeli sütunlar, yuvarlatılmış çerçeve ve uyumlu form alanları.
- Program aramasında eski /wms ekran adresleri gerçek /normal-depo adreslerine yönlendirildi; günlük işler Türkçe kısa adlarla gösterildi. API barkod çözümleme adresi korunur.

## Sonraki ürün hedefleri

1. Gerçek müşteri dosyasıyla ürün aktarımı, hatalı satır önizlemesi ve mükerrer barkod kontrolü için kabul testi.
2. Mal kabul → raf → mağaza satışı → iade → sayım senaryosunda stok mutabakatı; kesinti ve eş zamanlı işlem testi.
3. Gerçek Android telefon ve barkod terminaliyle QR, yeniden bağlanma, yetki ve cihaz kotası testi.
4. Yedek geri yüklemesini farklı bilgisayarda doğrulama ve müşteriye kısa kurtarma yönergesi.
5. Talebe göre muhasebe/e-ticaret bağlantıları; sağlayıcı sözleşmesi ve deneme hesabıyla ayrı kapsam.

Üretim reçetesi, RFID/GPS, e-fatura ve sınırsız internet erişimi bu sürümde eklenmiş sayılmaz. Tamamlanmadan reklamda vaat edilmemelidir. Rakiplerin ölçülmemiş başarı yüzdeleri veya müşteri yorumları kopyalanmaz.

## Doğrulama kaydı

- 2.4.15 Windows ve Android paketleri derlendi ve merkezi güncelleme kanalına yayımlandı.
- Dokuz program arama hedefi uygulamanın kayıtlı ekranlarıyla eşleşiyor; barkod çözümleme API adresi korundu.
- Erişim ve mobil eşleştirme testleri: 2 grup, 8 test başarılı.
- Paket içindeki yerel sunucu ayrı veri klasöründe başlatıldı; sağlık kontrolü başarılı, kaldırılan eczane uçları 410, yetkili kapatma başarılı.
- Android mevcut imza kimliğiyle imzalandı; v2 ve v3 imza doğrulaması başarılı.
- Canlı site: 11 sayfa SEO/canonical, sitemap, robots, özel sayfa hariç tutma ve 404 kontrolleri başarılı.
- 390 piksel mobil görünümde yatay taşma görülmedi; menü açıldı, form tek sütun. Masaüstünde akış sekmeleri çalıştı; URL'ye bölüm kodu eklenmedi.
- Yeni yazı tipi: 29.652 bayt WOFF2; Türkçe karakterler mevcut, canlı dosya 200 ve bir yıllık önbellek başlığı dönüyor.
- Yeni PageSpeed puanı bu düzenlemede ölçülmedi. Gerçek işletme/cihaz kabul testleri sonraki hedefler arasında.
