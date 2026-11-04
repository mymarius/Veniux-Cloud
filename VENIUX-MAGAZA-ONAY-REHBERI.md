# Veniux mağaza yayını ve yayıncı doğrulaması

14 Ekim 2026 — 2.4.20 sürümü

## Mevcut durum

Windows EXE ve Android APK siteden dağıtılır. Google Play veya Microsoft Store onayı henüz alınmamıştır. Windows kurulum dosyasında güvenilir yayıncı sertifikası yoktur. Android APK imzalıdır; bu imza Google Play onayı anlamına gelmez.

## Google Play için yapılacaklar

1. Kendi kimliğinizle Play Console geliştirici hesabı açın. Google kimlik doğrulaması ve tek seferlik 25 ABD doları kayıt ücreti uygular. Hesap parolasını paylaşmayın. [Hesap açma](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
2. Play için ayrı AAB paketi hazırlayın. Şu anki website APK paketi target API 35 kullanır; yeni Play gönderimleri API 36 veya üstü gerektirir. Hedef sürüm değişikliği gerçek cihazlarda test edilmelidir. [API gereksinimi](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
3. Play paketinde APK indiren kurulum/güncelleme akışını ve REQUEST_INSTALL_PACKAGES iznini çıkarın. Güncellemeler Play üzerinden dağıtılmalıdır. Siteden dağıtılan APK için mevcut akış ayrı tutulabilir. [İzin politikası](https://support.google.com/googleplay/android-developer/answer/16558241?hl=en)
4. Play App Signing ve güvenli upload key oluşturun. Mevcut APK ile Play imzasının uyumunu planlayın; farklı sertifikayla mevcut kurulumun üstüne güncelleme yapılamaz. [Uygulama imzalama](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)
5. Mağaza açıklaması, logo, telefon/tablet ekran görüntüleri, destek adresi, gizlilik politikası, veri güvenliği beyanı ve içerik derecelendirmesini gerçek uygulama davranışına göre tamamlayın. Hesap açma sunuluyorsa hesap silme gerekliliklerini uygulayın. AI hizmetlerine hangi verilerin gönderildiğini beyan edin; gereksiz izinleri kaldırın.
6. Google incelemesi için yalnız örnek veri içeren ayrı test işletmesi, sınırlı test hesabı ve geçerli test lisansı sağlayın. Sahip hesabınızı, gerçek müşteri verilerinizi veya MFA sırlarını vermeyin. İnceleme sırasında lisans zorunluluğu korunur.
7. Yeni kişisel geliştirici hesaplarında üretim erişimi öncesinde en az 12 test kullanıcısının kesintisiz 14 gün katıldığı kapalı test gerekir. Test raporu ve üretim erişimi başvurusu sonrasında Google değerlendirme yapar. [Test koşulları](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

Onayı Google verir; teknik hazırlık kabul garantisi değildir. Mevcut APK henüz Play gönderimine hazır değildir.

## Windows için iki seçenek

- **Microsoft Store:** MSIX paketini ve mağaza başvurusunu hazırlayıp incelemeye gönderin. Store, dağıttığı MSIX paketini imzalar. EXE/MSI dağıtımında yayıncı imzası ayrıca gerekir.
- **Siteden EXE dağıtımı:** Doğrulanmış kimliğinizle güvenilir bir sertifika otoritesinden kod imzalama sertifikası veya uygun Microsoft imzalama hizmeti edinin. Uygulama, kurulum ve güncelleme dosyalarını aynı yayıncı kimliğiyle zaman damgalı imzalayın. Özel anahtar sunucuya veya uygulama paketlerine konulmamalıdır.

[Microsoft imzalama seçenekleri](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)

Kod imzası yayıncının kimliğini ve dosyanın bütünlüğünü doğrular. Yeni dosyalarda SmartScreen itibarı henüz oluşmamış olabilir; tüm uyarıların hemen kaybolacağı söylenemez. [SmartScreen açıklaması](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)

## Başvuru öncesi kontrol

Gerçek Android telefon/tablet testleri; lisans aktivasyonu, süresi dolma ve iptal; QR bağlantısı; bulut oturumu; barkod kamera izni; güncelleme; veri kaybı olmadan yeniden kurulum; erişilebilirlik; hesap silme; gizlilik beyanı ve izinler tamamlanmalıdır. İmza ve mağaza hesabı olmadan “Google/Microsoft onaylı” ibaresi yayımlanmayacaktır.
