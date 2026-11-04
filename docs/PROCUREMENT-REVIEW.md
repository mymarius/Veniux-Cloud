# Tedarik, satın alma ve mal kabul incelemesi

6 Ekim 2026 güncellemesi: aşağıdaki önceki iptal düğmesi doğrulama açığı sonuçlandırıldı. Vazgeçme, açık onay, sunucu hatası/yeniden deneme, çift tıklama ve iptal sonrası lotlu iade tarayıcıda tamamlandı. Ayrıntılar: [PURCHASE-CANCEL-VERIFICATION.md](PURCHASE-CANCEL-VERIFICATION.md).

5 Ekim 2026 — mevcut SQLite veritabanı ve ayrı SQLite test ortamı.

## Bulgular ve tamamlanan bağlantılar

Mevcut satın alma tabloları, tedarikçi kartları, düşük stok önerileri, WMS mal kabul hizmeti, lot/raf stok hareketleri, işlem tekrar anahtarları ve denetim kayıtları kullanıldı. İkinci bir satın alma veya stok sistemi kurulmadı. Eski satın alma kabulü lot/raf mal kabul bağlantısı olmadan stok artırabiliyordu; kabul artık mevcut WMS hizmetinden geçiyor. Tedarikçi detay verileri ekranda görünmüyordu; kartın altında iletişim, ürün, sipariş, teslimat ve iade geçmişi gösteriliyor. Tedarikçi sorgularındaki işletme sınırı ve geçmişe bağlı ürün/tedarikçi silme koruması tamamlandı.

- `/suppliers`: iletişim/adres bilgileri, ürün bağlantıları, siparişlere doğrudan geçiş, teslimat ve iade kayıtları.
- `/purchase-orders`: taslak → onay bekliyor → onaylandı → kısmen teslim alındı → tamamlandı. Uygun aşamalarda gerekçeli iptal; kısmi kabulden sonra yalnızca kalan miktar kapatılır.
- Düşük stok önerilerinde kullanıcı ürünleri seçer; mevcut satın alma formu seçilen önerilerle açılır. Kullanıcı tedarikçi, depo, miktar ve fiyatı kontrol edip taslağı kaydeder.
- Sipariş oluşturma, onaylama ve iptal stok değiştirmez. Stok yalnızca WMS mal kabul tamamlandığında artar. Sipariş farklı teslimatlarla ve aynı ürün farklı lot satırlarıyla karşılanabilir.
- Kabulde teslimat/irsaliye numarası, raf, lot, son kullanma tarihi ve gerçek alış fiyatı kaydedilir. Aynı lot için çelişen tarih reddedilir. Ürünün mevcut lot zorunluluğu korunur.
- Fazla teslimatın miktarı kullanıcıya gösterilir. Yönetici (`admin`) ayrıca açık onay ve gerekçe vermeden fazla kabul gerçekleşmez; `manager` bu sınırı aşamaz.
- Hasarlı/yanlış ürün tedarikçiye iadesi, gerçek kabul satırı ve özgün lot/raf üzerinden negatif stok hareketi oluşturur. İade üst sınırı, mevcut stok, rezervasyon ve karantina/hasarlı ayrımları kontrol edilir. İade, siparişte kapanan kalan miktarı yeniden açmaz.
- Sipariş ve kabul/iade işlemleri sunucuda `admin`/`manager` yetkisine, işletme ve modül sınırlarına bağlıdır. Oluşturan, onaylayan, iptal eden ve stok işlemini yapan kullanıcı ile değişiklikler kaydedilir.
- Tedarikçiye otomatik e-posta veya dış sipariş gönderimi yapılmaz. Tedarikçiye iade kaydı bir iç stok belgesidir; kendiliğinden resmî iade faturası oluşturmaz.

## Tekrarlı işlem ve geri alma

Sipariş oluşturma, sipariş kabulü ve tedarikçi iadesi `Idempotency-Key` başlığını kullanır. Aynı anahtar ve içerik aynı sonucu döndürür; farklı içerik aynı anahtarla reddedilir. İstemci başarısız istekte anahtarı korur. Aynı tedarikçide aynı teslimat/irsaliye numarası farklı anahtarla yeniden kabul edilemez.

Genel WMS kabul ve rafa yerleştirme uçlarına da başlık sağlandığında tekrar koruması eklendi; eski başlıksız istemciler korunur. Tamamlanmış kabul satırı ikinci kez stok artırmaz. Fiziksel teslimatın kimliği için doğru teslimat numarası kullanılmalıdır; yeni anahtar ve yeni belge numarası verilen iki isteğin aynı fiziksel sevkiyat olduğunu sistem tahmin etmez.

Belge, kabul satırı, ürün fiyatı, lot/raf stokları, sipariş miktarları ve denetim kayıtları tek SQLite işlemi içinde güncellenir. Sonraki satırdaki hata önceki satırların değişikliklerini de geri alır.

## Gerçek doğrulama sonuçları

`backend/tests/procurement.test.js`: **23 yeni test geçti**. Kısmi ve çoklu teslimat, eşzamanlı mükerrer kabul, değişen istek içeriği, aynı irsaliye, fazla kabul yetkisi, kalan miktar iptali, kısmi/eşzamanlı iade sınırı, rezervasyon, hasarlı stok ayrımı, lot tarihi çakışmasında geri alma, satış sonrası yetersiz stok, süresi geçmiş lotun satışa kapalı kalması, tedarikçi/ürün geçmişi, işletme/modül izolasyonu, sunucu yetkileri ve mevcut genel WMS kabulü doğrulandı.

Tam mevcut test paketi: **54 grup, 417/417 test geçti, başarısız test yok**. Sonuç: `audit/procurement-regression-results.json`. MySQL parametre testleri taklit bağlantı kullanır; gerçek MySQL kurulumu/bağlantısı test edilmedi.

Son ön yüz derlemesi başarılı (2.851 modül). Önceden bulunan 500 kB paket boyutu uyarısı devam ediyor; derleme hatası değil.

Ayrı test ekranında 10 adet siparişin 4 + 2 + 1 adetlik üç kabulü, son lotta 2099-03-03 tarihi ve 1 adet hasarlı ürün iadesi doğrulandı. Sonrasında hizmet üzerinden 3 adet kalan miktar iptal edildi: alınan 7, iade 1, iptal 3, kalan 0, fiziksel stok 6. Sonuç: `audit/procurement-ui-results.json`; ekran: `audit/procurement-supplier-card.png`.

Ekran denemesinde tarih girişinin sonraki alan değişiminde kaybolması düzeltildi; sonraki kabulde tarih veritabanına doğru kaydedildi. Önceki test satırındaki boş tarih sonradan tahminle doldurulmadı. İptal için ekranda gerekçe ve ayrı açık onay adımı bulunuyor. Eski tarayıcı sekmesinde takılan yerel onay kutusu son düğme etkileşimlerini engellediği için yeni iptal düğmesinin uçtan uca tarayıcı testi tamamlanamadı; sunucu/hizmet iptal testi ve nihai kaydın ekran doğrulaması tamamlandı.

Üretim iş verileriyle satış, sipariş veya stok denemesi yapılmadı. Üretim SQLite bütünlüğü `ok`, yabancı anahtar hatası 0; yerel API sağlık yanıtı `ok`/`sqlite`. Fiziksel okuyucu/yazıcı, gerçek tedarikçi sevkiyatı ve dış sistem testi yapılmadı.

## Geçiş ve kullanım

Yeni bağımlılık yok. API başlangıcında `024_procurement.sql` geçişi çalışır; mevcut yerel veritabanına uygulandı. Eski `pending` siparişler güvenli taslak, `received` siparişler tamamlandı durumuna taşınır; stok yeniden oluşturulmaz. Eski doğrudan kabul edilmiş siparişlerde gerçek WMS kabul/lot belgesi yoksa geçmiş lotlar uydurulmaz; bu eski kayıtlarda lot temelli tedarikçi iadesi için gerçek kabul kayıtlarının ayrıca uzlaştırılması gerekir.

Geçiş öncesinde tutarlı, şifreli güvenlik yedeği alındı:
`backend/storage/backups/28991233-ad87-4314-b0ec-8df85a0dc346.vnxsecure`.
Yedek sağlıklı, bütünlüğü doğrulandı, şeması `023_wms_count_returns.sql`. Mevcut geri yükleme sistemi şema uyumluluğunu zorunlu tuttuğundan bu geçiş öncesi yedek yeni şemaya doğrudan geri yüklenemez; geri dönüş aynı uygulama/şema sürümüyle ele alınmalıdır. Üretim geri yüklemesi yapılmadı.

## Değişen kaynak dosyaları

- Yeni: `backend/src/database/migrations/024_procurement.sql`, `backend/src/services/procurementService.js`, `backend/tests/procurement.test.js`, `frontend/src/components/ProcurementPanels.jsx`.
- Sunucu: `backend/src/controllers/purchaseOrdersController.js`, `backend/src/controllers/supplierController.js`, `backend/src/controllers/wmsInboundController.js`, `backend/src/controllers/productController.js`, `backend/src/routes/purchaseOrderRoutes.js`, `backend/src/routes/supplierRoutes.js`, `backend/src/services/wmsInboundService.js`.
- Ekran: `frontend/src/pages/PurchaseOrders.jsx`, `frontend/src/pages/Suppliers.jsx`, `frontend/src/pages/wms/WMSInbound.jsx`, `frontend/src/components/StockHealthPanel.jsx`.
- Mevcut teste uyarlama: `backend/tests/purchase_and_counts.test.js`, `backend/tests/wmsSecurityHardening.test.js`, `backend/tests/backupRecovery.test.js`.

