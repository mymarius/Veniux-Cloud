<?php
declare(strict_types=1);
$history = [
 ['version'=>'2.4.23','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Mobilde daha kolay günlük işlemler.','platforms'=>['android'],'summary'=>'İşlem simgeleriyle sade ana ekran; fiyat ve ürün kontrolü için tam ekran barkod okuyucu.','groups'=>[
 'Mobil deneyim'=>['Ana ekranda depo, ürün, rapor, mal kabul, sayım ve yetkili saha işlemleri için büyük simgeler düzenlendi.','Barkod ekranına Ürünü bul ve Fiyatı gör seçenekleri eklendi.','Okunan ürünün adı, kayıtlı satış fiyatı ve stok bilgisi kamera altındaki panelde gösterilir.','Ürünle devam et seçimi kontrol formunu açar; okutmak tek başına stok değiştirmez.','Destekleyen kameralarda fener ve ön/arka kamera değiştirme düğmeleri eklendi.'],
 'Performans'=>['Ana ekran ürün sayısını almak için tüm ürün kataloğunu indirmez.','Barkod sorgusu diğer ekranlarda gereksiz veri yenilemesi başlatmaz.','Kamera taraması çerçeve alanıyla sınırlıdır; ürün bulunduğunda tekrar sorgular durur.','Depo değişiminde eski sorgu sonuçları atılır; kameradan çıkıldığında akış kapatılır.']
 ],'notice'=>'Android 2.4.23 güncellemesi gerekir. Kamera ve fener desteği cihaza bağlıdır. Windows sürümü 2.4.21’dir.'],
 ['version'=>'2.4.22','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Telefonda daha sade barkod okuma.','platforms'=>['android','api'],'summary'=>'Kamera ekranı tam ekran açılır; numarayla giriş ayrı tutulur.','groups'=>[
 'Android'=>['Barkod sayfası tek kamera düğmesi ve sade işlem seçenekleriyle düzenlendi.','Kamera görüntüsü tam ekran, barkod çerçevesi ve kolay kapatma düğmesiyle gösterilir.','Barkod numarasıyla giriş isteğe bağlı açılır.','Mobilde tekrarlanan barkod alanları ve teknik HID/seri port açıklamaları kaldırıldı.'],
 'Sunucu'=>['Okuyucu ayarlarını yüklemek için gereken eksik ortak barkod dosyası sunucu paketine eklendi.']
 ],'notice'=>'Android 2.4.22 APK güncellemesi gerekir. Windows son sürümü 2.4.21’dir. Kamera görüntüleri sunucuya gönderilmez; ürün ve stok kaydı ayrıca onaylanır.'],
 ['version'=>'2.4.21','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Saha ve bayi, programın içinde.','platforms'=>['windows','android'],'summary'=>'Saha ve bayi ekranı diğer çalışma alanlarıyla aynı menü ve görünümü kullanır.','groups'=>[
 'Asistan'=>['Bulut asistanında geçici sağlayıcı ve bozuk yanıt hataları için bir yeniden deneme eklendi.','Yanıt biçimi doğrulaması güçlendirildi; sağlayıcı hataları açıklayıcı mesajlarla gösterilir.'],
 'Güncellenenler'=>['Saha ve bayi açıldığında sol menü ve ortak üst çubuk korunur.','Ayrı Veniux İşletme başlığı ve ikinci çıkış düğmesi kaldırıldı.','Gerçek kayıtlardan sipariş, inceleme bekleyen, onaylanan ve erişilen müşteri özeti eklendi.','Sipariş, ziyaret ve ekip bölümleri ortak sekme düzenine taşındı.','Boş sipariş listesine ilk sipariş ve müşteri ekleme kısayolları eklendi.','Telefonlarda özet kartları ve sekmeler ekran genişliğine uyum sağlar.']
 ],'notice'=>'Lisans ve yetki denetimleri korunur. Sipariş onayı stok çıkışı, tahsilat veya fatura oluşturmaz.'],
 ['version'=>'2.4.20','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Zorunlu lisans, telefona uygun çalışma ekranları.','platforms'=>['windows','android','api'],'summary'=>'Sahip hesabı dahil program erişimi geçerli lisans gerektirir; Android arayüzü yenilendi.','groups'=>[
 'Güvenlik'=>['Geçerli VNX lisansı olmadan program oturumu açılamaz.','İptal edilen veya süresi dolan lisans açık oturumların veri erişimini de engeller.','Bulut lisansı bir işletmeye bağlanır; başka işletmenin hesabıyla kullanılamaz.'],
 'Android'=>['Ana ekrana büyük barkod düğmesi ve dört hızlı işlem eklendi.','Özet, ürünler, barkod, depolar ve menü için sabit alt gezinme eklendi.','Ürün listesi telefonlarda kartlarla gösterilir; stok uyarıları açılır bölüme taşındı.','Bağlantı ve giriş ekranlarında boşluklar, düğmeler ve okunabilirlik iyileştirildi.'],
 'Windows'=>['Sessiz güncellemede bilgilendirme penceresinin kurulumu bekletmesi düzeltildi.']
 ],'notice'=>'2.4.19 sürümündeki yalnız hesapla giriş bu sürümde kaldırılmıştır. Geçerli VNX anahtarı gerekir; HW cihaz kimliği lisans değildir. Mağaza onayı henüz alınmamıştır.'],
 ['version'=>'2.4.19','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Ortak sunucuda hesabınızla giriş yapın.','platforms'=>['windows','android','api'],'summary'=>'Hesapla çalışan bağlantıda gereksiz lisans anahtarı ekranı kaldırıldı.','groups'=>[
 'Düzeltmeler'=>['Ortak sunucuya bağlı programda lisans ekranı otomatik olarak hesap girişine yönlenir.','Merkezi API, HW cihaz kodunun lisans anahtarı olmadığını ve doğru erişim yolunu açıkça belirtir.','Yerel kurulumlarda VNX lisans kontrolü korunur; hesap ve iki adımlı doğrulama denetimi kaldırılmaz.']
 ],'notice'=>'HW kodunu lisans alanına yazmayın. Ortak bağlantıda e-posta, şifre ve varsa doğrulama kodunuzla giriş yapın.'],
 ['version'=>'2.4.18','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Yalnız programdan kullanım, daha esnek pencere.','platforms'=>['windows','android','site','api'],'summary'=>'Ekranlar kurulu uygulamadan açılır; web çalışma arayüzü kapatıldı.','groups'=>[
 'Windows'=>['Program ekranları Windows paketinin içinden açılır; bulut yalnız veri bağlantısı sağlar.','Pencere en az 480 × 440 piksele küçültülebilir.','Kapatma düğmesi programı saat yanındaki sistem tepsisine gizler. Simgeyle yeniden açabilir, Programdan çık menüsüyle tamamen kapatabilirsiniz.'],
 'Android'=>['Bulut bağlantısı kurulu uygulamanın kendi ekranları üzerinden çalışır. Yerel Wi-Fi/QR seçeneği korunur.','Saha/bayi davetleri web sayfası yerine programdaki Davet kodum var ekranından kabul edilir.'],
 'Yapay zekâ'=>['Sunucudaki eksik sağlayıcı bağlantısı düzeltildi; gizli anahtarlar kurulum dosyalarına konulmaz.','Ayrı test işletmesinde gerçek sağlayıcı yanıtı ve yetkili erişim doğrulandı.','Anonim bulut asistanı çağrıları engellendi; kayıtları değiştiren işlemler açık onay gerektirir.']
 ],'notice'=>'Bilgisayar ve Android aynı sunucu kayıtlarını internet üzerinden kullanır. Ortak veri API’si çalışmaya devam eder; web giriş ve çalışma ekranları sunulmaz. İnternet ve varsa iki adımlı doğrulama gerekir.'],
 ['version'=>'2.4.17','date'=>'2026-10-14','date_label'=>'14 Ekim 2026','title'=>'Bilgisayar ve Android için bulut bağlantısı.','platforms'=>['windows','android','site'],'summary'=>'Aktarılmış işletmeler için aynı kayıtlar internet üzerinden kullanılabilir.','groups'=>[
 'Eklenenler'=>['Yeni Windows kurulumlarında Veniux bulut bağlantısı açılır. Mevcut yerel işletmelerin bağlantısı otomatik değiştirilmez.','Android bağlantı ekranına Veniux buluta bağlan seçeneği eklendi; yerel QR bağlantısı korunur.','Buluta aktarılmış aynı işletme hesabıyla bilgisayar ve Android aynı sunucu kayıtlarını kullanır.','Saha/bayi portalında müşteri atama, davet, sipariş inceleme ve ziyaret notları kullanılabilir.'],
 'Güvenlik'=>['Giriş, kullanıcı yetkileri ve etkin iki adımlı doğrulama sunucuda denetlenir.','Bulut erişimi HTTPS üzerinden çalışır; uygulama içi gezinme resmî işletme alanıyla sınırlıdır.']
 ],'notice'=>'Bulut kullanımı internet ve önceden aktarılmış işletme gerektirir. Eski yerel kurulumlar kendiliğinden taşınmaz. Android’de Bağlantıyı değiştir → Veniux buluta bağlan seçeneğini kullanın. Sipariş onayı stok çıkışı veya fatura oluşturmaz.'],
 ['version'=>'2.4.16','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Depo hareketlerini daha yakından görün.','platforms'=>['windows','android','site'],'summary'=>'Stok Analizi ekranı ve yandan açılan mobil menü.','groups'=>[
 'Eklenenler'=>['Stok ve Depo menüsüne Stok Analizi ekranı eklendi.','Depo ve 30/90 günlük dönem seçimiyle hareket yoğunluğu, işlem sayısı ve miktar payı görüntülenir.','Çıkış kaydı olmayan ürünler ayrı bir grupta gösterilir; grup düğmeleri listeyi filtreler.'],
 'Düzeltmeler'=>['Hareketsiz ürünlerin yoğun hareket grubuna girmesi engellendi.','Analiz sorgusunda firma ve genel stok kapsamı açıkça uygulandı; geçersiz dönemlere uygun hata yanıtı eklendi.'],
 'Site'=>['Mobil menü sağdan kısa animasyonla açılan panel olarak düzenlendi.','Menüde ekran arkası perde, klavye odağı, Escape ve kapatma düğmesi eklendi. Hareket azaltma tercihi desteklenir.','Yerel yazı tipi ilk yüklemede daha erken indirilecek şekilde düzenlendi.'],
 ],'notice'=>'Hareket analizi satış geliri veya talep tahmini değildir; rapor stokları değiştirmez. Uzaktan saha ve bayi erişimi bu sürümde devreye alınmamıştır.'],
 ['version'=>'2.4.15','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Mağaza ve depoda işinize daha kolay ulaşın.','platforms'=>['windows','android','site'],'summary'=>'Program araması düzeltildi; web sitesi daha okunaklı ve tutarlı hale getirildi.','groups'=>[
  'Düzeltmeler'=>['Program aramasındaki mal kabul, raf, toplama, sevkiyat, sayım ve terminal bağlantıları gerçek çalışma ekranlarına bağlandı.','Arama sonuçlarındaki işlem adları günlük kullanıma uygun, kısa Türkçe adlarla güncellendi.'],
  'Güncellenenler'=>['Siteye Türkçe karakterleri destekleyen, yerel ve sıkıştırılmış Manrope yazı tipi eklendi.','Üst menü marka ve gezinme için iki satır halinde yeniden düzenlendi.','Örnek akış sekmelerine iç boşluk ve yuvarlatılmış kenarlar eklendi.','Koyu temada örnek akış, form ve düğmelerin renkleri mavi paletle uyumlu hale getirildi.','İletişim formunun masaüstü ve telefon yerleşimi iyileştirildi.'],
 ],'notice'=>'Android bilgisayardaki aynı işletme verilerine yerel ağdan bağlanır; bilgisayar ve Veniux açık kalmalıdır.'],
 ['version'=>'2.4.14','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Stok ve depo yönetimine odaklandık.','platforms'=>['windows','android','site'],'summary'=>'Ürün kapsamı genel stok ve depo operasyonlarına odaklandı.','groups'=>[
  'Güncellenenler'=>['Kullanımdan kaldırılan çalışma alanları, menüler ve arama kısayolları temizlendi.','Ürün kapsamında olmayan işlemler API ve yapay zekâ araçlarından çıkarıldı.','Windows ve Android aynı stok, depo, kasa ve CRM çalışma alanlarını kullanır.','Windows kurulum paketindeki geliştirme ve test bağımlılıkları çıkarıldı.','Kullanımdan kaldırılan arka plan görevleri temizlendi.'],
 ],'notice'=>'Genel lot ve son kullanma tarihi takibi korunur. Güncelleme mevcut işletme kayıtlarını silmez.'],
 ['version'=>'2.4.12','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'İstek güvenliği güçlendirildi.','platforms'=>['windows','android','site','api'],'summary'=>'Site, merkezi API ve Windows programı için uygulama düzeyinde istek koruması.','groups'=>[
  'Eklenenler'=>['Aşırı istekleri sınırlayan, gizli dosya taramalarını ve kodlanmış üst klasör erişimini engelleyen koruma katmanı eklendi.','Windows programında tehlikeli JSON alanları ve aşırı derin istek yapıları reddedilir.','Site ve API’de uygunsuz yöntemler, fazla büyük istekler ve tarayıcıdan gelen siteler arası yazma istekleri denetlenir.'],
  'Güncellenenler'=>['İstek sınırları, normal ürün metinleri ve izinli dosya yüklemeleriyle uyumlu olacak şekilde düzenlendi.','Koruma, QR bağlantısı, lisans doğrulaması, hesap girişi ve parçalı güncelleme yüklemesiyle birlikte test edildi.'],
 ],'notice'=>'Bu katman uygulama isteklerini korur. Sunucu portları, DNS güvenliği ve tüm saldırılara karşı korunma ayrı değerlendirilir.'],
 ['version'=>'2.4.11','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Güncellemeler tek merkezden.','platforms'=>['windows','android','api'],'summary'=>'Windows ve Android için yeni sürüm uyarısı ve ortak yayın ekranı.','groups'=>[
  'Eklenenler'=>['Windows ve Android uygulamalarına açılışta ve yaklaşık 5 dakikada bir yeni sürüm kontrolü eklendi. Kapalı uygulamalar yeniden açıldığında kontrol eder.','Windows’ta yeni sürümü indirme ve yeniden başlatarak kurma uyarıları eklendi.','Android’de yeni APK’yı indirme, dosya bütünlüğünü ve uygulama imzasını doğrulama, ardından telefonun kurulum ekranını açma akışı eklendi.'],
  'Güncellenenler'=>['Sürüm yönetimi ekranı Windows ve Android dosyalarının aynı merkezden yayımlanacağı şekilde düzenlendi.','Büyük kurulum dosyaları küçük parçalarla yüklenir. Parçalar tamamlanmadan dosya indirilmeye açılmaz; sürüm bilgisi doğrulandıktan sonra güncelleme duyurulur.','Yeni yayınlarda dosya boyutu ve özeti kontrol edilir. Eski sürümün yeniden yayımlanması ve mevcut kurulum dosyasının aynı adla değiştirilmesi engellenir.','Sitedeki Windows ve Android indirme bağlantıları merkezi yayımlanmış sürüme bağlandı.'],
 ],'notice'=>'Bu özellik için Windows ve Android’i bir kez 2.4.11 veya sonraki sürüme yükseltin. Sonraki sürümler uygulamada duyurulur. Android kurulumu telefonun onayını gerektirir.'],
 ['version'=>null,'date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Site ve API iyileştirmeleri.','platforms'=>['site','api'],'summary'=>'İndirmeler, güncelleme geçmişi, hesap erişimi ve site bilgileri bir arada.','groups'=>[
  'Eklenenler'=>['Sürüm tarihlerini, yeni özellikleri ve düzeltmeleri bir arada gösteren güncelleme notları sayfası eklendi.','Windows ve Android için program tanıtımı, kurulum açıklamaları ve hesapla erişilen indirme sayfası eklendi.','Kullanım koşulları, gizlilik politikası, KVKK aydınlatma metni ve çerez politikası yayımlandı.','Alt menüye Discord topluluğu bağlantısı eklendi.','Telefon, tablet ve Android el terminali için üç adımlı Wi-Fi/QR bağlantı rehberi ve bağlantı sorunları için kısa kontrol listesi eklendi.'],
  'Güncellenenler'=>['Site, bağımsız Windows programı ve aynı bilgisayara bağlanan Android uygulaması için düzenlendi; tarayıcıdaki çalışma uygulaması kullanım dışına alındı.','Sayfa başlıkları, açıklamalar, asıl sayfa adresleri, yapılandırılmış bilgiler ve site haritası arama motorları için düzenlendi.','Sayfa içi menü bağlantıları, tıklama sonrasında adres çubuğunda bölüm kodu bırakmayacak şekilde güncellendi.','Menü aralıkları, program indirme bağlantısı ve site sekmesindeki logo düzeltildi.','Program indirme sayfasında telefonlarda sıkışan başlık ve düğmeler düzeltildi; indirme kartları mobilde tek sütun olacak şekilde düzenlendi.'],
  'Düzeltmeler'=>['Sahip hesabının sitedeki girişi merkezi yönetici doğrulamasına bağlandı; müşteri kayıtları açık tutuldu.','API yanıtlarına güvenlik başlıkları eklendi ve teknoloji/sürüm bilgisini gösteren başlık kaldırıldı.','Bulunmayan API adresleri için doğru hata yanıtı, güvenlik bildirim dosyası ve yönetici giriş denemelerine hız sınırı düzenlendi.'],
 ]],
 ['version'=>'2.4.10','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'QR okut, açık hesabınla devam et.','platforms'=>['windows','android','api'],'summary'=>'Mobil bağlantıda tekrar hesap ve lisans girişi yerine doğrulanmış QR eşleştirmesi.','groups'=>[
  'Eklenenler'=>['Bilgisayarda açık olan kullanıcı hesabıyla Android’e otomatik giriş eklendi.','Mobil bağlantı ekranına “Yeni QR kodu oluştur” seçeneği eklendi. QR kodu 2 dakika geçerli ve tek kullanımlıdır.'],
  'Düzeltmeler'=>['QR okutulduktan sonra yalnız giriş/lisans ekranının açılması sorunu giderildi.','Mobil oturum başlamadan önce cihaz ve lisans bilgileri ayarlanır; kullanıcı durumu ve oturum geçerliliği yeniden kontrol edilir.','Telefonun terminal hakkı ayrıca denetlenir. Terminal sınırı veya geçersiz eşleştirme durumunda açıklayıcı hata gösterilir.'],
 ],'notice'=>'Telefon/tablet ve bilgisayar aynı yerel ağda olmalı; bilgisayar ve Veniux açık kalmalıdır. QR kodu hesap şifresini içermez.'],
 ['version'=>'2.4.9','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Sahip hesabı, ortak giriş.','platforms'=>['windows','site','api'],'summary'=>'Site, API yönetimi ve programda sahip hesabının aynı kimlikle doğrulanması.','groups'=>[
  'Güncellenenler'=>['Sahip hesabının e-posta ve şifresi site, API yönetimi ve program için merkezi doğrulamaya bağlandı.','Sahip hesabının yönetici yetkisi mevcut işletme ve kullanıcı kayıtları korunarak düzenlendi.'],
  'Düzeltmeler'=>['Site girişinde sahip hesabının doğrulanamaması düzeltildi.','Site hesabında sahip/yönetici bilgisi gösterildi. Müşteri kayıtları ve müşteri kullanıcıları korunur.','İki adımlı doğrulama açık olan program hesaplarında ek doğrulama korunur.'],
 ]],
 ['version'=>'2.4.8','date'=>'2026-10-13','date_label'=>'13 Ekim 2026','title'=>'Bilgisayarda yönet, Android’de bağlan.','platforms'=>['windows','android'],'summary'=>'Windows kurulum paketi ve aynı işletme verilerine erişen Android telefon/tablet uygulaması.','groups'=>[
  'Eklenenler'=>['Windows için bağımsız kurulum dosyası ve Android telefon/tablet için imzalı uygulama paketi yayımlandı.','Android’in bilgisayardaki işletme API’sine şifreli yerel ağ bağlantısı ile erişmesi sağlandı.','Bilgisayardaki mobil bağlantı ekranına QR kodu ve elle girilebilen eşleştirme kodu eklendi.'],
  'Güncellenenler'=>['İşletme verileri bilgisayarda tutulur; Android ayrı bir stok veritabanı oluşturmak yerine aynı kayıtlara bağlanır.','Windows kurulumu, yerel sunucu hazırlığı ve veri klasörünü koruyan sunucu seçimi düzenlendi.'],
 ]],
 ['version'=>'2.4.7','date'=>'2026-10-12','date_label'=>'12 Ekim 2026','title'=>'Yerel sunucu ve yönetim düzeltmeleri.','platforms'=>['windows','api'],'summary'=>'Veritabanı bakım bilgileri, lisanslı otomasyon ve bildirim gizliliği.','groups'=>[
  'Düzeltmeler'=>['MySQL bakım işlemi, MySQL’e uygun istatistik güncellemesi yapacak şekilde düzeltildi.','Veritabanı boyutu ve bellek bilgileri kullanılan sisteme uygun biçimde gösterildi; doğrulanmamış eşitlik ve geri dönüş iddiaları kaldırıldı.','Stok miktarlarındaki gereksiz sıfırlar temizlendi.','Bildirim yanıtlarında telefon numarasının açık görünmesi engellendi.'],
  'Güncellenenler'=>['Harici hizmet ayarlarının özel yerel veri klasöründen yüklenmesi düzenlendi.','Manuel ve zamanlanmış otomasyonların lisans ve paket hakları merkezi sunucudan doğrulanacak şekilde güncellendi.'],
 ]],
];
$catalog = require __DIR__.'/release-catalog.php';
$recent = [[
 'version'=>'2.4.38','date'=>'2026-10-16','date_label'=>'16 Ekim 2026','title'=>'Standart Windows kurulumu geri getirildi.','platforms'=>['windows'],
 'summary'=>'Özel kurulum ekranları kaldırıldı. Güncel Windows indirme ve otomatik güncelleme kanalı 2.4.38 sürümüdür.',
 'groups'=>['Windows'=>['Standart NSIS klasör seçimi, ilerleme ve bitiş ekranları geri getirildi.','Yeni kurulumlarda yerel veya HTTPS bağlantısı programın ilk açılışında seçilir; mevcut kayıtlı işletme hedefi korunur.']],
 'notice'=>'Windows kurulum dosyasında henüz yayıncı imzası yoktur; ilk açılışta Windows uyarısı çıkarsa kurulum sayfasındaki adımları izleyin.'
], [
 'version'=>'2.4.33','date'=>'2026-10-16','date_label'=>'16 Ekim 2026','title'=>'Veniux kimliğiyle kurulum ve okunabilir sponsor alanı.','platforms'=>['windows','site'],
 'summary'=>'Kurulum sayfaları Veniux logosu, mavi-turuncu vurgular ve numaralı bağlantı adımlarıyla yenilendi.',
 'groups'=>['Windows'=>['Özel NSH karşılama ve bağlantı seçimi sayfaları eklendi.','Giriş ekranında sponsor alanının yanlışlıkla büyük yan panel stilini alması düzeltildi.','Kutusu kaldırılan sponsor logosunun ve bağlantılarının okunabilirliği düzenlendi.'],'Site'=>['Tam sayfa çekiminde sabit menüsü kayan ürün görseli, normal pencere çekimiyle değiştirildi.']],
 'notice'=>'Windows kurulum dosyasında henüz yayıncı imzası yoktur; ilk açılışta Windows uyarısı çıkarsa kurulum sayfasındaki adımları izleyin. Android paketi bu yayında değişmedi.'
], [
 'version'=>'2.4.32','date'=>'2026-10-16','date_label'=>'16 Ekim 2026','title'=>'Kurulum ekranında sponsor alanı düzeltildi.','platforms'=>['windows'],
 'summary'=>'Hostimux bağlantısı ve alt açıklama kurulum sayfasının görünür alanına taşındı.',
 'groups'=>['Kurulum görünümü'=>['Sponsor bağlantısı yukarı alındı; alt düğmelerin arkasında yarım kalması giderildi.','Yerel ve ayrı sunucu seçeneklerinin aralıkları düzenlendi.','Program içi sürüm notlarına bu düzeltme eklendi.']],
 'notice'=>'Windows kurulum dosyasında henüz yayıncı imzası yoktur; ilk açılışta Windows uyarısı çıkarsa kurulum sayfasındaki adımları izleyin. Android paketi bu yayında değişmedi.'
], [
 'version'=>'2.4.31','date'=>'2026-10-16','date_label'=>'16 Ekim 2026','title'=>'Windows güncel paketi indirme kanalında.','platforms'=>['windows'],
 'summary'=>'Windows indirme ve otomatik güncelleme kanalı 2.4.21’den 2.4.31’e yükseltildi.',
 'groups'=>['Windows'=>['Etiket atölyesi, telefonla etiket gönderimi için bilgisayar baskı köprüsü ve program içi sürüm notları pakete dahildir.','Kurulum seçimi, giriş ve sistem ayarlarında Hostimux sponsor alanı bulunur.','Mevcut sunucu tercihini koruyan bağlantı ve kurulum akışları test edildi.']],
 'notice'=>'Windows kurulum dosyasında henüz yayıncı imzası yoktur; ilk açılışta Windows uyarısı çıkarsa kurulum sayfasındaki adımları izleyin. Yazıcı bağlantısı cihaza ve sürücüye bağlıdır.'
], [
 'version'=>'','date'=>'2026-10-16','date_label'=>'16 Ekim 2026','title'=>'Daha net ürün görüntüleri ve yeni çözüm sayfaları.','platforms'=>['site'],
 'summary'=>'Web sitesinin içerik, görsel ve talep deneyimi güncellendi.',
 'groups'=>['Site'=>['Barkodlu stok takibi, son kullanma tarihi takibi ve el terminaliyle depo yönetimi için ayrı sayfalar eklendi.','Beş ürün ekranı yüksek çözünürlüklü gerçek uygulama görüntüleriyle yenilendi; tam boy açma açıklaması eklendi.','Demo, teklif, iletişim ve iş ortaklığı talepleri ayrı amaçlarla kaydedilir.','Mobil görünüm, form hata odağı, iç bağlantılar ve sosyal paylaşım görselleri düzenlendi.']],
 'notice'=>'Bu kayıt site yayınıdır; Windows ve Android paketlerini değiştirmez.'
], [
 'version'=>'2.4.32','date'=>'2026-10-15','date_label'=>'15 Ekim 2026','title'=>'Android etiket akışının güncel paketi.','platforms'=>['android'],
 'summary'=>'Etiket atölyesi ve telefonla baskı gönderimi çalışmalarını içeren güncel Android paketi yayınlandı.',
 'groups'=>['Paket doğrulaması'=>['APK imzası ve indirme kanalındaki dosyanın boyutu ile SHA-256 değeri doğrulandı.']],
 'notice'=>'Yazıcı ve telefon eşleştirmesi cihaza bağlıdır. Windows indirme sürümü '.$catalog['downloads']['windows'].' olarak kalır.'
]];
$newer=[];$months=['Ocak'=>1,'Şubat'=>2,'Mart'=>3,'Nisan'=>4,'Mayıs'=>5,'Haziran'=>6,'Temmuz'=>7,'Ağustos'=>8,'Eylül'=>9,'Ekim'=>10,'Kasım'=>11,'Aralık'=>12];
foreach($catalog['releases'] as $release){
 $parts=explode(' ',(string)$release['date']);$isoDate=count($parts)===3&&isset($months[$parts[1]])?sprintf('%04d-%02d-%02d',(int)$parts[2],$months[$parts[1]],(int)$parts[0]):'2026-10-15';
 // 18 Ekim kayıtlarından yeni sürümler listenin başına gelir.
 $target=version_compare($release['version'],'2.4.38','>')?'newer':'recent';
 $$target[]=[
 'version'=>$release['version'],'date'=>$isoDate,'date_label'=>$release['date'],'title'=>$release['title'],
 'platforms'=>$release['platforms'],'summary'=>$release['title'].'.','groups'=>['Güncellenenler'=>$release['items']],'notice'=>$release['notice']
];}
// Herkese açık sayfada yalnız kullanıcıyı ilgilendiren maddeler kalır: uyarı kutuları ve iç test/doğrulama notları gösterilmez.
$internal='/test edildi|testi geçti|test işletmesinde|bağımlılıkları çıkarıldı|SHA-256|imzasız|SmartScreen|HENÜZ YAYIMLANMADI|denenmedi|oluşturulmadı|canlı çıktısı|doğrulandı\.?$/iu';
return array_map(function(array $release) use ($internal):array{
 unset($release['notice']);
 foreach($release['groups'] as $label=>$items){$items=array_values(array_filter($items,fn($item)=>!preg_match($internal,(string)$item)));if($items)$release['groups'][$label]=$items;else unset($release['groups'][$label]);}
 return $release;
},array_merge($newer,require __DIR__.'/release-notes-20261018.php',$recent,$history));
