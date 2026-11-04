# Veniux Etiket Atölyesi — 2.4.31

## Kullanım

1. Windows ve Android uygulamalarını 2.4.31'e güncelleyin. Yazıcının Windows sürücüsünü kurun ve bir test sayfası alın.
2. Bilgisayarda Stok ve Depo → Daha fazla → Etiket atölyesi bölümünü açın. “Baskı kabulünü aç” seçin. Bilgisayarda kurulu uygun yazıcılar listelenir. Microsoft Print to PDF, OneNote, XPS ve Fax gibi bilinen sanal yazıcılar fiziksel etiket listesine alınmaz.
3. “Telefonu QR ile bağla” bölümünü açın. Yerel kullanımda mevcut güvenli Android eşleştirmesi kullanılır. Resmi bulut kullanımında QR yalnız istasyon ve işletme kimliğini içerir; şifre, kullanıcı oturumu veya lisans anahtarı içermez. Telefonda aynı işletmenin hesabı ve geçerli lisans gerekir. QR uygulamanın bağlantı ekranındaki kamera ile okunur.
4. Telefonda Etiketler'i açıp ürün barkodunu okutun. Ürün kayıtlı değilse önce Ürünler bölümünde tanımlayın. Ana barkod/ürün kodu ve satış fiyatı sistem kayıtlarından alınır. Stok değişmez.
5. Ürünleri listeye ekleyin, etiket adetlerini seçin. Tek listede en fazla 20 ürün, ürün başına en fazla 100, toplam en fazla 200 etiket gönderilebilir.
6. Yazıcı ve kâğıt ölçüsünü eşleştirin. Ölçü ilk kez elle seçilir; donanımdan otomatik kâğıt ölçüsü çıkarılmaz. Yazıcı, ölçü ve görünüm tercihi cihaz/hesap/işletme bazında hatırlanır.
7. Önizlemeyi kontrol edip gönderin. İlk fiziksel denemede 1 adet basarak ölçü, yön, kesim ve okunurluğu kontrol edin. Bilgisayar, Veniux ve yazıcı açık kalmalıdır. Program tepsideyken etkin baskı hizmetinin zamanlayıcısı sürer.

## Tasarımlar ve ölçüler

- Veniux İmza: beyaz zemin, mavi şerit, turuncu köşe ve özgün Veniux logo detayı. Renkli baskı gerektirir.
- Veniux Çizgi: termal yazıcıya uygun siyah/beyaz görünüm.
- 100×40 mm raf etiketi; 58×40 mm ürün etiketi; A4 sayfada 96×40 mm etiket düzeni.
- Barkod olarak gerçek EAN-13, EAN-8, UPC veya Code128 kullanılır. Başına sıfır eklenmez; GTIN, seri, lot, son kullanma tarihi veya indirim uydurulmaz.
- Menşei, net miktar/birim fiyat metni ve fiyat tarihi isteğe bağlı, kullanıcı tarafından doğrulanan ek bilgilerdir. Bu alanlar listedeki tüm ürünlere uygulanır; farklı bilgiler gerekiyorsa ayrı liste gönderin. Etiket metninin işletmenize uygunluğunu ve ek bilgileri baskıdan önce kontrol edin.

## Baskı durumu

“Bilgisayarı bekliyor” kuyruğa alınmayı, “Baskı hazırlanıyor” bilgisayarın işi aldığını, “Yazıcı kuyruğuna iletildi” ise işletim sistemi yazdırma katmanının kabulünü gösterir. Fiziksel kâğıt çıktısı sensörle doğrulanmaz. “Yazıcı kuyruğunu kontrol edin” durumunda otomatik tekrar baskı yapılmaz; çıktıyı ve Windows kuyruğunu inceleyin. Aynı isteğin tekrarı aynı işe döner; yeni baskı için yeni liste hazırlayın veya ürünü yeniden ekleyin.

## Doğrulama ve sınırlar

- Sunucu + mevcut barkod akışı: 10 test başarılı. İşletme ayrımı, görüntüleme rolü, lisans zorunluluğu, fiyat kontrolü, tek iş alma ve sunucudan baskı doğrulaması sınandı.
- Masaüstü + etiket modeli: 5 test başarılı. Kurulu yazıcı hedefi, sayfa ölçüsü, tek baskı makbuzu, oturumsuz işin başlamaması, HTML kaçışı ve miktar sınırları sınandı.
- Üretilen EAN-13, EAN-8, UPC-A ve Code128 çizgileri bağımsız ZXing okuyucuyla çözüldü; 4 örnekte özgün değer korundu.
- Örnek işletmede telefondan barkod → ürün → baskı listesi → test yazıcısını seçme → kuyruk gönderimi arayüzden doğrulandı. Test yazıcısı fiziksel donanım değildir. 390px görünümde etiket önizlemesi tüm kenarlarıyla görünür ve belge taşmaz.
- Etiket API kodu aktif business-20261014-02 sürümüne eklendi; müşteri veritabanı ve özel anahtarlar değiştirilmedi. Kalıcı işler sunucunun özel veri klasöründe label-print altında, işletme bazında ve sınırlı dosya izinleriyle saklanır. 5000 işlik arşiv sınırı vardır.
- İstasyon yalnız yetkili oturum ve lisansla iş alır. Bilgisayar baskıdan hemen önce sabit API adresinden işi tekrar doğrular; istemciden gelen HTML çalıştırılmaz. İş isimleri ve fiyatları kaçışlanmış yerel şablonda render edilir. Aynı işin fiziksel kuyruğa ikinci kez verilmesini önleyen bilgisayar makbuzu vardır.
- Gerçek yazıcı, telefon kamerası/feneri ve fiziksel QR eşleştirmesi bu ortamda uçtan uca denenmedi. Yazıcı modeline ve sürücüye göre ilk kâğıt ayarı/test baskısı gereklidir. Bluetooth/USB yazıcıya telefondan doğrudan sürücüsüz baskı yapılmaz; Windows yazıcı köprüsü kullanılır.
- Android 2.4.31 indirme kanalına yayımlandı ve tam SHA256/boyut kontrolü geçti. Windows paketi imzasız yerel önizlemedir; yayıncı sertifikası sorunu çözülmüş değildir. Kurulu uygulamalar otomatik değiştirilmedi.

## Son paketler
Windows 2.4.31 NSIS paketi tamamlandı; paketlenmiş ön yüz ile güncel derleme SHA256 değerleri eşleşti, sunucudan baskı doğrulaması paket içinde kontrol edildi. Android son düzeltmeleri 2.4.32 (272) olarak yayımlandı; imza ve indirilen dosyanın tam SHA256/boyut kontrolü başarılı. Önceki 2.4.31 dosyası değiştirilmedi. Windows kurulum dosyası imzasızdır. Fiziksel baskı testi bekleniyor.
