# Windows / Android / bulut yayın kontrol listesi

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

## Mevcut paketler ve kaynak ayrımı

- Windows 2.4.38 EXE: **NotSigned**, yeni NSIS kurulumu bu görevde çalıştırılmadı. Unpacked resources ve asar sınırlı tarandı; EXE hash'i `package-audit.json` içinde.
- Android 2.4.32 APK: mevcut apksigner/JDK17 ile **v2 ve v3 imzası doğrulandı** (exit0, 1 signer). v1/v4 false başlı başına bu minSDK26 APK için hata diye sayılmadı. Publisher/Store kimliği, kurulu eski APK ile aynı imza/upgrade ve gerçek cihaz çalışması NOT TESTED.
- `.local/production-readiness-3/source-package-drift.json`: güncel backend/src karşısında mevcut Windows kaynaklarında **11 farklı, 27 eksik dosya**. Eksiklerin bir bölümü bilinçli eski sektör dışlamasıdır; **retailCreditService, retailExternalService, retailProService, retailVatService, retailReceipt ve 031 migration** de yoktur. Son kaynak testlerinin bu eski pakette geçtiği iddia edilemez.
- Son yerel kaynak build/test sürümü: 736 API + 47 ortak test; yeni EXE/APK üretilmedi, otomatik güncelleme kanalı değiştirilmedi.

## Kabul matrisi

| Kontrol | Durum | Kanıt / zorunlu sonraki adım |
|---|---|---|
| Windows ilk yönetici, lisans ve kalıcı veri dizini | Yazılım testi PASS; temiz VM BLOCKED | `backend/tests/deploymentLifecycle.test.js:1`; lisans yerel PHP kabulü PASS. Temiz standart Windows hesabında EXE kur, ilk açılış ve lisansı doğrula |
| Eksik bağımlılık / XAMPP veya HTTPS | Kaynak mevcut, paketli kabul NOT TESTED | `desktop/local-server.cjs:1`; gerçek dosya/kütüphane/dizin izinlerini VM'de dene |
| Güncelleme ve eski sürüme dönüş | SQLite fixture migration/checksum/snapshot PASS; imzalı EXE/OS kabul yok | `backend/src/services/deploymentService.js:41`, `backend/src/database/migrator.js:21`; eski kod + yeni DB kör downgrade yapılmamalı |
| Kurulum/kaldırmada DB korunması | NSIS deleteAppDataOnUninstall=false kaynakta; gerçek kaldırma NOT TESTED | `desktop/electron-builder.config.js:6`; farklı app/data dizininde kur/güncelle/kaldır/yeniden kur ve hash/iş kuralı karşılaştır |
| Lisans iptal/askı/yanlış cihaz/seat yarışı | Yerel iki PHP süreç kabulü PASS | `.local/production-readiness-3/license-php.log`; üretim otorite MySQL/TLS kabulü ayrı |
| Windows imza/SmartScreen | FAIL: imzasız artefakt; SmartScreen gerçek VM NOT TESTED | İmzalı build yolu var, sertifika yok; SmartScreen'in uyarısız çalışacağı garantisi verilmez |
| Android derleme/imza | Java derlemesi PASS, APK imzası PASS | Emulator/ADB/üretici cihaz yok; kamera/tarama tuşu/permission/kesinti kabulü BLOCKED |
| Android/Windows/bulut tutarlılığı | Ortak API, mobile pairing ve tenant regresyonu PASS; çok cihaz pilotu yok | `mobile/android/src/com/veniux/companion/MainActivity.java:1`; bilgisayar pinli HTTPS veya bulut API. Yerel ve bulut DB'nin bağımsız otomatik eşitlenmesi yok |
| Geri yükleme | SQLite backup19/deployment11 PASS | Ayrı fiziksel makine/disk, kayıp anahtar, MySQL ve müşteri ölçekli restore NOT TESTED |
| Uzaktan destek | Doğrulanmış oturumlu destek/izin/sonlandırma hizmeti kanıtlanmadı | Müşteri rızası, süreli erişim, denetim izi ve sonlandırma pilot öncesi belirlenmeli; genel uzaktan erişim açılmadı |

## Açık yayın engelleri

| ID / önem | Kanıt / tekrar üretme | Çözüm |
|---|---|---|
| REL-01 P1 — kaynak/paket farklı | source-package-drift.json + SHA karşılaştırması | Temiz izinli kaynaklardan yeni sürüm; preflight + imza + clean VM + APK cihaz kabulü; kaynağı test ettik diye eski paketi güncel sayma |
| REL-02 P1 — VM/emulator yok | hardware environment.json, Windows Sandbox false, emulator_paths/adb_paths boş | Test ortamı sağla; yüklemeden fiziksel kabul varmış gibi raporlama |
| REL-03 P1 — güncellemede aktif POS işlemi kabulü yok | `desktop/updater.js:11`; autoInstallOnAppQuit=true; pending satışla OS kapanma testi yok | Paketli ortamda işlem devam ederken güncelleme/kapanma ve tekrar açılış kanıtı; riskli yaşam döngüsü değişikliği öncesi ayrı onay |
| REL-04 P0 dağıtım kapısı — güvensiz kaynak arşivi | SEC-01, kök ZIP gerçek private key ve DB içeriyor | Bu ZIP'i müşteri/hosting dağıtımına sokma; mevcut arşiv ve olası eski paylaşımlar için güvenli saklama ve rotasyon kararı |

Üretim yayını, DB migration, sertifika satın alımı, APK/EXE install veya uzaktan destek kurulumu yapılmadı. Kaynak/paket hash kayıtları bir imza veya müşteri kabul tutanağı değildir.
