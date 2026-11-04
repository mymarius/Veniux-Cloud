# Kasa vardiyası doğrulaması — 7 Ekim 2026

## Sonuç ve kullanım

Mevcut market kasası, satış geçmişi, stok/iade işlemleri, gün sonu ve yazıcı adaptörü korundu. `/magaza/kasa` ekranındaki **Kasa vardiyası** alanından başlangıç nakdiyle açılış yapılır. Yeni satışlar açık vardiya gerektirir. Her deponun mevcut akışa uygun bir `Ana kasa` kaydı oluşturulur; kasa kayıtları için ayrı kimlikler ve seçim desteği bulunur.

Satışlar kullanıcı, depo, kasa ve vardiya kimliğiyle saklanır. Aynı kasada açık vardiya için SQLite benzersiz indeks ve işlem kilidi uygulanır. Yeni bir vardiya aynı takvim gününde açılabilir; vardiya raporu takvim günü raporundan ayrıdır. Önceki satışlar ve eski gün kapanışları korunur; geçmişe başlangıç nakdi veya vardiya atanarak veri uydurulmaz.

**Beklenen nakit = başlangıç nakdi + net nakit tahsilat − nakit iade/iptal + nakit giriş − nakit çıkış.**

Tahsilat satışa ait nakit payıdır; müşteriden alınan nakit ve verilen para üstü ayrıca gösterilir. Kart payı kasadaki nakde eklenmez. Nakit hareketleri satış geliri veya brüt kâr olarak sayılmaz. Kart tahsilat/iadesinin banka cihazında ayrıca yapılması gerektiği ekranda ve çıktıda korunur.

Nakit hareketlerinde yön, tutar, gerekçe, kullanıcı ve zaman kaydı tutulur. Beklenen nakdi aşan çıkış veya nakit iade engellenir; gerekiyorsa yetkili kişi önce gerekçeli nakit girişi kaydeder. Bu kayıt fiziksel paranın gerçekten kasaya konulduğunu kendiliğinden doğrulamaz.

Kapanışta sayılan nakit, fark ve gerekçe saklanır. Fark varsa gerekçe zorunludur. Ekrandaki beklenen tutar arada değişmişse kapanış reddedilip yeniden kontrol istenir. Kapanış özeti kalıcı olarak dondurulur; açılış tutarı sonradan değiştirilemez. Sonraki iadeler yeni açık vardiyada, asıl satış ve kaynak vardiyayla ilişkilendirilir. Kapalı vardiya satışı iptal edilmez; yeni vardiyada iade yapılır.

Kapalı vardiya geçmişten seçilebilir; 58/80 mm kapanış özeti mevcut yazdırma adaptöründen yazdırılabilir. Bu belge mali fiş veya resmî e-belge değildir. Tekrar görüntüleme/yazdırma satış oluşturmaz.

## Yetkiler ve kayıt güvenliği

- `shift_open`: vardiya açma.
- `cash_movement`: nakit giriş/çıkış.
- Mevcut `day_close`: vardiya kapatma.
- Mevcut indirim, fiyat değiştirme, iptal ve iade izinleri uygulanmaya devam eder.

İşletme yöneticisi/yönetici rollerinde bu işlemler açıktır; kasiyere yeni iki izin varsayılan olarak verilmez. Mevcut ayarlar ekranından tanımlanır. Yetkiler sunucuda kontrol edilir. Firma/depo/kasa sınırları, güncel vardiya kimliği ve işlemi yapan kullanıcı doğrulanır. Yetkisiz kasiyere başka kişinin vardiyasının nakit özeti gösterilmez.

Açılış, nakit hareketi, kapanış, satış ve iade işlemleri işlem anahtarıyla korunur. Aynı anahtarın değiştirilmiş içerikle kullanılması reddedilir. Eski gün-kapanış adresine tekrar gönderilen bir kapanış, sonradan açılan vardiyayı kapatmaz. Denetim kayıtları işlemle aynı veritabanı işlemi içinde yazılır; kayıt hatası bütün işlemi geri alır.

SQLite kuralları kapalı vardiya/açılış bilgisi, nakit hareketi ve iade kayıtlarının güncellenmesini; satışın kayıtlı ödeme/tutar/vardiya bilgilerinin değiştirilmesini engeller. Satışın iade sayacı yalnızca mevcut iade akışında güncellenir. Geri yükleme, doğrulanmış yedeği bakım engeli altında tek işlem içinde yerleştirirken bu kuralları yeniden kurar; başarısız işlem kurallarla birlikte geri alınır. İndirilebilir yedekte sır temizliği yalnızca ayrı kopyada yapılır ve aynı kurallar tekrar kurulur.

## Yapılan testler

`audit/shift-full-final.json`: **56 test grubu, 449 test geçti**. Son küçük kapanış/çıktı değişiklikleri ve ek tekrar-gönderim senaryosu ardından `audit/shift-final-critical.json`: **4 grup, 46 test geçti**. Bu sayılar örtüşür; birlikte toplanmaz. Son vardiya test dosyasında 12 senaryo bulunur.

SQLite üzerinde doğrulananlar:

- Eşzamanlı iki açılışta tek açık vardiya; aynı açılış anahtarının tekrarı.
- 200 TL açılış + 300 TL bölünmüş satış: 100 TL nakit, 200 TL kart, alınan 150 TL, para üstü 50 TL; beklenen 300 TL.
- Nakit giriş/çıkış, zorunlu gerekçe, geçersiz/kuruş altı tutar, fazla nakit çıkışı ve tek hareket oluşturan tekrar gönderim.
- Kapanış farkı/gerekçesi, değişmiş beklenen tutar, açılış tutarını değiştirme girişimi ve kapanış tekrarı.
- Kapanmış vardiyaya yeni satış/nakit eklenememesi; satış-kapanış yarışı.
- Kapalı satışın sonraki vardiyada kısmi/tam iadesi; fazla iadenin engellenmesi ve kuruş dağılımı.
- Nakit yetersizliği nedeniyle iade reddinde stok ve kayıtların geri alınması.
- Kasiyer izinleri, firma sınırı, farklı kasiyerin satış kullanıcı kimliği.
- Nakit kaydı/denetim hatasında hareket ve işlem anahtarının geri alınması.
- 58/80 mm kapanış çıktısı, metin kaçışları ve tekrar görüntülemenin satış oluşturmaması.
- Eski gün-kapanış adresinin tekrarıyla yeni vardiyanın açık kalması.
- Mevcut yedek/geri yükleme, satış, stok, lot, satın alma ve brüt kâr testleri.

Frontend üretim derlemesi başarılıdır. Mevcut büyük paket uyarısı sürmektedir; derleme hatası değildir.

## Tarayıcı doğrulaması

Üretimden ayrı SQLite test verisi ve 3001 portundaki geçici sunucu kullanıldı; deneme sırasında gerçek banka tahsilatı yapılmadı.

1. 200 TL başlangıç nakdiyle vardiya açıldı.
2. Başında sıfırlar bulunan barkodla 3 × 100 TL satış yapıldı; 100 TL nakit/200 TL kart ve 50 TL para üstü fişte görüldü.
3. 40 TL nakit giriş ve 20 TL çıkış kaydedildi; beklenen tutar 320 TL oldu.
4. 319 TL sayımda gerekçesiz kapanış düğmesi kapalı kaldı. Gerekçeyle kapanınca −1 TL fark ve okunabilir 80 mm özet görüldü.
5. Yeni vardiya 200 TL ile açıldı; önceki satışın iptal düğmesi gösterilmedi.
6. İlk denemede tarayıcının yerel onay kutusu test aracını kilitledi. Bu, veritabanı testi başarısızlığı değildi. Kullanıcı pencereyi kapattıktan sonra kontroller sürdürüldü. İade onayı mevcut `DialogShell` tasarımına taşındı; uygulama içindeki “Vazgeç / İşlemi onayla” akışı kullanılır.
7. Ortak pencerede “Vazgeç” seçildi. Önce/sonra satış, iade ve stok satırları birebir karşılaştırıldı: **değişiklik yok** (`audit/shift-dialog-cancel-verification.json`).
8. Ortak pencereden bir sonraki kısmi iade onaylandı. Yeni vardiyada iki toplam kısmi iade kaydı 33,33 TL + 33,34 TL nakit iade içerdi; beklenen nakit 133,33 TL oldu. Satılan 3 üründen 2'si stokta geri döndü (20 → 17 → 19).
9. Önceki kapanış tekrar seçildi: beklenen 320 TL, sayılan 319 TL, fark −1 TL değişmedi. Ekran görüntüsü `audit/retail-shift-browser.jpg`; veritabanı özeti `audit/shift-browser-verification.json`.

Geçici test sekmeleri ve sunucusu kapatıldı.

## Değişen kaynaklar

- `backend/src/database/migrations/026_retail_shifts.sql`
- `backend/src/services/retailShiftService.js` (yeni ortak vardiya servisi)
- `backend/src/services/retailDailyService.js`
- `backend/src/services/retailReportingService.js`
- `backend/src/services/backupService.js`
- `backend/src/routes/scannerRoutes.js`
- `frontend/src/components/RetailShiftPanel.jsx`
- `frontend/src/components/RetailSalesHistory.jsx`
- `frontend/src/components/RetailDayReport.jsx`
- `frontend/src/pages/RetailPos.jsx`
- `frontend/src/pages/settings/CashierPermissions.jsx`
- `backend/tests/retailShift.test.js` ve mevcut satış/lot/satın alma/yedek testlerinin açık vardiya kuran fixture adımları.

API: `/api/scanner/shifts/context`, `/shifts/open`, `/shifts/:id`, `/shifts/:id/cash`, `/shifts/:id/close`, `/shifts/:id/receipt`. Yazma uçlarında oturum, izin ve işlem anahtarı gerekir.

## Yerel kurulum ve sınırlar

Şema 026 yerel SQLite'a uygulandı; bütünlük sonucu `ok`, bozuk yabancı anahtar ilişkisi 0. API ve site `Start-Local.ps1` ile açık. Değişiklikten önce alınan sağlam şema 025 yedeği: `backend/storage/backups/6ce24339-9cbb-4a77-bc1d-a90c6bd39083.vnxsecure`. Bu eski şema yedeği güncel şemaya doğrudan geri yüklenemez; sürüm kontrolü bunu engeller. Test sonuçları ve tarayıcı kanıtları `audit/` klasöründedir.

Gerçek USB/Bluetooth okuyucu, termal yazıcı, banka cihazı ve MySQL testi **yapılmadı**. Barkod girişi tarayıcıda simüle edildi. 58/80 mm HTML ve 80 mm tarayıcı önizlemesi doğrulandı; fiziksel kâğıt genişliği, kesim ve cihaz çıktısı donanımla ayrıca kontrol edilmelidir. Bu çalışma SQLite içindir; tüm veritabanlarına veya yazıcılara koşulsuz uyumluluk iddiası yoktur.
