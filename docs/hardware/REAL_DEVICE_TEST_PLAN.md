# Gerçek cihaz kabul planı

15 Ekim 2026. Hiçbir okuyucu, el terminali veya termal yazıcı bu raporla onaylanmış değildir.

| Senaryo | Simülasyon | Gerçek cihazda kabul ölçütü |
|---|---|---|
| USB/HID | shared/scanner.test.mjs | 001234567890 korunur; Enter/sonek ayarı; yalnız odaklı alan yakalar |
| Seri okuyucu | scanner-bridge/tests/bridge.test.cjs | Baud/port seçimi, tak-çıkar, bağlantı kopması; uygulama donmaz |
| Tekrarlı tarama | debounce/idempotency testleri | Aynı sipariş/satış tekrarında ikinci stok düşümü yok; etiket adedi açık |
| GS1 | parser örnekleri | FNC1, lot ve SKT, eksik/geçersiz AI reddi; en az10 gerçek barkod |
| Kamera/QR | Android ZXing adaptörü | QR tek kullanımlı, süre dolunca reddedilir; başka işletmeye erişim yok |
| El terminali | WMS servis testleri | Eldiven/tek elle kullanım; kabul→raf→sayım→transfer akışı |
| Kesinti | kontrollü hata senaryosu | Lisans doğrulanamadığında işlem kapanır; tekrar bağlantı stok çoğaltmaz |
| Etiket | shared label testleri | 58×40 ve100×40, gerçek cetvel ölçümü, doğru yazıcı, Türkçe uzun ad, barkod okunur |
| A4 | HTML önizleme | %100 ölçek, kenar/gap doğru, satır taşması yok |
| 58/80mm fiş | Bu tur yeni fiş adaptörü doğrulanmadı | Gerçek sürücü, KDV/para toplamı, uzun ad, kesim, kağıt bitmesi ayrı kabul |
| Yazıcı belirsizliği | local receipt/claim testleri | Kablo çekilip yeniden bağlandığında otomatik ikinci baskı olmaz |

Her cihaz kaydı: marka/model, firmware, işletim sistemi, sürücü sürümü, bağlantı, uygulama sürümü, kağıt ölçüsü, test verisi, beklenen/gerçek sonuç, fotoğraf, tekrar adedi ve sorumlu. En az20 ardışık okuma/baskı ve yeniden başlatma yapılır. Başarısız ölçütte desteklenen cihaz listesine alınmaz. Gizli QR/token fotoğrafı yayımlanmaz.
