# Hangi rapor ve özellik hangi pakette

## Kodda uygulanan
Paket kontrolü **modül** bazında yapılır: `stock`, `pos`, `wms`, `credit`, `reports_pro`.

| Özellik | Modül | Paketler |
|---|---|---|
| Gün sonu raporu, kampanyalar, en çok satanlar | pos | Retail Start, Pro, Business, Unified |
| Brüt kâr/zarar, kasiyer bazlı satış, saat yoğunluğu | reports_pro | Retail Pro, Business, Unified |
| Sadakat kartı ve puan (kasada kart okutma dahil) | reports_pro | Retail Pro, Business, Unified |
| Cari / veresiye, vade hatırlatması | credit | Retail Pro, Business, Unified |
| Ölü stok, şube karşılaştırması | stock | Tüm paketler |

**Uyarı:** En çok satanlar, kasiyer ve saat raporu şu an aynı ekranda ve aynı istekte geliyor. Bu yüzden en çok satanlar da `reports_pro` kapsamında; Start paketinde görünmüyor. Start'ta da açılmasını isterseniz ayrı bir isteğe bölünmesi gerekir.

`reports_pro` modülü sonradan eklendi. Daha önce satılmış Retail Pro, Business ve Unified sözleşmelerinin modül listesinde bu ad yazmıyor, ama haklarını koruyorlar; kod adından tanınıyorlar. Platform yöneticisi paket kataloğunda bu modülü "Gelişmiş raporlar ve sadakat" kutusuyla açıp kapatabilir. Modül yalnız `pos` olan paketlere eklenebilir.

## Önerim (karar sizin)
| Paket | Önerilen raporlar |
|---|---|
| Retail Start (1 şube) | Gün sonu, en çok satanlar, ölü stok, basit kampanya |
| Retail Pro (3 şube) | Start + brüt kâr/zarar, kasiyer bazlı satış, saat yoğunluğu, sadakat, şube karşılaştırması |
| Retail Business / Unified | Pro'nun tamamı (çok şubede şube karşılaştırması asıl değer) |
| Warehouse paketleri | Ölü stok, şube (depo) stok karşılaştırması |

Bu öneri, en çok satanlar dışında yukarıdaki tabloyla uygulandı.
