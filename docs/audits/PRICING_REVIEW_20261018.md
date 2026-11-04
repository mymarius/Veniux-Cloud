# Veniux fiyat değerlendirmesi — 18 Ekim 2026

Resmî sayfalarda görülen liste fiyatlarıdır; satış hacmi veya satın alınmış teklif verisi değildir. Ürünler birebir eşdeğer değildir. KDV bilgisi belirsiz rakamlar brüt fiyat gibi kullanılmadı.

| Ürün | Görülen yıllık bedel | Kapsam ve karşılaştırma sınırı |
|---|---:|---|
| [BenimPOS yıllık](https://fiyatbu.benimpos.com/) | 5.949,90 TL, KDV dahil | Satış/stok; sayfa sınırsız cihaz/personel ve tüm modülleri belirtiyor. Veniux'taki cihaz sınırlarıyla aynı değildir. |
| [BarkodSis Eko](https://www.barkodsis.com/stok-takip-programi) | 5.900 TL | 1 satış noktası, abonelik boyunca destek/güncelleme; incelenen fiyat yanında KDV durumu açık değil. Üst paketler teklifli. |
| [CariTakip](https://www.caritakip.tr/stok-takip-programi) | 4.999 TL | Stok/cari takibi; ilgili sayfada KDV durumu belirtilmiyor. Fiziksel donanım entegrasyonu eşdeğer kabul edilmedi. |
| [Bizim Hesap Temel Ticaret](https://bizimhesap.com/fiyatlar) | 10.440 TL + KDV | 870 TL/ay yıllık ödeme karşılığı; %20 varsayımıyla 12.528 TL. Ön muhasebe ve e-belge gibi daha geniş kapsamı var; Veniux bunları sunuyormuş gibi konumlandırılmadı. |

## Karar

Başlangıç önceki fiyatıyla da düşük konumdaydı. İlk müşteri edinimini desteklemek için sınırlı indirim; İşletme ve Kurumsal arasında daha düzenli bir fiyat basamağı seçildi. Bu ticari bir konumlandırma kararıdır; kârlılık veya talep artışı kanıtı değildir. Destek, barındırma ve müşteri edinme maliyeti bilinmediğinden sürdürülebilirlik pilot sonrasında yeniden değerlendirilmeli. En ucuz veya aynı özellikleri daha ucuza sunuyor iddiası yapılmadı.

| Paket | Eski yıllık | Yeni yıllık | Yeni 3 aylık | Yıllığın aylık karşılığı |
|---|---:|---:|---:|---:|
| Başlangıç | 4.188 | 3.588 | 1.188 | 299 |
| İşletme | 11.148 | 7.188 | 2.388 | 599 |
| Kurumsal | 22.188 | 14.388 | 4.788 | 1.199 |

Veniux tutarları TL, %20 KDV dahil. Aylık karşılık aylık satın alınabilen abonelik değildir. Yıllık tasarruf sırasıyla 1.164 / 2.364 / 4.764 TL; dört adet 3 aylık alıma göre hesaplanır. Kapsam/sınırlar ve mevcut lisanslar değiştirilmedi. Online ödeme yok; yenileme ayrıca tekliflenir.

## Dosyalar

- `website-php/pricing.php`: yeni brüt teklif bedelleri.
- `website-php/pricing-view.php`: artık bulunmayan eczane modülü iddialarının düzeltilmesi, dahil olmayan hizmetlerin açıklanması.
- `backend/src/config/commercialPricing.json`: aynı net/brüt kaynak fiyatları; API dağıtımı ve mevcut lisans değişikliği yapılmaz.
- `website-php/release-notes-20261018.php`: fiyat değişiklikleri ve mevcut sözleşmelerin değişmediği açıklaması.

Canlı site yayınına yalnız üç PHP dosyası dahildir; uygulama/API dosyaları bu site yayınıyla dağıtılmaz.

## Doğrulama ve yayın sonucu

Üç paket için PHP site fiyatları ile Node kaynak kataloğunun eşitliği, net/brüt %20 dönüşümü ve pozitif yıllık tasarruf çalıştırılarak doğrulandı. Üç PHP dosyasının sözdizimi ve SEO/iletişim koruma kontrolleri geçti. Üç site dosyası yedeklenerek yayımlandı; yıllık/3 aylık canlı fiyatlar, kaldırılmış eczane iddiasının bulunmaması ve güncelleme notu doğrulandı. Yedek ve SHA-256 kaydı: `.local/pricing-publish-20261018T000515Z/`. Backend kaynak fiyatları yerelde hazırdır; canlı API ve EXE/APK dağıtımı yapılmadı.
