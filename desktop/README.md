# Veniux Electron geliştirme sürümü

Mevcut React uygulamasını masaüstü penceresinde açar. PHP tanıtım sitesinden ayrıdır. ZIP veya Windows kurulum paketi bu aşamada üretilmez.

## Çalıştırma

Önce `frontend` klasöründe `npm run build`, sonra `desktop` klasöründe `npm start` çalıştırın. Geliştirme profili `.local/desktop-profile`, lisans önbelleği bu profilin `license` klasöründedir. Önceki masaüstü lisans önbelleği ve kullanıcı veritabanı okunmaz veya taşınmaz.

Sunucu adresi `VENIUX_DESKTOP_API_URL` ile seçilir; varsayılan `http://127.0.0.1:3000/api`. Uzak sunucuda HTTPS zorunludur. Backend otomatik başlatılmaz, migration çalıştırılmaz, SQLite/MySQL seçimi değiştirilmez. `ELECTRON_START_URL` yalnız geliştirmede yerel HTTP Vite adresi olabilir. API erişimi backend'in CORS yapılandırmasıyla birlikte doğrulanmalıdır.

## Bu aşamada doğrulananlar

- Electron 44.7.0 bağımlılığı kuruldu; gerçek Windows Electron süreci ve uygulama pencere başlığı doğrulandı.
- React üretim derlemesi geçti. Mevcut appearance-boot ve 500 KB chunk uyarıları devam ediyor.
- `node --test runtime.test.js`: dört test geçti (yerel profil, HTTPS, güvensiz/kimlik bilgili adresleri reddetme, geliştirme ekranı sınırı).
- Ana süreç/preload sözdizimi kontrol edildi. IPC gönderen pencere/ana çerçeve ve gezinme adresi doğrulanır; context isolation, sandbox ve web security açıktır.
- Bağlantı göstergesi `/health` yanıtında HTTP başarısı ve `status=ok` koşuluna bağlıdır. Lisans önbelleği sunucunun erişilebilirliği anlamına gelmez.

## Bekleyen kabul

Gerçek masaüstü görüntüleri, pencere kontrollerinin kullanıcı arayüzü testi, oturum açma, iki firma/depo kapsamı, satış/iade, cihaz/yazıcı, offline lisans davranışı ve MySQL/SQLite regresyonları bu değişiklikte tamamlanmış sayılmaz. Sistem izinleri varsayılan kapalıdır; mikrofon/kamera gerekiyorsa yetki akışı ayrıca uygulanmalıdır. Backend seçimi ve tek/çok bilgisayar kurulumu ayrıca netleştirilmelidir. Bu geliştirme sürümü üretime dağıtıma hazır kabul edilmez.

Güvenlik kaynağı: https://www.electronjs.org/docs/latest/tutorial/security/

## Yeniden açma asistanı
Ana klasörde Veniux-Kurulum.cmd bağlantı ve ekran hazırlığı sihirbazını açar. Veniux-Baslat.cmd sonraki açılışlar içindir. Sunucu URL'si .local/desktop-connection.json içinde tutulur ve Electron tarafından yeniden doğrulanır. Sihirbaz DB veya kullanıcı oluşturmaz. PowerShell parser kontrolü ve dört runtime testi geçti; native sihirbaz etkileşimleri henüz kabul edilmedi. Bu bir bağımsız Setup.exe değildir.


XAMPP geliştirme bağlantısı hazır: MySQL servisini açın, Veniux-Baslat.cmd çalıştırın. Ayrı veniux_desktop_dev2 ve root olmayan uygulama hesabı kullanılır. Giriş bilgileri .local/desktop-test-login.json içindedir. Gerçek API giriş/oturum testi geçti; yerel Electron formu etkileşim kabulü bekliyor.


### Windows NSIS kurulum sihirbazı — 11 Ekim 2026
Kullanıcının güncel açık isteğiyle Setup.exe oluşturuldu: .local/desktop-installer/Veniux-Setup-2.4.0.exe. Kullanıcı başına kurulum, klasör seçimi, masaüstü/başlat menüsü kısayolları ve sunucu gereksinimi bilgilendirmesi yapılandırıldı. Backend, XAMPP, veritabanı ve AI sırları installer kapsamına dahil değildir. İstemci 127.0.0.1:3000 API sunucusuna bağlanır; Veniux-Baslat.cmd sunucu hazırlığı ayrı kaynak klasöründe kalır. Electron-builder exit 0; React build ve dört runtime testi geçti; ASAR runtime.js ve media CSP doğrulandı; özel env/config dosyaları yok. Kod imzası yok, otomatik güncelleme feed olmadan kapalı. Windows kurulum/kaldırma akışının native görsel kabulü ve reboot sonrası backend başlatımı bekliyor. Tam bağımsız yerel sunucu kurulumu iddia edilmez.

### 12 Ekim 2026 — Merkezi lisans güncellemesi 2.4.6
Yeni Windows paketi varsayılan olarak https://api.veniux.com/v1 ve canlı sunucudan doğrulanan açık imza anahtarını içerir. Özel anahtar, lisans anahtarı ve terminal tokeni pakete konmaz. Paketli uygulamada eksik merkez yapılandırması başlatmayı durdurur. Eski dış API merkezi denetimi kapalı bildirirse arayüz operasyonları açmaz; kayıtlı veri hedefini değiştirmez. Yönetilen yerel backend merkezi ayarları ana süreçten devralır.

Merkezi doğrulanmış paket hakları artık backend oturum ve modül kapsamına aktarılır; bilinmeyen paket reddedilir. Merkezi modda oturum açma da cihaz lisansı gerektirir. Yerel eski lisans kaydı merkezi hakların yerine geçirilmez.

Çalıştırılanlar: yedi desktop runtime testi, 22 SQLite oturum/modül/lisans regresyonu, ayrı test SQLite üzerinde gerçek backend HTTP + canlı imzalı merkez doğrulaması; paket özellikleri, normal kullanıcı girişi, lisanssız giriş reddi geçti. Önceden onaylanan canlı askıya alma 423 ve yeniden etkinleştirme testi geçti. Güncel test lisansı etkin.

Kurulum sonrası gerçek Electron aktivasyonu, müşteri bilgisayarında yeniden başlatma, dış sunucu yükseltmesi ayrıca doğrulanmalıdır. Otomatik güncelleme dağıtım adresi henüz yok. Kullanıcı veritabanı taşınmaz veya sıfırlanmaz.
