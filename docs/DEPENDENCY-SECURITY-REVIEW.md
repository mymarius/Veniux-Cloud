# Bağımlılık güvenliği incelemesi — 8 Ekim 2026

Genel yayına hazır değildir. Üretim verisine işlem uygulanmadı. Başlangıçtaki backend üretim taraması **1 kritik / 12 yüksek / 2 orta** paket uyarısıdır; meta-uyarılar aynı kök açığı birden çok üst pakete taşır, 15 bağımsız açık anlamına gelmez. Tam backend ve frontend geliştirme zincirleri de tarandı. Hiçbir bulgu bastırılmadı, audit fix --force kullanılmadı.

## Başlangıçtaki 15 üretim bulgusu

Zincirler eski kilit dosyasından çözülmüştür; sürümler eski → yeni gerçek kilit sürümleridir. Son sütundaki koşullu erişilebilirlik, uygulamada başarılı istismar iddiası değildir. Her advisory ve etkilenen sürüm aralığı audit/dependency-security-findings.json içinde bulunur.

| Paket / önem | Eski → yeni / çözüm | Eski bağımlılık zinciri | Etkilenen bileşen ve uygulama etkisi |
|---|---|---|---|
| @puppeteer/browsers / high | 2.13.0 → 3.2.3 | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → @puppeteer/browsers@2.13.0 | WhatsApp tarayıcı indirme/arşiv/proxy yardımcıları; alt paketlerden türemiş meta-uyarı. |
| basic-ftp / high | 5.3.1 → Zincirden kaldırıldı | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → @puppeteer/browsers@2.13.0 → proxy-agent@6.5.0 → pac-proxy-agent@7.2.0 → get-uri@6.0.5 → basic-ftp@5.3.1 | WhatsApp Puppeteer tarayıcı/proxy yardımcıları; FTP listesi CPU DoS. Uygulamada FTP ürün API’si yok; tarayıcı kurulum/proxy koşuluna bağlı yüzey. |
| brace-expansion / high | 2.1.2, 1.1.16 → 2.1.7, 1.1.21 | whatsapp-web.js@1.34.7 → archiver@7.0.1 → readdir-glob@1.1.3 → minimatch@5.1.9 → brace-expansion@2.1.2 | whatsapp-web.js → archiver → readdir-glob → minimatch; dosya glob/arsiv işlemleri. HTTP barkodu brace kalıbı olarak çalıştırılmaz; ayrıca Jest coverage zincirinde bulunuyordu. |
| extract-zip / high | 2.0.1 → Zincirden kaldırıldı | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → @puppeteer/browsers@2.13.0 → extract-zip@2.0.1 | Puppeteer tarayıcı arşivini açma; sembolik bağlantı üzerinden yol dışı yazma. Npm kurulum/browser download yüzeyi; kullanıcı ürün XLSX dosyası bu paketle açılmaz. |
| get-uri / high | 6.0.5 → Zincirden kaldırıldı | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → @puppeteer/browsers@2.13.0 → proxy-agent@6.5.0 → pac-proxy-agent@7.2.0 → get-uri@6.0.5 | PAC için URI getirme; basic-ftp zincirinden türemiş meta-uyarı. |
| ip-address / moderate | 10.7.0 → 10.7.3 | express-rate-limit@8.7.0 → ip-address@10.7.0 | express-rate-limit IP/subnet ayrıştırması; authRoutes.js limiti dış isteklere uygulanır. Eski proxy zinciri de aynı paketi getiriyordu. |
| nodemailer / high | 9.0.3 → 10.0.16 | nodemailer@9.0.3 | notificationService.js createTransport/sendMail; SMTP yapılandırıldığında gerçek e-posta yolu. Uygulama metin/html gönderir, doğrudan resolveContent erişimi/ek dosyası sunmaz; adres/DNS/DoS bulguları yine geçerlidir. |
| pac-proxy-agent / high | 7.2.0 → Zincirden kaldırıldı | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → @puppeteer/browsers@2.13.0 → proxy-agent@6.5.0 → pac-proxy-agent@7.2.0 | Proxy PAC çözümleme; basic-ftp zincirinden türemiş meta-uyarı. |
| proxy-addr / critical | 2.0.7 → 2.0.8 | express@5.2.1 → proxy-addr@2.0.7 | Express IP/trust-subnet hesabı; üretimde auth hız sınırlaması. src/index.js trust proxy açmaz; koşullu proxy spoofing mevcut dağıtımda gösterilmedi. Gerçek IP güven sınırı için paket yine düzeltildi. |
| proxy-agent / high | 6.5.0 → Zincirden kaldırıldı | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → @puppeteer/browsers@2.13.0 → proxy-agent@6.5.0 | Tarayıcı proxy bağlantısı; basic-ftp zincirinden türemiş meta-uyarı; uygulamada doğrudan genel proxy API’si yok. |
| puppeteer / high | 24.38.0 → 25.12.0 | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 | WhatsApp SDK başlatma/bağlanma ve tarayıcı kurulumu; alt paketlerden türemiş meta-uyarı. |
| puppeteer-core / high | 24.38.0 → 25.12.0 | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → puppeteer-core@24.38.0 | WhatsApp sayfa/brauzer kontrolü; alt paketlerden türemiş meta-uyarı. |
| qs / moderate | 6.15.3 → 6.16.0 | express@5.2.1 → qs@6.15.3 | Express/body-parser extended urlencoded ve query çözümleyicisi; src/index.js extended:true. Dış HTTP girdi yüzeyi gerçekten mevcut; array sınırı ve DoS düzeltildi. |
| whatsapp-web.js / high | 1.34.7 → 1.34.7 | whatsapp-web.js@1.34.7 | ownerWhatsAppService.js yalnız bağlanma istendiğinde Client/LocalAuth/headless başlatır. SDK meta-uyarısı; kendi kodunda ayrı advisory değil, aşağıdaki Puppeteer zincirinden türemiştir. |
| xlsx / high | 0.18.5 → 0.20.3 | xlsx@0.18.5 | productImportWorker.js yüklenen XLS/XLSX; TitckListProvider/titckPriceList resmî liste ayrıştırma; scannerRoutes.js ve kâr/ürün dışa aktarımı. Yetkili kullanıcı dosyası sunucuya ulaşır; worker/limitler azaltım, güvenlik yaması yerine geçmez. |

## Geliştirme zincirinde ayrıca bulunanlar

Bu paketler canlı API’ye kurulmaz (npm ci --omit=dev); derleme ve test güvenliği yine önemlidir. Aynı paket üretim ve dev zincirinde bulunduğunda yukarıdaki sürüm listesi bütün kopyaları kapsar.

| Paket / önem | Eski → yeni | Eski zincir | Etki |
|---|---|---|---|
| argparse / moderate | 1.0.10, 2.0.1 → 2.0.1 | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → cosmiconfig@9.0.2 → js-yaml@4.3.2 → argparse@2.0.1 | NYC js-yaml CLI yardımcıları; sprintf-js kaynaklı meta-uyarı; geliştirme/test. |
| baseline-browser-mapping / moderate | 2.10.43 → 2.11.27 | jest@30.4.2 → @jest/core@30.4.2 → @jest/transform@30.4.1 → @babel/core@7.29.7 → @babel/helper-compilation-targets@7.29.7 → browserslist@4.28.6 → baseline-browser-mapping@2.10.43 | Babel/Jest tarayıcı hedef verisi; geçersiz yapılandırmada process termination; build/test. |
| browserslist / high | 4.28.6 → 4.29.3 | jest@30.4.2 → @jest/core@30.4.2 → @jest/transform@30.4.1 → @babel/core@7.29.7 → @babel/helper-compilation-targets@7.29.7 → browserslist@4.28.6 | Babel/Jest hedef tarayıcı listesi; build/test sırasında kötü yapılandırma/stats dosyasıyla DoS/prototype yazımı. Canlı kasa API’si değil. |
| js-yaml / high | 4.3.2, 3.15.0 → 4.3.2 | whatsapp-web.js@1.34.7 → puppeteer@24.38.0 → cosmiconfig@9.0.2 → js-yaml@4.3.2 | Jest coverage → @istanbuljs/load-nyc-config YAML yapılandırması; üretim HTTP parser’ı değil. |
| minimist / critical | 0.0.10, 1.2.8 → 1.2.8 | better-sqlite3@12.11.1 → prebuild-install@7.1.3 → minimist@1.2.8 | Kullanılmayan pg-migrate → optimist CLI prototype pollution; geliştirme aracı. |
| optimist / critical | 0.6.1 → Zincirden kaldırıldı | pg-migrate@2.0.1 → optimist@0.6.1 | Kullanılmayan pg-migrate CLI → minimist; geliştirme aracı meta-uyarı. |
| pg / high | 8.22.0, 7.18.2 → 8.22.0 | pg@8.22.0 | pg-migrate içindeki eski pg/semver zinciri. Üretim doğrudan pg@8.22.0 korunmuştur; eski iç kopya kaldırıldı. |
| pg-migrate / critical | 2.0.1 → Zincirden kaldırıldı | pg-migrate@2.0.1 | Kullanılmayan dev aracı; src/scripts/tests içinde çağrı yok. SQLite migrator SQL/JS kataloğunu kullanır; bu araç gerçek migration yoluna bağlı değil. |
| semver / high | 6.3.1, 4.3.2, 7.8.5 → 6.3.1, 7.8.5 | jsonwebtoken@9.0.3 → semver@7.8.5 | Eski pg-migrate içindeki pg sürüm kıyaslayıcı ReDoS; geliştirme zinciri kaldırıldı. |
| sprintf-js / moderate | 1.0.3 → Zincirden kaldırıldı | jest@30.4.2 → @jest/core@30.4.2 → @jest/transform@30.4.1 → babel-plugin-istanbul@7.0.1 → @istanbuljs/load-nyc-config@1.1.0 → js-yaml@3.15.0 → argparse@1.0.10 → sprintf-js@1.0.3 | Eski js-yaml/argparse biçimleme precision DoS; geliştirme/test, üretim paketinden zaten çıkarılıyordu. |

## Frontend ek taraması

İlk frontend taraması 8 paket uyarısı verdi. Önceki frontend kilidinin tamamı değişiklik öncesinde saklanmadığından, tam eski sürümü kanıtlanamayan satırlarda advisory aralığı yazılır; sürüm uydurulmaz. Axios 1.18.1 ve router 7.18.1 eski doğrudan sürümleri incelemede gözlendi.

| Paket / önem | Eski sürüm veya etkilenen aralık → yeni | Zincir / bileşen / etki |
|---|---|---|
| axios / high | 1.18.1 → 1.20.0 | Doğrudan → API HTTP istemcisi; tarayıcı istek yolu gerçekten mevcut. Node adaptörü advisory koşulları tarayıcıda aynen varsayılmaz. |
| baseline-browser-mapping / moderate | >=2.0.0 <2.11.0 (tam eski sürüm saklanmadı) → 2.11.27 | browserslist → baseline-browser-mapping; build hedefi çözümü. |
| browserslist / high | <=4.28.6 (tam eski sürüm saklanmadı) → 4.29.3 | autoprefixer/Babel → browserslist; yapılandırma/stats kullanan build aracı. |
| nanoid / high | <3.3.18 (tam eski sürüm saklanmadı) → 3.3.20 | Vite/PostCSS → nanoid; CSS/build ID üretimi, dağıtılan API satış anahtarı yerine kullanılmıyor. |
| postcss / moderate | <=8.5.22 (tam eski sürüm saklanmadı) → 8.5.29 | Vite/@tailwindcss/postcss → postcss; CSS derleme/parser, tarayıcıda PostCSS çalışmaz. Üretim bayrağı taşıyan transitif kopya da build aracıdır. |
| react-router / high | 7.18.1 → 7.18.4 | react-router-dom → react-router; derlenmiş tarayıcı yönlendirmesi. |
| react-router-dom / high | 7.18.1 → 7.18.4 | Doğrudan → react-router; müşteri sayfa yönlendirmesi. Tarayıcı router kullanılıyor; server loader/redirect istismarı ayrıca gösterilmedi. |
| source-map-js / high | 1.0.0 - 1.2.1 (tam eski sürüm saklanmadı) → 1.2.2 | PostCSS → source-map-js; build source-map çözümü, satışı işleyen servis değil. |

## Kontrollü değişiklikler ve uyumluluk

- proxy-addr 2.0.8, qs 6.16.0, ip-address 10.7.3 ve brace-expansion 2.1.7 / 1.1.21 normal aralık içi kilit güncellemeleridir. Frontend Axios 1.20.0, router 7.18.4, PostCSS 8.5.29, nanoid 3.3.20 ve source-map-js 1.2.2; build browser hedefleri browserslist 4.29.3 / baseline 2.11.27.
- Nodemailer bilinçli major güncelleme: 10.0.16, Node 24 gereksinimi karşılar; createTransport/sendMail MIME testi ve mevcut servis regresyonu uygulanır. Canlı SMTP teslimatı yapılmış sayılmaz.
- SheetJS npm kaydı eski 0.18.5’te kalmıştır; prototype için 0.19.3, ReDoS için 0.20.2 gerekir. [Resmî kurulum belgesindeki](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) 0.20.3 CDN tarball’ı kullanılır, lock integrity sabittir. Standart read/write/cellFormula API’leri ve ürün aktarımı/çıktı testleri korunur. CDN erişimi ilk kurulum bağımlılığıdır.
- whatsapp-web.js 1.34.7 son üst paket; normal üst paket güncellemesi bu zinciri kaldırmıyordu. Yalnız bu üst pakette puppeteer=25.12.0 override kullanılır: core=25.12.0/browsers=3.2.3. extract-zip için düzeltilmiş yayımlanmış sürüm yok; bu paket ve proxy-agent/pac-proxy-agent/get-uri/basic-ftp zinciri yeni üst sürümden tamamen çıkarıldı. Basic-ftp kök advisory’sinin güvenli aralığı >=6.2.1; bu projeye ayrıca kurulmadı. Npm’in önerdiği eski whatsapp-web.js 1.34.2’ye geriye dönüş yapılmadı. [Puppeteer 25.12.0](https://github.com/puppeteer/puppeteer/releases/tag/puppeteer-v25.12.0) ve [browser changelog](https://github.com/puppeteer/puppeteer/blob/main/packages/browsers/CHANGELOG.md) kaynakları incelendi.
- WhatsApp LocalAuth/Client oluşturma, Node 24 CommonJS/ESM köprüsü, gerçek ayrı Chrome headless açma, page.setUserAgent/setBypassCSP/evaluateOnNewDocument/exposeFunction/goto/evaluate, websocket connect/disconnect/close doğrulandı. WhatsApp Web sayfasına giriş, QR eşleştirme ve gerçek mesaj teslimatı henüz doğrulanmadı; override bunları kendiliğinden kanıtlamaz.
- Jest NYC üst paketinin son sürümü eski js-yaml 3 zincirini getiriyordu. Yalnız @istanbuljs/load-nyc-config altında js-yaml=4.3.2 override; üst paket zaten load kullanır. Gerçek YAML + extends/include/exclude çözümü ve Jest tam koşusu test edilir. argparse 2.0.1; yamalanmamış sprintf-js artık yok.
- Kullanılmayan pg-migrate dev aracı kaldırıldı; eski optimist/minimist/pg/semver zinciri çıkar. Mevcut SQLite migrator ve doğrudan pg 8.22.0 değişmedi.

## Doğrulama ve bekleyenler

Temiz kurulum: ayrı test kopyasında backend/frontend/scanner-bridge npm ci; backend yalnız opsiyonel tarayıcı indirmesini atlamak için PUPPETEER_SKIP_DOWNLOAD=true kullanır. Bu ayar audit bulgusunu bastırmaz. Frontend üretim derlemesi geçti; büyük JS parçası uyarısı sürüyor.

Çalışan kullanıcı uygulaması native dosyaları tuttuğu için source npm ci EPERM ile durdu. Açık sunucu kapatılmadı; source npm install --ignore-scripts bağımlılıkları tamamladı. Temiz npm ci kabulü ayrı kopyada yapılır. İlk ayrı kopya .local içinde olduğundan Express dotfile koruması şablon/çıktı erişimini 404 yaptı ve boş storage test hazırlığı eksikti. Kopya görünür artifacts/dependency-validation-20261008 altına taşınıp boş test storage oluşturuldu; bu araç/fixture koşulları uygulama güvenliğini gevşeterek çözülmedi. İlk başarısız sonuç audit/dependency-security-regression.json’da korunur.

Ek uyumluluk ilk denemesinde Excel’in saat dilimi olmayan hücresine UTC anı varsayan test 3 saat fark buldu; gerçek tarih-alanı sözleşmesi ISO tarih metniyle doğrulanır, Excel’in zaman dilimi sakladığı iddia edilmez. Edge bu ortamda headless açılışta code 0 ile kapandı; Chrome ile test geçti. Canlı WhatsApp/Edge kabulü bekler.

Son taramalar: audit/dependency-security-{backend,frontend,scanner-bridge}-{final,production-final}.json. Altı tarama da 0 kritik / 0 yüksek / 0 orta / 0 düşük / 0 toplam. Bu, tarama anındaki bilinen advisory sonucudur; gelecekte açık bulunmayacağı garantisi değildir.

Son regresyon, ZIP kurulum/güncelleme, içerik ve SHA kabul sonuçları PROJECT-CLOSURE-REPORT.md ve WINDOWS-SECURITY-RELEASE-VERIFICATION.md içinde tutulur. Fiziksel okuyucu/yazıcı, başka bilgisayar, MySQL, canlı SMTP/WhatsApp ve tarayıcıdan rapor kaydı bekler. NVIDIA/Gemini/Fish paylaşılmış anahtarları haricen iptal edilmiş/yenilenmiş sayılmadı.

## Son kabul

66 grup / 509 test geçti; ayrıca bağımlılık uyumluluğu 4/4, shared 7/7, yerel köprü 1/1. Ayrı ZIP gerçek Install-Windows/Update-Windows, giriş/sağlık ve tutarlı güvenlik yedeği kabulü geçti. Regresyonda taze geliştirme lisans PEM başlığı hatası düzeltilip iki-process testi eklendi; üretim anahtarlarına dokunulmadı. Paket: veniux-1.0.0-security-dependencies-20261008-4d86b234ea564849936e2c932ad02802.zip. Son SHA256 eşlik dosyasında, genel yayın engelleri kapanış raporunda.
