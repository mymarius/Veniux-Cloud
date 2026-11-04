# Brüt kâr raporu — 6 Ekim 2026

## İnceleme ve kullanım

Mevcut kasa gün sonu, ödeme, satış geçmişi, lot seçimi ve iade akışları korundu. Önceki satış kayıtlarında maliyet/KDV/kategori anlık kaydı bulunmuyordu; bugünkü alış fiyatıyla geçmiş kâr hesaplamak doğru değildi. Bu nedenle eski, doğrulanmamış kayıtlar güncel katalog verileriyle doldurulmadı.

Rapor **Market Kasası → Gün sonu → Brüt kâr · seçili depo** bölümünde. Yönetici ve işletme yöneticisi erişebilir. Günlük, son yedi günlük ve başlangıç/bitiş tarihleri dahil özel aralık desteklenir. Ürün, satış anındaki kategori ve kasiyer filtreleri vardır. CSV ve Excel çıktıları aynı sunucu hesaplamasını kullanır. Mevcut kasa gün sonu raporu ayrıca korunur; onun tutarlarının KDV dahil olduğu belirtildi.

Ürün kartındaki alış fiyatının **KDV dahil/hariç temeli** ve KDV oranı, yeni satış/kabul öncesinde doğrulanmalıdır. Varsayılan boş temel bilinmeyen maliyettir. Açıkça doğrulanmış temel ile sıfır fiyat gerçek sıfır maliyet kabul edilir. Eski lot kabullerinin maliyet temeli eksikse ürün kartını bugün düzenlemek o lotun geçmiş maliyetini doğrulamaz.

## Hesaplama

- Parasal rapor tutarları kuruş olarak tutulur; miktar ve oran hesaplarında tamsayı oranlama kullanılır. İadede biriken oranlama farkları son iadede dengelenir.
- Satış fiyatı KDV dahildir. İndirim öncesi satış, indirim, iade ve net satışın KDV dahil/hariç değerleri ayrı gösterilir. Esas brüt kâr, **KDV hariç net satış − KDV hariç satılan ürün maliyeti** olarak hesaplanır. KDV dahil fark yalnızca ayrıca etiketlenmiş aritmetik farktır.
- Lotlu satışta gerçekten ayrılan lot kullanılır. Aynı lotun tamamlanmış mal kabul fiyatları kabul miktarlarıyla ağırlıklandırılır. FEFO lot seçer; maliyet yöntemi değildir. Kabul kayıtlarındaki alış KDV oranı/temeli de saklanır.
- Lotsuz stokta satış anındaki, temeli doğrulanmış katalog alış fiyatı kullanılır. Bu yöntem lotsuz envanterin tarihsel ağırlıklı ortalaması değildir. Katalog alış fiyatının dönüşümünde ürünün tanımlı KDV oranı kullanılır. Kabulün alış KDV oranı bundan farklıysa katalog maliyet temeli bilinmeyen yapılır; yanlış oranla kâr üretilmez. Lot maliyeti kendi kabul oranıyla hesaplanabilir.
- Satış anındaki maliyet, KDV ve kategori mevcut satış JSON kaydına eklenir. Sonradan ürün veya kabul fiyatı değişse de geçmiş maliyet tekrar hesaplanmaz. İade sayaçları maliyetin başlangıç değerlerini değiştirmez.
- Bilinmeyen maliyet sıfır kabul edilmez: ilgili satırlar ayrı işaretlenir; toplam maliyet/brüt kâr bilinmiyor gösterilir, bilinen maliyet alt toplamı ayrıca verilir. Eski satışta KDV anlık kaydı yoksa KDV hariç sonuç da bilinmiyor olur.
- Satılabilir iade, ilk satılan lotun sabit maliyetini miktar oranında geri alır. Hasarlı/karantina iadesinde satılabilir stok geri kazanımı varsayılmaz; maliyet otomatik azaltılmaz ve değerleme bekleyen maliyet ayrı gösterilir. Sonraki değerleme/serbest bırakma bu rapora otomatik muhasebeleştirilmez.
- Satış satış gününe; iade iade işlem gününe yazılır. Bugün tamamen iptal edilmiş satış önceki tarih raporlarında da gelirden çıkarılır; bu nedenle önceki dönem raporu iptal sonrası değişebilir. İptal ayrı sayılır, gelir olarak sayılmaz.
- Kira, maaş, diğer işletme giderleri ve sonradan stok değerleme işlemleri kapsam dışıdır. Sonuç net işletme kârı veya resmî mali tablo değildir.

## Yetki ve güvenlik

JSON, CSV ve XLSX için sunucuda admin/manager kontrolü, firma ve depo sınırı uygulanır. Kasiyer rapor/çıktı isteği 403; başka firmanın deposu 404; oturumsuz istek 401 döner. CSV metin hücreleri formül girişine karşı korunur; XLSX metinleri formül olarak oluşturulmaz. Ürün maliyet temeli değişiklikleri kullanıcı ve önceki/sonraki değerlerle kaydedilir. Tarih, filtre ve güvenli parasal büyüklük sınırları doğrulanır.

## Gerçek test sonuçları

SQLite üzerinde yeni `retailProfit.test.js` içinde **17 senaryo** çalıştırıldı: indirim/KDV tutarlılığı, değişen katalog fiyatına rağmen geçmiş maliyet, farklı maliyetli lotlar, aynı lotta ağırlıklı ortalama, KDV dahil alış, üç kısmi iadenin kuruş toplamı, fazla iade engeli, hasarlı/karantina, iptal, eksik maliyet, açık sıfır maliyet, eski kayıt, farklı gün iadesi, tarih/ürün/kategori/kasiyer filtreleri, CSV/XLSX içerikleri, sunucu yetkileri, eski lot maliyeti, ürün maliyet ayarı ve kabulün katalog KDV temelini koruması. Bazı testler aynı senaryoda birden fazla durumu doğrular.

Tam regresyon çalışması **55 test grubu / 433 test geçti**. Bunun ardından son mal kabul/KDV düzeltmesiyle dört kritik grup tekrar çalıştırıldı: **55/55 test geçti** (17 yeni kâr testi dahil). Frontend üretim derlemesi geçti; mevcut büyük paket boyutu uyarısı sürüyor. JSON kanıtları `audit/gross-profit-regression-results.json` ve `audit/gross-profit-critical.json` içindedir.

Ayrı test sunucusu ve test SQLite verileriyle tarayıcıda günlük/haftalık/özel aralık ve ürün/kategori/kasiyer filtreleri doğrulandı. Örnekte KDV hariç net satış **90 TL**, kalan maliyet **40 TL**, brüt kâr **50 TL**; güncel katalog fiyatı 999 TL olmasına rağmen sonuç sabit. Eksik maliyetli ikinci ürün eklendiğinde toplam kâr bilinmiyor ve bilinen maliyet alt toplamı 40 TL. Ekran kanıtları `audit/gross-profit-lot-report.jpg` ve `audit/gross-profit-unknown.jpg`.

Tarayıcı test aracındaki doğrudan tarih `fill` işlemi React durumunu değiştirmedi; gerçek klavye ok tuşuyla tarih değişimi ve rapor güncellemesi doğrulandı. CSV/Excel düğmelerine basıldı, ekranda indirme hatası yoktu, fakat uygulama içi tarayıcı indirme olayını bildirmedi. **Tarayıcıdan diske kaydetme doğrulanmadı**; API çıktılarının içerikleri ve XLSX dosyasının tekrar okunabilmesi SQLite/API testlerinde doğrulandı. Bunlar farklı doğrulama kapsamlarıdır.

Testler üretim satış/stok verilerine işlem eklemedi. Ayrı test sunucusu kapatıldı. MySQL, fiziksel okuyucu/yazıcı veya bağımsız muhasebe sistemiyle doğrulama yapılmadı.

## Veritabanı ve devreye alma

`025_sale_cost_basis.sql` yalnızca ürün ve kabul kayıtlarına nullable maliyet KDV alanları ekler; geçmiş tutarları değiştirmez. Yerel API yeniden başlatıldı, migration uygulandı. Üretim SQLite `integrity_check` sonucu `ok`, foreign key ihlali sayısı **0**, API health sonucu **ok**.

Geçiş öncesinde SQLite tutarlı güvenlik yedeği alındı: `backend/storage/backups/f41cf998-1770-4f46-a62d-735e17ce93df.vnxsecure`, durum healthy/bütünlük ok, şema `024_procurement.sql`. Bu yedek eski şemaya aittir; mevcut geri yükleme uyumluluk denetimi nedeniyle yeni 025 şemasına doğrudan geri yükleme iddiası yoktur. Üretimde geri yükleme yapılmadı.

## Değişen dosyalar

Yeni dosyalar:

- `backend/src/database/migrations/025_sale_cost_basis.sql`
- `backend/src/services/retailCostService.js`
- `backend/src/services/retailProfitService.js`
- `backend/tests/retailProfit.test.js`
- `frontend/src/components/RetailGrossProfitReport.jsx`

Mevcut akışlara eklemeler:

- `backend/src/services/retailDailyService.js`: satış maliyeti/KDV anlık kaydı, iade maliyet payları.
- `backend/src/services/wmsInboundService.js`: kabul maliyeti KDV temeli/oranı ve katalog fiyat güncelleme tutarlılığı.
- `backend/src/services/procurementService.js`: sipariş fiyatını mevcut kabul oluşturma akışına aktarır.
- `backend/src/controllers/productController.js`: maliyet temeli/KDV kaydı ve değişiklik izi.
- `backend/src/routes/scannerRoutes.js`: yetkili rapor ve CSV/XLSX uçları.
- `frontend/src/pages/RetailPos.jsx`: mevcut gün sonuna kâr bölümü.
- `frontend/src/components/RetailDayReport.jsx`: mevcut tutarların KDV temeli açıklaması.
- `frontend/src/pages/normal-depo/NormalProducts.jsx`: alış fiyatı KDV temeli ve KDV oranı alanları.
