# Veniux lisans merkezi

**Plesk'e yükleme:** adım adım [PLESK-KURULUM.md](PLESK-KURULUM.md). Ortam değişkeni tanımlamak zorunlu değildir: `config/settings.example.php` dosyasını `config/settings.php` olarak özel alanda düzenleyebilirsiniz. Varsayılan ortam üretimdir; eksik MySQL veya özel veri klasörü ayarı ile servis açılmaz. Yerel önizleme açıkça geliştirme ortamını seçer.

PHP 8+, PDO SQLite (yalnız yerel geliştirme) / PDO MySQL (üretim), OpenSSL ve mbstring gerektirir. PHP, HTML, JavaScript, SCSS ve derlenen Tailwind kullanılır. Web kökü **yalnız `public/`** olmalıdır. Kaynak klasörü veya `.local` internete açılmamalıdır.

## Yerelde açma

Proje kökünde `node api.veniux.com/bin/local-preview.cjs` çalıştırın, http://127.0.0.1:39210 adresini açın. İlk yönetici hesabı `.local/license-admin-login.json` dosyasındadır; bu dosyayı paylaşmayın. Bu önizleme XAMPP PHP yolunu kullanır; Apache veya mevcut işletme veritabanını değiştirmez.

Panelden firma, paket, terminal sınırı ve bitiş tarihiyle lisans oluşturulur. Anahtar yalnız ilk kez gösterilir; veritabanında özeti saklanır. Askıya alma geri alınabilir; sonlandırma kalıcıdır. Terminal adı bir merkezi görünen addır; Windows bilgisayar adını değiştirmez. Terminal kapatıldığında müşteri kendisi yeniden aktifleştiremez.

## Üretim kurulumu

1. `api.veniux.com` DNS kaydını PHP sunucunuza yönlendirin. HTTPS sertifikası kurun. Apache sanal sunucu DocumentRoot değerini `api.veniux.com/public` yapın; AllowOverride FileInfo ile `.htaccess` yönlendirmesini etkinleştirin. Nginx için yalnız gerçek assets dosyalarını ve index.php ön denetleyicisini yönlendirin. Başka PHP dosyalarını URL üzerinden çalıştırmayın.
2. Ayrı boş MySQL/MariaDB veritabanı oluşturun. Migration için yalnız bu hedefte DDL izni olan geçici hesap; günlük çalışma için SELECT, INSERT, UPDATE, DELETE yetkili ayrı hesap kullanın. Root ile çalıştırmayın.
3. `LICENSE_DATA_DIR` web kökü dışında, servis hesabının erişebildiği özel dizin; `LICENSE_ENV=production`; `LICENSE_DB_DSN=mysql:host=127.0.0.1;dbname=veniux_authority;charset=utf8mb4`; `LICENSE_DB_USER` ve `LICENSE_DB_PASSWORD` sunucu ortamında tanımlanır. Parolaları kaynak koduna koymayın. OpenSSL için gerektiğinde `OPENSSL_CONF` ayarlayın. Windows örneğinde `C:/xampp/apache/conf/openssl.cnf` kullanılır; Linux kurulumunda bu yolu uygun OpenSSL config yoluyla değiştirin.
4. `php bin/setup.php` yalnız CLI'da çalışır; standart girdiden `email` ve en az 14 karakter `password` içeren JSON alır. Boş hedef şarttır. Şema sürümü ve anahtar çifti oluşturur. Web açılışında DDL çalışmaz; sürüm tamamlanmadıysa servis kapalıdır. Başarısız kurulumu silmeden inceleyin; yeniden denemek için ayrı boş hedef seçin.
5. HTTPS bilgisinin PHP'ye gerçek `HTTPS=on` olarak geçtiğini doğrulayın. İstemcinin gönderdiği forwarded header'a körü körüne güvenilmez. Üretim HTTP istekleri reddedilir. PHP hata gösterimini kapalı, logları erişim kontrollü tutun; proxy/access loglarında istek gövdelerini ve tokenları kaydetmeyin.
6. Özel imza anahtarını ve veritabanını ayrı, erişimi sınırlı yedekleyin. Özel anahtar müşteriye verilmez. Yönetim paneli internete açılmadan önce VPN/IP erişim kısıtlaması önerilir; bu sürümde MFA yoktur.

## Ürün bağlantısı

Veniux Node sunucusunda şu ortam ayarlarını tanımlayın:

```text
VENIUX_LICENSE_AUTHORITY_URL=https://api.veniux.com/v1
VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY=<merkezin signing-public.pem dosyasının yerel yolu>
```

Public key dağıtımda sabitlenir; ağdan otomatik alınarak güvenilmez. `VENIUX_LICENSE_ALLOW_LOCAL_HTTP=1` yalnız localhost geliştirme testinde kullanılmalıdır. Bu ayarlar olmadığı sürece mevcut ürünün eski lisans akışı korunur; merkezi koruma etkin sayılmaz. Mevcut kullanıcı verilerine veya çalışan kurulumun bağlantı seçimine otomatik müdahale edilmedi. Bu değişiklikler kaynak kodundadır; önceden oluşturulmuş EXE güncellenmedi.

Aktivasyon `POST /v1/activate` ile `license_key`, `device_fingerprint`, `device_name`, isteğe bağlı `os_info` alır. Cihaza özel rastgele token verir. `POST /v1/verify` token, fingerprint ve 32 hex nonce alır; tam JSON metnini RSA-SHA256 ile imzalayıp döndürür. Node tarafı sabit public key, nonce, donanım kimliği ve zaman aralığını doğrular. Her operasyon isteği canlı merkez kontrolünden geçer; platform yöneticisi de bu merkez engelini aşamaz. Askıya alma zaten başlamış bir işlemi geriye almaz; sonraki kontrolü engeller. Ekran 30 saniyede bir güncellenir, çevrimdışı tolerans yoktur. Merkezi modda otomatik stok/cron ve yedekleme zamanlayıcıları durdurulur; bunların lisanslı servis terminali tasarımı bu teslimata dahil değildir.

Electron makine kimliği hashlenir; terminal adı/RAM/ağ adaptörü değişikliği kimliği değiştirmez. İşletim sisteminin yeniden kurulması makine kimliğini değiştirebilir ve yeni aktivasyon gerektirir. Eski hashlerle otomatik eşleştirme yapılmaz. Donanım parmak izi kopyalanamaz fiziksel kanıt değildir; token + imza + sunucu kontrolü birlikte kullanılır. İstemci kaynak kodunu değiştiren saldırgana karşı mutlak DRM iddiası yoktur.

## Doğrulama — 11 Ekim 2026

`node api.veniux.com/bin/acceptance.cjs`: gerçek HTTP üzerinden iki ayrı PHP süreci ve ayrı SQLite bağlantılarıyla tek koltuk yarışı, imzalı doğrulama, yanlış donanım reddi, merkezi terminal adı, askıya alma/yeniden etkinleştirme/sonlandırma, iptal sonrası aktivasyon reddi ve sunucu kapalıyken Node API kapısının engeli geçti. Üretim verileri kullanılmadı. PHP sözdizimi ve iki arayüz derlemesi geçti. Yerel yönetici girişi ve lisans penceresi tarayıcıda görüldü.

Bekleyen: yeni lisans merkezinin MySQL/MariaDB canlı kabulü, DNS/HTTPS yayınlama, tüm Electron akışının merkez açık/kapalı kabulü, temiz Windows kurulum testi ve güvenlik değerlendirmesi. Bu kontroller geçmeden üretime hazır veya tüm ürünler bağlandı denemez.

## Lisans düzenleme ve şema 2 (11 Kasım 2026)

- Panelde lisans satırından **Düzenle**: firma, paket, terminal sınırı (etkin terminalden az olamaz), bitiş günü (+1 ay/+3 ay/+1 yıl), sektör paketleri (Hırdavat, Züccaciye, Pide ve restoran), iletişim e-postası ve not. Sonlandırılmış lisans düzenlenemez.
- Sektör paketleri imzalı doğrulama yanıtında `addons` olarak döner (`hardware`, `tableware`, `restaurant`). Yanıtı okuyan ürün bu alanı yok sayabilir; mevcut istemciler etkilenmez.
- Not, e-posta ve eklenti sütunları şema 2 ister: `php bin/upgrade.php` (yalnız CLI; yalnız sütun ekler, mevcut kayıtlara dokunmaz, tekrar çalıştırılabilir). Yükseltmeden önce kod şema 1'de de çalışır; bu alanlar o zamana kadar kapalı görünür.
- **Sistemler** sayfası bulut uygulamasının sağlığını, canlı destek durumunu ve paket kataloğunu yalnız okur.
- Kabul: `LICENSE_ENV=development LICENSE_DATA_DIR=<geçici klasör> php bin/edit-acceptance.php a` ardından aynı komutla `b` (iki ayrı süreç).
