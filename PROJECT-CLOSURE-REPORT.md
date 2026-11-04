
## 12 Ekim 2026 — Masaüstü merkezi lisans güncellemesi
Desktop 2.4.6: canlı merkez URL ve açık imza anahtarı paketlenir; yapılandırma eksikliğinde sessiz yerel lisans modu yoktur. Merkezi paketten modül hakları oturum doğrulamasına aktarılır. LicenseContext paketli uygulamada merkezi denetimi kapalı eski backend'e operasyon erişimi vermez. Kayıtlı veritabanı hedefi korunur.
Doğrulanan: desktop runtime 7 test, SQLite oturum/modül/lisans 22 test; ayrı test verileriyle gerçek backend HTTP ve canlı merkez imzası, paket hakları, normal kullanıcı girişi, lisans bilgisi olmayan girişin reddi. Canlı test lisansı askıya alma 423 ve yeniden etkinleştirme daha önce doğrulandı.
Bekleyen: kullanıcı profilinde gerçek Electron aktivasyonu ve yeniden başlatma, harici backend yükseltmesi, kurulum görsel kabulü. Tüm eksikler giderildi veya mevcut kurulu masaüstü uçtan uca doğrulandı iddiası yoktur.

### 2.4.6 paket kabulü
Paket kaynak sürümü, preload merkezi lisans bayrağı, frontend derlemesi ve açık anahtar varlığı kontrol edildi. Paketlenmiş Node ile ayrı MySQL test hedefi iki kez başlatıldı: migration current, DB mysql, central_required=true/offline_allowed=false, lisanssız ürün API isteği 423, canlı merkezden imzalı valid=true yanıtı ve NORMAL hakları doğrulandı. Yeniden başlatma aynı hedefte geçti. Müşteri verilerine dokunulmadı. Kurulu kullanıcı profilinin Electron aktivasyonu henüz kabul edilmedi.

### Kurulu program güncellemesi — 12 Ekim 2026
2.4.6 NSIS kurulum komutu mevcut program üzerine uygulandı ve exit 0 döndü. Kurulu app.asar sürümü 2.4.6 olarak okundu; merkezi lisans yapılandırması ve açık anahtar bulundu. Kurulu backend'in centralLicense, moduleAccess, authController ve licenseRoutes dosyaları son kaynakla birebir eşleşti. Kullanıcı veritabanı testlere alınmadı veya sıfırlanmadı. Gerçek kullanıcı profilinde lisans ekranı aktivasyonu ve giriş görsel kabulü bekliyor; otomatik aktive edildiği iddiası yoktur.

## 12 Ekim 2026 — İstenen yerel sahip hesabı
Kullanıcı yalnız kurulu Veniux hesaplarını değiştirmeyi istedi. Doğrulanan managed veniux_local hedefinde users boştu; silinecek kullanıcı yoktu. Eksik root@127.0.0.1 trigger sahibi kullanıcı oluşturmayı engelliyordu. Kullanıcının açık bakım onayıyla aynı veri dizininde kural hesabı onarıldı: ACCOUNT LOCK, global yetki yok, yalnız veniux_local SELECT/INSERT/UPDATE/DELETE/TRIGGER. Günlük uygulama veniux_app kullanır. Geçici init-file içerikleri boşaltıldı.
Tek aktif kullanıcı mymarius1@gmail.com oluşturuldu; platform_admins kaydı ve company kapsamı doğrulandı. bcrypt şifre doğrulaması geçti. Şifre rapora veya sohbet çıktısına alınmadı; yalnız kullanıcı ACL'sine sahip özel yerel dosyada teslim edildi. Firma/stok/satış kayıtları ve lisans paneli değiştirilmedi. Diğer geliştirme veritabanları kapsam dışı kaldı. Normal program yeniden açılışı ve gerçek arayüz girişi bekliyor. Yeni kurulumlarda definer hesabının silinmesine neden olan bootstrap kaynak hatası bu bakımda paket güncellemesiyle giderilmiş sayılmaz.

## 12 Ekim 2026 — Aktivasyon ekranı cihaz kimliği düzeltmesi
LicenseContext Windows kimliğini artık yerel API hazır olmadan okur; aktivasyonda güncel IPC kimliğini tekrar doğrular. Windows kimliği yoksa web kimliğiyle devam etmez. Derlenen frontend kurulu 2.4.6 resources/frontend klasörüne uygulandı; yeni tam installer bu düzeltmeyle üretilmedi.
Canlı panelde eski test lisansı REVOKED, kullanıcının ekrandaki Marius ENTERPRISE lisansı ACTIVE olarak görüldü. Etkin Marius lisansı gerçek Windows parmak iziyle kurulu backend API üzerinden başarıyla etkinleştirildi; şifreli AppData lisans önbelleği okuma ve canlı /license/validate kontrolü geçti. BOTH paket hakları doğrulandı. Sonlandırılmış lisans yeniden açılmadı. Sahip hesabının bu turda gerçek arayüz girişi doğrulanmadı; kullanıcı programı yeniden açmalı. Şifre ve lisans anahtarı rapora alınmadı.

## 12 Ekim 2026 — 2.4.7 sistem düzeltmeleri
Son kaynak ve sınırlandırılmış kabul kapsamı SYSTEMS-ACCEPTANCE-2.4.7.md ile kaydedildi. 633 SQLite regresyonu, 9 desktop testi, 5 WhatsApp mock testi ve ayrı fresh MariaDB API kabulü geçti. Gerçek NVIDIA sohbeti ve Google WAV üretimi doğrulandı. MySQL bakım/boyut, merkezi lisanslı otomasyon, özel hizmet ayarı yükleme ve telefonun API'de gizlenmesi düzeltildi. Ekrandaki ölçülmemiş %100/rollback iddiaları kaldırıldı. SMS kullanıcının tercihiyle kapalıdır; mevcut WhatsApp kullanıcı QR eşleştirmesini bekler. Gerçek cihazlar, tüm MySQL operasyonları ve kullanıcı arayüzü ses/mesaj teslim kabulü tamamlanmış sayılmaz. İş verileri sıfırlanmadı.

2.4.7 mevcut kurulum üzerine başarıyla uygulandı (installer exit 0). Kurulu app.asar sürümü, local-server/settingsController kaynak eşleşmesi ve yeni yardımcı dosyalar doğrulandı. Paketlenmiş sunucunun ayrı MariaDB API kabulü geçti. Kullanıcı programı kapattıktan sonra kurulum tamamlandı; gerçek WhatsApp QR eşleştirmesi ve arayüzde ses duyulması bekliyor.

## 12 Ekim 2026 — Güncelleme yönetimi arayüzü
UpdateManagement.jsx: çoklu seçim/sürükleyip bırakma, sıralı dosya kuyruğu, yükleme yüzdesi, hata ve yeniden deneme, yayın onayı, sunucu dosya listesi ve dar ekran düzeni eklendi. latest.yml son yüklenir; mevcut sunucu boyut/SHA512 denetimi korunur. Frontend üretim derlemesi geçti (Windows süreç kısıtı nedeniyle configLoader runner kullanıldı). Tarayıcı güvenlik politikası yerel önizleme erişimini reddetti; masaüstü/dar ekran görüntüsü ve gerçek dosya yükleme kabulü tamamlanmış sayılmaz. Yeni installer veya gerçek güncelleme yayını yapılmadı.

### Kurulu programa arayüz uygulaması
Kullanıcı isteğiyle yeni frontend derlemesi kurulu 2.4.7 resources/frontend alanına uygulandı. Önceki arayüz .local altında geri alınabilir biçimde yedeklendi; index.html en son güncellendi ve 104 kaynak dosyasının kurulu kopyayla eşleşmesi doğrulandı. Veritabanı, hesaplar ve lisans değişmedi. Tam installer yeniden üretilmedi; programı yeniden açınca yeni panel yüklenir. Gerçek ekran ve yayın kabulü bekliyor.

## 12 Ekim 2026 — Sade masaüstü tasarımı ve performans
Son kaynak/kurulu arayüz kanıtı docs/NATIVE-UI-PERFORMANCE-2026-10-12.md ile kaydedildi. Yeni panel kurulu derlemede ayrıca doğrulandı; 104 dosya eşleşti. Ortak açık/koyu tasarım ve animasyon/polling yükü azaltıldı. Gerçek CPU/FPS kıyaslaması, yeniden açılış ve görsel kabul bekliyor; bütün kasma sorunu giderildi iddiası yok.

### Sol menü görsel düzenlemesi
Layout.jsx bölüm simgeleri ve expanded işaretleri; native-refinement.css marka/arama/bölüm/alt menü/hesap hiyerarşisi güncellendi. Açık/koyu tema, klavye focus-visible ve mevcut aria-expanded/controls korundu. Sürekli animasyon eklenmedi. Derleme geçti ve 104 dosya kurulu programa uygulanıp eşleşmesi doğrulandı. Kullanıcı yeniden açılışı ve gerçek arayüz görsel kabulü bekliyor; görsel kabul tamamlandı iddiası yok.

### Yerel sunucu başlangıç uyarısı
Ekrandaki hata sonrasında aynı kurulu sunucu ve mevcut veri hedefi iki normal başlangıç/health kontrolünde ready=true verdi; ilk hatanın kesin nedeni yeniden üretilemedi. local-server.cjs artık dolu portun bırakılmasını en fazla yaklaşık 10 saniye bekler; bilinmeyen sunucuya bağlanmaz ve hedef değiştirmez. Sır içermeyen kod/zaman startup-error.json dosyasına kaydedilir. Ayrı port testi geçti; kurulu helper kaynakla eşleşti. Veri sıfırlanmadı, şema/hesap/lisans değişmedi. Kullanıcı arayüzünden yeniden açılış kabulü bekliyor.

### Referans kart tasarımı
card-refinement.css ve main.jsx: ortak Bahnschrift/Segoe UI sistem fontu, 22px kart köşeleri, daha belirgin KPI sayıları, 48px pastel simge blokları, panel başlıkları ve modül kısayolları düzenlendi. Koyu tema lacivert yüzeyler; açık tema ayrı palet kullanır. Font dosyası kopyalanmadı veya harici istek eklenmedi. Derleme geçti; 104 arayüz dosyası kurulu programa uygulandı ve eşleşti. Gerçek ekran görüntüsü/taşma görsel kabulü henüz yapılmadı. İş davranışı, veriler ve lisans değişmedi.

### Masaüstü üst çubuğu
DesktopTitleBar.jsx ve card-refinement.css: üç sütunlu dengeli marka/durum/pencere eylemleri, açık-koyu tema durum rozetleri, erişilebilir pencere düğmeleri ve dar ekran düzeni eklendi. 44px yükseklik ve mevcut sürükleme/IPC davranışları korundu. Derleme ve kurulu 104 dosya eşleşmesi doğrulandı. Gerçek pencere görsel/etkileşim kabulü bekliyor. Arayüz yedeği alındı; sunucu ve iş verileri değişmedi.

### macOS tarzı pencere çubuğu
Solda kırmızı kapat/sarı küçült/yeşil büyüt düğmeleri, ortada Veniux/firma başlığı ve sağda gerçek bağlantı durumu/sağlık düğmesi uygulandı. Mevcut Electron IPC, aria-label ve sürükleme alanı korundu. Açık/koyu renkler ve klavye odak işaretleri eklendi. Derleme ve kurulu 104 dosya eşleşmesi geçti; gerçek pencere görünümü ve düğme etkileşimi kabulü bekliyor. Veriler/lisans/sunucu değiştirilmedi.

### Veniux Cloud adı
Görünen frontend markası (giriş, sol menü, başlık ve HTML title) Veniux Cloud oldu. Üst çubuk koyu lacivert yüzeyle bütünleştirildi, pencere düğmelerinin tıklama alanı 28px yapıldı. Kaynakta Electron pencere başlığı, gelecekteki productName/shortcutName Veniux Cloud olarak değişti; name/appId korunarak mevcut kullanıcı profili/lisans kimliği korundu. Yeni installer veya app.asar yeniden paketlenmedi: Windows kurulu program adı ve mevcut kısayol henüz eski olabilir. Derleme ve 104 kurulu arayüz dosyası eşleşmesi doğrulandı. Gerçek görsel kabul bekliyor.

### Profesyonel pencere çubuğu ve PHP fiyat uyumu
Renkli noktalar yerine sağda sembollü pencere kontrolleri uygulandı. PHP Başlangıç/İşletme/Kurumsal 3 aylık ve yıllık KDV hariç fiyatları sırasıyla 1190/3490, 2890/9290, 5790/18490 TRY oldu. Website pricing.php ve backend commercialPricing.json ad/tutar eşleşmesi ile yıllık avantaj kontrolü geçti. getPlans bu üç mevcut planın Türkçe teklif adı ve TRY fiyat metadatasını sunar; eski price_usd tahsilat alanları, plan ID/hakları ve geçmiş ödeme/lisans kayıtları değiştirilmedi. Bu TRY katalog fiyatı ödeme tahsilatı veya kur dönüşümü değildir. Frontend derlemesi, PHP syntax ve 104 kurulu arayüz dosyası eşleşmesi doğrulandı. Kurulu backend'e yalnız katalog ve licenseService uygulandı, yeniden açılış gerekir. Canlı Plesk sitesi yayımlanmadı; yerel PHP kaynak değişti. Görsel kabul ve gerçek müşteri ödeme akışı doğrulanmış sayılmaz.

### KDV dahil teklif gösterimi
%20 genel KDV oranıyla önceki net tutarlar korunarak brüt fiyatlar hesaplandı: Başlangıç 1428/4188, İşletme 3468/11148, Kurumsal 6948/22188 TRY (3 aylık/yıllık). PHP sayfası ve talep seçimi KDV dahil, program kataloğu tax_included=true/vat_percent=20 oldu. JSON net fiyatları ayrıca korur. PHP syntax, frontend build ve site/program tutar eşleşmesi geçti; arayüz/katalog kurulu programa uygulandı. Geçmiş tahsilat/fatura/lisans kayıtları değişmedi; USD eski tahsilat akışı otomatik TRY'ye çevrilmedi. Canlı PHP yayını ve gerçek görsel kabul bekliyor. Oran kaynağı: https://gib.gov.tr/mevzuat/kanun/435/ozelge/27300

### Beta ibarelerinin kaldırılması
PricingCheckout görünür beta ifadeleri kaldırıldı; başlık Veniux Cloud lisansı, eylem Paket ve lisans yönetimi oldu. Seçili paket olmadan sabit 299 USD gösterilmez; seçilmiş TRY katalog tutarı KDV dahil gösterilir. Ödeme alınmadığı bilgisi ve yönetici tarafından aktivasyon akışı korunur. Derleme ve kurulu arayüz dosya eşleşmesi geçti; gerçek ekran kabulü bekliyor. Bu metin değişikliği tüm bekleyen sistem kabul koşullarını tamamlanmış saymaz.

### Aktivasyon ekranından lisans yönetimine yönlendirme
İç /admin/api hedefi merkezi lisans aktif olmadığında /activate ekranına geri dönüyordu. PricingCheckout artık https://api.veniux.com/ panelini sistem tarayıcısında açar; Electron HTTPS dış bağlantı izin listesine yalnız api.veniux.com eklendi. Lisans gate ve auth denetimleri korunur. Kurulu app.asar yedeği alındı, yalnız izin listesi/pencere başlığı değişikliğiyle yeniden paketlenip uygulandı; frontend eşleşmesi doğrulandı. Derleme ve kurulu izin listesi/link kaynak kontrolü geçti. Gerçek düğme tıklaması/tarayıcı açılışı kabulü bekliyor; yeniden açılış gerekir.

### Hesap güvenliği kartı
AccountTab sabit Şifreli oturum/yeşil güvenlik seviyesi iddiası kaldırıldı; parola yöntemi, 2FA kullanıma açık değil durumu ve güvenlik ayarları bağlantısı eklendi. SecurityTab anlaşılır oturum süreleri gösterir; denetim günlüğü yükleme/yetki hatası artık güvenlik ayarlarının yüklenmesini engellemez ve boş kayıt gibi sunulmaz. Mevcut kayıt/PUT doğrulaması korunur. Yeni 2FA altyapısı uygulanmadı. Derleme ve kurulu arayüz dosya eşleşmesi geçti; gerçek görsel/etkileşim kabulü bekliyor. Kullanıcı ayarları otomatik değiştirilmedi.

### Gerçek iki aşamalı doğrulama
Son kaynak ve kabul kapsamı docs/TWO-FACTOR-ACCEPTANCE.md ile kaydedildi. TOTP QR kurulum/onay, ikinci kodlu giriş, 10 tek kullanımlık kurtarma kodu, parola+ikinci kodla kapatma, tekrar kullanım/kalıcı hata sınırı, şifreli kullanıcı/firma bağlı saklama ve oturum iptali eklendi. Mevcut şema özel auth_private kayıtları kullanır; kontrolsüz DDL yoktur. 71 SQLite suite/635 test, 8 hedefli auth/MFA testi ve ayrı MariaDB gerçek API/eşzamanlılık kabulü geçti. Kurulu backend/UI eşleşmesi doğrulandı. Hiçbir gerçek kullanıcı için otomatik MFA etkinleştirilmedi. PHP lisans paneli 2FA kapsam dışıdır; gerçek telefon ve görsel kabul bekliyor.

### Genişletilmiş görünüm tercihleri
AppearanceTab/appearance.js/appearance-boot.js/card-refinement.css ve hareket bileşenleri: 6 vurgu paleti, 2 yerel yazı tipi, 3 içerik yazı boyutu, 3 kart köşesi, hafif/kapalı hareket seçenekleri eklendi. Seçimler cihazda saklanır, eski tercihler korunur, geçersiz enum değerleri reddedilir ve varsayılanlara dönüş genişletilen alanları kapsar. Vurgu birincil renk ve menü seçimlerine uygulanır; hareket kapalıyken dekoratif JS/CSS animasyonları durur. Veri/güvenlik yenilemeleri korunur. Derleme; persistence/application/validation/reset/legacy testleri; 105 kurulu dosya eşleşmesi geçti. Gerçek görsel/taşma kabulü ve yeniden açılış kontrolü bekliyor. Kullanıcı tercihleri otomatik değiştirilmedi.


### Telefon/tablet/diğer bilgisayar hazırlığı
Son kaynak ve kurulum sınırları docs/MULTI-DEVICE-ACCESS.md ile kaydedildi. Tablet çekmece menüsü ve küçük ekran düzeni; stabil rastgele tarayıcı cihaz kaydı; açıkça etkinleştirilen merkezi web aktivasyon politikası ve HTTPS/loopback/MySQL cloud başlatıcısı eklendi. Frontend build, browser kimliği persistence/fail-closed ve 10 politika/auth/MFA testi geçti. Responsive frontend kurulu programa uygulandı; yerel web flag açılmadı ve portlar yayımlanmadı. Node destekli Plesk/VPS kapasitesi, canlı HTTPS kurulum ve gerçek cihaz görsel/işlem kabulü bekliyor. Üretim verisi taşınmadı. Her cihazda bütün donanım entegrasyonları çalışır iddiası yoktur.

### Cloud DNS ve HTTPS
app.veniux.com DNS 31.58.236.144 ve varsayılan HTTPS 200 yanıtı doğrulandı. Kullanıcının açık Let's Encrypt koşul onayıyla ücretsiz sertifika kuruldu; Plesk HTTP→HTTPS yönlendirme açık, son geçerlilik 10 Ocak 2027. .local/cloud-https-ready.jpg kanıtı kaydedildi. Uygulama dosyaları sunucuda yok; müşteri girişi canlı açıldı iddiası yoktur. Yerel DB ve lisans paneline dokunulmadı.
