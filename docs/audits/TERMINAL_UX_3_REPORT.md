# Terminal UX 3.0 — sınırlı kalite düzeltmeleri ve yeniden doğrulama

Tarih: 18–19 Ekim 2026 (testler18 Ekim, rapor kapanışı19 Ekim). Yerel, izole test; üretim yayını, gerçek ödeme, canlı DB işlemi ve müşteri kaydı değişikliği yapılmadı.

Bu rapor bir sertifika değildir. PASS yalnız belirtilen çalıştırılmış kontrolün sonucudur. BLOCKED / NOT TESTED başarıya katılmaz. Kaynak incelemesi, cihaz veya canlı hizmet kabulünün yerine geçmez.

Standalone POS mimarisi ve mavi/turuncu tasarım korundu. ERP navigasyonu eklenmedi; satış/ödeme motoru değişmedi.

## Bulgular ve düzeltmeler

| ID / önem / durum | Kanıt ve tekrar üretme | Sonuç / çözüm |
|---|---|---|
| UX-01 P2 düzeltilmiş — satır kaldırmadan vazgeçince odak dönmüyor | `frontend/src/pages/RetailPos.jsx:53`; barkodla ürün → Kaldır → Vazgeç. Önce activeElement='Kaldır', sonra barkod | removeLine, discountOpen, priceEdit kapanışları mevcut gecikmeli güvenli odak etkisine eklendi; dialog/pending/lock koruması korunuyor. `focus-regression.json`: önce15 satır, sonra bağımsız yeni fixture1 satır; stok satışı yapılmadı |
| UX-02 P2 düzeltilmiş — küçük durum metni kontrastı 4,44:1 | `frontend/src/pages/PosTerminalUX2.css:77`; eski computed #526d87 / #e2eaf3 | Metin #476079 yapıldı. Statik sRGB oranı 5,38:1 (sRGB hesabı); normal küçük metin için 4,5 sınırını aşar. Tüm ekran WCAG sertifikası değildir |
| UX-03 P2 önceki düzeltme bu tur yeniden görüldü | Kamera46×46, nötr Ekle/kamera/ürünbul; `viewports.json` | Dört çözünürlükte güncel tarayıcı gözlemi; belirgin mavi ödeme vurgusunda kaldı |

## Çalıştırılmış görsel matris

.local/production-readiness-3/classic-*.png ve visual-*.png: **8 yeni gerçek screenshot**, PNG ölçüleri ayrıca okundu. 15 satır (uzun kahve adı +14 fixture ürün), toplam347,90 TL; sayfa scrollWidth/Height viewport ile aynı, sepet scrollHeight951/1013 > clientHeight. İncelenen görünür ana düğmelerde <44 piksel hedef bulunmadı.

| Çözünürlük | Klasik / görselli | Ana sayfa | Sepet clientHeight (klasik/görsel) | Ödeme |
|---|---|---|---|---|
| 1024×768 | PASS / PASS | 1024×768, taşma yok | 438 /141 | Görünür, 76px yüksek |
| 1280×800 | PASS / PASS | 1280×800, taşma yok | 462 /165 | Görünür, 76px yüksek |
| 1366×768 | PASS / PASS | 1366×768, taşma yok | 430 /133 | Görünür, 76px yüksek |
| 1920×1080 | PASS / PASS | 1920×1080, taşma yok | 734 /790 | Görünür, 76px yüksek |

Bu sekiz görünüm `run-04c2e7043cce4db7` derlemesinden, odak/kontrast düzeltmesinden **önce** alındı; son iki değişiklik yerleşim ölçülerini değiştirmiyor. Odak düzeltmesi `run-797f47cf8ced2681` ile yeni fixture'da gerçek tarayıcıda tekrar edildi. Bu sonraki sekmede istenen viewport override doğru ölçüye ulaşmadı (capture386×217); bu görüntü **1366×768 kanıtı diye kullanılmadı**, `focus-capture-386x217.png` diye adlandırıldı. Son kaynakların run-d510c13891ac5689 derlemesinde final-viewports.json ile dört CSS çözünürlüğü × iki mod tekrar ölçüldü: ana sayfa hedef ölçüde,15 satır ve ödeme görünür. Yukarıdaki clientHeight tablosu bu son DOM ölçümüdür. Tarayıcı devicePixelRatio1,88 nedeniyle viewport aracı fiziksel ölçüyle ayarlandı; gerçek innerWidth/innerHeight hedeflerle doğrulandı. Son renk computed rgb(71,96,121) / rgb(226,234,243) olarak tekrar görüldü. Son screenshot aracı DOM1366×768 iken726×559 PNG döndürdüğünden bu dosya final-capture-726x559.png olarak ayrıldı; büyütülmedi ve1366 kanıtı diye sunulmadı. Bu, gerçek Windows DPI testi değildir.

## Akış ve erişilebilirlik kanıtları

- Boş sepet/yükleme durumu yeni fixture açılışında görüldü. Satır silme açık onayı ve vazgeçme, odak geri dönüşü gerçek UI'da test edildi.
- F8 ödeme ekranını açtı; Alınan nakit200 girildi; F9 aynı alanda kaldı; Enter ödemeyi kaydetmedi. Dialog ve sepet açık kaldı. `payment-keyboard.json`, `payment.png`. **Bu görevde tarayıcıdan satış tamamlanmadı**; gerçek API satış/ödeme regresyonları ayrı çalıştı.
- Yeni UI koşusunun son konsol error listesi boştu. Ekle disable/reading, hata/pending mesajlarının kaynak kontrolleri korundu; tarayıcıya ağ hatası enjekte edilerek bütün hata/toast görünümleri bu tur yeniden sınanmadı.
- Seçilmiş computed kontrastlar: barkod13,99; kamera7,92; ürün adı14,19; fiyat5,81; ödeme4,56. Gradient/hover/disabled ve bütün modallar için tam erişilebilirlik taraması değildir. Disabled kontroller normal etkin metin gibi değerlendirilmedi.
- 1366 ve1024 görsel modunda sepet kısa ama kendi alanında kayıyor; toplam sabit. Daha çok görünen satır için kullanıcı pilotu ölçümü önerilir; tüm sayfayı yeniden tasarlama yapılmadı.

## Test ve kalan risk

Son UI/guard koşusu `.local/customer-experience/run-d510c13891ac5689`: **47 PASS, 0 FAIL, 0 SKIP**, React build exit0. Önceki43 test aynen korundu;4 yeni dağıtım koruması testi eklendi. Bu testler React DOM bileşenlerinin tam render testi değildir; ortak/sunum/sözleşme testleridir.

UX-04 P1 fiziksel kabul bekliyor: Windows %125/%150 DPI, gerçek touch, zayıf POS CPU/GPU ve gerçek HID/kamera NOT TESTED. Kaynak: `frontend/src/pages/PosTerminal.css:1`; tekrar gerçek cihaz kabul planı; çözüm pilot öncesi bu matrisi paketli terminalde çalıştırmak.

UX-05 P2 açık: kalıcı API sağlık göstergesi ve bütün offline/hata durumlarının görsel regresyonu yok. Kaynak: `frontend/src/pages/RetailPos.jsx:83`; API kesintisi/recovery durumunu UI testinde enjekte ederek mesaj, tekrar dene ve odak davranışını doğrula. Browser navigator.onLine tek başına yerel API sağlığı diye sunulmamalı.
