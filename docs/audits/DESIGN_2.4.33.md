# Veniux kurulum ve sponsor tasarımı — 16 Ekim 2026

## Doğrulanan nedenler

1. `.auth-workspace aside` seçicisi giriş sayfasındaki bütün iç `aside` öğelerini, sponsor dahil, büyük marka paneli gibi boyuyordu. `desktop.css` ve `workspace-refinement.css` seçicileri doğrudan marka paneli çocuğuyla sınırlandı (`.auth-workspace > aside`).
2. Kullanıcının ikinci görseli, sitedeki `product-barcode-v2.jpg` ile aynıydı. Tam sayfa görüntüsü sabit menü ve üst çubuğu kaydırmıştı; bu görsel gerçek uygulamanın yerleşimi hakkında yanlış izlenim veriyordu. Uygulama menüsünün konumunu rastgele değiştirmek yerine normal pencere görüntüsü alındı. DOM kontrolünde menü ve başlık y=0, scrollY=0 doğrulandı. Yeni dosya `product-barcode-v3.jpg`, 1914×860 JPEG.

## Dosyalar

- `desktop/installer.nsh`: logolu özel karşılama, mavi/turuncu kimlik, Segoe UI yazı, 01/02 bağlantı seçenekleri, okunabilir açıklamalar ve sade sponsor bağlantısı. Sessiz güncelleme atlaması, mevcut sunucu tercihi ve managed/external kayıt biçimi korundu. Geri dönüldüğünde ayrı sunucu seçimi korunur.
- `frontend/src/desktop.css`, `workspace-refinement.css`: yanlış kapsamlı yan panel seçicisi düzeltildi.
- `frontend/src/components/HostingSponsor.css`: saydam, kutusuz, ortalanmış sponsor alanı; belirgin metin ve logo.
- `desktop/package.json`, `package-lock.json`, `frontend/src/data/programRelease.json`: Windows 2.4.33 sürümü ve program içi not.
- `frontend/dist`: kaynaklardan yeniden derlendi. Kurulu Dart Sass derleme yardımcısı kullanıldı; geçici önizleme için eklenen masaüstü HTML bayrağı son derlemede bulunmaz.
- `website-php/growth-pages.php`, `index.php`, `assets/product-barcode-v3.jpg`: düzeltilmiş görsel ve gerçek boyutları.
- `website-php/release-notes.php`: tasarım yayını kaydı.
- `docs/growth/SCREENSHOT_PROVENANCE.json`: yeni görüntünün SHA-256 ve kaynak kaydı.

## Kontroller ve sınırlar

Sponsor arka planı gerçek masaüstü CSS kapsamıyla `rgba(0,0,0,0)`; logo 148px, alan yüksekliği yaklaşık 82px olarak kontrol edildi. Karşılaştırma görüntüsü `.local/sponsor-design-fixed.jpg` içinde. Marka yan panelinin arka planı korunur.

15 masaüstü kurulum/bağlantı/baskı testi geçti. Paketlenmiş beş UI giriş varlığı yeni derlemeyle eşleşti. Özel NSH önizleme derlemesi başarılı; Windows erişilebilirlik ağacı logolu karşılama başlıklarını doğruladı. Windows Graphics Capture iki kez zaman aşımına uğradığından native kurulum sayfasının ekran görüntüsüyle görsel kabulü tamamlanmış sayılmadı. Bu durum kullanıcıya bildirildi; ekran görüntüsü olmayan bir mockup gerçek installer gibi sunulmadı.

Yeni Windows paketi önceki geçici imzasız yayın tercihini korur. İmza ayarı veya Windows koruması değiştirilmez. Android 2.4.32 dosyasına bu Windows düzeltmeleri aktarılmış gibi davranılmaz. Yeni bir Android yayını ayrıca paketlenmelidir. Production işletme veritabanına dokunulmadı.

Windows paket derlemesi tamamlandı: .local/desktop-installer-2.4.33/Veniux-Setup-2.4.33.exe, 195740867 bayt. Paket içi application sürümü 2.4.33 doğrulandı. Önceki EXE dosyası değiştirilmeden yeni sürüm adı kullanılır. Özel NSH karşılama sayfası ve bağlantı sayfası gerçek installer derlemesinde başarıyla derlendi.

## Yayın sonucu
Windows 2.4.33 canlı indirme/otomatik güncelleme kanalına yayımlandı. 195740867 bayt EXE tam indirilerek SHA-512 ile doğrulandı; blockmap ve latest.yml kontrol edildi. Android 2.4.32 değiştirilmeden tam SHA-256 doğrulaması geçti. Kanıt: .local/packages-published-20261016.json. Normal pencereyle alınmış ürün görseli v3 canlı HTTP 200 ve yerel dosyayla bayt eşleşmesiyle doğrulandı. Site kabul kontrolü beş konu sayfası için başarılı; SEO denetimi 15 sayfa, 0 hata, 0 uyarı.
