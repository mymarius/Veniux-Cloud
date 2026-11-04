# Günlük market kasası

Kasa: /magaza/kasa. Okuyucu ve kasiyer yetkileri: Ayarlar → Barkod okuyucu. Kullanıcılar bölümünde Kasiyer rolü oluşturulur; varsayılan olarak indirim, fiyat değiştirme, iade, iptal ve gün kapatma kapalıdır. Yönetici her hakkı ayrı açar. Kasiyer yalnız kendi satış geçmişini ve yetki verilmişse depo gün sonunu görür; yönetici ve müdür tüm firma satışlarını görür.

Satışta sunucu fiyat, stok, indirim ve ödeme toplamını doğrular. Tekrar gönderilen aynı işlem anahtarı ikinci satış yaratmaz. Nakit, kart ve bölünmüş ödeme vardır. Alınan nakit belirtilmezse tam tutar kabul edilir. Para üstü kayıt ve fişte gösterilir. Fiyat değiştirme ve indirim işlem kaydına alınır.

Geçmişten satış açılıp gerekçe ve açık onayla iptal ya da kalem/miktar bazlı iade yapılır. Stok aynı depo ve mümkünse özgün stok satırlarına geri döner. İptal edilen satış yeniden iade edilemez. Kısmi iade sonrası kalan kalemler iade edilebilir, tüm satış iptal edilemez. İndirimli iadelerde kuruşlar dağıtılarak tam iade özgün ödemeyi aşmaz. Nakit/kart iade tutarı özgün ödeme oranıyla kaydedilir; farklı iade yöntemi seçimi yoktur.

Gün sonu Europe/Istanbul günü üzerinden satış, indirim, nakit/kart, iptal, iade ve net tutarları gösterir. Eski satışın bugünkü iadesi bugünkü rapora düşer. Beklenen kasa = açılış nakdi + nakit tahsilat − nakit iade/iptal. Sayılan nakit ile fark kaydedilir. Gün kapandıktan sonra bu depoda bugün yeni satış/iptal/iade engellenir. Ertesi gün yeni kasa günü otomatik başlar. Kasa dışı gider, çekme/yatırma ve banka mutabakatı henüz dahil değildir.

Fiş genişliği terminalde 58 veya 80 mm seçilir. Satış sonrasında veya geçmişten fiş önizlemesi açılır; yazdırma kullanıcı düğmesiyle başlar. Tarayıcı yazdırma penceresinde doğru termal yazıcı, kağıt genişliği, %100 ölçek ve kapalı başlık/altbilgi seçilir. Bu çıktı satış bilgi fişidir, mali cihaz fişi/e-fatura değildir. Banka POS tahsilatı ve kart iadesi ayrıca yapılmalıdır. `frontend/src/printing/receiptPrinter.js` içindeki registerPrinterAdapter(name,{print}) ile modele özgü sürücü/SDK adaptörü sonradan bağlanır; kurulu olmayan cihaz desteği iddia edilmez.

## Kurulum ve değişen dosyalar

backend ve frontend içinde npm ci; kökten Start-Local.ps1. Veritabanı geçişi 021_retail_daily.sql otomatik uygulanır. SQLite üzerinde doğrulandı; MySQL eşdeğer tabloları mysqlAdapter.js içinde tanımlandı ancak gerçek MySQL sunucusunda test bekliyor.

- backend/src/services/retailDailyService.js: satış, yetkiler, stok geri dönüşü ve işlem güvenliği.
- backend/src/services/retailReportingService.js: geçmiş, rapor, kapanış ve güvenli fiş HTML.
- backend/src/routes/scannerRoutes.js: kasa uçları.
- backend/src/database/migrations/021_retail_daily.sql ve mysqlAdapter.js: kalıcı kayıtlar.
- backend/src/controllers/settingsController.js ve frontend/src/pages/settings/UsersTab.jsx: Kasiyer rolü.
- frontend/src/pages/RetailPos.jsx: günlük kasa ekranı, arama ve sesler.
- frontend/src/components/RetailSalesHistory.jsx, RetailDayReport.jsx: iade/iptal ve kapanış.
- frontend/src/pages/settings/CashierPermissions.jsx ve Settings.jsx: yetki yönetimi.
- frontend/src/printing/receiptPrinter.js: yazdırma adaptörleri.
- frontend/src/utils/sound.js: okuma sesinde kaynak temizliği.
- backend/src/routes/platformRoutes.js: kısmi iade kalan cirosu.
- backend/tests/retailDaily.test.js: günlük kasa testleri.

## Doğrulama / cihaz bekleyenler

Çalışan gerçek yerel veritabanında ayrı TEST deposunda stok 10 → satış 8 → iptal 10; ikinci iade reddedildi. Ayrı satış → iade sonucunda stok 10 oldu. Kanıt: audit/retail-live-reversal-check.json. Bunlar simülasyon girişleri, fiziksel cihaz kullanılmadı.

Otomatik testler: iptal tekrarı, aşırı iade, kısmi/tam iade, bölünmüş ödeme, yetersiz nakit, kuruş dağılımı, yetkisiz fiyat/indirim, kasiyer hakkı, kasa farkı ve kapalı kasa işlemleri. Genel sonuç audit/retail-daily-regression-results.json.

| Bağlantı | Ortam | Durum |
|---|---|---|
| USB/Bluetooth HID | Klavye gibi giriş gönderen okuyucu ve tarayıcı | Özel giriş alanı; yazılım doğrulandı, cihaz testi bekliyor |
| Sanal COM/Web Serial | Destekleyen masaüstü tarayıcı | İzinli seri port; cihaz testi bekliyor |
| Yerel seri/SDK köprüsü | Node yerel bağlantı uygulaması | Kimlik/origin kontrolü; simülasyon doğrulandı, üretici adaptörü modele göre |
| Kamera | BarcodeDetector ve kamera destekli tarayıcı | Alternatif; fiziksel kamera testi bekliyor |
| Tarayıcı termal çıktı | Yazıcı sürücülü işletim sistemi | 58/80 mm HTML; gerçek çıktı testi bekliyor |
| Üretici doğrudan yazdırma | Model SDK veya yerel adaptör | Genişletme sözleşmesi hazır; henüz fiziksel adaptör yok |

Barkod kurulumunun ayrıntıları BARCODE-INTEGRATION.md içindedir.
