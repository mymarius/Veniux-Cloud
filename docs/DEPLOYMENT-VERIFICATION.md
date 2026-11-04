# Kurulum ve güncelleme doğrulaması — 7 Ekim 2026

## Sonuç

Ayrı SQLite test ortamında **62 test dosyası / 490 test geçti**. Üretim veritabanı kullanılmadı ve mevcut yerel API bu çalışma kapsamında yeniden başlatılmadı. Arayüz üretim derlemesi başarılı. Windows dağıtımı oluşturuldu; çalışan ekran tasarımı korunarak yalnız Kullanıcılar ekranına atama bekleyen kullanıcı uyarısı eklendi.

## Doğrulanan senaryolar

| Kontrol | Sonuç | Kanıt / kapsam |
|---|---|---|
| Temiz kurulum, kullanıcıdan alınan güçlü şifre | Geçti | Tek ilk yönetici, bcrypt karşılaştırması, açık firma kapsamı |
| Varsayılan hesap / örnek veriler | Geçti | Kurulumda ürün, depo ve lisans sayıları sıfır; kullanıcı sayısı bir |
| Şifresiz kurulum / tekrar ilk yönetici oluşturma | Geçti | Reddedildi; mevcut hazır durum ve kullanıcı korundu |
| Önceki SQLite şeması → 027 | Geçti | 026 kataloğundan üretilmiş fixture; eski hash'ler korundu |
| Yönetici / kasiyer / depo personeli geçişi | Geçti | Yönetici company; cashier/operator restricted, iki atama uyarısı |
| Güncellemeyi yeniden gönderme | Geçti | Yeni kullanıcı veya tekrar migration oluşturmadı |
| İkinci bekleyen migrationda hata | Geçti | 027 ve test 028 aynı transactionda geri alındı; hazır olmayan durum açılmadı |
| Eski kod kataloğuyla yeni DB / değiştirilmiş migration hash'i | Geçti | Uyumsuz sürüm ve değiştirilmiş dosya reddedildi |
| Tutarlı SQLite yedeği / dosyalar ve ayarlar | Geçti | SQLite backup API; integrity_check, foreign_key_check, SHA256 |
| Yedek bozulması / eksik DB hash'i | Geçti | Geri yükleme başlamadan reddedildi |
| Açık onaysız geri yükleme | Geçti | İşlem reddedildi |
| DB ve yüklenen dosyanın geri gelmesi | Geçti | Kullanıcı verisi ve yükleme içeriği karşılaştırıldı |
| Geri yükleme kopyalama/taşıma hatası | Geçti | Özgün veriler ve önceki hazır durum korundu |
| Yarım kalan geri yükleme | Geçti | Günlük simülasyonu ile başlatma engeli ve açık onaylı repair |
| Eski kaynak kurulumunun taşınması | Geçti | İzole fixture; kaynak DB SHA256 değişmedi, hash/anahtar/dosya/servis ayarı korundu |
| Üretim API + derlenmiş arayüz | Geçti | Ayrı rastgele localhost portu ve ayrı kalıcı veri klasörü |
| Sağlık kontrolü | Geçti | SQLite erişimi, current migration durumu, 19 migration dosyası; sırlar gösterilmedi |
| API çalışırken güncelleme / yetkisiz kapatma | Geçti | Güncelleme ve yanlış kontrol anahtarı reddedildi |
| Güvenli API kapatma | Geçti | Geçerli özel kontrol anahtarıyla kapanış ve server.json temizliği |
| Eksik kurulum ayarları | Geçti | Başlatıcı hata ile çıktı, veritabanı veya kullanıcı oluşturmadı |
| Rol ve depo erişim uçları | Geçti | Mevcut warehouseAccessScope API testleri; kapsam dışı stok/satış/transfer değişmedi |
| PowerShell betik sözdizimi | Geçti | Yedi kurulum betiği ve mevcut seri bağlantı başlatıcısı PowerShell 7 parser ile kontrol edildi |

Test araçları: `backend/tests/deploymentLifecycle.test.js` (11 senaryo), `productionRuntime.test.js` (2 senaryo), mevcut `warehouseAccessScope.test.js` ve tüm önceki testler. CLI/üretim başlatıcı testleri ayrı çocuk Node süreçleri kullanır. Test sandbox'ındaki `spawn EPERM` gerçek uygulama hatası olarak değerlendirilmedi; izinli koşuda bu süreç testleri tamamlandı.

Dağıtım ZIP'i ayrı klasöre açılarak ek çalıştırma testi yapıldı: ilk yönetici, gerçek API giriş isteği, arayüz, sağlık, sağlayıcı ayarını install.env içinde koruma, güvenli durdurma ve yedekli güncelleme geçti. Bu testte bağımlılıklar mevcut bilgisayarın Node modüllerinden sağlandı; yeni bilgisayarda npm indirme testi sayılmadı. Paket içeriğinde veritabanı, .env, özel PEM anahtarları, test seed betikleri ve gerçek sağlayıcı anahtar biçimleri bulunmadığı kontrol edildi.

## Değişiklikler

- `backend/src/config/runtimeConfig.js`: dış veri konumu, üretim yapılandırması/anahtar doğrulaması.
- `backend/src/database/migrator.js`: migration katalog/hash kaydı, tekrar çalıştırma, sürüm uyumluluğu ve tüm grup için atomik transaction.
- `backend/src/config/database.js`, `backend/src/index.js`: üretimde otomatik migration yerine hazır durum kontrolü; DB/migration sağlık çıktısı.
- `backend/src/services/deploymentService.js`, `deploymentSnapshot.js`: ilk yönetici, taşıma, yedekli güncelleme, açık onaylı kurtarma, yarım kurtarma günlüğü.
- `backend/scripts/manageDeployment.js`, `startProduction.js`, `src/services/runtimeControl.js`: kurulum yönetimi, tek API örneği ve özel localhost kapanış.
- Mevcut yedek, ilaç, WhatsApp, asistan, güncelleme ve yönetim ayar dosyaları kalıcı veri klasörüne bağlandı. Panelden girilen sağlayıcı anahtarları üretimde install.env içinde korunur.
- MySQL başlangıcındaki örnek yönetici oluşturma kaldırıldı. Test dışı ödeme webhook'u yapılandırılmamışsa test sırrına düşmez.
- Dağıtımda mevcut `shared` kasa/barkod modülleri ve isteğe bağlı `scanner-bridge` korunur; eşleştirme anahtarı özel veri klasöründe saklanır. Ortak modül/seri bağlantı simülasyonunda **8 test geçti**.
- `Install-Windows.ps1`, `Adopt-Legacy-Windows.ps1`, `Start-Production.ps1`, `Stop-Production.ps1`, `Update-Windows.ps1`, `Restore-Windows.ps1`, `Build-Release.ps1`.
- `frontend/src/pages/settings/UsersTab.jsx`: aktif, atamasız kullanıcılar için açık uyarı.
- `backend/.env.example`, `backend/scripts/migrate.js`, `backend/tests/setup.js`: güvenli üretim örneği, yedeksiz üretim migration engeli, checksum kayıtlarını test temizliğinde koruma.

## Doğrulanamadı / bekleyen

- Başka fiziksel bilgisayarda sıfırdan Node/npm kurulumu ve tüm bağımlılıkların internetten indirilmesi. Bu PC'nin Node 24 çalışma ortamında uygulama/SQLite doğrulandı.
- Windows klasör izinlerinin başka kullanıcı hesaplarıyla fiilî erişim testi; betikler mevcut Windows kullanıcısı/SYSTEM izinlerini uygular ve hata durumunda durur.
- Gerçek elektrik kesintisi/disk arızası; kurtarma günlüğü ve dosya hataları simüle edildi.
- MySQL migrationları ve bu platformdaki depo kapsamı. SQLite paketinde MySQL seçimi engellenir.
- Windows servisi, otomatik bilgisayar açılışı, tüm API'yi içine alan NSIS/Electron kurucusu. Yönetilen PowerShell dağıtımı hazırdır; mevcut Electron paketi yalnız arayüzdür.
- Fiziksel okuyucu/yazıcı ve dış sağlayıcıların canlı hesapları. Bu işte bunlar denenmedi.

Özel güncelleme yedekleri `VERİ_KLASÖRÜ\recovery` altında saklanır ve hassas yerel kurtarma içeriğine sahiptir. Panelin sırları ayıklanan indirilebilir yedekleri ayrı altyapıdır. Aynı diskteki kopya disk arızasına karşı yeterli değildir. Kısa kullanım adımları WINDOWS-DEPLOYMENT.md rehberindedir.
