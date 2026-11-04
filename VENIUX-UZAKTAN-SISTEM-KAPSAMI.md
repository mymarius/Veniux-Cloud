# Veniux uzaktan saha ve bayi erişimi — uygulama kapsamı

13 Ekim 2026. Hedef mağaza/küçük-orta depo yanında internetten saha ve bayi erişimi. Referans özellikler [NextTrack](https://www.nexttrack.com.tr/), [WMS](https://www.nexttrack.com.tr/solutions/wms/), [saha satış](https://www.nexttrack.com.tr/solutions/field-sales/) ve [bayi portalı](https://www.nexttrack.com.tr/solutions/b2b-ecommerce/) sayfalarında ürün tarafından beyan edilen kapsamdır; rakip sistemde test yapılmadı.

## Tamamlanan ilk düzenleme

- Yandan açılan mobil menü: kısa transform animasyonu, ekran arkası perde, klavye odağı, Escape/çarpı/dışarı tıklama ile kapanma, hareket azaltma tercihi.
- Programın Stok Analizi ekranı: depo ve 30/90 gün seçimi, A/B/C hareket grupları, çıkış kaydı olmayan ürünler, işlem sayısı ve miktar payı. Kayıtları değiştirmeyen rapor.
- Sıfır hareketli ürünün A grubuna girmesi düzeltildi. Analiz genel stok ürünleri ve seçilen depo/firma ile sınırlıdır.

## Sunucu önkoşulu ve dağıtım

Yetkili Plesk hesabında PHP araçları mevcut; Node.js uygulama yönetimi görünmüyor. Kullanıcı mevcut başka sunucusu olmadığını ve hostingde Node.js desteği açtıracağını bildirdi. Saha/bayi erişimi henüz canlıya alınmadı.

Hostingde gerekenler: Yerel testlerde kullanılan Node.js 24 ile uyumlu çalışma ortamı, sürekli çalışan uygulama, HTTPS reverse proxy, özel ortam değişkenleri, kalıcı veri/yedek alanı, MySQL desteği ve uygulama yeniden başlatma/log erişimi. Mevcut PHP lisans/güncelleme API'si korunmalıdır; yeni işletme API'si aynı adrese kontrolsüzce yazılmamalı.

Yerel veritabanları başlangıçta merkezi veritabanına otomatik taşınmayacak. Her işletme için yedek, aktarım önizlemesi, kayıt sayısı/stoğun doğrulanması ve geri dönüş planı hazırlanır. İnternete yerel veritabanı portu açılmaz.

## Aşama 1 — merkezi erişim

- İşletme, kullanıcı ve depo izolasyonu; TLS; mevcut giriş, MFA ve lisans haklarını koruma.
- Windows ve Android için açık yerel/uzak sunucu seçimi; QR'da onaylı HTTPS alanı, tek kullanımlı kısa süreli bağlantı.
- Erişim iptali, cihaz ve oturum yönetimi, günlük/yedek/geri yükleme.
- Pilot işletme: tek kullanıcıdan iki kullanıcıya geçiş ve eş zamanlı stok işlemleri.

## Aşama 2 — bayi ve saha

- Bayi rolü kendi ürün/fiyat, sipariş ve belgelerini görür; başka bayi/işletme verilerine erişemez.
- Sipariş taslağı, stok doğrulaması, rezervasyon, onay, toplama ve sevkiyat bağlantısı.
- Saha müşteri/ziyaret, fırsat, aktivite ve sipariş ekranları; mevcut CRM ile tek müşteri kaydı.
- Çevrimdışı kuyruk ancak çakışma ve tekrar göndermeye karşı kimlik anahtarlarıyla test edilince açılır; stok onayı sunucudadır.

## Aşama 3 — ileri depo ve dağıtım

- Barkodla lokasyon/ürün doğrulaması, uygun lot/tarih kontrolü, sayım mutabakatı.
- Depo tutarlılığı, doluluk, açık kabul/toplama/sayım sayaçları.
- ABC/XYZ, stokta bekleme ve devir hızı: ayrı tanım, eksik veri göstergesi, doğrulanmış hesap yöntemi.
- Araç kapasitesi, sevkiyat planı, teslimat kanıtı; GPS ve harita hizmeti ayrı entegrasyondur.
- RFID/ERP/e-irsaliye yalnız sağlayıcı ve cihazlarla pilot test sonrasında hazır sayılır.
- Yapay zekâ önerileri onaysız stok/ödeme değişikliği yapmaz; mevcut yetkiler uygulanır.

## Kabul ölçütleri

Başka işletme/bayiye erişim reddi; yinelenen sipariş tek kayıt; eş zamanlı stokta negatif/yinelenen hareket engeli; çevrimdışı tekrar bağlanmada tutarlı sonuç; depo/lot mutabakatı; ayrı ortamda yedek geri yükleme; gerçek Windows/Android cihazda yükseltme ve QR testi.

## Site optimizasyonu

Menü için animasyon kütüphanesi eklenmedi; transform kullanılır. Sıkıştırılmış, sürümlü CSS/JS ve yerel WOFF2 korunur. Google PageSpeed API yeni ölçümde 429 günlük kota hatası döndürdü; önceki 98 puan yeni sürümün ölçülmüş puanı değildir. Henüz devreye alınmayan bulut, bayi, GPS ve entegrasyon özellikleri siteye hazır özellik olarak yazılmaz.

## İlk sürüm doğrulaması

Windows ve Android 2.4.16 yayımlandı. Stok analizi ve depo sınırı testleri: 2 grup, 13 test başarılı. Ayrı test hesabında analiz ekranı açıldı, 90 günlük dönem ve hareketsiz ürün filtresi çalıştı. Paket sunucusu ayrı veri alanında başlatıldı ve yetkili kapatıldı. Yayımlanan dosyaların bütünlüğü ayrıca kontrol edilir.

Site ana CSS: 55.921 bayt küçültülmüş, gzip karşılığı 12.547 bayt. JS: 9.874 bayt küçültülmüş, gzip karşılığı 3.832 bayt. Canlı sunucu ikisini de Brotli ile ve bir yıllık sürümlü önbellek başlığıyla dönüyor. Bunlar laboratuvar performans puanı veya gerçek kullanıcı ölçümü değildir.

Mobil menü 390 piksel genişlikte açıldı; Escape ile kapanma ve aria-expanded=false doğrulandı. Yeni yazı tipi preload ile keşfedilir. Gerçek Android el terminali ve uzaktan işletme bağlantısı için cihaz/altyapı kabul testleri ayrıca gerekir.

## Hosting kontrolü — 13 Ekim 2026

Node.js desteği Plesk'te doğrulandı. API alanının devre dışı Node ayarı 24.21.0 olarak hazırlandı; PHP lisans API'si Node'a geçirilmedi. Yeni business.veniux.com (Plesk site_id=19), uygulama kökü /veniux-business, belge kökü /veniux-business/public; Node 24.21.0 ile etkinleştirildi.

Bu uygulama yalnız boş runtime testidir: /health erişimi; diğer GET uçları 503 SETUP_PENDING, yazma istekleri 405. Müşteri verisi, veritabanı, giriş ve sipariş servisi yoktur. Dosyalar public klasörün dışında. Sunucu üzerindeki npm run preflight sonucu: PASS Node 24.21.0, runtime health, business operations closed, write requests rejected.

Engel: Plesk yeni alanın DNS'te çözümlenmediğini bildiriyor. Yetkili DNS Cloudflare'da olduğundan Plesk DNS kaydı yeterli değildir. Cloudflare'da A kaydı: business → 31.58.236.144; ilk kurulumda DNS only, TTL Auto. DNS yayımlandıktan sonra HTTPS sertifikası yapılandırılmalı; yalnız bundan sonra işletme API'si ve uzaktan bağlantı hazırlanıp kabul testleriyle devreye alınabilir. Mevcut Windows/Android çalışma verileri aktarılmadı.

## DNS ve HTTPS doğrulaması — 14 Ekim 2026

business.veniux.com A kaydı 31.58.236.144 olarak çözümlendi. Kullanıcının bu başvurudaki Let’s Encrypt koşullarını kabul etme onayından sonra ücretsiz sertifika kuruldu. Sertifika kapsamı yalnız business.veniux.com; geçerlilik sonu 11 Ocak 2027, Plesk otomatik yenileme gösteriyor.

Doğrudan HTTPS/TLS doğrulaması başarılı (sertifika kontrolü kapatılmadı). /health 200, ready_for_customer_data=false. /api/auth/login 503 SETUP_PENDING; gerçek işletme API'si ve saha/bayi işlevleri henüz devrede değil. DNS/HTTPS altyapı engeli kalktı; sonraki iş merkezi uygulamanın güvenli kurulumu ve kabul testleri.

## Canlı saha/bayi hizmeti — 14 Ekim 2026

Önceki boş test hizmeti durumu artık geçerli değildir. Kullanıcının açık veri aktarımı ve açılış onayıyla business.veniux.com gerçek uygulamaya geçirildi. Sahip işletmesi Veniux, tenant 3; yalnız bu işletmenin sahibi, hesap/güvenlik ayarları ve günlükleri aktarıldı. Kaynakta ürün, depo ve satış kaydı bulunmuyordu. Kaynak yerel veritabanı değiştirilmedi. Şifre karması ve etkin MFA korunmuştur; özel çalışma anahtarları sunucuda üretilmiştir. Aktarım şifreli yapılmıştır. Önceki uygulama geri dönüş kopyası saklanmıştır.

İlk portal kapsamı: yönetici müşteri/bayi tanımı, süreli tek kullanımlık saha/bayi daveti, saha müşteri ataması, erişim iptali; ürün kataloğundan sipariş isteği ve yönetici incelemesi; saha ziyaret notları. Bayi yalnız kendi müşteri kayıtlarına, saha çalışanı yalnız atanan müşterilere erişir. Sipariş fiyatı sunucuda hesaplanır; aynı gönderim tekrarında çift kayıt oluşmaz. Sipariş onayı stok ayırmaz, stok çıkışı, tahsilat veya fatura oluşturmaz.

Doğrulama: yerel 2 test grubunda 12 test; ayrı sentetik Linux üretim testi giriş/davet/sipariş/tekrar koruması/bayi sınırı başarılı. Gerçek aktarım bütünlük ve yabancı anahtar kontrolleri başarılı. Canlı HTTPS /health 200, migration 029 current, /login 200, yetkisiz katalog 401, halka açık kayıt 403. Gerçek sahip hesabının parolası doğrulandı ve mfa_required=true döndü; MFA aşılmadı. Canlı tarayıcı doğrulama kodu alanını gösterdi.

Windows/Android 2.4.16 yerel bağlantısı otomatik olarak buluta geçirilmemiştir. Bu açılış web saha/bayi portalıdır. Gerçek sahibi MFA ile giriş yaptıktan sonra portalı kullanabilir. GPS, çevrimdışı senkronizasyon, ERP/RFID entegrasyonları bu ilk portal sürümünün kapsamında değildir.

## Windows / Android bulut istemcileri — 14 Ekim 2026

2.4.17 istemcilerinde resmî bulut hedefi business.veniux.com'dur. Yeni Windows profili bu hedefi seçer; mevcut yerel profiller korunur. Kullanıcının kendi Windows server-selection.json dosyası, önceki ayarı server-selection.before-cloud-20261014.json olarak saklayarak bulut hedefiyle değiştirildi. Kaynak local-runtime ve işletme veritabanı değiştirilmedi.

Windows bulut modunda HTTPS sunucu ön yüzünü açar; giriş/MFA, işletme ve modül yetkileri aynı bulut sunucusunda doğrulanır. Yerel lisans modu yalnız yerel çalışmada sürer. Başka alana uygulama içi gezinme engellenir. Paket içindeki bulut giriş kodu doğrulandı; bağlantı seçimi/sınırları için 8 test geçti.

Android'de yeni bağlantı ekranında Veniux buluta bağlan seçeneği vardır. Önceden yerel eşleştirilmiş Android cihazlar kendi hedefini korur; kullanıcı Bağlantıyı değiştir ekranından bulutu seçer. Yeni kurulum doğrudan bulut girişini açar. Bulut WebView yalnız resmî HTTPS alanına gezinir, karma içerik ve dosya erişimi kapalıdır; yerel JavaScript köprüsü bulut sayfasına verilmez. Yerel QR eşleştirme ayrıca korunur. Bulut modu aynı hesabın normal girişini ve etkin MFA'yı ister; yerel QR otomatik girişinin internete açıldığı iddia edilmez.

Android 2.4.17 / versionCode 257 derlendi ve önceki yayın anahtarıyla APK imzası doğrulandı. Gerçek Android cihazda kurulum, kamera ve ürün işlemleri bu bilgisayardan çalıştırılmadı; saha cihazı kabul testi ayrıca yapılmalıdır. Bulut internet gerektirir ve bu sürümde çevrimdışı senkronizasyon bulunmaz.

Windows 2.4.17 bu bilgisayara kuruldu; kurulu app.asar yayın paketindeki dosyayla aynı SHA256 değerine sahiptir. Windows ve Android güncelleme manifestleri 2.4.17 olarak yayımlandı; canlı indirilen Windows 195.368.693 bayt ve Android 2.731.849 bayt dosyalarının tam SHA256 kontrolü başarılıdır. Site program rehberi ve güncelleme notları yayımlandı. Android telefonun kurulum onayı uzaktan verilmedi; kullanıcı cihazında güncelleyip bulut seçeneğini açmalıdır.

## Yalnız kurulu uygulama — 14 Ekim 2026 / 2.4.18

Kullanıcı web çalışma arayüzünü istemediğini düzeltti. Windows ekranları artık loadFile ile paket içinden, Android ekranları veniux.local sanal originindeki APK varlıklarından açılır. business.veniux.com veri API’si ortak kayıtlar için tutulur; VENIUX_API_ONLY=1 ile /login ve ön yüz dosyaları sunulmaz. Bu düzenleme internet API’sini erişilmez veya tüm saldırılara karşı korumalı yapmaz. API giriş, tenant/rol ve MFA denetimlerini korur. Bulut asistanının anonim ziyaretçi/ses çağrıları da kimlik doğrulamaya alınmıştır.

Windows minimum pencere boyutu 480x440 olarak düzenlendi. Kapatma düğmesi sistem tepsisine gizler; tepsi simgesi tıklama/çift tıklamayla yeniden açılır. Tepsi menüsünde açık Programdan çık komutu vardır. Paket içindeki ikon, pencere ayarları ve yerel ekran yükleme kodu kontrol edildi. Saha/bayi menüsü programda bulunur; davetler VNXB1 kodu olarak program içinden kabul edilir.

Yapay zekâ sorunu: sağlayıcı anahtarları yerel özel ayarlarda vardı, bulut runtime env içinde yoktu. Kullanıcının açık onayıyla NVIDIA/Gemini ayarları şifreli paketle aynı Plesk hesabının özel data/integrations.env dosyasına aktarıldı (0600). EXE/APK içine konulmadı. Windows asar ve ön yüz varlıklarında gerçek sağlayıcı anahtarlarının bulunmadığı doğrulandı. NVIDIA gerçek metin yanıtı ve Google ses üretimi sağlayıcı testi başarılı. Sunucuda ayrı sentetik işletmeyle yetkili AI sohbeti gerçek yanıt verdi; web UI 404 ve anonim AI 401 kontrolleri başarılı. Yerel 8 bağlantı testi, 13 AI/portal testi geçti.

Asıl kullanıcı MFA’sı aşılmadı. Gerçek Android cihaz ve Windows tepsi etkileşimi burada UI otomasyonu ile test edilmedi; paket ve sunucu kontrolleri bu sınırla değerlendirilmelidir. Kaynak yerel işletme veritabanı silinmedi.

2.4.18 canlıya alındı ve Windows kurulumu tamamlandı. Kurulu app.asar yayın dosyasıyla aynı SHA256 değerine sahiptir. APK içindeki tüm ZIP girdilerinde gerçek NVIDIA/Gemini anahtarları bulunmadığı kontrol edildi. Canlı / ve /login 404; /assets/index.js ve /data/integrations.env 404; yetkisiz katalog ve anonim AI 401; genel kayıt 403; sağlık 200 ve sahip girişinde MFA gerekli. Plesk varsayılan public/index.html sayfası da özel alana geri alınabilir şekilde taşındı. Windows 195.807.166 bayt ve Android 2.731.849 bayt dosyalarının tam indirme SHA256 kontrolleri başarılı. Site sürüm bilgisi ve program rehberi 2.4.18 olarak yayımlandı.

## Hesapla giriş / lisans ekranı düzeltmesi — 14 Ekim 2026 / 2.4.19

Kullanıcı ortak sunucu bağlantısında HW cihaz kodunu lisans anahtarına yazdığı ekranı bildirdi. Cihaz kimliği hiçbir zaman lisans olarak kabul edilmedi. Asıl kullanıcı deneyimi sorunu, account-based cloud modunda /activate sayfasının hâlâ VNX formu göstermesiydi. Sunucu /api/license/policy şimdi activation_mode=account bildirir; program LicenseActivation bunu doğrulayınca /login'e yönlenir. Yerel kurulum activation_mode=license_key olarak kalır. Anonim auth/me ve normal-depo/products erişiminin 401 olduğu iki regresyon testi başarılıdır. Salt okunur ön izlemede gerçek canlı politika kullanılarak /activate → /login yönlenmesi tarayıcıda doğrulandı.

api.veniux.com/v1/activate üzerinde HW kodu DEVICE_ID_NOT_LICENSE ile 403 döner ve hesap/yerel lisans ayrımını açıklar. Sunucu hata maskelemesi bu belirli güvenli açıklamayı kaybetmez. Gerçek API testinde doğrulandı. Sahip parolası, MFA ve müşteri yetkileri değiştirilmedi. Bu sürümün kurulumu sırasında açık Veniux işlemi tespit edildi; kullanıcıdan programı tepsi menüsündeki Programdan çık ile kapatması istendi. Açık program zorla durdurulmadı.

2.4.19 Windows/Android güncellemesi merkezi kanala yayımlandı. Bu bilgisayarda Veniux hâlâ açık olduğundan kurulum yapılmadı; kullanıcı kapatma yanıtı bekleniyor. Yayınlanan Windows boyutu 195.400.332 bayt. Sunucu/API değişiklikleri canlıdadır. Kurulu sürümün değiştirildiği iddia edilmemelidir.

Kullanıcının programı tamamen kapattığını bildirmesinden sonra Windows 2.4.19 kuruldu (kurulum çıkış kodu 0). Kurulu app.asar yayın paketindeki dosyayla aynı SHA256 değerine sahiptir; paket sürümü 2.4.19 olarak doğrulandı. server-selection.json external/business.veniux.com/api hedefini koruyor. Önceki kurulum bekleniyor durumu artık geçerli değildir. Gerçek sahip oturumunun MFA adımı kullanıcı tarafından tamamlanmalıdır; burada MFA atlanmadı.

## Zorunlu lisans ve mobil tasarım — 14 Ekim 2026 / 2.4.20

Kullanıcının yeni talebi önceki 2.4.19 hesapla giriş politikasının yerini alır. Sahip/platform yöneticisi dahil program erişimi geçerli lisans gerektirir. Merkezi bulut erişiminde imzalı cihaz doğrulaması, lisansın işletmeye bağlanması ve her istekte süre/iptal kontrolü uygulanır. Yetki, parola ve MFA kontrolleri korunmuştur. HW cihaz kimliği lisans değildir; gerçek VNX anahtarı gerekir. Sahip hesabına otomatik ücretsiz lisans verilmemiştir.

18 yerel test başarılı. Plesk üzerinde izole veritabanı ve sentetik imzalı otoriteyle geçerli, eksik, süresi dolmuş, iptal, farklı işletme ve bozuk imza senaryoları başarılı. Canlı sunucuda migration 030 güncel, health 200, central_required true, offline_allowed false; lisanssız login/products 423, web login 404. Özel veritabanı ve önceki startup yedeği korunmuştur. Gerçek sahip MFA girişi veya gerçek VNX aktivasyonu yapılmamıştır.

Windows/Android 2.4.20 yayımlandı; iki dosyanın tam indirme SHA256 ve boyutları doğrulandı. Mobil özet, sabit alt menü, barkod kısayolu, kart ürün listesi, açılır stok uyarıları ve bağlantı ekranı yenilendi. 390x844 önizlemede yatay taşma yok ve ürün araması başarılı. Gerçek Android kamera/QR testi yapılmadı. Google Play/Microsoft Store onayı henüz yok; gerekli işler VENIUX-MAGAZA-ONAY-REHBERI.md içinde.

Kurulum doğrulamasında NSIS customInit içindeki MessageBox sessiz /S kurulumunda da yanıt bekledi. Yalnız bu turda başlatılan bekleyen kurulum işlemi durduruldu; Veniux uygulaması kapatılmadı. IfSilent ile bu bilgilendirme sessiz güncellemelerde atlanacak şekilde düzeltildi. Normal elle kurulumda bilgi mesajı korunur. Windows paketi tekrar oluşturulup yeniden doğrulanacaktır.
Son sessiz Windows 2.4.20 kurulumu çıkış kodu 0 ile tamamlandı. Kurulu app.asar sürümü ve SHA256 yayın paketiyle aynı; cloudLicenseBinding servisi ve 030 migration dosyası kurulumda mevcut. Bekleme penceresi sorunu çözüldü.

## Saha ve bayi ortak çalışma alanı — 14 Ekim 2026 / 2.4.21

/business ayrı sayfa kabuğundan çıkarılıp ortak Layout içine alındı. İkinci marka başlığı ve çıkış düğmesi kaldırıldı. Gerçek kayıt sayıları, bölüm sekmeleri, boş liste kısayolları ve uyumlu yüzeyler eklendi. Backend iş kuralları, lisans ve rol denetimleri değişmedi. İzole lisanslı örnek işletmede ortak sol menü, sipariş formuna geçiş ve 390px telefon genişliğinde taşma kontrol edildi; gerçek müşteri kayıtları kullanılmadı. Frontend ve Android paket derlemeleri başarılı.
2.4.21 Windows/Android yayımlandı ve tam indirilen dosyaların SHA256/boyutları doğrulandı. Bu bilgisayardaki Windows kurulumu çıkış kodu 0 ile tamamlandı; sürüm, app.asar ve frontend giriş dosyası yayın paketiyle eşleşir. Ortak saha ve bayi ekranı kurulu pakette doğrulandı.

## Asistan geçici hata düzeltmesi — 14 Ekim 2026

Kullanıcı 2.4.21 sohbetinde genel sunucu hatası bildirdi. Plesk erişim günlüğünde 03:28:50 POST /api/ai/chat için HTTP 502 görüldü. Kesin alt hata nedeni logda görünmedi; sonraki özel CLI testinde veri bağlamı, 144 araç kataloğu, gerçek NVIDIA bağlantısı ve sentetik tam sohbet başarılıydı. Bildirilen mesaj da sentetik bağlamla çalıştı. Gerçek müşteri bağlamı sağlayıcıya test için gönderilmedi.

Geçici bağlantı/5xx ve geçersiz JSON yanıtlarına en fazla bir yeniden deneme eklendi. Kod bloğu içinde geçerli JSON güvenli şekilde çözümlenir; kısmi/bozuk yanıt işlem olarak çalıştırılmaz. Cevap bütçesi 2048 token, toplam sağlayıcı denemesi en fazla yaklaşık 40 saniyedir. 429 ve anahtar/yetki hataları yeniden denenmez. Üretimde yalnız sabit güvenli AI hata açıklamaları gösterilir; iç hatalar maskelenmeye devam eder. İki test kümesinde 9 test başarılı. Üç sunucu dosyası özel yedek tutularak güncellendi ve uygulama yeniden başlatıldı. Lisans/rol/veritabanı değişmedi; başka AI sağlayıcısına otomatik geçiş eklenmedi.
Düzeltme sonrası aynı mesajla sentetik tam sunucu sohbeti tekrar başarılı. Health 200, lisanssız AI isteği 423. Kullanıcının açık Windows oturumundan tekrar gönderimi henüz burada doğrulanmadı; istemciyi yeniden indirmeden bulut düzeltmesinden yararlanabilir.

## Gerçek asistan hata kaydı — 14 Ekim 2026

Kullanıcının tekrar denemesi özel günlükte 00:46:39 UTC (03:46:39 İstanbul), AI_INVALID_RESPONSE, reply_validation, HTTP 502 olarak yakalandı. Önceki geçici sağlayıcı yeniden denemesi bu hatayı çözmemişti. productionPrivacy.boundary güvenli AI hata açıklamasını da yeniden genel sunucu hatasına çeviriyordu. Sohbet reply alanının tür/uzunluk doğrulamasında veya action türünde hata varsa bir şema onarım isteği eklendi; onarımdan sonra tekrar doğrulanır ve geçersiz yanıtla işlem yürütülmez. Güvenlik sınırı yalnız sabit aiPublicErrors listesindeki açıklamaları geçirir; SQL, token ve iç hata mesajları gizli kalır. 11 test başarılı. Gerçek kullanıcının son doğrulaması bekleniyor.
Kullanıcı son canlı program denemesinde “Yanıt geldi” diyerek sorunun çözüldüğünü doğruladı. Yanıt şeması/sağlayıcı için 11, üretim hata sınırı için 2 test geçti. Toplam 13 test. Program yeniden indirilmedi; sunucu düzeltmesi mevcut bulut bağlantısında çalıştı.

## Mobil barkod ekranı — 14 Ekim 2026 / Android 2.4.22

Mobil ScannerPanel, teknik HID/seri port panelinden ayrı sade kamera düğmesi, isteğe bağlı numara girişi ve ayarlar bağlantısı kullanır. Kamera tam ekran video ve barkod çerçevesiyle açılır; mevcut cihaz içi BarcodeDetector ve stream kapatma akışı korunur. RetailQuickAdd mobilde yinelenen barkod alanını ve teknik açıklamaları gizler. 390x844 izole önizlemede görünüm ve elle barkoddan yeni ürün formuna geçiş doğrulandı; gerçek Android kamera testi yapılmadı.

Plesk üzerinde aktif sürümün shared/scanner.mjs dosyasının eksik olduğu doğrulandı (present before fix false). Dosya eklendi, varsayılan ayar ve clean fonksiyonu kontrolü geçti. Gelecek sunucu ve Windows paketleri ortak modülü dahil edecek şekilde düzeltildi. 5 barkod çekirdek testi geçti. Android 2.4.22 sürümCode262 yayımlandı; tam APK SHA256/boyut doğrulandı, yeni mobile-scan-launch ve mobile-camera-frame kodları paket içinde doğrulandı. Windows sürüm 2.4.21 olarak kaldı.

## Referansa göre mobil kullanım — 14 Ekim 2026 / Android 2.4.23

Kullanıcının gönderdiği video tasarım referansı olarak incelendi. Mobil ana ekran, mevcut ve yetkili işlemlere açılan altı simgeli sade panel olarak düzenlendi. Ürün sayısı artık tüm ürün kayıtları yerine mevcut dashboard-stats sayım sorgusuyla alınır; eski istekler iptal edilir. Barkod lookup için genel veri değişikliği yayını kaldırıldı.

Mobil okuyucu Ürünü bul / Fiyatı gör modları ve kamera altında ürün adı, gerçek satış fiyatı, seçili depo stoğu gösterir. Fiyat görüntüleme kayıt yazmaz. Ürünle devam et kamerayı kapatır, veri yeniden sorgulanmadan mevcut sonuçla kabul formunu açar; stok ekleme ayrıca kullanıcı onayıyla ve backend yetkileriyle yapılır. Yeni okutma açık düğmeyle başlar; aynı kare tekrar sorgulanmaz. Analiz 250ms aralıkla yalnız çerçeve alanına, tek canvas ve en fazla 640px genişliğe uygulanır. Görüntüler sunucuya gönderilmez. Fener mevcut video track yeteneğine bağlıdır; kamera değiştirme önceki stream’i kapatır. Kapatma ve Escape temizler; klavye odağı panel içinde tutulur.

İzole örnek işletmede ve kamera API’sini taklit eden test düzeneğinde otomatik ürün bulma, 49,90 TL kayıtlı fiyat, seçili depo stoğu, fiyat modu, kamera kapanması ve kabul formuna geçiş doğrulandı. 390px görünümde yatay taşma yok. Bu gerçek Android kamera veya fener testi değildir. Backend barkod/kabul kuralları için 14 test geçti. APK içindeki tüm frontend assets dosyaları son derlemeyle SHA256 olarak karşılaştırıldı. Android 2.4.23 versionCode263 yayımlandı ve tam indirilen APK boyut/SHA256 doğrulandı. Windows güncel sürümü 2.4.21 kaldı.
