# Windows kurulum tasarımı 2.4.34 — 16 Ekim 2026

Kullanıcının görüntüsü gerçek önizlemede üç sorunu doğruladı: marka bitmap'i doğal boyutunda yüklenerek sol sütundan taşıyordu; Windows temalı radyo düğmeleri koyu zeminde siyah yazıyordu; başlıktaki ve iç köşedeki varsayılan NSIS ikonları Veniux kimliğine uymuyordu.

## Değişen dosyalar

- `desktop/installer.nsh`: bitmap kontrolün gerçek ölçülerine göre yüklenir. Form açık F7F9FC yüzey, koyu metin ve mavi aksan kullanır. Gerçek Windows düğmeleri klavye odağı ve erişilebilir adlarını koruyarak yüksek çözünürlüklü ortak yüzeylerle gösterilir. Başlat, tamamla, değiştir ve vazgeç yüzeyleri eklendi. Ürün ICO'su kullanılır. Güncelleme motoru, sessiz kurulum ve lisans akışı değiştirilmez.
- `desktop/installer/build_artwork.py`: NSIS'in kendi modern UI şablonundaki kontrol kimlikleri korunarak büyük pencere kaynakları üretilir. MUI tarafından otomatik boyutlandırılıp iç köşede beliren 1039 ikon kontrolü kaldırılır. Alt düğmeler sağa hizalanır. Özgün Veniux marka paneli ve dört düğme bitmap'i üretilir; Lunar Client görselleri/kodu kullanılmaz.
- `desktop/installer/veniux-ui.exe`, `brand-panel.bmp`, `brand-panel.png`, `button-*.bmp`: derleme kaynaklarıdır; ayrı bir kurulum uygulaması veya çalışma zamanı eklemezler.
- `desktop/installer/directory.nsh`: yeni klasörleri oluşturmadan tam yol normalizasyonu. Göreli yol reddi; sürücü/genel klasör altında ürün alt klasörü; sondaki ters bölü işaretinde yinelenen ürün adı önleme; mevcut özel kurulum klasörünü koruma.
- `desktop/electron-builder.config.js`: klasör seçimi özel ilk ekrana alındığı için tekrarlanan standart directory sayfası kapalı. Mevcut NSIS kurulum/kaldırma motoru korunur.
- `desktop/package.json`, `desktop/package-lock.json`, `frontend/src/data/programRelease.json`: 2.4.34 ve program içi gerçek değişiklik notları.
- `frontend/dist`: kaynaklardan yeniden derlendi.

## Kontroller

- Masaüstü bağlantı, ilk kurulum tercihi, özel anahtar sınırları ve baskı güvenliği testleri: 15/15.
- Gerçek NSIS kodunu çalıştıran sessiz yol testi: 8/8. Kök sürücü, yeni klasör, ürün klasörü, sondaki ters bölü, göreli yol, sürücüye göreli yol, boş yol ve `..` normalizasyonu. Test yalnız değişkenleri hesaplar; uygulama, kayıt defteri veya veritabanı kurulmaz. Test dosyası: `.local/installer-directory-tests.nsi`.
- Yeni klasör için NSIS `GetFullPathName` komutunun Errors üretebildiği görüldü. Klasör oluşturmayan Windows tam yol normalizasyonuna geçilerek test tekrar çalıştırıldı ve geçti.
- NSH tasarım önizlemesi derlendi. Görsel doğrulama aracı `FrameArrived timed out` hatası verdi; daha sonraki denemede kullanıcı girdisi algılandı. Bu nedenle ekran görüntüsüyle görsel kabul tamamlanmış olarak raporlanmaz.
- Renk çiftleri hesaplanarak normal metin için 4.5:1 alt sınırı kontrol edildi. Gerçek Windows tema ve DPI görsel kontrolü ayrıca gereklidir.

## Sınırlar

Bu çalışma sırasında üretime yayın, kullanıcı uygulamasına kurulum veya üretim veritabanı değişikliği yapılmaz. Windows imza sertifikası hâlâ yoktur; SmartScreen uyarısının kalktığı iddia edilmez. Önizleme başarılı paket/kurulum güvenliği testi yerine geçmez. Yeni paketin çalıştırılarak gerçek kurulum, güncelleme, kaldırma ve farklı DPI görsel kabulü ayrıca tamamlanmalıdır.

## Son paket sonucu

İlk tam paket derlemesinde `StdUtils::TestParameter` eklentisi özel fonksiyonlar derlenirken henüz kaydedilmemişti. Fonksiyonlar electron-builder eklenti kayıtlarından sonra açılan makroya taşındı; kaynak dizini sabit tanımlandı. Önizleme ve tam Windows kurulum derlemesi tekrar başarıyla tamamlandı (çıkış 0).

Dosya: `.local/desktop-installer-2.4.34/Veniux-Setup-2.4.34.exe`, 195882466 bayt. Paket içi uygulama sürümü 2.4.34; beş UI giriş varlığı güncel derlemeyle bayt eşleşmesiyle doğrulandı. EXE SHA-512 değeri üretilmiş `latest.yml` ile eşleşir. Kanıt: `.local/installer-2.4.34-verification.json`. Paket imzasızdır ve bu çalışma sırasında canlı kanala yüklenmedi.

Native kaynak yerleşim kontrolü de geçti: marka sütunu ile form örtüşmez; alt düğmeler içerik alanının dışında; iç köşedeki 1039 varsayılan ikon kontrolü kaynakta yoktur. Bu yapısal kontrol, gerçek ekran görüntüsüyle görsel kabulün yerine geçmez.
