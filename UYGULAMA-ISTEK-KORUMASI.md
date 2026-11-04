# Uygulama istek koruması — 13 Ekim 2026

Site ve merkezi API'de istek koruması devreye alındı. Windows 2.4.12 paketinde de aynı amaçla Node.js koruması bulunur. Android istekleri bilgisayardaki korumalı API üzerinden işlenir.

## Sağlanan denetimler

- Bozuk adres kodlaması, birden fazla kez kodlanmış üst klasör erişimi, kontrol karakterleri ve gizli altyapı dosyalarına yönelik yollar reddedilir.
- Desteklenmeyen HTTP yöntemleri ve mevcut uç noktalara göre fazla büyük istekler reddedilir. İzinli güncelleme, yedek ve ürün dosyası yükleme boyutları korunur.
- Gerçek bağlantı adresine göre kısa süreli ve dakikalık istek sınırı uygulanır; istemcinin gönderdiği yönlendirme başlıkları bu sınırı aşmak için kullanılmaz. Limit aşıldığında 429 ve Retry-After yanıtı verilir.
- Site/API tarafında tarayıcının siteler arası yazma istekleri reddedilir. Mevcut CSRF, parola, kullanıcı rolü, firma/depo kapsamı ve lisans denetimleri devam eder.
- Windows API'sinde JSON prototip değişimi için kullanılan anahtarlar ve fazla derin/büyük nesne yapıları reddedilir. Normal ürün isimleri ve serbest metin SQL/saldırı kelimesi içerdiği için otomatik yasaklanmaz.
- PHP sayaçları web kökünün dışındaki özel klasörde kilitli dosyalarda tutulur. Düz IP yerine özel anahtarla türetilmiş kimlik kullanılır. Parola, QR, oturum anahtarı veya istek içeriği kaydedilmez. Disk/anahtar erişimi başarısızsa koruma sessizce kapanmaz; 503 döner.
- PHP sayaç dosyaları sabit sayıda kovayla, Node sayaçları sınırlı haritayla tutulur. Başarılı kimlik doğrulaması engellenen istek için otomatik açılmaz; süresi dolan istek penceresinde tekrar denenebilir.

## Doğrulama

PHP yol kontrolleri ve yirmi eşzamanlı PHP sürecinde beş izin/on beş ret kontrolü geçti. Node koruma testleri, normal iş verileri, sahte yönlendirme başlığı, istek penceresinin yenilenmesi, JSON alanları ve izinli dosya yükleme boyutlarını kontrol etti. Üretim sunucusunda gizli dosya isteğinin artık 404 yerine koruma katmanında 403 dönmesi test beklentisine işlendi; altı üretim/koruma testi geçti.

Tam uygulama taramasında diğer 659 test geçti; eski gizli dosya testinin 404 beklentisi yeni 403 davranışına güncellenip yeniden doğrulandı. Ayrı lisans, eşzamanlı terminal sınırı, site hesabı/CSRF ve parçalı yayın kontrolleri geçti. Canlı sitede/API'de normal sayfalar 200; saldırı yolları 403; fazla büyük istekler 413; siteler arası yazma denemeleri 403 döndü. Sayfa/SEO kontrolleri geçti.

## Sınırlar

Bu bir uygulama katmanı korumasıdır. Paketleri ağda süzen sunucu güvenlik duvarı değildir; SSH/FTP/posta portlarını kapatmaz. Trafik sunucuya gelmeden uygulanacak DDoS korumasını, SPF/DMARC/CAA DNS kayıtlarını, yazılım güncellemelerini, kod imzasını ve gerçek cihaz kabulünü karşılamaz. Bütün saldırılara karşı garanti vermez.

Ters proxy gerçek istemci adresini sunucuya güvenilir biçimde aktarmıyorsa birden çok kullanıcı aynı sayaçta sayılabilir. Sunucu/proxy yapılandırması ayrıca değerlendirilmelidir. Kullanıcı, uygulamayı kaldırmak veya verilerini silmek yerine güncel paketle mevcut kurulumunun üzerine yükseltmelidir.

Kaynaklar: `security/requestFirewall.php` (site/API kopyalarının ana kaynağı), `backend/src/middlewares/requestFirewall.js`. PHP'nin gerekli durum dosyalarını oluşturabildiği canlı normal isteklerle doğrulandı.
