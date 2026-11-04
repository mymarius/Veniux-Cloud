# Veniux — Signature Design System 3.0

19 Ekim 2026. Yerel tasarım uygulaması ve bu tur çalıştırılmış kabul sonuçları. Canlı yayın, üretim DB/lisans/anahtar değişikliği, gerçek ödeme veya müşteri verisi kullanımı yapılmadı.

## 1. Ön denetim ve konsept

UI/UX2 raporu, ana sayfa, ortak stil/varlık derleyicisi, Retail/Warehouse detay ve paket sayfaları, demo formu, hesap sayfaları ve eski rehber/akış bileşenleri incelendi.

Önceki sürümdeki sorunlar: yan yana başlık/ekran düzeninin tekrar etmesi; farklı yıllardan kalan çok sayıda CSS override'ı; uzun ve birbirini tekrar eden öğretici bölümler; ürün ailelerinin yeterince farklı karakter taşımaması; bağımsız görsel çerçevelerinde tekrar eden markup. Form, SEO ve lisans işleyişi tasarım değişikliğinin kapsamı dışında tutuldu.

[Linear](https://linear.app/), [Stripe](https://stripe.com/) ve [Vercel](https://vercel.com/) resmî sayfaları araştırma referansları olarak okundu. Bunlardan çıkarılan ilke ürün ve iş akışını somut gösterme, kısa değer önerisi ve belirgin bilgi/CTA hiyerarşisidir. Bu bir çıkarımdır; sayfalarının CSS'i, düzeni, logoları veya görselleri kopyalanmadı. Rakiplerle ölçülmüş kalite eşitliği iddia edilmiyor.

Veniux yönü **Precision in Motion**: açık nötr alanlar, gece mavisi operasyon sahnesi, Retail için elektrik mavisi, Warehouse için kontrollü turuncu. Özgünlük; aynı stok zincirinde birleşen iki gerçek ürün ekranı, numaralı akış notasyonu ve açık/koyu ürün bölümleri üzerinden kuruldu.

## 2. Merkezi sistem ve ortak bileşenler

- `website-php/design-tokens.json`: açık/koyu semantik renkler, font ve metin ölçeği, boşluklar, container/grid, radius, gölge, border, süre/easing ve600/900/1200 kırılımları.
- `bin/build-assets.cjs`: aynı kaynaktan root/dark CSS değişkenlerini üretir; responsive placeholder'larını CSS parse edilmeden çözer. Ayrı sayfalar farklı breakpoint değerleri tanımlamaz.
- `assets/premium.css`: eski UI/UX2 sunum dosyası **yerine** yazılan kanonik Signature katmanı. Yeni bir override dosyası daha eklenmedi. Önceki `site.css`, form/yasal/indirici stilleri ve legacy marka tabanı güvenli geçiş için korunuyor; bütün geçmiş CSS'nin kaldırıldığı iddia edilmez.
- `design-components.php`: `signatureScreen`, `signatureFlow`, `signatureLocationMap`, `signatureExplorer`, `signatureProductNav` tekrar kullanılan sunum bileşenleridir. Ekran varlıkları allowlist'ten gelir; caption/aria/akış metinleri escape edilir. Rastgele dosya yolu kabul edilmez.
- Auth sayfaları da `premium-site premium-account` scope'u ile aynı tokenları kullanır. Kayıt/giriş/parola/doğrulama/indirme kuralları değiştirilmedi.

Tokenlar yalnız sunum içindir. Fiyat, paket hakkı, lisans süresi veya müşteri sınırı token değildir; onların katalog ve sunucu kaynakları korunuyor.

## 3. Uygulanan ürün deneyimi

**Ana sayfa:** başlık “İşletmenizin her hareketi. Tek bir akışta.”; kısa açıklama ve ilk alanda iki ürün ailesinin adı. Eski iki sütun kompozisyonu yerine merkezî tipografi, belirgin demo/keşif CTA'ları ve aynı operasyon alanında katmanlanan gerçek POS/WMS ekranları var. Grid ve sınırlı ışık etkisi yalnız bu sahnede; her bölüm glass/glow ile kaplanmadı. Perspektif statiktir; sürekli parallax/animasyon döngüsü yok. Küçük ekranda üst üste binme kaldırılıp iki ekran okunabilir sıralı düzene alınır.

İlk denemede sahnenin sabit yüksekliği ana ekranın alt kenarını kesebiliyordu. Alan boyutları düzeltildi; gerçek DOM ölçüleriyle iki görselin üst/alt sınırlarının sahne içinde kaldığı test edildi. Katmanların birbirini kısmen örtmesi bilinçli kompozisyondur; tam ekran bağlantıları ayrıca sunulur.

**Retail:** mavi ağırlıklı gerçek POS, barkod→sepet→satış kayıt hikâyesi. SmartCount ve stok görünümü, kasiyer/rol ve vardiya anlatımı mevcut kabul sınırlarıyla sunulur; offline sayım/gerçek terazi başarısı vaat edilmez.

**Warehouse:** gece mavisi bölüm, turuncu vurgu, gerçek mal kabul ekranı ve mal kabul→raf→transfer akışı. A-01/A-02/B-01/B-02 yerleşim açıklaması **“Temsili yerleşim · Canlı depo verisi değildir”** olarak işaretlenmiş statik şemadır; çalışan canlı depo haritası veya etkileşimli işlem taklidi değildir. Gerçek ekranlar ve şema birbirinden açıkça ayrılır. Stok/sayım, lot/SKT ve mobil cihaz kabul sınırları korunur. Sayım onayı gerçek mevcut kaynakta vardır: `backend/src/controllers/wmsCycleCountController.js:3`, ilgili WMS adjust rotası yetkili rollerle sınırlıdır; bu tur onay/satış işlemi yapılmadı.

**Ekran seçimi:** Satış/Depo/Stok & sayım sekmeleri gerçek görselleri gösterir. Aynı bileşen ürün detaylarında ilgili ekranlara filtrelenir. Satış, banka tahsilatı veya stok hareketi çalıştırmaz. JavaScript kapalıyken bütün ekran bölümleri okunabilir; sekme davranışı progressive enhancement ile eklenir. Klavyede ok/Home/End, doğru selected/tabindex/tabpanel ilişkileri vardır.

**Navigasyon ve uzun içerik:** ürün detaylarında sticky ürün navigasyonu; mevcut kanonik ürün/paket/demo yollarına gider. Uzun günlük örnekler native details içinde korunur. Eski `#detayli-anlatim` bağlantısı ancestor details'ı açarak hedefe ulaşır. Eski örnek akış sekmeleri ve çalışma alanı seçicisi kaldırılmadı. Eski JS sekme sorgusu `.flow-tabs` kapsamına daraltıldı; yeni sekmelerin eski kontrolcüye karışması engellendi.

## 4. Fiyat ve dönüşüm

Retail ve Warehouse ayrı kalır. Üç plan tek karşılaştırma yüzeyinde, Pro gece mavisi öneri sütununda; kullanıcı/depo/kasa/cihaz sınırları görünürdür. “Önerilen kapsam” editoryal vurgu olup satış/popülerlik istatistiği değildir. Her planda mevcut teklif ve demo bağlantıları var; mobilde planlar sıralanır, yalnız karşılaştırma bölgesi yatay kaydırılır. Unified tek birleşik çözüm olarak korunur.

`COMMERCIAL_PRICING_DRAFT.json`, public katalog ve backend paket matrisi değiştirilmedi. Onaysız rakamlar genel sayfalara yüklenmez. Ödeme/satın alma etkinleştirilmedi. Eski dönem/fiyat ve lisans hakları aynıdır.

Demo/teklif formunun sunumu ortak tokenlarla iyileştirildi; CSRF, honeypot, rate limit, KVKK, kayıt kuyruğu, doğrulama, tek kullanımlık dönüşüm makbuzu ve rıza altyapısı korunuyor.390px tarayıcı testinde aile değişimi uyumsuz planı temizledi ve çözümü depo yaptı. Form sentetik ad/e-posta/ihtiyaçla gerçekten gönderildi; başarı mesajı gösterildi ve yalnız yerel preview kuyruğuna bir kayıt yazıldı (`form-browser.json`). Bildirim kapalıdır; e-posta gönderildi denmedi. Rıza olmadığı için istemci makbuzunun tüketilmesi GA4'e olay alındığını kanıtlamaz.

## 5. Gerçek tarayıcı kabulü

Kanıt kökü `.local/signature-3/`. `layout.json`, `supplemental.json`, `final-small.json`, `visual-results.json` ve gerçek görüntüler.

| Gerçek CSS genişliği | Ana sayfa/ürün/fiyat/demo kabulü | Document genişliği |
|---|---:|---:|
|360|6 PASS|348|
|390|6 PASS|378|
|768|6 PASS|756|
|1024|6 PASS|1012|
|1440|6 PASS|1428|
|1920|6 PASS|1908|

Ana altı route: `/`, `/market-pos`, `/depo-yonetimi`, iki ürünün `/fiyatlandirma` adresi ve `/demo`.36 benzersiz route/genişlik kabulünde yatay taşma, ana CTA metni kesilmesi, bozuk U+FFFD karakteri, yüklenmiş kırık görsel veya birden fazla H1 bulunmadı. Hero görsellerinin sahne sınırları ayrıca ölçüldü. Dosya adındaki1920 tek başına kanıt sayılmadı; ilk viewport isteği henüz1440 döndürdüğünde test1920 olarak sayılmadı, ayrı çağrıda gerçek1920 doğrulandı.

Kalan15 pazarlama/yasal sayfası ve giriş/kayıt360 ve1920px'te ayrıca ölçüldü:34 gözlem, taşma/bozuk karakter yok, tek H1. Böylece21 public canonical sayfa ve2 hesap adresi görsel ölçüm kapsamındadır. Hesapların token scope'una son geçişi sonrası dar/geniş kabulü tekrarlandı (`final-small.json`).

Her istenen genişlikte ana sayfa, iki ürün, iki fiyat sayfası ve demo için screenshot alındı. Ara/final ek görsellerin gerçek format/piksel ölçüleri `visual-results.json` içindedir. Screenshot servisi bazı çıktıları viewport'tan kırpıyor veya düşük raster netliğiyle veriyor; bunlar sayfanın ölçülmüş yatay taşması diye sunulmadı. Görseller upscale edilmedi. DOM viewport ölçüsü, PNG/JPEG piksel ölçüsünün yerine geçirilmedi. Tam sayfa/clip denemesi her durumda tam hero kanıtı sayılmamalı; ölçüm JSON'u ve standart viewport kareleri birlikte değerlendirilmelidir.

## 6. Etkileşim ve erişilebilirlik

- Yeni Depo sekmesi yalnız warehouse panelini açtı; eski akış tab-0 kaldı. ArrowRight stok sekmesine odağı taşıdı. Eski akış tab-1'e geçerken yeni stok sekmesi değişmedi (`interaction.json`).
- Uzun rehber bağlantısı kapalı details'ı açtı; hedef görünür oldu.
- Mobil menü Escape ile kapandı; odak menü düğmesine döndü (`menu.json`).
- Açık/koyu temada226 computed metin/zemin örneği ölçüldü. İlk kontrolde eski örnek akış başlığı gece zemininde **2,529:1 FAIL** verdi. Düzeltme öncesi kanıt `contrast-before-fix.json` içinde korundu. Semantik gece metin rengine geçildikten sonra **226/226 PASS**, en düşük örnek5,576:1 (`contrast.json`).
- [W3C SC1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) normal metin4,5:1/büyük metin3:1 eşikleri yuvarlanmadan kullanıldı. Bu örnekleme tam WCAG sertifikası değildir; tüm hover/disabled/zoom/ekran okuyucu durumları kapsanmadı.
- Focus halkası, native form etiketleri ve reduced-motion kuralları korunur. Statik perspektif reduced-motion'da da kaldırılır. Gerçek OS tercihi değiştirerek tüm animasyonların cihaz kabulü yapılmadı.

## 7. Bu tur çalıştırılan otomatik testler

| Kapsam | Gerçek sonuç | Kanıt |
|---|---|---|
|Tam API/SQLite|760 PASS /0 FAIL,95 suite|`.local/customer-experience/run-14f91c7e1cd67e4f/jest.json`|
|Ortak runtime/sunum/scanner/distribution|51 PASS /0 FAIL|aynı run/presentation.log|
|React production build|exit0|aynı run/commands.json|
|Mevcut ticari web/form kabulü|25 kontrol PASS;8 alt komut exit0|site-results.json|
|Tam SEO kabulü|21 canonical sayfa PASS|seo.log|
|Rıza/dönüşüm/taslak hesap testleri|11 PASS /0 FAIL|analytics.log|
|Public fiyat kuruş/indirim kabulü|12 kontrol PASS|published-price.log|
|Kayıt/giriş/korumalı indirme|PASS|accounts.log|
|Demo/teklif/iletişim/ortaklık|4 sentetik form PASS|conversion-acceptance.log|
|Yeni PHP ortak bileşen güvenliği|9 kontrol PASS|components.log; allowlist, escape, no-JS, canonical nav|
|Gerçek browser kanıtları kontrolü|PASS|`node tools/release-candidate/signature-check.cjs`|

Testler silinmedi, assertion zayıflatılmadı veya skip eklenmedi. Kümeler kesişir; tek toplam başarı yüzdesi oluşturulmadı. MySQL bu tasarım turunda tekrar çalıştırılmadı; önceki29PASS yeni test diye sayılmadı. Backend, DB şeması, satış motoru ve lisans kaynaklarına müdahale edilmedi.

## 8. Performans ve yayın sınırları

Yeni animasyon/render kütüphanesi eklenmedi. Görseller mevcut optimize edilmiş gerçek ekranlardır; intrinsic boyutlar, alt metin, tam boy erişim, hero priority ve alt ekranlarda lazy/async korunur. Aynı varlıklar cache üzerinden tekrar kullanılır. Yeni ekran seçimi küçük bir DOM modülüdür; sürekli animation timer'ı veya parallax event döngüsü yoktur.

Son hashli dosyaların byte/gzip hesabı `assets.json` içindedir; ana CSS yaklaşık19,3KB gzip. Bu yerel gzip hesabı hostingin compression ayarını doğrulamaz. Canlı LCP/INP/CLS saha verisi veya Lighthouse skoru ölçülmedi; Core Web Vitals geçti denmedi. Gerçek düşük donanım ve fiziksel mobil kabulü ayrıca gerekir. İncelenen son tarayıcı error kaydı boştu; bu bütün cihazları kapsamaz.

## 9. Değiştirilen dosyalar

| Dosya | Değişiklik |
|---|---|
|website-php/design-tokens.json|Merkezi Signature3 tasarım kaynağı|
|website-php/design-components.php|Güvenli ortak ekran, akış, temsili lokasyon, explorer ve ürün navigasyonu|
|website-php/assets/premium.css|UI/UX2 yerine kanonik Signature sunumu; yeni override katmanı değil|
|website-php/premium-hero.php|Yeni başlık ve katmanlı POS/WMS kompozisyonu|
|website-php/commercial-home.php|Retail/Warehouse hikâyeleri, gerçek ekranlar ve statik raf açıklaması|
|website-php/commercial-product.php|Tekrarlanan markup yerine ortak explorer; kabul sınırı notları|
|website-php/package-family-view.php|Ortak gerçek ekran ve sticky ürün nav; mevcut fiyat/limit kaynağı korunur|
|website-php/index.php|Ortak bileşen include, explorer ve açılır uzun rehber alanı|
|website-php/accounts.php|Yalnız ortak tasarım scope'u; auth davranışı değiştirilmedi|
|website-php/assets/signature.mjs|Progressive, klavyeyle kullanılabilir gerçek ekran seçimi|
|website-php/assets/site.js|Yeni modül boot; eski tab sorgusunu kendi alanına sınırlama; details anchor açma|
|website-php/bin/build-assets.cjs|Merkezi token/breakpoint derleme|
|website-php/asset-manifest.php|Son hashli varlıklar|
|website-php/assets/main.bb8b99ac7763.css|Üretilmiş ana CSS|
|website-php/assets/program.a71e6588b436.css|Üretilmiş indirme CSS|
|website-php/assets/pricing.3268bcfecf5b.css|Üretilmiş fiyat CSS|
|website-php/assets/notes.f0947e7ed5cd.css|Üretilmiş notlar CSS|
|website-php/assets/accounts.4cdce5b51900.css|Üretilmiş hesap CSS|
|website-php/assets/site.06b40ed7395e.js|Üretilmiş site JS; consent paketi aynı|
|website-php/bin/signature-components-test.php|Yeni PHP bileşen güvenliği kabulü|
|tools/release-candidate/signature-check.cjs|Kaydedilmiş gerçek browser verisinin yeniden kontrolü|
|docs/audits/VENIUX_SIGNATURE_DESIGN_3.md|Bu rapor|

Ara derlemelerin hashli dosyaları yerelde oluştu. İleride onaylı deployment yapılırsa manifest ve son varlık seti birlikte yayımlanmalıdır. Git deposu olmadığından dosya listesi Git diff değildir.

## 10. Son karar ve açık kapılar

**Yerel Signature3 tasarım ve belirtilen regresyon kabulü PASS.** Estetik kalite subjektiftir; uluslararası firmalarla eşitlik veya bütün WCAG maddelerine uyum ilan edilmedi. Canlıya çıkış veya genel ticari ürün kabulü verilmedi.

RC2/paket engelleri sürer: imzalı/temiz Windows kurulum/update/rollback, gerçek Android/okuyucu/yazıcı/terazi ve banka/ÖKC/e-belge kabulü, anahtar olayı/rotasyon onayı, şifreli deployment recovery, merkezi yönetim erişimi/topoloji, pending satış/update kurtarma, yeni ürün aileleri için merkezi/offline lisans, şube kotası ve Node→PHP katalog senkronizasyonu. Bu tasarım değişikliği bunları kapatmaz.

Onaysız fiyatlar ve paketler ticari satışa açılmadı; gerçek lisans/müşteri geçişi yapılmadı. Yeni fiyat/kapsam, gereken teknik kabuller ve ayrıca deployment için ilgili onaylar gerekir.

Kapanış: yerel PHP önizlemesi durduruldu; geçici tarayıcı sekmesi kapatıldı, viewport sıfırlandı. Yalnız bu tur oluşturulan preview ve sentetik hesap/form klasörleri tam yol/reparse-point kontrolleriyle temizlendi; kanıt log/JSON/görselleri ve eski dosyalar korundu (`cleanup.json`). Ek masaüstü Chrome oturumu araçta mevcut olmadığı için açılamadı; ayrı Chrome/çok tarayıcı kabulü başarılı gösterilmedi. Gerçek tarayıcı kanıtları yerel in-app browser kapsamındadır.
