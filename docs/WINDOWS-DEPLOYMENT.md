# Windows kurulum, güncelleme ve kurtarma

## Gerekenler

Windows x64, PowerShell 7 ve Node.js **24.x** (npm dahil). Bu ortamda Node 24.15.0 / npm 11.12.1 kullanıldı. İnternet ilk bağımlılık kurulumu ve dış servisler için gerekir. `better-sqlite3` ve bcrypt için uyumlu hazır ikili indirilemezse Node yerel derleme araçları gerekir; kurulum hatayı bildirir. MySQL gerekli değildir; bu dağıtım SQLite içindir.

Uygulama sürümleri ayrı klasörlerde, örneğin `C:\Veniux\releases\surum-1` tutulur. Kalıcı veri varsayılan olarak `%LOCALAPPDATA%\Veniux\data` altında tutulur. Bu klasör sürüm klasörünün **dışında** olmalıdır. Programı daima aynı Windows kullanıcısıyla çalıştırın.

## Temiz kurulum

Kurulum/güncelleme varsayılan olarak WhatsApp için isteğe bağlı Chromium indirmez; bu, ana API kurulumu için gerekli değildir. WhatsApp kullanacaksanız Chrome/Edge kurulu olmalı veya özel install.env içinde WHATSAPP_BROWSER_PATH seçilmelidir. İndirmeyi açıkça istiyorsanız Install-Windows/Update-Windows komutuna `-DownloadWhatsAppBrowser` ekleyin; internet ve sağlayıcı TLS erişimi gerekir. İndirme başarısızsa TLS doğrulamasını kapatmayın. Gerçek WhatsApp bağlantı/teslimat kabulü ayrı bekleyen kontroldür.

1. `Build-Release.ps1` ile hazırlanan ZIP'i hedef bilgisayarda sürüm klasörüne açın. ZIP SHA256'sını yanında verilen `.sha256` dosyasıyla karşılaştırın. Paket uygulama kodunu ve derlenmiş arayüzü içerir; mevcut veritabanı, test hesapları, `.env`, yerel lisans anahtarları ve `node_modules` içermez.
2. PowerShell 7'de sürüm klasörüne geçin: `Set-Location C:\Veniux\releases\surum-1`.
3. `./Install-Windows.ps1` çalıştırın. Firma, yönetici adı/e-postası/telefonu ve gizli şifre istemini doldurun. Şifre en az 12 karakter, büyük/küçük harf ve rakam içermelidir; en fazla 72 bayt kabul edilir. Varsayılan yönetici şifresi yoktur. İlk hesabın platform yönetimi ve firma genelinde erişimi açıkça atanır. Örnek firma, depo, ürün veya lisans üretilmez.
4. `./Start-Production.ps1` çalıştırın; terminali açık tutun. Tarayıcıda `http://127.0.0.1:3000` açın. Arayüz ve API aynı sunucudadır; Vite gerekmez.
5. `http://127.0.0.1:3000/health` sonucunda `status=ok`, `database=sqlite`, `migrations.status=current` olmalıdır. Sağlık yanıtı sır veya dosya yolu göstermez.

Özel konum için tüm komutlara aynı `-DataDirectory 'D:\VeniuxData'` parametresini ekleyin. Sunucuyu internete açmak bu yerel kurulumun kapsamı dışındadır; HOST yalnızca 127.0.0.1 kabul edilir.

Kurulum `data\install.env` içinde rastgele JWT sırrı ve `data\keys` altında kalıcı RSA anahtar çifti oluşturur. Eksik/uyumsuz ayarlar açık hata ile başlatmayı engeller. İsteğe bağlı AI, ses, e-posta ve diğer servislerin gerçek erişim bilgilerini yalnızca bu özel dosyaya ekleyin; örneğin NVIDIA_API_KEY, GEMINI_API_KEY, FISH_API_KEY. Bunlar yeni bilgisayarda kendiliğinden etkinleşmez. Değişiklikten sonra sunucuyu durdurup başlatın. Bu dosyayı paylaşmayın.

## Mevcut geliştirme kurulumundan geçiş

Bu işlem bu çalışmada mevcut kullanıcı verileriniz üzerinde çalıştırılmadı.

Eski API'yi, Vite'ı ve seri bağlantı uygulaması kullanılıyorsa onu durdurun. Eski `backend\stok_takip.db`, `backend\storage`, `backend\config\keys` ve `.env` dosyalarını silmeyin. Yeni sürüm klasöründe:

```powershell
./Adopt-Legacy-Windows.ps1 -LegacyBackendDirectory 'C:\EskiVeniux\backend'
./Update-Windows.ps1
./Start-Production.ps1
```

Hedef veri klasörü boş olmalıdır. Taşıma SQLite'ın tutarlı yedekleme API'sini kullanır, mevcut kullanıcı şifrelerini ve lisans imza anahtarlarını korur; eski veritabanını değiştirmez. Eski anahtarlar veya özel dosya konumları doğrulanamazsa işlem durur. Zayıf eski JWT sırrı korunmaz; yeni sır nedeniyle yeniden oturum açılması gerekir. Taşıma yarıda kalırsa eski kaynakları ve hedef güvenlik yedeğini saklayın; yeni başlangıç yapmadan önce hatayı giderin.

## İsteğe bağlı seri barkod bağlantısı

USB/Bluetooth HID için ek kurulum gerekmez; özel barkod alanını kullanın. Web Serial doğrudan desteklenmeyen seri cihaz için pakette mevcut `scanner-bridge` ve `shared` modülleri korunur. Bir kez `npm --prefix scanner-bridge ci` çalıştırın; ardından `./Start-ScannerBridge.ps1` kullanın. Özel veri klasörü kullandıysanız aynı `-DataDirectory` değerini verin. Eşleştirme anahtarı yönetilen kurulumda `data\storage\scanner-bridge\pairing.json` içinde kalır ve sürüm paketine dahil edilmez. Anahtarı Ayarlar → Barkod Okuyucu alanına girin. Eski kurulum taşınırken eski anahtar varsa korunur. Gerçek seri port ve cihaz sürücüsü uyumluluğu fiziksel cihazla ayrıca doğrulanmalıdır.

## Güncelleme

1. Eski sürüm klasörünü koruyun. Yeni ZIP'i **ayrı** sürüm klasörüne açın; veri klasörünün üzerine paket açmayın.
2. Yeni sürüm klasöründe `./Update-Windows.ps1` çalıştırın. Açık yönetilen API güvenli yerel durdurma isteğiyle kapanır; devam eden HTTP işlemleri tamamlanmadan migration başlamaz. Başka/ eski bir API elle açık bırakılmışsa önce onu durdurun.
3. Bağımlılıklar kurulur, SQLite çevrimiçi yedek API'siyle güvenlik yedeği alınır, dosyalar ve ayarlar korunur; tüm bekleyen migrationlar tek transaction içinde çalışır. Bir migration hata verirse tüm bu grubun veritabanı değişiklikleri geri alınır ve başlatma engellenir. Düzeltmiş sürümde güncelleme tekrar denenebilir.
4. `pending_assignments` sıfırdan büyükse Ayarlar → Kullanıcılar ekranındaki uyarıyı inceleyin. Migration 027 eski yöneticileri firma kapsamına geçirir; kasiyer/depo personeli dahil diğer eski kullanıcıları atamasız kısıtlı kapsamda bırakır. Her kullanıcıya kalkan düğmesinden depo atayın. Rol ve depo kapsamı sunucuda birlikte denetlenir.
5. Yeni sürümde `./Start-Production.ps1` ve sağlık kontrolünü çalıştırın.

Migration kimlikleri ve SHA256'ları veritabanında saklanır. Tekrar çalışma uygulanan dosyayı tekrar işlemez. Uygulanmış dosyanın değişmesi veya veritabanında kodda olmayan migration bulunması başlatmayı engeller. Eski checksum'sız kayıtlar ilk geçişte mevcut dosyaların hash'iyle `legacy_baseline=1` olarak kaydedilir: bu, geçmişteki dosya içeriğinin doğrulandığı anlamına gelmez; kaynak sürüm dosyaları ve ön yedek saklanmalıdır.

## Kurtarma / sürüm geri dönüşü

Yalnızca kodu eski sürüme çevirmeyin. Veritabanı yeni migration içeriyorsa eski katalogla uyumsuzluk tespit edilir. Uyumlu eski yönetilen sürümün klasöründe güncelleme öncesi güvenlik yedeğini seçin:

```powershell
./Restore-Windows.ps1 -SnapshotDirectory 'C:\Users\Kullanici\AppData\Local\Veniux\data\recovery\YEDEK-KLASORU'
./Update-Windows.ps1
./Start-Production.ps1
```

İstem geldiğinde **VERİLERİ GERİ YÜKLE** yazılması zorunludur. Yedek dosya listesi/hash'leri, SQLite bütünlüğü, ilişkiler ve hedef kodun migration kataloğu doğrulanır. Mevcut durumun ayrıca güvenlik yedeği alınır. Sunucu kapalıdır; satış/stok yazılamaz. Dosya değiştirme hatasında önceki dosyalar ve başlatma durumu geri alınır. Yedek başka veri klasörüne taşınmışsa kalıcı veri/anahtar yolları yeni konuma göre düzenlenir. Geri yüklenen eski şema yeni kod için migration gerektirebilir; uygulama bu işlem tamamlanmadan açılmaz.

Elektrik kesintisiyle geri yükleme yarım kaldıysa `deployment.json` recovering durumunda kalır; uygulama açılmaz. Aynı komuta `-RepairInterrupted` ekleyerek açık onayla önceki dosyaları geri alın. Yedek sonrası yapılmış satışlar geri yüklenen durumda yer almaz; işlem öncesi güvenlik yedeğinde kalır. Eski, bu yönetilen başlatıcıyı içermeyen geliştirme sürümüne otomatik geri dönüş desteklenmez.

## Veriler ve yedekler

- `data\stok_takip.db`: kullanıcı/ürün/stok/satış ve migration kayıtları.
- `data\storage`: yüklenen belgeler/görseller, mevcut yedek modülü ve servis dosyaları.
- `data\keys`, `data\install.env`: özel kalıcı sırlar.
- `data\recovery`: güncelleme/taşıma/kurtarma öncesi **özel yerel** güvenlik yedekleri; sürüm, şema listesi ve dosya hash'lerini içerir. Son sağlam yedek otomatik silinmez.

Özel kurtarma yedeği tam geri dönüş için şifre hash'leri, servis anahtarları ve yerel oturum dosyaları içerir. Kurulum klasör erişimini mevcut Windows hesabı ve SYSTEM ile sınırlar; bu klasörü müşterilere veya herkese açık sunucuya koymayın. Mevcut panelin indirilebilir temizlenmiş yedeği ayrı biçimdedir ve sırları içermez. Aynı bilgisayardaki yedek disk arızasına karşı yeterli değildir; özel kurtarma klasörünü güvenli, erişimi sınırlandırılmış dış diskte ayrıca saklayın.

API/bilgisayar kapalıyken uygulama içi otomatik işler çalışmaz. Bu başlatıcı Windows servisi veya zamanlanmış görev kurmaz. Electron masaüstü paketi mevcut haliyle yalnız arayüzdür; API/veri kurulumu için yukarıdaki Windows dağıtımını kullanın. Electron güncelleyicisi veritabanı migration akışı yerine geçmez.

## Doğrulama sınırı

Ayrı geçici SQLite veritabanlarında temiz kurulum, 026 → 027 yükseltme, admin/kasiyer/depo personeli geçişi, tekrar güncelleme, başarısız migrationın tüm grubu geri alması, eski kod kataloğuyla başlatma engeli, hash bozulması ve geri yükleme dosya hatası kontrol edilir. Üretim başlatıcısı ayrı port/veri klasöründe sağlık/arayüz ve kimlik doğrulamalı durdurma ile denenir. Ayrıntılı sonuçlar `docs/DEPLOYMENT-VERIFICATION.md` dosyasındadır.

Başka fiziksel bilgisayarda sıfırdan Node/npm kurulumu, MySQL, Windows servisi/NSIS, güç kesintisi ve fiziksel barkod okuyucu/yazıcı testleri bu doğrulamaya dahil değildir.
