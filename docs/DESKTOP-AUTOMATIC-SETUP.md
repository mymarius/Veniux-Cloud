# Veniux yerel sunuculu kurulum — 2.4.3

Bu sürümde müşteri önce indirilen Veniux Setup.exe dosyasını çalıştırır. Bir web sayfası ziyaretçinin bilgisayarına izinsiz program kuramaz. Mevcut fiyatlandırma sayfası görüşme talebi topluyor; ödeme doğrulama ve satın alma sonrası otomatik indirme bağlantısı iş akışı henüz yoktur.

Yerel sunuculu paket Node 24.15.0, backend kaynakları ve bağımlılıklarını içerir; müşteri Node/npm kurmaz. `VENIUX_BUNDLE_SERVER=1` ve `VENIUX_NODE_PATH` ile oluşturulur. XAMPP çalıştırılabilir bileşenleri paket içinde dağıtılmaz. İlk açılış mevcut 127.0.0.1:3000 Veniux sağlık kontrolü başarılıysa o bağlantıyı korur. Açık bir `VENIUX_DESKTOP_API_URL` varsa otomatik yerel kurulum yapılmaz.

Sunucu yoksa:

1. Doğrulanmış MariaDB 10.4.32 dosyaları C:\xampp altında mevcutsa yalnız çalıştırılabilir dosyaları kullanılır. Bu kontrol tam Windows program kurulum tespiti iddiası değildir. Mevcut my.ini, veri klasörü, hesaplar veya çalışan hizmet değiştirilmez.
2. Bileşen yoksa Apache Friends'in bağlantısını verdiği XAMPP 8.2.12 Windows installer indirilir. Resmî sayfanın SHA1 değeriyle eşleştirilmeden çalıştırılmaz. InstallBuilder unattended kurulumu kullanıcıya ait ayrı runtime/xampp konumuna yapılır. İnternet/Windows izinleri gerekir; hatada durur. Apache/FTP/mail hizmetleri başlatılmaz.
3. Kullanıcıya ait kalıcı `userData/local-runtime` klasörünün ACL'si yalnız o kullanıcıya açılır. Ayrı MariaDB veri alanı, yalnız 127.0.0.1:33078 dinleyicisi, `veniux_local` şeması hazırlanır. İlk veritabanı bağlantısının datadir ve port kimliği DDL öncesinde doğrulanır.
4. Sürümlü migration ve şema doğrulaması geçmeden backend başlatılmaz. Uygulama hesabı SELECT/INSERT/UPDATE/DELETE; kapatma hesabı yalnız SHUTDOWN; root yalnız hazırlık içindir. Parolalar ve JWT/lisans anahtarları müşteri bilgisayarında üretilir, installer içine eklenmez. Başlangıç yöneticisi veya platform sahibi hesabı otomatik üretilmez; yeni işletme kayıt ekranını kullanır.
5. Üretim API 127.0.0.1:17849 üzerinde başlar. Tek örnek Electron kilidi ve port/kurulum kilidi aynı anda iki sunucu kurulmasını engeller. Yeniden açılış mevcut şemayı yalnız doğrular; her açılışta migration DDL'si çalıştırılmaz. Yarım kurulum, eski şema veya port çakışmasında sessiz fallback yoktur. Yarım kurulum otomatik silinmez.
6. Uygulama kapanınca API yeni bağlantıları durdurur, mevcut bağlantılar biter, SQL havuzu kapanır ve ayrı MariaDB kapatma hesabıyla SHUTDOWN yapılır. Beklenmeyen MariaDB çıkışında yerel API de kapanır. Mevcut harici Veniux sunucusu kapatılmaz.

## Çalıştırılan kabul

- Gerçek mevcut MariaDB 10.4.32 dosyalarıyla, TEMP altında yeni ve bağımsız veri alanında otomatik ilk kurulum, MySQL migration, production API sağlık kontrolü geçti.
- Uygulama hesabıyla CREATE TABLE denemesi ER_TABLEACCESS_DENIED_ERROR ile reddedildi.
- Normal kapatma/yeniden başlatma ve JWT sırrının korunması geçti; iki ardışık başlatmada sağlık kontrolü geçti. Test dosyaları korundu; mevcut XAMPP verileri okunmadı/değiştirilmedi.
- Dört mevcut desktop/runtime testi geçti. Ayarlar ekranının üretim derlemesi geçti.

## Bekleyen kabul

XAMPP bulunmayan temiz Windows üzerinde gerçek indirme/unattended kurulum, UAC/antivirüs davranışı; paketlenmiş EXE üzerinden ilk açılış ve reboot; kesinti/kurulum hatası ve eşzamanlı süreç testleri; kayıt oluşturup restart sonrası doğrulama; native ayarlar ekranının görsel kabulü. Bu kontroller olmadan ticari dağıtım tamamen kabul edilmiş sayılmaz. XAMPP/MariaDB 10.4.32 eski bileşenler içerir; internete açılan üretim sunucusu olarak sunulmaz. Güvenlik güncellemeleri için dağıtım sürümü ayrıca yönetilmelidir.

Kaynaklar: [Apache Friends indir](https://www.apachefriends.org/download.html), [XAMPP Windows FAQ](https://www.apachefriends.org/faq_windows.html), [InstallBuilder unattended mode](https://releases.installbuilder.com/installbuilder/docs/installbuilder-userguide/_running_the_installer.html), [Node 24.15.0 lisansı](https://github.com/nodejs/node/blob/v24.15.0/LICENSE).
Ek testler: paketlenen Node/backend ile ilk kurulum ve restart geçti; dolu SQL portu yeni datadir oluşturulmadan reddedildi, sentetik yarım kurulum korundu ve açılmadı. Eşzamanlı iki gerçek Electron süreci ve migration ortasında güç kesintisi ayrıca doğrulanmadı.
Sunucu seçimi server-selection.json içinde kalıcıdır. Daha önce seçilmiş harici sunucu erişilemezse boş managed hedef kurulmaz; managed seçim başka açık APIye dönmez. Üç kalıcılık/olumsuz hedef testi ile toplam yedi runtime testi geçti. Seçilmiş harici sunucunun otomatik kurulumu/başlatımı bu sürümün kapsamına girmez; mevcut ayrı sunucu yönetimi korunur.
Son yerel sunuculu 2.4.3 Setup.exe üretimi başarılıdır (exit 0); main/runtime/frontend payload son kaynakla eşleşir. Native installer/Electron ve temiz Windows kabulü henüz yapılmadı.
