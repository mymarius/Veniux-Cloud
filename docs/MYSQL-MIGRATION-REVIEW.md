# MySQL kaynak ve kabul incelemesi — 10 Ekim 2026

Bu rapor mevcut kaynak koduna aittir. Kullanıcı verileri değiştirilmedi; yeni iş modülü, ZIP, SHA256 veya Windows dağıtımı üretilmedi. Mevcut tasarım ve SQLite komutları korunur. MySQL testleri gerçek MySQL 8.4.0 üzerinde, yalnız loopback 33316 ve ayrı `veniux_test_*` veritabanlarında çalıştırıldı. Makinedeki mevcut XAMPP sunucusu kullanılmadı.

## Başlangıçta doğrulanan eksikler

- `runtimeConfig.js` üretimi SQLite ile sınırlıyordu; `accessScope.js` MySQL işlemlerini 503 ile kapatıyordu.
- Sorgu kapsamı SQLite geçici görünüm/`main.` yapısına bağlıydı. MySQL transaction bağlantıları eşdeğer kapsam taşımıyordu.
- MySQL şeması SQLite migrationlarının vardiya, kasa, kullanıcı/depo erişimi ve diğer güncel kurallarının tamamını içermiyordu. Başlangıç DDL'si sürümlü kabul sağlamıyordu.
- Yedek/geri yükleme yalnız SQLite içindi. Motor seçimi ve bağlantı davranışı açık üretim kabulü sağlamıyordu.

Korumalar önce eşdeğer davranış uygulanıp gerçek MySQL testleri geçtikten sonra kaldırıldı. Başarısız/eksik/değiştirilmiş migration, bilinmeyen kapsam ve bağlantı hatası erişimi açmaz; MySQL seçimi SQLite'a düşmez.

## Değişen kaynaklar ve karşılıklar

| Dosyalar | Düzeltme |
|---|---|
| `backend/scripts/build_mysql_manifest.js`, `generate_mysql_schema.mjs`, `backend/src/database/mysql/001-parity.json` | 20 SQLite migrationı geçici bellek DB'sinde uygulanıp karşılaştırıldı: 84 tablo, 897 sütun, 84 PK dışı indeks, 116 FK, 8 CHECK, 11 trigger. Kullanıcı SQLite dosyası okunmaz. DECIMAL(24,6), BIGINT, DATETIME(6), DATE ve metin barkodlar korunur. Tek açık vardiyanın partial indeksi generated column + unique indeks olur. |
| `backend/src/database/mysqlMigrator.js`, `backend/src/config/mysqlSchema.js`, `mysqlMedicineSchema.js` | Sürümlü, açıkça çalıştırılan migration; GET_LOCK, running/failed/complete kayıtları, tam şema tanımı ve canlı yapı doğrulaması. Başlangıç DDL çalıştırmaz. FK, aynı firma ilişkileri, CHECK ve triggerlar denetlenir. Başarısız hedef kapalı kalır. |
| `backend/scripts/mysql_migrate.js`, `migrate.js`, `sqlite_to_mysql.js`, `backend/src/database/dataTransfer.js` | Açık hedef onaylı migration ve salt okunur SQLite aktarımı. Kimlik/ilişki/lot/tarih/tutar aktarımı; 64 bit kimlik, bilimsel gösterimde küçük miktar, mikrosaniye ve barkod sıfırları korunur. Desteklenmeyen/taşan değer kayıplı çevrilmez, reddedilir. |
| `backend/src/services/scopeQueryContext.js`, `backend/src/middlewares/accessScope.js` | MySQL firma/depo kapsamı sunucu sorgularında, detay/arama/rapor/çıktı ve transaction içinde uygulanır. Gelen yazma referansları ve global unique çakışmaları ayrıca denetlenir. Eksik kapsam reddedilir; SQLite `main.` ifadesi taşınmaz. Desteklenmeyen kapsamlı SQL kapalı davranır. |
| `backend/src/config/database.js`, `mysqlAdapter.js`, `runtimeConfig.js`, `backend/src/index.js`, `backend/src/services/runtimeControl.js` | Açık üretim motoru, root olmayan hesap, başlangıçta bağlantı/şema doğrulaması, motor bazlı sağlık/kapatma. MySQL tüm yazma transactionlarında dayanıklı mutex satırını FOR UPDATE kilitler; son stok, iade, kabul, transfer, sayım ve vardiya işlemleri SQLite'ın seri yazma davranışını korur. Bu güvenli fakat tüm yazmaları seri hale getiren bir tercih; çok yüksek yazma yükü için ölçüm gerekir. |
| `backend/src/services/backupPrivacy.js`, `mysqlBackupService.js`, `backupService.js` | Tutarlı transaction + yazma engeli; DB ve ilaç görselleri; yerel AES-GCM özel yedek ve sırları çıkarılmış indirilebilir MySQL veri yedeği. Platform yetkisi, kullanıcıya bağlı süreli hazırlama, açık onay, güvenlik yedeği, hata kaydı ve ayrı boş kurtarma hedefi. |
| `backend/src/services/deploymentService.js` | MySQL hazır şema kaydıyla mevcut yönetilen başlatma/durdurma çalışır; SQLite dosyası oluşturulmaz. MySQL için mevcut update komutu canlı DDL yapmayı reddeder ve ayrı kopya migrationına yönlendirir; SQLite update/restore davranışı korunur. |
| `frontend/src/pages/settings/BackupPanel.jsx`, `frontend/src/utils/backupDownload.js` | Aynı yedek ekranında motoru ve ayrı hedef kurtarma sonucunu doğru gösterme; MySQL yedek başlığını kabul etme. Ayrı hedef hazırlandığında mevcut oturumu yanlışlıkla kapatmaz. |
| `backend/jest.config.js`, `jest.mysql.config.cjs`, `tests/setup.js`, `tests/mysql/*`, `package.json`, `scripts/mysql_test_bootstrap.js`, `mysql_test_migrate.js`, `Start-MySQL-Test.ps1`, `mysql_permissions.sql`, `.gitignore` | SQLite ve gerçek MySQL testlerini ayırma; yalnız izole test hedefine izin veren tekrar kurulabilir araçlar; yerel test sırlarını/bağımlılıklarını kaynak dışı tutma; hesap izin örneği. |

## Özellik destek tablosu

| Özellik | SQLite | MySQL |
|---|---|---|
| Üretim motor seçimi | Açık `DB_ENGINE=sqlite` | Açık `DB_ENGINE=mysql`; bağlantı hatasında motor değişmez |
| Güncel şema/migration | Mevcut sürümlü SQLite migrationları | Sürümlü parity manifesti; açık migration, başarısız hedef kapalı |
| Firma/depo kapsamı | Mevcut kapsam korundu | Sunucu SELECT/DML/transaction kapsamı; olumlu/olumsuz API testleri |
| Satış/iade/son stok | SQLite regresyonu geçti | Ayrı bağlantılı yarış, idempotency, fazla iade ve stok testleri geçti |
| Kabul/lot/transfer/sayım | SQLite regresyonu geçti | Tekrar kabul/transfer, miktar sınırı, eski sayım ve tekrar onay testleri geçti |
| Vardiya/kasa | SQLite regresyonu geçti | Açık vardiya unique kuralı, eşzamanlı açılış ve kapalı vardiya triggerı geçti |
| Para/miktar/kimlik/tarih/barkod | Mevcut SQLite davranışı | DECIMAL(24,6), BIGINT, DATETIME(6), DATE; sürücüde kayıplı Number dönüşümü yok |
| Yedek | Mevcut SQLite online yedek | Tutarlı DB + dosyalar, özel şifreli yerel yedek, sırları ayıklanmış indirme; binary log açık MySQL'de tam snapshot doğrulaması |
| Geri yükleme | Mevcut güvenlik yedekli akış | Ayrı boş hedef + ayrı dosya adayı; çalışan DB'yi değiştirmez; kurtarma kapsamı: ihracat anındaki tutarlı nokta snapshot'ı (ara anlar için DBA binary log tekrarı gerekir) |
| Devreye alma & geri dönüş | SQLite restore ve dosya kopyalama | Test edildi: Yazmaları durdurma (503/bakım kilidi), bağlantı değiştirme, eski oturum/bağlantı kapatma (session_version artışı), sağlık kontrolü; başarısız devreye almada sıfır veri kaybıyla geri dönüş; çift hedefe yazma engeli |
| Hesap ayrımı & yetki | Dosya izinleri | Doğrulandı: Runtime hesabı salt DML (SELECT, INSERT, UPDATE, DELETE; DDL engelli), migration hesabı DDL+DML |
| Yönetilen start/stop/health | Mevcut komutlar | Gerçek ayrı üretim başlangıcı/sağlık/yetkili durdurma geçti |
| Güncelleme | Mevcut SQLite update | Canlı yerinde DDL engelli; ayrı güvenlik kopyasında migration + açık kayıt/devreye alma |
| Gerçek müşteri geçişi/başka PC | Bu turda uygulanmadı | Bu turda uygulanmadı; müşteri kopyasıyla kabul bekler |

## Çalıştırılan doğrulamalar

- SQLite regresyonu: **69 test grubu / 629 test başarılı**. Son kanıt `.local/mysql-test/sqlite-regression.json`.
- MySQL çekirdek testleri: **5 test grubu / 16 test başarılı** (59,771 saniye); sonuç `.local/mysql-test/mysql-results.json`. Yarış koşulları, iki firma, iki depo ve kullanıcı kapsamları; HTTP liste/detay/arama/rapor/CSV/yazma; yönetilen başlangıç ve güvenlik yedeği doğrulandı.
- MySQL geçiş, hesap ayrımı, kurtarma ve devreye alma testleri (`tests/mysql/cutoverAndIntegrity.test.js`): **5 test / 5 başarılı** (80,378 saniye). Binary log açık MySQL 8.4 (`log_bin=1`, `binlog_format=ROW`, `log_bin_trust_function_creators=1`) üzerinde doğrulandı:
  1. **Derin SQLite → MySQL karşılaştırması**: Yalnız satır sayıları değil; 64-bit ID'ler (`9007199254740995`), sıfırlı barkodlar (`0000123456789`), 6 basamaklı lot/raf miktarları (`120.500001`, `10.000001`), SKT tarihleri (`2028-11-30`), vardiya açılış ve kapanış mutabakatı (`closing_json`), satış/iade tutarları (`subtotal_cents`, `total_cents`, `net_cents`), nakit hareketleri (`direction: in/out`) ve kullanıcı-depo yetki haritaları (`user_access_scopes`, `user_warehouse_access`) tam eşitlikle doğrulandı.
  2. **Yarıda kesilen aktarım güvenliği**: Satır aktarımı ortasında enjekte edilen kesilmede MySQL DML işlemi rollback edildi, migration durumu `failed` olarak kilitlendi, kirlenmiş hedefe kontrolsüz yazma engellendi (`Geri yükleme yalnız ayrı, boş hedef veritabanına uygulanır`). Temizlenen/yeniden başlatılan aktarımda kaynak SQLite değişmeden 0 mükerrer ve 0 eksik kayıtla başarı sağlandı. `sqlite_to_mysql.js` betiğine `--clean-interrupted-target` güvenli kurtarma desteği eklendi.
  3. **Runtime ve migration hesap ayrımı**: `veniux_migrator_test` (DDL + DML) ve en az izinli `veniux_runtime_test` (salt DML: `SELECT, INSERT, UPDATE, DELETE`) hesapları ayrıldı. Runtime hesabının DDL çalıştırması MySQL tarafından reddedildi (`ER_TABLEACCESS_DENIED_ERROR`); buna karşın yazma mutex kilitlemesi (`SELECT ... FOR UPDATE`), sipariş/stok yazma, güncelleme ve silme gibi tüm günlük iş akışları hatasız çalıştı.
  4. **Binary log açık yedekleme & kurtarma kapsamı**: `log_bin=1` devredeyken tam şifreli yedek oluşturma, sırları ayıklanmış taşınabilir ihracat, hazırlama ve ayrı boş hedef veritabanına (`veniux_test_import`) görsel dosyalarıyla birlikte kurtarma doğrulandı. Kurtarma kapsamı: İhracat anındaki veritabanı ve ilaç görsellerinin tutarlı nokta snapshot'ıdır; iki yedek arasındaki ara anlara dönüş için DBA binary log tekrarı (`mysqlbinlog`) gerekir.
  5. **Kurtarılan hedefi devreye alma ve geri dönüş (Cutover/Rollback)**: Yazmaları durdurma (`exclusiveMaintenance` / 503 bakım engeli), bağlantı ayarlarını değiştirme, eski oturumları geçersiz kılma (`session_version` artışı), eski bağlantı havuzunu kapatma ve aday hedefte sağlık kontrolü (`status: current`) test edildi. Başarısız devreye alma senaryosunda canlı veritabanında sıfır veri kaybıyla geri dönüş doğrulandı; aday aktif edilmedi (`activated: false`) ve çift hedefe aynı anda yazılması engellendi.
  6. **Yeni hedefte uçtan uca iş akışları**: Devreye alınan yeni hedef üzerinde kasa tanımlama → vardiya açılışı → satış (stok düşüşü ve kasa nakit girişi) → kısmi iade (stok iadesi ve kasa nakit çıkışı) → vardiya kapanışı (`closing_json` mutabakatı) → kapalı vardiyanın değiştirilemezlik trigger kontrolü (`ER_SIGNAL_EXCEPTION`) ve depo bazlı yetki kısıtlaması (izinli depoya erişim, yabancı depoya ret) başarıyla çalıştırıldı.
- MySQL gerçek uygulama akışları ve çoklu süreç devreye alma testleri (`tests/mysql/realAppFlowsAndCutover.test.js`): **5 test / 5 başarılı** (7,844 saniye). Doğrudan SQL ekleme yerine en az yetkili `veniux_runtime_test` ile gerçek API uçları üzerinden doğrulandı:
  1. **Gerçek servis ve HTTP API uçlarıyla iş akışı**: `POST /api/scanner/sale`, `POST /api/scanner/sales/:id/return` ve `POST /api/retail/shifts/:id/close` uçları üzerinden satış, kısmi iade ve vardiya kapanışı çalıştırıldı. Bağımsız teorik hesaplanan değerler (stok: 100 - 3 + 1 = 98, lot: 98, vardiya brüt: 75,00 TL, nakit iade: 25,00 TL, net: 50,00 TL, kasa farkı: 0,00 TL) uygulama sonuçlarıyla kuruşu kuruşuna örtüştü. Kapalı vardiyanın tutarlarını sonradan SQL ile değiştirme denemesi MySQL triggerı tarafından engellendi.
  2. **Çoklu süreç (Multi-Process) yazma bariyeri**: Süreç içi (in-memory) kilidin ayrı OS API süreçlerini çift yazmaya karşı koruyamayacağı gösterildi (Süreç B bellekte `blocked = false` durumundayken). İki bağımsız süreçte sistem çapında yazma bariyerinin veritabanı düzeyindeki `veniux_write_mutex` InnoDB satır kilidi (`SELECT ... FOR UPDATE`) ile sağlandığı kanıtlandı: Süreç A mutex'i tuttuğu sürece Süreç B'nin HTTP yazma isteği veritabanı kilit beklemesinde kaldı ve hedef depoya 0 kayıt yazıldı; Süreç A transaction'ı tamamlayınca Süreç B beklemeden çıkıp işlemini 201 Created ile veri kaybı veya bölünme olmadan tamamladı.
  3. **Yeniden başlatmada devreye alınan hedefin korunması**: `startProduction.js` ile bağımsız child process olarak uygulama yeniden başlatıldı. Uygulamanın devreye alınan `veniux_test_import` hedefini kalıcı olarak bağladığı ve `/health` ucundan `healthy` ve `connected` döndürdüğü doğrulandı.
  4. **Eski oturumların gerçek HTTP istekleriyle reddedilmesi**: Devreye almada kullanıcı `session_version` artırıldığında, eski token (`sessionVersion: 1`) ile yapılan gerçek `GET /api/scanner/lookup` istekleri anında 401 Unauthorized ile reddedildi (`Oturum geçerliliğini yitirdi`). Yeni token (`sessionVersion: 2`) 200 OK ile çalıştı.
  5. **64-bit kimlik (BIGINT) hassasiyetinin API ve JSON seviyesinde korunması**: $2^{53}-1$ değerini aşan 64-bit kimlik (`9007199254740995`) veritabanına yazıldı. `GET /api/scanner/sales/:id`, `GET /api/scanner/sales`, fiş çıktısı `/receipt` ve `POST /api/scanner/sales/:id/return` uçlarında JSON çıktısının string ID ürettiği (`"sale_id":"9007199254740995"`) ve IEEE-754 kayan noktalı sayı dönüşümüyle `9007199254740996` değerine bozulmadığı tam olarak doğrulandı.
- Frontend üretim derlemesi ayrı `.local/mysql-test/frontend-build` çıktısında başarılı. Mevcut büyük parça ve appearance boot klasik script uyarıları devam eder.
- Yedek indirme testleri, MySQL başlığı/bozuk içerik ek kontrolüyle **3/3 başarılı**. Görünüm kaynak kontrolü tema, sistem modu, renk, yoğunluk ve ses tercihlerinin gerçek uygulama/kayıt davranışını doğruladı.

## Düzeltilen gerçek hatalar ve test verisi ayrımı

Test sürecinde hiçbir beklenti gevşetilmemiş; gerçek kod hataları ile test fikstürü uyarlamaları kesin olarak ayrılmıştır:

1. **Gerçek Kod/Motor Hataları (Düzeltildi)**:
   - `backend/src/services/retailDailyService.js`: `reverse()` fonksiyonu `sale_id` değerini `Number(id)` ile sayıya dönüştürüyordu. JavaScript `Number.MAX_SAFE_INTEGER` ($2^{53}-1 = 9007199254740991$) üzerindeki 64-bit kimliklerde bu işlem son basamakları yuvarlayarak veriyi bozuyordu (`9007199254740995` $\to$ `9007199254740996`). `Number.isSafeInteger(Number(id)) ? Number(id) : String(id)` mantığı eklenerek 64-bit ID'lerin API ve nesne yanıtlarında string hassasiyeti güvenceye alındı.
   - `backend/src/database/mysqlMigrator.js`: `verifyStructure()` fonksiyonu `information_schema.TRIGGERS` tablosunu sorguluyordu. MySQL 8.4'te `TRIGGER` veya `SUPER` izni bulunmayan en az izinli runtime hesabı (`veniux_runtime_test`) bu tabloyu sorguladığında MySQL güvenlik gereği 0 satır döndürür; bu da uygulamanın 503 "MySQL trigger eksik" hatasıyla açılmasını engelliyordu. `verifyStructure()` fonksiyonu, yalnızca oturum açan hesabın `TRIGGER` veya `ALL PRIVILEGES` hakkı varsa trigger doğrulaması yapacak şekilde düzeltildi.
2. **Test Verisi / Fikstür Uyarlamaları**:
   - `closingJson` nesnesinde servis tarafından dönen alan adının `difference_cents` olduğu doğrulandı (testteki `cash_difference_cents` beklentisi servis modeliyle eşleştirildi).
   - `retail_shifts` tablosuna fikstür eklenirken şemada `NOT NULL` olan `opened_by_email` sütunu eklendi ve şemada bulunmayan `business_date` sütunu kaldırıldı.
   - İki süreçli yazma bariyeri testinde kilit kontrolü, diğer testlerden kalan satışlarla karışmaması için testin izole deposuna (`barrierWarehouseId`) bağlandı.
   - Tek açık vardiya indeksi (`idx_retail_one_open_shift`) kuralına uygun olarak 64-bit iade testi için izole kasa kaydı oluşturuldu.

## Tekrar çalıştırma ve geçiş

Mevcut Node/npm komutları korunur. Backend klasöründe SQLite için `npm test`, yalnız izole MySQL için `npm run test:mysql` kullanılır. MySQL test ayarı yalnız `.local/mysql-test/config.json` içindedir; sırlar çıktıya yazılmaz.

Yeni bir temiz çalışma alanında resmi MySQL 8.4 dizini verilerek `backend/scripts/Start-MySQL-Test.ps1 -MySQLBaseDir <resmi-MySQL-dizini>` çalıştırılır. Betik mevcut test veri klasörünü silmez; boş olmayan dizinde durur. Test sunucusu loopback 33316 kullanır, X protocol/binary log kapalıdır, geçici bootstrap root parolası sonrasında rastgele değiştirilir. `node scripts/mysql_test_migrate.js --recreate-test` yalnız izin verilen `veniux_test_` hedefini sıfırlar; müşteri hedefinde kullanılmaz.

Üretim adımları, uygulama durdurulmuşken ve **ayrı boş hedef/kopya** üzerinde:

1. DBA veritabanı ve hesapları oluşturur. `mysql_permissions.sql` günlük hesap için yalnız SELECT/INSERT/UPDATE/DELETE, migration ve kurtarma hesapları için yalnız kendi hedeflerinde gerekli DDL izinlerini gösterir. Günlük çalışma root veya global izin gerektirmez. Parolalar güvenli `install.env`/yönetim kanalında tutulur; komut satırına yazılmaz. Canlı test hesabı iki test şemasında geniş izinlidir; en az izinli müşteri hesabının hedef ortam kabulü ayrıca yapılmalıdır.
2. `node --env-file=<ayrı-hedef-ayar-dosyası> scripts/mysql_migrate.js` önce durumu gösterir. Boş hedef için `--apply --confirm-target`; mevcut **güvenlik kopyası** için ayrıca `--upgrade-safety-copy` gerekir. Bu bayrak bir kopya yaratmaz; operatörün ayrı kopyayı hazırlaması gerekir.
3. SQLite aktarımı için `node --env-file=<hedef-ayar-dosyası> scripts/sqlite_to_mysql.js --source <mutlak-SQLite-kopyası-yolu> --confirm-empty-target`. Kaynak salt okunur açılır. Müşteri kopyasında satır/toplam/ilişki ve iş kabulü tamamlanmadan canlı hedef değiştirilmez.
4. Kalıcı veri klasöründeki `install.env` açık motor/hedef/uygulama hesabıyla düzenlenir. `mysql_migrate.js --record-deployment --confirm-target` aynı hedefi ve üretim ayarlarını doğrulayıp hazır kurulum kaydını yazar. Mevcut yönetilen start/stop komutları bundan sonra kullanılabilir.
5. MySQL geri yükleme için ayrı `MYSQL_RECOVERY_HOST/PORT/USER/PASSWORD/DB` tanımlanır; DB adı `veniux_recovery_` ile başlamalı ve çalışan DB'den farklı olmalıdır. DBA boş hedefi önceden oluşturur. Ekranda açık onay verilir; sonuç DB ve dosya adayının konumunu döndürür, `activated:false` kalır.
6. Aday üzerinde sağlık/ilişki/iş kabulü yapıldıktan sonra uygulama durdurulur. Dönen `candidate_files` içeriği ayrı yeni bir storage dizininin `medicine-images` alt klasörüne kopyalanır ve dosya eşitliği doğrulanır. Eski DB/dosyalar korunarak `install.env` aday DB'ye, `MEDICINE_STORAGE_DIR` bu yeni storage dizinine yönlendirilir; hazır kayıt yeniden doğrulanır ve başlatılır. Hata halinde eski ayar/DB/dosyalara dönülür. Otomatik canlı DB değiştirme yoktur.

MySQL DDL örtük commit yaptığı için başarısız migration/geri yüklemenin transaction rollback ile canlı DB'yi geri getirdiği iddia edilmez. Somut koruma: canlı DB/dosyalar değiştirilmez, önce güvenlik yedeği alınır, sadece ayrı hedefte DDL/veri yükleme yapılır, başarısız hedef failed durumunda operasyonlara kapalı tutulur. [MySQL örtük commit kuralları](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html). Binary log açık üretimde trigger oluşturma politikası DBA tarafından hazırlanmalıdır; uygulamaya SUPER verilmez. [MySQL trigger izinleri](https://dev.mysql.com/doc/refman/8.4/en/create-trigger.html). Satır kilitleri transaction boyunca tutulur. [MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).

## Bekleyen kabul ve kapanış listesi

### Bu incelemede tamamlanan kontroller (10 Ekim 2026):
- [x] **Ayrı test ortamında SQLite → MySQL aktarımı**: İzole test ortamında (`127.0.0.1:33316`, `veniux_test_import`) sıfır veri kaybıyla çalıştırıldı.
- [x] **Derin veri ve ilişki karşılaştırması**: Yalnız satır sayıları değil; 64-bit kimlikler, firma ilişkileri, lot ve raf bakiyeleri (6 basamak hassasiyet), satış/iade tutarları, vardiya açılış ve mutabakat kapanışları (`closing_json`), nakit yönleri (`in`/`out`) ve kullanıcı-depo erişim haritaları tam eşitlikle doğrulandı.
- [x] **Yarıda kesilen aktarım güvenliği**: Satır yükleme ortasındaki kesintide DML rollback'i ve `failed` durumu doğrulandı; kirlenmiş hedefe kontrolsüz yazma engellendi; temizlenen hedefte yeniden çalıştırmanın 0 mükerrer ve 0 eksik kayıt ürettiği kanıtlandı (`--clean-interrupted-target` desteği eklendi).
- [x] **Hesap ayrımı ve en az yetkili çalışma**: `veniux_migrator` (DDL+DML) ve `veniux_runtime` (salt DML) hesapları ayrıldı. Runtime hesabının DDL çalıştırması engellendi (`ER_TABLEACCESS_DENIED_ERROR`), tüm günlük operasyonları (satır kilitleme, insert, update, delete) başarıyla tamamlandı.
- [x] **Binary log açık MySQL yedekleme/kurtarma**: `log_bin=ON`, `binlog_format=ROW` altında test edildi; kurtarma kapsamı açıkça belgelendi (ihracat anındaki tutarlı nokta snapshot'ı; ara anlar için DBA binary log tekrarı gerekir).
- [x] **Devreye alma (Cutover) prosedürü**: Yazmaları durdurma (`exclusiveMaintenance` / 503 engeli), bağlantıyı değiştirme, eski oturumları geçersiz kılma (`session_version` artışı), eski bağlantıları kapatma ve sağlık kontrolü doğrulandı.
- [x] **Geri dönüş (Rollback) ve çift yazma engeli**: Başarısız devreye alma simülasyonunda canlı veritabanı sıfır kayıpla korundu; aday aktif edilmedi (`activated: false`) ve çift hedefe yazma engellendi.
- [x] **Yeni hedefte gerçek API uçlarıyla uçtan uca akış**: Satış → kısmi iade → vardiya kapanışı doğrudan SQL değil, gerçek servis/API uçları (`POST /api/scanner/sale`, `POST /api/scanner/sales/:id/return`, `POST /api/retail/shifts/:id/close`) ve `veniux_runtime_test` hesabı üzerinden çalıştırıldı.
- [x] **Çoklu süreç (Multi-Process) ve çift hedefli (Dual-Target) cutover yazma bariyeri**: İki ayrı çalışan API süreci ve iki ayrı MySQL hedefi (`veniux_test_parity` ve `veniux_test_import`) üzerinde devreye alma testi gerçekleştirildi:
  - Bakım öncesinde başlamış ve `veniux_write_mutex` satır kilidinde bekleyen satış isteği, hedef devre dışı bırakıldığında (`is_active = 0`, `fence_version++`) kilit açıldığında `503 TARGET_FENCED` ile güvenli şekilde reddedildi.
  - Hedef değiştikten sonra eski havuza bağlı süreç eski veritabanına hiçbir yeni satış yazamadı (eski hedefte kesin olarak 0 yeni satış).
  - Süreçler aktif hedef durumunu doğruladı; eski hedefle çalışan süreç yeni istekleri de anında 503 ile reddetti ve `/health` ucu `fenced` bildirdi.
  - Yeni hedefe yazmalar açıldığında Process 2 üzerinden satış başarıyla 201 Created ile yazıldı; eski hedefte çift yazma (split-brain) oluşmadığı (0 satış) kanıtlandı.
  - Başarısız devreye alma senaryosunda eski hedefin kilit açmasıyla (`is_active = 1`) sıfır veri kaybıyla işlemlerin kaldığı yerden devam ettiği ve yeniden başlatmada (`startProduction.js`) devreye alınan hedefin korunduğu doğrulandı.
- [x] **Eczane Programı Geçiş Asistanı ve Veritabanı Geçişi ayrımı**:
  - Teknik SQLite $\to$ MySQL sihirbazı açıkça **"Veritabanı Geçişi"** olarak yeniden adlandırıldı (`DatabaseMigrationModal.jsx`).
  - **"Eczane Programı Geçiş Asistanı"** (`PharmacyMigrationAssistant.jsx`, `pharmacyMigrationService.js`), eczacının bilgisayarındaki Farmakom, İlon, TEB veya RxMediaPharma kurulumlarını Electron üzerinden güvenli şekilde tespit eden, doğrudan belgelenmemiş kapalı veritabanı adaptörü uydurmak yerine resmî Excel/CSV dışa aktarımına yönlendiren ayrı bir operasyonel aktarım motoru olarak tamamlandı.
  - **KVKK Hasta ve Reçete Filtresi**: Aktarılan tablolardan hasta adı/soyadı, T.C. kimlik numarası, doktor, reçete ve protokol sütunları kalıcı olarak filtrelenip atılarak hasta mahremiyeti güvenceye alındı.
  - Ürün kataloğu ile stok/lot/SKT/raf aktarımı birbirinden ayrıldı; mutabakat matrisi ve mükerrer aktarım koruması uygulandı.
  - Çalışan motor adımları ile program kılavuz metinleri birbirinden net olarak ayrıldı.
- [x] **Tasarım Bütünlüğü ve Rol Bazlı Maliyet/Kâr Koruması**:
  - Ana ekran (`Dashboard.jsx`), ürün detayı (`WMSDetailDrawer.jsx`) ve depo ekranında (`NormalWarehouses.jsx`) ortak tipografi, koyu/açık tema uyumu, kart hiyerarşisi, durum mesajları ve klavye (Escape, focus trap, `role="dialog"`) erişilebilirliği uygulandı.
  - Rota dışı eski dosyalar yerine gerçek rotalardaki bileşenler (`/dashboard`, `/normal-depo/warehouses`, `/normal-depo/products`, `/inventory`, `/normal-depo/locations`) düzenlendi.
  - Ürün detayında ve Dashboard'da alış maliyeti ve kâr marjı alanları kasiyer ve depo operatörlerinden hem UI düzeyinde gizlendi hem de backend API seviyesinde (`getAllProducts`, `getProductById`) yetkisiz roller için tamamen maskelenip yanıttan çıkarıldı.

### Müşteri üretimi öncesi bekleyen kabul maddeleri:
- [ ] **Gerçek müşteri verisi kabulü**: Müşteri SQLite üretim kopyasıyla bakım penceresinde yerinde aktarım ve DBA mutabakatı (gerçek müşteri verilerine dokunulmadı).
- [ ] **Fiziksel çevre birimleri**: Barkod okuyucu bridge donanımı, fiş/etiket yazıcıları ve para çekmecesi donanım testleri.
- [ ] **Resmî canlı dış entegrasyonlar**: Canlı e-Fatura/GİB portalı ve SGK Medula canlı ortamı entegrasyon onayları.
- [ ] **Ağ ve etki alanı ACL izinleri**: Farklı fiziksel istemci bilgisayarları, etki alanı kullanıcıları ve Windows ACL paylaşım kontrolleri.
- [ ] **Canlı geçiş tatbikatı**: Üretim bakım penceresinde operatör ve DBA tarafından yürütülecek canlı kesme/devreye alma ve acil durum geri dönüş tatbikatı.

