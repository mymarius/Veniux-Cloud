# Excel / CSV toplu ürün aktarımı — 4 Ekim 2026

Kullanım: Stok ve Depo → Ürünler → Excel / CSV aktar. Mevcut ürün kataloğuna eklendi; stok kabul ekranı ve kasa tasarımı değişmedi. Eski İçe/Dışa Aktarma ekranındaki stok işlemi yeniden oluşturulmadı.

1. Excel veya CSV şablonunu indirin ve örnek satırları kendi ürünlerinizle değiştirin.
2. Dosyayı okuyun. Ürün adı, barkod, kategori, birim, alış fiyatı, satış fiyatı ve KDV sütunlarını ayrı ayrı eşleştirin.
3. Mevcut barkodlu ürünler için Güncelle veya Atla seçin.
4. Önizlemede satır hatalarını ve fiyatların eski → yeni değerlerini kontrol edin.
5. Açık onayla geçerli satırları kaydedin. Hatalı satırlar uygulanmaz. Sonuç, eklenen/güncellenen/atlanan/hatalı sayılarını gösterir; gerekçeli CSV raporu indirilebilir.
6. Stok girişini mevcut Stok Kabul ekranında yapın. Aktarım stok kaydı veya stok hareketi oluşturmaz.

## Kurallar

- Excel .xlsx/.xls ve UTF-8 CSV; en fazla 4 MB, 1000 ürün satırı ve 50 sütun. Excel ilk sayfası okunur; farklı sayfa seçici yoktur.
- Excel şablonunda barkod örneği gerçek dosyada metin olarak doğrulandı: 0001234567890. Barkod sütunu metin biçimindedir. Önceden kaybolan sıfırlar tamamlanmaz. Excel sayısal barkod hücreleri reddedilir. CSV metni değiştirilmeden işlenir; CSV'yi Excel'de açıp kaydederken sütun biçiminin metin tutulması kullanıcının sorumluluğundadır.
- Formül hücreleri reddedilir. CSV tırnakları ve ayırıcıları mevcut PapaParse ile, Excel mevcut XLSX kütüphanesiyle ayrıştırılır. Excel işlemi ayrı işçi iş parçacığında süre/bellek sınırıyla yürür; yeni bağımlılık kurulmadı.
- Alış/satış fiyatları sıfır veya pozitif, en fazla iki ondalık basamak; nokta veya virgül kullanılabilir. Binlik ayırıcı ve bilimsel gösterim kabul edilmez. KDV 0–100 arası tam sayıdır; mevzuata göre doğru oranı kullanıcı seçer.
- Barkod metin eşleşmesi firma içinde yapılır. Dosyada tekrar eden barkodun bütün satırları hata olur. Sistem birden fazla ürüne eşliyorsa veya alternatif barkod başka ürünle çakışıyorsa sessiz güncelleme yapılmaz.
- Aktarım NORMAL market ürünleri içindir. Eczane modülündeki ürünler değiştirilmez. Alternatif barkodla ana barkod değiştirilmez; ana barkod kullanılmalıdır.
- Yeni ürün SKU'su otomatik oluşturulur. Güncellenen ürünün kimliği, SKU'su, tedarikçisi ve stokları korunur. Stoklu üründe birim değişikliği reddedilir.
- Önizlemeden sonra ilgili ürün bilgisi değişmişse satır uygulanmaz; yeniden önizleme gerekir.
- Yönetici/müdür yetkisi sunucuda kontrol edilir; aktarım aynı işletme ve işlemi yapan kullanıcıya bağlıdır. Başka kullanıcı/işletme aktarımı okuyamaz veya kaydedemez.
- Kalıcı aktarım kimliğiyle işlem transaction içinde tamamlanır. Aynı kimliğin tekrar/eşzamanlı gönderimi aynı kayıtlı sonucu döndürür; ikinci ürün ve ikinci işlem kaydı oluşmaz. Yenilemede aynı sekmenin saklanan aktarım kimliğiyle önizleme/sonuç geri yüklenir.
- Kullanıcı, dosya adı, aktarım kimliği ve ürünlerin önceki/yeni değerleri işlem günlüğüne yazılır. Sonuç/hata CSV'si formül başlatan metinlere karşı güvenli dışa aktarılır.

## Doğrulama

- Çalışan mevcut SQLite API/veritabanında TEST — Toplu aktarım 0fd3c9b3 ürünü oluşturuldu. Bir ekleme, fiyat 2 → 3 TL güncellemesi ve bir atlama doğrulandı. Tekrar gönderim aynı sonucu döndürdü; mevcut stok toplamları değişmedi; yeni ürünün stoğu 0 kaldı. Kanıt: audit/product-import-live-check.json. TEST ürünü izlenebilirlik için bırakıldı.
- UI'de dosya seçimi, sütun eşleştirmesi, 3 → 5 TL önizleme ve negatif fiyat satırının gerekçesi görüldü. Bu UI örneğinin önizlemesi kaydedilmedi; ürün fiyatı 3 TL olarak kaldı. Görüntü: audit/product-import-ui.png.
- 13 aktarım testi: CSV/Excel metin ve sayısal barkod, formül, sütun sırası, eski/yeni fiyat, mükerrer/alternatif barkod, modül ve yetki, başka işletme, stok koruma, birim engeli, önizleme değişikliği, tekrar gönderim, güvenli hata raporu, dosya/satır sınırları ve şablonun metin barkodu.
- Genel testler: 50 test grubu / 345 test geçti. Üretim derlemesi başarılı. Sonuç: audit/product-import-regression-results.json.
- Genel testlerde mevcut asistanın otomatik servis keşfiyle yöntem adı çakışması yakalandı. Yeni servisin dışa açılan yöntemlerine özel adlar verildi; mevcut CRM/personel akışları korunarak tüm testler tekrar geçirildi.
- MySQL kurulmadı ve gerçek MySQL üzerinde test yapılmadı. Eşdeğer tablo tanımı eklendi; doğrulama SQLite üzerindedir. Fiziksel okuyucu/yazıcı kullanılmadı; bu aktarım stok kabul cihazı doğrulaması yerine geçmez.

## Dosyalar / kurulum

Mevcut Start-Local.ps1 ile başlatılır; 022_product_import.sql otomatik uygulanır. Yeni paket kurulumu gerekmiyor.

- backend/src/database/migrations/022_product_import.sql — kalıcı aktarım ve sonuç tablosu.
- backend/src/config/mysqlSchema.js — MySQL eşdeğer tablo tanımı (test edilmedi).
- backend/src/services/productImportService.js — doğrulama, önizleme, kayıt ve rapor.
- backend/src/services/productImportWorker.js — sınırlı Excel/CSV okuma.
- backend/src/routes/productImportRoutes.js ve normalDepo.js — yetkili API bağlantısı.
- backend/assets/product-import-template.xlsx — indirilebilir metin barkodlu şablon; CSV şablonu API'de üretilir.
- frontend/src/components/ProductBulkImport.jsx ve pages/normal-depo/NormalProducts.jsx — mevcut katalog içinde aktarım ekranı.
- backend/tests/productImport.test.js — aktarım senaryoları.
