# Perakende fiş KDV dökümü — 17 Ekim 2026

## Mevcut akışın bulgusu

Satış `retailDailyService.sale` içinde tek işlemde kaydediliyor. Miktar altı ondalığa, finansal toplamlar kuruşa indirgeniyor; sipariş indirimi tutar ağırlığı/en büyük kalan yöntemiyle kalemlere dağıtılıyor. `retailCostService.snapshot` satış anındaki `vat_rate` ve indirim sonrası `net_ex_vat_cents` değerlerini zaten kaydediyordu. Önceki donanım raporundaki “snapshot’ta vergi bilgisi yok” ifadesi doğru değildi; eksik olan fişte bu bilgilerin dökümüydü.

## Fiyat ve yuvarlama sözleşmesi

- Katalog `sale_price` ve varsayılan fiyat değişikliği mevcut akıştaki gibi **KDV dahil** kalır. Alış fiyatının KDV temeli satış fiyatına uygulanmaz.
- KDV hariç fiyat yalnız fiyat değiştirme yetkisiyle, `price_override` yanında açık `price_tax_basis: "exclusive"` verilerek alınır. `inclusive` mevcut davranıştır. Temel alanını tek başına veya geçersiz değerle göndermek reddedilir. Bu API desteği eklenmiştir; uygulamanın genel ürün fiyatlandırma ekranı yeniden tasarlanmamıştır.
- KDV hariç girişte önce miktarlı satır matrahı kuruşa yuvarlanır, sonra KDV kuruşa yuvarlanarak brüte eklenir. Birim başına erken yuvarlama yapılmaz. Örneğin 10 adet × 0,01 TL hariç ve %20 = 0,10 matrah + 0,02 KDV = 0,12 TL.
- `entered_unit_price_cents` özgün giriş ve temelini saklar. Mevcut satış raporlarının `unit_price` referansı brüt kalır; bu gösterim/referans alanından finansal toplam yeniden hesaplanmaz. Gerçek toplamlar integer kuruş alanlarıdır.
- KDV dahil indirim sonrası satır için `matrah = half_up(brüt_kuruş × 100 / (100 + oran))`; `KDV = brüt − matrah`. BigInt bölme kullanılır. Grup toplamı satır matrah/KDV toplamıdır; oran grubunu baştan hesaplayıp satırlarla bir kuruş fark üretmez.
- İndirim KDV dahil satış toplamından alınır; mevcut oransal indirim dağıtımı değişmez. %100 indirim ve %0 KDV desteklenir. Testlerdeki oranlar ürün verisinden gelen örneklerdir; yasal oran belirleme iddiası değildir.

## İade ve geçmiş kayıtlar

Yeni kalemler `vat_version: 1` ile işaretlenir. Kısmi iadenin brütü mevcut kümülatif miktar yöntemini korur. Kümülatif vergi payı özgün verginin iade edilen brüte oranından BigInt ile hesaplanır; matrah brüt ile vergi farkıdır. Her iade olayı negatif olmayan matrah/KDV taşır; son tam iadede toplam özgün satışa eşitlenir. Aynı işlem anahtarı yeniden gönderilince ikinci iade yaratılmaz.

Eski sürüm işaretçisi olmayan iadelerin mevcut finansal dağıtım yolu korunur. Eski kayıtlara bugünkü katalog oranı/fiyatı yazılmaz. Fişte kayıtlı vergi bilgisi yoksa tutar “KDV bilgisi kaydedilmemiş” olarak ayrılır; sıfır KDV veya tahmini oran gösterilmez. Fiş okumak DB’ye yazmaz. Üretim DB’si açılmadı; şema migration’ı gerekmedi.

## Dosya bazında değişiklikler

- `backend/src/services/retailVatService.js`: kuruş/rate doğrulama, hariç→dahil dönüşümü ve oran bazlı satış/iade/kalan döküm.
- `backend/src/services/retailDailyService.js`: açık fiyat temeli, kayıtlı dökümler ve iade olayı KDV alanları.
- `backend/src/services/retailCostService.js`: ortak oran doğrulama, yeni kayıt sürümü ve negatif vergi üretmeyen kısmi iade kuruş dağıtımı.
- `backend/src/services/retailReceipt.js`: 58/80 mm renderer; oran başına matrah/vergi/toplam, iade ve kalan dökümleri; uzun metin/sayı sarma ve tarihsel eksik bilgi açıklaması.
- `backend/src/services/retailReportingService.js`: yetki kontrollü satış ayrıntısını yeni renderer’a iletir.
- `backend/tests/retailVat.test.js`: dahil/hariç, çoklu oran/indirim, küsuratlı miktar, küçük tutarlarda iade mutabakatı, iptal, replay, eski kayıt ve kötü giriş testleri.
- `tools/hardware-lab/run.cjs`: odaklı iki KDV testi ve bütün paket; perakende kâr, günlük kasa ve vardiya regresyonları da dahil.
- `tools/hardware-lab/report.cjs`, `README.md`, `serve-artifacts.cjs`: güncel rapor, tekrar çalıştırma ve yalnız yerelde fiş düzeni denetimi.
- `docs/VENIUX_HARDWARE_TEST_REPORT.md`: son gerçek koşu sonuçları; engelli/yapılmamış kontroller ayrı.

## Gerçek doğrulama sonucu

Önceki iki LAB-VAT testi odaklı koşuda **2 PASS, 0 FAIL** verdi. Ardından tam paket `.local/hardware-lab-runs/run-f905ac3335801b8f5c712a53` altında yeniden çalıştı: **130 Jest testi + 26 Node testi + 5 ZXing optik kontrolü + 1 Android Java derleme kontrolü = 162 başarılı otomatik kontrol, 0 başarısız**. Son tarayıcı DOM denetiminde ayrıca 58 ve 80 mm için 2 taşma kontrolü geçti (toplam rapor matrisi 164 PASS). Beş BLOCKED ve beş NOT TESTED kontrol başarı hesabına dahil edilmedi.

Uzun ürün adlı sentetik fişlerde 58 mm gövde 204,09 px, 80 mm gövde 287,23 px ölçüldü; her iki genişlikte taşan öğe sayısı 0. Bu ekran CSS ölçümüdür; fiziksel kağıt ve yazıcı sürücüsü testi değildir. `receipt-58.html`, `receipt-80.html`, PNG kanıtları ve `receipt-layout.json` koşu klasöründedir. Geçici DB/anahtarlar kaldırıldı; tüm alt komutların çıkış kodu 0.

## Kalan sınırlar ve riskler

Satış bilgi fişi mali cihaz fişi/e-belge değildir. Gerçek termal yazıcı kağıdı, kesici, ESC/POS kod sayfası, Android emülatörü/üretici tuşu ve temiz Windows VM koşulları ayrıca doğrulanmalıdır. Eski eksik vergi alanları otomatik doldurulmaz. MySQL üzerinde üretim çalıştırması yapılmadı. Canlı site, API ve dağıtım paketleri yayımlanmadı.
