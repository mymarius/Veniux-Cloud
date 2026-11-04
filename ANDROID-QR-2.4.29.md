# Android QR deneyimi — 2.4.29

QR eşleştirme ekranı artık yerel Android kamera görünümünü koruyan ayrı bir QrScannerScreen bileşenidir. Tam ekran orantılı kamera önizlemesi, karartılmış çevre, mavi köşeler ve turuncu marka vurgusu içerir. Arka kamera seçilir; destek varsa sürekli odak ve fener kullanılabilir. Telefon döndürüldüğünde ekran yeniden kurulur, yatayda kontroller sağa geçer. Ekran çentiği ve sistem çubukları hesaba katılır. Erişilebilir kontroller en az 48dp'dir.

Yardım, elle giriş ve geri dönüş erişilebilirdir. Elle giriş doğrudan açık kod alanına döner. Yanlış eşleştirme QR kodu sessizce yok sayılmaz; açıklama gösterilir. Başarılı yerel kod doğrulamasında destekleyen cihazlarda dokunsal geri bildirim verilir. Bu, sunucu oturumunun başarıyla kurulduğu iddiası değildir; sonraki mevcut bağlantı akışı devam eder.

Kamera kareleri ağ üzerinden gönderilmez. Decode işlemi aynı anda tek görevle ve en fazla 400ms aralıkla çalışır. Eski ekran oturumlarından gelen sonuçlar reddedilir. Ekrandan ayrılınca/arka plana geçince kamera bırakılır; SurfaceHolder geri çağrıları ekran sahibiyle doğrulanır. Mevcut lisans, HTTPS ve sertifika sabitleme kuralları korunur.

Bağlantı giriş ekranında QR önceliklidir; elle kod alanı isteğe bağlı açılır. Sponsor logosu sayfanın altında kalır.

Doğrulama: javac/aapt2/dex derlemesi başarılı; APK v2/v3 imzası doğrulandı; pakette yeni yerel QR sınıfı ve bağlantı eylemi bulundu; yayımlanan 2.4.29 dosyasının boyutu ve tam SHA256 değeri yerel dosyayla eşleşti. Ek ağır arayüz veya kamera bağımlılığı eklenmedi.

Sınır: Bağlı fiziksel telefon/emülatör bulunmadığından gerçek kamera okuma, fener, cihaz yönü ve yerel eşleştirme uçtan uca cihaz üzerinde denenmedi. Telefon uygulaması bu bilgisayardan kurulmadı. Değişiklik yalnız Android QR eşleştirme ve bağlantı giriş ekranlarına aittir; uygulamanın tüm iş ekranları yeniden tasarlanmadı.
