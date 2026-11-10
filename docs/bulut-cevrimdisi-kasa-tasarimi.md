# Bulut kasası: internetsiz çalışma tasarımı

Durum: **tasarım, kod yok.** Bugün bulutta kasa satış için internet ister; masaüstü sürümü ise kendi bilgisayarında internetsiz çalışır.
Hedef: bulut kasasında internet kesilince dükkânın satışı durmasın, bağlantı gelince kayıtlar kendiliğinden sunucuya işlensin.

## Elimizde hazır olanlar
- Satış `Idempotency-Key` ile gönderiliyor; aynı satış iki kez gönderilse bir kez işlenir (stok ve nakit iki kez düşmez).
- 2.4.53 ile kasa cihazı kaydı ve kasa-gün fiş numarası geldi. `pos_devices.emergency_prefix` ve `pos_sale_meta` (`client_uuid`, `mode`, `local_receipt_no`) bu iş için ayrılmıştı.
- Ürün listesi tarayıcıda 24 saate kadar önbelleğe alınıyor (`shared/retailCatalogCache.mjs`); çevrimdışıyken şimdilik yalnız gösteriliyor, satışa eklenmiyor.

## Neyi desteklemeyeceğiz (bilerek)
Sunucuda doğrulanması gereken işlemler çevrimdışı yapılamaz: **iade, iptal, indirim, fiyat değişikliği, veresiye, sadakat puanı, kampanya, vardiya açma/kapama.** Çevrimdışıyken yalnız **nakit/kart satış** yapılır. Kart tutarı zaten banka cihazında ayrıca tahsil edilir.

## Aşamalar (her biri ayrı sürüm)
1. **Altyapı:** uygulama kabuğunu önbelleğe alan service worker; "çevrimdışı" durumunun algılanması ve kasada gösterilmesi; açık vardiyada yerel satış kuyruğu (IndexedDB); cihaz önekli geçici fiş numarası (ör. `E1-00001`); kuyruğun ekranda görünmesi.
2. **Eşitleme:** bağlantı gelince kuyruk sırayla `POST /scanner/sale` ile gönderilir (`client_uuid` = idempotency anahtarı, `offline_at`, geçici fiş no). Sunucu satışı kabul eder ve `pos_sale_meta.mode='offline'` yazar. Gönderim yarıda kesilirse aynı anahtarla tekrar denenir.
3. **Uyuşmazlık ekranı:** sunucunun kabul edemediği satırlar (aşağıdaki karar) müdüre listelenir; vardiya, kuyruk boşalmadan kapanmaz; raporlarda "çevrimdışı satış" işareti görünür.

## Sizden bir karar gerekiyor
Çevrimdışıyken satılan ürün, bağlantı gelince sunucuda **stokta yetersiz** çıkarsa ne olsun? (Bugünkü kural "yetersiz stokta satış yapılmaz" çevrimdışıyken uygulanamaz; müşteri ürünü almış olabilir.)
- **A (önerilen):** Satış yine kayda geçer, stok eksiye düşmez; fark "uyuşmazlık" listesine yazılır, müdür stok düzeltmesi yapar. Raporlar doğru kalır, stok sayımla düzelir.
- **B:** Satış kayda geçer, stok eksiye düşer. Basit ama stok verisi bozulur.
- **C:** Yetersiz stoklu satır reddedilir ve müdüre bildirilir. Kasadaki para ile kayıt tutmaz.

## Riskler
- Kuyruk tarayıcı deposunda durur; tarayıcı verisi temizlenir veya cihaz bozulursa **gönderilmemiş satışlar kaybolur.** Kasada "X satış gönderilmeyi bekliyor" uyarısı ve 24 saat sınırı olacak.
- Çevrimdışı saat farkı: satış saati cihaz saatidir; sunucu `offline_at` ile gerçek gönderim zamanını ayrı tutar.
- Gönderim sırasında bağlantı kopması "sonucu belirsiz" durum üretir; idempotency anahtarı bunu güvenli yapar, test planı bu kopma senaryolarını içerir.
- Aşama 2 yeni tablo gerektirebilir (uyuşmazlık kaydı); bu bulutta şema yükseltmesi (015) demektir.

## Test planı
Satış sırasında ağ kesme, yarıda kesilen gönderim, aynı satışın iki kez gönderilmesi, iki kasanın aynı ürünü çevrimdışı satması, gün sonunda kuyruk doluyken vardiya kapatma denemesi.
