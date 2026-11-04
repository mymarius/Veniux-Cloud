# VENIUX POS — Kasiyer arayüzü yeniden tasarımı

Takip çalışması: [Terminal UX 2.0 kalite iyileştirmeleri](VENIUX_POS_TERMINAL_UX_2.md). Aşağıdaki ilk yeniden tasarım raporu tarihsel kanıt olarak korunmuştur; güncel kart, dokunmatik sepet ve performans sonuçları takip raporundadır.

18 Ekim 2026 · Yerel geliştirme ve izole test. Canlıya yayın, üretim DB değişikliği veya EXE/APK dağıtımı yapılmadı.

## Sonuç ve mimari sınır

`/magaza/kasa` artık lisans ve oturum kontrollerinden geçtikten sonra ERP Layout içine alınmaz. Ayrı Veniux POS terminali açılır. ERP sidebar, global yönetim üst menüsü ve asistan terminalde oluşturulmaz. Diğer sayfalar mevcut Layout'u kullanır. Aynı React/Node/Electron/Java mimarisi korundu.

Satış, stok, FEFO/lot, KDV, cari/veresiye ve SmartCount servisleri bu görevde değiştirilmedi. Var olan `/scanner/sale`, iade, vardiya, fiş, izin ve idempotency sözleşmeleri kullanılır. Yeni DB migration yoktur. Terminalin kimlik doğrulaması mevcut şifre, hesap durumu, lisans ve MFA kontrolünü yeniden kullanır; ayrı satış motoru yoktur.

## Arayüz

- Sabit yükseklikte üst terminal çubuğu, esnek satış alanı, sağ işlem paneli ve tek satırlık durum alanı. Ana sayfa ve sağ işlem paneli hedef çözünürlüklerde kaydırma gerektirmez.
- Klasik modda büyük sepet; görselli modda büyük ekranlarda yan yana sepet/katalog, daha küçük kasalarda üstte sepet ve altta katalog. Uzun sepet ve büyük katalog kendi alanında kaydırılır; sayfa boyu uzamaz. Tüm ürünlerin sonsuza kadar kaydırmasız sığacağı iddia edilmez.
- Toplam, ödeme düğmesi ve barkod alanı sürekli görünür. Sepet satırlarında fiyat, stok, miktar, toplam ve kaldırma korunur. Yetkili fiyat değişikliği ayrı düzenleme/onay penceresindedir.
- Görselli kartlar kimlik doğrulamalı mevcut fotoğraf bileşenini kullanır. Fotoğraf yoksa harf yer tutucusu gösterilir; sahte ürün fotoğrafı eklenmez. Kategori, favori, arama ve sayfalama korunur. Marka/fotoğraf/kategori görünüm ayarları yetkili pencereye taşındı.
- Ödeme ayrı, odak sınırlamalı bir penceredir. Nakit ve parçalı ödemede sayısal klavye, kart/veresiyede açıklayıcı panel açılır. Nakit, kart, nakit+kart ve yönetici için veresiye mevcut motora gider. Gerçek banka tahsilatı yapılmış sayılmaz.
- Sıradan nakit satışta barkod Enter ile sepete girer; ardından “Ödeme al” ve tutarı gösteren “Ödemeyi kaydet” yeterlidir. Gereksiz ikinci ödeme onayı kaldırıldı. Ödeme panelinde Enter kayıt yapmaz, F9 para alanından odağı çalmaz.
- Başarılı satıştan sonra sepet temizlenir ve yeni satış ekranına dönülür. Fiş otomatik modal ile akışı kesmez; “Son fişi aç / yazdır” ve geçmiş üzerinden erişilir. Otomatik fiziksel yazdırma eklenmedi.
- Vardiya, geçmiş/iade, gün sonu, nakit hareketleri, yazıcı ve depo seçimi ayrı pencerelerdedir. SmartCount, cari yönetimi, donanım rehberi ve gelişmiş ayarlar yetkili alandadır. Okuyucunun aynı bağlı bileşeni korunarak HID/seri/köprü/kamera araçları silinmedi.
- Bekletme ve geri alma ayrı hızlı işlemlerdir; bekletilen sepet silme işlevi korunur. Farklı depo veya dolu sepete yanlışlıkla geri yükleme mevcut denetimle reddedilir.
- Native Electron pencere çubuğu için 44 px ayrılır; tarayıcı tam ekranda terminal tüm ekranı kullanır. Bu bir Windows kiosk/OS güvenlik kilidi değildir.

## Kilit, kasiyer değişimi ve onay

1. Kilitleme, aynı sekmede kullanıcı/işletmeye özel kilit ve sepet taslağı saklar. Ana terminal inert olur; tarama ve checkout kodu da kilidi denetler. Esc/arka plan/çarpı şifresiz kilidi açmaz. Yenilemeden sonra kilit ve sepet korunur. Şifre/token taslağa yazılmaz.
2. Kilidi yalnız aynı kullanıcı açabilir. Hatalı şifre mevcut kasiyer tokenını silmez. Bu istisna yalnız bayraklı `/auth/terminal-verify` isteği içindir; normal satış/lisans 401/423 davranışı korunur.
3. Terminal doğrulama ucu geçerli oturum ve satış rolü ister. Aynı işletme ve işleme uygun kimlik sunucuda da denetlenir; mevcut login kontrolü şifre/MFA/hesap/lisans doğrulamasını yapar. Başarısız denemeler kasiyer başına 15 dakikada 6 ile sınırlanır. Başarılı kilit açmalar bu sayacı tüketmez; normal login sınırı değiştirilmedi.
4. İndirim/fiyat değişikliği için aynı işletmeden yönetici doğrulama adımı vardır. Yönetici tokenı kasiyerin oturumuna yazılmaz. **Bu bir UI doğrulama adımıdır; satışa bağlı imzalı, tek kullanımlık onay bileti veya yeni bir mali onay defteri değildir.** Mevcut sunucu izinleri geçerlidir; yetkisiz kasiyere yeni indirim/fiyat/iade yetkisi verilmez. Böyle bir ayrı onay sistemi ileride istenirse motor sözleşmesi ayrıca tasarlanmalıdır.
5. Kasiyer değişimi dolu sepet, sonucu belirsiz satış veya açık vardiya varken engellenir. Vardiya kapatıldıktan sonra yeni satış yetkili kullanıcı kendi hesabıyla giriş yapar. Bekletilen sepetler önceki kullanıcıya aittir. Farklı işletmeye veya viewer rolüne geçiş reddedilir.

Kilit, aynı tarayıcı profilinde yetkili geliştirici araçlarına sahip kişiye karşı sunucu/OS güvenlik sınırı değildir. Paylaşılan fiziksel kasalar için işletim sistemi hesap ve kiosk politikası ayrıca gerekir. Sekme dışında yeniden açılan tarayıcı veya farklı cihaz için kalıcı sunucu kilidi iddia edilmez.

## Test sonuçları ve kanıtlar

### Otomatik

| Kapsam | Sonuç | Kanıt |
|---|---|---|
| 16 mevcut/yeni API regresyon paketi | **164 PASS, 0 FAIL** | `.local/customer-experience/run-bf210b3ee1845eac/jest.json` |
| Paylaşılan bileşen, kurulum, scanner, baskı ve terminal kimliği sözleşmeleri | **38 PASS, 0 FAIL, 0 SKIP** | `.local/customer-experience/run-c78c999a74cbaeff/presentation.log` |
| Son React üretim derlemesi | **PASS, exit 0** | `.local/customer-experience/run-c78c999a74cbaeff/frontend-build.log` |
| Sanal donanım laboratuvarı | **162 PASS, 0 FAIL, 5 BLOCKED, 5 NOT TESTED** | `.local/hardware-lab-runs/run-7126a1db4b8e9adfb923861c`; `docs/VENIUX_HARDWARE_TEST_REPORT.md` |
| Oxlint — değişen arayüz dosyaları | Hata yok; hook bağımlılığı/ref temizliği ve bir kullanılmayan durum uyarısı var | Tam lint temizliği iddia edilmez |

Backend 164 testi son backend kaynaklarıyla çalıştı. Sonraki değişiklikler yalnız arayüz boyut/odak/fiş erişimi olduğu için 38 sözleşme testi ve derleme tekrar çalıştırıldı. Donanım ve API paketleri ortak testler içerir; sayılar benzersiz toplam diye toplanmaz. Engelli/yapılmamış kontroller başarıya dahil edilmedi.

Yeni testler: kullanıcı/işletme kimliği ve rol doğrulaması; normal API'lerin reauth istisnasına girmemesi; yanlış şifre; 8 başarılı tekrarın deneme sınırını tüketmemesi; oturumsuz, farklı işletme ve yanlış aktör engeli. Mevcut stok, cari, iade, KDV, lot, yetki ve çift işlem testleri korunur.

### Gerçek tarayıcı kabul testleri

Yalnız loopback test sunucusu, geçici SQLite, sentetik işletme/kasiyer/ürünler kullanıldı. Gerçek müşteri hesabı veya mali tahsilat yoktur.

| Akış | Gerçek gözlem |
|---|---|
| HID Enter | Süt barkodu sepete 35 TL olarak eklendi; yeni satış isteği gönderilmedi |
| Tartılı ürün | 250 g elma = 0,25 kg × 45 TL = 11,25 TL |
| Yönetici adımı | 2,25 TL indirim aynı işletmenin yönetici şifresiyle uygulandı; toplam 44 TL oldu |
| Nakit | 44 TL satış, 50 TL alınan, 6 TL para üstü; fiş matrah 40/KDV 4 TL |
| Kart | 15 TL kart kaydı tamamlandı; gerçek banka işlemi değildir |
| Parçalı | 35 TL satış, 20 kart + 15 nakit; 20 nakit alınan, 5 TL para üstü |
| Veresiye | Test cari kartına 15 TL borç; vade 2027-02-02, nakit sıfır; fişte ayrı veresiye satırı |
| Vardiya | 59 TL nakit, 35 TL kart, 15 TL net veresiye, 11 TL para üstü; 59 TL sayımla fark sıfır ve kapanış başarılı |
| Bekletme | Bir ürünlü sepet bekletilip ayrı pencereden 35 TL ile geri yüklendi |
| Kilit | Dolu sepetle kilit/yenileme sonrası 35 TL sepet korundu. Yanlış şifre kilitte kaldı; doğru şifre açtı. Son terminal doğrulama ucu ile de tekrarlandı |
| Kasiyer | Açık vardiyada değişim engellendi; kapanıştan sonra ayrı sentetik cashier hesabına geçildi, yönetici/indirim araçları görünmedi |
| Odak | Ödeme formundaki F9 nakit alanından odağı çalmadı; Enter satış kaydetmedi |
| Fiş | Son sürümde 35 TL satış, 40 TL alınan, 5 TL para üstü; otomatik önizleme yok, son fiş düğmesi aynı kayıtlı fişi açtı |

İlk görsel test, yanlış şifrede genel interceptor'ın oturumu kapattığını buldu; düzeltildi ve yeniden test edildi. Sık reauth denemelerinin genel login sınırına çarpması da doğrulandı; mevcut login limiti gevşetilmeden ayrı oturum korumalı, başarısız deneme sayacı eklendi. 1024 px tam ekran düğmesi önce 37 px idi; 44 px'e tamamlandı. Kapanış animasyonunun barkod odağını geri alması için son odak düzeltmesi ayrıca derlendi ve kontrol edildi.

### Çözünürlük matrisi

| Çözünürlük | Klasik | Görselli | Ana sayfa / sağ panel kaydırma | Barkod + ödeme | Ana dokunma hedefleri |
|---|---|---|---|---|---|
| 1024×768 | PASS | PASS | Yok | Görünür | En az 44×44 px |
| 1280×800 | PASS | PASS | Yok | Görünür | En az 44×44 px |
| 1366×768 | PASS | PASS | Yok | Görünür | En az 44×44 px |
| 1920×1080 | PASS | PASS | Yok | Görünür | En az 44×44 px |

Kanıt: `.local/pos-ux/final-viewports.json`; `classic-1024x768.png`, `classic-1280x800.png`, `classic-1366x768.png`, `classic-1920x1080.png` ve karşılık gelen `visual-*` dosyaları. Ödeme: `payment-1024x768.png`; kilit: `locked.png`. İşlem kanıtları: `cash-receipt.txt`, `card-receipt.txt`, `split-receipt.txt`, `credit-receipt.txt`, `shift-totals.txt`. Görsellerde gerçek fotoğrafı olmayan test ürünleri harfle gösterilir. Önizleme data/anahtarları iş bitiminde temizlenir; küçük kanıt dosyaları kalır.

Sekiz çözünürlük görüntüsü `run-a8ae719902c2999f` derlemesindendir. Sonraki tek arayüz düzeltmesi ödeme sonrası barkod odağının kapanış animasyonundan sonra geri verilmesidir; bu düzeltme `run-c78c999a74cbaeff` ile tekrar derlenip gerçek satışla doğrulandı. `.local/pos-ux/final-focus.json`: sıfır açık dialog, aktif alan “Barkod okut veya elle gir”, 35 TL tamamlanmış test satışı. Son tarayıcı konsolunda error kaydı yoktu. Geçici viewport ayarı sıfırlandı.

## Dosya bazında değişiklikler

| Dosya | İşlev |
|---|---|
| `frontend/src/App.jsx` | Lisans/oturum denetiminden sonra kasa rotasını Layout dışında açma; terminalde asistanı oluşturmama |
| `frontend/src/pages/RetailPos.jsx` | Ayrı terminal kabuğu; odaklı ödeme; modal vardiya/geçmiş/yönetim; kilit, hesap değişimi/onay bağlama; satış sonrası yeni satışa dönüş ve son fiş erişimi |
| `frontend/src/pages/PosTerminal.css` | Sabit ekran ızgarası, duyarlı sepet/katalog, büyük toplam/işlem hedefleri, ödeme düzeni ve native başlık payı |
| `frontend/src/components/RetailProTools.jsx` | Terminal modu; katalog/favoriler; bekleyen sepet penceresi; donanım/cari/fotoğraf/kategori ayarlarını yetkili pencereye taşıma |
| `frontend/src/components/ScannerPanel.jsx` | Kompakt barkod/kamera; aynı scanner örneğinin bağlantı araçlarını ayrı pencerede koruma |
| `frontend/src/components/TerminalIdentity.jsx` | Gerçek şifre/MFA doğrulamalı kilit, kasiyer değişimi ve yönetici adımı; parola saklamama |
| `frontend/src/lib/terminalIdentity.mjs` | İstemcide kullanıcı/işletme/rol doğrulaması; izin yükseltmez |
| `frontend/src/lib/terminalReauth.mjs` | Yalnız terminal reauth hatasının mevcut oturumu silmesini engelleyen dar koşul |
| `frontend/src/lib/terminalIdentity.test.mjs` | 4 yeni arayüz sözleşme/güvenlik testi |
| `frontend/src/api/client.js` | Bayraklı terminal doğrulama hatasını normal oturum sona ermesinden ayırma |
| `backend/src/routes/authRoutes.js` | Mevcut login kontrolünü kullanan, oturum/rol/işletme korumalı terminal doğrulaması ve başarısız deneme sınırı |
| `backend/tests/retailPro.test.js` | 2 yeni terminal doğrulama entegrasyon testi; mevcut assertion'lar kaldırılmadı |
| `tools/customer-experience/run.cjs` | Yeni sözleşme testini mevcut izole pakete ekleme |
| `tools/customer-experience/preview.cjs` | Yalnız test ortamında ikinci sentetik kasiyer fikstürü |
| `docs/VENIUX_HARDWARE_TEST_REPORT.md` | Çalıştırılan donanım paketiyle güncellendi |
| `docs/audits/VENIUX_POS_UX_REDESIGN.md` | Bu kapsam, kanıt ve sınır raporu |

## Kalan doğrulama ve yayın engelleri

- Gerçek dokunmatik kasa, HID/Bluetooth okuyucu, terazi, termal çıktı ve ÖKC test edilmedi. HTML/komut simülasyonu fiziksel başarı değildir.
- Android Emulator/üretici tarama tuşu ve temiz Windows VM ortamı yok; önceki rapordaki engeller sürüyor. Native pencere çubuğu payı kodda ele alındı; paketli Electron üzerinde bu görevde çalıştırılmadı.
- 4 çözünürlük normal tarayıcı zoom ile test edildi. Windows %125/%150 DPI, dokunmatik ekran klavyesi ve erişilebilirlik zoom kabulü gerçek cihazda yapılmalı.
- Test ürünleri gerçek fotoğraf içermediği için fotoğraf indirme yükü/yavaş ağ görsel performansı ayrıca test edilmeli. Mevcut özel resim API regresyonu geçti.
- MFA dalı mevcut doğrulamayı kullanır; gerçek MFA etkin hesabıyla etkileşimli kabul testi yapılmadı.
- Yönetici adımı, sunucuda yeni işlem bazlı yetki devri değildir. Mevcut roller/izinler ve UI kilidinin sınırları yukarıda açıklanmıştır.
- Önceki Retail Pro raporundaki gerçek ÖKC/UBL-TR/cihazlar arası offline outbox/SmartCount canlı satış mutabakatı eksikleri bu arayüz göreviyle tamamlanmış sayılmaz.
- Canlı için kontrollü paketleme, kopya ortam kabulü ve kullanıcı onayı gerekir. Bu çalışmada canlı dağıtım yapılmadı; üretim verisi silinmedi/değiştirilmedi.
