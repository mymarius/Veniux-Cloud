# WMS transfer, lot ve stok sayım incelemesi

4 Ekim 2026 — SQLite üzerinde doğrulandı.

## Bulunan ve giderilen eksikler

- Mevcut raf transferi atomikti ancak tekrar gönderim anahtarı yoktu; bazı ekranlar lot kimliğini göndermiyordu. Aynı servis genişletildi: kaynak ve hedef depo/mağaza, raf veya rafa atanmamış stok seçilebiliyor. Lot kimliği ve tarihi korunuyor; farklı lotlar ayrı kalıyor.
- Transferin iki stok defteri kaydı, raf miktarları, depo toplamları, hareket, denetim kaydı ve tekrar gönderim anahtarı aynı veritabanı işlemi içinde yazılıyor. Hedef yazma hatasında tümü geri alınıyor.
- Transfer anahtarı sunucuda içerik ve kullanıcıyla eşleştiriliyor. Aynı anahtar/istek önceki sonucu döndürüyor; değiştirilmiş istek 409 ile reddediliyor. Tarayıcıdaki bekleyen transfer sayfa yenilemesinde saklanıyor; sonucu bilinmeyen işlem aynı anahtarla kontrol ediliyor.
- Sayım ekranı önceden yalnızca lokasyon kimliğine göre miktar tutuyordu. Satırlar artık ürün + lot + raf kimliğiyle ayrılıyor; normal depo ve WMS sayımı ortak ekran/servisi kullanıyor.
- Eski sayım sonucu doğrudan stok üzerine yazılabiliyordu. Başlangıç miktarı, rezerve miktar, depo miktarı, stok defteri/hareket sürümü ve iade blokeleri imzalı başlangıç kaydına alınıyor. Önizleme ve onay anlarında yeniden karşılaştırılıyor. Satış ardından iptal ile miktar eski değere dönse bile hareket sürümü nedeniyle çakışma yakalanıyor.
- Fark önizlemesi stok değiştirmiyor. Yetkili yönetici/yönetmen, en az 5 karakter gerekçe ve açık ekran onayıyla farkı stok hareketi olarak işliyor. Sayan ve onaylayan kullanıcı kimlikleri, lot/raf, önceki/sonraki miktar, gerekçe ve işlem kaydı saklanıyor. Aynı kullanıcı iki adımı da yapabilir; ayrı kullanıcı zorunluluğu getirilmedi.
- Stok defteri HTTP ucundan doğrudan `COUNT_ADJUSTMENT`, `TRANSFER_OUT` veya `TRANSFER_IN` gönderilerek bu akışların atlanması engellendi. İç servisler atomik işlemin içinde aynı defteri kullanıyor.
- İade edilen miktar orijinal lota ve kaynak rafına dönüyor. Satış geçmişinde sağlam/satışa uygun, hasarlı veya karantina seçilebiliyor. Hasarlı ve karantina miktarları ayrı bloke kayıtlarında tutuluyor; kasa ve normal transferin serbest stok hesabına katılmıyor. Lot takibi olmayan ürünler için de blokaj uygulanıyor.
- İlk uygun lotun tüm stoğu bloke olduğunda sonraki uygun FEFO lotunun kullanılmasını engelleyen döngü hatası düzeltildi. İade defterine kullanıcı, satış referansı ve lotun önceki/sonraki miktarı eklendi.

## Kullanım

1. `/normal-depo/transfers`: kaynak depo/mağaza, ürün + lot + raf, hedef depo/mağaza ve isteğe bağlı hedef rafı seçin. Serbest miktar gösterilir; lot tarihi değiştirilmez. Geçmiş tarihli lotun transferi mümkündür, satış engeli devam eder.
2. `/normal-depo/counting`: barkod/ürün/lot/raf araması veya mevcut barkod giriş panelini kullanın. Fiziki miktarı girip **Farkı incele** seçin. Ürün/lot/raf için eksik bir satır gerekiyorsa manuel satır açıp başlangıcı kaydedin; sonra miktarı sayın. Lotlu ürünlerde kayıtlı lot numarası gerekir; tahmini lot oluşturulmaz.
3. Yetkili kullanıcı onay bekleyen sayımı açar, farkı inceler, gerekçeyi girer ve **Farkı onayla ve işle** seçer. Çakışmada yeniden başlangıç kaydı alınmalı ve fiziki miktar tekrar kontrol edilmelidir. Eski önizleme yeni stoğa uygulanmaz.
4. Kasa satış geçmişindeki kısmi iade ekranında ürünün durumunu seçin. Sağlam iade yeniden satılabilir; hasarlı/karantina iade fiziksel stokta görünür ancak satılabilir miktara dahil değildir. Blokeyi kaldırma veya bloke malı özel karantina rafına taşıma bu değişikliğin parçası değildir; normal transfer üzerinden blokaj atlanamaz.

## Doğrulama

Son tam çalıştırma: **52 test grubu, 375 test başarılı**. Son dağıtım derlemesi başarılı; mevcut büyük paket boyutu uyarısı devam ediyor.

Yeni SQLite testleri `backend/tests/wmsLotOperations.test.js` içinde 18 senaryodan oluşuyor:

- Depo/mağaza/raf ve rafa atanmamış stok arasında aynı lot/tarih/miktarın korunması; farklı lotların ayrılması.
- Eşzamanlı mükerrer transfer, değiştirilmiş tekrar isteğinin reddi ve son stok için iki farklı transferin yarışması.
- Hedef yazım hatasının **simüle edilmesiyle** kaynak/hedef/defter/hareket/işlem anahtarının tamamen geri alınması; aynı anahtarla başarılı tekrar.
- Yetersiz/rezerve miktar ve yanlış depoya ait rafın reddi.
- Geçmiş tarihli lotun transfer sonrası hedef mağazada satışının reddi.
- Lot bazında sayım farkı, operatör/onaylayan kaydı, önceki/sonraki miktar ve mükerrer onay.
- Sayım başlangıcından sonra satış, önizlemeden sonra transfer, satış+iptal ve eşzamanlı iki sayım onayında çakışma.
- Yetkisiz/gerekçesiz onay, değiştirilmiş imza ve eski defter ucundan onayı atlama denemesi.
- Sıfır farkta yeni stok hareketi oluşmaması; istemcinin gönderdiği sahte miktarların onaylanan önizlemeyi değiştirememesi.
- Hasarlı/karantina iadesinin aynı lot/rafa dönmesi ve tekrar satış/normal transfere kapalı kalması; lot kaydı olmayan raflı/serbest ürünlerin de bloke edilmesi.
- Tam bloke ilk lot yerine sonraki uygun FEFO lotunun satılması.

Mevcut WMS güvenlik ve işletme testleri yeni önizleme/onay ve tekrar gönderim sözleşmesine uyarlandı. İşletme testinin yalnızca raf stoğu oluşturup depo toplamını boş bırakan tutarsız örnek verisi, mevcut stok kabul servisiyle tutarlı oluşturuldu.

Çalışan yerel API ve mevcut `backend/stok_takip.db` üzerinde ayrıca **TEST** etiketli ürün 12, kaynak depo 30, hedef mağaza 31 ve raflar 116/117 ile doğrulama yapıldı. Sonuçlar `audit/wms-lot-live-check.json` içinde. Canlı yerel denemede mükerrer transfer, değişmiş istek, satış sırasında sayım çakışması, +1 onaylı sayım farkı, transfer sonrası tarihi geçmiş satış ve hasarlı iade sonrası satış reddi doğrulandı. Ekran üzerinden ayrıca 4 → 4 farksız sayım gerekçeyle onaylandı. Test işlemleri yerel veritabanında izlenebilir olarak bırakıldı; gerçek tahsilat veya dış sipariş gönderimi yapılmadı.

Fiziksel barkod okuyucu, termal yazıcı ve MySQL testi **yapılmadı**. Barkod paneli mevcut HID/manuel akışı kullanıyor; bu çalışma fiziksel cihaz uyumluluğu kanıtı değildir. Yerel hata simülasyonu gerçek disk/elektrik arızası testi değildir.

## Dosyalar

- `backend/src/database/migrations/023_wms_count_returns.sql`: sayım incelemeleri ve iade blokeleri.
- `backend/src/config/mysqlSchema.js`: eşdeğer şema tanımları; MySQL doğrulanmadı.
- `backend/src/services/wmsCountReviewService.js`: imzalı başlangıç, önizleme, çakışma denetimi ve gerekçeli onay.
- `backend/src/controllers/wmsCycleCountController.js`, `backend/src/routes/wmsRoutes.js`: mevcut WMS uçlarının güncellenmesi.
- `backend/src/services/warehouseLocationService.js`, `backend/src/controllers/warehouseLocationController.js`: mevcut atomik transferin depo/mağaza/lot ve tekrar gönderim desteği.
- `backend/src/services/inventoryTransactionService.js`, `backend/src/controllers/inventoryTransactionController.js`, `backend/src/middlewares/warehouseBoundary.js`: stok/raf doğrulamaları, onay atlamasının engellenmesi ve hedef depo kapsamı.
- `backend/src/services/stockHealthService.js`, `backend/src/services/retailDailyService.js`, `backend/src/services/scannerService.js`: lot tahsisi, iade ayrımı ve satılabilir miktar.
- `backend/src/controllers/stockController.js`, `backend/src/controllers/pharmacySalesController.js`: eski genel uçlardan iade blokelerinin atlanmasının engellenmesi.
- `frontend/src/hooks/useWmsTransfer.js`: yenileme/bağlantı kesilmesinde aynı transferin güvenli kontrolü.
- `frontend/src/pages/normal-depo/NormalTransfers.jsx`, `frontend/src/components/wms/WMSDetailDrawer.jsx`: lot ve kaynak raf seçimi.
- `frontend/src/pages/wms/WMSCycleCount.jsx`, `frontend/src/pages/normal-depo/NormalCounting.jsx`: ortak sayım, barkod/manual giriş, fark önizleme ve onay.
- `frontend/src/components/RetailSalesHistory.jsx`: iade durumu seçimi.
- `backend/tests/wmsLotOperations.test.js`, `backend/tests/wmsSecurityHardening.test.js`, `backend/tests/wms_enterprise_suite.test.js`: SQLite doğrulamaları.
- `.local/wms-lot-live-check.cjs`, `audit/wms-lot-live-check.json`, `audit/wms-lot-regression-results.json`: yerel API denemesi ve tam test sonuçları.
- `audit/wms-count-preview.png`, `audit/wms-transfer.png`: ekran doğrulama görüntüleri.

## Çalıştırma ve sınırlar

Mevcut kurulumda yeni paket gerekmez. API yeniden başlatıldığında 023 şema değişikliği uygulanır; yerel API'ye uygulandı. Normal başlatma için proje kökündeki `Start-Local.ps1` kullanılır. Sunucu yeniden başladığında henüz önizlemeye dönüşmemiş imzalı başlangıç kayıtları geçersiz olur; ekran yenilenip yeniden sayılmalıdır. Veritabanında saklanan önizlemeler onayda güncel stokla tekrar karşılaştırılır.

SQLite işlemleri tek işlem kilidiyle sıralanır. Sayım çakışma denetimi aynı ürünün aynı depodaki başka raf hareketini de çakışma sayabilir; bu, eski sayımın sessiz uygulanmasını önleyen bilinçli ve temkinli davranıştır. Fiziksel stok, satılabilir stok ve bloke miktar birbirinden farklıdır. Hasarlı/karantina malları fiziksel olarak da ayrılmalıdır.
