# Windows ve Android sürüm arşivi

Kapsam: yerel bitmiş Veniux dağıtım paketlerini sürüm bazında yayımlamak. Kaynak arşivleri, imza anahtarları, SDK, ara APK/EXE dosyaları ve iş verileri dağıtım kapsamına alınmadı.

## Envanter ve doğrulama

- 26 Windows, 24 Android paketi; toplam yaklaşık 4,86 GiB. Sürüm aralıklarındaki eksikler için paket veya tarih üretilmedi.
- 24 APK'nın imzaları doğrulandı; aynı imzalayan sertifika kullanılıyor. Bu kontrol gerçek Android cihaz testi yerine geçmez.
- Paket kaynaklarında belirli kimlik bilgisi desenleri ve belirgin özel dosyalar tarandı. Bu tarama bütün eski sürümlere kapsamlı güvenlik onayı değildir.
- Windows 2.4.38 ve Android 2.4.32 güncel indirme kanalıdır. Windows paketleri imzasızdır.
- Windows 2.4.34–37, sorunlu özel kurulum denemesi uyarısıyla tarihsel arşivde yer alır.
- 2.4.13 yerel Windows paketi, sunucudaki aynı numaralı önceki paketten 2.012 bayt farklıdır. Mevcut dosya korunur; yerel paket SHA-256 başlangıcı içeren ayrı dosya adına yüklenir. Güncel manifest değiştirilmez.
- Android 2.4.31 için de aynı numaralı sunucu paketinin özeti farklıdır. Aynı ayrı dosya politikası uygulanır; sunucudaki önceki paket değiştirilmez.
- Aktarım FTPS üzerinden geçici dosyaya yapılır. Tam boyut ve SHA-256 kontrolünden sonra dosya son adına taşınır. Ayrıca herkese açık HTTPS indirmesinin tamamı yeniden özetlenir.

## Değişen kaynaklar

- `website-php/release-archive.php`: özel katalog okuma, sürüm/platform/dosya/özet doğrulaması ve semantik sıralama.
- `website-php/release-archive-view.php`: sürümlere göre Windows/Android indirme listesi, boyut, uyarı ve SHA-256.
- `website-php/assets/release-archive-v1.css`: mobil taşma ve uzun dosya adı/özet düzeni.
- `website-php/accounts.php`: mevcut hesap kontrolü korunarak `surum` parametresiyle arşiv indirmesi. Geçersiz sürüm 400, bulunmayan sürüm 404; güncel sürüme sessiz dönüş yok.
- `website-php/index.php`: `/surum-arsivi` sayfası ve SEO bilgileri.
- `website-php/.htaccess`: yardımcı PHP dosyalarına doğrudan erişimi engelleme.
- `website-php/footer.php`, `website-php/release-notes-view.php`: arşiv bağlantıları.
- `website-php/release-notes.php`, `website-php/release-catalog.php`: Windows 2.4.38 standart kurulum notu ve gerçek indirme sürümleri.
- `website-php/bin/release-archive-test.php`: 15 katalog/doğrulama testi.

## Yerel test sonucu

15 katalog testi ve geçici yerel sunucuda 7 indirme/kimlik doğrulama kontrolü başarılı. PHP sözdizimi kontrolleri başarılı. Mobil 390 px görünümünde 50 indirme bağlantısı bulunuyor; yatay taşma yok.

## Temizlik sınırı

Sonraki kullanıcı isteğiyle yerel temizlik ayrıca yetkilendirildi ve tamamlandı. Önceki saklama tercihi o yeni istekle değişmiştir. Güncel sonuç: `CLEANUP_2026-10-16.md`; aşağıdaki saklama bilgisi arşiv yayını anındaki tarihsel durumu açıklar.

48 eski derleme klasörü yaklaşık 22,84 GiB tutuyor. Kullanıcı “Yalnız yükle, bilgisayarda kalsın” seçeneğini verdi. Bu nedenle hiçbir yerel derleme klasörü silinmez; kaynak kodu, anahtarlar ve veriler de korunur. Aktarım raporları `.local/release-archive-upload-results.json` ve `.local/release-archive-http-verification.json` dosyalarındadır; bunlar yayımlanan siteye dahil değildir.

## Bu aşamadaki yayın durumu

Windows 2.4.38 güncel paketi ve otomatik güncelleme kaydı canlıda doğrulandı. 50 paketin tamamı FTPS üzerinden doğrulandı; herkese açık HTTPS indirmelerinin tamamında boyut ve SHA-256 kontrolü başarılıdır. `/surum-arsivi` sayfası canlıda 200 döner; 26 Windows ve 24 Android bağlantısı, güncel sürümler, CSS, güncelleme notları ve sitemap doğrulandı. Hesapsız arşiv indirmeleri giriş sayfasına 303 yönlenir; yardımcı PHP dosyaları dışarıdan engellenir. Yerel 15 katalog ve 7 indirme/kimlik doğrulama kontrolü başarılıdır.

Yayın geri dönüş yedeği: `.local/growth-publish-backup-20261016T103640Z`. Canlı kontrol raporu: `.local/release-archive-live-verification.json`. Görsel: `.local/release-archive-published.png`. Kullanıcı tercihiyle bilgisayardaki paket ve derleme klasörleri silinmedi; disk alanı boşaltıldığı iddia edilmez. Eski sürümlerin cihaz uyumluluğu ve Windows yayıncı imzası bu arşivleme işlemiyle çözülmüş değildir.
