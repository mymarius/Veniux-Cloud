# Veniux Cloud — iki aşamalı doğrulama

Kurulum: Sistem Ayarları → Güvenlik → İki aşamalı doğrulama → mevcut parola → Kurulumu başlat → doğrulama uygulamasında QR okut → altı haneli kodu doğrula. Onaydan sonra 10 kurtarma kodunu güvenli saklayıp yeniden giriş yapın. Parola sonrası ikinci kod istenir. Kapatmak için parola ve uygulama/kurtarma kodu gerekir.

TOTP: SHA1, 6 hane, 30 saniye, ±1 adım. Kullanılmış zaman adımı yeniden kabul edilmez. Kurtarma kodları tek kullanımlı, 80 bit rastgele ve HMAC özetlidir. Beş hatalı ikinci koddan sonra hesap başına 5 dakika bekleme; ayrıca uç nokta oran sınırları bulunur. Kurulum 10 dakika geçerlidir.

Kalıcı MFA durumu mevcut workspace_collections tablosunda auth_private kapsamı ve mfa:userId adı altında saklanır. Genel workspace API yalnız izinli iş kapsamlarını ve workspace adını kabul eder. Yeni DDL/migration veya başlangıçta şema değiştirme yoktur. Durum AES-256-GCM ile şifrelenir; anahtar JWT_SECRET'ten ayrı amaç etiketiyle türetilir, kullanıcı/firma AAD ile bağlanır. JWT_SECRET kaybı/değişimi MFA verilerinin çözülmesini engeller; güvenli kurtarma planında bu sır korunmalıdır. QR ve kurtarma kodları kişisel kurulum ekranında gösterilir, loglanmaz.

Etkinleştirme/kapatma session_version artırır, önceki oturumları geçersiz kılar. Mevcut hesaplarda özellik kullanıcı onayıyla etkinleşir; hiçbir gerçek hesap otomatik değiştirilmedi. Sunucu/firma/lisans erişim kuralları korunur. SQLite transaction ve MySQL yazma mutex'i eşzamanlı doğrulama/kurtarma kullanımını seri hale getirir.

Çalıştırılan: 8 SQLite auth/MFA testi (RFC vektörü, şifreleme/AAD, gerçek API, yanlış parola, sadece parola girişi, oturum iptali, eşzamanlı TOTP tekrar kullanımı, kurtarma kodu tekrar kullanımı, kapatma); ayrı yeni MariaDB hedefinde gerçek HTTP kurulum/giriş/eşzamanlı tekrar/kurtarma/şifreli saklama testi geçti.

Bekleyen: gerçek telefonda QR eşleştirmesi, kullanıcı arayüzünden giriş ve görsel kabul. Bu özellik PHP api.veniux.com yönetici girişine uygulanmadı; yalnız Veniux Cloud program hesabını kapsar.

Tam SQLite regresyon: 71 suite, 635 test geçti. Frontend derlemesi geçti. Dört sunucu dosyası ve 104 arayüz dosyası kurulu programa geri alınabilir kaynak yedeğiyle uygulanıp eşleşmesi doğrulandı. Yeni installer üretilmedi; yeniden başlatma ve kullanıcı QR kabulü bekliyor.
