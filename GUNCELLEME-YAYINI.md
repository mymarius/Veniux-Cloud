# Merkezi program güncellemeleri

Güncelleme kontrolü Windows ve Android 2.4.11 sürümlerinde başlar. Eski sürümler bir kez veniux.com/indir üzerinden yeni paketle güncellenmelidir. Uygulamayı kaldırmak gerekmez.

## Yönetici ekranından yayın

1. Programın Sürüm yönetimi bölümünde sahip hesabı şifresiyle yayın oturumunu açın. Yetki bir saat geçerlidir; şifre saklanmaz. Süre dolarsa bu bölümü yeniden açıp yayın oturumunu yenileyin.
2. Windows için yeni derlemenin EXE, EXE.blockmap ve latest.yml dosyalarını seçin.
3. Android için aynı imza anahtarıyla hazırlanmış yeni APK ve derlemenin android.json dosyasını seçin.
4. Kontrol onayını işaretleyip yükleyin. Kurulum dosyaları önce, sürüm bilgileri sonra yüklenir. Her platformun sürümü ayrı yayımlanır.

Büyük kurulum dosyaları 4 MB parçalarla taşınır; parçalar sırayla tamamlanmadan dosya indirmeye açılmaz. Yarım yüklemeler bir gün sonra yeni yayın oturumu açıldığında temizlenir. Merkezi API dosya boyutunu ve SHA512/SHA256 özetini kontrol eder. Sürüm numarası önceki sürümden büyük olmalıdır; Android sürüm kodu da artmalıdır. Yayımlanmış kurulum dosyaları aynı adla değiştirilemez. Şifreler, yayın oturumu anahtarları ve Android imza anahtarı kurulum dosyalarına konmaz.

## Kullanıcılardaki davranış

- Açık ve internete bağlı uygulamalar açılışta ve yaklaşık beş dakikada bir kontrol eder. Bu sistem kapalı uygulamaya anlık bildirim göndermez; uygulama yeniden açılınca kontrol eder.
- Windows yeni sürümü duyurur. Kullanıcı indirmeyi onaylar, ardından kaydettiği işlemlerden sonra yeniden başlatıp kurar veya program kapanınca kurulum yapılmasını seçer.
- Android yeni sürümü duyurur, APK'yı indirir; dosya özetini, uygulama kimliğini, daha yeni sürüm kodunu ve kurulu uygulamayla aynı imzayı doğrular. Android kurulum izni ve kurulum onayı kullanıcı tarafından verilir.
- veniux.com indirme bağlantıları merkezi yayımlanmış sürüm dosyalarını kullanır.
- İşletme veritabanı ve QR eşleştirme kaydı uygulama güncellemesiyle silinmez. Bilgisayar yeniden başladıktan sonra yerel mobil bağlantıyı yeniden açıp yeni QR kodu okutmak gerekebilir. Yeni sürümün veri şemasıyla uyumluluğu ayrıca derleme öncesinde kontrol edilmelidir.

## Kaynaklar ve kontroller

Merkez: api.veniux.com/src/updates.php. Yayın köprüsü: backend/src/services/updatePublisher.js. Windows istemcisi: desktop/updater.js. Android istemcisi: mobile/android/src/com/veniux/companion/MobileUpdater.java.

Yerel kontroller: API yayın yetkisi, dosya değişmezliği, özet reddi, eski sürüm reddi, gizli yayın anahtarlarının yayımlanmaması; program yönetici erişimi ve yayın köprüsü; Windows uyarı/indirme/kurulum akışı. Android APK v2/v3 imzası doğrulanır. Fiziksel telefonda kurulum ekranı ve gerçek Windows yükseltmesi bu ortamda test edilmemiştir.

13 Ekim 2026 canlı doğrulaması: Windows 202.719.762 bayt ve Android 2.778.511 bayt paketleri programın 4 MB parçalı yükleme köprüsü üzerinden yayımlandı. Windows/Android sürüm uçları 2.4.11 ile eşleşti. Siteden iki dosya tam indirildi; boyut ve SHA256 karşılaştırmaları geçti. Kayıt `.local/update-publication-check-20261013.json` konumundadır.
