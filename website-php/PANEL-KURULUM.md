# Veniux yönetim ve müşteri paneli · kurulum

Panel, sitenin içinde çalışır: yönetim `/yonetim`, müşteri paneli `/panel`. Kod `panel-core/` klasöründedir.

## 1. Dosyaları yükleyin
Zip içeriğini sitenin web köküne açın (mevcut site dosyalarının üzerine). `.htaccess` dosyasının da yüklendiğinden emin olun; `panel-core/` ve `panel-bin/` klasörlerine doğrudan erişimi kapatır.

Gereksinimler: PHP 8.1+ (pdo_mysql, curl, openssl, mbstring), MySQL 8.0.13+ veya MariaDB 10.2+, HTTPS.

## 2. Veritabanı
Boş bir veritabanı ve kullanıcı oluşturun (utf8mb4). Bağlantı bilgisini **web kökünün dışındaki** şu dosyaya yazın:

`<web kökünün bir üstü>/.local/veniux-panel/database.php`

```php
<?php
return ['host'=>'localhost','port'=>3306,'name'=>'veniux_panel','user'=>'veniux','pass'=>'GÜÇLÜ-ŞİFRE'];
```

Alternatif: ortam değişkenleri `VENIUX_DB_HOST`, `VENIUX_DB_PORT`, `VENIUX_DB_NAME`, `VENIUX_DB_USER`, `VENIUX_DB_PASS`.

Tablolar ilk açılışta kendiliğinden oluşur ve güncellenir (şema sürümü 3). Paketler `plans.json` dosyasından yüklenir.

Aynı `.local/veniux-panel/` klasöründe `secret.key` dosyası oluşur: ödeme ve SMTP anahtarlarını şifreler. **Bu dosyayı yedekleyin**; kaybolursa kayıtlı anahtarları yeniden girmeniz gerekir.

## 3. İlk yönetici
Sunucuda (SSH) site kökünde:

```
php panel-bin/panel-admin.php siz@alanadiniz.com "Ad Soyad" yonetici
```

Şifre sorulur (en az 12 karakter). Giriş: `https://alanadiniz.com/yonetim/giris`

## 4. Zamanlanmış görev (cron) — saatte bir
```
0 * * * * php /tam/yol/panel-bin/panel-cron.php
```
Yenileme faturaları, süresi dolan lisanslar, ödeme ve lisans hatırlatmaları ve başarısız bildirimlerin yeniden denenmesi buna bağlıdır.

## 5. Yönetim panelinden ayarlar
- **Sistem → Ayarlar:** firma bilgileri, KDV, fatura öneki, banka hesapları (IBAN).
- **Finans → Ödeme yöntemleri:** iyzico ve PayTR anahtarları. Önce test/sandbox modunda "Kaydet ve bağlantıyı test et".
  - **PayTR:** Mağaza Paneli → Destek & Kurulum → Ayarlar → **Bildirim URL** = `https://alanadiniz.com/odeme/paytr/bildirim`
  - "Sitenin herkese açık adresi" alanı doğru alan adını göstermeli.
- **Sistem → Bildirimler:** SMTP ve WhatsApp (whatsapp-mail-service adresi + API anahtarı), yönetici e-posta/telefonları, hatırlatma günleri, şablonlar. Her kanalda test gönderimi yapın.

## 6. Demo verisi
Demo hesap betiği (`panel-demo.php`) güvenlik nedeniyle bu yayın paketine konmadı; yalnız yerel geliştirme ortamında kullanılır.

## Notlar
- Müşteriler sitedeki `/giris` ve `/kayit` hesaplarıyla panele girer; eski `/hesap` ve `/indir` adresleri yeni panele yönlenir.
- Kart bilgisi sunucuya gelmez (iyzico ödeme sayfası, PayTR iframe). Kartla ödeme onaylanınca fatura ödenir ve lisans kendiliğinden açılır/uzar.
- Güvenlik duvarında tek istisna: `/odeme/iyzico/donus` adresine iyzico'dan gelen yönlendirme; sonuç sunucudan iyzico'ya sorularak doğrulanır.
