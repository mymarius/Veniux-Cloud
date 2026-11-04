# Stok, lot ve son kullanma tarihi — 4 Ekim 2026

Mevcut `products.min_stock_level`, `inventory_lots`, `inventory_transactions`, depo toplamları ve WMS mal kabulü kullanıldı. Yeni bir stok veritabanı veya paralel kabul sistemi oluşturulmadı.

## Kullanım

- **Ürünler → Düzenle:** Minimum stok ve sipariş önerisinde kullanılacak hedef stok. Minimum sıfır olabilir; düzenleme sırasında sıfır artık yanlışlıkla 10'a çevrilmez. Sunucu negatif/geçersiz minimumları reddeder.
- **Ürünler → Stok ve lot takibi:** Düşük stok, tükenen, yaklaşan tarih ve geçmiş tarih ayrı listelerdir. 30/60/90 gün veya 1–3650 günlük özel aralık seçilebilir. Sayılar tüm depolardaki farklı ürün sayılarıdır; tarih listeleri her lotu ve depoyu ayrı gösterir.
- **Mal kabul:** Mevcut WMS kabul formundaki lot numarası ve tarih kullanılır. Aynı ürünün farklı lotları ayrı kalır. Aynı lot numarası farklı tarihle tekrar kabul edilirse işlem geri alınır. Geçersiz tarih ve lot numarasız tarih reddedilir.
- **Kasa:** Otomatik seçim en yakın uygun son kullanma tarihinden başlar (FEFO), tarihsiz uygun lotlar ardından gelir. Sepetteki lot seçiminden belirli lot seçilebilir. Son kontrol sunucuda ve satış işleminin içinde yapılır.
- **İade/iptal:** Yeni satışlarda lot ve raf tahsisleri satış kaydına eklenir. Kısmi iadeler ve iptal aynı lot/raf miktarını geri getirir. İade edilmiş tarihi geçmiş ürün yeniden satılamaz.
- **Sipariş önerisi:** Düşük/tükenen ürünler için hedef stoğa tamamlayacak miktar önerilir; mevcut sipariş akışının tam birim kuralına uygun şekilde yukarı yuvarlanır ve en az 1'dir. Öneri mevcut sipariş formuna aktarılır. Tedarikçi ve depo kullanıcı tarafından seçilir; form gönderilmedikçe sipariş kaydı veya dış bildirim oluşmaz.
- Genel bakış ve depo özetinde stok/tarih sayıları gösterilir. Uyarılardan ürün veya lot detayına geçilebilir.

## Sunucu kontrolleri ve sınırlar

- Tarihler İstanbul takvim günüyle karşılaştırılır. Son kullanma günü dahil, **bugünden önceki tarih** geçmiş sayılır. Tarihsiz stok geçmiş sayılmaz; geçersiz tarih veya bloke/onaysız lot satılmaz.
- Kasa stok toplamını, lot bakiyesini, raftaki rezervasyonu ve kilidi kontrol eder. Lot/depo miktarları uyuşmazsa satış güvenli biçimde reddedilir; otomatik stok düzeltmesi yapılmaz.
- Genel çıkış, transfer veya sayımın lot bilgisini düşürmesine izin verilmez. Lotlu ürünler için lot seçilen WMS işlemi kullanılmalıdır. Lotsuz mevcut akış korunur. WMS PICK/SHIP de geçmiş/bloke lotu reddeder. Eski banko satış ucu lotlu depo ürünlerinin bu kontrolleri atlamasına izin vermez; seçilmiş ilaç seri kaydının tarihi/durumu ayrıca doğrulanır.
- Tarihsiz eski toplam stoktan lot veya tarih tahmin edilmez. Mevcut lot defterine bağlı olmayan miktar tarihsiz kabul edilir. Geçmiş tarihlerle ilgili güvence, doğru lot/tarih bilgisiyle kaydedilmiş stok için geçerlidir.
- Minimum stok hesapları fiziksel depo toplamına dayanır; geçmiş tarihli stok fiziksel toplamda bulunur, fakat kasa onu satılabilir miktara dahil etmez.
- Düşük stok uyarıları tenant/ürün/depo üzerinden yeniden kullanılır. Okunmuş ve değişmemiş uyarı tekrar açılmaz. Stok/eşik değişince güncellenir, durum düzelince çözülür. Kasa, WMS kabul/hareket ve minimum güncellemesi stok uyarılarını yeniler. Tarih uyarıları lot/depo anahtarıyla güncellenir; mevcut kural motoru ve zamanlanmış kontroller sürer. Liste sayıları sorguda güncel hesaplanır.
- Eski satışlarda kaydedilmemiş lot bilgisi geriye dönük uydurulmaz.

## Doğrulama

SQLite test veritabanında eklenen 12 kritik test:

1. Stok kaydı olmayan ürün, minimuma eşit pozitif stok ve minimum=0 ayrımı.
2. Aynı ürünün farklı lotları, 30/60/90 sınırları ve tarihsiz lot.
3. FEFO tüketim ve kısmi iadenin doğru lota dönmesi.
4. Geçmiş lotun reddedilmesi; tarihsiz lotun satılabilmesi; açık geçmiş lot seçiminin reddi.
5. Aynı ürünün farklı sepet satırlarında geçmiş lotun tarihsiz stoğa dönüşmemesi; tam geri alma.
6. Son uygun stok için eşzamanlı iki satıştan yalnızca birinin başarılı olması.
7. Uyarı tekrarının engellenmesi, okunmuş durum ve çözülme.
8. Tenant ayrımı, geçersiz filtre ve negatif minimum reddi.
9. Aynı lotun farklı tarihle tekrar kabulünün reddi.
10. Raf miktarının satış/iptal sırasında korunması ve rezerve stoğun reddi.
11. Genel transfer/çıkışla lot takibinin atlanmasının reddi.
12. Eski banko API'sinden lot tarih engelinin atlanamaması.

Tam test çalışması: **51 grup / 357 test başarılı**. Sonuç: `audit/stock-health-regression-results.json`. Ön yüz üretim derlemesi başarılı; mevcut büyük paket uyarısı devam ediyor.

Çalışan yerel SQLite API'sinde gerçek kabul/satış/iade isteğiyle doğrulandı: TEST ürün 11, TEST depo 30, kabul 1, satış 3. Geçmiş lot satışı ve fazla iade HTTP 409 döndü. FEFO satışından sonra kısmi ve kalan iadeler her üç lotu tekrar 2 birime getirdi. Kanıt: `audit/stock-health-live-check.json`. TEST kayıtları inceleme için korundu; gerçek ödeme yapılmadı.

Tarayıcıda minimum stok 6 olarak kaydedildi ve düşük stok sayısı 1 oldu. 4 adet sipariş önerisi mevcut forma aktarıldı; form iptal edildi, sipariş sayısı 0 kaldı. Lot detayına doğrudan geçiş de doğrulandı. Ekranlar: `audit/stock-health-ui.png`, `audit/stock-order-suggestion-ui.png`.

MySQL, fiziksel okuyucu veya yazıcı kullanılmadı; donanım testi yapıldığı iddia edilmez.

## Değişen kaynaklar

Yeni: `backend/src/services/stockHealthService.js`, `stockAlertSync.js`, `backend/tests/stockHealth.test.js`, `frontend/src/components/StockHealthPanel.jsx`.

Güncellenen: `normalDepo.js`, `retailDailyService.js`, `scannerService.js`, `inventoryTransactionService.js`, `wmsInboundService.js`, `alertRuleEngine.js`, `stockController.js`, `productController.js`, `pharmacySalesController.js`; ön yüzde `NormalProducts.jsx`, `NormalDashboard.jsx`, `Dashboard.jsx`, `RetailPos.jsx`, `PurchaseOrders.jsx`, `Alerts.jsx`.

Yeni paket veya MySQL kurulumu gerekmiyor. Yerel API yeniden başlatıldığında değişiklikler yüklenir; mevcut WMS kabulü ve kasa kullanılmaya devam eder.
