# Standart Windows kurulumuna dönüş — 16 Ekim 2026

Kullanıcının talebiyle özel kurulum bütünüyle dağıtımdan kaldırıldı. Yeni arayüz veya resimli sihirbaz eklenmedi.

## Dosyalar

- `desktop/electron-builder.config.js`: `include: installer.nsh` kaldırıldı; `allowToChangeInstallationDirectory: true`. electron-builder'ın standart NSIS klasör, ilerleme ve tamamlanma sayfaları kullanılır. Uygulama ICO'su, mevcut kaldırma/güncelleme motoru ve kullanıcı verisini koruyan ayarlar durur.
- `desktop/installer.nsh` ve `desktop/installer/`: özel sayfalar, bitmap yüzeyler, dekoratif ürün sahnesi, kart çizimleri, özel kontroller, özel klasör normalizasyonu ve UI üreteçleri silindi. Eski raporlar ve önceki yerel paketler tarihsel kayıt olarak tutulur; yeni paket bunları kullanmaz.
- `desktop/main.js`: kayıtlı hedefi olmayan yeni kurulumda eski kurulum modu bulunmuyorsa uygulamanın mevcut `DesktopSetup` ekranı açılır. Yerel/HTTPS seçimi bu ekranda yapılır. Var olan `server-selection.json` üzerine yazılmaz; önceki `managed`/`external` kurulum dosyalarının okunması yalnız geriye uyumluluk içindir.
- `desktop/package.json`, `desktop/package-lock.json`, `frontend/src/data/programRelease.json`, `frontend/dist`: 2.4.38 ve standart kurulum dönüş notu.

## Doğrulama ve sınırlar

15 masaüstü regresyon testi başarılıdır. Yeni dağıtım yapılandırmasında hiçbir özel NSIS include veya UI kaynağı yoktur. Klasör seçimi ve düğmeler NSIS'in standart kontrolleridir. Önceki 9 özel UI testi kaldırılan arayüze aittir; bu sürüm için başarılı sayılmaz.

Üretim veritabanı ve canlı indirme kanalı değiştirilmez. Paket imzasızdır; Windows imza/SmartScreen durumunda değişiklik iddia edilmez. Programın bu bilgisayara kurulması veya kullanıcı uygulamasının kapatılması yapılmaz.

Tam standart Windows paketi derlendi (çıkış 0): `.local/desktop-installer-2.4.38/Veniux-Setup-2.4.38.exe`. EXE SHA-512 değeri `latest.yml` ile, uygulama sürümü 2.4.38 ile, beş UI giriş varlığı güncel derleme ile doğrulandı. Paket içi main.js yeni kurulum bağlantı kapısını içerir. Kanıt: `.local/installer-2.4.38-verification.json`. Standart NSIS yapılandırması ayrıca kontrol edildi: oneClick false, klasör seçimi açık, özel include/script yok, özel kaynak dosyaları yok.
