# yonetim.veniux.com kurulumu (yalnız Veniux sahibi)

Bu site bulut veritabanından **salt okunur** rapor çeker. Lisans işlemleri (yeni lisans, uzatma, paket/terminal değişikliği, askıya alma, sonlandırma) **lisans merkezi** veritabanına (api.veniux.com) yazılır; her işlem gerekçe ister ve denetim kaydına düşer. Giriş: e-posta + parola + 6 haneli doğrulama kodu (TOTP).

## 1. Kendi bilgisayarında sahip hesabını oluştur
```bash
php yonetim-php/bin/setup.php C:/yonetim-private-deneme
```
E-posta ve en az 14 karakterli bir parola yaz. Ekranda 32 karakterlik bir **doğrulayıcı anahtarı** çıkar; Google Authenticator / Microsoft Authenticator / Aegis uygulamasına "anahtar gir" ile ekle. Parolayı kimseyle paylaşma (ben dahil, bana yazma).
Çıkan `owner.json` dosyası parolanın **özetini** ve doğrulayıcı anahtarını içerir; sunucuya yalnız bu dosya gider.

## 2. Plesk'te alt alan adı
1. Plesk > Websites & Domains > Add Subdomain: `yonetim.veniux.com`. Belge kökü (document root): `yonetim.veniux.com/public` (aşağıdaki dosyaların `public` klasörü).
2. PHP 8.2+ (PHP-FPM), uzantılar: `pdo_mysql`, `openssl`. `display_errors=Off`.
3. SSL/TLS: bu alt alan adı için Let's Encrypt sertifikası al, HTTP→HTTPS yönlendirmesini aç.
4. DNS (Cloudflare): `yonetim` için A kaydı hosting IP'sine (veniux.com ile aynı). Cloudflare proxy açıksa SSL modu "Full (strict)".

## 3. Dosyalar
- `yonetim-php/public/` içeriğini `yonetim.veniux.com/public/`, `yonetim-php/src/` klasörünü `yonetim.veniux.com/src/` altına FTP/Plesk Dosya Yöneticisi ile yükle (`bin/` ve `tests/` sunucuya gerekmez).
- Web kökü **dışında** özel klasör oluştur: `yonetim-private` (abonelik ana dizininde, `cloud-private` yanında). İzin 700.
  - `owner.json` (1. adımda üretilen)
  - `db.json`: `{"dsn":"mysql:host=localhost;dbname=veniu8e1_app;charset=utf8mb4","user":"<SALT-OKUNUR-KULLANICI>","password":"<PAROLA>"}`
  - `app.json`: `{"cloud_health_url":"https://app.veniux.com/health"}`

## 4. Salt okunur veritabanı kullanıcısı (Plesk > Databases > veniu8e1_app > User Management)
Yeni kullanıcı oluştur (örn. `veniu8e1_okuma`), yalnız **SELECT** yetkisi (Plesk'te "Read-only" seçeneği ya da phpMyAdmin'de `GRANT SELECT ON veniu8e1_app.* TO ...`). Bulut uygulamasının kullanıcısını (`veniu8e1_appuser`) **kullanma**.

## 4b. Lisans merkezi veritabanı kullanıcısı (yazma yetkisi sınırlı)
Plesk > Databases > `veniu8e1_authority` > User Management: yeni kullanıcı (örn. `veniu8e1_yonetim`). phpMyAdmin > SQL ile yalnız şu yetkileri ver (kendi kullanıcı adını yaz):
```sql
GRANT SELECT ON veniu8e1_authority.* TO 'veniu8e1_yonetim'@'localhost';
GRANT INSERT, UPDATE ON veniu8e1_authority.licenses TO 'veniu8e1_yonetim'@'localhost';
GRANT UPDATE ON veniu8e1_authority.devices TO 'veniu8e1_yonetim'@'localhost';
GRANT INSERT ON veniu8e1_authority.audit TO 'veniu8e1_yonetim'@'localhost';
```
(Üçüncü satırdaki kullanıcı adını diğerleriyle aynı yaz.) Sonra özel klasöre `authority.json`: `{"dsn":"mysql:host=localhost;dbname=veniu8e1_authority;charset=utf8mb4","user":"veniu8e1_yonetim","password":"<PAROLA>"}`. Lisans merkezi kullanıcısını (api.veniux.com'un kendi hesabı) **kullanma**.

## 5. Kontrol
`https://yonetim.veniux.com/giris` açılır; hatalı kod/parola 401 verir; 5 hatadan sonra 15 dakika engel; giriş sonrası Pano görünür; Lisanslar sayfasında lisans merkezindeki kayıtlar listelenir. `/` girişsiz açılmaz.

## Güvenlik özeti
Parola Argon2id, TOTP tek kullanımlık (aynı kod iki kez geçmez), oturum 30 dk boşta / 8 saat mutlak, çerez Secure+HttpOnly+SameSite=Strict, CSRF, katı CSP (betik yok), arama motoru ve önbellek kapalı. İsteğe bağlı IP kısıtı: `owner.json` içine `"allowed_ips": ["1.2.3.4"]`.
