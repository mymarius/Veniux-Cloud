# Veniux — görsel düzenin yeniden kurulması

20 Ekim 2026. Önceki Rebirth 5 tasarımının kullanıcı tarafından reddedilmesinden sonra yapılan yerel görsel değişiklikler. Bu belge görsel beğeni veya kusursuzluk garantisi vermez; uygulanmış düzeni ve çalıştırılan kontrolleri kaydeder.

## Değişen tasarım

Parlayan rozetler, telemetri süsleri, perspektifli üst üste ekranlar, büyük gölgeler, sürekli dekoratif hareketler ve pill biçimli butonlar kaldırıldı. Eski 2.000 satırlık kanonik sunum katmanı yerine daha küçük, ortak bir stil sistemi yazıldı; yeni bir override dosyası eklenmedi.

Ana sayfa; büyük başlık, ayrı kısa açıklama/CTA ve tek geniş gerçek POS ekranıyla yeniden kuruldu. Kırık beyaz zemin, lacivert metin, düz mavi aksiyonlar ve sınırlı turuncu vurgu kullanılıyor. Mobilde aynı içerik tek sütunda; ürün ailesi bağlantıları numaralı satırlara dönüşüyor. Retail/Warehouse anlatımı aynı kutunun tekrarı yerine ters yerleşim ve çizgilerle ayrılan özellik listeleri kullanıyor.

Fiyatlandırma, tek bir karşılaştırma yüzeyinde üç plan; önerilen Pro alanında sakin zemin ve ince mavi çizgi kullanıyor. Fiyatlar/kotalar/katalog değişmedi. Intelligence mevcut gerçek kapsam ve sağlayıcı açıklamalarıyla korunuyor. İletişim formu açık zeminli, okunabilir alanlar ve tutarlı butonlarla aynı sisteme alındı. Eski uzun örnek akışları silinmedi; yerel `details` içine taşındı. `#deneyim` bağlantısının üst bölümü açtığı tarayıcıda doğrulandı.

## Dosyalar

| Dosya | Değişiklik |
|---|---|
| `website-php/premium-hero.php` | Yeni başlık/açıklama yerleşimi, tek büyük gerçek ekran, üç ürün ailesi bağlantısı |
| `website-php/assets/premium.css` | Ortak görsel sistemin yeniden yazımı; menü, tipografi, ekran, ürün, AI, FAQ, form ve mobil stiller |
| `website-php/assets/package-family.css` | Plan, ürün alt menüsü, karşılaştırma ve ürün ailesi hero stillerinin yeniden yazımı |
| `website-php/design-tokens.json` | Açık/koyu renkler, 1280px içerik genişliği, küçük radius ve gölgesiz ekranlar |
| `website-php/index.php` | Uzun eski örnek akışları erişilebilir açılır bölüm içine alma; iş mantığı değişmedi |
| `website-php/asset-manifest.php` | Son CSS çıktılarının seçimi |
| `website-php/assets/main.447091996f87.css` | Genel pazarlama derlemesi |
| `website-php/assets/program.bda13e7e1d52.css` | İndirme derlemesi |
| `website-php/assets/pricing.1b2ae29d89f6.css` | Fiyatlandırma derlemesi |
| `website-php/assets/notes.14342dd72b78.css` | Not/arşiv derlemesi |
| `website-php/assets/accounts.036780c65733.css` | Ortak hesap sunumu derlemesi |
| `tools/release-candidate/rebirth-site.cjs` | Yeni tasarımın hareket/viewport kabulü; 54 güncel ölçüm kaydı |

Eski testte view-timeline bulunması beklentisi tasarımın artık bu efekti kullanmaması nedeniyle değiştirildi: reduced-motion guard ve sürekli dekoratif animasyon bulunmaması doğrulanıyor. Route, canonical, gerçek AI sınırları ve sahte iddia kontrolleri korundu. Önceki ölçümler yerine bu çalışmanın yeni ölçüm dosyası okunuyor.

## Gerçekten çalıştırılan doğrulamalar

- `node website-php/bin/build-assets.cjs`: PASS.
- `php -l website-php/index.php`: PASS.
- `php website-php/bin/signature-components-test.php`: 9 PASS; allowlist, escaping, gerçek görsel ölçüsü, JS olmadan içerik ve canonical ürün bağlantıları.
- `node tools/release-candidate/commercial-site.cjs`: 25 kontrol PASS; 8 alt komut exit 0. SEO, yayınlanmış fiyat, form/CSRF, hesap, dönüşüm ve consent/analytics kabulü. Kanıt `.local/editorial-design/site-results.json`.
- `node tools/release-candidate/rebirth-site.cjs`: 6 kabul grubu PASS. Kanıt `.local/editorial-design/design-results.json`.

IAB tarayıcısında dokuz rota (`/`, `/market-pos`, `/depo-yonetimi`, `/yapay-zeka`, `/fiyatlandirma`, `/demo`, `/program-indir`, `/giris`, `/kayit`) × altı CSS genişliği (360, 390, 768, 1024, 1440, 1920): **54 kombinasyonda tek H1, yatay belge taşması yok**. Ham kanıt `.local/editorial-design/viewport-checks.json`.

İlk mobil denemede eski iletişim menüsü buton kuralından dolayı 430px belge genişliği oluştu; kaynağı düzeltildi. Son ölçümde aynı 360px viewport için belge 348px. Hata gizlenmedi; son kabul yeniden alındı. Başlık, CTA, AI ve form metni örnekleri gerçek hesaplanmış foreground/background renkleriyle ölçüldü; seçilen örneklerin tamamı 4,5:1 üstünde. Ham örnekler `.local/editorial-design/contrast.json`. Bu sınırlı örnekleme tam WCAG denetimi değildir.

Mobil menü açma/Escape kapama, ürün sekmesinde Depo seçimi ve ArrowRight ile Stok seçimi, eski `#deneyim` derin bağlantısı, koyu tema ve 1440px taşmasız görünüm doğrulandı. Tasarım değişikliği satış motoruna dokunmadığından önceki turdaki 760 API sonucunu yeniden çalıştırılmış gibi sunmuyoruz.

## Ekran görüntüleri ve sınırlar

`.local/editorial-design/screenshots/`: `home-final-1440.png`, `home-dark-1440.png`, `home-390.png`, `home-768.png`, `home-1920.png`, `pricing-1024.png`, `contact-1440.png` ve önceki kontrol görüntüleri. Ekran görüntüsü sağlayıcısının raster yumuşatması/kırpması olabilir; dosya adı birebir raster ölçüsü garantisi değildir. Viewport doğrulaması gerçek `innerWidth` kaydından yapılmıştır.

Lighthouse/gerçek kullanıcı Core Web Vitals, Safari/Firefox, gerçek telefon ve ekran okuyucu kabulü yapılmadı. Tüm koyu tema genişlik matrisi çalıştırılmadı. Önceki RC2 cihaz, mali entegrasyon, kod imzalama ve ticari dağıtım engelleri bu görsel çalışmayla kapanmaz.

Üretime yayın, müşteri verisi/üretim DB erişimi, fiyat/lisans/anahtar değişikliği veya gerçek ödeme yapılmadı. Önceki kaynakların küçük yedeği `.local/editorial-design/*-before.*` içinde; geniş derleme veya cihaz paketi üretilmedi.
