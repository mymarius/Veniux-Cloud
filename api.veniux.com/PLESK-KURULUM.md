# Plesk üzerinde api.veniux.com

Bu klasör PHP lisans merkezi ve yönetim panelidir. Node.js, Electron, XAMPP veya npm sunucuya kurulmaz; CSS/JS dosyaları `public/assets` içinde hazırdır. ZIP gerekmez. Bu talimat Linux Plesk + Apache üzerinden PHP-FPM içindir. Gerçek Plesk ortamında yayınlama henüz test edilmedi.

## 1. Dosyalar ve alan adı

Plesk → Websites & Domains → `api.veniux.com` alan adını/subdomain'ini oluştur. DNS kaydını hosting adresine yönlendir. Dosya Yöneticisi ile bu klasörün `public`, `src`, `config`, `bin` dizinlerini ayrı uygulama dizinine yükle; örnek dizin `api.veniux.com`.

Hosting Settings → Document root değerini **`api.veniux.com/public`** yap; yol abonelik ana dizinine göredir. Kök dizini veya `src` klasörünü seçme. `.htaccess` dosyalarını da yükle. Kök `.htaccess` yanlış web kökü seçilirse erişimi kapatır; public içindeki dosya doğru kökü açar.

PHP Settings → PHP 8.2 veya daha güncel, PHP-FPM served by Apache seç. `pdo_mysql`, `openssl`, `mbstring`, `session` uzantıları gerekli. `display_errors=Off` kullan. Apache & nginx Settings içinde nginx proxy mode açık olsun. Bu düzende Apache public/.htaccess üzerinden `/v1/verify` gibi yolları index.php'ye yönlendirir. Yalnız nginx kullanacaksan hosting yöneticisi ön denetleyici yönlendirmesini ayrıca kurmalı; Apache .htaccess nginx üzerinde çalışmaz.

SSL/TLS Certificates bölümünde api.veniux.com için sertifika oluştur ve Hosting Settings'te HTTP→HTTPS kalıcı yönlendirmesini aç. PHP tarafında HTTPS=on iletilmeli; kullanıcı tarafından gönderilen forwarded başlıkları uygulama güvenilir saymaz.

## 2. Özel klasör ve veritabanı

Web kökü dışında `private/veniux-license` oluştur. Örnek tam yol `/var/www/vhosts/veniux.com/private/veniux-license`; kendi aboneliğinin gerçek yolunu kullan. PHP servisinin yazabilmesi gerekir; Linux izinleri tercihen 700, sahibi abonelik kullanıcısı. PHP open_basedir bu özel klasöre ve uygulama src/config dizinlerine erişimi kapsamalı. 777 verme.

Databases → ayrı boş MySQL/MariaDB veritabanı oluştur. Plesk'in eklediği ön ekler dahil tam veritabanı adını kullan. Kurulum için bu veritabanına tablo oluşturabilen bir kullanıcı; günlük kullanım için SELECT, INSERT, UPDATE, DELETE izinli ayrı kullanıcı oluştur. Root kullanma; uzak bağlantı açma.

`config/settings.example.php` dosyasını **`config/settings.php`** adıyla kopyala. Özel klasörün tam yolunu, Plesk veritabanı sunucusunu, tam veritabanı adını ve kurulum kullanıcısını yaz. Parolayı bu özel dosyada gir; sohbet, ekran görüntüsü veya komut satırı argümanı olarak paylaşma. `LICENSE_ENV=production` kalsın. Dosyayı yalnız abonelik kullanıcısı okuyabilsin. Örnek dosyada gerçek sır bulunmaz. Ortam değişkenleri verilirse bu dosyanın değerlerinden önce kullanılır.

## 3. İlk yönetici ve şema

Kurulum web üzerinden çalışmaz. Plesk SSH erişimi ya da Scheduled Tasks → Run a command gerekir; erişimin yoksa hosting desteği aşağıdaki komutu abonelik kullanıcısı olarak çalıştırmalı. Varsayılan sistem PHP'si yerine seçtiğin PHP sürümünün CLI yolunu kullan.

Özel klasörde `admin-setup.json` oluştur; içine kendi yönetici e-postanı ve 14–72 karakterlik güçlü şifreni JSON olarak yaz:

```json
{"email":"YONETICI_EPOSTAN","password":"BURAYA_GUCLU_SIFREN"}
```

Dosyayı 600 izinle tut. Linux Plesk PHP 8.3 örnek komutu (gerçek yollarını değiştirmelisin):

```sh
/opt/plesk/php/8.3/bin/php /var/www/vhosts/veniux.com/api.veniux.com/bin/setup.php < /var/www/vhosts/veniux.com/private/veniux-license/admin-setup.json
```

Scheduled Tasks kullanıyorsan bir kez Run Now çalıştır; başarılı olduktan sonra bu görevi kaldır. Başarılı kurulum mesajını görmeden tekrar çalıştırma. Başarısız kurulumda tablo/anahtar silme; MySQL DDL geri alınamadığından hedefi incele, gerekiyorsa ayrı boş hedefle tekrar başla.

Başarılı kurulunca `admin-setup.json` dosyasını sil. `settings.php` içinde hesabı günlük kullanım için hazırladığın sınırlı kullanıcıya değiştir. Kurulum hesabının DDL yetkisini kaldır. Özel imzalama anahtarını ve veritabanını güvenli, ayrı yedekle; güncelleme yaparken bu klasörün üzerine yazma.

## 4. Yayın kontrolü

- `https://api.veniux.com/health`: status ok, schema 1 dönmeli.
- Ana sayfada yönetici girişi görünmeli; seçtiğin hesapla giriş yap.
- `/config/settings.php`, `/src/core.php`, `/bin/setup.php`, `/.git/config` erişilememeli. 403/404 beklenir; sır veya kaynak görünürse yayını durdur ve web kökünü düzelt.
- HTTPS oturumu, lisans oluşturma, terminal aktivasyonu, askıya alma, yeniden etkinleştirme ve sonlandırmayı yalnız deneme lisansında doğrula.
- Gerçek MySQL üzerinde eşzamanlı terminal sınırı kabulünü ayrıca çalıştır; yerel SQLite sonucu MySQL sonucu değildir.

## 5. Masaüstü ürün bağlantısı

Paneli yüklemek kurulu Veniux programlarını otomatik bağlamaz. Ürün sunucusunda `VENIUX_LICENSE_AUTHORITY_URL=https://api.veniux.com/v1` ve `VENIUX_LICENSE_AUTHORITY_PUBLIC_KEY` ayarlanmalı. Anahtar dosyası özel klasörde üretilen **signing-public.pem** dosyasıdır; özel anahtarı ürüne verme. Dağıtımda bu açık anahtar sabitlenmeli. Önce test terminalinde aktivasyon/askıya alma kabulü yapılmalı. Merkezi kontrol etkinleşince çevrimdışı erişim açılmaz.

## Resmî kaynaklar

- [Plesk web kökü](https://docs.plesk.com/en-US/obsidian/administrator-guide/77500/)
- [Veritabanı oluşturma](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/website-databases/creating-databases.65157/)
- [PHP ayarları](https://doc.plesk.com/en-US/obsidian/administrator-guide/70742/)
- [PHP CLI çalıştırma](https://doc.plesk.com/en-US/obsidian/administrator-guide/web-hosting/php-management/running-php-scripts-from-the-command-line.76345/)

Yerel kontrol: PHP sözdizimi ve gerçek HTTP SQLite lisans kabul testleri değişiklikten sonra geçti. Canlı Plesk, DNS, HTTPS ve MySQL kabulü sunucuya erişim olmadan tamamlanmış sayılmaz.

## Tarayıcıdan tek seferlik kurulum
`public/setup.php` HTTPS üzerinde çalışır. Özel veri klasöründeki `admin-setup.json` dosyasına önceden kaydedilmiş yönetici e-postası ve 14–72 karakterlik şifre ile kimlik doğrulanır. Bu bilgiler URL'ye, loglara veya HTML'e yazılmaz. CSRF, özel oturum dizini, saatlik beş deneme sınırı ve süreçler arası dosya kilidi uygulanır. Kullanıcı ayrı boş hedefi açıkça onaylar. MySQL hedefinde tablo varsa DDL çalışmaz.

İlk DDL öncesinde `web-install.started` kalıcı kilidi yazılır: başarılı veya yarım kalan kurulum otomatik tekrarlanmaz. Başarılı işlemde kurulum JSON içeriği boşaltılır. Yarım kalan MySQL DDL geri alınmış sayılmaz; hedef korunur ve elle inceleme gerekir. Kurulum kilidini silerek körlemesine tekrar çalıştırmayın.

Doğrulama: `node api.veniux.com/bin/setup-acceptance.cjs` ayrı geçici SQLite verisiyle gerçek HTTP kurulumunu, yanlış şifreyi, CSRF reddini, yetkisiz DB yazmamasını, şifre temizliğini ve tekrar reddini test eder. Bu test canlı Plesk/MariaDB kabulü değildir. Canlı kurulum ve yönetici girişi ayrıca doğrulanmalıdır.
