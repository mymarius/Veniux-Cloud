# Veniux Cloud — ortak cihaz erişimi hazırlığı

Mimari: müşteriler aynı HTTPS uygulama adresine tarayıcıyla bağlanır. PHP tanıtım sitesi ayrıdır. Lisans otoritesi api.veniux.com ayrı kalır. Node API yalnız 127.0.0.1 dinler; dış erişim HTTPS reverse proxy üzerinden yapılır. Cihazların aynı verileri görmesi için aynı uygulama sunucusu/veritabanı kullanılmalıdır. Mevcut yerel kullanıcı verileri otomatik taşınmadı.

## Hazırlanan kaynak
- Tabletlerde sol menü 1024px altında çekmece olur; küçük ekranlarda kartlar/formlar/tablo kaydırma alanları düzenlenir.
- Web tarayıcı kimliği 128 bit rastgele, bu tarayıcı/site depolamasında kalıcıdır; yön değiştirme ve ekran boyutu kaydı değiştirmez. Gerçek donanım kimliği değildir. Gizli sekme, farklı tarayıcı veya site verilerinin silinmesi yeni cihaz kaydı gerektirir.
- Merkezi lisans etkinse web aktivasyonu varsayılan kapalıdır. Sunucuda açık VENIUX_WEB_ACCESS=1 gerekir; lisans imzası, terminal kotası, kullanıcı hesabı/firma/depo kapsamı ve 2FA korunur.
- backend/scripts/start_cloud.js Node 24+ için özel mutlak VENIUX_CLOUD_ENV dosyasını okur; üretim/MySQL/loopback/HTTPS/pinned lisans anahtarı ister. Runtime ve migration/deployment hazırlığı eksikse uygulama açılmaz. Otomatik yeni DB veya veri taşıma yoktur.
- Web modunda yalnız loopback reverse proxy güvenilir. Proxy X-Forwarded-For başlığını gerçek istemci IP'siyle yeniden oluşturmalı, dış kullanıcının başlığını aynen geçirmemelidir. CORS yalnız belirtilen HTTPS origin ve mevcut Electron file origin null içindir; wildcard yoktur.

## Canlı kurulum için gerekenler
1. Plesk Node.js desteği veya Node 24+/MySQL çalıştırabilen ayrı sunucu. PHP/MySQL hosting tek başına yeterli değildir.
2. Müşteri uygulaması için ayrı HTTPS alt alan adı (önerilen app.veniux.com; henüz oluşturulmadı).
3. Linux/Windows sunucuda bağımlılıkların ilgili platform için kurulması; Windows node_modules dizinini Linux'a kopyalamayın.
4. Ayrı, onaylı merkezi MySQL hedefi, uygulama için sınırlı hesap; mevcut migration/deployment işlemleri ve kalıcı özel anahtarlar. Root günlük kullanımda yoktur.
5. Üretim veri dizini sürüm/web kökünün dışında. JWT_SECRET (MFA şifreleme anahtarı için de gereklidir), DB şifresi ve özel anahtarlar indirilir dosya alanına konmaz.
6. HTTPS proxy/sertifika, başlatıcı/süreç yönetimi ve yedek/kurtarma kabulü. Şifreleri sohbette paylaşmayın.
7. Gerçek iPhone/Android/tablet/laptop tarayıcı testleri; barkod, yazıcı, WhatsApp QR ve ses özellikleri cihaz/tarayıcı izinlerine bağlıdır. Her cihazda harici donanım özellikleri eşit çalışıyor iddiası yoktur.

Plesk uygulama/document root ve startup file ayrımı resmi belge: https://docs.plesk.com/en-US/obsidian/customer-guide/nodejs-support.76652/

## Doğrulama
Frontend build; stabil tarayıcı kaydı/storage kapalıysa red/kimlik formatı testi; 10 web politika+auth+MFA testi geçti. Gerçek canlı cloud sunucusu kurulmadı. Telefon/tablet ekran görüntüsü ve canlı terminal kaydı bekliyor. Mevcut yerel sunucunun WEB_ACCESS ayarı açılmadı, portlar internete açılmadı. VPS/Plesk kapasite bilgisi bekleniyor.

## Plesk hazırlığı — 12 Ekim 2026
app.veniux.com oluşturuldu (domain 18), application root /cloud-app, document root /cloud-app/public, Node 24.21.0 seçildi. Ayrı boş veniu8e1_cloud veritabanı oluştu; henüz kullanıcı/şema yok. Lisans veritabanına dokunulmadı. Yetkili DNS Cloudflare (alaric/zainab), app A kaydı henüz çözülemiyor; gereken hedef 31.58.236.144. Chrome dosya URL erişimi kapalı uyarısı iki yükleme denemesinde devam etti; kullanıcı açık olduğunu bildirdi. Otomatik yükleme yapılmadı. Yerel dört aktarım dosyası .local/cloud-upload altında hazır; kaynak stage testi geçti. Dosyalar sır/müşteri DB kaydı içermez, ZIP üretilmedi. HTTPS, DB hesapları/izinleri, migration, Node bağımlılıkları ve canlı giriş henüz tamamlanmadı.

DNS yeniden kontrolünde app.veniux.com A=31.58.236.144 doğrulandı. Plesk cloud-app kökünde uygulama dosyaları hâlâ yok. Kullanıcının açık onayıyla app.veniux.com için yalnız ana alanı kapsayan Let's Encrypt HTTP-01 sertifika isteği başlatıldı; sonuç henüz bekleniyor. Wildcard/www talep edilmedi.

HTTPS tamamlandı: Let's Encrypt app.veniux.com sertifikası 10 Ocak 2027'ye kadar geçerli, otomatik yenileme ve HTTP→HTTPS yönlendirme Plesk'te doğrulandı. Sertifika doğrulaması açık normal HTTPS isteği 200/Domain Default page döndü. Bu varsayılan Plesk sayfasıdır; Veniux uygulaması çalışıyor anlamına gelmez. Uygulama dosyalarının elle yüklenmesi, bağımlılık/DB hesabı/şema ve giriş kabulü bekliyor.

## 2026-10-12 live deployment verification
- Uploaded sources staged in /cloud-app; Node 24.21.0 enabled on app.veniux.com.
- npm dependency listing passed. PUPPETEER_SKIP_DOWNLOAD=1 avoids a server Chrome download; WhatsApp browser runtime remains unverified.
- User created veniu8e1_cloud DB user restricted to cloud DB and local connections, and entered its password into Plesk application environment themselves.
- Plesk npm command environment does not inherit application custom variables. One-time preparation ran in the application runtime, then was removed from app.js after successful initialization.
- Private configuration/keys reside outside public/app release root, in /cloud-private. No secret values recorded here.
- /health returned status=ok, database=mysql, migrations=current (001-parity), target_active=true.
- Plesk public/index.html renamed to plesk-default-backup.html through File Manager. HTTPS root now opens /login with Veniux Cloud branding; verified again after restart.
- Live login screenshot: .local/cloud-live-login.jpg.
- No desktop business records, accounts, MFA keys, or local passwords copied to hosted DB. Owner account/data transfer and authenticated license workflow remain pending.
- Browser viewport override did not apply (reported 1920 px), so real mobile layout has NOT been verified. Override reset. Do not claim mobile device testing passed.

## 2026-10-12 Cloud AI and PHP publication preparation
- User explicitly approved transferring existing NVIDIA and Gemini API keys to the hosted Cloud application. Values added to Plesk application environment; never recorded in this report.
- Actual fixed synthetic-text Cloud probes passed: NVIDIA returned 2 bytes in 1225 ms; Gemini produced a 100194-byte RIFF/WAV in 3814 ms. Private report /cloud-private/ai-check.json; local screenshot .local/cloud-ai-verified.jpg.
- Temporary probe code removed after test. Plesk code editor textarea fill appended rather than replaced, causing a temporary duplicate declaration/startup failure; corrected with select-all/paste and server-side syntax check. Cloud login reverified after cleanup/restart.
- Existing central license gate still blocks unauthenticated visitor/speech requests with 423. No license bypass or expanded terminal allowance applied. Authenticated, licensed assistant flow remains untested until Cloud account/license activation.
- User clarified PHP destination is existing veniux.com. Disabled invalid Node.js startup on that PHP domain only; app.veniux.com Node remains enabled.
- httpdocs currently has no PHP site entry point. Prepared 18-file .local/website-source.json (801104 bytes) with Cloud login link, public canonical veniux.com and KDV-inclusive prices.
- Added stage.js --publish-website with path validation, private backup of existing matching files and index.php written last. Positive local test verified all 18 output files and backup of previous index; server syntax check passed.
- Browser upload remains blocked by extension file URL permission. User must upload website-source.json into /cloud-app, then run publication and verify live pages. PHP site not yet published; contact SMTP delivery not configured/tested.

## 2026-10-12 social link previews
- Added/extended server-visible Open Graph and Twitter summary metadata on veniux.com, app.veniux.com and api.veniux.com.
- Main PHP page keeps route-specific titles/descriptions/canonical URLs; Cloud and license portal use fixed public product summaries without account/license details.
- Uses existing public PNG logo (1254x1254) for compact branded thumbnails; image loads successfully over HTTPS. Existing social.png is actually a JPEG screenshot, so new metadata does not use that asset.
- Published main httpdocs/index.php, Cloud frontend/dist/index.html and license src/views.php. Future source frontend/index.html also updated.
- Read-only DOM checks confirmed all three live og:title, og:description/image and twitter:card values. No Discord/WhatsApp message was sent; external platform rendering/cache not directly tested.
