# VENIUX POS — Terminal UX 2.0 kalite raporu

Tarih: 18 Ekim 2026. Durum: yerel geliştirme / izole test. Canlı yayın, üretim DB değişikliği ve yeni EXE/APK dağıtımı yapılmadı. Önceki rapor: `VENIUX_POS_UX_REDESIGN.md`.

## Uygulanan iyileştirmeler

### Ürün kartları ve fotoğraflar

- Gerçek PNG/JPEG/WebP dosyası seçimi mevcut yükleme akışını kullanır. Fotoğraf tarayıcıda 256×256 PNG'ye dönüştürülür; tenant ve ürün doğrulamalı özel resim API'sinden alınır. Kullanıcının önceki mesajında paylaştığı gerçek market fotoğrafı yalnız **Deneme · Fotoğraf aktarım kontrolü** adlı yerel test ürününde kullanıldı. Görsel, ürün adı ve fiyat gerçek bir satış ilanı veya katalog verisi olarak yayımlanmadı.
- Gerçek test eski 150 KB PNG sınırının bazı ayrıntılı fotoğrafları reddettiğini gösterdi. Sınır 300 KB'a çıkarıldı; PNG başlığı, 512×512 azami API ölçüsü, yetki ve tenant denetimi korundu. UI fotoğrafı 256×256 üretir ve kaynak dosyada 3 MB sınırını korur. Hazırlama/hata durumu yükleme penceresinde gösterilir.
- Fotoğraf yoksa kategoriye göre Lucide SVG simgesi kullanılır: manav/taze → yaprak, içecek → fincan, fırın → buğday, gıda → sepet; bilinmeyen kategoride paket. Önceden seçilmiş kategori simgesi korunur. Simge ürün fotoğrafı gibi sunulmaz.
- IntersectionObserver ile yalnız görünür/yakın fotoğraflar istenir; img ayrıca lazy/async çözümleme kullanır. İstek iptali, kapatılmış bileşene yazma engeli ve object URL temizliği vardır. Resim bileşeni memo ile korunur; sepet miktarı değişince mevcut fotoğraf tekrar indirilmez.
- Kart yüksekliği içerikle büyüyebilir; isim ve fiyat satırları kırpılmaz. Dört çözünürlükte uzun kahve adı, fiyat ve birim kart sınırları içinde doğrulandı. Büyük ekranda görsel alanı büyür. Fotoğraf kendi alanında contain ile gösterilir.
- Tek dokunuş ürün seçimi korunur; tartılı ürünün mevcut miktar penceresi korunur. “Sık kullanılanlar üstte” seçeneği, kullanıcının favorilerini başa taşır. Otomatik satış sıklığı analizi yapıldığı iddia edilmez. Favoriler normal sayfa dışında olsa bile ayrı sınırlı sorguyla getirilir; tekrar eden ürün ayıklanır.

### Sepet ve dokunmatik kullanım

- Klasik mod büyük sepeti; görselli mod dengeli sepet/katalog alanlarını kullanır. Uzun sepet yalnız kendi listesinde kayar. Ana sayfa, toplam ve ödeme erişimi sabit kalır. Katalog çok ürün olduğunda kendi alanında kayar; sonsuz sayıda ürünün kaydırmasız gösterildiği iddia edilmez.
- Miktar için 44×44 artır/azalt düğmeleri ve dokunmatik sayı klavyesi eklendi. Fiziksel klavyeyle sayı girişi ve F7/F9 kısayolları korunur. Adet 1 altına veya 100.000 üstüne gitmez; kesirli/scientific adet girişi reddedilir. Tartılı manuel satır ayrı miktar etiketi taşır; mevcut kg/litre hesabı değiştirilmedi.
- Sepetten kaldırma ayrı onay penceresindedir. Vazgeç/Enter ile yanlışlıkla satır silinmez. Tamamlanmış satış iade/iptalindeki mevcut yetki, gerekçe ve açık onay penceresi aynen korunur. Sepetten satır kaldırma stok veya mali kayıt oluşturmaz.
- Miktar klavyesinden sonra barkod odağı geri döner. Ödeme formunda F9 odağı çalmaz ve Enter ödeme kaydetmez. Satış sonrasında sepet temizlenip barkod odağına dönülür.

### Personel ve kasa bilgisi

- Başlıkta personelin full_name alanı ve mevcut kasanın adı/numarası gösterilir. Ad yoksa “Kasiyer” yazılır; e-posta, üretilmiş owner/user kimliği veya tenant ID'si ada dönüştürülmez. Eksik ad müşteri verisi uydurularak doldurulmaz.
- Test başlığı “Ayşe Demir · Ana kasa · 01” olarak doğrulandı; bu yalnız sentetik personeldir. Kullanıcı ve işletme kimlikleri sadece mevcut yönetici alanındaki “Yetkili tanılama” bölümündedir. Kilit ve kasiyer değiştirme doğrulaması değiştirilmedi.

### Katalog ve performans

- Kategori listesi yalnız ilk 40 üründen üretilmez; tenant'a ait NORMAL katalogdan ayrı, azami 200 kategorilik liste alınır. Kategori filtresi sunucuya gönderilir. 200 üzeri kategori için API truncated bilgisi döner; isim/barkod araması kullanılabilir.
- Aramada % ve _ karakterleri literal olarak ele alınır; kullanıcı girdisi SQL wildcard ile bütün kataloğu istemez. Parametreli sorgu, tenant kapsamı ve cursor sayfalama korunur. Arama ürün adı/SKU/barkod **başlangıcıdır**; tam metin arama veya yazım düzeltme değildir.
- Her katalog isteği 40 ürün, favori önceliği en çok 100 ürün getirir. Arayüzde art arda sayfa yüklemesi son 200 normal sonucu tutar; en çok 100 favori eklenebilir. DOM ürün sayısı bu nedenle sınırlıdır; eski ürünler aramayla tekrar bulunur. Mevcut DB/satış motoru veya şema değiştirilmedi.
- Kart listesi hesaplamaları memo; ürün seçme callback'i ve fotoğraf bileşeni kararlı tutulur. Mevcut güvenli bloke/işlem durumlarını güncelleyen render'lar kaldırılmadı.
- Barkod ölçümü sadece süre toplar: callback girişinden lookup yanıtına ve React layout commit'ine kadar. Son 50 başarılı okuma bellekte tutulur; barkod, müşteri veya ürün verisi kaydedilmez. Yönetici tanılaması samples/p50/p95 gösterir. Fiziksel okuyucunun karakter gönderme süresi bu ölçüme dahil değildir.

## Çalıştırılan testler

### Otomatik sonuçlar

Son tam koşu: `.local/customer-experience/run-64b6fc9a4f0cf873`.

Son arayüz koşusu: `.local/customer-experience/run-f020024362cefd26` — 43 PASS, 0 FAIL ve üretim derlemesi exit 0. Tam koşudan sonra yalnız adet üst sınırı mevcut sunucu sınırı 100.000 ile eşitlendi ve yükleme hatası yetkili pencerenin içine taşındı; satış/stok servisleri değişmedi. Ekran görüntüleri ve gerçek fotoğraf/satış kabulü tam koşunun derlemesindendir; bu son iki değişiklik ana ekran yerleşimini değiştirmez.

| Paket | Gerçek sonuç |
|---|---|
| 17 API/iş akışı paketi | **167 PASS, 0 FAIL** |
| Ortak arayüz/kurulum/scanner/baskı/kimlik sunum sözleşmeleri | **43 PASS, 0 FAIL, 0 SKIP** |
| React üretim derlemesi | **PASS — exit 0** |
| Sanal donanım laboratuvarı | **162 PASS, 0 FAIL, 5 BLOCKED, 5 NOT TESTED** |

Kanıtlar: `jest.json`, `backend.log`, `presentation.log`, `frontend-build.log`, `catalog-performance.json`. Donanım koşusu `.local/hardware-lab-runs/run-cda2e65ac2a7af28aec2badf`; ayrıntılar `docs/VENIUX_HARDWARE_TEST_REPORT.md`.

Mevcut POS/stok/ödeme/iade/KDV/cari/SmartCount/tenant ve rol testleri korunup tekrar çalıştırıldı. 3 yeni API testi kategori kapsamını, literal aramayı ve 5.000 üründe sorgu doğruluğunu kontrol eder. 5 yeni sunum testi kategori simgesi, teknik kimlik gizleme, favori ayıklama, adet sınırı ve süre özetini doğrular. Başarı için assertion kaldırılmadı. Ortak testleri içeren paketlerin sayıları benzersiz toplam diye toplanmaz.

### Performans — ölçülmüş gerçek yerel değerler

| Ölçüm | Veri kümesi / yöntem | Sonuç |
|---|---|---|
| Katalog prefix araması | 5.000 izole test ürünü, 25 gerçek API isteği, SQLite / Supertest loopback | p50 **4,369 ms**, p95 **4,730 ms**, en yüksek **4,870 ms** |
| Barkod → sepet layout commit | Gerçek terminalde HID tarzı klavye olayları, son 21 başarılı callback örneği | p50 **56,5 ms**, p95 **65,3 ms** |

İkinci ölçüm `.local/pos-ux2/barcode-latency.json` içindedir. İlk görsel koşuda 20 örnek p50 27,8 / p95 32,6 ms idi; sonraki gerçek koşunun yukarıdaki değerleri esas alınır. Bu farklar tek bilgisayarda ölçülen sonuçların SLA olmadığını gösterir. UI aramasında 250 ms debounce ayrıca vardır; 4,369 ms kullanıcı tuşundan sonuç ekranına kadar süre değildir. İnternet/yerel ağ, fiziksel HID, yazıcı gecikmesi veya zayıf CPU/DPI koşulları bu yerel ölçüme dahil değildir. Milyon ürün veya çoklu kasa yük garantisi verilmez.

### Gerçek tarayıcı doğrulaması

- 20 farklı barkod sepete eklendi; 20 satırın scrollHeight değeri görünür liste yüksekliğinden büyürken ana sayfa yüksekliği viewport ile aynı kaldı.
- Artır/azalt ve miktar klavyesinde 3 adet uygulandı; Enter tek başına onaylamadı. Klavyeden sonra aktif alan barkoddu. Kaldırma penceresinde vazgeçince satır korundu.
- 20 satır ve toplam 264 TL ile 300 TL nakit testi tamamlandı; para üstü 36 TL. İşlem sonrası sıfır sepet satırı, sıfır modal ve aktif barkod alanı doğrulandı: `sale-result.json`.
- Gerçek fotoğraf seçimi → 256×256 dönüşüm → özel API'ye kayıt → doğal ölçüsü 256×256 olan tam yüklenmiş img doğrulandı. Fotoğraf aktarımı yalnız yerel geçici test DB'sine yapıldı.
- Görünmeyen fotoğraf başlangıçta 25 kart içinde **0 yüklenmiş img**, scrollTop 0 olarak gözlendi; favori başa taşınıp görünür olduğunda **1 yüklenmiş img** oldu. Kanıt: `lazy-before.json`, `lazy-after.json`, `real-photo.png`. Bu test üretici cihaz/kamera testi değildir.
- Son tarayıcı konsolunda error kaydı görülmedi. Kamera, yazıcı veya gerçek banka cihazı çalıştırılmadı.

## Çözünürlük ve görsel kalite matrisi

| Çözünürlük | Klasik | Görselli | Ana sayfa taşması | Kart içerikleri | Ödeme | Dokunma hedefleri |
|---|---|---|---|---|---|---|
| 1024×768 | PASS | PASS | Yok | Kart içinde; ilk kart tamamen görünür | Erişilebilir | İncelenen ana kontroller ≥44×44 |
| 1280×800 | PASS | PASS | Yok | Kart içinde; ilk kart tamamen görünür | Erişilebilir | İncelenen ana kontroller ≥44×44 |
| 1366×768 | PASS | PASS | Yok | Kart içinde; ilk kart tamamen görünür | Erişilebilir | İncelenen ana kontroller ≥44×44 |
| 1920×1080 | PASS | PASS | Yok | Kart içinde; ilk kart tamamen görünür | Erişilebilir | İncelenen ana kontroller ≥44×44 |

Sekiz gerçek ekran görüntüsü `.local/pos-ux2/classic-*.png` ve `visual-*.png`; DOM ölçümleri `viewports.json`. PNG boyutları ayrıca okunarak hedef çözünürlükle karşılaştırıldı. 1366 yakalaması ilk araç çıktısında kırpıldığı için tam sayfa yakalamasıyla 1366×768 olarak tekrar alındı; görsel dosya dışarıda büyütülmedi veya düzenlenmedi. Ödeme görüntüsü `payment.png`.

Uzun sepet sadece kendi listesinde kayar. Görselli katalog da kendi alanında kayabilir; ana sayfanın kaydırmasız olması, tüm ürünlerin aynı anda görünmesi anlamına gelmez. Test verilerindeki uzunca kahve adı kart içine sığar; daha uzun gerçek adlarda satır yüksekliği doğal olarak büyür.

## Dosya bazında değişiklikler

| Dosya | Değişiklik |
|---|---|
| `frontend/src/components/RetailProductImage.jsx` | Kategori simgesi, lazy görünürlük, abort/object URL temizliği ve memo |
| `frontend/src/components/RetailProTools.jsx` | Global kategori filtresi, favori önceliği, sınırlı liste, memo hesaplamaları, fotoğraf sınırı ve görünür işlem/hata durumu |
| `frontend/src/components/PosQuantityControl.jsx` | Büyük artır/azalt ve sayısal miktar klavyesi |
| `frontend/src/lib/posPresentation.mjs` | Simge/ad/kasa/adet/sıralama/süre sunum yardımcıları |
| `frontend/src/lib/posPresentation.test.mjs` | 5 sunum/iş kuralı testi |
| `frontend/src/pages/RetailPos.jsx` | Görünen personel adı/kasa, dokunmatik adet, sepetten kaldırma onayı, kararlı seçim callback'i ve sınırlı gecikme tanılaması |
| `frontend/src/pages/PosTerminalUX2.css` | Kart içeriği/doğal yükseklik, sepet dengesi, büyük miktar kontrolleri ve personel başlığı |
| `backend/src/services/retailProService.js` | Tenant kategori listesi, literal prefix araması ve 300 KB PNG sınırı |
| `backend/src/routes/scannerRoutes.js` | Mevcut satış rollerine korumalı kategori listeleme ucu |
| `backend/tests/retailTerminalUX.test.js` | 5.000 ürünlü doğruluk ve gerçek süre ölçümü, kategori/tenant testleri |
| `tools/customer-experience/run.cjs` | Yeni testleri mevcut izole regresyona ekleme |
| `tools/customer-experience/preview.cjs` | Yalnız test ortamında görünen personel adı, uzun ad ve geniş sepet fikstürü |
| `docs/VENIUX_HARDWARE_TEST_REPORT.md` | Gerçek çalıştırılan donanım paketi sonucu |
| `docs/audits/VENIUX_POS_UX_REDESIGN.md` | UX 2.0 raporuna takip bağlantısı |
| `docs/audits/VENIUX_POS_TERMINAL_UX_2.md` | Bu sonuç, ölçüm ve sınırlama raporu |

Satış, stok, vergi, iade, cari defter, SmartCount ve lisans servisleri yeniden yazılmadı; şema değişikliği yok. Backend değişikliği katalog/görsel sunumuyla sınırlıdır. Kaynak kodu paketlenip canlıya gönderilmedi.

## Ayrı tutulan engeller ve kalan riskler

| Kontrol | Durum / sınır |
|---|---|
| Zayıf fiziksel POS CPU/RAM/GPU, termal kısılma | **NOT TESTED** — böyle bir cihaz ortamda yok; mevcut bilgisayar sonucu onun yerine geçirilmedi |
| Gerçek dokunmatik panel, Windows %125/%150 DPI ve ekran klavyesi | **Fiziksel doğrulama gerekli** — CSS piksel hedefleri ve normal tarayıcı viewport'ları test edildi |
| HID/Bluetooth/seri okuyucu, terazi, ESC/POS termal yazıcı, ÖKC | **Fiziksel doğrulama gerekli** — sanal test fiziksel uyumluluk sertifikası değildir |
| Android Emulator ve temiz Windows VM | **BLOCKED** — mevcut laboratuvar ortamında araç yok; Java derlemesi emülatör testi değildir |
| Gerçek işletme pilotu / çok kasalı yük / MySQL performansı | **NOT TESTED** — ölçüm SQLite ve tek yerel test istemcisiyle yapıldı |
| Fotoğraf formatı derin doğrulama | Mevcut PNG başlık/ölçü/uzunluk ve erişim denetimi vardır; tam sunucu codec decode/CRC güvence testi eklenmedi |
| Yetki/lock sınırları | Önceki rapordaki UI kilidi ve yönetici doğrulama sınırları değişmedi; yeni işlem bazlı mali yetki devri veya OS kiosk kilidi değildir |

Lint taramasında derleme hatası yoktur; mevcut hook bağımlılığı/ref temizliği ve kullanılmayan durum uyarıları vardır. Canlıya çıkmadan önce gerçek cihaz, paketli Electron/Android ve pilot işletme kabulü gerekir. Bu görevde ücretli servis açılmadı, gerçek müşteri verisi değiştirilmedi. Test sunucusu ve bu görevde üretilen geçici DB/anahtar kopyaları iş bitiminde temizlenir; rapor ve küçük kanıtlar korunur.

### 18 Ekim 2026 — Barkod araç çubuğu görsel düzeltmesi
- ScannerPanel.jsx: kompakt ekle/kamera düğmelerine ayrı sınıflar ve kamera açıklaması eklendi; işleme davranışı korunuyor.
- PosTerminalUX2.css: kamera ortalandı (46×46), düğme yükseklikleri ve köşeleri eşitlendi; ikincil düğmeler nötr yüzeylere alındı, barkod odağı belirginleştirildi. Küçük ekran kuralları korundu.
- Doğrulama: run-c75bbb63838aae3e, 43 test PASS / 0 FAIL; arayüz derlemesi başarılı. Bu küçük düzeltme için yeni tarayıcı ekran görüntüsü alınmadı; görsel doğrulama yapılmış sayılmıyor. Canlıya yayın yapılmadı.

### Production Readiness 3.0 — 18 Ekim 2026
Yeni denetim: `VENIUX_PRODUCTION_READINESS_3.md`; odak/kontrast takibi: `TERMINAL_UX_3_REPORT.md`. Yeni tam koşu run-d510c13891ac5689: 736 API / 47 ortak-dağıtım kontrolü testi PASS, 0 FAIL; build başarılı. Eski sayıların üzerine benzersiz toplam yapılmaz. Güvensiz kök ZIP, eski/imzasız Windows paketi, fiziksel/mali kabul ve hedef ortam engelleri ilgili raporlarda açık tutuldu. Üretim yayını yapılmadı.
