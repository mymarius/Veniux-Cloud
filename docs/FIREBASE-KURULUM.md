# Firebase (FCM) kurulumu: uygulama kapalıyken bildirim

Bu adımları **Google hesabınızla** siz yaparsınız. Anahtarları (özellikle hizmet hesabı dosyasını) kimseyle paylaşmayın, sohbete yapıştırmayın.

## 1. Proje ve Android uygulaması
1. https://console.firebase.google.com adresinde **Proje ekle**. Ad: `Veniux`. Google Analytics gerekmez, kapatın.
2. Proje ana sayfasında **Android** simgesine dokunun (uygulama ekle).
   - **Android paket adı:** `com.veniux.companion` (tam olarak bu, harf büyüklüğü dahil)
   - Takma ad: `Veniux Android`. SHA-1 isteğe bağlı, boş bırakın.
3. **`google-services.json` dosyasını indirin.** Bu dosyayı şu konuma koyun:
   `C:\Users\mymarius\Desktop\veniux.com\.local\firebase\google-services.json`
   (Klasör yoksa oluşturun. `.local` depoya girmez.)
   Bu dosya gizli anahtar içermez, istemci kimlik bilgileridir. Yine de paylaşmayın.
4. Sihirbazın sonraki adımlarını (Gradle/SDK ekleme) atlayın, bizim derleme sistemimiz bunu zaten yapıyor.

## 2. Sunucu anahtarı (hizmet hesabı) — GİZLİ
1. Firebase konsolunda **Proje ayarları (dişli) → Hizmet hesapları → Yeni özel anahtar oluştur → Anahtar oluştur**. Bir `.json` dosyası iner.
2. **Cloud Messaging API (V1)** etkin olmalı: **Proje ayarları → Cloud Messaging** sekmesinde "Cloud Messaging API (V1)" yazısı **Etkin** görünmeli. Devre dışıysa üç noktadan etkinleştirin.
3. Plesk → app.veniux.com → **Dosyalar (Files)**: web kökünün (`/cloud-app/public`) **dışında**, örn. `/cloud-app-secrets/` adında yeni bir klasör oluşturup `fcm-service-account.json` adıyla yükleyin. Dosya izni yalnız sahibine açık olsun (600).
4. Plesk → app.veniux.com → **Node.js → Environment** (ortam değişkenleri) → ekleyin:
   - Ad: `FCM_SERVICE_ACCOUNT_FILE`
   - Değer: dosyanın **tam yolu** (Dosyalar ekranında klasörün üstünde görünen yol + dosya adı)
5. **Restart App**. Doğrulama: oturum açmış bir tarayıcıdan `https://app.veniux.com/api/push/fcm` → `{"configured":true}`.

## 3. Telefon tarafı (Xiaomi / HyperOS)
Xiaomi, arka plandaki uygulamaları kapatabilir. Bildirimlerin gelmesi için:
- Ayarlar → Uygulamalar → Veniux → **Otomatik başlat: açık**
- Ayarlar → Pil → Veniux → **Kısıtlama yok**
- Ayarlar → Bildirimler → Veniux → **Stok uyarıları** kanalı açık, önem derecesi yüksek.

## Sorun giderme
- `configured:false`: ortam değişkeni yanlış, dosya okunamıyor ya da JSON bozuk. Yol ve izin kontrol edilir.
- Bildirim geliyor ama uygulama açılmıyor: uygulamayı yeni sürüme güncellediğinizden emin olun.
- Hiç bildirim gelmiyor ve `configured:true`: Google Play Hizmetleri olmayan telefon olabilir (FCM yalnız Google Play Hizmetleri olan cihazlarda çalışır).
