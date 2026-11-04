# Veniux 2.4.26 — ortak görünüm

Windows ve Android aynı yerel Manrope font dosyasını kullanır. Fontun açık kaynak lisansı kurulum içindeki `licenses/Manrope-OFL.txt` dosyasına eklenir. Harici yazı tipi isteği yoktur.

Ortak kurallar `frontend/src/design-system.css` içindedir. Uygulama başlangıcında `data-design="veniux"` etkinleştirilir. Kurallar sayfa dosyalarının yüklenme sırasından daha yüksek öncelikle uygulanır. Başlık, menü, kart, form ve tablo görünümü korunur; kullanıcının yazı boyutu ve köşe tercihleri desteklenir.

## Kontrol kapsamı

- 1366 × 900 boyutta 33 çalışma ekranı: aynı Manrope font ailesi, 28 px ana başlık, `#102c4b` menü; yatay sayfa taşması yok.
- 7 temsilî koyu tema ekranı: aynı menü ve font; açık ana başlık ve yatay taşma kontrolü.
- 390 × 844 boyutta mobil özet, ürünler, barkod ve saha/bayi: aynı font, 24 px görünür sayfa başlıkları, yatay taşma yok. Barkod ekranı kendi işlem başlığını kullanır.
- Testler örnek işletme verileriyle tarayıcı önizlemesinde yapıldı; tüm iş akışlarının veya fiziksel Android cihazının kabul testi değildir.

Ölçüm kayıtları: `.local/unified-design-audit.json`, `.local/unified-design-dark-audit.json`, `.local/unified-design-mobile-audit.json`.

## Windows güvenilirliği

Kurulu sürüm çalışmanın başında 2.4.21’di. 2.4.25 kurulum dosyası imzasızdı. Kullanıcı henüz yayıncı sertifikası ve Store hesabına sahip değil. Ortak tasarım düzeltmesi SmartScreen güven uyarısını ortadan kaldırmaz.

Windows yerel inceleme güncellemesi tamamlandı: kurulum çıkış kodu 0, Windows kayıtlı sürümü 2.4.26, kurulu uygulama içindeki sürüm 2.4.26. Kurulu 86 CSS/JS/font dosyası son derlemeyle eşleşti. Android 2.4.26 APK mevcut mobil anahtarla imzalandı; fiziksel telefona kurulmadı. Yeni imzasız Windows paketi indirme sitesine yayımlanmadı.

İmzalı üretim yapılandırması `desktop/electron-builder.signed.config.cjs`; sertifika sağlanmadan çalışmayı reddeder. İmza son kontrolü `desktop/verify-release-signature.ps1` ile yapılır. Ayrıntılar `WINDOWS-YAYINCI-IMZASI.md` içindedir. İmzasız yerel inceleme paketleri güvenilir imzalı dağıtım olarak yayımlanmamalıdır.
