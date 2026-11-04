# Yerel kapanış takip çalışması — 8 Ekim 2026

Yeni ZIP, SHA256 veya dağıtım oluşturulmadı. Üretim verisine işlem uygulanmadı; mevcut kullanıcı sunucusu durdurulmadı. Yeni iş modülü eklenmedi. Kaynak kod aşağıdaki düzeltmeleri içerir; önceki dağıtım bu değişiklikleri içermez.

## Giderilenler

| Kayıt | Kaynakta doğrulanan eksik | Düzeltme ve kabul |
|---|---|---|
| B05 — yerel tarayıcı güvenliği bölümü | Üretim CSP yalnız object/base/frame-ancestors sınırlandırıyordu; script, olay niteliği, bağlantı ve form politikaları yoktu. | Aynı sunucudan JS, inline olay niteliği yasağı, self form/base, dar localhost okuyucu bağlantısı, mevcut font/görsel/ses/worker/sandbox önizleme izinleri eklendi. Script için unsafe-inline/unsafe-eval yok. React/grafik/fiş CSS’i için inline style gereksinimi korunur. Gerçek Chrome’da giriş/lazy sayfalar ve inline script/olay engeli geçti. B05’in HTTPS/dış altyapı ve kapsamlı XSS kabulü kapanmadı. |
| T05 — yedek indirme | BackupPanel HTTP 200 içeriğini tür/ad/başlık kontrolü olmadan indiriyordu; state güncellenmeden iki çağrı başlayabiliyordu. | Blob/tür/dosya adı/VNXBACKUP1+gzip başlığı kontrolü; senkron ref kilidi; anlaşılır hata ve tekrar deneme. Bozuk HTTP 200 dosya oluşturmadı, mevcut sağlam dosyayı değiştirmedi, düğme yeniden kullanılabilir kaldı. Anında iki tıklama bir POST yaptı. Tam arşiv/şema/hash kontrolü mevcut sunucu yolunda korunur; istemci kontrolü bunun yerine geçmez. |
| T05 — açık tarayıcı kabulü | Brüt kâr CSV/XLSX, stok CSV ve taşınabilir yedeğin gerçek kaydı araç sınırlaması nedeniyle açık kalmıştı. | Ayrı SQLite kopyasıyla gerçek Chrome dosyaları diske kaydetti ve dosyalar okundu. Brüt kâr tarih/ürün/kategori/kasiyer filtreleri, Türkçe, metin barkodu 0012345678905 ve ekrandaki bağımsız 600/360/240 TL toplamları eşleşti. HTTP 500’de dosya oluşmadı; yeniden deneme gerçekten kaydetti. Stok CSV 14 fiziksel birimle eşleşti. Anahtarsız yedek indirildi; mevcut sunucu doğrulayıcı arşiv/şema/hash kontrolünü geçirdi. Masaüstü Excel UI kabulü değildir. |
| Yerel çalışma ortamı | Önceki native dosya kilidi sonrasında source npm install --ignore-scripts SQLite native dosyasını yeniden üretmemişti. | Aynı sürüm/Node/Windows üzerinde temiz kurulumu ve testleri geçmiş better-sqlite3 ikilisiyle eksik dosya tamamlandı. :memory: sorgusu geçti. Kullanıcı DB’si açılmadı veya değiştirilmedi. |

Değişen uygulama dosyaları: backend/src/index.js, backend/src/middlewares/productionPrivacy.js, backend/tests/productionRuntime.test.js, frontend/src/pages/settings/BackupPanel.jsx, frontend/src/utils/backupDownload.js ve ilgili backupDownload.test.js. Kasa/stok tutar veya transaction hesapları değiştirilmedi.

## Yalnız ilgili doğrulamalar

- productionRuntime + productionPrivacy: 2 grup / 8 test geçti; ayrı test kopyası. Gerçek üretim sürecindeki CSP başlığı, giriş/sağlık/sır sınırı korunur.
- backupDownload: 2 test geçti; doğru dosya ve boş/JSON/yanlış tür-ad/kesilmiş yanıt reddi.
- Arayüz üretim derlemesi geçti; mevcut büyük JS parçası uyarısı sürer. Dağıtım paketi yapılmadı.
- audit/local-closure-browser.json: gerçek Chrome, ayrı SQLite yedeğinden geçici kopya, yerel API ve mevcut derlenmiş arayüz. İlgisiz font/avatar dış istekleri testte kapalıydı. Gerçek kurum/AI/ses/mesaj sağlayıcısına erişilmedi. Yapılandırılmamış ses isteğinin 503 sonucu beklenen sınırdır; ses çalışıyor kabulü değildir.
- Test aracı düzeltmeleri uygulama hatası sayılmadı: port/origin önceden seçilmesi, mevcut dashboard yönlendirmesi, görünür düğme seçicisi ve Chrome’un aynı isimli dosyayı yenilemesi. İlk başarısız yardımcı koşular başarılı kabul olarak sayılmadı.
- Geçici veritabanı, anahtar ve indirilen dosyalar test sonunda kaldırıldı. Ham log/fixture dağıtılmaz. Önceki tamamlanmış iş günü ve tam regresyon yeniden çalıştırılmadı; yalnız açık indirme kabulünün bağımsız beklentileri tekrar kullanıldı.

CSP kaynak karşılaştırması: [Mozilla CSP belgesi](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy). Kodun çalıştığı ve engellediği yollar yukarıdaki gerçek tarayıcı testleriyle değerlendirilir; tek başına başlık bulunması tam XSS koruması değildir.

## Bekleyen işler ve sahip adımları

| Kapsam | Neden kapanmadı / gerekli somut adım |
|---|---|
| B01 hesap ve anahtarlar | Sahibi eski/zayıf gerçek hesapları kapatmalı veya güçlü şifreyle değiştirmeli. NVIDIA, Gemini ve Fish paylaşılmış anahtarlarını sağlayıcıda iptal edip yenilerini yalnız özel sunucu yapılandırmasına girmeli; eski anahtar reddi/yeni gerçek yanıt ayrıca doğrulanmalı. Bu çalışmada iptal/yenileme yapılmadı. |
| B02 şirket/gizlilik | Doğrulanmış firma unvanı, iletişim/adres ve firmanın onayladığı veri işleme/gizlilik metni gerekli. Eksik metin veya kimlik uydurulmadı. |
| B03/B04/T12/T14 resmî kaynak ve kurum | Klinik belgeler/SUT/katalog kapsamı için gerçek güncel kaynak uzlaştırması; İTS/Medula/e-belge için yetkili test hesabı, kullanılacak entegratör ve resmî API dokümanı gerekli. Yerel taslak gerçek işlem sayılmaz. |
| B05 canlı dağıtım | Hedef HTTPS/proxy, erişim/sır yönetimi, dış yedek/izleme ve gerçek kurtarma ortamı gerekli. Yerel CSP düzeltmesi bunu kapatmaz. |
| T02/T03/T04/T06/T07 | Fiziksel okuyucu/yazıcı/banka cihazı; MySQL; ayrı Windows bilgisayarı; masaüstü Excel; canlı ses/mesaj teslimatı ayrı kabul gerektirir. Kaydedilen XLSX’i Excel’de onarım istemeden açıp kod/tarih/para alanlarını kontrol etmek T06 için somut kullanıcı adımıdır. |
| T01 | Tüm rol/ekran/düğme kombinasyonlarının geniş kabul matrisi tamamen bitmiş değildir. Bu çalışmada yalnız değişikliğin etkilediği giriş/rapor/aktarım/yedek yolları sınandı; tek yönetici browser koşusu kasiyer/depo personeli matrisi yerine geçmez. |
| T08–T11 ve S işleri | Önizlemedeki CRM otomasyon motoru, tema/strateji tercihleri, dinamik roller/2FA, seri operasyonları ve bakım/performans işleri tamamlandı sayılmadı. Bunlar mevcut çalışan akıştaki hata düzeltmesinden farklı, uygulanmamış davranış ve kapsamlı kabul çalışmasıdır. Yeni modül eklememe sınırı nedeniyle bu önizlemeler bu turda açılmadı; beta kapsamına alınıp alınmayacağı açık ürün kararı gerektirir. |

“Yerelde yapılabilecek hiçbir iş kalmadı” sonucu verilmez: T01 ve sonraki sürüm kabul/bakım işleri açıktır. Buna karşılık B01–B04 ve B05’in kalan canlı kabulünü sırf yeni kod yazarak kapatmak mümkün değildir. Genel yayın hazır onayı verilmedi.
