# Uçtan uca iş günü testi — 7 Ekim 2026

## Sonuç

İstenen 10 yazılım adımı **geçti**. Son tamamlanan koşuda uygulama hatası yok. Ayrıca mevcut satın alma, lot/transfer, kasa/vardiya, brüt kâr ve yedekleme modüllerinin **5 grubundaki 93 regresyon testi geçti**.

İşlemler mevcut uygulamanın gerçek API uçları ve servisleri üzerinden, ayrı SQLite dosyalarında çalıştırıldı. Her işlemi tarayıcıdan tıklayarak yapılan bir test değildir. Rapor ekranı tarayıcıda ayrıca doğrulandı. Üretim veritabanı açılmadı, yedeklenmedi, geri yüklenmedi ve değiştirilmedi; üretim API'si yeniden başlatılmadı.

Kanıt klasörü: `C:/Users/mymarius/Desktop/veniux.com/audit/business-day-1791368056888/`.

| Adım | Durum | Kanıt / sonuç |
|---|---|---|
| 1. Tedarikçi siparişi ve iki kısmi kabul | geçti | 20 adet sipariş; 10 + 10 kabul, 2 teslimat, tamamlandı. Sipariş/onay stok oluşturmadı. Aynı kabul anahtarı tekrar stok eklemedi. |
| 2. Depodan mağazaya lot/raf transferi | geçti | A lotundan 8, B lotundan 6 aktarıldı; kimlikler, tarihler ve raflar korundu. Tekrar gönderim ikinci transfer oluşturmadı. |
| 3. Başlangıç nakdiyle vardiya | geçti | 200 TL başlangıç; satışlar mağaza, kasa, kullanıcı ve açık vardiyaya bağlı. |
| 4. Nakit/kart/bölünmüş barkod satışı | geçti | 360 / 240 / 480 TL; toplam 1.080 TL. Barkod API girişi simüle edildi; baştaki sıfırlar korundu. |
| 5. Kısmi/hasarlı iade ve nakit çıkışı | geçti | 120 TL nakit iade, 120 TL kart iade, 1 adet hasarlı B lotu ve gerekçeli 50 TL nakit çıkışı. |
| 6. Vardiya kapanışı | geçti | Beklenen 570 TL; sayılan 565 TL; fark −5 TL, gerekçesiyle saklandı. |
| 7. Yeni vardiyada eski satışa iade | geçti | 565 TL açılış; 45 TL nakit + 75 TL kart iade; yeni beklenen 520 TL. Önceki kapanış nesnesi birebir aynı kaldı. |
| 8. Stok/lot/satın alma/kâr mutabakatı | geçti | Depoda 6, mağazada fiziksel 8 adet; mağazada 1 hasarlı, 7 satılabilir. Defter stokla aynı. KDV hariç net satış 600, maliyet 360, brüt kâr 240 TL. |
| 9. Excel/CSV içeriğinin ekranla eşleşmesi | geçti | Dosyalar API'den diske kaydedildi ve açıldı. Tarih, ürün, kategori, kasiyer filtreleri ve 600/360/240 TL toplamları tarayıcı ekranıyla aynı. |
| 10. Yedek ve ayrı SQLite'a geri yükleme | geçti | 20 tablo ve kullanıcı ilişkileri karşılaştırıldı; bütünlük `ok`, yabancı anahtar hatası 0. Kaynak verisi geri yükleme sırasında değişmedi. |
| Tarayıcıdan gerçek indirme dosyasının kaydı | doğrulanamadı | Excel düğmesi çalıştırıldı; İndirilenler klasöründe dosya kaydı gözlemlenemedi. API'den kaydedilen dosyanın açılması ile tarayıcının kaydetmesi ayrı kontrollerdir. |
| Fiziksel barkod okuyucu | doğrulanamadı | Okuyucu yok; simülasyon fiziksel test sayılmadı. |
| Gerçek termal yazıcı / banka POS'u | doğrulanamadı | Cihaz ve fiziksel tahsilat/çıktı testi yapılmadı. |
| MySQL | doğrulanamadı | Bekleyen; bu senaryo SQLite ile çalıştırıldı. |

## Uygulamadan bağımsız beklenen hesaplar

Beklentiler uygulama işlemlerinden **önce** `independent-expectations.json` dosyasına sabit değerlerle yazıldı. API toplamları beklenti üretmek için kullanılmadı; API yalnızca kimlikleri ve karşılaştırılacak sonuçları sağladı.

Tek ürün: barkod `0012345678905`, satış fiyatı 120 TL KDV dahil, KDV %20. Birim net satış 100 TL.

| Lot | Kabul | Birim alış KDV hariç | SKT | Kaynak raf | Mağaza rafı | Transfer |
|---|---:|---:|---|---|---|---:|
| DAY-A | 10 | 40 TL | 2099-01-01 | SRC-A | STORE-A | 8 |
| DAY-B | 10 | 60 TL | 2099-02-01 | SRC-B | STORE-B | 6 |

Satışlar: A'dan 3 adet nakit = 360 TL; B'den 2 adet kart = 240 TL; A'dan 2 + B'den 2 adet bölünmüş = 480 TL (180 nakit, 300 kart). Nakit müşterilerinden 400 + 200 = 600 TL alındı; 40 + 20 = 60 TL para üstü verildi. Net nakit tahsilat 540 TL, kart kaydı 540 TL.

İlk vardiyada A'dan 1 adet satılabilir iade = 120 TL nakit; B'den 1 adet hasarlı iade = 120 TL kart. İlk kapanış:

`200 + 540 − 120 − 50 = 570 TL`; sayılan 565 TL; fark `565 − 570 = −5 TL`.

Yeni vardiyada bölünmüş satışın A lotundan 1 adet iade: nakit payı `120 × 180 / 480 = 45 TL`; kart payı 75 TL. Yeni nakit `565 − 45 = 520 TL`.

Son lot miktarları:

- Depo A: `10 − 8 = 2`; depo B: `10 − 6 = 4`.
- Mağaza A: `8 − 3 − 2 + 1 + 1 = 5`.
- Mağaza B: `6 − 2 − 2 + 1 = 3`; bunun 1 adedi hasarlı, 2 adedi satılabilir.
- Fiziksel toplam: `20 − 9 satış + 3 iade = 14` (depo 6 + mağaza 8). Satılabilir toplam 13.

Kâr hesabı:

- Satış KDV dahil 1.080, KDV hariç 900 TL.
- İade KDV dahil 360, KDV hariç 300 TL.
- Net satış KDV hariç `900 − 300 = 600 TL`.
- İlk satılan maliyet: `5 A × 40 + 4 B × 60 = 440 TL`.
- Satılabilir A iadelerinin geri kazanılan maliyeti: `2 × 40 = 80 TL`.
- Hasarlı B iadesinde 60 TL maliyet geri kazanılmış sayılmadı.
- Satılan ürün maliyeti `440 − 80 = 360 TL`; brüt kâr `600 − 360 = 240 TL`.
- KDV dahil maliyet 432 TL; KDV dahil fark 288 TL. Bu brüt kâr, işletme giderlerini içeren net kâr değildir.

Satışlardan sonra ürünün güncel alış fiyatı 999 TL yapıldı. Rapor hâlâ satış anındaki lot maliyetlerini kullandı; geçmiş satışlar yeni alış fiyatıyla değişmedi.

## Dosya ve geri yükleme doğrulaması

`brut-kar.xlsx` Excel biçiminde açıldı; barkod hücresi metin türünde ve baştaki sıfırlar aynı. `brut-kar.csv` UTF-8/noktalı virgül biçiminde okundu. Tarih, Türkçe ürün adı, Gıda kategorisi, kasiyer ve toplam satırı kontrol edildi. Rapor ekranında aynı tarih/ürün/kategori/kasiyer filtreleri seçildi; DOM'daki satır ve filtre değerleri `browser-report-verification.json` dosyasına kaydedildi. Excel düğmesine basılması fiziksel dosya indirme başarısı olarak raporlanmadı.

SQLite online backup yöntemi ve mevcut yedek servisiyle alınan yedek, **farklı dosyadaki** `restored.sqlite` veritabanına uygulandı. Hedef önce tutarlı online yedekle oluşturuldu; hedefte ürün adı değiştirildi, ardından mevcut taşınabilir yedek/geri yükleme servisiyle eski veri geri getirildi. İşlem güvenlik yedeği oluşturdu ve açık geri yükleme onayını kullandı. Kaynak/hedef iş kayıtları karşılaştırıldı. Kullanıcı kimlik/rol/firma ilişkileri aynı; yeniden giriş için değişen oturum sürümü birebir eşitlik koşuluna alınmadı.

Karşılaştırılanlar: ürünler, tedarikçiler, depolar, raflar, kasa tanımları, sipariş/kalemler, kabul/kalemler, lotlar, stok defteri, raf stokları, depo stokları, hasarlı/karantina kayıtları, satış/iade/vardiya/nakit kayıtları, POS satışları ve kalemleri. `restore-comparison.json` sonuçları içerir. Kayıt karşılaştırması uygulamanın özet tutarına dayanmaz; SQLite satırları birincil anahtarlarıyla sıralanıp birebir karşılaştırılır.

## Değişiklikler ve tekrar çalıştırma

Mevcut arayüz/tasarım değiştirilmedi. `backend/src/config/database.js` içine yalnızca `NODE_ENV=test` ortamında kullanılabilen `TEST_SQLITE_PATH` desteği eklendi; normal üretim yolu aynı kalır. `.local/business-day-e2e.cjs` bağımsız beklentiler ve gerçek API/geri yükleme kontrollerini çalıştırır. `.local/business-day-preview.cjs` son test verisini 3002 portunda gösterir. Her koşu yeni bir test klasörü ve SQLite dosyası oluşturur.

Proje klasöründe `node .local/business-day-e2e.cjs` ile tekrar çalıştırılır. Son konum `.local/business-day-latest.json` içinde bulunur. Tarayıcı ekran kontrolü ayrıca yapılmalıdır; betik bunu otomatik geçmiş saymaz. Geçici tarayıcı sekmesi ve sunucusu bu doğrulama sonunda kapatıldı.

İlk üç denemede test betiğinin genel `id` sütunu varsayımı, hedef veritabanı bağlantı arayüzü ve parametre dönüşümü hataları düzeltildi. Bunlar uygulama iş akışı hatası olarak sayılmadı. Son koşuda tüm 10 iş adımı geçti; eski başarısız denemeler ayrı klasörlerde bırakıldı.

Kanıtlar: `results.json`, `independent-expectations.json`, `closed-shift.json`, `profit.json`, `brut-kar.xlsx`, `brut-kar.csv`, `business-day.vnxbackup`, `restore-comparison.json`, `browser-report-verification.json`, `profit-screen.jpg`. Ek regresyon sonucu: `audit/business-day-regression.json`.
