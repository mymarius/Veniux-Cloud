# Veniux barkod okuyucu entegrasyonu

4 Ekim 2026. Gerçek HID/seri adaptör kodu, güvenli localhost bağlantı uygulaması ve sunucuda doğrulanan market kasası eklendi. Fiziksel cihazla barkod okutma yapılmadı. Yerel bilgisayarda port listeleme 200 döndü; bir port görüldü, açılmadı.

## Kullanım ve kurulum

1. Market Kasası: `/magaza/kasa`. Yan menüde Stok ve Depo altında bulunur. Depoyu seçin, özel barkod alanına odaklanın, okutun. Manuel `İşle` her zaman kullanılabilir. Satış sırasında fiyat, birim dönüşümü, tartı şeması, depo sahipliği ve yeterli stok sunucuda yeniden doğrulanır. Kart seçimi banka tahsilatı yapmaz. Fiş resmî e-fatura değildir.
2. Ayarlar: `/settings?tab=scanner`. İşletme bazında API/veritabanına kaydedilir; prefix/suffix, Enter/Tab/LF veya tek karakter sonlandırıcı, zamanlama, baud rate, parity, data bits ve stop bits buradan ayarlanır. HID cihazını işletim sisteminde klavye moduna alın; Bluetooth HID önce işletim sisteminde eşleştirilir. Hız bilgisi sadece gösterge, cihaz kimliği kanıtı değildir. Diğer metin alanlarında tuş yakalanmaz.
3. Web Serial: destek varsa `serial` seçin; `Port seç ve bağlan` düğmesi izin ve port seçimi açar. HTTPS veya güvenilir localhost gerekir. USB sanal COM ve işletim sisteminin seri port olarak sunduğu Bluetooth SPP kullanılabilir. BLE GATT ve özel USB protokolleri seri port değildir.
4. Yerel bağlantı: okuyucunun bulunduğu bilgisayarda Node.js 24 kullanın. `scanner-bridge` klasöründe `npm ci`, ardından `npm start`. Uygulama 127.0.0.1:17841'e bağlanır. Bu bilgisayarda kuruldu ve gizli arka plan süreci başlatıldı; yeniden başlatma için aynı komut gerekir. Windows'ta gizli çalıştırmak için aşağıdaki yardımcı betik kullanılabilir.
5. `bridge` seçin; uygulamanın ilk açılışta ürettiği `scanner-bridge/pairing.json` dosyasındaki token değerini parola alanına girin. Token sunucuya veya kalıcı tarayıcı depolamasına yazılmaz. Portları listeleyin, doğru portu seçin, bağlayın. Token dosyasını paylaşmayın; değiştirirseniz yerel uygulamayı yeniden başlatın. Host ve Origin kontrolü, Bearer doğrulaması, sabit loopback adresi ve akış boyutu sınırı vardır. `null` origin kabul edilmez.
6. Canlı HTTPS site adresini pairing.json içindeki `origins` listesine TAM origin olarak ekleyin; joker karakter kullanmayın. Tarayıcının localhost/yerel ağ erişim izni veya HTTPS sayfadan HTTP loopback erişim kısıtı olabilir. Güvenlik uyarısını geçmeyin. Bu bağlantı tarayıcı tarafından engellenirse desteklenen Web Serial ortamını veya onaylı HTTPS yerel proxy dağıtımını kullanın; HTTPS yerel proxy bu teslimatta kurulmadı. Electron sürümünde HID normal klavye alanıdır; paketli Electron'da Web Serial izin işleyicisi bu teslimatta eklenmedi, yerel uygulama adaptörü gerekir.
7. Bağlantı kesilmesinde yeniden bağlama açık kullanıcı işlemiyle yapılır; eksik seri veri hata verir, satışa dönüştürülmez. Aynı anda bir localhost okuma akışı kullanılabilir. Geçmiş taramalar otomatik olarak satışa yeniden oynatılmaz.

## Bağlantı / platform desteği

| Tür | Windows / macOS / Linux tarayıcı | Android / iOS | Sınır |
|---|---|---|---|
| USB HID | OS klavye olarak tanıyorsa özel alanda çalışır | OS, OTG ve tarayıcı klavye desteğine bağlı | Cihaz kimliği ve bağlılık klavye olayından kanıtlanamaz |
| Bluetooth HID | OS eşleştirmesi sonrası klavye girişi | OS klavye desteğine bağlı | BLE GATT ile aynı değildir; klavye düzeni eşleşmeli |
| COM / USB CDC Web Serial | `navigator.serial`, güvenli bağlam ve port izni varsa | Özellik ve OS desteğine bağlı, koşulsuz destek yok | İşletim sistemi sürücüsü ve portun boş olması gerekir |
| Bluetooth SPP | OS seri port sunduğunda Web Serial veya yerel uygulama | Koşulsuz destek yok | SPP profilinin cihazda/OS'ta bulunması gerekir |
| Yerel HTTP bağlantı uygulaması | Node serialport sürücüsü çalışırsa Windows/macOS/Linux | Masaüstü uygulaması bu mobil cihazlar için sağlanmadı | Tarayıcı yerel ağ erişimi ve izinli origin gerekir |
| Kamera | BarcodeDetector, getSupportedFormats ve kamera izni varsa | Platform destekliyorsa | Kamera görüntüsü sunucuya gönderilmez; bu teslimatta kütüphane fallback'i yok |
| Üretici SDK / özel protokol | Adaptör yükleme sözleşmesi hazır | Üretici SDK ve OS'ye bağlı | Belirli bir marka SDK'sı kurulmadı veya test edilmedi |

Tarayıcı sürüm adından uyumluluk varsayılmıyor; çalışma anında özellik kontrolü yapılıyor. Resmî kaynaklar: [Web Serial](https://developer.chrome.com/docs/capabilities/serial), [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector).

## Formatlar, GS1 ve tartı

HID/seri yolunda okuyucu barkodu çözer; sistem gelen metni taşır. EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39 ve ITF okuyucu destekliyorsa alınır. Sayısal olmayan barkodlar ve baştaki sıfırlar korunur. Kamera sadece tarayıcının desteklediği ean_13, ean_8, upc_a, upc_e, code_128, code_39, itf, data_matrix ve qr_code formatlarını kullanır; tüm formatlar her platformda varmış gibi davranmaz. EAN checksum'u bu sistemde otomatik format tahminiyle zorlanmaz.

ASCII GS (29) temizlenmez. AIM `]C1` / `]d2`, `(01)` ve GS içeren GS1 girdilerinde GTIN ürün araması yapılır. GTIN-14'ün başındaki paket sıfırı için EAN-13 eşdeğeri ayrıca sorgulanır; ham veri korunur. Genel GS1 AI sözlüğünün tamamı veya medikal son kullanma/lot/seri doğrulaması bu yeni kasa katmanında uygulanmaz; rastgele seri/lot/son kullanma üretilmez. HID kontrol karakterlerini metin alanına iletmeyen cihazlarda üreticinin GS/FNC1 veya AIM çıkış ayarı kullanılmalıdır.

Tartı kapalı gelir. Ayarlardaki JSON alanına kendi etiket şemanızı girin. Örnek aşağıdaki bir standardın varsayılanı DEĞİLDİR:

```json
[{"prefix":"22","length":13,"productStart":2,"productLength":5,"valueStart":7,"valueLength":5,"divisor":1000,"kind":"weight"}]
```

Konumlar sıfırdan başlar. `2200123012508` → ürün `00123`, 1.25 kg. `kind:price` değer alanını tutar olarak yorumlar, sunucudaki birim fiyat üzerinden miktar hesaplar. Ağırlıklı ürünün birimi kg/litre olmalıdır. Miktarlar altı ondalık basamakla saklanır, tutar kuruş üzerinden hesaplanır. Şema kontrol rakamını yorumlamaz; kendi cihaz şemasını doğru tanımlayın. Hızlı ürün/stok kabulü mevcut tam birim kuralını korur; tartılı kasa satışı `/magaza/kasa` ekranındadır.

## Adaptör ve üretici SDK sözleşmesi

Yerel uygulama `SCANNER_ADAPTER_FILE` ortam değişkenindeki güvenilir, yerel CommonJS modülünü yükleyebilir. Modül `{adapterAdi: AdapterClass}` dışa aktarır. Sınıf `static async list()` ile `{path}` cihaz listesi verir; kurucu `{path,baudRate,parity,dataBits,stopBits,autoOpen:false}` alır; `open(callback)` / `close(callback)` ve EventEmitter `data(Buffer)` / `error` / `close` uygular. SDK'nın okumaları bu sözleşmeye çevrilir. Web paneli adaptörleri listeleyip seçebilir; web isteğinden dosya/modül yüklenmez. Adaptör karakter kodlamasını standart UTF-8 akışına çevirmelidir.

Örneğin Zebra SNAPI/IBM HID için [CoreScanner SDK](https://techdocs.zebra.com/dcs/scanners/sdk-windows/) veya OPOS/JPOS adaptörü gerekir. HIDKB veya standart COM modunda SDK gerekmez. Markaya özel SDK cihaz modeli ve lisanslı üretici dağıtımı görülmeden taklit edilmedi.

## API ve değişen dosyalar

- `GET/PUT /api/scanner/settings`: işletme bazlı ayarlar, yazma sadece admin/manager.
- `POST /api/scanner/lookup`: ürün, fiyat, stok, UOM varyant/dönüşüm, tartı miktarı. Çoklu eşleşmede 409.
- `POST /api/scanner/sale`: admin/manager, Idempotency-Key zorunlu; aynı istek ikinci satış/stok düşümü oluşturmaz; değiştirilmiş sepetle aynı anahtar 409. İşlem, stok hareketi ve denetim kaydı atomiktir.
- `shared/scanner.mjs` / `scanner.test.mjs`: temizleme, çerçeveleme, sıra, olay kimliği ve tartı şemaları. Barkod metnine göre zaman pencereli tekilleştirme yapılmaz; gerçek tekrar korunur.
- `frontend/src/scanner/useScanner.js`, `components/ScannerPanel.jsx`, `pages/RetailPos.jsx`: okuyucu katmanı, ayarlar ve kasa.
- `frontend/src/pages/RetailQuickAdd.jsx`, `pages/normal-depo/VirtualTerminal.jsx`, `pages/Settings.jsx`, `components/Layout.jsx`, `App.jsx`, `components/BarcodeCamera.jsx`: mevcut ekranlara bağlantılar, menü ve kamera ITF/DataMatrix desteği.
- `backend/src/services/scannerService.js`, `routes/scannerRoutes.js`, `index.js`, `database/migrations/020_scanner_settings.sql`, `config/mysqlSchema.js`, `config/mysqlAdapter.js`: ürün/satış işlemleri, işletme ayrımı, ayar şeması ve MySQL kesirli miktar dönüşümü.
- `backend/tests/scanner.test.js`, `tests/pentestRegression.test.js`, `package.json`: kasa testleri, daha önce zorunlu olan KDV alanına test verisi uyumu, ESM test ayarı.
- `scanner-bridge/server.cjs`, `package.json`, `package-lock.json`, `tests/bridge.test.cjs`, `Start-ScannerBridge.ps1`, `.gitignore`: bağımsız yerel uygulama ve güvenlik testleri. pairing.json gizlidir; dağıtım/Git'e dahil edilmez.

## Doğrulama

`node --test --test-isolation=none shared/scanner.test.mjs scanner-bridge/tests/bridge.test.cjs`: 6 test geçti. Bölünmüş ve art arda veriler, gerçek tekrar, olay kimliği tekrarı, eksik/taşan veri, origin ve kimlik doğrulama reddi, sahte port adaptörüyle aç/kapa doğrulandı. Bu fiziksel cihaz testi değildir.

Backend kasa/stok kabulü: 13 test geçti. Sunucu fiyatı, stok düşümü, idempotency, negatif miktar reddi, işletme ayrımı ve 1.25 kg tartı örneği doğrulandı. Tarayıcıda `000SIM-NOT-FOUND` + Tab denendi; ham/işlenmiş veride sıfırlar korundu ve eşleştirme bağlantıları gösterildi. Gerçek satış kayıtları sadece ayrı test veritabanında oluşturuldu.

Genel regresyonun son çalıştırmasında 47 test paketi, 317 testin tamamı geçti. Eski fatura test verisindeki eksik KDV alanı düzeltildi. Kasa ve pentest hedefli çalıştırmasında ayrıca 56 test geçti. Son test çıktıları audit/scanner-regression-results.json ve audit/scanner-final-tests.json içindedir. MySQL DDL/işlem kodu eklendi, ancak canlı MySQL sunucusu ve Electron paketli uygulama bu ortamda test edilmedi.

Cihaz kabul testleri: gerçek modelle HID klavye düzeni/Enter/Tab, seri parametreleri, hızlı tekrar, USB çıkar/tak, Bluetooth uyku/yeniden eşleşme, GS/FNC1 aktarımı, kamera izinleri ve tartı etiketi kontrolü gerekir. Bunlar yapıldığı iddia edilmez.
