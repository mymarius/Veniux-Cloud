# Güvenlik ve lisans denetimi

> 19 Ekim RC takip: [Release Candidate 1.0](VENIUX_RELEASE_CANDIDATE_1.md). Aşağıdaki tarihsel kök ZIP artık aynı SHA256 ile `.local/security-quarantine/veniux-source-private-20261019.zip` konumundadır. Yeni NSIS payload kontrol edildi; imza ve anahtar maruziyeti/migrasyon kapanışı hâlâ engeldir. Anahtar yenilenmedi.

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

## Kritik arşiv bulgusu

**SEC-01 — P0 dağıtım engeli / dışarı sızma doğrulanmadı.** Kök `veniux.com.zip` (32.709 dosya girdisi) içinde:

- `backend/config/keys/license_private_key.pem`: crypto.createPrivateKey ile **geçerli özel anahtar**; mevcut yerel legacy anahtar dosyasıyla aynı. Paketlenen merkezi otorite açık anahtarıyla **eşleşmiyor**. Merkezi lisans imza anahtarının ele geçirildiği sonucu çıkarılamaz.
- `backend/stok_takip.db`, `backend/stok_takip_test.db`: SQLite dosya imzası doğrulandı. **Tabloları/müşteri kayıtları açılmadı**, içeriklerin test veya gerçek müşteri verisi olduğu varsayılmadı.
- `frontend/.env`, `frontend/.env.local`: dosya adları tespit edildi; sır içerdiği ayrıca kanıtlanmadı; dağıtım allowlist'i dışında tutulmalı.
- node_modules README/kod içindeki PEM örnekleri ham tarama eşleşmesidir; gerçek proje özel anahtarı bulgusuyla aynı sayılmaz.

Kanıt: `.local/production-readiness-3/archive-audit.json`, `archive-key-validation.json`; tekrar: `python tools/production-readiness/archive-audit.py`. Hiçbir anahtar/token/DB satırı rapora veya terminale yazılmadı. **Arşiv silinmedi, yüklenmedi veya yeniden yayımlanmadı.** Canlı HTTP erişimi, eski paylaşım ve indirme geçmişi test edilmedi.

Gerekli çözüm: bu arşivi dağıtım kaynağı olarak kullanmayı durdur; özel erişimli saklamaya al; daha önce gönderildiyse alıcı/konum listesini değerlendir; etkilenen legacy anahtar için mevcut lisansları bozmayan kontrollü rotasyon planı hazırla. Üretim anahtarı değişimi, lisans iptali ve müşteri verisi silme bu görevin izni dışındadır. Salt temiz ZIP üretmek geçmiş ifşayı geri almaz.

## Uygulanan korumalar ve yeniden test

`desktop/distribution-safety.cjs:3`: first-party kaynaklarda gerçek PEM özel anahtarı, SQLite dosya imzası, .env ve anahtar/veritabanı dosya adlarını reddeder. `desktop/electron-builder.config.js:24`: Windows afterPack aşamasında çalışır. Bu bir ZIP upload filtresi değildir; eski kök ZIP halen güvensizdir.

`desktop/distribution-safety.test.cjs:1`: 4 yeni test PASS — gerçek özel/public ayrımı, uzantısı değişmiş DB, gizli dosya, bozuk kaynak string'i ve dosyayı silmeden fail-closed kontrolü. Mevcut 2.4.38 unpacked resources için kontrol 340 first-party girdide geçti. node_modules içerikleri ve 4 MiB üstü dosyaların tam gövdesi bu guard kapsamı dışındadır; SBOM/SCA/zararlı yazılım taraması değildir.

## Diğer bulgular

| ID / önem / durum | Kanıt | Tekrar üretme | Çözüm / sınır |
|---|---|---|---|
| SEC-02 P1 açık — Windows yayıncı imzası yok | `windows-signature.json`: NotSigned; `desktop/electron-builder.config.js:5`; signed config ayrı | Get-AuthenticodeSignature mevcut EXE | Sertifika/Store yolu ve imzalı temiz VM kabulü; SHA256 yayıncı kimliği sağlamaz |
| SEC-03 P1 açık — deployment snapshot şifrelenmiyor | `backend/src/services/deploymentSnapshot.js:18`; DB/keys/install.env doğrudan kopya | Ayrı fixture update snapshot dosyalarını incele; 11 deployment testi davranışı doğrular, şifreleme iddiasını doğrulamaz | BackupService AES-GCM ile karıştırma. NTFS ACL/BitLocker/erişim ve anahtar escrow politikasını doğrula; formatı değiştirmek mimari onay gerektirir |
| SEC-04 P1 düzeltilmiş — gizli üst klasörde rapor indirme 404 | `backend/src/routes/aiRoutes.js:21`; önceki `run-04c2e7043cce4db7` FAIL | Testte rapor üret → dosya mevcut → kendi kullanıcıyla GET; düzeltmeden önce 404, sonra 200; anonim401/farklıtenant404 | Yalnız sunucu registry'sinden kimliği doğrulanmış kesin dosya yolu için izin; statik klasör erişimi genişletilmedi |
| SEC-05 P1 canlı kabul bekliyor — lisans paneli MFA/erişim sınırı | `api.veniux.com/README.md:20` | Üretim panelinin erişim topolojisi ve ikinci faktörü kontrol edilmedi | VPN/IP allowlist veya MFA tasarımı; Node kullanıcı MFA'sı PHP yönetim MFA'sı sayılmaz |
| SEC-06 P1 kullanılmamalı — eski compose varsayılanları | `docker-compose.yml:10`; public 5432/6379 port eşlemesi | Yalnız dosya incelemesi; container başlatılmadı | Eski örneği üretim tarifi olarak kullanma; gerçek altyapı kararı sonrası sır yöneticisi ve özel ağ |
| SEC-07 P2 açık — yerel anahtar/yedek ACL doğrulaması | `backend/src/services/backupService.js:16`; mode0600 Windows ACL garantisi değildir | Ayrı standart Windows kullanıcısıyla erişim testi NOT TESTED | DPAPI/NTFS servis hesabı ACL ve farklı diskte anahtar kurtarma tatbikatı |

## Doğrulanan güvenlik sınırları

| Alan | Sonuç / kanıt |
|---|---|
| Tenant ve rol | 92 grupta multi_tenant, authorizationOperations, access/warehouse/cost yetki regresyonları PASS; `backend/src/middlewares/authMiddleware.js:27`. Bütün olası IDOR yollarının bağımsız pentesti değildir |
| Oturum/parola | auth (6), MFA (2) ve diğer lifecycle testleri PASS; JWT doğrulamasından sonra DB status/role/session_version kontrolü; bcrypt. `backend/src/controllers/authController.js:112` |
| Merkezi lisans | Yerel iki PHP sürecinde seat yarışı, imza, yanlış cihaz, askı/iptal ve offline-denial PASS; `.local/production-readiness-3/license-php.log`. Üretim MySQL, DNS/TLS ve hesap yetkileri NOT TESTED |
| Şifreli yedek / restore | backupRecovery 19 PASS; `backend/src/services/backupService.js:20`: AES-256-GCM; rollback ve kesilmiş restore günlüğü. Portable export sırları ayıklar ama **şifreli dosya değildir**, müşteri verisi taşıyabilir |
| Migration | deploymentLifecycle 11 PASS; checksum ve daha yeni şemayla eski kodu reddetme; üretim kopyası ve MySQL migration NOT TESTED |
| Güvenli log | productionPrivacy ve AI journal testleri geniş koşuda PASS; `backend/src/middlewares/productionPrivacy.js:56`. Canlı proxy/işletim sistemi logları incelenmedi |
| Electron | `desktop/main.js:84`: nodeIntegration=false, sandbox/webSecurity=true; IPC/origin testleri mevcut; paketli OS pentesti yok |
| Android | `mobile/android/AndroidManifest.xml:7`; cleartext kapalı, pinli yerel HTTPS ve sınırlı bridge; kaynak derlemesi PASS, gerçek cihaz güvenlik kabulü yok |

## Paket taraması sınırı

`package-audit.json`: Windows unpacked resources (node_modules hariç) 331 girdilik envanter; asar 406 girdilik envanter; seçilmiş first-party kaynak klasörleri. `archive-audit.json`: APK107 ve ZIP32709 dosya girdisi. Windows/Android'de bu sınırlı kontrolde özel anahtar/SQLite bulunmadı; kök ZIP'de bulundu. EXE içindeki sıkıştırılmış payload bağımsız açılıp unpacked klasörle doğrulanmadı; EXE/APK SHA256 kaydedildi. Arbitrary hardcoded sır, bütün müşteri JSON dosyaları, bağımlılık CVE'si veya ikili analiz garantisi verilmez.
