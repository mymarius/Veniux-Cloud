# VENIUX — Afterdark Design System

Tarih: 20 Ekim 2026 (Europe/Istanbul). Kapsam: yerel PHP pazarlama sitesi. Canlıya dağıtım, üretim verisi, ödeme, lisans veya anahtar değişikliği yapılmadı.

## Sonuç

Afterdark yerel kodda uygulandı. Koyu grafit/gece paleti, büyük tipografi, mavi/indigo vurgu, sınırlı turuncu detay ve gerçek ürün ekranlarından katmanlı hero oluşturuldu. Retail, Warehouse ve Intelligence farklı kompozisyonlarla sunuluyor. Ortak tasarım değişkenleri ürün, demo, indirme ve hesap sayfalarına da uygulanıyor.

Yerel önizleme: `http://127.0.0.1:39769/`. Taslak fiyatlandırma: `/fiyatlandirma`. Bu port yalnızca loopback üzerinde, bildirim gönderimi kapalı ve `.local/afterdark/preview` altında izole kayıtlarla çalıştırıldı. Önizleme süreci durdurulursa aşağıdaki ortam ayarlarıyla yeniden başlatılabilir.

## Tasarım kararları

- Ana başlık: “İşletmeni yönetme. Geleceğini yönet.” İkinci satır elektrik mavisi. Büyük, çizgisel V formu marka geometrisini destekliyor.
- Hero içinde mevcut sentetik verili gerçek POS ve mal kabul ekranları; masaüstünde perspektifli iki katman, mobilde okunabilir üst üste yerleşim. Tam boy ekran bağlantıları korunuyor.
- Retail: mavi kenar, satış akışı ve sağda gerçek POS ekranı. Warehouse: turuncu kenar, ters yerleşim, raf/lokasyon anlatımı ve gerçek mal kabul ekranı.
- Intelligence: indigo çalışma alanı, gerçek stok ekranı ve bağlam/yetki/onay anlatımı. Stok ekranı açıkça AI yanıtı olarak sunulmuyor. Harici sağlayıcı gereksinimi ve kayıt bağlamının sağlayıcıya iletilebilmesi açıklaması korunuyor.
- Sonlu giriş/reveal animasyonları, mevcut IntersectionObserver ile kaydırmada görünürlük geçişleri; sonsuz dekoratif animasyon eklenmedi. Reduced-motion CSS ve mevcut JS davranışı korundu.
- Eski CSS'ten kalan beyaz masaüstü başlığı ve mobil dialog düzeltildi. Koyu zemin üzerinde düşük kontrast veren breadcrumb ve footer renkleri düzeltildi.
- Ürün ekranları için yeni sahte arayüz/başarı rakamı üretilmedi. Mevcut JPEG ürün görselleri değişmedi.

Kalite referansı olarak [Apple](https://www.apple.com/), [Linear](https://linear.app/), [Stripe](https://stripe.com/en-ch) ve [Framer](https://www.framer.com/) resmî sayfalarının ürün anlatımı ve navigasyon içeriği incelendi. Görsel tasarımları veya varlıkları kopyalanmadı; bu inceleme ayrı bir piksel karşılaştırması değildir.

## Taslak fiyat güvenliği

Yeni fiyat deneyimi yalnızca **iki koşul birlikte** sağlandığında açılır: `VENIUX_SITE_ENV=development` ve `VENIUX_AFTERDARK_PREVIEW=1`. URL parametresi bu kapıyı açamaz. Üretim ortamı + önizleme bayrağı da yeterli değildir. Taslak JSON web kökünün dışındadır.

| Plan | Aylık net TL | Yıllık peşin net TL |
|---|---:|---:|
| Retail Start | 1.490 | 15.198 |
| Retail Pro | 2.990 | 30.498 |
| Retail Business | 5.990 | 61.098 |
| WMS Start | 2.490 | 25.398 |
| WMS Pro | 4.990 | 50.898 |
| WMS Enterprise | Özel teklif | Özel teklif |
| Unified | 6.490 başlangıç | 66.198 başlangıç |

KDV hariç, %15 yıllık peşin indirim. Hesap integer kuruşla yapılır; gösterim dışında fiyat hesabında kayan nokta kullanılmaz. Aile ve dönem geçişleri sunucuda doğrulanan bağlantılarla çalışır; JS gerektirmez.

Modül ve kullanıcı/depo/kasa/cihaz limitleri mevcut `product-packages.json` kataloğundan okunur. AI kota hakkı katalogda bulunmadığı için “teklifte belirlenir” denir; sınırsız kullanım uydurulmaz. Kurulum/eğitim/destek kapsamı ayrıca netleştirilir. Mevcut `familyPriceCents`, `familySelection`, onaylı fiyat kaynağı, lisans atama ve ödeme akışı değiştirilmedi. Önizleme açıkken bile teklif tutarı taslak fiyata dönüşmez. Yeni fiyatlar satışa açılmadı.

## Değiştirilen dosyalar

| Dosya | Değişiklik |
|---|---|
| `website-php/premium-hero.php` | Yeni başlık, marka geometrisi, iki gerçek ekranlı hero ve ürün navigasyonu |
| `website-php/design-tokens.json` | Afterdark 7 paleti, radius ve ekran gölge değişkenleri |
| `website-php/assets/premium.css` | Ana tasarım, responsive sahne, ürün/AI vitrinleri, menü, kontrast, sonlu hareket ve reduced-motion |
| `website-php/assets/site.js` | Mevcut reveal kapsamına ürün/AI/paket alanları; grafit/gece tema etiketleri |
| `website-php/intelligence-section.php` | Gerçek stok bağlamı, rol/işletme kapsamı ve onay anlatımı |
| `website-php/afterdark-pricing.php` | Geliştirme önizleme kapısı, integer taslak fiyat hesabı ve açıklama |
| `website-php/afterdark-pricing-view.php` | Retail/Warehouse/Unified, aylık/yıllık geçiş ve gerçek katalog limitleri |
| `website-php/pricing-view.php` | Önizleme yönlendirmesi; fiyatların önündeki tekrarlanan uzun tanıtım kaldırıldı |
| `website-php/package-family-view.php` | Gated taslak fiyat gösterimi, AI/hizmet kapsamı açıklaması |
| `website-php/assets/package-family.css` | Premium paket düzeni ve önerilen Pro vurgusu |
| `website-php/index.php` | Helper yükleme ve ana sayfa başlık metni |
| `docs/audits/COMMERCIAL_PRICING_DRAFT.json` | Kullanıcının yeni taslak tutarları; onaysız statü korunuyor |
| `website-php/bin/afterdark-pricing-test.php` | Ortam kapısı, fiyatlar, yıllık indirim, teklif izolasyonu regresyonları |
| `tools/release-candidate/afterdark-site.cjs` | HTTP, içerik, hareket ve yeni tarayıcı ölçümlerinin kabul kontrolü |
| `website-php/asset-manifest.php`, `website-php/assets/{main,program,pricing,notes,accounts}.*.css`, `site.c0f0315a00dc.js` | Kaynaklardan yeniden oluşturulan dağıtım varlıkları |
| Bu rapor ve `.local/afterdark/` | Güncel test ve ekran görüntüsü kanıtları |

Son CSS manifesti: `main.d4e08e97e6a3.css`, `program.284b908b954c.css`, `pricing.55bda91b56ad.css`, `notes.bda0fe8fe488.css`, `accounts.19040ec6f776.css`. Çerez bundle'ı değişmedi.

## Gerçekten çalıştırılan doğrulamalar

| Kontrol | Sonuç / kanıt |
|---|---|
| Asset build | PASS — `node website-php/bin/build-assets.cjs` |
| Değişen PHP şablonlarının syntax kontrolü | PASS |
| Taslak fiyat birim testi | PASS — 20 kontrol; `.local/afterdark/pricing-test.log` |
| Ortak ekran bileşenleri | PASS — 9 kontrol; `.local/afterdark/components-test.log` |
| Ticari site regresyonu | PASS — 25 HTTP/form kontrolü ve 8 alt komut; `site-results.json` |
| SEO alt kontrolü | PASS — 22 kanonik sayfa, sitemap, ayrı başlıklar, private-page exclusion ve gerçek 404 |
| Analytics/consent alt testi | PASS — 11 test; gerçek GA4 hesabının aktif olduğuna dair iddia değildir |
| Afterdark kabul kontrolü | PASS — 10 kontrol grubu; `design-results.json` |
| Tarayıcı responsive ölçümü | PASS — 360, 390, 768, 1024, 1440, 1920 CSS px × 9 sayfa, toplam 54 ölçüm; yatay taşma yok, her sayfada tek H1; `viewport-checks.json` |
| Mobil menü | Açılma ve Escape ile kapanma gerçek tarayıcıda doğrulandı |
| Ürün ekranı sekmeleri | Depo → ArrowRight → Stok sekmesinin `aria-selected=true` olması doğrulandı |
| Fiyat etkileşimi | Warehouse aylık/yıllık ve Unified yıllık geçişleri gerçek tıklamalarla doğrulandı |
| Örneklenen metin kontrastları | 26 DOM renk örneği; en düşük 5,76:1 (beyaz CTA yazısı). Footer düzeltme sonrası 9,84:1; `contrast-checks.json` |

İlk ticari test denemesi sandbox alt süreç kısıtı nedeniyle `published-price` aşamasında çalıştırılamadı. İzinli yerel çalıştırmada tüm alt komutlar 0 çıkış koduyla tamamlandı; bu ortam hatası gizlenmedi. Eski `rebirth-site.cjs` önceki hareketsiz editorial tasarımın kanıtlarına bağlıdır. Yeni kullanıcı hareket istediğinden eski sonuçlar yeniden kullanılarak başarı iddia edilmedi; yeni kabul dosyası sonlu hareketi ve **bu çalışmanın** tarayıcı ölçümlerini denetler.

## Görsel kanıtlar

`.local/afterdark/screenshots/` altında gerçek tarayıcı yakalamaları:

- `home-desktop.png`, `home-mobile.png`
- `retail-desktop.png`, `retail-mobile.png`
- `warehouse-desktop.png`, `warehouse-mobile.png`
- `intelligence-desktop.png`, `intelligence-mobile.png`
- `pricing-desktop.png`, `pricing-mobile.png`
- `navigation-mobile.png`

Hero, navigasyon, Retail, Warehouse, Intelligence ve fiyatlandırma görüntüleri incelendi. Tarayıcı sağlayıcısının ölçeklenmiş ekran çıktılarında metin keskinliği sınırlı; bu yüzden görsel kanıtlar yerleşim/taşma kontrolüyle birlikte değerlendirildi. Piksel düzeyinde cihaz ekranı sertifikasyonu iddia edilmiyor.

## Sınırlar ve kalan işler

- Canlı fiyat onayı/yayın yapılmadı. Taslak fiyatlar onaylanmadan üretimde açılmamalı; geliştirme ortamı bayrakları üretime taşınmamalı.
- Tam WCAG sertifikasyonu, ekran okuyucu cihaz matrisi, gerçek mobil cihaz ve alan verili Core Web Vitals ölçümü yapılmadı. Reduced-motion kaynak koruması doğrulandı; işletim sistemi tercih emülasyonu bu tarayıcı oturumunda çalıştırılmadı.
- Yeni bir AI sağlayıcısı bağlanmadı; AI kota/hizmet sözleşmeleri belirlenmedi. Görsel anlatım bunların aktif olduğu anlamına gelmez.
- Satış motoru, Android, Electron, MySQL veya donanım paketleri değiştirilmedi; geçmiş API/RC2 test sayıları bu çalışma için yeni sonuç olarak gösterilmiyor. RC2 fiziksel donanım, mali entegrasyon, imzalama ve diğer dağıtım engelleri devam ediyor.
- Tasarımın estetik kabulü kullanıcı incelemesini bekler; testlerin geçmesi estetik kusursuzluk garantisi değildir.

## Yerel tekrar çalıştırma

Önce `node website-php/bin/build-assets.cjs`. PHP preview için `VENIUX_SITE_ENV=development`, `VENIUX_AFTERDARK_PREVIEW=1`, `VENIUX_CONTACT_NOTIFY=0`, izole `VENIUX_CONTACT_STORAGE` ve `VENIUX_SITE_DATA_DIR` belirlenmeli; `C:/xampp/php/php.exe -S 127.0.0.1:39769 -t website-php website-php/router.php` kullanılmalı. Kabul testleri sadece localhost adresini kabul eder. Ticari site regresyonu önizleme bayrağı kapalı ortamda kendi izole sunucusunu açar.

## 20 Ekim — ikinci görsel düzenleme

Kullanıcının premium görünüm geri bildirimi üzerine hero ortalandı, başlık ağırlığı ve satır aralığı inceltildi, menü kompakt kapsül düzene alındı. İlk CTA açık porselen renginde, ürün sahnesi dış kutusuz ve daha kontrollü perspektifle yeniden düzenlendi. Uzun Retail/Warehouse özellikleri erişilebilir native details içine taşındı; içerik ve bağlantılar korunuyor. Değişen kaynaklar: premium.css, premium-hero.php, commercial-home.php; manifest ve CSS bundle'ları yeniden üretildi.

Yeni doğrulama: PHP syntax ve asset build PASS. Ticari regresyon tekrar çalıştırıldı: 25 kontrol + 8 alt komut PASS. 390 CSS px mobil ekranda scrollWidth 378; iki ürün ayrıntısı DOM'da mevcut, Retail ayrıntısı tıklamayla açıldı. Masaüstü ve mobil görüntüler incelendi: `.local/afterdark/screenshots/refined-desktop.png`, `refined-mobile.png`. Önceki 54 ölçüm bu küçük revizyon için yeniden çalıştırılmış sayılmamalıdır.

Önizleme sunucusu yeniden başlatıldı: http://127.0.0.1:39769/ . Canlıya dağıtım yapılmadı.
