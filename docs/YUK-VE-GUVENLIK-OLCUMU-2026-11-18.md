# Yük ve dayanıklılık ölçümü (18 Kasım 2026)

Amaç: 1 Ocak öncesi sunucunun kaç eş zamanlı kullanıcıyı kaldırdığını ve istek korumasının doğru çalıştığını görmek.

## Ortam
- Yerel geliştirme makinesi (15,9 GB RAM, başka uygulamalar açık), SQLite, tek Node.js süreci. Gerçek bulut sunucusu (MySQL, daha güçlü donanım) daha iyi sonuç verir; bu ölçüm alt sınır sayılmalıdır.
- Karışık okuma isteği: ürün arama/liste, günlük rapor, stok hareketleri, depolar, tedarikçiler, stok sağlığı, stok analizi (ağır olanlar dahil).
- Her sanal kullanıcı farklı istemci adresiyle (vekil arkasındaki bulut durumu gibi) ve kendi oturumuyla bağlandı.

## Sonuç
| Senaryo | İstek/sn | p50 | p95 | p99 | Hata |
|---|---|---|---|---|---|
| 20 kullanıcı, her biri ~5 istek/sn | 92 | 11 ms | 24 ms | 64 ms | 0 |
| 100 kullanıcı, her biri ~5 istek/sn | 434 | 12 ms | 132 ms | 215 ms | 0 |
| 100 kullanıcı, kısıtsız | 507 | 188 ms | 293 ms | 334 ms | 0 |
| 300 kullanıcı, kısıtsız | 427 | 710 ms | 1036 ms | 1100 ms | 0 |

Yorum: Tek süreç saniyede yaklaşık 450–500 karışık isteği işliyor. Bir kasa istasyonu ortalama 1–2 istek/sn üretirse tek süreç kabaca 250 istasyonu rahat karşılar; 100 kullanıcıda gecikme hâlâ düşük (p95 132 ms). Hiçbir senaryoda hata yok. 300 kullanıcı aynı anda durmaksızın istek gönderirse kuyruk oluşuyor (p95 ~1 sn); bu gerçek kullanımda beklenmeyen bir senaryo.

## Bulunan sorun ve düzeltme (önemli)
`requestFirewall` her istemciyi yalnızca bağlantı adresiyle sayıyordu (dakikada 6000, 10 saniyede 600 istek). Bulutta uygulama Plesk/Passenger vekilinin arkasında çalıştığı için **tüm müşteriler aynı yerel adresten geliyor gibi görünür**; yani bu sınır tüm müşterilerin ortak sınırı olurdu (yaklaşık 100 istek/sn). Müşteri ve cihaz sayısı artınca herkese birden "İstek sınırına ulaşıldı" hatası gelebilirdi.

Düzeltme: `apiThrottle`'da zaten olan istemci adresi mantığı paylaşıldı. Bağlantı yerel vekilden geliyorsa vekilin eklediği **en sağdaki** `X-Forwarded-For` girdisi, doğrudan bağlantıda hiçbir başlık kullanılmıyor. Soldaki (istemcinin yazabildiği) girdilerle kota aşılamıyor. Yeni testler bunu doğruluyor (`backend/tests/requestFirewall.test.js`).

Bu düzeltme bulutta ancak sunucu güncellenince etkili olur (sunucu kodu değişti).

## Çevrimdışı ve güvenlik
- Çevrimdışı satış: eşitleme, çift kayıt önleme ve stok doğruluğu otomatik testlerle kapsanıyor (tam backend testi geçiyor). Telefon/tarayıcıdaki servis çalışanı davranışı otomatik olarak denenemedi; gerçek cihazda elle denenmeli (internet kapat, 3 satış yap, aç, eşitlemeyi gör).
- Güvenlik: kimlik, yetki, dosya yükleme, yedek şifreleme ve istek koruması testleri mevcut ve geçiyor; son denetim bulguları `security/acik-riskler-karar-2026-11-09.md` içinde. En büyük açık risk hâlâ imzasız Windows güncellemesi (kod imzalama sertifikası bekleniyor).

## Önerilen sonraki ölçümler
1. Gerçek bulut sunucusunda aynı betikle (MySQL) kısa ölçüm; Plesk'in kaynak sınırlarını görmek için.
2. Yazma ağırlıklı yük (satış, stok girişi) ve MySQL kilitlenme davranışı.
3. Gerçek cihazda çevrimdışı deneme (yukarıdaki adımlar).
