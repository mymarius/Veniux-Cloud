# Güncel sürüm: 2.4.16

Stok Analizi ekranı Windows ve Android için yayımlandı. Uzaktan saha/bayi erişimi henüz devrede değildir; kapsam VENIUX-UZAKTAN-SISTEM-KAPSAMI.md dosyasındadır. Aşağıdaki kayıtlar önceki sürümlerdir.

# Güncel sürüm: 2.4.15

Windows ve Android program aramasındaki ekran adresleri düzeltildi. Site tasarımı yenilendi. Ayrıntılar: VENIUX-RAKIP-KARSILASTIRMASI-2026-10-13.md. Aşağıdaki kayıtlar önceki sürümlerdir.

# Güncel sürüm: 2.4.14

Eczane modülü, arayüzleri ve ilgili API/asistan işlemleri kaldırıldı. Windows ve Android aynı genel stok/depo çalışma alanını kullanır. Mevcut işletme verileri ve Android imza kimliği korunur. Ayrıntılar: ECZANE-MODULU-KALDIRILDI.md.

# Windows ve Android dağıtımı — 13 Ekim 2026

Güncel dağıtım Windows ve Android 2.4.12'dir. Uygulama istek koruması [UYGULAMA-ISTEK-KORUMASI.md](UYGULAMA-ISTEK-KORUMASI.md) dosyasında açıklanır. Aşağıdaki bilgiler önceki yayın kayıtlarıdır.

Güncel dağıtım Windows ve Android 2.4.11'dir. Merkezi güncelleme uyarısı ve yayın ekranı [GUNCELLEME-YAYINI.md](GUNCELLEME-YAYINI.md) dosyasında açıklanır. Güncel indirme manifesti `.local/website-downloads-release-2.4.11/releases.json` konumundadır. Aşağıdaki kayıtlar önceki yayınları anlatır.

En yeni dağıtım Windows ve Android 2.4.10'dur. QR ile otomatik giriş ve güncel doğrulama [QR-OTOMATIK-GIRIS.md](QR-OTOMATIK-GIRIS.md) dosyasındadır; güncel manifest `.local/website-downloads-release-2.4.10/releases.json` konumundadır. Aşağıdaki sürüm bilgileri önceki yayın kayıtlarını açıklar.

Güncel Windows dağıtımı 2.4.9'dur; Android 2.4.8 aynı API üzerinden çalışmaya devam eder. Sahip hesabının ortak giriş düzeltmesi ve güncel doğrulama [SAHIP-HESABI-DUZELTMESI.md](SAHIP-HESABI-DUZELTMESI.md) dosyasında açıklanır. Güncel dağıtım manifesti `.local/website-downloads-release-2.4.9/releases.json` konumundadır. Aşağıdaki 2.4.8 bilgileri ilk yayın kaydıdır.

Veniux 2.4.8 iki kurulum dosyasıyla hazırlandı:

- Windows 10/11 x64: `.local/website-downloads-release-2.4.8/Veniux-Setup-2.4.8.exe`.
- Android 8 ve üzeri telefon/tablet: `.local/website-downloads-release-2.4.8/Veniux-Android-2.4.8.apk`.

Android bağımsız bir veritabanı oluşturmaz. Bilgisayardaki aynı işletme API'sine şifreli, eşleştirilmiş bağlantıyla erişir. Bilgisayar ve Veniux açık kalmalı; iki cihaz aynı yerel ağa bağlı olmalıdır. Merkezi lisans kontrolü için internet gerekir. Her cihaz lisans merkezinde terminal hakkı kullanır.

## Kullanım

1. `https://veniux.com/kayit` üzerinden indirme hesabı oluşturun; `/indir` sayfasındaki Windows veya Android dosyasını indirin.
2. Windows programını kurun. İlk yerel hazırlık için internet gerekir. Program içinde işletme hesabını oluşturup lisans merkezinden verilen VNX anahtarını etkinleştirin. HW kodu cihaz kimliğidir, lisans değildir.
3. Windows programında Ayarlar → Lisans ve plan → Mobil bağlantıyı aç adımını kullanın. Bu işlem yönetici hesabı gerektirir.
4. Android uygulamasında QR kodunu okutun veya eşleştirme kodunu yapıştırın. Bilgisayarın Wi-Fi/Ethernet adresine ait kodu seçin. İşletme kullanıcı hesabınızla giriş yapın; Android cihazındaki lisansı da etkinleştirin.
5. Windows güvenlik duvarı sorarsa yalnız özel ağ erişimine izin verin. Otomatik genel ağ/port yönlendirmesi yapılmaz.

Program kapatıldığında veya mobil bağlantı kapatıldığında eşleştirme iptal olur. Bilgisayar yeniden açıldığında mobil bağlantıyı açıp yeni QR kodunu okutun. Site indirme hesabı, programın içinde oluşturulan işletme hesabından ayrıdır; site kaydı ücretli lisansı otomatik vermez.

## Güvenlik ve doğrulama

- `app.veniux.com` Plesk'te Disabled yapıldı; Node.js uygulaması da devre dışı bırakıldı. Dosyaları `/cloud-app/web-app-backup-20261013.zip` içinde yedeklendi. Veritabanı ve özel kurulum verileri silinmedi. Cloudflare erişimi olmadığı için DNS kaydı silinmedi.
- Ana site yedeği web kökü dışında `/website-before-downloads-20261013.zip` olarak oluşturuldu. Yeni indirme dosyaları web kökü dışında `/.local/website-downloads` altında tutulur. İndirme uçları oturum gerektirir.
- Kayıt/giriş: HTTPS, CSRF, oturum kimliği yenileme, HttpOnly cookie, şifre özeti, süreçler arası kilit ve IP başına 15 dakikada 15 deneme sınırı. İndirme hesabında e-posta sahipliği doğrulaması ve şifre sıfırlama akışı henüz yoktur; işletme verilerine bu hesapla erişilmez.
- Windows API ve MySQL bağlantıları loopback üzerinde kalır. Mobil HTTPS geçidi kullanıcı açtığında 17851 portunda çalışır; özel IPv4 ağından, eşleştirme sırrıyla gelen trafiği alır. API JWT, rol, firma ve merkezi cihaz lisansı denetimleri devam eder. Mobil istemci geçit yönetimi veya runtime yönetim uçlarına erişemez.
- Android uygulaması yalnız kendi paketlenmiş arayüzünü çalıştırır; HTTP bağlantısını kabul etmez. Bilgisayar sertifikasının SHA-256 kimliği QR kodundaki değerle doğrulanır. TLS hatalarını genel olarak atlayan WebView SSL handler kullanılmaz.
- Android yüklemelerinde 20 MB, yanıt/dosya kaydetmede 30 MB sınırı vardır. Bazı iframe tabanlı önizlemeler Android paketinde kapalıdır. Dosya kaydetme Android'in belge seçicisini kullanır.
- Android APK v2/v3 imzası doğrulandı. İmzalama anahtarı ve özel parolası `.local/android-signing` altında tutulur; gelecek Android güncellemeleri için bu dizinin özel yedeğini alın. Bu dosyalar sunucuya veya müşteriye yüklenmez. APK ZXing lisans ve bildirimlerini içerir.
- Windows kurulumunda ticari kod imzalama sertifikası yapılandırılmamıştır; Windows bilinmeyen yayıncı uyarısı gösterebilir.
- Windows'a sabitlenmiş lisans açık anahtarı canlı API ile eşleşiyor: SPKI SHA-256 `804b5aa77548df1d397345b3fb7e7b5c85038012f8c2fe796c377bdf353d51d3`.
- Kayıt/giriş/CSRF ve indirme yetkisi izole HTTP testinden geçti. Merkezi lisans hataları, ziyaretçi erişimi, gizlilik ve mobil taşıma testleri geçti. Gerçek yerel TLS bağlantısında eşleştirme, sertifika kimliği, yetki başlığının iletilmesi, yabancı Origin ve yönetim yolu engeli doğrulandı.
- Canlı yayın 13 Ekim 2026 01:55 İstanbul saatinde doğrulandı: kayıt 303 ile indirmelere yönlendi, oturumlu indirme sayfası 200 verdi, çıkış 303 verdi. Windows dosyasının tamamı (201.197.613 bayt) ve Android APK'nın tamamı (3.286.080 bayt) indirildi; her iki SHA-256 değeri yerel dağıtım manifestiyle eşleşti. Büyük dosya aktarımı bellekte biriktirilmeden parça parça yapılır. Aktarımda Content-Length başlığının sunucu tarafından kaldırılabilmesi nedeniyle doğrulama gerçek bayt sayısı ve SHA-256 üzerinden yapılır.
- Fiziksel Android cihazında kamera, dosya seçici ve tüm işletme akışları henüz kabul edilmedi. Windows temiz kurulum/Android birlikte kabulü ayrıca yapılmalıdır; tüm cihazlarda üretim kabulü tamamlandı denemez.

Yapay zekâ, ses, SMS ve e-posta sağlayıcısı ayarları programdaki entegrasyonlardan yapılandırılır. Ortak sağlayıcı API anahtarları veya müşteri veritabanı parolaları kurulum dosyalarına eklenmedi.

## Kaynak ve tekrar derleme

Android kaynağı `mobile/android` altında; PowerShell 7 ile `./mobile/android/build.ps1` çalıştırılır. Google platform 35/build tools 35, Java 17 ve ZXing core 3.5.3 kullanılır. Windows dağıtımı `desktop/electron-builder.config.js` ile hazırlanır; sunuculu paket için `VENIUX_BUNDLE_SERVER=1`, `VENIUX_NODE_PATH` ve `VENIUX_RCEDIT_PATH` gerekir. Dosya boyutları ve SHA-256 değerleri `.local/website-downloads-release-2.4.8/releases.json` içindedir.
