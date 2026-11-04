# Satın alma iptal akışı — tamamlanan tarayıcı doğrulaması

6 Ekim 2026 (Europe/Istanbul).

## Önceki engel ile uygulama eksiklerinin ayrımı

Önceki oturumda yerel `window.confirm` açık kaldığında test aracının `Emulation.setFocusEmulationEnabled` çağrısı zaman aşımına uğramıştı. İletişim kutusunu okuma/kapatma girişimleri de aynı araç hatasına takılmıştı. Bu, satın alma sunucusunun reddi veya iptal stok hesabının bozulması değildi. Bu oturum başında kaynak kodunda yerel iletişim kutusu zaten kaldırılmıştı; ekrandaki ayrı onay düğmesi temiz bir test sekmesinde çalıştı. Önceki odak engeli yeni oturumda tekrar oluşmadı.

Test sırasında tarayıcı görünümünün genişliği ve sayfası değişti. Kararlı bir görünümle ana işlem denemeleri tamamlandı; geçici görünüm ayarı sonunda kaldırıldı. Son ekran yakalamalarında daralan görüntü alanı nedeniyle bazı görseller kesildi. Bu ekran yakalama sınırlaması, tamamlanan tarayıcı işlemlerinin veya veritabanı sonuçlarının yerine başarılı test olarak sayılmadı.

Uygulamadaki ayrı eksikler giderildi: tekrar gönderim kontrolü yalnızca React durumuna bağlıydı; hata yalnızca geçici bildirimde gösteriliyordu; kabul edilmiş durum değişimi ile sonraki bilgi yükleme hatası açıkça ayrılmıyordu. Artık aynı anda çalışan işlem için senkron bir kilit var. Gerekçe ve açık onay korunur, işlem sırasında düğmeler/gerekçe/kapatma kilitlenir. Sunucu hatasında kalıcı, anlaşılır bir mesaj ve yeniden deneme imkânı vardır. Durum değişimi kabul edildiyse sonraki okuma sorunu yeni bir başarısız iptal gibi sunulmaz; güncel bilgileri yeniden yükleme seçeneği gösterilir.

## Ortam ve yöntem

Üretim iş verileri kullanılmadı. `backend/stok_takip_test.db` içinde ayrı işletme, kullanıcı, tedarikçi, ürün, depo ve raf hazırlandı. Bu işletmenin siparişi, onayı, kısmi kabulü, iptali ve iadesi **tarayıcıdan** oluşturuldu; önceden hizmet çağrılarıyla hazırlanmış sipariş kullanılmadı.

Test sunucusu yalnızca `127.0.0.1:3001` üzerinde çalıştı. İlk iptal isteği iki saniyelik bekleme sonunda kontrollü HTTP 503 döndürdü; sonraki iptal isteği iki saniye bekledikten sonra gerçek uygulama API'sine iletildi. Bu müdahale sadece `.local/procurement-browser-review.cjs` test sunucusunda vardı; üretim uçlarına hata simülasyonu eklenmedi. Otomatik dış sipariş veya mesaj gönderilmedi.

## Tarayıcı sonuçları

| Senaryo | Gerçek sonuç |
|---|---|
| Taslak oluşturma ve onay | 10 adet sipariş; stok 0 kaldı. Taslak, onay bekliyor ve onaylandı ekran durumları görüldü. |
| Kısmi kabul | 4 adet, `BROWSER-IRS-001`, `BROWSER-LOT-01`, 2099-04-01 tarihi ve seçilen rafla kabul edildi. Ekranda alınan 4, kalan 6, depo stoku 4 görüldü. |
| İptalden vazgeçme | Gerekçe girilip açık onay verildi; onay geri alınınca son iptal düğmesi kapandı. HTTP kaydında iptal isteği sayısı 0'dı. |
| İşlem sırasında kilit | Son iptal düğmesi, onay düğmesi, gerekçe alanı ve kapatma düğmesi devre dışıydı. |
| Sunucu hatası | Kontrollü 503 sonrası durum kısmen teslim alındı, alınan miktar 4, iptal miktarı 0 ve stok 4 kaldı. Gerekçe kaybolmadı; yeniden deneme düğmesi açıldı. Teknik test hata metni müşteriye gösterilmedi. |
| Çift tıklama ve yeniden deneme | Aynı son düğmeye çift tıklandı; yalnızca bir başarılı iptal isteği gitti. Tüm denemelerde HTTP durumları `[503, 200]`; başarılı iptal ve denetim kaydı sayısı 1. |
| Kalan miktarı iptal | Sayfa yenilenmeden sipariş listesi ve detay “İptal”, alınan 4, kalan 0, iptal 6 ve depo stoku 4 olarak güncellendi. Gerekçe ve işlemi yapan kullanıcı bilgili iptal geçmişi göründü. |
| İptal sonrası tedarikçiye iade | Aynı kabul satırındaki 1 adet hasarlı ürün açık onayla iade edildi. Lot, tarih ve raf korundu; stok 3 oldu. Sipariş iptal kaldı, kalan miktar yeniden açılmadı. İade geçmişi sayfa yenilenmeden göründü. |
| Tedarikçi geçmişine dönüş | Kartta ürün, iptal siparişi, alınan 4 / iade 1 teslimatı ve iade gerekçesi görüldü. Kartın sipariş bağlantısı ile detay yeniden açıldı. |

Ana mutasyon denemelerinde sayfa yenilemesi kullanılmadı; durum ve geçmişin yenilenmeden güncellendiği işlem anında gözlendi. Sonraki tedarikçi sayfasına geçiş, sonuçların başka ekranda da görüldüğünü doğrulamak içindi.

## Kanıt ve testler

- `audit/procurement-cancel-browser-results.json`: nihai ayrı SQLite sonucu ve tarayıcı senaryoları.
- `audit/procurement-browser-http.jsonl`: anahtar/token içermeyen istek yolu, işlem ve HTTP durumları.
- `audit/purchase-cancel-abandoned.jpg`, `audit/purchase-cancel-pending.jpg`, `audit/purchase-cancel-server-error.jpg`: vazgeçme, bekleme ve hata ekranları.
- `audit/purchase-cancel-complete.jpg`: iptal sonrası alınan 4, kalan 0, iptal 6 ve korunmuş stok 4 ekranı.
- `audit/procurement-cancel-regression.json`: ilgili **3 grup, 38/38 test geçti**. Mevcut iptal testine detaydan gerçek depo stokunun doğrulanması ve tekrarlı iptalin tek denetim kaydı bırakması eklendi.

Son ön yüz derlemesi başarılı. Mevcut 500 kB paket boyutu uyarısı devam ediyor. Bu turda tüm 417 test yeniden çalıştırılmadı; değişiklikle ilişkili 38 test çalıştırıldı. Fiziksel cihaz ve gerçek MySQL testi yapılmadı. Ayrı tarayıcı test sunucusu kapatıldı.

## Kaynak değişiklikleri

- `frontend/src/pages/PurchaseOrders.jsx`: senkron işlem kilidi, kalıcı hata/yeniden deneme, kabul edilen değişim sonrası bilgi yenileme ayrımı, açık onay ve vazgeçme, iptal geçmişi, gerçek depo stokunun gösterilmesi; dar ekranda kalem bilgilerinin satıra yayılması. Mevcut tablo ve çekmece tasarımı korundu.
- `backend/src/services/procurementService.js`: mevcut sipariş detayında hedef depodaki gerçek ürün stok toplamı. Stok yazma veya iptal kuralı değişmedi.
- `backend/tests/procurement.test.js`: mevcut kritik iptal testinin genişletilmesi.

Yeni modül, bağımlılık veya şema geçişi eklenmedi.
