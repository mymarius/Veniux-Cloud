# Kullanıcı ve erişim kontrolü incelemesi — 7 Ekim 2026

Mevcut roller, kasa izinleri, firma ayrımı ve lisans kontrolleri kullanıldı. Yeni yetki sistemi veya ekran tasarımı eklenmedi. Testler NODE_ENV=test ile ayrı backend/stok_takip_test.db üzerinde çalıştırıldı; üretim verisine test işlemi gönderilmedi.

## Bulgular ve düzeltmeler

- Ürün, barkod sorgulama, stok değerleme ve satış detaylarının API yanıtları düşük yetkili rollere alış maliyeti gönderebiliyordu. Mevcut admin/manager rol kontrolüyle maliyet alanları yanıt sınırında çıkarılıyor. İç içe lotlar, iade maliyetleri ve snapshot_json gibi JSON metinleri de temizleniyor. Satış fiyatı, stok ve barkod korunuyor; veritabanındaki maliyet kayıtları değiştirilmiyor.
- Satın alma listesi/detayı alış bedellerini açık ediyordu: GET uçları artık admin/manager gerektiriyor. Tedarikçi kartında diğer roller için satın alma/teslimat/iade belge geçmişi gönderilmiyor; iletişim ve ürün listesi korunuyor.
- Stok düzeltme denetim kaydına gerekçe ve değişmez kullanıcı kimliği eklendi; önceki/sonraki miktar ve kullanıcı e-postası korunuyor.
- Oturumlar zaten her istekte veritabanındaki durum, rol ve session_version ile kontrol ediliyordu. Hesap kapatma ve rol değiştirme sonrası eski tokenın reddedildiği doğrulandı. Kasiyer izinlerinin kaldırılması da açık oturumda hemen etkili.

## Mevcut rol eşlemesi

| İşlem | admin / manager | cashier | operator |
|---|---|---|---|
| Ürün, barkod, stok okuma | Var | Var; maliyet gizli | Var; maliyet gizli |
| Kasa satışı | Var | Var | Yok |
| İndirim, fiyat değiştirme, iade, iptal, nakit hareketi, kapanış | Var | Mevcut ayrı kasa izinleriyle | Yok |
| Stok kabul, transfer, stok düzeltme | Var | Yok | Yok |
| Sayım başlangıcı/önizlemesi | Var | Mevcut okuma uçları | Var; WMS önizleme |
| Sayım farkı onayı | Var | Yok | Yok |
| Satın alma ve ticari belge geçmişi | Var | Yok | Yok |
| Brüt kâr ve dışa aktarma | Var | Yok | Yok |
| Ortak SQLite yedeği/indirme/geri yükleme | Yalnız ayrıca platform yöneticisi olan kullanıcı | Yok | Yok |

Ürün silme ve kullanıcı yönetimi ayrıca admin gerektirir. Depo operatörünün terminal stok yazma yetkisi mevcut uygulamada bulunmuyor; rol açıklamasındaki daha geniş ifadeyi esas alarak bu hassas yetkiler genişletilmedi.

## Kayıt sınırı

Firma kimliği oturumdan alınır. Başka firmaya ait ürün/depo kimlikleri ve platform yöneticisi olmayan kullanıcının x-tenant-id değiştirmesi reddedildi. WMS kayıt sınırı ayrıca ürün/lot/raf/belge sahipliğini doğrular. Mevcut şemada kullanıcı-depo veya kullanıcı-şube ataması yok: izinli bir rol kendi firmasının tüm uygun depolarına erişebilir. Aynı firma içinde atanmış depo kısıtı varmış gibi bir güvence verilmez.

## Gerçek sonuçlar

**Geçti:** 12 farklı test dosyasında toplam 130 farklı kontrol. authorizationOperations (10), audit_access, retailDaily, retailShift, retailProfit, wmsSecurityHardening, wmsLotOperations, backupRecovery, platformAccess, purchase_and_counts, commercialAccess, moduleAccess. Son stok denetim kaydı değişikliğinden sonra yeni 10 kontrol yeniden geçti.

Yeni kontroller: yönetici/kasiyer/operatör doğrudan API erişimi; maliyet gizliliği; ticari GET erişimi; yetkisiz yazma öncesi/sonrası stok hareketleri, stok bakiyeleri, satışlar ve iade kayıtlarının eşitliği; yabancı ürün/depo ve firma başlığı; açık oturumun rol/durum değişikliğinde iptali; kasa iade izninin aynı tokenla kaldırılması; gerçek kasiyer satış detayında maliyet gizliliği; yönetici iadesi ve stok düzeltmesinde kullanıcı/gerekçe.

Mevcut kontroller: nakit hareketi yetkisi, iade/iptal, vardiya kayıtları, lotlu sayım onayı, yedek indirme/geri yükleme yetkisi, satın alma, lisans ve platform erişimi. Bu sayılar tüm uygulama uçlarının eksiksiz pentest edildiği anlamına gelmez.

**Doğrulanamadı / bekleyen:** MySQL, fiziksel okuyucu ve yazıcı, kullanıcıya atanmış şube/depo ayrımı (mevcut modelde yok). Tarayıcı tasarımı değiştirilmedi; bu çalışma doğrudan HTTP/API ve SQLite kontrolleridir.

## Değişen dosyalar

- backend/src/middlewares/costVisibility.js
- backend/src/middlewares/authMiddleware.js
- backend/src/routes/purchaseOrderRoutes.js
- backend/src/controllers/supplierController.js
- backend/src/controllers/stockController.js
- backend/tests/authorizationOperations.test.js
- docs/AUTHORIZATION-REVIEW.md
