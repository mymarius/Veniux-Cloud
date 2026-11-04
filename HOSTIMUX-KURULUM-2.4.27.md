# Hostimux ve kurulum seçenekleri — 2.4.27

15 Ekim 2026

Yeni etkileşimli Windows kurulumunda iki seçenek vardır:
- Otomatik kurulumla devam et: bu bilgisayardaki Veniux yerel veritabanı bileşenlerini hazırlar.
- Ayrı sunucu kullanacağım: yerel veritabanı hazırlığını atlar; ilk açılışta hazırlanmış Veniux API sunucusunun HTTPS adresini sorar.

Sunucu adresi HTTPS, kullanıcı/parola, sorgu veya farklı yol içermeyen bir adres olmalıdır. /api biçimine normalize edilir. Aynı sunucunun /health yanıtı doğrulanır; yönlendirme takip edilmez. Mevcut server-selection.json üzerine yazılmaz. Güncelleme/sessiz kurulum mevcut hedefi korur. Yeni seçenekler lisans zorunluluğunu kaldırmaz.

Hostimux sponsor kartı: Windows bağlantı kurulumu, ortak giriş ekranı, Sistem ayarları, Android bağlantı ekranı, web ana sayfa ve indirme sayfası. Gerçek sponsor logosu kullanılır. Web/React animasyonu görünür olunca başlar ve 4 saniye sonra biter; azaltılmış hareket tercihi desteklenir. Android kart açılış animasyonu sistem tercihini izler.

Sunucu satın almak Veniux API kurulumunu, işletme hesabını veya veri aktarımını otomatik tamamlamaz. Android mevcut resmi bulut veya yerel QR bağlantısını kullanır; Windows için girilen özel sunucu adresi Android'e aktarılmaz.

Yayımlanan rehber: https://veniux.com/sunucu-kurulumu
Android 2.4.27 mevcut indirme kanalına yayımlandı, tam SHA256 ve boyut doğrulandı. Telefona kurulum yapılmadı.
Windows paketinin yayıncı imzası yoktur; yerel önizleme paketi olarak hazırlanır. SmartScreen sorununun çözüldüğü iddia edilmez.

Doğrulama:
- Runtime: 11 test başarılı (hedef koruma, URL doğrulama, UTF-16 kurulum işareti dahil).
- Frontend üretim derlemesi başarılı.
- PHP sözdizimi denetimi başarılı.
- Canlı SEO denetimi: 12 sayfa, 0 hata, 0 uyarı.
- Android derleme ve APK imza doğrulaması başarılı.
- Canlı sponsor kartı 390px görünümünde yatay taşma yok.
- Yeni Windows bağlantı ekranı ve rehber modalı tarayıcı önizlemesinde kontrol edildi. Gerçek yeni bilgisayarda yerel veritabanı hazırlama testi yapılmadı.

Windows NSIS kurulum derlemesi başarılı: .local/desktop-installer-2.4.27/Veniux-Setup-2.4.27.exe. Özel ekran fonksiyonları NSIS pluginleri yüklendikten sonra derlenir. Windows paketi imzasız yerel önizlemedir; mevcut kurulu sürüme otomatik uygulanmadı.
