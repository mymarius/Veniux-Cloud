# Eczane Geçişi Son Kabul Takibi — 10 Ekim 2026

Bu belge, mevcut ürün/stok aktarımı için yapılan son kabul kontrollerinin kaydıdır. Yeni iş modülü, ZIP ya da Windows kurulum paketi üretilmedi. Kontroller yalnız ayrı, sahte verili yerel kabul kurulumu üzerinde yapıldı; üretim verisine yazılmadı.

## Geçen kontroller

| Alan | Kanıt |
|---|---|
| Program tespiti | Masaüstü algılayıcı, Windows kurulu-program kayıtları ile bulunan `.exe` dosyasını birlikte arar. Yalnız klasör, yalnız kayıt veya yalnız ikili bulunduğunda sonuç **Olası kurulum**dur; yalnız ikisi birlikteyse **Doğrulanmış kurulum**dur. Tarayıcı ucu yerel tespit sonucu değil, açıkça `catalog_only` sağlayıcı kataloğudur. |
| Sağlayıcı kaynağı | Farmakom satırı [resmî ürün sayfasına](https://farmakom.com/Default.aspx), TEB satırı [CETAŞ otomasyon kılavuzları dizinine](https://cetas.teb.org.tr/m1_4_otomasyon.php) bağlanır. Bu kaynaklar belirli bir menü yolu veya dosya biçimi doğrulamadığı için ekran, sürüme ait sağlayıcı yönergesini kullanmayı ister. İlon ve RxMediaPharma için doğrulanmış kaynak yoktur; bu durum açıkça gösterilir. |
| Veri minimizasyonu | Aktarım servisinde regex tabanlı saklama yoktur: incelenmiş, tam sütun adları listesi uygulanır. İzinli olmayan ve benzer adlı sütunların hücreleri veritabanına yazılmadan atılır. `pharmacyMigration.test.js` içinde hasta notu ve geçmişi içeren CSV’nin yalnız Barkod/İlaç Adı/Miktar alanlarını sakladığı ve `parsed_json`, önizleme ve sonuçta bu içeriklerin bulunmadığı doğrulandı. Ham dosya için kalıcı yükleme veya geçici dosya yolu yoktur; işçi belleği yalnız ayrıştırma süresince kullanılır. |
| Tarih onayı | Önizleme AA/YYYY veya YYYY-AA biçimini ve ay sonu kuralını bildirir. Kullanıcı onay kutusunu işaretlemeden commit isteği sunucu tarafından reddedilir. `08/2026 → 2026-08-31` dönüşümü hem önizlemede hem arayüz onayında açıkça gösterilir. |
| Mükerrer/tekrar denemesi | Aynı import batch’i ikinci kez commit edildiğinde ürün ve stok yeniden eklenmez. Servis testi ürün sayısını ve 60 birim stoğu ikinci çağrıdan sonra aynı doğruladı. |
| Maliyet gizliliği | `authorizationOperations.test.js`, kasiyer ve depo operatörünün ürün, stok, tarayıcı ve satış ayrıntısı API yanıtlarında `purchase_price`, maliyet anlık görüntüsü ve stok değerini alamadığını; yöneticinin ticari alanları koruduğunu doğruladı. |
| Arayüz/kılavye | Ayrı yerel kabul sunucusunda ekran görüntüleri alındı. Modal ilk açılışta içindeki denetime odaklanır; Shift+Tab odağı modal içinde tutar; Esc kapatır ve odak açan düğmeye döner. |

## Gerçek arayüz görüntüleri

Görüntüler ayrı sahte kabul verisi ile yerel Chrome’da üretildi:

| Ekran | Masaüstü | Küçük ekran |
|---|---|---|
| Ana ekran | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/dashboard-desktop.png) | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/dashboard-small.png) |
| Ürünler | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/products-desktop.png) | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/products-small.png) |
| Depolar | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/warehouses-desktop.png) | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/warehouses-small.png) |
| Eczane Geçiş Asistanı | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/migration-desktop.png) | [PNG](C:/Users/mymarius/.codex/visualizations/2026/10/09/01a122a7-b47c-7141-8a20-1b33fac012e2/ui-acceptance/screenshots/migration-small.png) |

## Başarısız / tamamlanmamış kontroller

| Alan | Gerçek durum |
|---|---|
| Hedef değişimi ve geri dönüş | Başarısız. Mevcut hedef çiti, bir hedefteki yazmayı kapatır; yeni hedef satış aldıktan sonra eski hedefin doğrudan yeniden etkinleştirilmesini, iki ayrı veritabanı arasında kalıcı uzlaştırma kaydıyla engelleyen merkezi bir koordinatör yoktur. Transaction dışındaki her yazma yolunu kapsadığı ve yeniden başlatmada iki hedefin aynı anda aktif olamayacağı kabul edilmedi. Bu nedenle eski hedefe dönüş, uzlaştırma tamamlanana dek teknik olarak zorunlu kılınmış değildir. |
| Kesilen isteğin gerçek HTTP/API tatbikatı | Kısmi. Aynı batch’in tekrar commit edilmesi ve atomik servis işlemi test edildi; ağ kesintisi sırasında HTTP istemcisi iptali ve ardından gerçek API üzerinden yeniden deneme senaryosu bu turda otomatikleştirilmedi. |
| MySQL genişletilmiş kabulü | Doğrulanamadı. Bu turda MySQL test sunucusu bağlantı başlatamadığı için genişletilmiş cutover testleri çalışmadı. Önceki ayrı MySQL 8.4 kabulünün 16 testi bu yeni hedef-değişimi kuralını kanıtlamaz. |

## Doğrulanamayan sınırlar

- Bu bilgisayarda gerçek Farmakom sağlayıcı örneği, lisanslı kurulum ve sürüm-kılavuzu sunulmadı. Farmakom uyumluluğu tamamlandı veya doğrudan bağlantı sertifikalandırıldı denmez.
- Kalıcı depolama yüzeyleri kaynak ve test verisi üzerinden incelendi. İşçi süreci belleği, işletim sistemi crash dump’ı veya üçüncü taraf antivirüs/telemetri depoları için mutlak veri yokluğu iddia edilmez.
- Masaüstü Electron uygulamasında gerçek Windows kayıt defteri ve ikili eşleşmesi bu turda örnek kurulumla denenmedi; kod ve tarayıcı katalog davranışı doğrulandı.

## Çalıştırılan doğrulamalar

- `backend`: `pharmacyMigration.test.js` ve `authorizationOperations.test.js` — **14/14 geçti**.
- `frontend`: üretim derlemesi — **geçti**. Mevcut `appearance-boot.js` script bildirimi ve 500 kB üzeri parça uyarısı sürüyor.
- Yerel UI: sahte kullanıcı ve ayrı SQLite veri dizini ile sekiz Chrome ekran görüntüsü; modal odak/Shift+Tab/Esc/odak geri dönüş denendi.

Bu belge “tüm eksikler giderildi” sonucunu vermez. Özellikle hedef değişimi/uzlaştırma koruması ve gerçek sağlayıcı örneği kabul engeli olarak kalır.
