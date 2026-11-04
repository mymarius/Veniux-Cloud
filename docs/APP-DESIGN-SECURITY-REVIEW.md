# Veniux 2.4.4 — tasarım ve güvenlik incelemesi

Tarih: 11 Ekim 2026. Kapsam: Electron uygulamasının React çalışma alanı. Pazarlama sitesi ve lisans portalının tasarımı bu incelemeye dahil değildir. Gerçek kullanıcı verileri değiştirilmedi; arayüz incelemesi ayrı, sentetik SQLite veritabanında yapıldı.

## Değişiklikler

- `frontend/src/product-design.css`, `main.jsx`, `index.css`, `enterprise.css`, `styles.scss`, `index.html`: Segoe UI yazı tipi; ortak sıcak zemin, koyu mürekkep ve bakır vurgu; tutarlı tablo, kart, buton, odak ve pencere stilleri. Harici Google Fonts bağımlılığı kaldırıldı. Koyu tema ve azaltılmış hareket tercihi korundu.
- `components/ui/DialogShell.jsx`: tüm ortak pencerelerde Tab sınırı, Esc, açan öğeye odak dönüşü, benzersiz ARIA başlığı, iç içe pencere katmanı ve kaydırma kilidi. Kullanıcı/depo/cihaz formları, sevkiyat formları, raf üretimi ve detay çekmeceleri ortak kabuğa alındı.
- `components/wms/WMSDetailDrawer.jsx`, `lib/productStock.mjs`: raf kaydı sıfır diye gerçek depo stokunun sıfır gösterilmesi düzeltildi. Depo ve raf miktarları toplanarak çift sayılmaz. Türkçe tutar gösterimi ve detay kapatma etiketi eklendi.
- `pages/Settings.jsx`: sekmeler URL ile eşleşir; geri dönüş ve yeniden açma davranışı korunur. `NormalLocations.jsx`: açık zemindeki beyaz metin ve detay çekmecesi düzeltildi.
- `lib/sessionUser.js` ve ilgili çalışma alanı bileşenleri: bozulmuş yerel kullanıcı kaydı sayfayı çökertmez.
- `contexts/LicenseContext.jsx`, `api/client.js`: düzenli lisans kontrolü çalışma alanını yeniden söküp kullanıcı işlemini kesmez; lisans kontrolü gereksiz veri yenilemesi tetiklemez.
- `AssistantLauncher.jsx`, `OperationsAssistantCard.jsx`: asistan kendiliğinden açılmaz; operasyon özeti sadeleştirildi. Asistanın kullanıcı tarafından açılması korunur.
- `MetricCard.jsx`, `StatusBadge.jsx`, `BusinessChart.jsx` ve operasyon sayfaları: yazı, başlık ve yüzey tutarlılığı. Gösterişli genel gradyanlar ve gereksiz teknik başlıklar azaltıldı; ölçülü geçişler, çekmece ve pencere hareketleri kullanıldı.
- `desktop/package.json`, `package-lock.json`, `preload.js`: sürüm 2.4.4. Electron Builder kilitli sürümü 26.17.0; bilinen bağımlılık açıkları giderildi.

## Gerçekten çalıştırılan kontroller

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Sunucu regresyonları | 70 paket, 633 test geçti | `.local/backend-review-tests.json` |
| Masaüstü hedef ve bağlantı kuralları | 7 test geçti | `desktop/runtime.test.js` çalıştırıldı |
| Bağımlılık davranışları | 4 test geçti | `.local/dependency-review-tests.log` |
| Depo/raf stok gösterimi | 4 test geçti | `frontend/src/lib/productStock.test.mjs` |
| Ön yüz üretim derlemesi | Geçti | `.local/desktop-build-2.4.4.log` |
| Ön yüz lint | Hata nedeniyle durmadı; mevcut uyarılar sürüyor | `.local/frontend-lint-review.log` |
| npm güvenlik taraması | Ön yüz, sunucu, masaüstü: bilinen açık toplamı 0 | `.local/*audit*.json` |
| Masaüstü sayfaları | 34 rota, 14 ayar sekmesi ve 10 CRM ekranı görüntülendi; yatay taşma ve görünür hata bildirimi bulunmadı | `.local/design-review/desktop-routes.json`, `settings.json`, `crm.json` |
| Küçük ekran | Operasyon rotaları, tüm ayar sekmeleri ve CRM ekranları incelendi; yatay taşma bulunmadı | `.local/design-review/mobile.json`, `mobile-extra.json` |
| Ortak stok penceresi | 25 Tab dolaşımı içeride kaldı; Esc kapattı, odak açan düğmeye döndü | Gerçek tarayıcı etkileşimi |
| Ürün detayı | Sentetik ürün 25 adet, raf 0; detay 25 gösterdi, barkodun başındaki sıfırlar korundu | Gerçek arayüz kontrolü |
| Windows kurulum üretimi | 2.4.4 NSIS oluşturuldu | `.local/desktop-installer-2.4.4/` |

Sayfanın açılması tüm iş işlemlerinin tek tek canlı kabulü anlamına gelmez. Küçük ekran denetimi tablo içindeki kontrollü kaydırmayı yasaklamaz; sayfa düzeyindeki yatay taşmayı kontrol eder. Bağımlılık taramasında sıfır sonuç, tüm uygulamada açık bulunmadığı iddiası değildir.

## Bekleyen doğrulamalar

- Yeni kurulumun temiz Windows bilgisayarda kurulması ve yerel Electron penceresinde uçtan uca kabulü yapılmadı. Kurulum dijital imzalı değildir.
- Bu turda canlı MySQL/MariaDB kabul testleri çalıştırılmadı; SQLite sonuçları MySQL sonucu olarak sunulmaz.
- Gerçek barkod okuyucu, yazıcı, terminal, dış sağlayıcı ve merkezi lisans sunucusu kabulü yapılmadı.
- Veri yoğun ekranların tüm hacimlerde performansı, her dinamik kayıt detayı ve her rolün tüm iş işlemleri bu tasarım turunda canlı doğrulanmadı.
- Mevcut lint uyarıları kapatılmış sayılmıyor. Bağımsız sızma testi yapılmadı.

Bu rapor yalnız yukarıdaki uygulanan ve doğrulanan kapsamı tamamlanmış kabul eder; “tüm eksikler giderildi” veya “kusursuz/güvenlik açığı yok” iddiası içermez.

## 11 Ekim 2026 — 2.4.5 kurulum düzeltmesi

Kullanıcının 2.4.4 yerel hazırlık hatası sonrası paket incelendi: sunucu node_modules klasörü extraResources filtresinden dolayı bulunmuyordu. Önceki kurulum üretimi kontrolü bu eksikliği yakalamamıştı. 2.4.5 açık kopyalama ve paket içindeki Node ile tüm sunucu bağımlılıklarını çözümleme/native modülleri yükleme kontrolü ekler; eksik bağımlılıkta paketleme başarısız olur. Sunucu bağımlılık yüklemesi de yakalanan başlangıç akışına taşındı.

Paketlenmiş Node ve sunucu, kullanıcı verilerinden ayrı .local/bundled-server-acceptance-* klasöründe yeni MariaDB veritabanıyla gerçekten çalıştırıldı. İlk kurulum ve aynı veritabanıyla yeniden açılışta health: ok, database: mysql, migrations: current döndü. Her iki test sonrasında sunucu ve veritabanı kapatıldı. 7 masaüstü hedef koruması testi tekrar geçti. Kullanıcı AppData verisi değiştirilmedi. Tam temiz Windows/Electron arayüz kabulü ve MySQL iş senaryolarının tamamı bu iki başlangıç testiyle tamamlanmış sayılmaz.
