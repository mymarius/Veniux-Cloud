# Veniux proje kapanış raporu

7 Ekim 2026 — mevcut kapsam incelemesi. 8 Ekim yerel kaynak takip düzeltmeleri son ek bölümde. Yeni iş modülü eklenmedi.

## Karar ve kapsam sınırı

**“Bütün sistem kusursuz ve genel yayına hazır” sonucu verilmez.** SQLite üzerindeki çekirdek depo, satın alma ve market kasa akışları doğrulandı. Mevcut ekranlar ve menüler incelendi; aşağıdaki yanıltıcı veya güvensiz yollar düzeltildi. Dış kurum işlemleri, klinik kaynak kapsamı, fiziksel cihazlar ve başka bilgisayarda kurulum henüz kapanmadı.

Kontrollü yerel beta; doğrulanmış SQLite işlemleri, açıkça belirtilen önizlemeler ve kapalı canlı entegrasyonlarla değerlendirilebilir. Genel internet yayını için B maddeleri kapanmalıdır. Klinik/kurumsal faturalama gibi bir kapsam betadan çıkarılırsa bu karar ürün vaadi, menü, erişim ve kullanıcı bilgilendirmesinde aynı şekilde uygulanmalıdır; bu rapor kapsamı kendiliğinden daraltmaz.

Bu çalışmada mevcut kullanıcı veritabanına satış, stok, sipariş veya geri yükleme uygulanmadı. Tarayıcı incelemesi 44071 portunda ayrı firma/veri klasörüyle yapıldı. Yeniden çalıştırılan iş günü senaryosu başka bir SQLite dosyasındadır. Geliştirme API’si ve kullanıcının mevcut oturumu yeniden başlatılmadı. Bir ilk test girişi, eski üretim derlemesinin geliştirme adresini taşıdığı için hedef test API’sine ulaşmadı; iş verisi değişikliği yapılmadı ve bağlantı hatası düzeltildi.

## Bu incelemede kapatılan bulgular

| Kimlik | Sınıf | Bulgu ve düzeltme | Kabul kanıtı / sonuç |
|---|---|---|---|
| D01 | Yayını engelleyen hata | Üretim derlemesi geliştiricinin VITE_API_URL adresini taşıyordu. Web üretimi kendi sunucusundaki `/api` adresini kullanır; geliştirme ve dosya protokolündeki masaüstü davranışı korunur. | Farklı porttaki ayrı üretim panelinde test hesabıyla giriş ve test firmasının 1 ürün/3 depo verisi görüldü. Geçti. |
| D02 | Yayını engelleyen hata | Eski `/stock/import` mutlak miktarı doğrudan stok üstüne yazıyor, lot/kabul/sayım kurallarını atlıyordu. Uç 410 ile kapatıldı; veri aktarımı mevcut Ürünler ve Mal Kabul ekranlarına bağlandı. | Yetkili/oturumsuz/yabancı firma ve çok satırlı isteklerde stok ve hareket kayıtlarının değişmediği doğrulandı. Geçti. |
| D03 | Tamamlanması gereken iş | Mal kabul, toplama, sevkiyat, transfer, sayım, satın alma, tedarikçi ve stok listesi çalışan rotaları menüden eksikti. Aynı menünün Daha fazla bölümüne ve menü arama envanterine eklendi. | Tarayıcıda bağlantılar göründü; mevcut operasyon sayfaları açıldı. Geçti. |
| D04 | Yayını engelleyen hata | Terminal ping düğmesi API çağırmadan “12 ms başarılı” diyordu; örnek IP, batarya ve çevrimiçi durumu gösteriliyordu. Sahte ping kaldırıldı, desteklenmeyen işlem devre dışı ve kayıt/ölçüm ayrımı açık. | Kaynak incelemesi, derleme ve cihaz ayarı ekranı kontrolü. Fiziksel ping gerçekleştirilmiş sayılmadı. Geçti. |
| D05 | Yayını engelleyen hata | WMS strateji kaydetme düğmesi işlem yapmadan başarı gösteriyordu. Strateji formu açık önizleme olarak kilitlendi. | Devre dışı düğme ve açıklama tarayıcıda görüldü; mevcut FEFO/lot kuralları değişmedi. Geçti. |
| D06 | Güncel kaynakta kısmen giderildi | İlk incelemede görünüm tercihleri uygulamaya bağlı değildi. 10 Ekim kaynak kontrolünde ThemeProvider, appearance boot ve ses kontrolüyle tema/sistem modu/renk/yoğunluk/ses uygulaması ve kaydı doğrulandı. CRM otomasyonu ayrı önizleme kapsamındadır. | Görünümün eski eksiklik kaydı geçersizdir; geniş tarayıcı/rol kabulü T01, CRM kabulü T08'de sürer. |
| D07 | Yayını engelleyen hata | Lisans ekranında lisans yokken Enterprise/ömür boyu lisans ve sabit kapasite sayaçları gösteriliyordu. Doğrulanmış lisans yok durumu ve bilinmeyen kapasite açık gösterilir. | Ayrı ilk yönetici hesabında müşteri lisansı uydurulmadı; canlı sayaç olmadığı görüldü. Geçti. |
| D08 | Yayını engelleyen hata | Sistem teşhisi tek SQLite çalışırken MySQL köprüsü ve doğrulanmamış ONLINE/işçi durumları bildiriyordu. Aktif motor/journal ölçülür; yapılandırma teslimat kanıtından ayrılır. | SQLite ve gerçek journal API testinde, SQLite motoru tarayıcıda görüldü. Geçti. |
| D09 | Tamamlanması gereken iş | `/auth/me` bağlantı hatası lisans yok diye gösteriliyordu. Erişim doğrulanamadı açıklaması ve tekrar deneme eklendi. Eski herkese açık lisans üretici rotası mevcut korumalı yönetim merkezine yönlendirildi. | Eski rota yönetim merkezine yönlendi. Ayrı HTTP 503 hata enjeksiyonunda erişim-hatası ekranı ve tekrar deneme görüldü; yanlış lisans mesajı gösterilmedi. Kanıt: audit/closure-access-error.json. Geçti. |
| D10 | Tamamlanması gereken iş | CSV stok çıktısında bazı kullanıcı metinleri kaçırılmıyor, yanlış uyumluluk/indirme başarı garantileri veriliyordu. Tüm hücreler tırnaklanır, formül başlangıçları metinleştirilir; indirme isteği dosya kaydı olarak sunulmaz. | Kaynak ve derleme kontrolü. Bu stok CSV’sinin gerçek tarayıcı kaydı henüz doğrulanmadı; T05. |
| D11 | Yayını engelleyen hata | Hesap ekranı 2FA yokken “2FA hazır” diyordu; ana sayfada boş `#` bağlantılar ve kanıtsız canlı kurum/SLA/ISO ifadeleri vardı. Çalışan bölümlere bağlandı, eksik iletişim/gizlilik metni açık belirtildi, kanıtsız ifadeler kaldırıldı. | Ayarlar, giriş ve ana sayfa kaynak/ekran incelemesi. Eksik kurumsal metin tamamlanmış sayılmadı; B02. |
| D12 | Tamamlanması gereken iş | CRM hedefi yoksa gerçekleşen tutar hedef olarak uyduruluyordu; fırsat tutarı yinelenen gelir diye adlandırılıyordu. Hedef bilinmiyor gösterilir, tutar kazanılan fırsat kaydı olarak adlandırılır. | Derleme ve mevcut CRM analitik ekranının açılması kontrol edildi. Yeni hedefli/hedefsiz dolu veri görsel karşılaştırması T01 kapsamında bekler. |
| D13 | Yayını engelleyen hata | Varsayılan origin listesi farklı üretim portundaki aynı yerel paneli reddediyordu. Açık CORS yapılandırması yoksa seçili yerel port desteklenir; farklı port ve yabancı siteler reddedilir. | İki geçerli loopback origin ve iki reddedilen origin için HTTP ve veri değişmeme kontrolü. Geçti. |

Önizlemeye çevirmek işlevin tamamlanması değildir: yanıltıcı başarı davranışı kapanmıştır, eksik işlev aşağıdaki tek iş listesinde tutulur. Eski stok importunun kapatılması bilinçli sözleşme değişikliğidir; eski istemci doğrudan miktar yazmak yerine mevcut ürün aktarımı/mal kabul/sayım yollarını kullanmalıdır.

## Ekran ve ana akış envanteri

**Ekranın açılması, bütün düğmelerinin veya bütün rollerinin kabul testi değildir.** Tarayıcı gözlemleri `audit/closure-browser-screens.json` içinde; menü kanıtı `audit/closure-menu.jpg` içindedir. İlk yüklenen ayar sekmesi yalnız yüklenme durumundaysa son durum ayrıca kontrol edildi. Kullanıcı verisi olmadığı için boş grafik/listeler örnek kayıtla doldurulmadı.

| Ekranlar / menü | Son inceleme | İşlev kanıtı ve sınır |
|---|---|---|
| Ana sayfa, giriş, kayıt, lisans aktivasyonu | Tarayıcıda açıldı; giriş tamamlandı, zorunlu telefon alanı görüldü; eski lisans üretici yönlendi. | Kayıt/lisans sunucu testleri mevcut. Bu incelemede yeni gerçek müşteri kaydı veya gerçek lisans satın alımı yapılmadı. |
| Genel bakış, bildirimler, stok listesi | Açıldı; ayrı test firmasının gerçek sayıları ve anlaşılır boş durumlar görüldü. | Stok/uyarı API regresyonu; tüm KPI’ların finansal mutabakatı bu ekran kontrolünden çıkarılamaz. |
| Normal depo: özet, ürün, depo, raf/lokasyon, mal kabul, toplama, sevkiyat, transfer, sayım, hareket, terminal | Tüm mevcut rotalar açıldı; eksik menü bağlantıları tamamlandı. | Kabul/transfer/sayım/rezervasyon/yetki testleri ve iş günü senaryosu. Fiziksel toplama/sevkiyat/terminal cihazı doğrulanmadı. |
| Satın alma siparişleri, tedarikçiler | Açıldı; ayrı veri ortamında boş listeler açık gösterildi. | Kısmi/fazla kabul, tekrar, kalan miktarı iptal, tedarikçi iadesi testleri. İptal tarayıcı doğrulaması önceki PURCHASE-CANCEL raporuyla kapanmış; yeniden açık iş sayılmadı. |
| Market kasa ve hızlı ürün ekleme | Açıldı; özel barkod alanı, vardiya, ödeme, geçmiş, rapor alanları mevcut. | Yarış/idempotency/para/yetki/iade/vardiya API testleri, önceki klavye/ağ ve küçük ekran kanıtları; bu çalışmada fiziksel okutma/tahsilat/fiş basımı yok. |
| Gün sonu ve brüt kâr | Mevcut kasa içindeki raporlar; ayrı modül oluşturulmadı. | Yeniden iş günü: kapanış ve kâr bağımsız tutarlarla eşleşti; CSV/XLSX API dosyaları okundu. Tarayıcıdan rapor dosyası kaydı T05. |
| Eczane: özet, ilaçlar, lot/seri, SKT, soğuk zincir, kabul, FEFO çıkış, karantina/iade, sayım, hareket | Tüm rotalar açıldı. | SQLite lot/FEFO/sayım/karantina testleri. Seri takipli ürün çıkış/sayım/karantina kısıtları açık; gerçek İTS/Medula ve sensör kabulü yok. |
| İlaç referans kataloğu, detay ve platform ilaç yönetimi | Boş katalog ve ayrı manuel TEST kaydıyla detay açıldı; eksik görsel/belge/SUT uydurulmadı. | Arama/filtre/veri/izin testleri; tüm ruhsatlı ilaç kapsamı, doğrulanmış görsel ve resmî klinik belge kapsamı B03/T12. |
| CRM: panel, fırsat, aday, şirket, kişi, aktivite, görev, analitik, personel, otomasyon | On mevcut bölüm açıldı; verisiz durumlar ve otomasyon önizlemesi görüldü. | Firma bazlı kalıcılık ve revizyon/yetki testleri. Tüm CRM/personel düzenleme pencerelerinin tarayıcı hatalı-ağ kabulü tamamlanmış sayılmadı. |
| Operasyon asistanı | Sayfa, danışman, izleme/onay girişleri incelendi. | Asistan öneri/onay/silme/rol/kapsam testleri mevcut. Canlı AI/ses kalitesi, kesintisizlik ve dış bildirim teslimatı T07; sınırsız “her şeyi yapar” iddiası yok. |
| Veri aktarımı | Mevcut ürün aktarımı ve mal kabul bağlantıları; stok CSV çıktısı korundu. | Ürün aktarımı eşleştirme/önizleme/tekrar/başlangıç sıfırları/stock değişmeme testleri. Excel ürün şablonu tarayıcıdan kaydedildi ve okundu. |
| Ayarlar: hesap, firma, kullanıcı, rol, depo, barkod, cihaz, entegrasyon, bildirim, asistan otomasyonu, görünüm, güvenlik, lisans, sistem | 14 mevcut sekme incelendi. Sahte kayıt/ping/sayaçlar düzeltildi. Görünüm tercihleri güncel kaynakta uygulanır ve kaydedilir. | Kullanıcı/kapsam/güvenlik/ayar/yedek API testleri. Rol matrisi, strateji ve CRM otomasyonu önizleme; gerçek servis izinleri sunucuda uygulanır. Görünümün geniş ekran kabulü ayrı kalır. |
| API yönetim merkezi | Servis, işletme, lisans, AI, güncelleme, entegratör ve taslak fatura alanları incelendi. | Platform erişimi/işletme izolasyonu testleri. Sağlayıcı bağlantı testi teslimat/ses/fatura kabulü değildir. Canlı resmî gönderim kapalı. |

App rotalarından ulaşılmayan eski CRM/WMS/eczane dosyaları canlı ekran gibi değerlendirilmedi. Eski örnek dosyaların kaldırılması S03’tür. Menü görünürlüğü yetkilendirme yerine geçmez; mevcut sunucu rol ve depo kapsamı kuralları korunmuştur.

## Tamamlanan çekirdek kapsam ve doğrulama

Son backend regresyonu: **63 dosya / 495 test geçti** (`audit/closure-regression-final.json`). Barkod, köprü, para, bekleyen satış, ses/metin senkronu ve çıktı doğrulayıcı yardımcıları: 15 test geçti (`.local/closure-client-tests.log`). Son frontend üretim derlemesi geçti; büyük JS parçası uyarısı sürer. Bunlar tek başına yayın onayı değildir.

İlk genel koşuda iki eski stok-import testi 201 beklediği için başarısız oldu. Bunlar gizlenmedi: eski yolun kapatılmasına uygun 410 sözleşmesi ve **hiçbir stok/hareket değişmemesi** koşuluyla güncellendi. Beş kritik grup ayrıca geçti. Sahte cihaz/dış sağlayıcı yanıtları fiziksel veya canlı entegrasyon kanıtı olarak sayılmadı.

Yeni ayrı iş günü kanıtı: `audit/business-day-1791377786307/results.json`, `independent-expectations.json`, `profit.json`, `restore-comparison.json`.

| Kontrol | Bağımsız beklenen sonuç | Sonuç |
|---|---|---|
| İki maliyetli lot kabulü ve transfer | 10+10 kabul; A’dan 8, B’den 6 transfer; depoda A=2/B=4 | Geçti; lot/raf korunmuş. |
| Nakit/kart/bölünmüş satış | 360+240+480 TL; nakit 540/kart 540; para üstü 60 | Geçti; barkod API girişi simülasyonu. |
| İlk vardiya | 200+540−120−50=570 TL beklenen; 565 sayılan; −5 fark | Geçti; gerekçe kaydı ve kapanış. |
| Yeni vardiyada eski satışın iadesi | 45 nakit/75 kart; 565−45=520; eski kapanış aynı | Geçti. |
| Son stok ve hasarlı iade | Depoda 6, mağazada fiziksel 8; mağazada satılabilir 7/hasarlı 1 | Geçti; stok defteri/lot kayıtları eşleşmiş. |
| Brüt kâr, KDV hariç | Net satış 600, maliyet 360, brüt kâr 240 TL; sonradan 999 TL alış fiyatı geçmişi değiştirmez | Geçti; hasarlı maliyet geri kazanılmış sayılmamış. |
| Rapor API çıktıları | Aynı filtreler/toplamlar ve metin barkodu | Geçti; CSV/XLSX dosyaları okuyucuyla açılmış. Masaüstü Excel UI testi değildir. |
| Ayrı SQLite’a geri yükleme | 20 ilişkili tablo, kullanıcı ilişkileri, bütünlük ve kaynak verinin değişmemesi | Geçti; gerçek disk arızası/elektrik kesintisi değildir. |

`C:\Users\mymarius\Downloads\urun-sablonu.xlsx` tarayıcı indirme olayıyla kaydedildi: 13.700 bayt, “Ürünler” sayfası ve yedi doğru başlık; B2 metin türünde `0001234567890`. Bu **ürün şablonu** kontrolüdür; stok/brüt kâr CSV/XLSX indirmelerine genellenmez.

## Tek kalan iş listesi ve kabul koşulları

### Yayını engelleyen hata / kabul engeli

| Kimlik | Kalan iş | Kabul koşulu |
|---|---|---|
| B01 | Eski yerel test hesapları ve daha önce paylaşılmış sağlayıcı anahtarlarının üretim hazırlığı | Sahibi eski/zayıf hesapları kapatır veya güçlü parola ile değiştirir; paylaşılmış anahtarları sağlayıcıdan iptal/yeniler; eski oturum/anahtarlarla hassas istek reddedilir. Yeni kurulumun güvenli ilk hesabı legacy hesapları otomatik temizlemez. |
| B02 | Ana sayfa iletişim ve gizlilik metni yok; genel erişime açık müşteri kaydı için kurumsal hazırlık eksik | İşletmenin doğrulanmış iletişimi ve kendi onayladığı veri işleme/gizlilik metni gerçek bağlantılarda açılır; formdan erişilir; “hazırlanıyor” ve ölü bağlantılar kalmaz. Metin/şirket kimliği uydurulmaz. |
| B03 | İlaç ayrıntılarının resmî belge kapsamı ve SGK/SUT reçete/rapor koşulları tamamlanmadı | Gerçek ürün/form/doz/paket/firma örneklerinde kaynak/tarih/belge eşleşmesi ve bölüm ayrıştırması doğrulanır; renkli reçete/pasif ürün kapsamı kaynakla uzlaştırılır; ilaç bazlı SUT ve rapor bilgisi güncel kaynağıyla doğrulanır. Veri yoksa sonuç üretilmez. Klinik kapsam yayınlanacaksa engeldir. |
| B04 | İTS/Medula ve resmî e-belge canlı işlemleri tamamlanmış değil | İzinli kurum/entegratör test hesabında doğrulama, gönderim, durum, mükerrer önleme, iptal/iade ve belge alma uçtan uca kanıtlanır. Fatura taslağı resmî kabul diye sunulmaz. Bu kapsamlar “çalışıyor” vaadiyle yayınlanamaz. |
| B05 | Genel internet üretim dağıtımı doğrulanmadı. 8 Ekim yerel güvenlik incelemesinde hata/log sızıntısı, yönetici şifre sınırı, geliştirme originleri ve resmî olmayan Medula onayı düzeltildi; aşağıdaki kanıt tablosu geçerlidir. | Gerçek hedefte HTTPS, sır/erişim yönetimi, kalıcı anahtar, log/hata izleme, yedekten dönüş, oturum ve firma izolasyonu kabul edilir. Mevcut loopback kurulumun internete açılması üretim kabulü sayılmaz. |
| B06 — giderildi | İlk Windows ZIP üretim bağımlılık taramasındaki 1 kritik / 12 yüksek / 2 orta uyarı, hedefli güncellemeler ve doğrulanmış scoped override ile giderildi. | DEPENDENCY-SECURITY-REVIEW.md paket/sürüm/zincir/uygulama etkisini gösterir. Backend/frontend/köprü tam ve üretim audit’leri ile gerçek yeni ZIP üretim audit’i 0 uyarı; temiz kurulum/derleme, regresyon ve Windows güncelleme geçti. WhatsApp override canlı mesaj teslimatını kanıtlamaz; T07’de bekler. |

### Tamamlanması gereken iş

| Kimlik | Kalan iş / mevcut sınır | Kabul koşulu |
|---|---|---|
| T01 | Bütün rol/ekran/düğme kombinasyonlarının tarayıcı kabulü, ağ-hata geri dönüşleri | Admin/kasiyer/depo personeli ve kapsamlı/kapsamsız müşteri için her açık ekranın kayıt, vazgeçme, çift gönderim, 401/403/409/500 ve ağ kaybı adımları kanıtlanır; hiçbir başarısız işlem başarı mesajı veya veri değişikliği üretmez. Tekrar denemede bağlantının geri gelmesi ve dolu CRM hedef tabloları da kontrol edilir. |
| T02 | USB/Bluetooth HID, COM, kamera ve termal yazıcı fiziksel kabulü | Seçilen cihaz/OS/tarayıcıda sıfırlar, tekrar, hızlı akış, kesinti/izin, farklı sonlandırıcılar; 58/80 mm Türkçe çıktı ve yeniden yazdırmada tek satış doğrulanır. Banka cihazında tahsilat/iade ayrı doğrulanır. Simülasyon ve fiş önizlemesi yeterli değildir. |
| T03 | Yerel MySQL ve Devreye Alma (Cutover) kabulü tamamlandı; müşteri geçişi bekler | 10 Ekim gerçek MySQL 8.4.0 üzerinde: 1) İki ayrı API süreci ve iki ayrı hedef (`veniux_test_parity`, `veniux_test_import`) ile devreye alma ve kilitte bekleyen isteklerin 503 TARGET_FENCED ile reddedilmesi, eski hedefe 0 satış yazılması, yeni hedefte satışın açılması ve geri dönüş (rollback) sıfır veri kaybıyla doğrulandı. 2) Gerçek HTTP uçlarıyla satış, kısmi iade ve vardiya kapanışı çalıştırıldı; 64-bit kimlikler korundu. 3) Eczane Programı Geçiş Asistanı (Farmakom/Excel, KVKK hasta/reçete filtresi, lot/raf ayrımı) ve teknik Veritabanı Geçişi birbirinden ayrıldı. 4) Dashboard, ürün detayı ve depo ekranlarında rol bazlı maliyet/kâr gizleme ve ortak tasarım tamamlandı. Canlı yerinde DDL engellidir; müşteri kopyasıyla kabul bekler. MYSQL-MIGRATION-REVIEW.md esas alınır. |
| T04 | Başka bilgisayarda temiz kurulum ve önceki kullanıcı verisiyle kontrollü güncelleme | Temiz Windows x64 üzerinde Node 24/PowerShell 7 ve bağımlılıklar kurulup ilk hesap, sağlık, satış/stok, güncelleme yedeği, başarısız migration/geri dönüş ve Windows klasör ACL kontrolleri geçer. Mevcut PC’de ZIP açmak bu testi kapatmaz. |
| T05 — yerel tarayıcı kaydı giderildi | Brüt kâr CSV-XLSX, stok CSV ve anahtarsız yedek gerçek Chrome ile ayrı test kopyasında kaydedilip okundu. Filtreler/tutarlar eşleşti; bozuk yedek/rapor hatası ve tekrar deneme doğrulandı. | audit/local-closure-browser.json ve LOCAL-CLOSURE-FOLLOWUP.md. Dosya MIME/ad/barkod/UTF-8/600-360-240 TL karşılaştırması geçti; stok toplamı 14. Mevcut sunucu yetki testleri korunur; masaüstü Excel T06 olarak açık kalır. |
| T06 | Masaüstü Excel ile açma | İndirilen rapor Excel UI’da onarım istemeden açılır; sıfırlar, tarih, para ve formül güvenliği görülür. XLSX okuyucu testi bunu karşılamaz. CSV kod sütunları metin içe aktarılır. |
| T07 | AI/ses ve WhatsApp/Netgsm/e-posta/Telegram canlı kalite ve teslimat | Gerçek yapılandırmayla Türkçe yumuşak kadın sesi/telaffuz, metin-ses başlangıcı, yankısız tek oynatma, iptal ve kesinti davranışı kabul edilir; dış bildirim test alıcısına ulaşır ve sonucu kaydedilir. Bağlantı testi 200 veya anahtarın varlığı yeterli değildir; “asla kesilmez” garantisi verilmez. |
| T08 | CRM otomatik atama/kurallar/bildirim tercihlerinin işlem servisi yok | Mevcut tanım ve firma/rol sınırlarıyla izinli tetikleyicide tek gerçek işlem oluşur; kapalı kural çalışmaz; hata/tekrar/denetim kayıtları kalıcıdır. Önizleme ancak bu kabulden sonra açılır. |
| T09 | WMS genel strateji ve canlı lisans kapasite sayaçları | Görünüm/ses/yoğunluk artık uygulanır; bu eski eksiklik T09'dan çıkarıldı. FIFO/LIFO/rezervasyon değişikliği stok korumasını bozmadan kabul edilmeli; kapasite gerçek firma verisi ve lisans limitiyle eşleşmelidir. Önizleme veya ölçülmedi açıklaması bu kabulden önce kaldırılmaz. |
| T10 | Dinamik rol matrisi önizleme; 2FA yok | İşletme mevcut rollerle çalışıyorsa sınır belgelenir. Dinamik yetki/2FA vaadi gerekiyorsa sunucu ve oturum yenileme testleriyle kabul edilir; yalnız düğmenin görünmesi yeterli değildir. |
| T11 | Eczanede seri takipli çıkış/sayım/karantina ve gerçek soğuk zincir cihazı | Seri hareketleri lot bakiyesiyle birlikte atomik uzlaşır; aynı seri iki kez çıkamaz; gerçek sensör zaman/sıcaklık/kesinti ve alarm davranışı kabul edilir. Mevcut seri kısıtları kabul olmadan kaldırılmaz. |
| T12 | İlaç görselleri ve tüm kaynak katalog kapsamı | Resmî/üretici kaynak listesiyle barkod ve paket bazında kapsam uzlaştırılır; eksik, pasif ve farklı reçete sınıfları sayısal karşılaştırılır; doğru ürün görseli doğrulanır. Kayıt sayısı veya genel kutu resmi tamlık kanıtı değildir. |
| T13 | Legacy satın alma/lot verileri ve kullanıcı depo ataması geçişi | Eski doğrudan kabul kayıtları gerçek belge/lotla uzlaştırılır; lot tahmin edilmez. Migration sonrası atamasız çalışanlar yönetici tarafından açıkça atanır; admin/kasiyer/depo personeliyle izinli ve reddedilen kayıtlar kontrol edilir. Test migrationı geçti, gerçek eski müşteri verisiyle kurulum henüz denenmedi. |
| T14 | Kurumsal e-fatura sağlayıcı kapsamı | Hazırdaki adaptörün gerçek test hesabı ile kabulü yapılır; listede görünmek her entegratörün API’sine bağlanmak değildir. Kullanılacak diğer sağlayıcının resmî sözleşme/kimlik doğrulama/gönderim/durum/PDF/hata uçları ve tekrar davranışı ayrı kabul edilir. Hesapsız canlı fatura vaadi yapılmaz. |

### Sonraki sürüm iyileştirmesi

| Kimlik | İş | Kabul koşulu |
|---|---|---|
| S01 | Büyük JS parçaları, kalan lint ve kapsamlı erişilebilirlik/dil tutarlılığı | Yavaş cihazda açılış ölçümü iyileşir; kritik klavye/ekran okuyucu rotaları ve uzun listeler taşmaz; Türkçe/İngilizce karışımı tutarlı hale gelir. Mevcut kasa küçük ekran kanıtı tüm uygulamaya genellenmez. |
| S02 | İmzalı bağımsız EXE/Windows servisi/otomatik açılış ve tek kurucu | API, Node çalışma ortamı, veri/migration/yedek ve cihaz köprüsünü gerçekten kuran imzalı paket ayrı PC’de kabul edilir. Mevcut Electron arayüzü veya ZIP bu kabulü sağlamaz. |
| S03 | Rota dışı eski örnek ekran dosyalarının temizliği | Canlı import/rota/kullanım olmadıkları doğrulanır; mevcut tasarım ve akışlar etkilenmeden kaldırılır. |
| S04 | Yük/stres, çok süreç, elektrik kesintisi/disk arızası ve dış güvenlik değerlendirmesi | Hedef kullanım yükü altında tutarlılık/yanıt süreleri ölçülür; harici yazıcı süreçler ve gerçek arıza kurtarma denenir; bağımsız değerlendirme bulguları kapatılır. Mevcut kısa test/pentest tüm saldırı sınıflarını kapsamaz. |

## Eski raporlarla uzlaştırma

- RETAIL-DAILY’deki vardiya/nakit hareketi sınırları, RETAIL-SHIFT-REVIEW ve BUSINESS-DAY-E2E ile tamamlanmıştır; yeniden eksik modül diye sayılmadı.
- AUTHORIZATION-REVIEW’de “kullanıcı depo ataması yok” maddesi WAREHOUSE-ACCESS-SCOPE ve DEPLOYMENT-VERIFICATION ile kapanmıştır. MySQL ve gerçek kullanıcı geçişi T03/T13 olarak kalır.
- PROCUREMENT-REVIEW’deki takılı iptal kutusu, PURCHASE-CANCEL-VERIFICATION ile kapanmıştır. Araç engeli uygulama hatası diye yeniden kaydedilmedi.
- Brüt kâr maliyet/iade/KDV eksikleri GROSS-PROFIT-REVIEW ve GROSS-PROFIT-EXPORT-VERIFICATION ile kapanmıştır. 8 Ekim yerel kaynak takibinde gerçek tarayıcı dosya kaydı da doğrulandı (T05); masaüstü Excel T06 olarak açık kalır.
- PRODUCT-BULK-IMPORT, STOCK-LOT-EXPIRY-REVIEW, WMS-TRANSFER-COUNT-REVIEW, BACKUP-RESTORE-REVIEW ve RETAIL-PRELAUNCH/UX raporlarının SQLite kontrolleri korunmuş ve son regresyonla yeniden sınanmıştır.
- BETA-READINESS, SYSTEM-CHECK ve PENTEST raporlarındaki dış servis/klinik/dağıtım sınırları B ve T listesinde tekilleştirilmiştir. Eski test sayıları yeni son durumun yerine geçirilmedi; 7 Ekim incelemesinde bağımlılık audit’i yeniden yapılmamıştı; 8 Ekim bağımlılık revizyonunun yeniden tarama ve düzeltme kanıtları aşağıdaki son kabul bölümündedir.

## Dağıtım, veri ve yedeklerin doğru tanımı

Bu teslimat **ZIP içindeki Windows PowerShell kurulum dağıtımıdır; bağımsız EXE değildir.** Windows x64, PowerShell 7, Node.js 24.x/npm gerekir; ilk bağımlılık kurulumu ve dış servisler için internet gerekir. Uyumlu SQLite/bcrypt ikilisi indirilemezse yerel derleme araçları gerekir. Arayüz derlenmiştir; üretimde Vite gerekmez. Mevcut SQLite dağıtımı MySQL gerektirmez. Yerel API çalışırken terminal açık tutulur; Windows servisi kurulmuş değildir.

Kalıcı veri varsayılan `%LOCALAPPDATA%\Veniux\data` altında, sürüm klasörünün dışındadır. Panel yedekleri `DATA\storage\backups`; özel güncelleme/kurtarma yedekleri `DATA\recovery` altındadır. İndirilebilir yedekler sırları ayıklar; özel kurtarma yedeği tam dönüş için hassas veriler içerir ve paylaşılmaz. Aynı diskteki yedek disk arızasına karşı yeterli değildir; dış disk/güvenli başka depoda kopya ve geri dönüş tatbikatı gerekir.

Install-Windows ilk yöneticiyi kullanıcı girdisiyle oluşturur; varsayılan şifre veya örnek üretim hesabı yoktur. Update-Windows tutarlı yedek ve sürümlü migration kullanır; uyumsuz/yarım sürüm açılmaz. Restore-Windows açık onay ve güvenlik yedeği gerektirir. Eski kodu kopyalamak veritabanını eski şemaya döndürmez. Ayrıntılar WINDOWS-DEPLOYMENT.md içindedir.

Güncel ZIP Build-Release.ps1 ile bu inceleme sonrasında yeniden hazırlanmıştır; kapanış raporu pakete dahildir. Eski ZIP’ler bu düzeltmeleri içermez. ZIP SHA256 ve release manifesti kontrol edilir. Yeni PC/fiziksel cihaz/gerçek kurum kabulü tamamlanmadan paket “her bilgisayarda test edilmiş” veya “tüm entegratörlerle çalışır” diye tanıtılmaz.

## Değişen dosyalar

- Frontend: App.jsx, api/client.js, components/Layout.jsx, AuthShell.jsx; pages/ImportExport.jsx, public/LandingPage.jsx; settings/DevicesTab, WarehouseTab, AppearanceTab, LicenseTab, AccountTab, SystemEngineTab; context/CRMContext ve crm/workspace/CrmAutomations, CrmAnalytics; vite.config.js.
- Backend: src/index.js, controllers/stockController.js, settingsController.js.
- Test: tests/closureReview.test.js, stock.test.js, commercialAccess.test.js, audit_access.test.js.
- Dağıtım ve rapor: Build-Release.ps1, bu rapor ve audit/closure-* kanıtları. Test yardımcıları .local altında; dağıtıma eklenmez.

Kapanış ölçütü kalan iş tablosunun her kabul koşulunun kanıtla kapanması veya kapsam dışına alınmasının açıkça kararlaştırılmasıdır. Test sayısının artması, bir ekranın açılması, HTTP 200 ya da paket oluşturulması tek başına proje tamamlanmışlığı değildir.

## 8 Ekim 2026 — üretim güvenliği incelemesi

**Yerelde giderilen bulgular kapandı; genel internet yayını onaylanmadı.** Yeni iş modülü eklenmedi. Mevcut kullanıcı veritabanı ve çalışan 3000/5173 servisleri kullanılmadı veya yeniden başlatılmadı. API regresyonu yalnız test SQLite dosyasında; gerçek üretim başlatıcısı denemeleri ayrı geçici veri/anahtar klasörü ve rastgele loopback portlarında yapıldı. Bu test sunucuları test sonunda kapatıldı. Test kurulumu, gerçek müşteri hesabı veya başka bilgisayar kabulü değildir.

### Rapordaki güvenlik maddelerinin kodla eşleştirilmesi

| Önceki madde / konu | İncelenen kod ve somut sonuç | Kanıt / durum |
|---|---|---|
| B01 eski hesaplar / sırlar | `runtimeConfig.validate`, `deploymentService.initialize/adopt`, `database/migrator`, `authController`, `authMiddleware`. Yeni üretimde rastgele JWT sırrı ve açıkça girilmiş güçlü ilk yönetici şifresi zorunlu; migration örnek hesap eklemiyor. Eski kullanıcı parolaları taşıma sırasında korunuyor. | `deploymentLifecycle.test.js`, `productionRuntime.test.js` geçti. Eski gerçek hesaplara müdahale edilmedi; anahtar iptal/yenileme sağlayıcı sahibini gerektirir. B01 açık. |
| B05 giriş / oturum | `authRoutes` IP başına giriş/kayıt sınırı; `authMiddleware` her istekte DB rolü, firma aktifliği, kullanıcı durumu, session_version ve depo atamasını okuyor. Kullanıcının JWT rolüne güvenilmiyor. Şifre/rol/durum değişikliği eski oturumu geçersiz kılıyor. | Auth, authorizationOperations, warehouseAccessScope, platformAccess ve yeni securityPasswordLifecycle testleri geçti. Dağıtılmış saldırı/gerçek proxy IP davranışı dış altyapı kabulüdür. |
| B05 şifre sıfırlama | Girişte “Şifremi unuttum” mevcut yöneticiye yönlendiriyor; e-posta tokenlı sıfırlama servisi varmış gibi sunulmuyor. `settingsController.createUser` asgari sınır uygulamıyordu, `updateUser` 6 karakter kabul ediyordu. Her ikisi 8 karakter/72 bayt sınırına getirildi; ayarlı güçlü şifre politikası korunuyor. UsersTab açıklaması güncellendi. | Geçersiz oluşturma/sıfırlamada kullanıcı sayısı, hash ve session_version değişmedi. Geçerli sıfırlama sonrası eski kasiyer oturumu 401 aldı. Geçti. |
| B05 sunucu yetkisi ve firma/depo izolasyonu / T13 | `requireRole`, `accessScope`, `accessScopeService`, `scopeQueryContext`, `warehouseBoundary` ve operasyon servisleri incelendi. Kasa lokasyonu, transferin iki deposu, ilişkili kabul/lot/sipariş ve rapor/çıktı aynı kapsamla denetleniyor. Kullanıcı kendini veya başka firmanın kapsamını yetkilendiremiyor. | İki firma/depo, rolü sahte JWT, kapsam kaldırma, yabancı kayıt kimliği ve reddedilen istekte veri değişmeme testleri geçti. Gerçek legacy kullanıcı ataması T13’te kalır. |
| B05 dosya ve yedek erişimi | `backupRoutes/backupService` platform yetkisi, açık onay, kullanıcıya bağlı hazırlık tokenı, içerik/sürüm/yol kontrolü; `assistantSystemOperations` kullanıcı+firma bağlı dosya kuyruğu; `updateStorage` dar EXE/blockmap/manifest adı listesi. Güncelleme dosyaları bilerek halka açık dağıtım içeriğidir; yazımı platforma bağlıdır. Klasör tarama uçları müşteri yöneticisine kapalıdır. | Oturumsuz yedek 401; özel env/PEM URL’leri 404; yol geçişi ve bozuk yedek reddi; sır ayıklanmış indirilebilir yedek; yetkisiz restore’da veri değişmeme testleri geçti. Windows ACL ayrı PC kabulü T04. |
| B05 hassas maliyet / sağlayıcı sırları | `costVisibility` nested ve JSON satış/lot maliyetlerini yetkisiz API yanıtından çıkarıyor. Platform teşhisi yalnız yapılandırılmışlık/sonuç döndürüyor. Frontend dist, yerel yapılandırılmış sır değerleri ve gerçek sağlayıcı anahtar biçimleriyle içerik açığa çıkarılmadan tarandı. | authorizationOperations ve platformAccess geçti. `audit/production-security-artifact.json`: 97 dosyada yapılandırılmış sır/özel anahtar/sağlayıcı anahtar eşleşmesi yok. Bu sonuç tüm olası sır biçimleri veya tarihî ZIP’ler için garanti değildir. |
| B05 hata/log sızıntısı | ColdChain, lisans, AI, terminal, fatura gibi controller’lar kendi 500 yanıtlarında `error.message` döndürebiliyordu; auth/settings ve diğer loglar ham hata nesnesi yazıyordu. `productionPrivacy` üretim JSON sınırında bütün 5xx yanıtlarını güvenli mesaj/requestId ile sınırlar; SQL hatası 400’e çevrilse de sorgu/parametre/stack ayrıntısını temizler. Üretim error/warn logları ham hata metni yerine sabit olay etiketi ve doğrulanmış requestId tutar. Diğer loglarda anahtar alanları, bilinen ortam sırları ve bağlantı URI’leri ayıklanır; WMS payload’ı üretim loguna yazılmaz. | productionPrivacy testleri; gerçek ayrı üretim sunucusuna bozuk şifre JSON’u gönderildi, yanıt/logda işaret metni yoktu. Geçti. `notificationService` sağlayıcı hatası yerine anlaşılır başarısız gönderim döndürür; MySQL bağlantı konumu logdan çıkarıldı; başlatıcı hata metni sır ayıklamadan geçer. |
| B05 üretimde geliştirme erişimi | Üretim varsayılan CORS yalnız seçili localhost portu ve mevcut dosya-protokollü masaüstü originini kapsar; 5173 ve başka 3000 portu otomatik açık değildir. Açık CORS_ORIGIN varsa kullanıcı tanımı korunur. Mevcut localhost yönetim kapatma ucu loopback+zaman sabitli rastgele token kontrolü ister. | defaultOrigins testi ve gerçek üretimde 5173 originine 403; runtime yetkisiz kapatma 403. Üretimde object-src none, base-uri self, frame-ancestors none CSP eklendi. Bu sınırlı CSP tam script/XSS koruması olarak sunulmaz. |
| B02 gizlilik / kurumsal metin | Ana sayfanın eksik iletişim/gizlilik metni yerelde uydurulmadı. Hasta/şirket kaydı bulunan ürünün hukuki metni, saklama ve erişim politikası işletme tarafından sağlanmalı. | B02 açık; gerçek onaylı metin ve kayıt formundan erişimi kabul koşuludur. |
| B03 resmî ilaç bilgisi | Katalog belge/SUT eksikliği doğrulanmış tıbbi bilgiyle doldurulmuş sayılmadı. Kaynak doğrulama ve kapsam kabulü değiştirilmedi. | B03 açık; güncel ürün/paket/belge/SUT eşleştirme kanıtı gerekir. |
| B04 gerçek kurum/fatura ayrımı | `eInvoiceService` internal_draft kaydeder, yalnız draft/cancelled yerel durumuna izin verir; controller legal_invoice=false bildirir. `medulaProvisionService.createProvision` dış kurum çağırmadan approved yazıyordu: artık draft, official_submission=false ve açık yerel tahmin uyarısı kullanır. Sahte hasta/TC/ICD varsayılanları kaldırıldı. Eski approved satırları DB’de değiştirilmedi; API geçmiş/detay bunları local_unverified olarak açıklar, eski ekran etiketi kurum onayı saymaz. | pharmacy_mega_suite testinde hem yanıt hem DB draft ve resmî gönderim=false doğrulandı; invoiceTotals/pentest/platformAccess testleri mevcut taslak ayrımını korudu. B04 canlı kurum kabulü hâlâ açık. Rota dışı eski Medula ekranı düzeltildi, yeni menü/modül açılmadı. |
| T10 / S04 | 2FA ve dinamik yetki matrisi tamamlanmış sayılmadı; mevcut sunucu rolleri korunuyor. Haricî bağımsız pentest, yük/proxy/altyapı kabulü mevcut yerel testlerin dışında. | T10/S04 açık; önceki kabul koşulları korunur. |

### Akışları koruma kanıtı

- `retailCritical`, `retailDaily`, `retailRecovery`, `retailShift`, `retailProfit`: son stok yarışı, aynı işlemin tekrar gönderimi, para üstü/bölünmüş ödeme, iade sınırı ve sonraki vardiya mutabakatı geçti. Şifre düzeltmeleri satış veya stok hesaplamasına müdahale etmedi.
- WMS mal kabul/transfer/sayım, satın alma kısmi kabul/iade ve stok-lot testleri geçti. Firma/depo reddi kayıt veya bakiye değiştirmiyor.
- `backupRecovery`: satış/stok/lot/iade/kullanıcı ilişkisinin geri dönüşü, bakımda yazma reddi, hatada rollback ve taşınabilir yedekten hash/servis sırlarının çıkarılması geçti.
- Üretim sınırı testi başarılı satış JSON’unu ve 409 stok mesajını aynen korudu; hata sonucu başarıya çevrilmedi. Fatura taslağı ve Medula yerel hesaplama canlı işlem kabulü değildir.
- Son kanıt `audit/production-security-final.json`: 65 grup / 508 kontrol geçti. Sayı, yukarıdaki bağımsız yetki/veri/işlem koşullarının yerine geçmez. İlk genel koşuda productionRuntime’ın iki alt süreç başlatması sandbox `spawn EPERM` nedeniyle doğrulanamadı; aynı testler izinli yerel alt süreçle yeniden çalıştırılıp geçti. Bu bir uygulama hatası veya gizlenmiş geçiş değildir.
- Frontend üretim derlemesi geçti (`.local/production-security-build-final.log`); mevcut büyük JS parçası uyarısı sürüyor. Tarayıcı görsel/indirme/fiziksel cihaz kontrolleri yeniden yapılmış sayılmadı.

### Açık kalan güvenlik kabulü

| Engel | Neden yerelde kapatılamadı | Kabul koşulu |
|---|---|---|
| B01 | Önceden paylaşılmış gerçek anahtarların iptali sağlayıcı hesabı gerektirir; gerçek kullanıcıları test amacıyla değiştirmek yetkilendirilmedi. | Sahibi anahtarları iptal/yeniler ve eski zayıf hesapları düzeltir. Eski anahtar ve oturumla hassas işlem reddi gerçek hedefte doğrulanır. |
| B05 — HTTPS / altyapı | Mevcut paket yalnız loopback içindir; gerçek alan adı, TLS/proxy, güvenlik duvarı, dış log izleme ve dış disk yedek altyapısı yok. | HTTPS hedefinde doğru origin, istemci IP/rate limit, sırların özel dosya ACL’si, kalıcı anahtar, izleme ve yedekten dönüş kabul edilir. Localhost HTTP internete açık üretim gibi sunulmaz. |
| B05 — istemci oturumu / tam XSS kabulü | Mevcut token localStorage’da; tasarım/fiş/cihaz bağlantısını bozmadan kapsamlı script CSP ve bütün üçüncü taraf içerik kabulü yapılmadı. `null` origin mevcut Electron dosya-protokolü için korunur; başka güvenilmeyen null-origin sayfa güvenilir sayılmaz. | Hedef tarayıcı/masaüstünde XSS ve oturum hırsızlığı testi, kaynak allowlist’i, script politikasının fiş/ses/scanner akışlarıyla kabulü; masaüstü gerekmeyen dağıtımda null originin açık yapılandırmayla kapatılması. Mevcut JSON hata koruması bunun yerine geçmez. |
| B02/B03/B04 | Kurumsal metin, doğrulanmış klinik belgeler ve gerçek resmî entegratör/kurum erişimi eksik. | Önceki B kabul koşulları uygulanır. Yerel taslak/simülasyon resmî başarı olarak gösterilmez. |
| T03/T04/T05/T02 | MySQL, başka PC, gerçek rapor indirme ve donanım bu güvenlik çalışmasının kanıtı değildir. | Önceki bekleyen kabul koşulları aynen sürer; test sayısı ile kapatılmaz. |

Yeni düzeltmeler çalışan geliştirme sunucusuna otomatik uygulanmadı. 7 Ekim ZIP’i bu güvenlik değişikliklerini içermez; yeni dağıtım yalnız güncel kod ve raporla yeniden oluşturulmalıdır. ZIP yine bağımsız EXE değildir.

## Windows bağımlılık güvenliği ZIP’i kabulü — 8 Ekim 2026

**Önceki bağımlılık revizyonunun dağıtımı:** `veniux-1.0.0-security-dependencies-20261008-4d86b234ea564849936e2c932ad02802.zip`. Bu ZIP aşağıdaki yerel kaynak takip düzeltmelerini içermez; bu turda yeni paket üretilmedi. Uygulama 1.0.0; release.json güvenlik/bağımlılık revizyonu 2026-10-08 ve benzersiz build_id taşır. Yeni migration eklenmedi. Node 24.x, npm, PowerShell 7 ve ilk kurulumda internet gerekir. ZIP bağımsız EXE/Windows servisi değildir; **genel yayına hazır değildir**.

| Kabul | Sonuç / kanıt |
|---|---|
| Paket bazında bulgular | DEPENDENCY-SECURITY-REVIEW.md: ilk 15 üretim bulgusu, ek dev/frontend bulguları; gerçek eski/yeni sürümler, zincirler, erişilebilirlik ve override gerekçeleri. Advisory aralıkları ve kaynakları audit/dependency-security-findings.json. B06 giderildi; istismar yapılmış veya tüm güvenlik tamamlanmış sayılmaz. |
| Temiz kilit kurulumu ve derleme | Ayrı kopyada backend/frontend/scanner-bridge npm ci geçti. Frontend üretim derlemesi geçti; büyük JS parçası uyarısı sürer. Kullanıcının açık API/Vite sunucuları kapatılmadı; source npm ci native dosya kilidiyle EPERM verdi, npm install --ignore-scripts kurulumu tamamladı. Temiz kurulum kanıtı ayrı kopyadır. |
| Satış/stok/iade | audit/dependency-security-regression-accepted.json: retailCritical, retailRecovery, retailDaily/Shift/Profit, scanner ve stok/lot/transfer/sayım/satın alma regresyonları geçti. Son stok yarışı, tekrar satış/idempotency, kuruş, iade miktarı/lot/durum ve kapanmış vardiya değişmeme koşulları esas alınır. |
| Yetki/oturum/firma/depo | Aynı regresyondaki auth, authorizationOperations, warehouseAccessScope/scopeQueryContext ve productionPrivacy/Runtime grupları geçti. Reddedilen API işlemleri ve veri değişmeme koşulları korunur. |
| Yedek / kurulum / kurtarma | backupRecovery ve deploymentLifecycle geçti: SQLite online backup, ilişkiler/dosyalar, sürüm/checksum, başarısız migration/kurtarma, atama geçişi ve eski sürüm uyumsuzluğu. Gerçek eski müşteri verisi veya MySQL testi değildir. |
| Tam regresyon sonucu | **66 grup / 509 test geçti**. Sayı tek başına tamamlanma kanıtı değildir; yukarıdaki senaryolarla değerlendirilir. İlk iki başarısız koşunun JSON/logları korunur; başarısızlıklar gizlenmedi. |
| Ek bağımlılık uyumu | backend/tests/dependencyCompatibility.cjs: 4/4 geçti; SheetJS UTF-8/metin barkod/tarih-metni/para roundtrip, Nodemailer stream MIME, gerçek NYC YAML/extends, LocalAuth/Client ve gerçek ayrı Chrome headless sayfa/websocket API’leri. shared 7/7 ve scanner-bridge 1/1 geçti. Gerçek SMTP veya WhatsApp mesaj teslimatı yok. |
| Regresyonda bulunan gerçek hata | Temiz geliştirme lisans anahtarı PEM’i başına geçersiz açıklama yazılıyordu; ikinci açılış decoder hatası veriyordu. licenseService ham geçerli PEM yazar ve okurken crypto ile doğrular; iki ayrı süreçte anahtarın aynı kalması/imzanın doğrulanması yeni licenseKeyPersistence testiyle geçti. Üretim kalıcı anahtarları değiştirilmedi. |
| Araç/fixture engelleri | İlk kopya .local içindeydi: Express dotfile koruması dosya şablonu/çıktıya 404 verdi; görünür test klasörüne taşındı. Backup testine boş storage hazırlığı eklendi. Excel UTC anı/tarih hücresi test varsayımı düzeltildi; saat dilimi korunduğu iddia edilmez. Edge bu ortamda headless açılışta kapandı; Chrome geçti. Uygulamanın güvenlik kontrolleri gevşetilmedi. |
| Tekrar audit | Backend/frontend/köprü tam + omit=dev toplam altı audit ve gerçek kurulu ZIP omit=dev audit’i **0 kritik / 0 yüksek / 0 orta / 0 düşük**. Kanıt audit/dependency-security-*-final.json. Güncel advisory kapsamıdır; gelecek açık garantisi değildir. Deprecation uyarıları gizlenmedi: prebuild-install/glob/fluent-ffmpeg bakım borcu S listesinde tutulur. |
| ZIP temizliği ve SHA256 | audit/dependency-windows-package.json: arşiv doğrudan açılarak .env, DB/WAL, PEM, yedek/eşleştirme, test hesabı, log/audit/node_modules bulunmadığı; örnek ayarların tamamı boş ve paket raporunun kaynakla aynı olduğu doğrulanır. Bilinen sır/biçim taraması sınırı korunur. Son SHA256 .zip.sha256 dosyasında. |
| Paketten gerçek kurulum | audit/dependency-windows-install.json: teslim edilen Install-Windows.ps1 ve npm ci --omit=dev ayrı veri klasöründe geçti, açıkça girilen tek sahte ilk yönetici oluşturuldu. İstemler otomatik yanıtlandı; başka PC/interaktif insan kabulü değildir. |
| API / giriş / sağlık | audit/dependency-windows-runtime-before-update.json ve dependency-windows-runtime.json: yeni kurulu ve güncellenmiş API’de sağlık SQLite/current/19 migration, derlenmiş UI HTTP, giriş/me/ürün, 401 yedek, 403 dev origin, credential gizleme, yönetilen durdurma ve integrity geçti. Tarayıcı UI kabulü olarak sayılmaz. |
| Gerçek güncelleme betiği | audit/dependency-windows-update.json: paket Update-Windows.ps1 geçti, tutarlı pre-update güvenlik yedeği/current 19 migration/0 bekleyen atama; audit/dependency-windows-safety-backup.json manifest hash/bütünlük ve kullanıcı/firma/ürün/depo/lisans/şema kayıt eşitliğini ayrıca doğrular; ardından giriş/sağlık tekrar geçti. Bu aynı şemadaki ayrı kurulumdur. Eski sürüm migration/rollback testleri deploymentLifecycle’da ayrıca geçti; başka PC’de gerçek güncelleme T04’te bekler. |
| ACL ve test temizliği | Kurucu Windows hesabı/SYSTEM ACL’si test aracının install.env açmasını engelledi. Yalnız sahte veri klasörüne geçici miras erişimi verildi. dependency-windows-cleanup.json: test şifresi silindi; icacls 26 sahte dosyada private ACL sıfırlamasını başarıyla tamamladı. İşlem sonrası bağımsız recursive ACL incelemesi yapılmadı; başka PC/normal kullanıcı kabulü açık kalır. Üretim klasörü değişmedi. |

### Açık kalan yayın engelleri ve kabul koşulları

- **B01 açık:** NVIDIA/Gemini/Fish paylaşılmış anahtarları sağlayıcı hesabında iptal edilmedi; yeni/eski anahtar kabulü yok. Eski zayıf kullanıcı/oturumların yönetici tarafından düzeltilmesi de bekler. Hizmet/kullanım/doğrulama tablosu RELEASE-NOTES-2026-10-08.md’de; hiçbir anahtar yenilendi sayılmadı.
- **B02–B05 açık:** doğrulanmış iletişim/gizlilik metni; resmî klinik/KÜB/KT/SUT kapsamı; gerçek İTS/Medula/e-belge kabulü; gerçek HTTPS/proxy/izleme/dış yedek ve kapsamlı XSS/oturum kabulü. Yukarıdaki iş listesinde kabul koşulları korunmuştur. Resmî ilaç/fatura bağlantıları gerçek işlem gibi gösterilmez.
- **T07 canlı servis kabulü:** yeni Puppeteer override ile yetkili test hesabında QR giriş/yeniden bağlanma/mesaj teslimatı doğrulanmalı; SMTP ve AI/ses için gerçek yanıt/oynatma gerekir. Chrome headless API testi bu adımları kapatmaz. Edge tek başına kullanılacak hedefte açılış ayrıca kabul edilmelidir.
- **T02/T03/T04/T06 bekler:** başka bilgisayar Windows kurulumu/ACL/güncelleme/kurtarma, fiziksel okuyucu/yazıcı, MySQL ve masaüstü Excel kabulü. T05 gerçek tarayıcı dosya kaydı sonraki yerel kaynak takibinde doğrulandı. SQLite yazılım simülasyonu fiziksel test değildir.
- **Sonraki sürüm bakım işi:** audit 0 olmasına rağmen deprecation veren prebuild-install/glob/fluent-ffmpeg üst paketleri; yerlerine geçiş yalnız cihaz/WhatsApp/export uyumluluğu test edilerek yapılır. Deprecation doğrudan audit açığı veya bugün giderilmemiş 15 bulgu gibi sayılmaz.

Üretim veritabanına satış, stok, iade, migration veya geri yükleme uygulanmadı. Eski ZIP güncel dağıtım olarak sunulmaz.

## Yerel kaynak takibi — 8 Ekim 2026

Yeni ZIP, SHA256 veya dağıtım oluşturulmadı. Önceki dağıtım yeni kaynak düzeltmelerini içermez. B05’in CSP eksikliği ve T05’in boş/yanlış yedek indirme ile çift gönderim eksikleri giderildi; gerçek brüt kâr/stok/yedek tarayıcı kaydı kabulü tamamlandı. Mevcut tasarım ve kasa/stok hesapları korunur. Üretim verisi değiştirilmedi.

[Yerel takip raporu](LOCAL-CLOSURE-FOLLOWUP.md) kod bulgularını, değişen dosyaları, ilgili testleri, araç/uygulama hatası ayrımını ve dış erişim/sahip adımlarını içerir. İlgili güvenlik testleri 8/8, yedek indirme testleri 2/2, ayrı gerçek Chrome kontrolleri 33/33 geçti; arayüz derlendi. Sayılar tek başına genel kabul değildir. Sandbox önizleme tarayıcıda çalıştı; gerçek fiş basımı yapılmadı. İndirilen XLSX okundu; masaüstü Excel UI testi yapılmadı.

B01–B04 ve B05’in canlı altyapı kabulü açık kalır. T01’in geniş ekran/rol matrisi ve uygulanmamış önizleme/sonraki sürüm işleri tamamen kapandı sayılmaz. Yerelde yapılabilecek hiçbir iş kalmadığı veya genel yayın hazır olduğu iddia edilmez. Önizlemedeki eksik davranışları açmak için yeni modül eklenmedi; beta kapsamı kararı ve kabul koşulları korunur.

## MySQL kaynak kabulü — 10 Ekim 2026

Bu bölüm yukarıdaki tarihli MySQL ve görünüm değerlendirmelerinin güncel karşılığıdır. [MySQL geçiş raporu](MYSQL-MIGRATION-REVIEW.md) değişen dosyaları, SQLite/MySQL destek tablosunu, komutları, hata/kurtarma davranışını ve bekleyen kabulü içerir.

Gerçek ve tamamen ayrı MySQL 8.4.0 test sunucusunda **5 grup / 16 test başarılı**; SQLite regresyonunda **69 grup / 629 test başarılı**. Firma/depo kapsamı, transaction yarışları, migration başarısızlığında kapanma, salt okunur SQLite aktarımı, 64 bit kimlik/miktar/tarih hassasiyeti, tutarlı yedek, ayrı hedef kurtarma ve yönetilen üretim başlangıcı doğrulandı. MySQL seçilmişken SQLite dosyası açılmadı. İlgili kabul sonrası kaynakta üretim SQLite zorunluluğu ve genel MySQL operasyon engeli kaldırıldı; şema/kapsam/bağlantı güvenlik kontrolleri devam eder.

T03 artık “MySQL hiç çalıştırılmadı” değildir. Gerçek müşteri kopyası, hedef hesabın en az izinli çalışması, binary log açık üretim, eski MySQL kopyasında yükseltme ve manuel aday devreye alma/geri dönüş tatbikatı bekler. MySQL restore çalışan DB'yi değiştirmez; güvenlik yedeğiyle ayrı boş hedef hazırlar. Mevcut update komutunun canlı MySQL DDL yapması engellenir; ayrı güvenlik kopyası ve açık migration kaydı gerekir. SQLite komutları korunur. Test sayıları bütün ekranları veya genel yayın kabulünü kapatmaz.

Görünüm tercihleri güncel kaynakta tekrar kontrol edildi: tema/sistem modu/renk/yoğunluk/ses uygulanır ve kaydedilir. D06/T09'un “görünüm uygulanmıyor” kısmı güncellendi; CRM otomasyonu, WMS stratejisi ve kapasite kabulü bundan ayrı kalır. Tam tarayıcı/rol matrisi bu turda tekrar yapılmadı.

Yeni iş modülü, ZIP, SHA256 veya Windows kurulum paketi oluşturulmadı. Önceki paketler bu kaynak değişikliklerini içermez. Kullanıcı verileri ve mevcut XAMPP veritabanı değiştirilmedi; test sırları çıktılarda gösterilmedi.

## Eczane geçişi son kabul düzeltmesi — 10 Ekim 2026

[Eczane geçişi kabul kaydı](PHARMACY-MIGRATION-ACCEPTANCE.md), program tespiti, veri minimizasyonu, yeniden deneme, maliyet gizliliği ve gerçek arayüz kanıtını güncel kaynakla eşleştirir. Bu kayıt, önceki geniş kapsamlı kapanış cümlelerini sınırlayan en güncel kabul durumudur.

- **Geçti:** Windows tespiti klasör varlığıyla kesin kurulum demez; kayıt defteri ve doğrulanmış uygulama dosyası birlikte gerektiğinde kurulum doğrulanır. Ürün/stok aktarımı tam izinli sütun listesi kullanır; bilinmeyen ve hasta verisi taşıyabilecek sütunlar saklanmaz. AA/YYYY ay sonu dönüşümü önizleme ve açık onay gerektirir. Aynı batch tekrar commit edilince stok artmaz. Kasiyer/depo operatörü maliyet alanlarını ilgili API yanıtlarında göremez. Sekiz gerçek yerel Chrome ekran görüntüsü ile ana ekran, ürün, depo ve geçiş asistanı masaüstü/küçük ekran görünümü; modal odak, Esc ve odağın geri dönüşü doğrulandı.
- **Başarısız/tamamlanmamış:** Yeni hedefte satış olduktan sonra eski hedefi uzlaştırma kaydı olmadan yeniden açmayı kalıcı biçimde engelleyen çapraz-hedef koordinasyonu yoktur. Bu nedenle hedef değişimi/geri dönüş kabulü kapanmadı. Ağ kesintisi ve yeniden denemenin gerçek HTTP istemci iptaliyle tatbikatı da bu turda tamamlanmadı.
- **Doğrulanamadı:** Gerçek Farmakom kurulumu/örnek dışa aktarımı yoktur; Farmakom uyumluluğu tamamlandı veya doğrudan adaptör sertifikalandırıldı denmez. Bu turda MySQL test sunucusu bağlantısı açılamadığı için genişletilmiş MySQL cutover testi çalışmadı. Önceki 16 MySQL testi bu yeni hedef-değişimi koşulunu kanıtlamaz.

Farmakom kaynak bağlantısı resmî [ürün sayfasıdır](https://farmakom.com/Default.aspx); TEB için [CETAŞ otomasyon kılavuzları](https://cetas.teb.org.tr/m1_4_otomasyon.php) kullanılır. Bu sayfalar sürüme özgü dışa aktarma adımını doğrulamaz; kullanıcı yalnız ürün/stok alanlarıyla, kurulu sürümün sağlayıcı yönergesine göre dışa aktarım hazırlamalıdır. Yeni modül, ZIP, SHA256 veya Windows kurulum paketi oluşturulmadı; üretim verisine dokunulmadı.

## Ayrı PHP tanıtım sitesi — 11 Ekim 2026

Kullanıcı talebiyle uygulamadaki `LandingPage.jsx` kaldırıldı. Uygulamanın `/` rotası token varsa dashboard, yoksa giriş sayfasına yönlenir; satış, lisans etkinleştirme ve mevcut checkout korunur. Tanıtım sitesi `website-php` içinde bağımsız PHP/HTML/CSS/JS olarak hazırlanmıştır. Uygulama veritabanına veya kullanıcı verilerine bağlanmaz.

Ana sayfa ve üç özgün çözüm adresi, sunucudan render edilmiş içerik, sayfaya özel title/description/canonical/OG, JSON-LD Organization/WebSite, sitemap, robots ve gerçek 404 hazırdır. Yerel önizleme varsayılan noindex'dir. HTTP kontrollerinde dört sayfa 200, sitemap/robots 200, olmayan sayfa ve config adresi 404; JSON-LD iki kayıt olarak parse edildi. PHP 8.0.30 söz dizimi ve JS kontrolleri geçti; uygulama üretim derlemesi geçti (mevcut büyük parça/appearance-boot uyarıları devam eder).

Gerçek tarayıcıda 1440×960 ve 390×844 görünümü incelendi. Mobil yatay taşma görülmedi; menü açılış/Esc kapanış ve operasyon tablarının fare/ok tuşuyla değişmesi doğrulandı; error/warn konsol kaydı yok. Görüntüler `website-php/preview` içindedir. Gerçek hosting/HTTPS/Search Console/alan adı ve iletişim bilgileri henüz uygulanmadı. SEO sıralaması, ilk sayfa veya Core Web Vitals başarısı ölçülmüş sayılmaz. Kurulum ve ortam değişkenleri `website-php/README.md` içinde belgelenmiştir. Yeni iş modülü, ZIP veya dağıtım paketi üretilmedi.

PHP tasarım ikinci geçişi: bağlantılı hareket çizgileri, daha güçlü ilk ekran, sabit cam menü, kart etkileşimleri ve mağaza/depo/eczane seçimiyle değişen ürün anlatımı eklendi. PHP/JS söz dizimi geçti; gerçek tarayıcıda sektör seçimi ve bağlantısı masaüstü/telefon üzerinde doğrulandı. Mobil taşma bulunup hero alanında sınırlandı. Görseller website-php/preview/*-v2.png içinde; canlı SEO kabulü değişmedi.

PHP site form/tema/SEO kabulü: görüşme talebi özel dosya kuyruğuna kaydedilir; SMTP henüz bağlı değildir. Gerçek HTTP sentetik kabul 200, yanlış CSRF 403, hızlı tekrar 429; tek sentetik kayıt doğrulandı ve temizlendi. Tema tercihi sayfa yenilemede korundu; mobil taşma yok. SEO tek h1/dört farklı title/canonical/sitemap ve WebPage/BreadcrumbList ile kontrol edildi; duplicate adresler 301, özel handler 404. Ayrıntı website-php/README.md içinde. Canlı mail, hosting, hukuki metin ve Search Console kabulü bekler.

Görüşme formu bildirim alıcısı kullanıcı isteğiyle mymarius1@gmail.com olarak yapılandırıldı. Hosting mail taşıyıcısı ve doğrulanmış gönderici etkinleştirilince bildirim gönderimi denenir; hatada kuyruk korunur. Gerçek e-posta gönderimi/teslimatı test edilmedi.

## PHP fiyatlandırma sayfası — 11 Ekim 2026

`/fiyatlandirma` eklendi: Başlangıç (990 TL / 3 ay; 2.990 TL / yıl), İşletme (2.490 TL / 3 ay; 7.990 TL / yıl), Kurumsal (4.990 TL / 3 ay; 15.990 TL / yıl). Tutarlar KDV hariç, dönem toplamıdır. Yıllık tasarruf dört adet 3 aylık tutarla hesaplanır. Teklif kataloğu `website-php/pricing.php` içinde; mevcut uygulamanın USD lisans kataloğu değiştirilmedi. Site ödeme almaz ve lisans etkinleştirmez. Limitler mevcut Starter/Business/Enterprise lisanslarından alınmıştır; canlı kurum entegrasyonları vaat edilmez.

Değişen dosyalar: index.php, contact.php, smtp.php, .htaccess; yeni pricing.php, pricing-view.php ve assets/pricing.css. Menü, mobil menü, footer, canonical, açıklama ve sitemap bağlantıları eklendi. Paket kodu sunucuda izin listesiyle doğrulanır; kayıt ve e-posta gövdesine sunucunun belirlediği tutar/süre eklenir.

Çalıştırılan kontroller: tüm kök PHP dosyaları syntax kontrolü; altı HTTP görünümü 200 ve tek h1; sitemap 5 URL; 14 bağımsız PHP kabul kontrolü (altı paket/dönem, geçersiz dönem ve dizi, kayıt, tek dosya, değiştirilmiş istemci tutarını yok sayma, seçimi koruma, geçersiz paketi reddetme ve kaydetmeme). Kayıt testinde ayrı sentetik dizin kullanıldı ve temizlendi; SMTP kapalıydı. Tarayıcıda 3 aylık/yıllık geçiş, seçimin forma aktarımı, 1366 px masaüstü ve 390 px açık/koyu tema kontrol edildi; küçük ekranda yatay taşma ve konsol hatası yok. Görüntüler website-php/preview/pricing-*.png.

Bekleyen: canlı yayında Search Console ve indeksleme; bu değişiklik için gerçek e-posta teslimatı testi yapılmadı. Fiyat seviyesi için Bizim Hesap resmî fiyat sayfası incelendi (https://bizimhesap.com/fiyatlar); özellik eşdeğerliği iddiası yok. Üretim kayıtları ve mevcut SMTP sırları değiştirilmedi.

### Renk ve hareket güncellemesi — 11 Ekim 2026
Site ve fiyatlandırma paleti petrol/adaçayı tonlarına güncellendi. assets/motion.css: kademeli giriş, kart/düğme hover, menü alt çizgisi, merkez/orbit ışık ve durum göstergesi animasyonları. assets/site.js: kartlara reveal ve grup gecikmesi; canlı reduced-motion değişimine uyum. Masaüstü ve 390 px mobil açık/koyu görünüm incelendi; yatay taşma ve konsol hatası yok. PHP syntax ve motion CSS HTTP 200 geçti. Tarayıcı reduced-motion=true: hesaplanan animation-name=none; normal hareket tercihiyle animasyonların canlı oynatımı bu ortamda ayrıca doğrulanmadı. Görüntüler preview/home-sage.png, home-sage-mobile.png, pricing-sage.png. Form/SMTP/plan tutarları değiştirilmedi.

### Detaylı anlatım — 11 Ekim 2026
Ana sayfa ve fiyatlandırmaya altı adımlı Nasıl çalışır bölümü eklendi: ürün, kabul, depo/sayım, satış/vardiya, lot/miat, erişim. Yeni guide-view.php ve assets/guide.css; menü bağlantısı index.php içinde güncellendi. İçerik HTML olarak sunulur, JavaScript olmadan okunur. Temsili 24-3=21 stok örneğinin varsayımları görünürdür. PHP syntax, altı adım, fare ve Enter ile açılma kontrolü geçti; 390 px görünümde yatay taşma ve konsol hatası yok. Genel FAQ CSS'inin tüm summary span elemanlarını döndüren kuralı yeni bölüm içinde sınırlandırıldı. Son görüntü preview/guide-desktop.png. Üretim verileri ve bildirim ayarları değiştirilmedi.

### Electron geliştirme başlangıcı — 11 Ekim 2026
Mevcut desktop altyapısı geliştirildi, Electron 44.7.0 kuruldu. Yeni runtime.js ve dört testi; frontend desktop.css; titlebar gerçek /health durumu ve erişilebilir pencere kontrol adları. API adresi doğrulanır; geliştirme profili/lisans deposu .local altında izole edilir; tüm IPC alıcıları pencere/ana frame ve gezinme denetimine tabidir. React build ve dört runtime testi geçti; gerçek Electron süreç/pencere varlığı doğrulandı. Yerel dosya renderer için CSP eklendi. Backend ve mevcut kullanıcı verileri başlatılmadı/değiştirilmedi. ZIP/kurulum paketi üretilmedi. Native görsel kabul, pencere kontrol etkileşimleri, giriş ve operasyon/cihaz regresyonları henüz yapılmadı; masaüstü tamamlandı veya kusursuz kabul edilmez. Ayrıntılar desktop/README.md. PHP site değiştirilmedi.

Kurulum asistanı: Veniux-Kurulum.cmd, Veniux-Baslat.cmd ve desktop/Setup-Veniux.ps1 eklendi. Adres .local altında kalıcı; runtime validasyonu korunur. Parser ve dört test geçti; sihirbaz açma komutu çalıştırıldı, görsel/etkileşim kabulü yapılmadı. MariaDB şema doğrulaması halen başarısız; backend hazır olarak gösterilmez. Bağımsız Windows installer üretilmedi.


### XAMPP MariaDB masaüstü bağlantısı — 11 Ekim 2026
MariaDB 10.4.32 gerçek sunucuda doğrulandı. mysqlMigrator integer türleri için yalnız gösterim genişliğini normalleştirir; decimal hassasiyeti, unsigned ve diğer türler aynı sıkı denetimde kalır. Önceki başarısız veniux_desktop_dev hedefi silinmedi veya açılmadı. Yeni veniux_desktop_dev2 boş hedefinde sürümlü migration ve verifyStructure geçti (86 tablo). Root yalnız ayrı hedefin hazırlanmasında kullanıldı; günlük API hesabı veniux_desktop_app yalnız SELECT/INSERT/UPDATE/DELETE izinlidir.

.local/desktop-xampp.json sırları içerir, Git dışıdır; yalnız geliştirme hedefini kabul eden .local/start-xampp-backend.cjs sunucuyu 127.0.0.1:3000 üzerinde açar. Veri dizini, JWT ve lisans anahtarları .local/desktop-backend altında ayrıdır. Arka plan işleri kapalıdır. Sentetik admin hesabı yalnız yeni hedefte oluşturuldu; giriş bilgileri .local/desktop-test-login.json içinde ve çıktıya yazılmadı. Gerçek HTTP health (mysql), register, Origin:null login ve /auth/me geçti. Native Electron formunda kullanıcı etkileşimli giriş ayrıca doğrulanmadı; tüm MySQL/MariaDB operasyon regresyonlarının geçtiği iddia edilmez.

Veniux-Baslat.cmd artık desktop/Start-Backend.ps1 ile sunucuyu hazırlar; XAMPP MySQL açık olmalıdır. Çalışan sunucu yolu testi geçti. Windows native görsel kabul ve yeniden başlatmadan sonra tam giriş kullanıcı testi bekliyor. Mevcut firma verileri kullanılmadı.

### Windows NSIS kurulum sihirbazı — 11 Ekim 2026
Kullanıcının güncel açık isteğiyle Setup.exe oluşturuldu: .local/desktop-installer/Veniux-Setup-2.4.0.exe. Kullanıcı başına kurulum, klasör seçimi, masaüstü/başlat menüsü kısayolları ve sunucu gereksinimi bilgilendirmesi yapılandırıldı. Backend, XAMPP, veritabanı ve AI sırları installer kapsamına dahil değildir. İstemci 127.0.0.1:3000 API sunucusuna bağlanır; Veniux-Baslat.cmd sunucu hazırlığı ayrı kaynak klasöründe kalır. Electron-builder exit 0; React build ve dört runtime testi geçti; ASAR runtime.js ve media CSP doğrulandı; özel env/config dosyaları yok. Kod imzası yok, otomatik güncelleme feed olmadan kapalı. Windows kurulum/kaldırma akışının native görsel kabulü ve reboot sonrası backend başlatımı bekliyor. Tam bağımsız yerel sunucu kurulumu iddia edilmez.

Logo düzeltmesi: DesktopTitleBar mevcut Veniux PNG kullanır; desktop/assets/icon.ico mevcut logodan oluşturuldu. Windows EXE kaynağına resmi rcedit aracıyla ikon yazıldı; ExtractAssociatedIcon çıktısı Veniux görseli olarak incelendi. 2.4.1 NSIS kurulum/çıkarma ikonları güncellendi. Önceki kurulum Windows ikon önbelleği yeni sürüm kurulduktan sonra kullanıcı ortamında kontrol edilmelidir. Kod imzası yok.


### Masaüstü görünüm düzenlemesi — 11 Ekim 2026, 2.4.2
AuthShell: login panelinde dekoratif depo rotaları ve CSS ile ilerleyen ışık çizgileri; etiket sadeleştirildi, başlık kısaltıldı. Dekoratif katman aria-hidden ve pointer-events:none; prefers-reduced-motion animasyonları kapatır. workspace-refinement.css: ortak Segoe UI/system typography, gerçek monospace, daha sade tablo başlıkları, kart/dialog/form/sidebar yüzeyleri. enterprise.css içindeki bütün alt elemanları Montserrat'a zorlayan !important kural kaldırıldı; index.css temel fontları token kullanır. main.jsx ortak düzenlemeyi en son yükler. Veri veya operasyon API değişikliği yapılmadı.
Geçen: son kaynakla React production build. Derleme görünüm kabulü sayılmaz. Bekleyen: native Electron ekran görüntüsü, küçük ekran/koyu tema ve hareket azaltma canlı görsel kontrolü, operasyon ekranları boyunca görsel regresyon. Tarayıcı önizleme açma girişimi URL güvenlik politikası tarafından engellendi; görsel kabul tamamlandı iddiası yok. Windows 2.4.2 installer son kaynakla yeniden oluşturuluyor; sonucu ayrıca kaydedilecek.
Son kaynakla 2.4.2 Windows NSIS üretimi exit 0 ile tamamlandı; mevcut dört runtime testi geçti. Installer kod imzası bulunmuyor. Native görsel/kurulum kabulü bekliyor.

### Ayarlar kaydırma hatası ve otomatik yerel sunucu — 11 Ekim 2026, 2.4.3
Settings.jsx sabit viewport yüksekliği ve iç overflow kaldırıldı; ana sayfa tek kaydırma kullanır. Uzun ayar başlıkları kırılır; dar ekranda menü iki sütuna geçer. workspace-refinement.css masaüstü titlebar yüksekliğini 44px olarak sidebar/header/minimum yüksekliğe uygular.
Prepare-LocalDatabase.ps1 yalnız gerçek MariaDB 10.4.32 çalıştırılabilir bilgisini doğrular; mevcut XAMPP veri ve ayarlarını kullanmaz. Yoksa resmî sabit XAMPP installer indirip üreticinin yayımladığı SHA1 değeriyle eşleştirir; unattended kurulumu ayrı kullanıcı alanına yapar. ZIP veya hash raporu oluşturulmadı. local-server.cjs özel ACL, bağımsız datadir, loopback port, datadir/port kimliği, sürümlü migration ve sınırlı hesaplarla üretim API hazırlar. Parolalar ve anahtarlar müşteride üretilir. Hatalı/yeni şemada operasyonlar açılmaz; günlük root hesabı kullanılmaz. main.js paketli Node/backend varsa ilk açılışta bu süreci başlatır; doğrulanmış çalışan eski API varsa bağlantıyı korur. electron-builder.config.js yalnız izin verilen backend kaynakları/bağımlılıkları ve Node lisansını yerel sunuculu pakete ekler; .local sırları/backend .env müşteri paketinde bulunmaz.
Geçen: TEMP altında iki yeni izole MariaDB alanında gerçek ilk hazırlık + production API /health, DDL yetkisinin reddi, temiz kapatma/yeniden başlatma ve JWT korunması. Mevcut XAMPP verileri değiştirilmedi. Dört runtime testi, JS syntax/PowerShell parser ve son frontend build geçti.
Bekleyen: XAMPP olmayan temiz Windows indirme/installer/UAC testi, paketli EXE ilk açılış ve reboot, yarım kurulum/çakışma senaryoları ve native görsel kaydırma kabulü. Ticari dağıtımın tümü tamamlandı iddiası yok. Website fiyatlandırması ödeme doğrulama içermez; satın alma sonrası otomatik indirme/teslimat ayrıca yapılmalıdır. Ayrıntılar docs/DESKTOP-AUTOMATIC-SETUP.md içinde. Son installer sonucu ayrıca kaydedilir.
Ek kabul: paketlenen Node 24.15.0 + backend payload ile ayrı TEMP veritabanında ilk hazırlık, DDL reddi ve yeniden açılış geçti. Gerçek port çakışması veritabanı oluşturulmadan reddedildi; sentetik yarım kurulum status=preparing reddedildi ve klasörü korundu. Son kaynak/payload local-server.cjs byte eşleşmesi doğrulandı. Temiz Windows indirme/UAC, native Electron açılışı/reboot ve görsel kabul hâlâ bekliyor.
Kalıcı hedef seçimi: runtime.js selectLocalServer kullanıcı profilinde server-selection.json tutar. Seçilmiş harici sunucu kapalıyken yeni boş veritabanına geçilmez; managed hedef yeniden açılışta başka APIye dönmez. Geçersiz credential içeren hedef reddedilir. Bu üç testle birlikte yedi runtime testi geçti. Gerçek iki Electron süreci/yerel-hedef geçişlerinin tüm kabulü iddia edilmez.
Son kaynakla yerel sunuculu Veniux-Setup-2.4.3.exe üretimi exit 0 ile tamamlandı (217901108 bayt). Paketli ASAR main.js/runtime.js ve frontend giriş dosyası son kaynakla eşleşti; local-server ve PowerShell kurulum payload byte eşleşmeleri de doğrulandı. Installer imzasızdır. Bu dosya test/değerlendirme için hazır; temiz Windows, ilk native Electron açılışı/reboot ve görsel kabul bekliyor.

## 11 Ekim 2026 — Merkezi lisans yönetimi

Kullanıcının açık yeni talebiyle api.veniux.com PHP yönetim klasörü oluşturuldu. Lisans oluşturma, askıya alma/yeniden etkinleştirme/kalıcı sonlandırma, donanım kimliğine bağlı terminal kayıtları, terminal adı ve erişim durumu, yönetici oturumu/CSRF/işlem geçmişi ve imzalı doğrulama API'si eklendi. Merkezi mod Node API kapısında tüm operasyon isteklerine uygulanır; çevrimdışı çalışma verilmez. Electron dağıtım yapılandırmasına HTTPS merkez adresi ve sabit public key aktarımı eklendi. Yeni kurulum paketi üretilmedi; önceki EXE bu kodu içermez. Mevcut işletme verilerine dokunulmadı; çalışan eski lisans modu kendiliğinden merkeze taşınmadı.

Geçen: ayrı SQLite hedefinde gerçek HTTP ve iki PHP süreciyle eşzamanlı tek terminal kapasitesi, imzalı cevap, yanlış donanım reddi, terminal adı güncellemesi, askıya alma/yeniden açma/sonlandırma, iptal sonrası aktivasyon reddi, merkez kapalıyken Node engeli. PHP sözdizimi ve panel/ürün arayüz derlemeleri geçti. Tarayıcıda yönetici girişi, lisans paneli/penceresi ve Esc kapanışı ile açan düğmeye odak dönüşü doğrulandı.

Bekleyen/doğrulanamayan: yeni merkezin MySQL/MariaDB kabulü, tam Electron uçtan uca kabulü, temiz Windows testi, canlı DNS/HTTPS ve üretim güvenlik incelemesi. Kullanıcının henüz sunucusu yok. Yerel panel 127.0.0.1:39210 adresinde çalışır; api.veniux.com canlı değildir. Bu ekleme tüm eksikler giderildi veya üretime hazır iddiası taşımaz. Ayrıntılar api.veniux.com/README.md dosyasında.

## 11 Ekim 2026 — 2.4.4 çalışma alanı incelemesi

Son kaynak için ayrıntılı kapsam ve kanıtlar APP-DESIGN-SECURITY-REVIEW.md dosyasındadır. Ortak font/CSS, koyu tema, ölçülü animasyonlar, pencere odağı ve kaydırma düzenlendi. Görünüm tercihleri ayar sekmesi ve küçük ekran denetimine dahil edildi. Ürün detayında depo stoku ile raf stokunun karışması giderildi. 633 sunucu, 7 masaüstü, 4 bağımlılık ve 4 stok gösterim testi geçti. Aktif operasyon rotaları, 14 ayar sekmesi ve 10 CRM ekranı sentetik veriyle görüntülendi.

Bu sonuçlar önceki raporun daha geniş kabul iddialarını genişletmez: canlı MySQL, temiz Windows kurulumu, tüm gerçek cihazlar, tüm dinamik kayıtlar ve dış sağlayıcılar bu turda doğrulanmadı. Bağımlılık taramaları bilinen açık göstermedi; bağımsız sızma testi yerine geçmez. Mevcut lint uyarıları sürüyor. Üretim verilerine dokunulmadı.

## 11 Ekim 2026 — 2.4.5 kurulum düzeltmesi

Kullanıcının 2.4.4 yerel hazırlık hatası sonrası paket incelendi: sunucu node_modules klasörü extraResources filtresinden dolayı bulunmuyordu. Önceki kurulum üretimi kontrolü bu eksikliği yakalamamıştı. 2.4.5 açık kopyalama ve paket içindeki Node ile tüm sunucu bağımlılıklarını çözümleme/native modülleri yükleme kontrolü ekler; eksik bağımlılıkta paketleme başarısız olur. Sunucu bağımlılık yüklemesi de yakalanan başlangıç akışına taşındı.

Paketlenmiş Node ve sunucu, kullanıcı verilerinden ayrı .local/bundled-server-acceptance-* klasöründe yeni MariaDB veritabanıyla gerçekten çalıştırıldı. İlk kurulum ve aynı veritabanıyla yeniden açılışta health: ok, database: mysql, migrations: current döndü. Her iki test sonrasında sunucu ve veritabanı kapatıldı. 7 masaüstü hedef koruması testi tekrar geçti. Kullanıcı AppData verisi değiştirilmedi. Tam temiz Windows/Electron arayüz kabulü ve MySQL iş senaryolarının tamamı bu iki başlangıç testiyle tamamlanmış sayılmaz.
