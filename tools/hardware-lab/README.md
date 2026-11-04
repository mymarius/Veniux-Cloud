# Veniux Virtual Hardware Test Lab

PowerShell, proje kökünden:

```powershell
$env:NODE_ENV='test'
node tools/hardware-lab/run.cjs
```

Mevcut backend/desktop bağımlılıkları kullanılır. Üretim modu reddedilir. Her koşuda ayrı SQLite ve test anahtarları oluşturulur, sonra temizlenir. Çocuk Node süreçlerinde dış HTTP/HTTPS/fetch istekleri engellenir; yalnız loopback test sunucularına izin verilir. `.env` dosyası yüklenmez, üretim MySQL bağlantısı açılmaz. Tam bir OS güvenlik sandbox’ı değildir.

Çıktı `docs/VENIUX_HARDWARE_TEST_REPORT.md` ve `.local/hardware-lab-runs/latest.json` ile gösterilen küçük kanıt klasörüdür. Fiş HTML’leri gerçek sunucu renderer’ından gelir. PNG barkodlar mevcut ZXing kütüphanesiyle çözülür. Bunlar fiziksel okuyucu/yazıcı veya Android emülatör testi değildir.

Android derleme kontrolü mevcut API 35 jar’ını, ZXing jar’ını, JDK 17’yi ve mevcut 2.4.32 `R.java` dosyasını kullanır; APK’yı yeniden üretmez veya imzalamaz. Emülatör, SDK, sanal makine veya ücretli servis otomatik kurulmaz. Kaynak/Android sürümü ilerlediğinde `run.cjs` içindeki generated-resource yolu güncellenmelidir.

FAIL varsa komut çıkış kodu 1 verir. Önceki iki KDV testi korunmuştur; oran bazlı döküm, indirim, tam/kısmi iade ve yuvarlama regresyonları `retailVat.test.js` içindedir. Yalnız önceki iki testi çalıştırmak için `node tools/hardware-lab/run.cjs --vat-only` kullanılır; odaklı koşu tam raporun üzerine yazmaz. ESC/POS, üretici SDK’sı, bağımsız mobil offline/outbox ve temiz VM kurulum kontrolleri mevcut olmayan altyapı için başarılı gösterilmez.

İlk laboratuvar çalışmasındaki seri köprü düzeltmesine ek olarak KDV çalışması `retailVatService`, `retailReceipt`, `retailDailyService`, `retailReportingService` ve `retailCostService` kaynaklarını günceller. Mevcut JSON satış kaydına ek alanlar konur; DB şeması ve eski satış kayıtları topluca değiştirilmez. Ayrıntılı sözleşme `docs/audits/RETAIL_VAT_2026-10-17.md` içindedir.
