# Kasa günlük kullanım incelemesi — 7 Ekim 2026

Mevcut tasarım, satış hesapları ve stok işlemleri korundu. Yeni iş modülü ve şema değişikliği yok.

## Değişiklikler
- Barkod alanı odağı ve hata sonrası girişin korunması; seri/yerel okumalar açık pencere ve başka metin alanlarında durdurulur. HID yalnızca özel barkod alanında yakalanır.
- F10 ürün arama, F7 ilk ürün miktarı, F8 ödeme yöntemi, F9 barkod alanı. Mevcut F2/F3/F4 ve Ctrl K ile çakışmaz. Açık pencerede kasa kısayolları devre dışıdır.
- Ödeme, iade ve iptal için ortak pencerede Enter onaylamaz, Esc vazgeçer; Tab odağı pencere içinde tutar.
- Barkod sorguları sürerken ödeme engellenir. Satış sırasında düğmeler ve alanlar kilitlenir; işlem durumu gösterilir.
- GET /api/scanner/sale-status: firma ve işlemi yapan kullanıcı kontrolü; önbelleğe alınmaz. Kayıp/başarısız yanıt sonrası sonuç sorgulanır. Sonuç bilinmiyorsa özgün anahtar ve ödeme gövdesi korunur; yeni satış engellenir. 8 saniyede bir ve bağlantı geri geldiğinde sorgulama sürer. Yenileme sonrası sepet ve girilen ödeme bilgileri bekleyen işlemden geri getirilir.
- Kesin reddedilmiş ve sunucuda bulunmayan işlemde sepet korunarak düzeltme mümkündür.
- Uzun ürün adları kırılır, sepet kendi içinde kaydırılır ve başlık sabit kalır. Küçük ekranda genel sayfa taşması önlenir.
- Boş arama ve bilinmeyen barkod açıklamaları. Kasa ürün görsellerine bağlı değildir; görselsiz ürün adı/SKU ile işlem yapılır.
- Kasa sayfasında asistan bildirimi ödeme düğmesini örtmeyecek üst konuma taşındı; açık onay penceresinde gizlenir.

## Gerçek doğrulamalar
Ayrı veritabanı: `.local/retail-ux-2.sqlite`. Üretim verilerine test işlemi yazılmadı.

| Kontrol | Sonuç |
| --- | --- |
| 25 ayrı barkodun hızlı manuel/HID alanı simülasyonu | Geçti; 25 satır, 250 TL |
| Aynı ürün tekrar okuma | Geçti; 26 birim, 260 TL; son sürümde üç okuma 3 miktar |
| F7/F8/F9/F10 odak | Geçti; DOM aktif alanı kontrol edildi |
| Ödeme Enter ve Esc | Geçti; onay oluşmadı, sepet korundu |
| İade ve iptal Enter, Esc/Vazgeç | Geçti; 0 iade/iptal kaydı, stok değişmedi |
| 390×844 küçük ekran / uzun ad ve sepet | Geçti; belge genişliği 384, kaydırma genişliği 384; sepet iç kaydırma |
| Satış kaydedildikten sonra yanıt bağlantısının kesilmesi | Geçti; sonuç sorgusuyla fiş açıldı, ikinci satış yok |
| Satış ve sonuç sorgusuna 503 bağlantı hatası | Geçti; satış düğmesi kilitli, sepet ve 20 TL nakit yenilemede korundu; aynı anahtarla 10 TL satış ve 10 TL para üstü |
| 14 saniye geciken satış yanıtı / istemcinin 12 saniye zaman aşımı | Geçti; kayıt sunucudan bulundu, tek satış 10 TL |
| İşlem sürerken ikinci gönderimin engellenmesi | Geçti; tarayıcıda devre dışı düğme; aynı anahtarın tekrar gönderimi API testinde tek stok düşümü |
| Boş ürün araması | Geçti; anlaşılır mesaj tarayıcıdan görüldü |
| Sunucu kasa/vardiya/kurtarma regresyonları | Geçti; 19 test / 3 dosya |
| Barkod sırası/sıfırlar/GS1/para/bekleyen işlem ortak testleri | Geçti; 7 test |
| Üretim ve ayrı önizleme derlemeleri | Geçti |
| Fiziksel USB/Bluetooth/seri okuyucu, kamera ve yazıcı | Doğrulanamadı; donanım yok |
| MySQL | Doğrulanamadı; SQLite kullanıldı |

Son test veritabanında 5 satış ve 0 ters işlem olmalıdır: 10+10+260+10+10=300 TL. İlk ürün 96, ikinci 98, dördüncü 98 stok; diğerleri önceki uzun sepet satışına göre 99. İade/iptal klavye testleri yalnızca vazgeçme olarak yürütüldü. Ağ testleri test sunucusundaki hata enjeksiyonudur; fiziksel ağ veya okuyucu testi değildir.

## Dosyalar
`frontend/src/pages/RetailPos.jsx`, `RetailPos.css`, `frontend/src/components/ScannerPanel.jsx`, `frontend/src/scanner/useScanner.js`, `frontend/src/components/RetailSalesHistory.jsx`, `frontend/src/components/ui/DialogShell.jsx`, `frontend/src/components/AssistantLauncher.jsx`, `AssistantLauncher.css`, `backend/src/routes/scannerRoutes.js`, `backend/tests/retailRecovery.test.js`.

Küçük ekran kanıtı: `audit/retail-ux-small.jpg`. Test yardımcıları `.local/retail-ux-preview.cjs`, `.local/retail-ux-serve.cjs`; bunlar üretim API'sine hata enjeksiyonu eklemez. Yerel ana API yeni sorgu ucunu yüklemek için yeniden başlatıldı, sağlık kontrolü geçti.
