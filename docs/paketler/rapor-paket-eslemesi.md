# Hangi rapor ve özellik hangi pakette

## Şu an kodda uygulanan
Paket kontrolü **modül** bazında yapılır (`stock`, `pos`, `wms`, `credit`).

| Özellik | Modül | Açık olduğu paketler |
|---|---|---|
| Gün sonu raporu, brüt kâr/zarar | pos | Retail Start, Pro, Business, Unified |
| En çok satanlar, kasiyer bazlı satış, saat yoğunluğu | pos | Retail Start, Pro, Business, Unified |
| Kampanyalar (X al Y öde, yüzde, tarih aralığı) | pos | Retail Start, Pro, Business, Unified |
| Sadakat kartı ve puan | pos | Retail Start, Pro, Business, Unified |
| Cari / veresiye, vade hatırlatması | credit | Retail Pro, Business, Unified |
| Ölü stok | stock | Tüm paketler (depo paketleri dahil) |
| Şube karşılaştırması (stok + satış) | stock | Tüm paketler; depo paketlerinde satış sütunu boş kalır |

## Önerim (karar sizin)
| Paket | Önerilen raporlar |
|---|---|
| Retail Start (1 şube) | Gün sonu, en çok satanlar, ölü stok, basit kampanya |
| Retail Pro (3 şube) | Start + brüt kâr/zarar, kasiyer bazlı satış, saat yoğunluğu, sadakat, şube karşılaştırması |
| Retail Business / Unified | Pro'nun tamamı (çok şubede şube karşılaştırması asıl değer) |
| Warehouse paketleri | Ölü stok, şube (depo) stok karşılaştırması |

Öneriyi uygulamak için katalogda yeni bir modül gerekir: örneğin `reports_pro`. Bunun için paket doğrulaması (`productPackages.js`) ve paket kataloğu değişmeli. Henüz yapılmadı; onay verirseniz eklenir. Önerinin gerekçesi: Start paketindeki küçük market en çok satanları ve ölü stoğu görür. Kâr, kasiyer ve saat analizi ise birden çok kasiyeri olan işletmelere değer katar ve üst pakete geçme sebebi olur.
