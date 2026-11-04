# Yedekleme ve geri yükleme incelemesi

Tarih: 4 Ekim 2026. Uygulama veritabanı: SQLite. Üretim veritabanına geri yükleme uygulanmadı.

## Kullanım

Platform yöneticisi **Ayarlar → Sistem Motoru → Yedekleme ve geri yükleme** ekranını kullanır: `http://127.0.0.1:5173/settings?tab=system`. Ortak veritabanı bütün firmaları kapsadığı için müşteri yöneticilerine bu yetki verilmez. Sunucu yedek oluşturma, indirme, doğrulama, ayar ve geri yükleme uçlarında platform yöneticisi yetkisini kontrol eder.

Manuel yedek, geçmiş, indirme ve geri yükleme önizlemesi eklendi. Otomatik yedekleme başlangıçta kapalıdır; kullanıcı açabilir. Aralık 1–168 saat, saklama süresi 1–3650 gün ve yedek sayısı 2–100 arasında ayarlanabilir. Varsayılanlar 24 saat, 30 gün ve 10 yedektir. Tarayıcı kapalıyken API çalışmaya devam ediyorsa zamanlayıcı çalışır. Bilgisayar veya API kapalıyken çalışmaz; API yeniden açıldığında zamanı gelmiş yedek kontrol edilir.

## Saklama ve kapsam

Yerel yedekler `C:\Users\mymarius\Desktop\veniux.com\backend\storage\backups` altında şifreli `.vnxsecure` dosyalarıdır. Aynı klasörde geçmiş, zamanlama ayarları ve yerel şifreleme anahtarı bulunur. `local-key.bin` indirilmez; silinmesi mevcut şifreli yedekleri kullanılamaz hale getirir. Yedek geçmişi oluşturma, hata, bütünlük ve saklama nedeniyle kaldırılma durumlarını gösterir.

SQLite anlık görüntüsü [SQLite Online Backup API](https://www.sqlite.org/backup.html) üzerinden alınır. Veritabanı dosyası doğrudan kopyalanmaz. İlgili uygulama yazmaları ve yüklemeleri kısa süreli durdurularak veritabanı ile kalıcı ilaç görselleri birlikte alınır. Mevcut yüklenen kalıcı dosya alanı `storage/medicine-images` kapsam içindedir; `MEDICINE_STORAGE_DIR` tanımlıysa o kök kullanılır. Veritabanındaki uygulama ayarları da korunur.

İndirilebilir `.vnxbackup` dosyası parola özetleri, lisans/erişim anahtarları, hassas alanlar ve bilinen gizli değerler temizlenmiş taşınabilir yedektir. Temizlik sonrası SQLite VACUUM uygulanarak silinen değerlerin boş sayfalarda kalması engellenir. `.env`, WhatsApp oturumları, özel anahtar dosyaları ve geçici/cache alanları kapsam dışıdır. Yerel şifreli güvenlik yedeği tam geri dönüş için kimlik bilgilerini şifreli olarak korur; bu dosya doğrudan indirilemez.

**Aynı bilgisayardaki yedek disk arızasına karşı yeterli değildir.** Bu uyarı kullanım ekranında gösterilir. İndirilebilir yedeği farklı disk veya güvenli dış depoda saklayın; ürün/veri kişisel bilgiler içerebilir. Taşınabilir yedek mevcut eşleşen kullanıcıların mevcut parolalarını korur; eşleşmeyen kullanıcılar devre dışı bırakılır ve yeniden etkinleştirme/parola düzenlemesi gerekir. Dış servis sırları gerektiğinde yeniden yapılandırılır.

## Bütünlük ve geri yükleme

Her yedekte tarih, uygulama sürümü, uygulanmış şema sürümleri, şema parmak izi, veritabanı/dosya SHA-256 değerleri, dosya listesi ve yedekleme politikası bulunur. SQLite `integrity_check` ve `foreign_key_check` uygulanır. Bozuk paketler, yanlış dosya yolları, geçersiz görseller ve uyumsuz uygulama/şema sürümleri reddedilir. Yalnızca aynı uygulama sürümü ve şema desteklenir; eski/yeni sürümler otomatik dönüştürülmez. Eski çıplak `.db` yedekleri bu yeni paket biçimine otomatik alınmaz. SHA-256 bütünlük kontrolüdür; taşınabilir dosyalar için dış kaynak kimliğini kanıtlayan dijital imza değildir.

Geri yükleme önizlemesi 10 dakika geçerlidir ve doğrulamayı yapan kullanıcıya bağlıdır. Kullanıcı tüm firmaların verilerinin değişeceğini kabul edip **TÜM VERİLERİ GERİ YÜKLE** ifadesini yazmalıdır. Sunucu bu ifadeyi ayrıca doğrular. Mevcut platform yöneticisinin kimliği ve etkin erişimi yedekte bulunmalıdır; farklı yönetici kimlikleriyle yeni kurulum aktarımı bu akışın kapsamı değildir.

Geri yüklemeden önce mevcut durumun şifreli güvenlik yedeği alınır. Başlamış yazmalar tamamlanır; yeni satış, stok ve diğer API işlemleri bakım yanıtıyla durdurulur. SQLite değişiklikleri tek işlemde uygulanır, dosyalar geri alınabilir şekilde değiştirilir. Hata durumunda veritabanı, dosyalar ve politika önceki duruma döner. Başarılı geri yüklemede bütün kullanıcı oturumları geçersizleştirilir. İşlem ve kullanıcı bilgileri denetim kayıtlarına yazılır.

Yeniden başlatmada yarım kalan dosya değişimi günlüğü kontrol edilir; SQLite işleminin tamamlanma kaydına göre dosyalar korunur veya geri alınır. Geri alma da başarısız olursa yeni yazmalar kapalı tutulur. Bu koordinasyon tek API süreci içindir; veritabanına bağımsız dış uygulamaların doğrudan yazması desteklenmez.

Saklama temizliği yalnızca yeni sağlam yedek oluşturulduktan veya başarılı geri yüklemeden sonra yapılır. En yeni doğrulanmış sağlam yedek korunur. Başarısız yeni yedek eski sağlam yedeği silmez.

## Doğrulama

- Yeni yedek testleri: **19/19 geçti**. Tüm proje: **53 test grubu, 394/394 test geçti**. Sonuç: `audit/backup-regression-results.json`.
- Ayrı SQLite test veritabanında gerçek satış ve hasarlı kısmi iade API akışları oluşturuldu. Yedek → veri/dosya değişikliği → geri yükleme sonrasında satış, iade, stok, raf, lot, stok hareketleri ve kullanıcı ilişkileri karşılaştırıldı.
- Yerel ve taşınabilir paket; uzun sayısal barkod, baştaki sıfırlar, gizli değer temizliği, hassas olmayan ayarların korunması, dosya bütünlüğü ve kullanıcı oturumları doğrulandı.
- Açık onay, kullanıcıya bağlı önizleme, yetkisiz erişim, bozuk/uyumsuz paket, geçersiz şema/yol ve yabancı anahtar hatası denendi.
- Geri yükleme sırasında yeni satışın durdurulması, başlamış stok işleminin tamamlanmasının beklenmesi ve geç aşama hatasında veritabanı/dosya/politika geri dönüşü doğrulandı.
- Sayı/yaş sınırı, başarısız yedekte sağlam yedeğin korunması ve otomatik zamanlama doğrulandı. Yeniden başlatma kurtarma günlüğünün tamamlanmış/tamamlanmamış iki durumu simüle edildi; gerçek elektrik kesintisi testi yapılmadı.
- Üretim SQLite üzerinde yalnızca okuma ile bütünlük `ok`, yabancı anahtar hatası `0`, geri yükleme kaydı `0` görüldü. Üretimde geri yükleme denenmedi. MySQL, disk arızası ve çok süreçli dış yazıcı testleri yapılmadı.
- Ön yüz üretim derlemesi geçti; mevcut büyük paket boyutu uyarısı devam ediyor.

## Değişen dosyalar

Yeni: `backend/src/services/backupService.js`, `backend/src/routes/backupRoutes.js`, `backend/src/middlewares/backupMaintenance.js`, `backend/tests/backupRecovery.test.js`, `frontend/src/pages/settings/BackupPanel.jsx`.

Güncellenen: `backend/src/config/database.js`, `backend/src/index.js`, `backend/src/controllers/settingsController.js`, `backend/src/middlewares/authMiddleware.js`, `frontend/src/pages/settings/SystemEngineTab.jsx`. Testlerde ortaya çıkan mevcut eksik stok uyarısı çağrısına uyumlu yardımcı işlev `backend/src/services/stockAlertSync.js` içine eklendi.

Yeni dış hizmet veya MySQL kurulumu gerekmez. Mevcut bağımlılıklar kullanılır; API yeniden başlatıldığında altyapı hazırdır. Canlı otomatik yedeklemeyi yönetici ekranından etkinleştirin.
