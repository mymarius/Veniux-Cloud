# RC2 — Anahtar ve hassas kurtarma kopyası geçiş planı

19 Ekim 2026. Bu bir uygulama planıdır; mevcut anahtar veya müşteri yedeği değiştirilmedi. Uygulama ve lisans geçersiz kılma öncesinde ayrı kullanıcı onayı gerekir.

## Mevcut anahtar kullanım haritası

| Yol | İşlev / sınır |
|---|---|
| backend/src/services/licenseService.js:8–35 | LICENSE_PRIVATE_KEY_PATH veya backend/config/keys/license_private_key.pem okunur. Production eksikse fail-closed; development/test yoksa yeni yerel çift üretir. |
| Aynı dosya:154–159,407,507 | signPayload RSA-SHA256; aktivasyon ve doğrulama token'larını imzalar. verifyPayload tek açık anahtarı kullanır. Hazır çift anahtar/kid geçişi yok. |
| backend/src/controllers/licenseController.js; routes/licenseRoutes.js; controllers/webhookController.js | Lisans satın alma/aktivasyon/validasyon ve ödeme bildiriminin lisans servis yolları; plan okuyan tüm çağrılar imzalama anlamına gelmez. |
| backend/src/services/deploymentService.js:14–16,81,110–114 | İlk kurulumda ayrı yerel çift üretir; eski kurulumdan taşır; restore yollarını yeniden yazar. Bu merkezi PHP issuer anahtarı değildir. |
| backend/src/config/runtimeConfig.js:20–21 | Kalıcı özel/açık anahtar varlığı ve eşleşmesini doğrular. |
| desktop/local-server.cjs:69–74 | Yerel kalıcı keys dizinini API ortamına bağlar; install.env özel anahtarın gövdesini değil yolunu içerir, fakat JWT/DB sırları içerebilir. |
| backend/src/services/deploymentSnapshot.js:18–19 | keys ve install.env/.env düz dosya kopyası; backupService şifrelemesi burada uygulanmaz. |
| api.veniux.com/src/installation.php:24–30 | Ayrı PHP issuer dataDir/signing-private.pem oluşturur; mevcut dosyayı ezmeyi reddeder. |
| api.veniux.com/src/core.php:95 | Merkezi otorite cevabını openssl_sign ile imzalar. |
| backend/src/services/centralLicense.js:configuration,verify | Yalnız merkezi açık anahtarı okur, nonce/cihaz/zaman penceresini doğrular. Legacy özel anahtarı merkezi anahtar yerine geçirmek uyumlu değildir. |
| tools/customer-experience, hardware-lab, release-candidate | İzole sentetik RSA çiftleri; üretim lisansı değildir. |

29 kaynak referansının dosya/satır listesi `.local/release-candidate-2/security-inventory.json` içindedir. Workspace envanterinde4 özel anahtar dosya konumu görülür (legacy, business-cloud-data, desktop-backend, yerel PHP authority); içerikleri çıktılanmaz. RC1 arşiv içi aynı legacy anahtar eşleşmesi karantinada kalır. Uzak hosting, bilgisayarın bütün diskleri, şifreli/arşivlenmiş bütün container'lar ve Git geçmişi için tamlık iddiası yok. Workspace Git deposu değildir. `.gitignore` önleyici ekleri geçmişte izlenmiş sırları Git geçmişinden temizlemez.

## Kesintisiz lisans geçişi — uygulanmadı

1. Sahip, issuer ve etkilenen sürüm/lisans envanterini kapalı ortamda doğrular. Legacy ve PHP merkezi issuer ayrı risk kararları alır; Android kod imzalama anahtarı bu plana dahil edilerek rastgele değiştirilmez.
2. Yeni anahtar üretme ve saklama için ayrı onay alınır. Özel anahtar issuer'dan çıkmaz; erişim, şifreli escrow ve anahtar kaybı tatbikatı kabul edilir. Rapor/log yalnız anahtar kimliği ve olay sonucunu taşır.
3. İmza doğrulaması için güvenilir eski+yeni açık anahtar seti/kid sözleşmesi ayrı uyumluluk değişikliği olarak hazırlanır ve staging'de test edilir. Sahte kid, bilinmeyen anahtar, yanlış cihaz, zaman/nonce, replay, expiry ve iptal testleri zorunludur. Bu kod RC2'de uygulanmadı.
4. Önce uyumlu istemciler dağıtılır; hâlâ eski istemcisi bulunan müşteriler tespit edilir. Mevcut lisans süreleri/hakları korunur. Yeni issuance yeni anahtara taşınırken eski doğrulama geçici olarak sürer.
5. Hak sahibi/cihaz doğrulanarak mevcut lisanslar yeniden imzalanır. Eski lisansların geçersiz kılınmasından **hemen önce kullanıcı onayı alınır**; sessiz toplu iptal yapılmaz. Aktif istismar halinde kesintisiz geçiş ve acil iptal çelişebilir; sahip bu riski ayrıca kararlaştırır.
6. Eski issuance durdurulur; doğrulama kaldırılması müşteri geçiş kabulüne bağlanır. Rollback yeni imzaları okuyabilmeli; ele geçirilmiş özel anahtarla tekrar issuance açmamalıdır.

Kabul: tüm meşru eski test lisansları geçişte çalışır; yalnız açıkça iptal edilmiş olanlar reddedilir; geçiş eksik istemciye kör kesinti yapılmaz. Gerçek lisanslar üzerinde bu test yapılmadı.

## Şifresiz kopyalar ve şifreleme geçişi — uygulanmadı

Kaynakta kanıtlanan düz kopya üreticileri:

- deploymentSnapshot format1: database.sqlite + storage + keys + install.env/.env + hash manifest.
- deploymentService.restore: restore-UUID/before dizininde önceki DB/keys/env tutulur; veri kaybını önlemek içindir, şifreli değildir.
- Portable SQLite/MySQL export'ları sırları ayıklasa da şifreli dosya değildir; müşteri verisi barındırabilir.
- Kaynak ZIP karantinada özel anahtar ve SQLite içerir; karantina adı şifreleme değildir.

Bu tur metadata taramasında erişilebilir recovery format1 manifest0, restore-before dosyası0, .vnxsecure dosyası2 bulundu. Bu sonuç kaynakta düz kopya üretilmesini kapatmaz; müşteri AppData/uzak diskleri incelenmedi. clean.js UTF-8 çözümlenemedi; kaynak referans taramasında bu dosya eksik kaydedildi. Hiçbir müşteri DB tablosu veya PEM/env gövdesi okunmadı. `.vnxsecure` uzantısı tek başına mevcut dosyaların şifre çözme kabulü değildir.

Güvenli geçiş sırası:

1. Uygulama durdurma/bakım penceresi ve yeterli disk alanı doğrulanır. Orijinal kopyalar silinmez, üzerine yazılmaz. Erişim ACL'si ve yedek saklama yeri yetkili kişiyle doğrulanır.
2. Sürüm2 şifreli snapshot formatı tasarlanır: AES-256-GCM, her dosya/snapshot için benzersiz nonce, doğrulanmış manifest ve metadata AAD, ayrı korunan KEK/DEK/anahtar kimliği. Anahtar aynı pakette veya yedek gövdesinde tutulmaz. Windows DPAPI/servis hesabı ve farklı makine escrow çözümü birlikte değerlendirilir.
3. Yeni reader önce format1+format2 okuyabilmeli; yeni writer format2 yazmalı. Mevcut update/restore sözleşmesi, atomik staging/journal, symlink/path reddi korunur. Bu format değişikliği RC2'de yapılmadı; yeni özellik olarak gizlenmez.
4. Mevcut kopyadan ayrı `.partial` şifreli hedef oluşturulur; fsync/atomic rename sonrası yeniden açılır. GCM doğrulama, manifest dosya listesi, her dosyanın hash'i, SQLite integrity/FK ve lisans anahtarı eşleşmesi izole kopyada doğrulanır.
5. Yanlış/kayıp anahtar, bozuk tag, kesilmiş yazım, disk dolu, elektrik/süreç kesintisi ve restore başarısızlığı test edilir. İki bağımsız sağlam kopya ve farklı cihaz kurtarma kanıtı olmadan eski format kaldırılmaz.
6. Otomatik temizleme kapalı kalır. Eski düz kopyaların tutulma/silinme kararı veri sahibi tarafından ayrıca verilir; SSD/senkronizasyon geçmişinden güvenli silme garanti edilmez. Onaylı politika uygulanana kadar SEC-03 açık kalır.

Şifreli backupService ve mysqlBackupService mevcut AES-GCM dosyalarını yeni formatla karıştırma. Mevcut anahtar kaybında şifreli yedek erişilemez; escrow kurulmadan anahtar rotasyonu yapılmamalı.
